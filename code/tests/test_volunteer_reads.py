"""Who may read the courier roster, and how much of it.

`GET /api/volunteers` returns `VolunteerOut`, which carries a courier's phone
number, so this endpoint is a directory of people — the same objection
`test_recipient_reads.py` covers for organisations, on the neighbouring table.

It was role-gated to `admin` and `ngo` and scoped no further. That is not a
boundary: `ngo` is a self-signup role, so holding it costs one registration, and
`is_verified` gates ranking and acceptance rather than reads. Every courier's
phone number was therefore one sign-up away from anybody.

A kitchen now reads the couriers on its *own* donations and nothing else, which
is the set it has a reason to contact. An administrator still reads everything.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from conftest import admin_token, auth, register, register_ngo

CAMPUS = {"latitude": 30.3540, "longitude": 76.3630}
COURIER_PHONE = "+91-98765-43210"
OUTSIDER_PHONE = "+91-98765-00000"


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


def register_courier(client, *, email: str, name: str, phone: str) -> str:
    """A courier account carrying a real phone number, which is what is at stake."""
    response = client.post(
        "/api/auth/register",
        json={
            "name": name,
            "email": email,
            "password": "testpassword123",
            "role": "volunteer",
            "phone": phone,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["accessToken"]


@pytest.fixture
def roster(client, db_session):
    """One donation carried by one courier, plus a courier with no connection.

    `ours` claimed a pickup for the kitchen `ngo_token` acts for. `outsider` is a
    fully registered courier who has never touched one of that kitchen's
    donations — the account whose phone number the kitchen must not be able to
    read.
    """
    donor = register(client, email="donor@example.com", role="donor")
    ngo_token, _ = register_ngo(client, db_session, email="kitchen@example.com", org="Helping Hands")
    ours = register_courier(
        client, email="ours@example.com", name="Bound Courier", phone=COURIER_PHONE
    )
    outsider = register_courier(
        client, email="outsider@example.com", name="Unrelated Courier", phone=OUTSIDER_PHONE
    )

    created = client.post("/api/donations", json=donation_body(), headers=auth(donor))
    assert created.status_code == 201, created.text
    donation_id = created.json()["id"]

    accepted = client.post(
        f"/api/donations/{donation_id}/status",
        json={"status": "ACCEPTED"},
        headers=auth(ngo_token),
    )
    assert accepted.status_code == 200, accepted.text

    claimed = client.post(
        f"/api/donations/{donation_id}/status",
        json={"status": "VOLUNTEER_ASSIGNED"},
        headers=auth(ours),
    )
    assert claimed.status_code == 200, claimed.text

    return {
        "donation_id": donation_id,
        "donor": donor,
        "ngo": ngo_token,
        "ours": ours,
        "outsider": outsider,
    }


def names_in(response) -> set[str]:
    return {v["name"] for v in response.json()}


def test_a_kitchen_cannot_read_an_unrelated_couriers_phone_number(roster, client):
    response = client.get("/api/volunteers", headers=auth(roster["ngo"]))

    assert response.status_code == 200, response.text
    body = response.json()
    assert OUTSIDER_PHONE not in [v["phone"] for v in body]
    assert "Unrelated Courier" not in names_in(response)


def test_a_kitchen_reads_the_courier_carrying_its_own_donation(roster, client):
    response = client.get("/api/volunteers", headers=auth(roster["ngo"]))

    assert response.status_code == 200, response.text
    body = response.json()
    assert names_in(response) == {"Bound Courier"}
    # The phone number is kept for this one deliberately: a kitchen expecting a
    # handover has a reason to reach the courier bringing it.
    assert body[0]["phone"] == COURIER_PHONE


def test_a_kitchen_with_no_donations_reads_an_empty_roster(client, db_session):
    register_courier(
        client, email="somebody@example.com", name="Some Courier", phone=OUTSIDER_PHONE
    )
    ngo_token, _ = register_ngo(
        client, db_session, email="fresh@example.com", org="Fresh Kitchen"
    )

    response = client.get("/api/volunteers", headers=auth(ngo_token))

    assert response.status_code == 200, response.text
    assert response.json() == []


def test_a_self_registered_unverified_kitchen_reads_no_courier_at_all(roster, client, db_session):
    """The account the fix is really about: one registration, no vouching, no data.

    `register_ngo(verified=False)` is exactly what a stranger gets from
    `POST /api/auth/register` — the role, an organisation row, and
    `is_verified=False`. It has no donations, so it now reads nothing.
    """
    stranger, _ = register_ngo(
        client, db_session, email="stranger@example.com", org="Walk-In", verified=False
    )

    response = client.get("/api/volunteers", headers=auth(stranger))

    assert response.status_code == 200, response.text
    assert response.json() == []
    assert COURIER_PHONE not in [v["phone"] for v in response.json()]


def test_an_administrator_still_reads_the_whole_roster(roster, client, db_session):
    """Preserved behaviour: `AdminVolunteers` is the screen this endpoint is for."""
    response = client.get(
        "/api/volunteers", headers=auth(admin_token(client, db_session))
    )

    assert response.status_code == 200, response.text
    assert names_in(response) == {"Bound Courier", "Unrelated Courier"}
    assert set(v["phone"] for v in response.json()) == {COURIER_PHONE, OUTSIDER_PHONE}


def test_the_roster_stays_closed_to_donors_and_couriers(roster, client):
    """Unchanged: the route role-gates these two with a 403, unlike `GET /recipients`."""
    for role, token in (("donor", roster["donor"]), ("volunteer", roster["ours"])):
        response = client.get("/api/volunteers", headers=auth(token))
        assert response.status_code == 403, f"{role}: {response.text}"


def test_a_courier_still_reads_its_own_record(roster, client):
    """`/volunteers/me` is a different route and is deliberately untouched."""
    response = client.get("/api/volunteers/me", headers=auth(roster["ours"]))

    assert response.status_code == 200, response.text
    assert response.json()["name"] == "Bound Courier"
    assert response.json()["phone"] == COURIER_PHONE


def test_a_kitchen_keeps_reading_the_courier_after_the_delivery_completes(roster, client):
    """Scope follows the donation, not the live assignment.

    A completed donation is still this kitchen's record of who carried its food,
    so the courier does not disappear from the roster when the run ends.
    """
    for target, token in (
        ("PICKED_UP", roster["ours"]),
        ("DELIVERED", roster["ours"]),
        ("COMPLETED", roster["ngo"]),
    ):
        response = client.post(
            f"/api/donations/{roster['donation_id']}/status",
            json={"status": target},
            headers=auth(token),
        )
        assert response.status_code == 200, f"{target}: {response.text}"

    response = client.get("/api/volunteers", headers=auth(roster["ngo"]))
    assert names_in(response) == {"Bound Courier"}
