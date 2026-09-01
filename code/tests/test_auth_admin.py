"""Who may hold which role, and what each role is allowed to do.

The lifecycle tests in `test_api.py` assume authorisation works. These are the
tests that make that assumption safe: that nobody can appoint themselves an
administrator, that an unvouched-for organisation cannot take custody of food,
and that the platform cannot be left with no administrator at all.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from conftest import ADMIN_PASSWORD, admin_token, auth, register, register_ngo
from foodlink.models import Recipient

CAMPUS = {"latitude": 30.3540, "longitude": 76.3630}


def donation_body(hours_ahead: float = 6) -> dict:
    return {
        "foodName": "Vegetarian Thali Meals",
        "category": "Vegetarian",
        "quantity": 50,
        "unit": "Meals",
        "storageType": "Room Temperature",
        "description": "Surplus from lunch service.",
        "location": "College Central Mess",
        **CAMPUS,
        "pickupDeadline": (
            datetime.now(timezone.utc) + timedelta(hours=hours_ahead)
        ).isoformat(),
    }


# ─── Nobody appoints themselves ──────────────────────────────────────────────

def test_registration_cannot_mint_an_administrator(client):
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Sneaky",
            "email": "sneaky@test.com",
            "password": "testpassword123",
            "role": "admin",
        },
    )
    # Refused by the schema, so `admin` is not even an accepted value.
    assert response.status_code == 422
    assert "admin" in response.text.lower()


def test_admin_endpoints_are_closed_to_every_other_role(client):
    for role in ("donor", "ngo", "volunteer"):
        token = register(client, email=f"{role}-probe@test.com", role=role)
        assert client.get("/api/admin/users", headers=auth(token)).status_code == 403


def test_admin_endpoints_reject_anonymous_callers(client):
    assert client.get("/api/admin/users").status_code == 401


def test_an_administrator_can_appoint_another(client, db_session):
    root = admin_token(client, db_session)

    created = client.post(
        "/api/admin/users",
        json={
            "name": "Second Admin",
            "email": "second@foodlink-admin.com",
            "password": "anotherpassword1",
            "role": "admin",
        },
        headers=auth(root),
    )
    assert created.status_code == 201, created.text
    assert created.json()["role"] == "admin"

    # The appointed account works as an administrator in its own right.
    login = client.post(
        "/api/auth/login",
        data={"username": "second@foodlink-admin.com", "password": "anotherpassword1"},
    )
    assert login.status_code == 200
    assert client.get(
        "/api/admin/users", headers=auth(login.json()["accessToken"])
    ).status_code == 200


def test_the_platform_cannot_be_left_without_an_administrator(client, db_session):
    root = admin_token(client, db_session)
    me = client.get("/api/auth/me", headers=auth(root)).json()

    suspend_self = client.patch(
        f"/api/admin/users/{me['id']}", json={"isActive": False}, headers=auth(root)
    )
    assert suspend_self.status_code == 409

    demote_self = client.patch(
        f"/api/admin/users/{me['id']}", json={"role": "donor"}, headers=auth(root)
    )
    assert demote_self.status_code == 409


def test_an_administrator_can_be_suspended_once_another_exists(client, db_session):
    root = admin_token(client, db_session)
    second_id = client.post(
        "/api/admin/users",
        json={
            "name": "Second Admin",
            "email": "second@foodlink-admin.com",
            "password": "anotherpassword1",
            "role": "admin",
        },
        headers=auth(root),
    ).json()["id"]

    response = client.patch(
        f"/api/admin/users/{second_id}", json={"isActive": False}, headers=auth(root)
    )
    assert response.status_code == 200
    assert response.json()["isActive"] is False


# ─── Suspension ──────────────────────────────────────────────────────────────

def test_a_suspended_account_is_turned_away_at_login(client, db_session):
    root = admin_token(client, db_session)
    donor = register(client, email="doomed@test.com", role="donor")
    donor_id = client.get("/api/auth/me", headers=auth(donor)).json()["id"]

    client.patch(f"/api/admin/users/{donor_id}", json={"isActive": False}, headers=auth(root))

    login = client.post(
        "/api/auth/login", data={"username": "doomed@test.com", "password": "testpassword123"}
    )
    assert login.status_code == 403
    assert "deactivated" in login.json()["detail"].lower()


def test_a_suspended_accounts_existing_token_stops_working(client, db_session):
    root = admin_token(client, db_session)
    donor = register(client, email="revoked@test.com", role="donor")
    donor_id = client.get("/api/auth/me", headers=auth(donor)).json()["id"]

    assert client.get("/api/auth/me", headers=auth(donor)).status_code == 200
    client.patch(f"/api/admin/users/{donor_id}", json={"isActive": False}, headers=auth(root))
    # Every request re-reads the account, so suspension takes effect at once
    # rather than when the token happens to expire.
    assert client.get("/api/auth/me", headers=auth(donor)).status_code == 401


# ─── Organisation verification ───────────────────────────────────────────────

def test_ngo_registration_creates_an_unverified_organisation(client):
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Kitchen Lead",
            "email": "fresh-ngo@test.com",
            "password": "testpassword123",
            "role": "ngo",
            "organization": "Fresh Start Kitchen",
            "location": "Model Town",
            "latitude": 30.3400,
            "longitude": 76.3800,
            "capacity": 120,
        },
    )
    assert response.status_code == 201, response.text
    token = response.json()["accessToken"]
    assert response.json()["user"]["recipientId"] is not None

    profile = client.get("/api/recipients/me", headers=auth(token)).json()
    assert profile["name"] == "Fresh Start Kitchen"
    assert profile["capacity"] == 120
    assert profile["isVerified"] is False


def test_an_unverified_organisation_cannot_accept(client, db_session, verified_kitchen):
    donor = register(client, email="donor-unv@test.com", role="donor")
    ngo, _ = register_ngo(
        client, db_session, email="unverified@test.com", org="Unvouched Kitchen",
        verified=False,
    )
    donation_id = client.post(
        "/api/donations", json=donation_body(), headers=auth(donor)
    ).json()["id"]

    response = client.post(
        f"/api/donations/{donation_id}/status", json={"status": "ACCEPTED"}, headers=auth(ngo)
    )
    assert response.status_code == 403
    assert "verification" in response.json()["detail"].lower()


def test_verification_unlocks_acceptance(client, db_session):
    donor = register(client, email="donor-v@test.com", role="donor")
    ngo, recipient_id = register_ngo(
        client, db_session, email="tobe@test.com", org="Soon Verified", verified=False
    )
    donation_id = client.post(
        "/api/donations", json=donation_body(), headers=auth(donor)
    ).json()["id"]

    root = admin_token(client, db_session)
    verified = client.post(
        f"/api/admin/recipients/{recipient_id}/verify", headers=auth(root)
    )
    assert verified.status_code == 200
    assert verified.json()["isVerified"] is True

    accepted = client.post(
        f"/api/donations/{donation_id}/status", json={"status": "ACCEPTED"}, headers=auth(ngo)
    )
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["recipientId"] == recipient_id


def test_an_organisation_cannot_verify_itself(client, db_session):
    ngo, recipient_id = register_ngo(
        client, db_session, email="selfvouch@test.com", org="Self Vouch", verified=False
    )
    # The admin route is closed to them, and their own profile route has no
    # verification field to set.
    assert client.post(
        f"/api/admin/recipients/{recipient_id}/verify", headers=auth(ngo)
    ).status_code == 403

    client.patch("/api/recipients/me", json={"isVerified": True}, headers=auth(ngo))
    assert client.get("/api/recipients/me", headers=auth(ngo)).json()["isVerified"] is False


def test_unverified_organisations_are_not_ranked(client, db_session):
    donor = register(client, email="ranker@test.com", role="donor")
    register_ngo(client, db_session, email="seen@test.com", org="Verified Kitchen", verified=True)
    register_ngo(client, db_session, email="hidden@test.com", org="Pending Kitchen", verified=False)

    donation_id = client.post(
        "/api/donations", json=donation_body(), headers=auth(donor)
    ).json()["id"]
    matches = client.get(f"/api/donations/{donation_id}/matches", headers=auth(donor)).json()

    assert {m["recipientName"] for m in matches} == {"Verified Kitchen"}


# ─── Acting for the wrong organisation ───────────────────────────────────────

@pytest.fixture
def verified_kitchen(db_session):
    """A recipient organisation that no account owns."""
    recipient = Recipient(
        name="Someone Elses Kitchen", type="Community Kitchen", location="Model Town",
        latitude=30.3400, longitude=76.3800, capacity=150, is_verified=True,
    )
    db_session.add(recipient)
    db_session.commit()
    return recipient


def test_an_ngo_cannot_accept_for_another_organisation(client, db_session, verified_kitchen):
    donor = register(client, email="donor-x@test.com", role="donor")
    ngo, own_id = register_ngo(client, db_session, email="mine@test.com", org="My Kitchen")
    donation_id = client.post(
        "/api/donations", json=donation_body(), headers=auth(donor)
    ).json()["id"]

    response = client.post(
        f"/api/donations/{donation_id}/status",
        json={"status": "ACCEPTED", "recipientId": verified_kitchen.id},
        headers=auth(ngo),
    )
    assert response.status_code == 403
    assert response.json()["detail"].lower().startswith("you can only accept")


def test_an_admin_may_accept_on_an_organisations_behalf(client, db_session, verified_kitchen):
    donor = register(client, email="donor-y@test.com", role="donor")
    donation_id = client.post(
        "/api/donations", json=donation_body(), headers=auth(donor)
    ).json()["id"]

    root = admin_token(client, db_session)
    response = client.post(
        f"/api/donations/{donation_id}/status",
        json={"status": "ACCEPTED", "recipientId": verified_kitchen.id},
        headers=auth(root),
    )
    assert response.status_code == 200, response.text
    assert response.json()["recipientName"] == "Someone Elses Kitchen"


# ─── Profile & password self-service ─────────────────────────────────────────

def test_an_organisation_can_complete_its_own_profile(client, db_session):
    ngo, _ = register_ngo(client, db_session, email="profile@test.com", org="Half Filled")

    response = client.patch(
        "/api/recipients/me",
        json={"location": "Urban Estate, Patiala", "capacity": 200, "contactPerson": "Asha"},
        headers=auth(ngo),
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["location"] == "Urban Estate, Patiala"
    assert body["capacity"] == 200
    assert body["contactPerson"] == "Asha"
    # Untouched fields survive a partial update.
    assert body["name"] == "Half Filled"


def test_password_change_requires_the_current_one(client):
    token = register(client, email="pwchange@test.com", role="donor")

    wrong = client.post(
        "/api/auth/password",
        json={"currentPassword": "notmypassword", "newPassword": "brandnewpassword"},
        headers=auth(token),
    )
    assert wrong.status_code == 401

    right = client.post(
        "/api/auth/password",
        json={"currentPassword": "testpassword123", "newPassword": "brandnewpassword"},
        headers=auth(token),
    )
    assert right.status_code == 200

    assert client.post(
        "/api/auth/login",
        data={"username": "pwchange@test.com", "password": "brandnewpassword"},
    ).status_code == 200
    assert client.post(
        "/api/auth/login",
        data={"username": "pwchange@test.com", "password": "testpassword123"},
    ).status_code == 401


# ─── Maintenance ─────────────────────────────────────────────────────────────

def test_the_expiry_sweep_closes_an_overdue_donation(client, db_session, verified_kitchen):
    """An unclaimed donation past its deadline must reach a terminal state.

    The API refuses to *create* a donation in the past, so the deadline is
    moved backwards directly — which is what the passage of time would do.
    """
    from foodlink.models import Donation, DonationStatus

    donor = register(client, email="stale@test.com", role="donor")
    donation_id = client.post(
        "/api/donations", json=donation_body(hours_ahead=1), headers=auth(donor)
    ).json()["id"]

    donation = db_session.get(Donation, donation_id)
    donation.pickup_deadline = datetime.now(timezone.utc) - timedelta(minutes=5)
    db_session.commit()

    root = admin_token(client, db_session)
    assert client.post(
        "/api/admin/maintenance/expire", headers=auth(root)
    ).json() == {"expired": 1}

    after = client.get(f"/api/donations/{donation_id}", headers=auth(donor)).json()
    assert after["status"] == "EXPIRED"
    # The loss is recorded in the history the metrics are computed from.
    assert after["events"][-1]["toStatus"] == "EXPIRED"

    metrics = client.get("/api/metrics", headers=auth(root)).json()
    assert metrics["expiredDonations"] == 1
    assert metrics["expiryLossRatePercent"] == 100.0


def test_the_expiry_sweep_is_administrator_only(client, db_session):
    donor = register(client, email="expiry@test.com", role="donor")
    assert client.post("/api/admin/maintenance/expire", headers=auth(donor)).status_code == 403

    root = admin_token(client, db_session)
    response = client.post("/api/admin/maintenance/expire", headers=auth(root))
    assert response.status_code == 200
    assert response.json() == {"expired": 0}


# ─── Bootstrapping ───────────────────────────────────────────────────────────

def test_the_cli_creates_the_first_administrator(client, db_session, monkeypatch):
    """The bootstrap path: no administrator exists, so none can be asked."""
    from foodlink import cli

    monkeypatch.setattr(cli, "_session", lambda: db_session)
    monkeypatch.setenv(cli.PASSWORD_ENV_VAR, ADMIN_PASSWORD)

    cli.create_admin("bootstrap@foodlink-admin.com", "Bootstrap Admin")

    login = client.post(
        "/api/auth/login",
        data={"username": "bootstrap@foodlink-admin.com", "password": ADMIN_PASSWORD},
    )
    assert login.status_code == 200
    assert login.json()["user"]["role"] == "admin"
    assert client.get(
        "/api/admin/users", headers=auth(login.json()["accessToken"])
    ).status_code == 200


def test_the_cli_promotes_an_existing_account(client, db_session, monkeypatch):
    from foodlink import cli

    register(client, email="promote-me@test.com", role="donor")
    monkeypatch.setattr(cli, "_session", lambda: db_session)
    cli.promote("promote-me@test.com")

    login = client.post(
        "/api/auth/login",
        data={"username": "promote-me@test.com", "password": "testpassword123"},
    )
    assert login.json()["user"]["role"] == "admin"


def test_the_cli_refuses_to_duplicate_an_existing_account(client, db_session, monkeypatch):
    from foodlink import cli

    register(client, email="taken@test.com", role="donor")
    monkeypatch.setattr(cli, "_session", lambda: db_session)
    monkeypatch.setenv(cli.PASSWORD_ENV_VAR, ADMIN_PASSWORD)

    with pytest.raises(SystemExit):
        cli.create_admin("taken@test.com", "Impostor")
