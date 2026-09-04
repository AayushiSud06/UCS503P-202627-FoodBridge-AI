"""Releasing a pickup, and what has to come off the donation when it happens.

`VOLUNTEER_ASSIGNED -> ACCEPTED` is the release: a claimed pickup goes back to
the pool for another courier to take. `test_lifecycle_authorization.py` covers
*who* may drive that edge; these cover what the edge actually does, which is the
half an authorization audit cannot see.

Two things were wrong and both are here. `volunteer_id` was never cleared, so a
"released" donation stayed invisible to every other courier — `_readable_by`
gives a volunteer `ACCEPTED AND volunteer_id IS NULL` — and unclaimable by them,
since `_claim_pickup`'s condition admits only a null holder or the caller. And
the acceptance side effect ran a second time, so `Recipient.accepted_donations`
counted one donation twice; because that is the denominator of
`reliability_score`, a kitchen's own match score fell as a penalty for releasing
a courier.

⚠️ The release is driven by the **accepting kitchen**, not by the courier:
`TRANSITION_ROLES[ACCEPTED]` is `{ngo, admin}`. Nothing here changes that.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from conftest import admin_token, auth, register, register_ngo
from foodlink.models import Donation, DonationStatus, Recipient

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


def advance(client, token: str, donation_id: int, target: str):
    return client.post(
        f"/api/donations/{donation_id}/status",
        json={"status": target},
        headers=auth(token),
    )


def row(db_session, donation_id: int) -> Donation:
    """The donation as the database now holds it, not as a response described it."""
    donation = db_session.get(Donation, donation_id)
    db_session.refresh(donation)
    return donation


def accepted_count(db_session, recipient_id: int) -> int:
    recipient = db_session.get(Recipient, recipient_id)
    db_session.refresh(recipient)
    return recipient.accepted_donations


def visible_ids(client, token: str) -> set[int]:
    response = client.get("/api/donations", headers=auth(token))
    assert response.status_code == 200, response.text
    return {d["id"] for d in response.json()}


@pytest.fixture
def claimed(client, db_session):
    """A donation accepted by one kitchen and claimed by courier A.

    Courier B is a second, fully registered courier who has nothing to do with
    it yet — the account that has to be able to pick the release up.
    """
    donor = register(client, email="donor@example.com", role="donor")
    ngo_token, recipient_id = register_ngo(
        client, db_session, email="kitchen@example.com", org="Helping Hands"
    )
    courier_a = register(
        client, email="a@example.com", role="volunteer", name="Courier A"
    )
    courier_b = register(
        client, email="b@example.com", role="volunteer", name="Courier B"
    )

    created = client.post("/api/donations", json=donation_body(), headers=auth(donor))
    assert created.status_code == 201, created.text
    donation_id = created.json()["id"]

    assert advance(client, ngo_token, donation_id, "ACCEPTED").status_code == 200
    assert advance(client, courier_a, donation_id, "VOLUNTEER_ASSIGNED").status_code == 200

    return {
        "id": donation_id,
        "recipient_id": recipient_id,
        "donor": donor,
        "ngo": ngo_token,
        "a": courier_a,
        "b": courier_b,
    }


def test_releasing_a_pickup_clears_the_courier_assignment(claimed, client, db_session):
    assert row(db_session, claimed["id"]).volunteer_id is not None

    response = advance(client, claimed["ngo"], claimed["id"], "ACCEPTED")

    assert response.status_code == 200, response.text
    released = row(db_session, claimed["id"])
    assert released.status is DonationStatus.ACCEPTED
    assert released.volunteer_id is None
    # The response describes the same row, so the client is not told otherwise.
    assert response.json()["volunteerId"] is None
    assert response.json()["volunteerName"] is None


def test_a_released_pickup_becomes_visible_to_another_courier(claimed, client):
    assert claimed["id"] not in visible_ids(client, claimed["b"])

    assert advance(client, claimed["ngo"], claimed["id"], "ACCEPTED").status_code == 200

    assert claimed["id"] in visible_ids(client, claimed["b"])


def test_another_courier_can_claim_a_released_pickup(claimed, client, db_session):
    """The whole point of the release, and previously a 409 that was not true."""
    assert advance(client, claimed["ngo"], claimed["id"], "ACCEPTED").status_code == 200

    response = advance(client, claimed["b"], claimed["id"], "VOLUNTEER_ASSIGNED")

    assert response.status_code == 200, response.text
    taken = row(db_session, claimed["id"])
    assert taken.status is DonationStatus.VOLUNTEER_ASSIGNED
    assert taken.volunteer_id is not None
    assert response.json()["volunteerName"] == "Courier B"


def test_the_original_courier_may_still_take_it_back(claimed, client, db_session):
    """Readmission is preserved — the release returns it to the pool, not to a list."""
    assert advance(client, claimed["ngo"], claimed["id"], "ACCEPTED").status_code == 200

    response = advance(client, claimed["a"], claimed["id"], "VOLUNTEER_ASSIGNED")

    assert response.status_code == 200, response.text
    assert response.json()["volunteerName"] == "Courier A"


def test_a_release_does_not_count_as_a_second_acceptance(claimed, client, db_session):
    """`accepted_donations` is the denominator of `reliability_score` (15% of the score)."""
    before = accepted_count(db_session, claimed["recipient_id"])
    assert before == 1

    assert advance(client, claimed["ngo"], claimed["id"], "ACCEPTED").status_code == 200

    assert accepted_count(db_session, claimed["recipient_id"]) == before


def test_repeated_releases_never_inflate_the_counter(claimed, client, db_session):
    """Release, re-claim, release again — one donation is one acceptance."""
    for _ in range(3):
        assert advance(client, claimed["ngo"], claimed["id"], "ACCEPTED").status_code == 200
        assert advance(client, claimed["b"], claimed["id"], "VOLUNTEER_ASSIGNED").status_code == 200

    assert accepted_count(db_session, claimed["recipient_id"]) == 1


def test_the_kitchens_reliability_score_survives_a_release(claimed, client, db_session):
    """The user-visible consequence: releasing a courier must not cost the kitchen.

    Below three acceptances `reliability_score` is the cold-start prior, so this
    asserts the counter that decides when that prior is left behind.
    """
    assert advance(client, claimed["ngo"], claimed["id"], "ACCEPTED").status_code == 200

    recipient = db_session.get(Recipient, claimed["recipient_id"])
    db_session.refresh(recipient)
    assert recipient.accepted_donations == 1
    assert recipient.completed_donations == 0
    assert recipient.reliability_score == 85


def test_an_ordinary_first_acceptance_still_counts(client, db_session):
    """The preserved half: binding a donation from the open pool is an acceptance."""
    donor = register(client, email="donor2@example.com", role="donor")
    ngo_token, recipient_id = register_ngo(
        client, db_session, email="kitchen2@example.com", org="Umeed Shelter"
    )
    donation_id = client.post(
        "/api/donations", json=donation_body(), headers=auth(donor)
    ).json()["id"]

    assert accepted_count(db_session, recipient_id) == 0
    assert advance(client, ngo_token, donation_id, "ACCEPTED").status_code == 200
    assert accepted_count(db_session, recipient_id) == 1


def test_a_first_acceptance_still_freezes_the_match_score(client, db_session):
    """D-30's frozen number is still written when the decision is actually made."""
    donor = register(client, email="donor3@example.com", role="donor")
    ngo_token, _ = register_ngo(
        client, db_session, email="kitchen3@example.com", org="Seva Kitchen"
    )
    donation_id = client.post(
        "/api/donations", json=donation_body(), headers=auth(donor)
    ).json()["id"]

    response = advance(client, ngo_token, donation_id, "ACCEPTED")

    assert response.status_code == 200, response.text
    assert response.json()["matchScore"] is not None


def test_a_release_leaves_the_frozen_match_score_alone(claimed, client, db_session):
    """Re-freezing on release would slide the number the kitchen decided on (D-30)."""
    before = row(db_session, claimed["id"]).match_score

    assert advance(client, claimed["ngo"], claimed["id"], "ACCEPTED").status_code == 200

    assert row(db_session, claimed["id"]).match_score == before


def test_the_release_stays_the_accepting_kitchens_to_drive(claimed, client, db_session):
    """Preserved authorization: D-35's ownership gate is untouched by this change."""
    stranger, _ = register_ngo(
        client, db_session, email="stranger@example.com", org="Other Kitchen"
    )

    response = advance(client, stranger, claimed["id"], "ACCEPTED")

    assert response.status_code == 404, response.text
    still_held = row(db_session, claimed["id"])
    assert still_held.status is DonationStatus.VOLUNTEER_ASSIGNED
    assert still_held.volunteer_id is not None


def test_a_courier_cannot_release_its_own_pickup(claimed, client, db_session):
    """Unchanged, and recorded rather than fixed: `TRANSITION_ROLES` says ngo/admin.

    Whether a courier should be able to hand a pickup back is a product question,
    not part of this fix.
    """
    response = advance(client, claimed["a"], claimed["id"], "ACCEPTED")

    assert response.status_code == 403, response.text
    assert row(db_session, claimed["id"]).volunteer_id is not None


def test_an_administrator_can_release_on_a_kitchens_behalf(claimed, client, db_session):
    """The stand-in path stays unnarrowed."""
    response = client.post(
        f"/api/donations/{claimed['id']}/status",
        json={"status": "ACCEPTED", "recipientId": claimed["recipient_id"]},
        headers=auth(admin_token(client, db_session)),
    )

    assert response.status_code == 200, response.text
    assert row(db_session, claimed["id"]).volunteer_id is None
    assert accepted_count(db_session, claimed["recipient_id"]) == 1
