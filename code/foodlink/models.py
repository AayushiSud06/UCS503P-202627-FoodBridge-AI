"""Database tables.

These mirror the interfaces in `frontend/src/types/index.ts` so the two halves
of the project describe the same domain. Two deliberate differences:

* Coordinates are stored instead of a pre-computed `distanceKm`. Distance is a
  relationship between two places, not a property of a donation, and the
  matcher needs it against many recipients.
* Status history lives in its own table rather than as a column per timestamp.
  The evaluation metrics in the proposal (time-to-claim, rescue rate) are
  derived from these rows, so they must be append-only and server-stamped.
"""

from __future__ import annotations

import enum
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, Text, TypeDecorator, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UtcDateTime(TypeDecorator):
    """A datetime that is always timezone-aware UTC in Python.

    SQLite has no timezone type: `DateTime(timezone=True)` stores the naive
    wall-clock and hands it back with no offset, which is silently wrong twice
    over. The API then serialises `2026-09-01T08:05:44` with no zone, and a
    browser reads it as *local* time — a deadline four hours out appears
    ninety minutes past in IST.

    So: normalise to UTC on the way in, and reattach UTC on the way out.
    Postgres already does this, and passes through unchanged.
    """

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            # A naive value from a client is taken as UTC rather than guessed at.
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    def process_result_value(self, value: datetime | None, dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)


class UserRole(str, enum.Enum):
    donor = "donor"
    ngo = "ngo"
    volunteer = "volunteer"
    admin = "admin"


#: Roles a stranger may claim for themselves at `/api/auth/register`.
#: `admin` is deliberately absent. An administrator can verify organisations,
#: override any lifecycle transition and read every record, so that role has to
#: be granted by someone who already holds it — or by whoever controls the
#: server, via `python -m foodlink.cli create-admin`. Leaving it in the public
#: enum would make "become an admin" a single unauthenticated POST.
SELF_SIGNUP_ROLES: frozenset[UserRole] = frozenset(
    {UserRole.donor, UserRole.ngo, UserRole.volunteer}
)


class DonationStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    MATCHED = "MATCHED"
    ACCEPTED = "ACCEPTED"
    VOLUNTEER_ASSIGNED = "VOLUNTEER_ASSIGNED"
    PICKED_UP = "PICKED_UP"
    DELIVERED = "DELIVERED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"


#: Transitions the API will accept. Anything not listed is rejected with 409,
#: so the lifecycle cannot be driven into a nonsense state by a buggy client.
ALLOWED_TRANSITIONS: dict[DonationStatus, set[DonationStatus]] = {
    DonationStatus.AVAILABLE: {DonationStatus.MATCHED, DonationStatus.ACCEPTED,
                               DonationStatus.CANCELLED, DonationStatus.EXPIRED},
    DonationStatus.MATCHED: {DonationStatus.ACCEPTED, DonationStatus.AVAILABLE,
                             DonationStatus.CANCELLED, DonationStatus.EXPIRED},
    DonationStatus.ACCEPTED: {DonationStatus.VOLUNTEER_ASSIGNED, DonationStatus.CANCELLED,
                              DonationStatus.EXPIRED},
    DonationStatus.VOLUNTEER_ASSIGNED: {DonationStatus.PICKED_UP, DonationStatus.ACCEPTED,
                                        DonationStatus.CANCELLED},
    DonationStatus.PICKED_UP: {DonationStatus.DELIVERED, DonationStatus.CANCELLED},
    DonationStatus.DELIVERED: {DonationStatus.COMPLETED},
    DonationStatus.COMPLETED: set(),
    DonationStatus.CANCELLED: set(),
    DonationStatus.EXPIRED: set(),
}

TERMINAL_STATUSES = {DonationStatus.COMPLETED, DonationStatus.CANCELLED, DonationStatus.EXPIRED}


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), index=True)
    organization: Mapped[str | None] = mapped_column(String(160), default=None)
    phone: Mapped[str | None] = mapped_column(String(32), default=None)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, server_default=func.now())

    recipient: Mapped[Recipient | None] = relationship(back_populates="user", uselist=False)
    volunteer: Mapped[Volunteer | None] = relationship(back_populates="user", uselist=False)

    @property
    def initials(self) -> str:
        parts = [p for p in self.name.split() if p]
        return "".join(p[0] for p in parts[:2]).upper() or "?"

    @property
    def recipient_id(self) -> int | None:
        """The organisation this account acts for, if it is an NGO account."""
        return self.recipient.id if self.recipient else None

    @property
    def volunteer_id(self) -> int | None:
        """The courier profile this account owns, if it is a volunteer."""
        return self.volunteer.id if self.volunteer else None


class Recipient(Base):
    """A kitchen / shelter / NGO that can receive food."""

    __tablename__ = "recipients"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), default=None)
    name: Mapped[str] = mapped_column(String(160), index=True)
    type: Mapped[str] = mapped_column(String(80), default="Community Kitchen")
    location: Mapped[str] = mapped_column(String(255), default="")
    # Nullable because an NGO signs up before it has pinned its address. A
    # recipient without coordinates simply cannot be matched yet (see
    # `matching.score_pair`), which is the correct behaviour rather than an
    # error — it keeps registration one short step instead of a survey.
    latitude: Mapped[float | None] = mapped_column(Float, default=None)
    longitude: Mapped[float | None] = mapped_column(Float, default=None)
    capacity: Mapped[int] = mapped_column(Integer, default=100)
    contact_person: Mapped[str | None] = mapped_column(String(120), default=None)
    phone: Mapped[str | None] = mapped_column(String(32), default=None)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)

    # Maintained by the app as donations complete; feeds the reliability term
    # of the match score.
    accepted_donations: Mapped[int] = mapped_column(Integer, default=0)
    completed_donations: Mapped[int] = mapped_column(Integer, default=0)

    user: Mapped[User | None] = relationship(back_populates="recipient")
    donations: Mapped[list[Donation]] = relationship(back_populates="recipient")
    requirements: Mapped[list[Requirement]] = relationship(
        back_populates="recipient", cascade="all, delete-orphan"
    )

    @property
    def reliability_score(self) -> int:
        """Share of accepted donations actually seen through to completion.

        New organisations start optimistic (85) rather than at zero, so a
        kitchen with no history is not permanently outranked by one with a
        single lucky completion.
        """
        if self.accepted_donations < 3:
            return 85
        return round(100 * self.completed_donations / self.accepted_donations)


class Volunteer(Base):
    __tablename__ = "volunteers"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    location: Mapped[str] = mapped_column(String(255), default="")
    latitude: Mapped[float | None] = mapped_column(Float, default=None)
    longitude: Mapped[float | None] = mapped_column(Float, default=None)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    completed_deliveries: Mapped[int] = mapped_column(Integer, default=0)
    rating: Mapped[float] = mapped_column(Float, default=5.0)

    user: Mapped[User] = relationship(back_populates="volunteer")
    donations: Mapped[list[Donation]] = relationship(back_populates="volunteer")


class Donation(Base):
    __tablename__ = "donations"

    id: Mapped[int] = mapped_column(primary_key=True)
    donor_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)

    food_name: Mapped[str] = mapped_column(String(160))
    category: Mapped[str] = mapped_column(String(60))
    quantity: Mapped[int] = mapped_column(Integer)
    unit: Mapped[str] = mapped_column(String(24), default="Meals")
    storage_type: Mapped[str] = mapped_column(String(40), default="Room Temperature")
    description: Mapped[str] = mapped_column(Text, default="")
    image_url: Mapped[str | None] = mapped_column(Text, default=None)

    location: Mapped[str] = mapped_column(String(255))
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)

    prepared_at: Mapped[datetime | None] = mapped_column(UtcDateTime, default=None)
    # The deadline is an absolute instant, not a "8:00 PM" display string. The
    # frontend's overdue/urgency logic depends on comparing against real time.
    pickup_deadline: Mapped[datetime] = mapped_column(UtcDateTime, index=True)

    status: Mapped[DonationStatus] = mapped_column(
        Enum(DonationStatus), default=DonationStatus.AVAILABLE, index=True
    )
    recipient_id: Mapped[int | None] = mapped_column(ForeignKey("recipients.id"), default=None, index=True)
    volunteer_id: Mapped[int | None] = mapped_column(ForeignKey("volunteers.id"), default=None, index=True)

    # Score recorded at the moment a recipient was matched, so the number shown
    # later is the one the decision was actually made on.
    match_score: Mapped[int | None] = mapped_column(Integer, default=None)

    created_at: Mapped[datetime] = mapped_column(
        UtcDateTime, server_default=func.now(), index=True
    )

    donor: Mapped[User] = relationship(foreign_keys=[donor_id])
    recipient: Mapped[Recipient | None] = relationship(back_populates="donations")
    volunteer: Mapped[Volunteer | None] = relationship(back_populates="donations")
    events: Mapped[list[StatusEvent]] = relationship(
        back_populates="donation",
        cascade="all, delete-orphan",
        order_by="StatusEvent.occurred_at",
    )

    def timestamp_of(self, status: DonationStatus) -> datetime | None:
        """When this donation first entered `status`, or None."""
        for event in self.events:
            if event.to_status == status:
                return event.occurred_at
        return None


class StatusEvent(Base):
    """Append-only lifecycle history — the source for every timing metric."""

    __tablename__ = "status_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    donation_id: Mapped[int] = mapped_column(ForeignKey("donations.id"), index=True)
    from_status: Mapped[DonationStatus | None] = mapped_column(Enum(DonationStatus), default=None)
    to_status: Mapped[DonationStatus] = mapped_column(Enum(DonationStatus), index=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), default=None)
    note: Mapped[str | None] = mapped_column(Text, default=None)
    # Stamped by the server, never accepted from the client.
    occurred_at: Mapped[datetime] = mapped_column(
        UtcDateTime, default=utcnow, index=True
    )

    donation: Mapped[Donation] = relationship(back_populates="events")
    actor: Mapped[User | None] = relationship()


class Requirement(Base):
    """A standing need posted by a recipient, so demand is visible up front."""

    __tablename__ = "requirements"

    id: Mapped[int] = mapped_column(primary_key=True)
    recipient_id: Mapped[int] = mapped_column(ForeignKey("recipients.id"), index=True)
    food_type: Mapped[str] = mapped_column(String(160))
    quantity_needed: Mapped[int] = mapped_column(Integer)
    unit: Mapped[str] = mapped_column(String(24), default="Meals")
    beneficiary_count: Mapped[int] = mapped_column(Integer, default=0)
    urgency: Mapped[str] = mapped_column(String(16), default="Medium")
    daily_recurring: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str] = mapped_column(Text, default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, server_default=func.now())

    recipient: Mapped[Recipient] = relationship(back_populates="requirements")
