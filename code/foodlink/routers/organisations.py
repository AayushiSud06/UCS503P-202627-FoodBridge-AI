"""Recipient organisations, their standing requirements, and couriers."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import false, select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Recipient, Requirement, User, UserRole, Volunteer
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


@router.get("/requirements", response_model=list[RequirementOut])
def list_requirements(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[RequirementOut]:
    stmt = (
        select(Requirement)
        .options(selectinload(Requirement.recipient))
        .where(Requirement.is_active.is_(True))
        .order_by(Requirement.created_at.desc())
    )
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
    anything else changing — and `isActive: true` puts it back.
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


@router.get("/volunteers", response_model=list[VolunteerOut])
def list_volunteers(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(UserRole.admin, UserRole.ngo)),
) -> list[VolunteerOut]:
    """The courier roster. Restricted: it is a list of people's phone numbers."""
    stmt = select(Volunteer).options(selectinload(Volunteer.user))
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
