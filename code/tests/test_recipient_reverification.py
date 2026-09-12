"""A verification describes the organisation as it was vouched for (D-54).

`Recipient.is_verified` means an administrator vouched that this organisation
is real and is where it claims to be (D-37). The organisation edits its own
profile through `PATCH /api/recipients/me`, and nothing used to tie the two
together: the health audit of 2026-09-10 moved a verified kitchen ~250 km and
renamed it, and it stayed verified — ranked, reading the open pool, able to
accept (`TASKS.md` P1-2).

The rule: a real change to `name`, `latitude` or `longitude` clears
`is_verified`; every other field, and a PATCH that resubmits the current values,
leaves it alone. An administrator verifies again through the existing endpoint.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from conftest import admin_token, auth, register, register_ngo

#: `register_ngo`'s own defaults, named so a resubmission is visibly the same pin.
HOME = {"latitude": 30.3400, "longitude": 76.3800}
#: About 250 km away — the audit's reproduction.
AWAY = {"latitude": 28.6139, "longitude": 77.2090}


def verified_kitchen(client, db_session, email: str = "kitchen@test.com") -> tuple[str, int]:
    return register_ngo(client, db_session, email=email, org="Helping Hands", **HOME)


def patch_me(client, token: str, body: dict) -> dict:
    response = client.patch("/api/recipients/me", json=body, headers=auth(token))
    assert response.status_code == 200, response.text
    return response.json()


def stored_verification(client, token: str) -> bool:
    return client.get("/api/recipients/me", headers=auth(token)).json()["isVerified"]


def verify(client, db_session, recipient_id: int) -> dict:
    response = client.post(
        f"/api/admin/recipients/{recipient_id}/verify",
        headers=auth(admin_token(client, db_session)),
    )
    assert response.status_code == 200, response.text
    return response.json()


# ─── Changing what was verified ──────────────────────────────────────────────

@pytest.mark.parametrize(
    "change",
    [
        {"name": "Helping Hands Annexe"},
        {"latitude": 30.3500},
        {"longitude": 76.3900},
        AWAY,
    ],
    ids=["name", "latitude-only", "longitude-only", "both-coordinates"],
)
def test_changing_the_name_or_pin_voids_the_verification(client, db_session, change):
    token, _ = verified_kitchen(client, db_session)

    body = patch_me(client, token, change)

    assert body["isVerified"] is False
    for field, value in change.items():
        assert body[field] == value, "the change itself must still be applied"
    assert stored_verification(client, token) is False


# ─── What does not void it ───────────────────────────────────────────────────

def test_resubmitting_the_current_name_and_pin_keeps_the_verification(client, db_session):
    """A PATCH is not a change: the values are compared, not the request."""
    token, _ = verified_kitchen(client, db_session)

    body = patch_me(client, token, {"name": "Helping Hands", **HOME})

    assert body["isVerified"] is True
    assert stored_verification(client, token) is True


def test_every_other_field_still_saves_and_keeps_the_verification(client, db_session):
    """The profile form's own save — the name resent unchanged, the rest edited."""
    token, _ = verified_kitchen(client, db_session)
    edits = {
        "type": "Shelter",
        "location": "Near the old bus stand, Patiala",
        "capacity": 220,
        "contactPerson": "New Intake Lead",
        "phone": "+91 99999 00000",
    }

    body = patch_me(client, token, {"name": "Helping Hands", **edits})

    assert body["isVerified"] is True
    for field, value in edits.items():
        assert body[field] == value
    assert stored_verification(client, token) is True


def test_an_unverified_organisation_stays_unverified_and_its_edit_applies(client, db_session):
    token, _ = register_ngo(
        client, db_session, email="pending@test.com", org="Pending Kitchen", verified=False
    )

    body = patch_me(client, token, {"name": "Pending Kitchen Renamed", **AWAY})

    assert body["isVerified"] is False
    assert body["name"] == "Pending Kitchen Renamed"
    assert (body["latitude"], body["longitude"]) == (AWAY["latitude"], AWAY["longitude"])


# ─── Verifying again ─────────────────────────────────────────────────────────

def test_an_administrator_verifies_again_and_the_rule_holds_again(client, db_session):
    """unverified → verified → changed → unverified → verified, and round again."""
    token, recipient_id = verified_kitchen(client, db_session)

    assert patch_me(client, token, {"name": "Helping Hands North"})["isVerified"] is False
    assert verify(client, db_session, recipient_id)["isVerified"] is True
    assert stored_verification(client, token) is True

    # The renamed profile is now the vouched-for one, so resending it is a no-op...
    assert patch_me(client, token, {"name": "Helping Hands North"})["isVerified"] is True
    # ...and moving the pin voids it again.
    assert patch_me(client, token, AWAY)["isVerified"] is False
    assert verify(client, db_session, recipient_id)["isVerified"] is True


# ─── What the verification was for ───────────────────────────────────────────

def test_a_voided_verification_takes_its_privileges_with_it(client, db_session):
    """The audit's reproduction: moved, renamed, and still ranked first."""
    token, recipient_id = verified_kitchen(client, db_session)
    patch_me(client, token, {"name": "Renamed After Vetting", **AWAY})

    donor = register(client, email="donor@test.com", role="donor")
    created = client.post(
        "/api/donations",
        headers=auth(donor),
        json={
            "foodName": "Veg Thali",
            "category": "Vegetarian",
            "quantity": 50,
            "unit": "Meals",
            "location": "Connaught Place",
            "latitude": AWAY["latitude"] + 0.001,
            "longitude": AWAY["longitude"] + 0.001,
            "pickupDeadline": (datetime.now(timezone.utc) + timedelta(hours=6)).isoformat(),
        },
    )
    assert created.status_code == 201, created.text
    donation_id = created.json()["id"]

    ranked = client.get(
        f"/api/donations/{donation_id}/matches",
        headers=auth(admin_token(client, db_session)),
    ).json()
    assert recipient_id not in {m["recipientId"] for m in ranked}

    # The open pool (D-53) and custody (the `ACCEPTED` gate) close with it.
    assert client.get(f"/api/donations/{donation_id}", headers=auth(token)).status_code == 404
    accept = client.post(
        f"/api/donations/{donation_id}/status", json={"status": "ACCEPTED"}, headers=auth(token)
    )
    assert accept.status_code == 403


def test_an_admin_created_organisation_is_voided_by_its_first_pin(client, db_session):
    """Any real change counts — including a first pin where there was none.

    `POST /admin/users` creates an organisation verified and unpinned, so its
    first coordinates are exactly the "where it claims to be" nobody vouched
    for yet.
    """
    root = admin_token(client, db_session)
    created = client.post(
        "/api/admin/users",
        headers=auth(root),
        json={
            "name": "Kitchen Lead",
            "email": "made@test.com",
            "password": "testpassword123",
            "role": "ngo",
            "organization": "Admin Made Kitchen",
        },
    )
    assert created.status_code == 201, created.text
    token = client.post(
        "/api/auth/login", data={"username": "made@test.com", "password": "testpassword123"}
    ).json()["accessToken"]
    assert stored_verification(client, token) is True

    assert patch_me(client, token, HOME)["isVerified"] is False
