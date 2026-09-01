"""Administrator-only operations.

Everything an administrator can do that no other role can: create accounts of
any role, suspend accounts, vouch for recipient organisations, and run the
expiry sweep. The whole router sits behind one dependency, so there is a
single place that decides who is allowed in rather than a role test repeated
at the top of every function.

Two rules protect against an administrator locking the platform out of its own
administration, which on a deployment this small is unrecoverable without
shell access:

* You cannot suspend or demote your own account.
* The last remaining active administrator cannot be suspended or demoted.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import (
    Donation, DonationStatus, Recipient, StatusEvent, User, UserRole, Volunteer,
)
from ..schemas import AdminUserCreate, RecipientOut, UserAdminOut, UserUpdate
from ..security import hash_password, require_roles

# One gate for the whole router: reaching any path below requires an
# administrator's own bearer token.
router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
    dependencies=[Depends(require_roles(UserRole.admin))],
)


def _active_admin_count(db: Session, *, excluding: int | None = None) -> int:
    stmt = select(func.count()).select_from(User).where(
        User.role == UserRole.admin, User.is_active.is_(True)
    )
    if excluding is not None:
        stmt = stmt.where(User.id != excluding)
    return db.scalar(stmt) or 0


def _get_user_or_404(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/users", response_model=list[UserAdminOut])
def list_users(
    db: Session = Depends(get_db),
    role: UserRole | None = Query(default=None, description="Restrict to one role"),
    include_inactive: bool = Query(default=True),
) -> list[UserAdminOut]:
    stmt = (
        select(User)
        .options(selectinload(User.recipient), selectinload(User.volunteer))
        .order_by(User.id.desc())
    )
    if role is not None:
        stmt = stmt.where(User.role == role)
    if not include_inactive:
        stmt = stmt.where(User.is_active.is_(True))
    return [UserAdminOut.model_validate(u) for u in db.scalars(stmt)]


@router.post("/users", response_model=UserAdminOut, status_code=status.HTTP_201_CREATED)
def create_user(body: AdminUserCreate, db: Session = Depends(get_db)) -> UserAdminOut:
    """Create an account of any role, including another administrator.

    This is how the second and every subsequent administrator comes into
    existence. The first one cannot come from here, because calling it already
    requires being one; that is what `python -m foodlink.cli create-admin` is
    for.
    """
    email = body.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with that email already exists",
        )

    user = User(
        name=body.name,
        email=email,
        password_hash=hash_password(body.password),
        role=body.role,
        organization=body.organization,
        phone=body.phone,
    )
    db.add(user)
    db.flush()

    # Mirror the side effects of self-registration, so an account made by an
    # administrator is not a second-class one missing its profile row.
    if user.role is UserRole.volunteer:
        db.add(Volunteer(user_id=user.id, location=body.organization or ""))
    elif user.role is UserRole.ngo:
        db.add(
            Recipient(
                user_id=user.id,
                name=body.organization or body.name,
                contact_person=body.name,
                phone=body.phone,
                # An administrator creating the organisation *is* the vouching.
                is_verified=True,
            )
        )

    db.commit()
    db.refresh(user)
    return UserAdminOut.model_validate(user)


@router.patch("/users/{user_id}", response_model=UserAdminOut)
def update_user(
    user_id: int,
    body: UserUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles(UserRole.admin)),
) -> UserAdminOut:
    """Suspend, restore, rename or re-role an account."""
    user = _get_user_or_404(db, user_id)
    changes = body.model_dump(exclude_unset=True)

    demoted = "role" in changes and changes["role"] is not UserRole.admin
    suspended = changes.get("is_active") is False
    losing_an_admin = user.role is UserRole.admin and user.is_active and (demoted or suspended)

    if losing_an_admin:
        if user.id == actor.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="You cannot suspend or demote your own administrator account",
            )
        if _active_admin_count(db, excluding=user.id) == 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This is the last active administrator — appoint another one first",
            )

    for field, value in changes.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return UserAdminOut.model_validate(user)


def _set_verification(db: Session, recipient_id: int, verified: bool) -> RecipientOut:
    recipient = db.get(Recipient, recipient_id)
    if recipient is None:
        raise HTTPException(status_code=404, detail="Organisation not found")
    recipient.is_verified = verified
    db.commit()
    db.refresh(recipient)
    return RecipientOut.model_validate(recipient)


@router.post("/recipients/{recipient_id}/verify", response_model=RecipientOut)
def verify_recipient(recipient_id: int, db: Session = Depends(get_db)) -> RecipientOut:
    """Vouch for an organisation.

    Verification is a human judgement — somebody confirmed this kitchen is
    real and is where it claims to be — so it is an administrator action
    rather than something an organisation asserts about itself.
    """
    return _set_verification(db, recipient_id, True)


@router.delete("/recipients/{recipient_id}/verify", response_model=RecipientOut)
def revoke_verification(recipient_id: int, db: Session = Depends(get_db)) -> RecipientOut:
    return _set_verification(db, recipient_id, False)


@router.post("/maintenance/expire")
def expire_overdue(db: Session = Depends(get_db)) -> dict:
    """Close donations nobody claimed before their deadline.

    Losses have to be recorded rather than left sitting as 'available'
    forever — the expiry-loss rate is a reported metric, so an unclaimed
    donation must reach a terminal state on its own.

    Intended to be driven by a scheduled job holding an administrator token;
    exposed as an endpoint so it can also be triggered during a demo without a
    cron runner.
    """
    now = datetime.now(timezone.utc)
    overdue = list(
        db.scalars(
            select(Donation).where(
                Donation.status.in_([DonationStatus.AVAILABLE, DonationStatus.MATCHED]),
                Donation.pickup_deadline < now,
            )
        )
    )
    for donation in overdue:
        db.add(
            StatusEvent(
                donation_id=donation.id,
                from_status=donation.status,
                to_status=DonationStatus.EXPIRED,
                note="Deadline passed with no recipient",
            )
        )
        donation.status = DonationStatus.EXPIRED
    db.commit()
    return {"expired": len(overdue)}
