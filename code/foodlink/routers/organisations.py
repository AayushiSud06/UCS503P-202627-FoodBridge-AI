"""Recipient organisations, their standing requirements, and couriers."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import false, select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Donation, Recipient, Requirement, User, UserRole, Volunteer
from ..schemas import (
    RecipientOut, RecipientUpdate, RequirementCreate, RequirementOut, RequirementUpdate,
    VolunteerOut, VolunteerUpdate,
)
from ..security import get_current_user, require_roles

router = APIRouter(prefix="/api", tags=["organisations"])


def _visible_recipients(user: User):
    """The organisations `user` may read, as a WHERE clause — or None for all.

    `RecipientOut` carries a named contact and a phone number, so this list is
    a directory of people as much as of places. Its scope therefore follows the
    same rule as `donations._readable_by`: what each role's own work needs, and
    nothing past it.

    * admin — unrestricted; vouching for organisations is the job.
    * ngo — their own organisation only. Two kitchens have no workflow with
      each other, and the portal resolves its own profile out of this list.
    * donor / volunteer — nothing. Neither acts on an organisation record, and
      the organisation bound to a donation already reaches them as
      `recipientName` on the donation itself, without a contact or a phone.

    Fail closed: a role added later reads nothing until it is given a scope
    here, rather than silently inheriting everyone else's records.
    """
    if user.role is UserRole.admin:
        return None

    if user.role is UserRole.ngo:
        return Recipient.user_id == user.id

    return false()


@router.get("/recipients", response_model=list[RecipientOut])
def list_recipients(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[RecipientOut]:
    """Recipient organisations, scoped to the caller.

    The scope is applied in the query, so the database never hands back a row
    the caller may not see and there is no unfiltered list to leak later.
    """
    stmt = select(Recipient)
    scope = _visible_recipients(user)
    if scope is not None:
        stmt = stmt.where(scope)
    return [RecipientOut.model_validate(r) for r in db.scalars(stmt)]


def _own_recipient(db: Session, user: User) -> Recipient:
    """The organisation this account acts for, or a 422 explaining that it has none."""
    recipient = db.scalar(select(Recipient).where(Recipient.user_id == user.id))
    if recipient is None:
        raise HTTPException(
            status_code=422,
            detail="This account is not linked to a recipient organisation",
        )
    return recipient


@router.get("/recipients/me", response_model=RecipientOut)
def my_recipient(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ngo)),
) -> RecipientOut:
    return RecipientOut.model_validate(_own_recipient(db, user))


@router.patch("/recipients/me", response_model=RecipientOut)
def update_my_recipient(
    body: RecipientUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ngo)),
) -> RecipientOut:
    """Complete or correct your own organisation profile.

    Registration only asks for a name, so this is where an organisation
    supplies the address and coordinates that make it matchable at all.
    `is_verified` is not settable here on purpose — an organisation does not
    get to vouch for itself.
    """
    recipient = _own_recipient(db, user)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(recipient, field, value)
    db.commit()
    db.refresh(recipient)
    return RecipientOut.model_validate(recipient)


def _requirement_out(req: Requirement) -> RequirementOut:
    return RequirementOut(
        id=req.id,
        recipient_id=req.recipient_id,
        recipient_name=req.recipient.name if req.recipient else "",
        # The posting organisation's verification state, not a state of the
        # requirement itself. The donor board reads standing needs from
        # organisations somebody has vouched for, so it has to be able to say
        # so on the card; an unverified organisation cannot be matched or
        # accept a donation either (`matching.score_pair`).
        is_verified=bool(req.recipient.is_verified) if req.recipient else False,
        food_type=req.food_type,
        quantity_needed=req.quantity_needed,
        unit=req.unit,
        beneficiary_count=req.beneficiary_count,
        urgency=req.urgency,
        daily_recurring=req.daily_recurring,
        notes=req.notes,
        is_active=req.is_active,
        created_at=req.created_at,
    )


def _visible_requirements(user: User):
    """The standing needs `user` may read, as a WHERE clause — or None for all.

    The endpoint used to be scoped by omission: `get_current_user` and nothing
    else, so every authenticated caller read every organisation's board. That
    was defensible — `RequirementOut` carries an organisation name and a need,
    never a contact or a phone, unlike the two directories `_visible_recipients`
    and `_visible_volunteers` guard — but it had never been decided. It is
    decided now, and the scope follows the same shape as its neighbours: a
    clause applied in the query rather than a check after it.

    * admin — unrestricted, as everywhere else.
    * donor — every active need posted by a **verified** organisation. This is
      the donor needs board, and it is the whole reason the table has an
      audience: demand is visible before supply. Verification is the same gate
      the matcher applies (`matching.score_pair`), so a donor is never shown a
      need from an organisation that could not receive the donation anyway.
    * ngo — its own organisation's needs only. Two kitchens have no workflow
      with each other, which is exactly the reasoning D-26 applied to
      `GET /recipients`, and the portal already filtered this list client-side.
    * volunteer — nothing. A courier carries an assigned donation; standing
      demand is not an input to that and never reaches a courier screen.

    Fail closed: a role added later reads nothing until it is given a scope
    here, rather than silently inheriting the whole board.
    """
    if user.role is UserRole.admin:
        return None

    if user.role is UserRole.donor:
        # A subquery rather than a join so the outer statement keeps returning
        # one row per requirement no matter how the relationship is loaded.
        verified = select(Recipient.id).where(Recipient.is_verified.is_(True))
        return Requirement.recipient_id.in_(verified)

    if user.role is UserRole.ngo:
        # Resolved through `Recipient` in the query, so an `ngo` account with
        # no organisation row yet simply matches nothing.
        own = select(Recipient.id).where(Recipient.user_id == user.id)
        return Requirement.recipient_id.in_(own)

    return false()


def _may_read_inactive(user: User) -> bool:
    """Whether `includeInactive` means anything for this caller.

    The flag widens the **lifecycle** filter and never the scope. It is applied
    beside `_visible_requirements` rather than instead of it, so a kitchen
    asking for retired rows still reaches only its own organisation's; the
    ownership term is untouched and D-44 still decides *whose* needs a caller
    sees. What this decides is only whether the past is part of the answer.

    * admin — yes. Platform-wide visibility already spans the whole table.
    * ngo — yes, inside its own scope. D-29 kept the row on retirement and left
      it with no reader; the portal is that reader, and reopening needs a list
      to reopen from.
    * donor — **no, whatever the query string says.** The needs board is a
      board of what is open now: a retired need is not an offer, and a donor
      has no action on one. That is why this is a permission rather than a
      filter the caller simply chooses.
    * volunteer — no, and `_visible_requirements` returns nothing anyway.
    """
    return user.role in (UserRole.admin, UserRole.ngo)


@router.get("/requirements", response_model=list[RequirementOut])
def list_requirements(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    include_inactive: bool = Query(
        default=False,
        alias="includeInactive",
        description="Also return retired needs, for callers entitled to read them",
    ),
) -> list[RequirementOut]:
    """Standing needs, scoped to the caller; active only unless asked otherwise.

    Newest first, narrowed by role — see `_visible_requirements` and
    `DECISIONS.md` D-44. Denial here is an empty list rather than a 403,
    following `GET /recipients`: there is no id to confirm or deny, only a board
    that is empty for this caller.

    `includeInactive=true` adds retired rows for a caller `_may_read_inactive`
    allows, and is ignored for everyone else — the two filters are independent,
    so asking for history can never widen whose history it is.
    """
    stmt = (
        select(Requirement)
        .options(selectinload(Requirement.recipient))
        .order_by(Requirement.created_at.desc())
    )
    if not (include_inactive and _may_read_inactive(user)):
        stmt = stmt.where(Requirement.is_active.is_(True))
    scope = _visible_requirements(user)
    if scope is not None:
        stmt = stmt.where(scope)
    return [_requirement_out(r) for r in db.scalars(stmt)]


@router.post("/requirements", response_model=RequirementOut, status_code=status.HTTP_201_CREATED)
def create_requirement(
    body: RequirementCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ngo, UserRole.admin)),
) -> RequirementOut:
    recipient = _own_recipient(db, user)
    requirement = Requirement(recipient_id=recipient.id, **body.model_dump())
    db.add(requirement)
    db.commit()
    db.refresh(requirement)
    return _requirement_out(requirement)


def _own_requirement_or_404(db: Session, recipient: Recipient, requirement_id: int) -> Requirement:
    """One of this organisation's own requirements, or a 404.

    Ownership is a term in the query rather than a check after it, so another
    kitchen's id is indistinguishable from one that was never posted — the rule
    `donations._get_readable_or_404` already follows. Being an `ngo` is not on
    its own permission to touch a requirement; belonging to it is.
    """
    requirement = db.scalar(
        select(Requirement)
        .options(selectinload(Requirement.recipient))
        .where(Requirement.id == requirement_id, Requirement.recipient_id == recipient.id)
    )
    if requirement is None:
        raise HTTPException(status_code=404, detail="Requirement not found")
    return requirement


@router.patch("/requirements/{requirement_id}", response_model=RequirementOut)
def update_requirement(
    requirement_id: int,
    body: RequirementUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.ngo, UserRole.admin)),
) -> RequirementOut:
    """Revise, retire or reopen one of your own standing needs.

    Retiring is `isActive: false`, and that is also what fulfilment means here:
    the model carries one lifecycle flag, and a need that has been met and a
    need that no longer applies are both simply off the board. The row is kept
    either way, so the demand history survives. `GET /api/requirements` already
    filters on the same flag, so a retired requirement leaves the board without
    anything else changing — and `isActive: true` puts it back. The owning
    organisation can list what it has retired through `includeInactive`, so
    reopening is now something the portal can offer rather than an API-only
    operation.
    """
    requirement = _own_requirement_or_404(db, _own_recipient(db, user), requirement_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        # No requirement column is nullable, so an explicit null cannot mean
        # "clear this field" — it can only mean "leave it alone".
        if value is not None:
            setattr(requirement, field, value)
    db.commit()
    db.refresh(requirement)
    return _requirement_out(requirement)


def _volunteer_out(volunteer: Volunteer) -> VolunteerOut:
    return VolunteerOut(
        id=volunteer.id,
        name=volunteer.user.name if volunteer.user else "Unknown",
        phone=volunteer.user.phone if volunteer.user else None,
        location=volunteer.location,
        is_available=volunteer.is_available,
        completed_deliveries=volunteer.completed_deliveries,
        rating=volunteer.rating,
    )


def _visible_volunteers(user: User):
    """The couriers `user` may read, as a WHERE clause — or None for all of them.

    `VolunteerOut` carries a courier's phone number, so this endpoint is a
    directory of people in exactly the sense `_visible_recipients` is, and it
    gets the same treatment: a clause applied in the query rather than a check
    after it.

    The route's role gate is not enough on its own here. `ngo` is a self-signup
    role, so holding it costs one registration, and `is_verified` gates ranking
    and acceptance rather than reads — which left every courier's phone number
    one sign-up away from anybody.

    * admin — unrestricted. Vouching for organisations and staffing the roster
      is the job, and `AdminVolunteers` is the only screen that renders it.
    * ngo — the couriers carrying, or who have already carried, one of this
      organisation's own donations. That is the set a kitchen has a reason to
      contact, and the donation row is the relationship that says so, so no new
      one had to be introduced.
    * anyone else — nothing. Unreachable behind the route's `require_roles`, and
      kept so a role added later reads nothing until it is given a scope here.
    """
    if user.role is UserRole.admin:
        return None

    if user.role is UserRole.ngo:
        # Joined through `Recipient` rather than resolved in a second query, so
        # an `ngo` account with no organisation row yet simply matches nothing
        # instead of needing a separate branch.
        own_couriers = (
            select(Donation.volunteer_id)
            .join(Recipient, Recipient.id == Donation.recipient_id)
            .where(Recipient.user_id == user.id, Donation.volunteer_id.is_not(None))
        )
        return Volunteer.id.in_(own_couriers)

    return false()


@router.get("/volunteers", response_model=list[VolunteerOut])
def list_volunteers(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin, UserRole.ngo)),
) -> list[VolunteerOut]:
    """The courier roster, scoped to the caller.

    Restricted twice over: the route admits only administrators and kitchens,
    and the query then narrows a kitchen to the couriers on its own donations.
    It is a list of people's phone numbers, so the role gate alone was not the
    boundary it looked like — see `_visible_volunteers` and `DECISIONS.md` D-41.
    """
    stmt = select(Volunteer).options(selectinload(Volunteer.user))
    scope = _visible_volunteers(user)
    if scope is not None:
        stmt = stmt.where(scope)
    return [_volunteer_out(v) for v in db.scalars(stmt)]


def _own_volunteer(db: Session, user: User) -> Volunteer:
    volunteer = db.scalar(
        select(Volunteer).options(selectinload(Volunteer.user)).where(Volunteer.user_id == user.id)
    )
    if volunteer is None:
        raise HTTPException(status_code=422, detail="This account has no courier profile")
    return volunteer


@router.get("/volunteers/me", response_model=VolunteerOut)
def my_volunteer(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.volunteer)),
) -> VolunteerOut:
    """A courier's own profile.

    Separate from the roster above because that one is closed to couriers —
    reading your own record is not the same as reading everyone's.
    """
    return _volunteer_out(_own_volunteer(db, user))


@router.patch("/volunteers/me", response_model=VolunteerOut)
def update_my_volunteer(
    body: VolunteerUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.volunteer)),
) -> VolunteerOut:
    """Go on or off duty, or move your base location.

    Delivery count and rating are absent by design: they are earned through
    completed runs, so they are the server's to maintain, not the courier's.
    """
    volunteer = _own_volunteer(db, user)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(volunteer, field, value)
    db.commit()
    db.refresh(volunteer)
    return _volunteer_out(volunteer)
