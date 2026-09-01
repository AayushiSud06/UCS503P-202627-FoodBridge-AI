"""Administrative command line.

The API deliberately offers no way for a stranger to create an administrator,
which leaves a bootstrap problem: the very first one has to come from
somewhere. It comes from here — from whoever can already run commands against
the database, which is the only authority that exists before any account does.

    python -m foodlink.cli create-admin --email you@example.com --name "Your Name"
    python -m foodlink.cli promote --email someone@example.com
    python -m foodlink.cli reset-password --email you@example.com
    python -m foodlink.cli list-admins

Run these from the `code/` directory. Passwords are prompted for rather than
passed as arguments: an argument lands in shell history and in the process
list, where other users on the machine can read it.
"""

from __future__ import annotations

import argparse
import getpass
import os
import sys

from sqlalchemy import select

from .database import Base, SessionLocal, engine
from .models import User, UserRole
from .security import hash_password

MIN_PASSWORD_LENGTH = 8

#: Escape hatch for scripted setup (CI, a container entrypoint). Reading the
#: password from the environment keeps it out of the command line, though a
#: prompt is still preferable where a human is present.
PASSWORD_ENV_VAR = "FOODLINK_ADMIN_PASSWORD"


def _fail(message: str) -> None:
    print(f"error: {message}", file=sys.stderr)
    raise SystemExit(1)


def _read_password(confirm: bool = True) -> str:
    from_env = os.getenv(PASSWORD_ENV_VAR)
    if from_env:
        if len(from_env) < MIN_PASSWORD_LENGTH:
            _fail(f"{PASSWORD_ENV_VAR} must be at least {MIN_PASSWORD_LENGTH} characters")
        return from_env

    if not sys.stdin.isatty():
        _fail(
            "no terminal to prompt on — set "
            f"{PASSWORD_ENV_VAR} in the environment instead"
        )

    password = getpass.getpass("Password: ")
    if len(password) < MIN_PASSWORD_LENGTH:
        _fail(f"password must be at least {MIN_PASSWORD_LENGTH} characters")
    if confirm and getpass.getpass("Confirm password: ") != password:
        _fail("passwords do not match")
    return password


def _session():
    # A fresh clone may never have started the API, so the tables might not
    # exist yet. Creating them here means bootstrapping works on a bare
    # checkout without a separate migration step.
    Base.metadata.create_all(bind=engine)
    return SessionLocal()


def create_admin(email: str, name: str) -> None:
    email = email.strip().lower()
    with _session() as db:
        if db.scalar(select(User).where(User.email == email)):
            _fail(
                f"{email} already has an account. "
                "Use `promote` to make it an administrator."
            )

        user = User(
            name=name,
            email=email,
            password_hash=hash_password(_read_password()),
            role=UserRole.admin,
        )
        db.add(user)
        db.commit()
        print(f"Administrator created: {name} <{email}> (id {user.id})")


def promote(email: str) -> None:
    """Raise an existing account to administrator.

    Kept separate from `create-admin` so that granting the most powerful role
    to an account that already exists is always a deliberate, named act rather
    than a side effect of a typo in an email address.
    """
    email = email.strip().lower()
    with _session() as db:
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            _fail(f"no account for {email}")
        if user.role is UserRole.admin:
            print(f"{email} is already an administrator.")
            return

        previous = user.role.value
        user.role = UserRole.admin
        user.is_active = True
        db.commit()
        print(f"Promoted {user.name} <{email}> from {previous} to admin.")


def reset_password(email: str) -> None:
    """Set a new password for any account, without knowing the old one.

    This is the recovery path for a locked-out administrator. It requires
    database access, so it grants nothing to anyone who did not already have
    everything.
    """
    email = email.strip().lower()
    with _session() as db:
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            _fail(f"no account for {email}")
        user.password_hash = hash_password(_read_password())
        db.commit()
        print(f"Password updated for {email}.")


def list_admins() -> None:
    with _session() as db:
        admins = list(db.scalars(select(User).where(User.role == UserRole.admin)))
        if not admins:
            print("No administrators exist. Create one with `create-admin`.")
            return
        print(f"{len(admins)} administrator(s):")
        for user in admins:
            state = "active" if user.is_active else "SUSPENDED"
            print(f"  [{user.id}] {user.name} <{user.email}>  {state}")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        prog="python -m foodlink.cli", description=__doc__.split("\n")[0]
    )
    sub = parser.add_subparsers(dest="command", required=True)

    create = sub.add_parser("create-admin", help="create the first administrator account")
    create.add_argument("--email", required=True)
    create.add_argument("--name", required=True)

    grant = sub.add_parser("promote", help="make an existing account an administrator")
    grant.add_argument("--email", required=True)

    reset = sub.add_parser("reset-password", help="set a new password for any account")
    reset.add_argument("--email", required=True)

    sub.add_parser("list-admins", help="show every administrator account")

    args = parser.parse_args(argv)

    if args.command == "create-admin":
        create_admin(args.email, args.name)
    elif args.command == "promote":
        promote(args.email)
    elif args.command == "reset-password":
        reset_password(args.email)
    elif args.command == "list-admins":
        list_admins()


if __name__ == "__main__":
    main()
