"""Who may read which donation.

`test_auth_admin.py` covers who may *change* a donation. These cover who may
see one at all — the list must be scoped server-side, and knowing an id must
not be a way around that scoping.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from conftest import admin_token, auth, register, register_ngo

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


def post_donation(client, token: str) -> int:
    response = client.post("/api/donations", json=donation_body(), headers=auth(token))
    assert response.status_code == 201, response.text
    return response.json()["id"]


def listed_ids(client, token: str) -> set[int]:
    response = client.get("/api/donations", headers=auth(token))
    assert response.status_code == 200, response.text
    return {d["id"] for d in response.json()}


def read_status(client, token: str, donation_id: int) -> int:
    return client.get(f"/api/donations/{donation_id}", headers=auth(token)).status_code


@pytest.fixture
def two_donors(client):
    """Two donors with one donation each — the minimal cross-tenant case."""
    first = register(client, email="owner@test.com", role="donor", org="Central Mess")
    second = register(client, email="stranger@test.com", role="donor", org="Other Mess")
    return first, post_donation(client, first), second, post_donation(client, second)


# ─── Donor ───────────────────────────────────────────────────────────────────

def test_a_donor_reads_their_own_donation(client, two_donors):
    donor, own_id, _, _ = two_donors
    assert read_status(client, donor, own_id) == 200
    assert own_id in listed_ids(client, donor)


def test_a_donor_cannot_read_another_donors_donation(client, two_donors):
    donor, _, _, other_id = two_donors
    # 404, not 403: the response must not confirm that the id exists.
    assert read_status(client, donor, other_id) == 404
    assert other_id not in listed_ids(client, donor)


def test_a_donors_list_is_scoped_without_asking_for_mine(client, two_donors):
    """`mine=false` is the default, and used to mean everybody's records."""
    donor, own_id, _, _ = two_donors
    assert listed_ids(client, donor) == {own_id}


# ─── NGO ─────────────────────────────────────────────────────────────────────

def test_an_ngo_sees_the_open_pool(client, db_session):
    donor = register(client, email="pool-donor@test.com", role="donor")
    donation_id = post_donation(client, donor)
    ngo, _ = register_ngo(client, db_session, email="pool-ngo@test.com", org="Helping Hands")

    # Nobody has accepted it, so it is open to every organisation.
    assert read_status(client, ngo, donation_id) == 200
    assert donation_id in listed_ids(client, ngo)


def test_an_ngo_reads_a_donation_it_accepted(client, db_session):
    donor = register(client, email="acc-donor@test.com", role="donor")
    donation_id = post_donation(client, donor)
    ngo, _ = register_ngo(client, db_session, email="acc-ngo@test.com", org="Helping Hands")

    assert client.post(
        f"/api/donations/{donation_id}/status", json={"status": "ACCEPTED"}, headers=auth(ngo)
    ).status_code == 200

    # Out of the open pool now, but still theirs to see.
    assert read_status(client, ngo, donation_id) == 200
    assert donation_id in listed_ids(client, ngo)


def test_an_ngo_cannot_read_a_donation_another_kitchen_accepted(client, db_session):
    donor = register(client, email="rival-donor@test.com", role="donor")
    donation_id = post_donation(client, donor)
    mine, _ = register_ngo(client, db_session, email="mine-ngo@test.com", org="My Kitchen")
    theirs, _ = register_ngo(client, db_session, email="rival-ngo@test.com", org="Rival Kitchen")

    assert client.post(
        f"/api/donations/{donation_id}/status", json={"status": "ACCEPTED"}, headers=auth(theirs)
    ).status_code == 200

    assert read_status(client, mine, donation_id) == 404
    assert donation_id not in listed_ids(client, mine)


# ─── Volunteer ───────────────────────────────────────────────────────────────

def _accepted(client, db_session, suffix: str) -> int:
    donor = register(client, email=f"vol-donor-{suffix}@test.com", role="donor")
    ngo, _ = register_ngo(
        client, db_session, email=f"vol-ngo-{suffix}@test.com", org="Helping Hands"
    )
    donation_id = post_donation(client, donor)
    assert client.post(
        f"/api/donations/{donation_id}/status", json={"status": "ACCEPTED"}, headers=auth(ngo)
    ).status_code == 200
    return donation_id


def test_a_volunteer_sees_a_pickup_waiting_for_a_courier(client, db_session):
    donation_id = _accepted(client, db_session, "open")
    courier = register(client, email="free-courier@test.com", role="volunteer")

    assert read_status(client, courier, donation_id) == 200
    assert donation_id in listed_ids(client, courier)


def test_a_volunteer_keeps_reading_a_pickup_they_claimed(client, db_session):
    donation_id = _accepted(client, db_session, "claim")
    courier = register(client, email="claiming-courier@test.com", role="volunteer")

    assert client.post(
        f"/api/donations/{donation_id}/status",
        json={"status": "VOLUNTEER_ASSIGNED"},
        headers=auth(courier),
    ).status_code == 200

    assert read_status(client, courier, donation_id) == 200
    assert donation_id in listed_ids(client, courier)


def test_a_volunteer_cannot_read_a_pickup_another_courier_claimed(client, db_session):
    donation_id = _accepted(client, db_session, "steal")
    first = register(client, email="first-courier@test.com", role="volunteer")
    second = register(client, email="second-courier@test.com", role="volunteer")

    assert client.post(
        f"/api/donations/{donation_id}/status",
        json={"status": "VOLUNTEER_ASSIGNED"},
        headers=auth(first),
    ).status_code == 200

    assert read_status(client, second, donation_id) == 404
    assert donation_id not in listed_ids(client, second)


def test_a_volunteer_cannot_read_a_donation_nobody_has_accepted(client, db_session):
    """A courier's job starts at acceptance — the open pool is not theirs."""
    donor = register(client, email="unaccepted-donor@test.com", role="donor")
    donation_id = post_donation(client, donor)
    courier = register(client, email="early-courier@test.com", role="volunteer")

    assert read_status(client, courier, donation_id) == 404
    assert donation_id not in listed_ids(client, courier)


# ─── Admin ───────────────────────────────────────────────────────────────────

def test_an_administrator_reads_everything(client, db_session, two_donors):
    _, first_id, _, second_id = two_donors
    root = admin_token(client, db_session)

    assert listed_ids(client, root) >= {first_id, second_id}
    assert read_status(client, root, first_id) == 200
    assert read_status(client, root, second_id) == 200


# ─── The id is not a way round the list ──────────────────────────────────────

def test_reading_by_id_is_scoped_exactly_like_the_list(client, db_session):
    """For every role: what the list withholds, the id lookup withholds too."""
    donor = register(client, email="scope-donor@test.com", role="donor")
    other = register(client, email="scope-other@test.com", role="donor")
    ngo, _ = register_ngo(client, db_session, email="scope-ngo@test.com", org="Helping Hands")
    courier = register(client, email="scope-courier@test.com", role="volunteer")
    root = admin_token(client, db_session)

    open_id = post_donation(client, donor)
    other_id = post_donation(client, other)
    accepted_id = post_donation(client, donor)
    assert client.post(
        f"/api/donations/{accepted_id}/status", json={"status": "ACCEPTED"}, headers=auth(ngo)
    ).status_code == 200

    every_id = {open_id, other_id, accepted_id}
    for token in (donor, other, ngo, courier, root):
        visible = listed_ids(client, token)
        for donation_id in every_id:
            expected = 200 if donation_id in visible else 404
            assert read_status(client, token, donation_id) == expected, (
                f"donation {donation_id} listed={donation_id in visible}"
            )


def test_the_reasoning_behind_an_unreadable_donation_is_withheld_too(client, two_donors):
    """`/matches` describes a donation, so it follows the same read scope."""
    donor, own_id, _, other_id = two_donors
    assert client.get(f"/api/donations/{own_id}/matches", headers=auth(donor)).status_code == 200
    assert client.get(
        f"/api/donations/{other_id}/matches", headers=auth(donor)
    ).status_code == 404
