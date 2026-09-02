"""The donation lifecycle — the core of the platform."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, false, or_, select, update
from sqlalchemy.orm import Session, selectinload

from ..config import get_settings
from ..database import get_db
from ..matching import rank_recipients
from ..models import (
    ALLOWED_TRANSITIONS, Donation, DonationStatus, Recipient, StatusEvent, User,
    UserRole, Volunteer,
)
from ..schemas import DonationCreate, DonationOut, MatchOut, StatusUpdate
from ..security import get_current_user, require_roles
from ..serialize import donation_out

router = APIRouter(prefix="/api/donations", tags=["donations"])
settings = get_settings()

#: Who is allowed to drive each transition. The donor who owns a donation and
#: an admin may always cancel; everything else is role-gated.
TRANSITION_ROLES: dict[DonationStatus, set[UserRole]] = {
    DonationStatus.MATCHED: {UserRole.admin},
    DonationStatus.ACCEPTED: {UserRole.ngo, UserRole.admin},
    DonationStatus.VOLUNTEER_ASSIGNED: {UserRole.volunteer, UserRole.admin},
    DonationStatus.PICKED_UP: {UserRole.volunteer, UserRole.admin},
    DonationStatus.DELIVERED: {UserRole.volunteer, UserRole.admin},
    DonationStatus.COMPLETED: {UserRole.ngo, UserRole.admin},
    DonationStatus.CANCELLED: {UserRole.donor, UserRole.admin},
    DonationStatus.EXPIRED: {UserRole.admin},
}

#: The states in which a donation is still up for grabs — no organisation is
#: bound to it, so every organisation may see it. This is the pool an NGO
#: browses; `MATCHED` is in it because a match is a suggestion, not a claim.
OPEN_TO_RECIPIENTS: set[DonationStatus] = {DonationStatus.AVAILABLE, DonationStatus.MATCHED}


def _loaded(db: Session):
    return select(Donation).options(
        selectinload(Donation.donor),
        selectinload(Donation.recipient),
        selectinload(Donation.volunteer).selectinload(Volunteer.user),
        selectinload(Donation.events),
    )


def _get_or_404(db: Session, donation_id: int) -> Donation:
    """Any donation by id, with no read scoping.

    For paths that have already authorised the caller some other way — the
    lifecycle endpoint, which is gated by `TRANSITION_ROLES` and by ownership,
    and the response of a write. Read endpoints must use
    `_get_readable_or_404` instead.
    """
    donation = db.scalar(_loaded(db).where(Donation.id == donation_id))
    if donation is None:
        raise HTTPException(status_code=404, detail="Donation not found")
    return donation


def _readable_by(db: Session, user: User):
    """The donations `user` may read, as a WHERE clause — or None for all of them.

    Read scope follows the work each role actually does, so it is the same
    clause for the list and for a lookup by id:

    * donor — the donations they posted, and nothing else.
    * ngo — the open pool every organisation is invited to consider, plus the
      donations bound to their own organisation once they accept one.
    * volunteer — pickups that are waiting for a courier, plus every donation
      they are the courier for, whatever state it has reached (their history).
    * admin — unrestricted.

    A recipient/courier profile that does not exist yet narrows the clause
    rather than widening it: such an account still sees the open pool, but has
    nothing of its own to add.
    """
    if user.role is UserRole.admin:
        return None

    if user.role is UserRole.donor:
        return Donation.donor_id == user.id

    if user.role is UserRole.ngo:
        clause = Donation.status.in_(OPEN_TO_RECIPIENTS)
        recipient = db.scalar(select(Recipient).where(Recipient.user_id == user.id))
        if recipient is not None:
            clause = or_(clause, Donation.recipient_id == recipient.id)
        return clause

    if user.role is UserRole.volunteer:
        clause = and_(
            Donation.status == DonationStatus.ACCEPTED, Donation.volunteer_id.is_(None)
        )
        volunteer = db.scalar(select(Volunteer).where(Volunteer.user_id == user.id))
        if volunteer is not None:
            clause = or_(clause, Donation.volunteer_id == volunteer.id)
        return clause

    # Fail closed: a role added later reads nothing at all until it is given a
    # scope here, rather than silently inheriting everyone else's records.
    return false()


def _get_readable_or_404(db: Session, donation_id: int, user: User) -> Donation:
    """A donation the caller is allowed to read, or a 404.

    The scope is applied in the query, so an unauthorised id is indistinguish-
    able from one that does not exist. That is deliberate: a 403 here would
    confirm the donation is real, which is part of what the scoping withholds.
    """
    stmt = _loaded(db).where(Donation.id == donation_id)
    scope = _readable_by(db, user)
    if scope is not None:
        stmt = stmt.where(scope)

    donation = db.scalar(stmt)
    if donation is None:
        raise HTTPException(status_code=404, detail="Donation not found")
    return donation


def _claim_pickup(
    db: Session, donation_id: int, from_status: DonationStatus, volunteer_id: int
) -> bool:
    """Bind a courier to a pickup, only if it is still claimable. Did it work?

    The claim is one conditional UPDATE rather than a Python check followed by
    an assignment, because the check and the write have to be the same
    operation. Two couriers can both read `volunteer_id IS NULL` and both
    decide they may have it; only one of them can satisfy that condition *as
    the database applies the write*, which is where this puts it.

    Both halves of "still claimable" are in the WHERE clause:

    * `status == from_status` — the state the caller's transition was
      authorised against is still the state the row is in. This is also what
      stops the same courier's duplicate request from claiming twice and
      appending a second event.
    * `volunteer_id IS NULL OR volunteer_id == the caller` — unclaimed, or
      already theirs, which is the readmission the previous code allowed and
      that a released pickup depends on.

    Winning also takes the row's write lock until this transaction commits, so
    the status write that follows cannot be interleaved with another claim.
    `synchronize_session=False` because the session's copy of the row is
    deliberately not updated here — see the caller, which expires it.
    """
    result = db.execute(
        update(Donation)
        .where(
            Donation.id == donation_id,
            Donation.status == from_status,
            or_(Donation.volunteer_id.is_(None), Donation.volunteer_id == volunteer_id),
        )
        .values(volunteer_id=volunteer_id)
        .execution_options(synchronize_session=False)
    )
    return result.rowcount == 1


def _record(db: Session, donation: Donation, to: DonationStatus, actor: User, note: str | None = None) -> None:
    """Append a status event. This is what every timing metric is read from."""
    db.add(
        StatusEvent(
            donation_id=donation.id,
            from_status=donation.status,
            to_status=to,
            actor_id=actor.id,
            note=note,
        )
    )
    donation.status = to


@router.post("", response_model=DonationOut, status_code=status.HTTP_201_CREATED)
def create_donation(
    body: DonationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.donor, UserRole.admin)),
) -> DonationOut:
    deadline = body.pickup_deadline
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
    if deadline <= datetime.now(timezone.utc):
        raise HTTPException(status_code=422, detail="Pickup deadline is already in the past")

    donation = Donation(
        donor_id=user.id,
        food_name=body.food_name,
        category=body.category,
        quantity=body.quantity,
        unit=body.unit,
        storage_type=body.storage_type,
        description=body.description,
        image_url=body.image_url,
        location=body.location,
        latitude=body.latitude,
        longitude=body.longitude,
        prepared_at=body.prepared_at,
        pickup_deadline=deadline,
        status=DonationStatus.AVAILABLE,
    )
    db.add(donation)
    db.flush()

    db.add(StatusEvent(donation_id=donation.id, to_status=DonationStatus.AVAILABLE, actor_id=user.id))

    # Rank immediately so the donation carries a suggestion the moment it is
    # posted. Nothing is assigned — a recipient still has to accept.
    recipients = list(db.scalars(select(Recipient)))
    ranked = rank_recipients(donation, recipients, radius_km=settings.max_match_radius_km, limit=1)
    if ranked:
        donation.match_score = ranked[0].overall_score
        _record(db, donation, DonationStatus.MATCHED, user, note=f"Top match: {ranked[0].recipient_name}")

    db.commit()
    return donation_out(_get_or_404(db, donation.id))


@router.get("", response_model=list[DonationOut])
def list_donations(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    status_filter: list[DonationStatus] | None = Query(default=None, alias="status"),
    mine: bool = Query(default=False, description="Restrict to the caller's own records"),
    limit: int = Query(default=100, le=500),
) -> list[DonationOut]:
    stmt = _loaded(db).order_by(Donation.pickup_deadline)

    # Scope first, and unconditionally: `mine` is a convenience filter the
    # caller chooses, not the authorisation boundary. Leaving it out must
    # narrow nothing away from what the caller is entitled to see.
    scope = _readable_by(db, user)
    if scope is not None:
        stmt = stmt.where(scope)

    if status_filter:
        stmt = stmt.where(Donation.status.in_(status_filter))

    if mine:
        if user.role is UserRole.donor:
            stmt = stmt.where(Donation.donor_id == user.id)
        elif user.role is UserRole.ngo:
            recipient = db.scalar(select(Recipient).where(Recipient.user_id == user.id))
            stmt = stmt.where(Donation.recipient_id == (recipient.id if recipient else -1))
        elif user.role is UserRole.volunteer:
            volunteer = db.scalar(select(Volunteer).where(Volunteer.user_id == user.id))
            stmt = stmt.where(Donation.volunteer_id == (volunteer.id if volunteer else -1))

    return [donation_out(d) for d in db.scalars(stmt.limit(limit))]


@router.get("/{donation_id}", response_model=DonationOut)
def get_donation(
    donation_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DonationOut:
    return donation_out(_get_readable_or_404(db, donation_id, user))


@router.get("/{donation_id}/matches", response_model=list[MatchOut])
def get_matches(
    donation_id: int,
    limit: int = Query(default=5, le=25),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[MatchOut]:
    """Ranked recipients for this donation, with the reasoning for each."""
    # Same read scope as the donation itself: the reasoning describes a
    # donation, so seeing it is seeing the donation.
    donation = _get_readable_or_404(db, donation_id, user)
    recipients = list(db.scalars(select(Recipient)))
    ranked = rank_recipients(
        donation, recipients, radius_km=settings.max_match_radius_km, limit=limit
    )
    return [MatchOut(**r.__dict__) for r in ranked]


@router.post("/{donation_id}/status", response_model=DonationOut)
def update_status(
    donation_id: int,
    body: StatusUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DonationOut:
    donation = _get_or_404(db, donation_id)
    target = body.status

    if target not in ALLOWED_TRANSITIONS[donation.status]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot move a donation from {donation.status.value} to {target.value}",
        )

    allowed_roles = TRANSITION_ROLES.get(target, set())
    is_owning_donor = user.role is UserRole.donor and donation.donor_id == user.id
    if user.role not in allowed_roles and not (target is DonationStatus.CANCELLED and is_owning_donor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Your role cannot set a donation to {target.value}",
        )

    # ── Side effects that must happen with the transition ────────────────────
    if target is DonationStatus.ACCEPTED:
        # An NGO always accepts as itself. Only an administrator may name an
        # arbitrary organisation: accepting on another kitchen's behalf is a
        # stand-in action for support staff, not something a peer may do to a
        # competitor for the same donation.
        if user.role is UserRole.admin:
            recipient = (
                db.get(Recipient, body.recipient_id) if body.recipient_id is not None else None
            )
        else:
            recipient = db.scalar(select(Recipient).where(Recipient.user_id == user.id))
            if recipient is not None and body.recipient_id not in (None, recipient.id):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only accept a donation on behalf of your own organisation",
                )
        if recipient is None:
            raise HTTPException(status_code=422, detail="No recipient organisation resolved for this acceptance")
        if not recipient.is_verified:
            # Verification is the platform's only check that a real
            # organisation stands behind an account before food is handed to
            # it. Letting an unverified account take custody would make the
            # check decorative.
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "This organisation is awaiting verification and cannot accept "
                    "donations yet"
                ),
            )

        donation.recipient_id = recipient.id
        recipient.accepted_donations += 1

        # Freeze the score this decision was actually made on.
        ranked = rank_recipients(
            donation, [recipient], radius_km=settings.max_match_radius_km, limit=1
        )
        if ranked:
            donation.match_score = ranked[0].overall_score

    elif target is DonationStatus.VOLUNTEER_ASSIGNED:
        volunteer = db.scalar(select(Volunteer).where(Volunteer.user_id == user.id))
        if volunteer is None:
            raise HTTPException(status_code=422, detail="No courier profile for this account")

        if not _claim_pickup(db, donation.id, donation.status, volunteer.id):
            # Somebody else got there between this request's read and its
            # write. Answer with whatever a request arriving a moment later
            # would have been told, read from the row as it now stands rather
            # than from the copy this request started with.
            db.expire(donation)
            if donation.volunteer_id not in (None, volunteer.id):
                raise HTTPException(
                    status_code=409, detail="Another courier has already claimed this pickup"
                )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot move a donation from {donation.status.value} to {target.value}",
            )

        # The row now holds the assignment; this session's copy does not, and
        # the status write below must not carry a stale value back over it.
        db.expire(donation, ["volunteer_id", "volunteer"])

    elif target is DonationStatus.COMPLETED:
        if donation.recipient is not None:
            donation.recipient.completed_donations += 1
        if donation.volunteer is not None:
            donation.volunteer.completed_deliveries += 1

    _record(db, donation, target, user, note=body.note)
    db.commit()
    return donation_out(_get_or_404(db, donation_id))
