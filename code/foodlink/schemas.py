"""Request and response bodies.

Field names are camelCase on the wire to match the existing TypeScript types,
while staying snake_case in Python. `alias_generator` does the translation so
neither side has to compromise.
"""

from __future__ import annotations

import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from pydantic.alias_generators import to_camel
from sqlalchemy import inspect

from .models import SELF_SIGNUP_ROLES, DonationStatus, UserRole


class Schema(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


def patch_changes(body: Schema, row: object) -> dict[str, object]:
    """What a PATCH body changes on `row`, as `{attribute: value}` to apply.

    A field has three states, not two. Left out of the body, it is not a change.
    Sent with a value, it is. Sent as `null`, it clears the column only where
    the column can hold null — a pin, a contact person, a phone number. Where it
    cannot, `null` leaves the stored value alone, the rule D-29 set for
    requirements; written through, it would reach the database as a NOT NULL
    violation and come back as a 500.

    Read from the mapped column rather than listed per schema, so the answer
    cannot drift from what the database will actually accept.
    """
    columns = inspect(row).mapper.columns
    return {
        field: value
        for field, value in body.model_dump(exclude_unset=True).items()
        if value is not None or columns[field].nullable
    }


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

#: Ceiling on the free text a donor or a kitchen writes into an unbounded `Text`
#: column: a donation's description, a status note, a requirement's notes.
#:
#: Each is stored in the row and returned inline by the lists that re-download
#: after every write, so without a bound one account's payload was priced into
#: everyone else's next request (the audit stored a 2 MB description). 2,000
#: characters is the ceiling the Project Manager set for Task 44 (D-60). It is
#: far above a note about dishes, allergens or gate access, and a thousandth of
#: that description. Text stored in a `String(n)` column is bounded at `n`
#: instead, on the field itself.
MAX_FREE_TEXT_LENGTH = 2_000

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

#: The two shapes `image_url` is allowed to take, since it is rendered straight
#: into an `<img src>` by every donation surface: a base64 `data:` URL of some
#: image type — what the browser produces after resizing (D-56) — or an ordinary
#: web link. Anything else is neither an image nor something a client can
#: display, so it is refused at the boundary rather than stored and served back.
#: Deliberately shallow: this rejects the obviously-not-an-image, and the real
#: check that the bytes decode happens in the browser that holds them.
IMAGE_URL_PATTERN = re.compile(
    r"^(?:data:image/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+|https?://\S+)$",
    re.IGNORECASE,
)


class DonationCreate(Schema):
    # String bounds are the `Donation` column sizes, so nothing is accepted
    # that the database could not hold (Postgres would refuse it with a 500).
    food_name: str = Field(min_length=1, max_length=160)
    category: str = Field(max_length=60)
    quantity: int = Field(gt=0)
    unit: str = Field(default="Meals", max_length=24)
    storage_type: str = Field(default="Room Temperature", max_length=40)
    description: str = Field(default="", max_length=MAX_FREE_TEXT_LENGTH)
    location: str = Field(max_length=255)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    prepared_at: datetime | None = None
    pickup_deadline: datetime
    image_url: str | None = Field(default=None, max_length=MAX_IMAGE_URL_LENGTH)

    @field_validator("image_url")
    @classmethod
    def _reject_what_is_not_an_image(cls, value: str | None) -> str | None:
        """A photo or a link to one, and nothing else.

        The length cap above is untouched and remains the bound that matters for
        storage; this is the companion check on *shape*, so a value that could
        never render as an image is not stored and served back to every reader.
        """
        if value is None or IMAGE_URL_PATTERN.match(value):
            return value
        raise ValueError(
            "imageUrl must be an image data URL or an http(s) link to an image"
        )


class StatusEventOut(Schema):
    to_status: DonationStatus
    from_status: DonationStatus | None = None
    occurred_at: datetime
    note: str | None = None


class DonationOut(Schema):
    id: int
    #: Who posted this, and where it is. **Null for a courier who has not
    #: claimed this pickup** — `volunteer` is a self-signup role whose read
    #: scope covers the whole unclaimed `ACCEPTED` pool, and these five fields
    #: are a donor's doorstep and name. They are withheld rather than
    #: coarsened, exactly as `match_score` and `distance_km` are below, and
    #: `pickup_area` carries the coarse stand-in instead. Every other reader —
    #: the donor, the organisation that accepted, an administrator, and the
    #: courier once the claim is in the row — reads them unchanged. See
    #: `serialize._may_collect`, `donations._precise_pickup_scope`, D-57.
    donor_id: int | None = None
    donor_name: str | None = None
    donor_organization: str | None = None
    food_name: str
    category: str
    quantity: int
    unit: str
    storage_type: str
    description: str
    image_url: str | None = None
    location: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    #: Where the pickup roughly is, for a reader withheld the pin above: the
    #: donor's coordinates snapped to the 0.01° grid D-45 already uses and
    #: printed as text. Null whenever the exact pin *is* disclosed — the two are
    #: alternatives, never both, so no reader has to decide which to believe
    #: and no screen can show a coarse cell beside the address it stands in for.
    pickup_area: str | None = None
    prepared_at: datetime | None = None
    pickup_deadline: datetime
    status: DonationStatus
    recipient_id: int | None = None
    recipient_name: str | None = None
    volunteer_id: int | None = None
    volunteer_name: str | None = None
    #: Frozen, and about a *decision*: the top-ranked organisation's score when
    #: the donor posted, replaced by the accepting organisation's own score when
    #: one takes it. Stored precisely and unchanged (D-30).
    #:
    #: **Null for a reader who may not be told the subject's true position.**
    #: The weighted sum moves ~1 point per 320 m, so the exact figure is a
    #: distance oracle about a kitchen the reader may not locate — the same
    #: reading `MatchOut.distanceKm` closed, one endpoint over. Present for an
    #: administrator, and for the organisation the frozen score is about once
    #: one is bound; withheld — never rounded, never re-scored — otherwise. See
    #: `serialize.donation_out` and `DECISIONS.md` D-47.
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
    #: Donor pin to the *bound* kitchen, straight-line, computed rather than
    #: stored. Null until a recipient is bound — and null after that too for a
    #: reader outside `donations._precise_distance_scope`, because an exact
    #: distance to a named organisation is the whole of the trilateration D-45
    #: closed on `/matches` (D-47). A donor and a courier therefore read null
    #: here; the accepting organisation and an administrator read the figure.
    distance_km: float | None = None
    created_at: datetime
    events: list[StatusEventOut] = []


class StatusUpdate(Schema):
    status: DonationStatus
    #: Only meaningful on ACCEPTED — which recipient is taking it.
    recipient_id: int | None = None
    note: str | None = Field(default=None, max_length=MAX_FREE_TEXT_LENGTH)


# ─── Requirements ────────────────────────────────────────────────────────────

class RequirementCreate(Schema):
    # String bounds are the `Requirement` column sizes, as on `DonationCreate`.
    food_type: str = Field(min_length=1, max_length=160)
    quantity_needed: int = Field(gt=0)
    unit: str = Field(default="Meals", max_length=24)
    beneficiary_count: int = Field(default=0, ge=0)
    urgency: str = Field(default="Medium", max_length=16)
    daily_recurring: bool = False
    notes: str = Field(default="", max_length=MAX_FREE_TEXT_LENGTH)


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
    unit: str | None = Field(default=None, max_length=24)
    beneficiary_count: int | None = Field(default=None, ge=0)
    urgency: str | None = Field(default=None, max_length=16)
    daily_recurring: bool | None = None
    notes: str | None = Field(default=None, max_length=MAX_FREE_TEXT_LENGTH)
    is_active: bool | None = None


class RequirementOut(RequirementCreate):
    #: Redeclared without `RequirementCreate`'s bounds, which govern what may be
    #: submitted and not what is served back: a row stored before they existed
    #: (a negative count, or an over-long unit SQLite did not refuse) must still
    #: read, or it would turn every board that lists it into a 500.
    unit: str = "Meals"
    beneficiary_count: int = 0
    urgency: str = "Medium"
    notes: str = ""

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
