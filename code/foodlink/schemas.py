"""Request and response bodies.

Field names are camelCase on the wire to match the existing TypeScript types,
while staying snake_case in Python. `alias_generator` does the translation so
neither side has to compromise.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from pydantic.alias_generators import to_camel

from .models import SELF_SIGNUP_ROLES, DonationStatus, UserRole


class Schema(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


# ─── Auth ────────────────────────────────────────────────────────────────────

class RegisterRequest(Schema):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: UserRole
    organization: str | None = None
    phone: str | None = None

    # NGO-only. These seed the recipient organisation created alongside the
    # account. All optional so signing up stays short — an organisation
    # without coordinates is simply not matchable until it fills them in.
    organization_type: str | None = None
    location: str | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    capacity: int | None = Field(default=None, gt=0)

    @field_validator("role")
    @classmethod
    def _reject_self_made_admins(cls, role: UserRole) -> UserRole:
        """Registration cannot mint an administrator.

        Rejected here rather than in the router so the restriction is part of
        the published schema: `admin` is not an accepted value for this field
        and the OpenAPI document says so.
        """
        if role not in SELF_SIGNUP_ROLES:
            raise ValueError(
                "Administrator accounts cannot be created through registration"
            )
        return role


class AdminUserCreate(Schema):
    """Account creation by an existing administrator.

    Same shape as registration minus the guard: this is the one path through
    the API that may set `role` to `admin`, and it is reachable only with an
    administrator's own bearer token.
    """

    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: UserRole
    organization: str | None = None
    phone: str | None = None


class UserUpdate(Schema):
    """Administrative changes to an account. Every field is optional."""

    is_active: bool | None = None
    role: UserRole | None = None
    name: str | None = Field(default=None, min_length=1, max_length=120)
    organization: str | None = None
    phone: str | None = None


class ProfileUpdate(Schema):
    """What an account may change about itself.

    Role, email and active status are absent: they decide what the account can
    do and who it is, so they belong to an administrator, not to the holder.
    """

    name: str | None = Field(default=None, min_length=1, max_length=120)
    organization: str | None = None
    phone: str | None = None


class PasswordChange(Schema):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class UserOut(Schema):
    id: int
    name: str
    email: EmailStr
    role: UserRole
    organization: str | None = None
    #: The holder's own number. `ProfileUpdate` lets an account set this and
    #: `RegisterRequest` lets it arrive at sign-up, so leaving it out here made
    #: it write-only: the profile form could save a number and never show it
    #: again. Every response carrying `UserOut` describes the caller's own
    #: account — register, login, `GET/PATCH /me`, `POST /password` — so this
    #: widens nobody else's contact data. Other people's numbers stay behind
    #: the admin view (`UserAdminOut`) and `RecipientOut`.
    phone: str | None = None
    initials: str
    #: Which record this account acts for. Exactly one is set for ngo and
    #: volunteer accounts; donors act as themselves and admins act for nobody.
    recipient_id: int | None = None
    volunteer_id: int | None = None


class UserAdminOut(UserOut):
    """The fuller view an administrator sees on the user list."""

    phone: str | None = None
    is_active: bool
    created_at: datetime


class TokenResponse(Schema):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ─── Recipients ──────────────────────────────────────────────────────────────

class RecipientOut(Schema):
    id: int
    name: str
    type: str
    location: str
    latitude: float | None = None
    longitude: float | None = None
    capacity: int
    contact_person: str | None = None
    phone: str | None = None
    is_verified: bool
    reliability_score: int
    accepted_donations: int


class RecipientUpdate(Schema):
    """An organisation completing or correcting its own profile."""

    name: str | None = Field(default=None, min_length=1, max_length=160)
    type: str | None = None
    location: str | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    capacity: int | None = Field(default=None, gt=0)
    contact_person: str | None = None
    phone: str | None = None


# ─── Couriers ────────────────────────────────────────────────────────────────

class VolunteerOut(Schema):
    id: int
    name: str
    phone: str | None = None
    location: str
    is_available: bool
    completed_deliveries: int
    rating: float


class VolunteerUpdate(Schema):
    """A courier adjusting their own availability or base location."""

    is_available: bool | None = None
    location: str | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)


# ─── Matching ────────────────────────────────────────────────────────────────

class MatchOut(Schema):
    recipient_id: int
    recipient_name: str
    overall_score: int
    #: Null for a reader who is not the organisation this match is about. The
    #: figures beside it are then computed from a blurred position rather than
    #: the kitchen's own, so there is no true distance to publish — see
    #: `matching.score_pair` and `DECISIONS.md` D-45. An organisation's own
    #: match (`DonationOut.viewerMatch`) always carries one, which is what
    #: D-33's distance display reads.
    distance_km: float | None
    distance_score: int
    quantity_score: int
    capacity_score: int
    deadline_score: int
    reliability_score: int
    reasons: list[str]


# ─── Donations ───────────────────────────────────────────────────────────────

#: Ceiling on `image_url`, in characters, enforced at the request boundary.
#:
#: There is no upload endpoint and no object storage, so the frontend sends a
#: base64 `data:` URL rather than a link and the whole image lives in the
#: donation row — which `GET /api/donations` then returns inline, at a limit of
#: 500, on every load and after every write. An unbounded column therefore
#: prices one donor's photo into every other account's next request.
#:
#: 256 KiB of characters is about a 190 KB image: comfortable for a web-sized
#: photo and far above any ordinary remote URL, while refusing the multi-megabyte
#: data URLs an unresized phone camera produces. ⚠️ That is a real behavioural
#: bound, not a formality — a raw camera capture is now rejected with a 422, and
#: resizing before encoding (or object storage, `TASKS.md` → *Backlog → F*) is
#: what lifts it.
MAX_IMAGE_URL_LENGTH = 262_144


class DonationCreate(Schema):
    food_name: str = Field(min_length=1, max_length=160)
    category: str
    quantity: int = Field(gt=0)
    unit: str = "Meals"
    storage_type: str = "Room Temperature"
    description: str = ""
    location: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    prepared_at: datetime | None = None
    pickup_deadline: datetime
    image_url: str | None = Field(default=None, max_length=MAX_IMAGE_URL_LENGTH)


class StatusEventOut(Schema):
    to_status: DonationStatus
    from_status: DonationStatus | None = None
    occurred_at: datetime
    note: str | None = None


class DonationOut(Schema):
    id: int
    donor_id: int
    donor_name: str
    donor_organization: str | None = None
    food_name: str
    category: str
    quantity: int
    unit: str
    storage_type: str
    description: str
    image_url: str | None = None
    location: str
    latitude: float
    longitude: float
    prepared_at: datetime | None = None
    pickup_deadline: datetime
    status: DonationStatus
    recipient_id: int | None = None
    recipient_name: str | None = None
    volunteer_id: int | None = None
    volunteer_name: str | None = None
    #: Frozen, and about a *decision*: the top-ranked organisation's score when
    #: the donor posted, replaced by the accepting organisation's own score when
    #: one takes it. The same number for every reader.
    match_score: int | None = None
    #: Live, and about the *reader*: this donation ranked against the calling
    #: organisation, from the same `matching.score_pair` `/matches` reports.
    #: Null unless the caller is an NGO with a profile and the donation is still
    #: open to acceptance — outside that there is no offer on the table and
    #: `match_score` is the number to show.
    #:
    #: The whole ranking travels rather than just its total, so that a screen
    #: showing the headline and a screen showing the breakdown are reading one
    #: object from one request. Two separate live calls would round differently
    #: as the deadline decays between them, which is a smaller version of the
    #: very inconsistency this field exists to remove.
    #:
    #: The two scores answer different questions and must never be relabelled as
    #: each other: presenting `match_score` as the reader's own match is the
    #: defect this field replaces.
    viewer_match: MatchOut | None = None
    distance_km: float | None = None
    created_at: datetime
    events: list[StatusEventOut] = []


class StatusUpdate(Schema):
    status: DonationStatus
    #: Only meaningful on ACCEPTED — which recipient is taking it.
    recipient_id: int | None = None
    note: str | None = None


# ─── Requirements ────────────────────────────────────────────────────────────

class RequirementCreate(Schema):
    food_type: str = Field(min_length=1, max_length=160)
    quantity_needed: int = Field(gt=0)
    unit: str = "Meals"
    beneficiary_count: int = 0
    urgency: str = "Medium"
    daily_recurring: bool = False
    notes: str = ""


class RequirementUpdate(Schema):
    """An organisation revising, retiring or reopening one of its own needs.

    Every field is optional and the constraints are exactly
    `RequirementCreate`'s, so a quantity that could not be posted cannot be
    edited in either.

    `is_active` is the whole lifecycle. Setting it to `false` takes the
    requirement off the board — whether because the need was met or because it
    no longer applies — and keeps the row, so a kitchen tidying up does not
    destroy the demand history. The model has no separate fulfilled state and
    this does not invent one; see `DECISIONS.md` D-29.
    """

    food_type: str | None = Field(default=None, min_length=1, max_length=160)
    quantity_needed: int | None = Field(default=None, gt=0)
    unit: str | None = None
    beneficiary_count: int | None = None
    urgency: str | None = None
    daily_recurring: bool | None = None
    notes: str | None = None
    is_active: bool | None = None


class RequirementOut(RequirementCreate):
    id: int
    recipient_id: int
    recipient_name: str
    #: The posting organisation's `Recipient.is_verified`, denormalised onto
    #: the need so the donor board can show whose need it is looking at. It is
    #: not a column on `requirements` and not settable through this API — an
    #: organisation is vouched for by an administrator (D-37) or not at all.
    is_verified: bool
    is_active: bool
    created_at: datetime


# ─── Metrics ─────────────────────────────────────────────────────────────────

class MetricsOut(Schema):
    """The figures the proposal commits to reporting."""

    total_donations: int
    total_meals: int
    completed_donations: int
    active_donations: int
    expired_donations: int
    total_organizations: int
    total_volunteers: int

    #: Primary metric — median minutes from posting to a recipient accepting.
    median_time_to_claim_minutes: float | None = None
    #: Share of donations that completed before their deadline.
    rescue_rate_percent: float | None = None
    expiry_loss_rate_percent: float | None = None
    median_handover_minutes: float | None = None
