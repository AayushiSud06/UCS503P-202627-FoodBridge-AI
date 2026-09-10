"""A courier's own runs, from the claim to the kitchen's confirmation.

`test_donation_reads.py` covers a courier's read scope up to the moment a pickup
is claimed. Nothing covered what happens *after* the courier's last action, which
is where the delivery-history defect lived: the courier marks a run `DELIVERED`
and then has to be able to see it, because that is the furthest state they can
drive. `COMPLETED` is the **kitchen's** confirmation of receipt
(`TRANSITION_ROLES[COMPLETED] == {ngo, admin}`), so between the two the run
belongs to nobody's active list and must still belong to the courier's history.

These pin the API contract the Volunteer History screen reads. The backend was
already correct — `_readable_by`'s volunteer clause is
`ACCEPTED AND volunteer_id IS NULL` **or** `volunteer_id == mine`, with no status
term on the second half — and that is exactly the property worth holding, since
the screen has no other source and a status term added here later would break it
silently.
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


def advance(client, token: str, donation_id: int, target: str):
    return client.post(
        f"/api/donations/{donation_id}/status",
        json={"status": target},
        headers=auth(token),
    )


def listed(client, token: str) -> dict[int, str]:
    """The caller's donation list as `{id: status}` — what a portal screen filters."""
    response = client.get("/api/donations", headers=auth(token))
    assert response.status_code == 200, response.text
    return {d["id"]: d["status"] for d in response.json()}


def read(client, token: str, donation_id: int):
    return client.get(f"/api/donations/{donation_id}", headers=auth(token))


@pytest.fixture
def run(client, db_session):
    """A donation accepted by a kitchen and claimed by a courier.

    Returns `(donation_id, courier_token, ngo_token, donor_token)` — the state a
    courier's run starts from, one step short of collection.
    """
    donor = register(client, email="hist-donor@test.com", role="donor", org="Mess")
    ngo, _ = register_ngo(client, db_session, email="hist-ngo@test.com", org="Helping Hands")
    donation_id = client.post(
        "/api/donations", json=donation_body(), headers=auth(donor)
    ).json()["id"]

    assert advance(client, ngo, donation_id, "ACCEPTED").status_code == 200

    courier = register(client, email="hist-courier@test.com", role="volunteer")
    assert advance(client, courier, donation_id, "VOLUNTEER_ASSIGNED").status_code == 200

    return donation_id, courier, ngo, donor


# --- The courier's own run, stage by stage -----------------------------------

def test_a_courier_reads_its_run_at_every_stage_up_to_delivery(client, run):
    """The pre-completion states, then the one the courier's last action produces."""
    donation_id, courier, _, _ = run

    assert listed(client, courier)[donation_id] == "VOLUNTEER_ASSIGNED"

    assert advance(client, courier, donation_id, "PICKED_UP").status_code == 200
    assert listed(client, courier)[donation_id] == "PICKED_UP"

    response = advance(client, courier, donation_id, "DELIVERED")
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "DELIVERED"

    # The run the courier has just finished. It is in no active state any more,
    # and this is the only place the history screen can read it from.
    assert listed(client, courier)[donation_id] == "DELIVERED"
    assert read(client, courier, donation_id).status_code == 200


def test_delivered_is_as_far_as_a_courier_can_take_a_run(client, run):
    """Why history has to include `DELIVERED`: the courier cannot reach `COMPLETED`.

    Receipt is the kitchen's to confirm. If this ever changes, the history filter
    has to be revisited with it.
    """
    donation_id, courier, _, _ = run
    assert advance(client, courier, donation_id, "PICKED_UP").status_code == 200
    assert advance(client, courier, donation_id, "DELIVERED").status_code == 200

    response = advance(client, courier, donation_id, "COMPLETED")
    assert response.status_code == 403, response.text
    assert listed(client, courier)[donation_id] == "DELIVERED"


def test_a_courier_keeps_reading_the_run_after_the_kitchen_confirms_receipt(client, run):
    donation_id, courier, ngo, _ = run
    assert advance(client, courier, donation_id, "PICKED_UP").status_code == 200
    assert advance(client, courier, donation_id, "DELIVERED").status_code == 200
    assert advance(client, ngo, donation_id, "COMPLETED").status_code == 200

    assert listed(client, courier)[donation_id] == "COMPLETED"
    # And the run is still attributed to the courier who made it.
    assert read(client, courier, donation_id).json()["volunteerName"] is not None


def test_an_earlier_run_stays_in_the_couriers_history_beside_a_new_one(client, run, db_session):
    """History accumulates: a confirmed run and a just-delivered one, together."""
    donation_id, courier, ngo, donor = run
    assert advance(client, courier, donation_id, "PICKED_UP").status_code == 200
    assert advance(client, courier, donation_id, "DELIVERED").status_code == 200
    assert advance(client, ngo, donation_id, "COMPLETED").status_code == 200

    second = client.post(
        "/api/donations", json=donation_body(), headers=auth(donor)
    ).json()["id"]
    assert advance(client, ngo, second, "ACCEPTED").status_code == 200
    assert advance(client, courier, second, "VOLUNTEER_ASSIGNED").status_code == 200
    assert advance(client, courier, second, "PICKED_UP").status_code == 200
    assert advance(client, courier, second, "DELIVERED").status_code == 200

    mine = listed(client, courier)
    assert mine[donation_id] == "COMPLETED"
    assert mine[second] == "DELIVERED"


# --- Somebody else's run ------------------------------------------------------

def test_another_courier_never_sees_the_delivered_run(client, run):
    donation_id, courier, ngo, _ = run
    other = register(client, email="other-courier@test.com", role="volunteer")

    assert advance(client, courier, donation_id, "PICKED_UP").status_code == 200
    assert advance(client, courier, donation_id, "DELIVERED").status_code == 200

    assert donation_id not in listed(client, other)
    assert read(client, other, donation_id).status_code == 404

    # Nor once the kitchen confirms it — the association does not lapse.
    assert advance(client, ngo, donation_id, "COMPLETED").status_code == 200
    assert donation_id not in listed(client, other)
    assert read(client, other, donation_id).status_code == 404


def test_a_delivered_run_is_not_offered_back_to_the_unclaimed_pool(client, run):
    """A courier's claimable pool is unclaimed `ACCEPTED` only, and stays that way."""
    donation_id, courier, _, _ = run
    other = register(client, email="pool-courier@test.com", role="volunteer")

    assert advance(client, courier, donation_id, "PICKED_UP").status_code == 200
    assert advance(client, courier, donation_id, "DELIVERED").status_code == 200

    assert listed(client, other) == {}


# --- Everybody else's authorization is unchanged ------------------------------

def test_the_donor_the_kitchen_and_the_administrator_still_read_the_run(
    client, db_session, run
):
    donation_id, courier, ngo, donor = run
    assert advance(client, courier, donation_id, "PICKED_UP").status_code == 200
    assert advance(client, courier, donation_id, "DELIVERED").status_code == 200
    root = admin_token(client, db_session)

    assert listed(client, donor)[donation_id] == "DELIVERED"
    assert listed(client, ngo)[donation_id] == "DELIVERED"
    assert listed(client, root)[donation_id] == "DELIVERED"


def test_a_courier_still_cannot_drive_another_couriers_run(client, run):
    """The ownership rule on `OWNED_TRANSITIONS` is untouched by any of this."""
    donation_id, courier, _, _ = run
    other = register(client, email="meddling-courier@test.com", role="volunteer")

    assert advance(client, courier, donation_id, "PICKED_UP").status_code == 200
    # 404 rather than 403: the refusal does not confirm the donation exists.
    assert advance(client, other, donation_id, "DELIVERED").status_code == 404
    assert advance(client, courier, donation_id, "DELIVERED").status_code == 200
