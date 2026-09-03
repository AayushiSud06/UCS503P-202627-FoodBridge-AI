"""Who may *drive* a donation, once it belongs to somebody.

`test_donation_reads.py` covers who may see a donation; `test_courier_claim.py`
covers the moment a pickup is taken. These cover the transitions after that
point — the ones that act on a donation already bound to a courier and to an
organisation.

Holding the right role is not enough for those. Every volunteer account has the
role that may set `PICKED_UP`, but only the courier carrying *this* delivery may
set it on *this* donation; every kitchen has the role that may set `COMPLETED`,
but only the one that accepted it may confirm receipt; every donor has the role
that may `CANCELLED`, but only the one who posted it may withdraw it. An actor
outside that boundary is answered the way a read would answer them — 404, not
403, so the refusal does not confirm the donation exists.

Cancellation is in this file rather than beside the donor tests because it is the
same rule and the same mechanism: `donations.OWNED_TRANSITIONS` and the read
scope, not a check written out per transition.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from conftest import admin_token, auth, register, register_ngo
from foodlink.models import Donation, DonationStatus

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


def state_of(db_session, donation_id: int) -> DonationStatus:
    """The donation as the database now holds it, not as a response described it."""
    donation = db_session.get(Donation, donation_id)
    db_session.refresh(donation)
    return donation.status


@pytest.fixture
def assigned(client, db_session):
    """A pickup one kitchen accepted and one courier claimed, plus the outsiders.

    Returns the donation id and the four tokens the tests need: the courier who
    holds the delivery, an unrelated courier, the kitchen that accepted it, and
    an unrelated kitchen. Both outsiders are ordinary, fully registered,
    verified accounts — what disqualifies them is only that this donation is
    not theirs.
    """
    donor = register(client, email="own-donor@test.com", role="donor")
    kitchen, _ = register_ngo(
        client, db_session, email="own-ngo@test.com", org="Helping Hands"
    )
    stranger_kitchen, _ = register_ngo(
        client, db_session, email="other-ngo@test.com", org="Umeed Shelter"
    )
    courier = register(client, email="own-courier@test.com", role="volunteer")
    stranger_courier = register(client, email="other-courier@test.com", role="volunteer")

    donation_id = client.post(
        "/api/donations", json=donation_body(), headers=auth(donor)
    ).json()["id"]

    assert advance(client, kitchen, donation_id, "ACCEPTED").status_code == 200
    assert advance(client, courier, donation_id, "VOLUNTEER_ASSIGNED").status_code == 200

    return {
        "id": donation_id,
        "donor": donor,
        "courier": courier,
        "stranger_courier": stranger_courier,
        "kitchen": kitchen,
        "stranger_kitchen": stranger_kitchen,
    }


# ─── PICKED_UP belongs to the assigned courier ───────────────────────────────

def test_an_unassigned_courier_cannot_collect_another_couriers_pickup(
    client, db_session, assigned
):
    response = advance(client, assigned["stranger_courier"], assigned["id"], "PICKED_UP")

    assert response.status_code == 404
    # And nothing moved: the refusal is the write not happening, not a message
    # about a write that happened anyway.
    assert state_of(db_session, assigned["id"]) is DonationStatus.VOLUNTEER_ASSIGNED


def test_the_assigned_courier_collects_their_own_pickup(client, db_session, assigned):
    response = advance(client, assigned["courier"], assigned["id"], "PICKED_UP")

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "PICKED_UP"


# ─── DELIVERED belongs to the assigned courier ───────────────────────────────

def test_an_unassigned_courier_cannot_deliver_another_couriers_pickup(
    client, db_session, assigned
):
    assert advance(client, assigned["courier"], assigned["id"], "PICKED_UP").status_code == 200

    response = advance(client, assigned["stranger_courier"], assigned["id"], "DELIVERED")

    assert response.status_code == 404
    assert state_of(db_session, assigned["id"]) is DonationStatus.PICKED_UP


def test_the_assigned_courier_delivers_their_own_pickup(client, db_session, assigned):
    assert advance(client, assigned["courier"], assigned["id"], "PICKED_UP").status_code == 200

    response = advance(client, assigned["courier"], assigned["id"], "DELIVERED")

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "DELIVERED"


# ─── COMPLETED belongs to the accepting organisation ─────────────────────────

def _deliver(client, assigned) -> None:
    for step in ("PICKED_UP", "DELIVERED"):
        assert advance(client, assigned["courier"], assigned["id"], step).status_code == 200


def test_an_unrelated_organisation_cannot_complete_another_kitchens_donation(
    client, db_session, assigned
):
    _deliver(client, assigned)

    response = advance(client, assigned["stranger_kitchen"], assigned["id"], "COMPLETED")

    assert response.status_code == 404
    assert state_of(db_session, assigned["id"]) is DonationStatus.DELIVERED


def test_the_accepting_organisation_completes_its_own_donation(
    client, db_session, assigned
):
    _deliver(client, assigned)

    response = advance(client, assigned["kitchen"], assigned["id"], "COMPLETED")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "COMPLETED"
    assert [e["toStatus"] for e in body["events"]][-1] == "COMPLETED"


# ─── The administrator's stand-in path is not narrowed by any of this ────────

def test_an_administrator_may_still_drive_a_delivery_they_are_not_party_to(
    client, db_session, assigned
):
    """Ownership scoping must not cost support staff their stand-in role."""
    root = admin_token(client, db_session)

    for step in ("PICKED_UP", "DELIVERED", "COMPLETED"):
        response = advance(client, root, assigned["id"], step)
        assert response.status_code == 200, response.text

    assert state_of(db_session, assigned["id"]) is DonationStatus.COMPLETED


# ─── CANCELLED belongs to the donor who posted it ───────────────────────────

@pytest.fixture
def two_donors(client):
    """Two donors, one donation each — the minimal cross-tenant cancel case."""
    owner = register(client, email="cancel-owner@test.com", role="donor")
    stranger = register(client, email="cancel-stranger@test.com", role="donor")
    donation_id = client.post(
        "/api/donations", json=donation_body(), headers=auth(owner)
    ).json()["id"]
    return owner, stranger, donation_id


def test_a_donor_cannot_cancel_another_donors_donation(client, db_session, two_donors):
    _, stranger, donation_id = two_donors

    response = advance(client, stranger, donation_id, "CANCELLED")

    assert response.status_code == 404
    assert state_of(db_session, donation_id) is not DonationStatus.CANCELLED


def test_the_owning_donor_cancels_their_own_donation(client, db_session, two_donors):
    owner, _, donation_id = two_donors

    response = advance(client, owner, donation_id, "CANCELLED")

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "CANCELLED"
    assert state_of(db_session, donation_id) is DonationStatus.CANCELLED


def test_a_donor_who_cannot_read_a_donation_cannot_cancel_it_either(
    client, two_donors
):
    """The write answers what the read answers — one scope, not two."""
    _, stranger, donation_id = two_donors

    read = client.get(f"/api/donations/{donation_id}", headers=auth(stranger))
    cancelled = advance(client, stranger, donation_id, "CANCELLED")

    assert read.status_code == 404
    assert cancelled.status_code == read.status_code


def test_the_owning_donor_may_still_cancel_once_the_donation_is_under_way(
    client, db_session, assigned
):
    """Withdrawal is not narrowed to the states before somebody took it."""
    response = advance(client, assigned["donor"], assigned["id"], "CANCELLED")

    assert response.status_code == 200, response.text
    assert state_of(db_session, assigned["id"]) is DonationStatus.CANCELLED


def test_an_administrator_may_still_cancel_a_donation_they_did_not_post(
    client, db_session, two_donors
):
    _, _, donation_id = two_donors

    response = advance(client, admin_token(client, db_session), donation_id, "CANCELLED")

    assert response.status_code == 200, response.text
    assert state_of(db_session, donation_id) is DonationStatus.CANCELLED


def test_a_role_that_may_not_cancel_is_still_refused_on_its_role(client, db_session):
    """The role gate runs first and its answer is unchanged: 403, not 404.

    A kitchen can read the open pool, so the donation is not hidden from it —
    what stops it is `TRANSITION_ROLES`.
    """
    donor = register(client, email="rolecancel-donor@test.com", role="donor")
    kitchen, _ = register_ngo(
        client, db_session, email="rolecancel-ngo@test.com", org="Rolegate Kitchen"
    )
    donation_id = client.post(
        "/api/donations", json=donation_body(), headers=auth(donor)
    ).json()["id"]

    assert client.get(
        f"/api/donations/{donation_id}", headers=auth(kitchen)
    ).status_code == 200

    response = advance(client, kitchen, donation_id, "CANCELLED")

    assert response.status_code == 403
    assert state_of(db_session, donation_id) is not DonationStatus.CANCELLED


def test_cancelling_a_completed_donation_is_still_a_conflict(
    client, db_session, assigned
):
    """The transition table still runs before the scope, for the owner too."""
    _deliver(client, assigned)
    assert advance(client, assigned["kitchen"], assigned["id"], "COMPLETED").status_code == 200

    response = advance(client, assigned["donor"], assigned["id"], "CANCELLED")

    assert response.status_code == 409
    assert state_of(db_session, assigned["id"]) is DonationStatus.COMPLETED
