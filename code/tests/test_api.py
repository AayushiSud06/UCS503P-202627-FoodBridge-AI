"""End-to-end coverage of the donation lifecycle, auth and metrics."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from conftest import auth, register, register_ngo
from foodlink.models import Recipient

CAMPUS = {"latitude": 30.3540, "longitude": 76.3630}


def make_donation_body(hours_ahead: float = 6, quantity: int = 50) -> dict:
    return {
        "foodName": "Vegetarian Thali Meals",
        "category": "Vegetarian",
        "quantity": quantity,
        "unit": "Meals",
        "storageType": "Room Temperature",
        "description": "Surplus from lunch service.",
        "location": "College Central Mess",
        **CAMPUS,
        "pickupDeadline": (
            datetime.now(timezone.utc) + timedelta(hours=hours_ahead)
        ).isoformat(),
    }


@pytest.fixture
def recipients(db_session):
    """Three kitchens at different distances, so ranking has something to do."""
    rows = [
        Recipient(name="Helping Hands", type="Community Kitchen", location="Model Town",
                  latitude=30.3400, longitude=76.3800, capacity=150, is_verified=True,
                  accepted_donations=41, completed_donations=39),
        Recipient(name="Umeed Shelter", type="Night Shelter", location="Urban Estate",
                  latitude=30.3700, longitude=76.3900, capacity=80, is_verified=True,
                  accepted_donations=22, completed_donations=20),
        Recipient(name="Faraway Trust", type="Community Kitchen", location="Far side",
                  latitude=31.2000, longitude=77.5000, capacity=100, is_verified=True,
                  accepted_donations=5, completed_donations=5),
    ]
    db_session.add_all(rows)
    db_session.commit()
    return rows


# ─── Health & auth ───────────────────────────────────────────────────────────

def test_health(client):
    assert client.get("/api/health").json()["status"] == "ok"


def test_register_then_login(client):
    register(client, email="donor@test.com", role="donor")
    response = client.post(
        "/api/auth/login",
        data={"username": "donor@test.com", "password": "testpassword123"},
    )
    assert response.status_code == 200
    assert response.json()["user"]["role"] == "donor"


def test_duplicate_email_rejected(client):
    register(client, email="dupe@test.com", role="donor")
    response = client.post(
        "/api/auth/register",
        json={"name": "X", "email": "dupe@test.com", "password": "testpassword123", "role": "donor"},
    )
    assert response.status_code == 409


def test_wrong_password_rejected(client):
    register(client, email="pw@test.com", role="donor")
    response = client.post(
        "/api/auth/login", data={"username": "pw@test.com", "password": "wrongpassword"}
    )
    assert response.status_code == 401


def test_endpoints_require_a_token(client):
    assert client.get("/api/donations").status_code == 401


# ─── Creation & matching ─────────────────────────────────────────────────────

def test_creating_a_donation_stamps_it_and_matches(client, recipients):
    token = register(client, email="d1@test.com", role="donor", org="Central Mess")
    response = client.post("/api/donations", json=make_donation_body(), headers=auth(token))
    assert response.status_code == 201, response.text

    body = response.json()
    # A recipient is in range, so the donation should arrive already matched
    # with a score — but not assigned to anyone.
    assert body["status"] == "MATCHED"
    assert body["matchScore"] is not None
    assert body["recipientId"] is None
    # The lifecycle history starts on the server, not the client.
    assert [e["toStatus"] for e in body["events"]] == ["AVAILABLE", "MATCHED"]


def test_deadline_in_the_past_is_rejected(client, recipients):
    token = register(client, email="d2@test.com", role="donor")
    response = client.post(
        "/api/donations", json=make_donation_body(hours_ahead=-1), headers=auth(token)
    )
    assert response.status_code == 422


def test_matches_are_ranked_and_exclude_out_of_radius(client, recipients):
    token = register(client, email="d3@test.com", role="donor")
    donation_id = client.post(
        "/api/donations", json=make_donation_body(), headers=auth(token)
    ).json()["id"]

    matches = client.get(f"/api/donations/{donation_id}/matches", headers=auth(token)).json()

    # "Faraway Trust" is ~95 km out and must not be scored at all.
    assert {m["recipientName"] for m in matches} == {"Helping Hands", "Umeed Shelter"}
    # Ranked best-first.
    assert matches == sorted(matches, key=lambda m: m["overallScore"], reverse=True)
    # Each score is explainable.
    assert all(m["reasons"] for m in matches)
    assert all(0 <= m["overallScore"] <= 100 for m in matches)


def test_a_nearer_kitchen_outranks_a_further_one(client, recipients):
    token = register(client, email="d4@test.com", role="donor")
    donation_id = client.post(
        "/api/donations", json=make_donation_body(), headers=auth(token)
    ).json()["id"]
    matches = client.get(f"/api/donations/{donation_id}/matches", headers=auth(token)).json()
    by_name = {m["recipientName"]: m for m in matches}
    assert by_name["Helping Hands"]["distanceKm"] < by_name["Umeed Shelter"]["distanceKm"]
    assert by_name["Helping Hands"]["distanceScore"] > by_name["Umeed Shelter"]["distanceScore"]


# ─── Lifecycle ───────────────────────────────────────────────────────────────

def _accepted_donation(client, db_session, recipients):
    """Post a donation and have a verified NGO accept it. Returns (id, tokens)."""
    donor = register(client, email="flow-donor@test.com", role="donor")
    ngo, _ = register_ngo(client, db_session, email="flow-ngo@test.com", org="Helping Hands")

    donation_id = client.post(
        "/api/donations", json=make_donation_body(), headers=auth(donor)
    ).json()["id"]

    response = client.post(
        f"/api/donations/{donation_id}/status", json={"status": "ACCEPTED"}, headers=auth(ngo)
    )
    assert response.status_code == 200, response.text
    return donation_id, donor, ngo


def test_full_lifecycle_to_completion(client, db_session, recipients):
    donation_id, donor, ngo = _accepted_donation(client, db_session, recipients)
    courier = register(client, email="flow-courier@test.com", role="volunteer")

    for step in ("VOLUNTEER_ASSIGNED", "PICKED_UP", "DELIVERED"):
        response = client.post(
            f"/api/donations/{donation_id}/status", json={"status": step}, headers=auth(courier)
        )
        assert response.status_code == 200, response.text

    final = client.post(
        f"/api/donations/{donation_id}/status", json={"status": "COMPLETED"}, headers=auth(ngo)
    ).json()

    assert final["status"] == "COMPLETED"
    assert final["volunteerName"] is not None
    assert final["distanceKm"] is not None
    recorded = [e["toStatus"] for e in final["events"]]
    assert recorded == [
        "AVAILABLE", "MATCHED", "ACCEPTED", "VOLUNTEER_ASSIGNED",
        "PICKED_UP", "DELIVERED", "COMPLETED",
    ]


def test_illegal_transition_is_rejected(client, recipients):
    token = register(client, email="skip@test.com", role="donor")
    donation_id = client.post(
        "/api/donations", json=make_donation_body(), headers=auth(token)
    ).json()["id"]
    courier = register(client, email="skip-courier@test.com", role="volunteer")

    # MATCHED -> PICKED_UP skips acceptance and assignment entirely.
    response = client.post(
        f"/api/donations/{donation_id}/status", json={"status": "PICKED_UP"}, headers=auth(courier)
    )
    assert response.status_code == 409


def test_a_donor_cannot_accept_on_a_kitchens_behalf(client, recipients):
    token = register(client, email="pushy@test.com", role="donor")
    donation_id = client.post(
        "/api/donations", json=make_donation_body(), headers=auth(token)
    ).json()["id"]

    response = client.post(
        f"/api/donations/{donation_id}/status",
        json={"status": "ACCEPTED", "recipientId": recipients[0].id},
        headers=auth(token),
    )
    assert response.status_code == 403


def test_second_courier_cannot_steal_a_claimed_pickup(client, db_session, recipients):
    donation_id, _, _ = _accepted_donation(client, db_session, recipients)
    first = register(client, email="c1@test.com", role="volunteer")
    second = register(client, email="c2@test.com", role="volunteer")

    assert client.post(
        f"/api/donations/{donation_id}/status",
        json={"status": "VOLUNTEER_ASSIGNED"},
        headers=auth(first),
    ).status_code == 200

    response = client.post(
        f"/api/donations/{donation_id}/status",
        json={"status": "VOLUNTEER_ASSIGNED"},
        headers=auth(second),
    )
    assert response.status_code == 409


# ─── Expiry & metrics ────────────────────────────────────────────────────────

def test_metrics_report_time_to_claim(client, db_session, recipients):
    donation_id, donor, ngo = _accepted_donation(client, db_session, recipients)
    metrics = client.get("/api/metrics", headers=auth(ngo)).json()

    assert metrics["totalDonations"] == 1
    # Accepted moments after posting, so the median is a small non-negative
    # number derived from real stored timestamps.
    assert metrics["medianTimeToClaimMinutes"] is not None
    assert metrics["medianTimeToClaimMinutes"] >= 0


def test_requirements_round_trip(client, db_session, recipients):
    ngo, _ = register_ngo(client, db_session, email="req-ngo@test.com", org="Helping Hands")

    created = client.post(
        "/api/requirements",
        json={
            "foodType": "Hot vegetarian meals",
            "quantityNeeded": 120,
            "beneficiaryCount": 140,
            "urgency": "High",
            "dailyRecurring": True,
            "notes": "Before 7 PM.",
        },
        headers=auth(ngo),
    )
    assert created.status_code == 201, created.text
    assert created.json()["recipientName"] == "Helping Hands"

    listed = client.get("/api/requirements", headers=auth(ngo)).json()
    assert len(listed) == 1
