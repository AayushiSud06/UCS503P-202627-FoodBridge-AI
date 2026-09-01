"""Test fixtures: a throwaway SQLite database per test run."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from foodlink.database import Base, get_db
from foodlink.main import app


@pytest.fixture
def db_session():
    # StaticPool keeps one in-memory database alive across connections, which
    # the request/test boundary would otherwise discard.
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def register(client: TestClient, *, email: str, role: str, name: str = "Test User", org: str | None = None) -> str:
    """Create an account and return its bearer token."""
    response = client.post(
        "/api/auth/register",
        json={
            "name": name,
            "email": email,
            "password": "testpassword123",
            "role": role,
            "organization": org,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["accessToken"]


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


ADMIN_EMAIL = "root@foodlink-admin.com"
ADMIN_PASSWORD = "adminpassword123"


def admin_token(client: TestClient, db_session, email: str = ADMIN_EMAIL) -> str:
    """An administrator, created the way the CLI creates one.

    The API has no path to a first administrator by design, so tests reach
    into the database exactly as `python -m foodlink.cli create-admin` does,
    then authenticate normally through the API.
    """
    from foodlink.models import User, UserRole
    from foodlink.security import hash_password

    existing = db_session.query(User).filter_by(email=email).one_or_none()
    if existing is None:
        db_session.add(
            User(
                name="Root Admin",
                email=email,
                password_hash=hash_password(ADMIN_PASSWORD),
                role=UserRole.admin,
            )
        )
        db_session.commit()

    response = client.post(
        "/api/auth/login", data={"username": email, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200, response.text
    return response.json()["accessToken"]


def register_ngo(
    client: TestClient,
    db_session,
    *,
    email: str,
    org: str,
    latitude: float = 30.3400,
    longitude: float = 76.3800,
    capacity: int = 150,
    verified: bool = True,
) -> tuple[str, int]:
    """Sign up a recipient organisation and (by default) have it verified.

    Returns `(token, recipient_id)`. Verification is a separate administrator
    step because that is what it is in the product: an organisation cannot
    accept donations until somebody has vouched for it.
    """
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Kitchen Lead",
            "email": email,
            "password": "testpassword123",
            "role": "ngo",
            "organization": org,
            "location": "Model Town, Patiala",
            "latitude": latitude,
            "longitude": longitude,
            "capacity": capacity,
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    recipient_id = body["user"]["recipientId"]
    assert recipient_id is not None

    if verified:
        response = client.post(
            f"/api/admin/recipients/{recipient_id}/verify",
            headers=auth(admin_token(client, db_session)),
        )
        assert response.status_code == 200, response.text

    return body["accessToken"], recipient_id
