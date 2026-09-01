"""Registration, login and identity.

Three things about the account model are decided here:

* Registration is open, but only for the three roles that describe a party in
  a handover — donor, recipient, courier. `admin` is refused by the schema, so
  administrators can only come from an existing administrator or from the
  command line (see `foodlink/cli.py`).
* Signing up as an NGO also creates the recipient organisation the account
  acts for, exactly as signing up as a courier creates a volunteer profile.
  Without it the account would be authenticated but unable to accept anything.
* A disabled account is turned away at login, not merely on its next request,
  so "your account has been suspended" is what the person actually sees.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Recipient, User, UserRole, Volunteer
from ..schemas import PasswordChange, ProfileUpdate, RegisterRequest, TokenResponse, UserOut
from ..security import create_access_token, get_current_user, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])

INACTIVE_DETAIL = "This account has been deactivated. Contact a platform administrator."


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
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

    # A courier needs a volunteer row before tasks can be assigned to them.
    if user.role is UserRole.volunteer:
        db.add(Volunteer(user_id=user.id, location=body.organization or ""))

    # A recipient account needs an organisation to accept donations on behalf
    # of. It starts unverified: an administrator vouches for it before it is
    # presented to donors as trustworthy.
    if user.role is UserRole.ngo:
        db.add(
            Recipient(
                user_id=user.id,
                name=body.organization or body.name,
                type=body.organization_type or "Community Kitchen",
                location=body.location or "",
                latitude=body.latitude,
                longitude=body.longitude,
                capacity=body.capacity or 100,
                contact_person=body.name,
                phone=body.phone,
                is_verified=False,
            )
        )

    db.commit()
    db.refresh(user)
    return TokenResponse(access_token=create_access_token(user), user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenResponse)
def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> TokenResponse:
    # OAuth2PasswordRequestForm calls the field "username"; we treat it as email.
    user = db.scalar(select(User).where(User.email == form.username.lower()))
    if user is None or not verify_password(form.password, user.password_hash):
        # One message for both cases: distinguishing them would confirm which
        # addresses have accounts.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=INACTIVE_DETAIL)
    return TokenResponse(access_token=create_access_token(user), user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(user)


@router.patch("/me", response_model=UserOut)
def update_me(
    body: ProfileUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> UserOut:
    """Correct your own name, organisation or phone number."""
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.post("/password", response_model=UserOut)
def change_password(
    body: PasswordChange,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> UserOut:
    """Change your own password, proving you know the current one.

    Needed because administrator-created accounts start on a password someone
    else chose; without this the first thing every such account does is share
    a credential it cannot rotate.
    """
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect"
        )
    user.password_hash = hash_password(body.new_password)
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)
