"""One donation, one organisation, one number.

Manual QA found the same donation reading 94% on the NGO's *Available
Donations* list and 64% in the analysis panel beside it. Both surfaces say
"match", so a kitchen reads them as the same claim about the same pairing —
and they were not. The list showed `Donation.match_score`, the score of
whichever organisation ranked *first* platform-wide at the moment the donor
posted; the panel scores the pairing the reader is actually part of, now.

These tests pin the distinction the fix draws. `matchScore` stays what it has
always been — a frozen figure about a decision (the top match at posting, the
accepting organisation's own score afterwards). `viewerMatch` is the live
ranking of the donation against the *calling* organisation, from the same
`score_pair` that `/matches` reports, and it carries the whole breakdown so
that the headline and the criteria beside it come from one request rather than
two that would round apart as the deadline decays.

⚠️ **Since D-47 the frozen figure is reader-scoped**, so the tests below that
are *about* it read it through an administrator. Nothing about what the column
stores changed — `Donation.match_score` is still the precise frozen decision
(D-30) — but a reader who may not be told the subject kitchen's position is no
longer shown it, because the weighted sum moves about one point per 320 m. The
assertions that used to read the number off an NGO's or a donor's own response
now read it off an admin's, which is the same number; that the two roles get
`null` there is pinned in `test_donation_privacy_scope.py`.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from conftest import admin_token, auth, register, register_ngo
from foodlink.matching import score_pair
from foodlink.models import Donation, Recipient

#: The donor's kitchen, and the fixture donation posted from it.
CAMPUS = {"latitude": 30.3540, "longitude": 76.3630}

#: Close enough to the campus to win the ranking outright (~2.0 km).
NEAR = {"latitude": 30.3400, "longitude": 76.3800}

#: Inside the 8 km radius but clearly further out (~4.7 km), so it is scored
#: and offered the donation, but is never the top match.
FAR = {"latitude": 30.3900, "longitude": 76.3400}


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
def two_kitchens(client, db_session):
    """A near kitchen that wins the ranking, and a further one that reads the list."""
    near_token, near_id = register_ngo(
        client, db_session, email="near@test.com", org="Helping Hands",
        capacity=150, **NEAR,
    )
    far_token, far_id = register_ngo(
        client, db_session, email="far@test.com", org="Umeed Shelter",
        capacity=80, **FAR,
    )
    return {"near": (near_token, near_id), "far": (far_token, far_id)}


def _post_donation(client, **kwargs) -> int:
    donor = register(client, email="donor@test.com", role="donor", org="Central Mess")
    response = client.post(
        "/api/donations", json=make_donation_body(**kwargs), headers=auth(donor)
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _listed(client, token: str, donation_id: int) -> dict:
    """The donation as the NGO's list screen receives it."""
    response = client.get("/api/donations", headers=auth(token))
    assert response.status_code == 200, response.text
    row = next((d for d in response.json() if d["id"] == donation_id), None)
    assert row is not None, "the open pool should contain this donation"
    return row


def _frozen_score(client, db_session, donation_id: int) -> int | None:
    """`Donation.match_score` as a reader entitled to it receives it.

    An administrator, because D-47 scopes the field to readers who may be told
    the subject kitchen's true position and an administrator already reads the
    recipient directory in full. This is the stored figure, unmodified — the
    scope decides who sees it, not what it is.
    """
    response = client.get(
        f"/api/donations/{donation_id}", headers=auth(admin_token(client, db_session))
    )
    assert response.status_code == 200, response.text
    return response.json()["matchScore"]


def _own_match(client, token: str, donation_id: int, recipient_id: int) -> dict:
    """The pairing as the analysis panel receives it."""
    response = client.get(
        f"/api/donations/{donation_id}/matches?limit=25", headers=auth(token)
    )
    assert response.status_code == 200, response.text
    mine = next((m for m in response.json() if m["recipientId"] == recipient_id), None)
    assert mine is not None, "the reader's own organisation should be ranked"
    return mine


# ─── The reported failure ────────────────────────────────────────────────────

def test_the_list_and_the_analysis_agree_for_the_reading_organisation(client, two_kitchens):
    """The bug as QA hit it: one donation, one kitchen, two different numbers."""
    far_token, far_id = two_kitchens["far"]
    donation_id = _post_donation(client)

    listed = _listed(client, far_token, donation_id)
    analysed = _own_match(client, far_token, donation_id, far_id)

    assert listed["viewerMatch"]["overallScore"] == analysed["overallScore"]
    assert listed["viewerMatch"]["recipientId"] == far_id


def test_the_headline_and_its_breakdown_travel_together(client, two_kitchens):
    """One request, one object: a screen cannot show a total from one moment
    beside criteria from another, and the weighted sum reconciles by hand."""
    far_token, _ = two_kitchens["far"]
    donation_id = _post_donation(client)

    match = _listed(client, far_token, donation_id)["viewerMatch"]
    weighted = (
        match["distanceScore"] * 0.25
        + match["quantityScore"] * 0.25
        + match["capacityScore"] * 0.20
        + match["deadlineScore"] * 0.15
        + match["reliabilityScore"] * 0.15
    )
    assert match["overallScore"] == round(weighted)
    assert match["reasons"]


def test_the_frozen_score_is_not_the_readers_own_score(client, db_session, two_kitchens):
    """Why the two disagreed: `matchScore` is about a different organisation.

    That is not a defect to remove — it is the number that recorded the
    decision. It is a defect to *label* as the reader's own match, which is
    what the list did.

    The frozen figure is read through an administrator because since D-47 an
    organisation is not shown a score about a *peer's* position. That scope is
    the subject of `test_donation_privacy_scope.py`; what this test is about is
    the one thing it does not change — the two numbers describe different
    organisations and cannot be substituted for one another.
    """
    far_token, far_id = two_kitchens["far"]
    near_token, near_id = two_kitchens["near"]
    donation_id = _post_donation(client)

    listed = _listed(client, far_token, donation_id)
    near_listed = _listed(client, near_token, donation_id)

    # One frozen number, describing the winner, and the same one whichever
    # reader is entitled to it.
    frozen = _frozen_score(client, db_session, donation_id)
    assert frozen == _own_match(client, near_token, donation_id, near_id)["overallScore"]

    # Each reader's own score differs, and the further kitchen's is lower.
    assert near_listed["viewerMatch"]["overallScore"] > listed["viewerMatch"]["overallScore"]
    assert listed["viewerMatch"]["overallScore"] != frozen

    # Neither organisation is told the frozen figure about the other: the
    # donation is still open, so nothing binds it to a kitchen either of them
    # may be told a position for (D-47).
    assert listed["matchScore"] is None
    assert near_listed["matchScore"] is None


def test_the_top_match_sees_the_same_number_on_both_surfaces_too(
    client, db_session, two_kitchens
):
    """The winner is the one organisation whose own score *is* the frozen one.

    Which stays true after D-47 — the scope changed who is shown the frozen
    figure, not what it equals. The winner reads its own live score from
    `viewerMatch` exactly as before, and it still reconciles with the number
    frozen at posting.
    """
    near_token, near_id = two_kitchens["near"]
    donation_id = _post_donation(client)

    listed = _listed(client, near_token, donation_id)
    assert listed["viewerMatch"]["overallScore"] == _own_match(
        client, near_token, donation_id, near_id
    )["overallScore"]
    assert listed["viewerMatch"]["overallScore"] == _frozen_score(
        client, db_session, donation_id
    )


def test_a_frozen_score_cannot_track_the_deadline_it_scored(client):
    """The other half of the divergence: the same pairing scores lower later.

    `deadline` is 15% of the weighted sum and decays to zero as the pickup
    window closes, so a figure written when the donation was posted describes a
    pairing that no longer exists a few hours on. That is exactly why the list
    has to ask for the score rather than read a stored one — nothing about the
    stored value is wrong, it is simply about an earlier moment.
    """
    posted = datetime.now(timezone.utc)
    donation = Donation(
        food_name="Vegetarian Thali Meals", category="Vegetarian", quantity=50,
        unit="Meals", storage_type="Room Temperature", description="Surplus.",
        location="College Central Mess", pickup_deadline=posted + timedelta(hours=6),
        **CAMPUS,
    )
    kitchen = Recipient(
        name="Umeed Shelter", type="Night Shelter", location="Urban Estate",
        capacity=80, is_verified=True, accepted_donations=22, completed_donations=21,
        **FAR,
    )

    at_posting = score_pair(donation, kitchen, radius_km=8, now=posted)
    near_deadline = score_pair(
        donation, kitchen, radius_km=8, now=posted + timedelta(hours=5, minutes=55)
    )

    assert at_posting is not None and near_deadline is not None
    assert near_deadline.deadline_score == 0
    assert near_deadline.overall_score < at_posting.overall_score


# ─── What the field means, and where it is absent ────────────────────────────

def test_the_viewer_score_is_absent_for_a_caller_with_no_organisation(
    client, db_session, two_kitchens
):
    """A donor has no kitchen, so there is no pairing to score."""
    donor = register(client, email="lone-donor@test.com", role="donor")
    response = client.post(
        "/api/donations", json=make_donation_body(), headers=auth(donor)
    )
    assert response.status_code == 201, response.text
    assert response.json()["viewerMatch"] is None

    listed = _listed(client, donor, response.json()["id"])
    assert listed["viewerMatch"] is None
    # And neither is the frozen one, for a different reason: the donor chose
    # this donation's pin, so the score of whichever kitchen ranked first is a
    # measurement of that kitchen (D-47). It was still written — an
    # administrator reads it back.
    assert listed["matchScore"] is None
    assert _frozen_score(client, db_session, response.json()["id"]) is not None


def test_an_unverified_kitchen_gets_no_score_rather_than_a_low_one(client, db_session):
    """Ineligibility is a gate, not a number — the same rule `/matches` applies.

    ⚠️ Corrected by Task 37 (P1-1a). This used to read the kitchen's (absent)
    score *through* the open pool, which asserted that an unverified kitchen may
    read that pool — the privacy defect itself. It may not any more, so the gate
    is checked where the kitchen is still visible — the ranking an administrator
    reads — and the refusal of the pool is checked directly.
    """
    token, recipient_id = register_ngo(
        client, db_session, email="unverified@test.com", org="Awaiting Trust",
        verified=False, **NEAR,
    )
    donation_id = _post_donation(client)

    listed = client.get("/api/donations", headers=auth(token))
    assert donation_id not in {d["id"] for d in listed.json()}
    assert client.get(
        f"/api/donations/{donation_id}/matches", headers=auth(token)
    ).status_code == 404

    ranked = client.get(
        f"/api/donations/{donation_id}/matches",
        headers=auth(admin_token(client, db_session)),
    ).json()
    assert recipient_id not in {m["recipientId"] for m in ranked}


def test_a_kitchen_outside_the_radius_gets_no_score(client, db_session):
    """~95 km out: beyond `MAX_MATCH_RADIUS_KM`, so it is not ranked at all."""
    token, _ = register_ngo(
        client, db_session, email="faraway@test.com", org="Faraway Trust",
        latitude=31.2000, longitude=77.5000,
    )
    donation_id = _post_donation(client)
    assert _listed(client, token, donation_id)["viewerMatch"] is None


def test_the_single_donation_read_carries_the_same_viewer_score_as_the_list(client, two_kitchens):
    """List and detail read through the same scope and must report the same number."""
    far_token, _ = two_kitchens["far"]
    donation_id = _post_donation(client)

    listed = _listed(client, far_token, donation_id)
    detail = client.get(f"/api/donations/{donation_id}", headers=auth(far_token))
    assert detail.status_code == 200, detail.text
    assert detail.json()["viewerMatch"] == listed["viewerMatch"]


# ─── The frozen score keeps its own meaning ──────────────────────────────────

def test_accepting_freezes_the_score_the_decision_was_made_on(client, two_kitchens):
    """The number the list showed the accepting kitchen is the number kept."""
    far_token, far_id = two_kitchens["far"]
    donation_id = _post_donation(client)

    offered = _listed(client, far_token, donation_id)["viewerMatch"]["overallScore"]

    response = client.post(
        f"/api/donations/{donation_id}/status",
        json={"status": "ACCEPTED", "recipientId": far_id},
        headers=auth(far_token),
    )
    assert response.status_code == 200, response.text
    body = response.json()

    # `matchScore` is re-frozen against the organisation that actually took it,
    # and lands on the figure that organisation was offered.
    assert body["matchScore"] == offered
    # The live figure retires with the decision: nothing is on offer any more.
    assert body["viewerMatch"] is None


def test_a_settled_donation_reports_no_viewer_score(client, two_kitchens):
    """Once a kitchen owns a donation the deadline decays, so a live score would
    drift away from the one it accepted on. Only the frozen number remains."""
    far_token, far_id = two_kitchens["far"]
    donation_id = _post_donation(client)
    client.post(
        f"/api/donations/{donation_id}/status",
        json={"status": "ACCEPTED", "recipientId": far_id},
        headers=auth(far_token),
    )

    detail = client.get(
        f"/api/donations/{donation_id}", headers=auth(far_token)
    ).json()
    assert detail["viewerMatch"] is None
    assert detail["matchScore"] is not None
