"""What "available" means once the pickup deadline has passed.

`test_donation_reads.py` covers *who* may read a donation. This covers the other
axis of the same pool: an unclaimed donation whose collection window has closed
is not something an organisation can act on, so it must not be offered as one.

The reason it used to be offered is that availability was defined by status
alone. The expiry sweep that would move such a row to `EXPIRED`
(`POST /api/admin/maintenance/expire`) is **not scheduled** anywhere
(`TASKS.md` -> *Backlog -> E*), so between the deadline and the next manual sweep
the donation kept the `AVAILABLE`/`MATCHED` it had — and a kitchen was invited to
accept food nobody could still lift. `routers/donations._open_to_recipients` now
reads the deadline directly, on the read path and on the acceptance path alike,
so the answer no longer depends on when the sweep last ran.

Two properties are asserted throughout, because the fix is worthless if it costs
either one:

* the pool narrows, and
* **nothing else does.** A donor's own record, an administrator's view, the
  organisation that accepted a donation, a courier's claimable pickup and the
  sweep itself all still reach an overdue donation.

The API refuses to *create* a donation in the past, so every deadline here is
moved backwards directly — which is what the passage of time would do. That is
the same technique `test_auth_admin.py` uses for the sweep.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from conftest import admin_token, auth, register, register_ngo
from foodlink.models import Donation, DonationStatus
from foodlink.routers.donations import _deadline_passed, _open_to_recipients

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


def listed_ids(client, token: str, **params) -> set[int]:
    response = client.get("/api/donations", params=params, headers=auth(token))
    assert response.status_code == 200, response.text
    return {d["id"] for d in response.json()}


def read_status(client, token: str, donation_id: int) -> int:
    return client.get(f"/api/donations/{donation_id}", headers=auth(token)).status_code


def accept(client, token: str, donation_id: int, **body):
    return client.post(
        f"/api/donations/{donation_id}/status",
        json={"status": "ACCEPTED", **body},
        headers=auth(token),
    )


def backdate(db_session, donation_id: int, *, minutes: float = 5) -> datetime:
    """Move a deadline into the past. Returns the deadline it now holds."""
    donation = db_session.get(Donation, donation_id)
    donation.pickup_deadline = datetime.now(timezone.utc) - timedelta(minutes=minutes)
    db_session.commit()
    return donation.pickup_deadline


@pytest.fixture
def kitchen(client, db_session):
    """A verified organisation, near enough to the campus pin to be ranked."""
    token, recipient_id = register_ngo(
        client, db_session, email="deadline-ngo@test.com", org="Helping Hands"
    )
    return token, recipient_id


@pytest.fixture
def donor(client):
    return register(client, email="deadline-donor@test.com", role="donor", org="Mess")


# --- The pool narrows --------------------------------------------------------

def test_a_donation_inside_its_window_is_available_to_a_kitchen(client, donor, kitchen):
    ngo, _ = kitchen
    donation_id = post_donation(client, donor)

    assert donation_id in listed_ids(client, ngo)
    assert read_status(client, ngo, donation_id) == 200


def test_a_donation_past_its_deadline_is_not_available_to_a_kitchen(
    client, db_session, donor, kitchen
):
    ngo, _ = kitchen
    donation_id = post_donation(client, donor)
    assert donation_id in listed_ids(client, ngo)  # it was, a moment ago

    backdate(db_session, donation_id)

    assert donation_id not in listed_ids(client, ngo)
    # And naming the status does not put it back: the deadline is applied in the
    # read scope, not in the optional status filter.
    assert donation_id not in listed_ids(client, ngo, status="AVAILABLE")
    assert donation_id not in listed_ids(client, ngo, status="MATCHED")
    # Knowing the id is not a way round the pool either — 404, the answer a
    # donation the caller may not read has always given.
    assert read_status(client, ngo, donation_id) == 404


def test_the_row_itself_is_untouched_by_the_narrower_pool(
    client, db_session, donor, kitchen
):
    """Nothing is hidden by *changing* the donation. The status stays the sweep's."""
    ngo, _ = kitchen
    donation_id = post_donation(client, donor)
    backdate(db_session, donation_id)

    assert donation_id not in listed_ids(client, ngo)

    db_session.expire_all()
    assert db_session.get(Donation, donation_id).status in {
        DonationStatus.AVAILABLE,
        DonationStatus.MATCHED,
    }


def test_the_deadline_boundary_belongs_to_the_donation(client, db_session, donor):
    """A donation *at* its deadline is still open; strictly past is not.

    The same convention as `routers/admin.expire_overdue`, whose sweep matches
    `pickup_deadline < now`. Asserted as of a stated instant, because the
    boundary is one instant wide and no HTTP request can be aimed at it.
    """
    donation_id = post_donation(client, donor)
    deadline = db_session.get(Donation, donation_id).pickup_deadline

    def open_as_of(now: datetime) -> set[int]:
        return set(
            db_session.scalars(select(Donation.id).where(_open_to_recipients(now)))
        )

    assert donation_id in open_as_of(deadline)
    assert donation_id in open_as_of(deadline - timedelta(seconds=1))
    assert donation_id not in open_as_of(deadline + timedelta(seconds=1))

    # The Python half of the rule, at the finest granularity a datetime has, so
    # the two halves cannot come to rest on opposite sides of the instant.
    assert _deadline_passed(deadline, deadline) is False
    assert _deadline_passed(deadline, deadline + timedelta(microseconds=1)) is True


# --- Nothing else narrows ----------------------------------------------------

def test_a_donor_still_reads_their_own_overdue_donation(client, db_session, donor):
    donation_id = post_donation(client, donor)
    backdate(db_session, donation_id)

    assert donation_id in listed_ids(client, donor)
    assert read_status(client, donor, donation_id) == 200


def test_an_administrator_still_reads_an_overdue_donation_and_can_sweep_it(
    client, db_session, donor
):
    donation_id = post_donation(client, donor)
    backdate(db_session, donation_id)
    root = admin_token(client, db_session)

    assert donation_id in listed_ids(client, root)
    assert read_status(client, root, donation_id) == 200
    # The sweep is what actually retires the row, and it still finds it — the
    # expiry-loss metric is computed from the events it appends.
    assert client.post(
        "/api/admin/maintenance/expire", headers=auth(root)
    ).json() == {"expired": 1}


def test_a_kitchen_still_reads_the_overdue_donation_it_accepted(
    client, db_session, donor, kitchen
):
    """History. The deadline narrows the shared pool, not the kitchen's records."""
    ngo, _ = kitchen
    donation_id = post_donation(client, donor)
    assert accept(client, ngo, donation_id).status_code == 200

    backdate(db_session, donation_id)

    assert donation_id in listed_ids(client, ngo)
    assert donation_id in listed_ids(client, ngo, mine=True)
    assert read_status(client, ngo, donation_id) == 200


def test_a_courier_still_sees_an_overdue_pickup_it_may_claim(
    client, db_session, donor, kitchen
):
    """The courier's scope is a separate clause and was deliberately not touched."""
    ngo, _ = kitchen
    donation_id = post_donation(client, donor)
    assert accept(client, ngo, donation_id).status_code == 200

    backdate(db_session, donation_id)
    courier = register(client, email="deadline-courier@test.com", role="volunteer")

    assert donation_id in listed_ids(client, courier)
    assert read_status(client, courier, donation_id) == 200


# --- The acceptance path -----------------------------------------------------

def test_a_kitchen_can_accept_a_donation_inside_its_window(client, donor, kitchen):
    ngo, _ = kitchen
    donation_id = post_donation(client, donor)

    response = accept(client, ngo, donation_id)
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "ACCEPTED"


def test_a_kitchen_cannot_accept_a_donation_past_its_deadline(
    client, db_session, donor, kitchen
):
    """The list is not the boundary; the endpoint is.

    An organisation holding the id from an earlier page load — or posting the
    transition by hand — used to be able to take a donation the pool no longer
    offers.
    """
    ngo, _ = kitchen
    donation_id = post_donation(client, donor)
    backdate(db_session, donation_id)

    response = accept(client, ngo, donation_id)
    assert response.status_code == 409, response.text
    assert "deadline" in response.json()["detail"].lower()

    db_session.expire_all()
    donation = db_session.get(Donation, donation_id)
    assert donation.status is not DonationStatus.ACCEPTED
    assert donation.recipient_id is None


def test_an_administrator_cannot_accept_a_donation_past_its_deadline(
    client, db_session, donor, kitchen
):
    """The guard is about the donation, not the actor.

    An administrator stands in for an organisation (D-35) and would otherwise
    inherit a window the organisation itself no longer has — and once the sweep
    has run, `ALLOWED_TRANSITIONS` refuses this to everybody. This makes the two
    agree before it runs.
    """
    _, recipient_id = kitchen
    donation_id = post_donation(client, donor)
    backdate(db_session, donation_id)
    root = admin_token(client, db_session)

    response = accept(client, root, donation_id, recipientId=recipient_id)
    assert response.status_code == 409, response.text


def test_releasing_an_overdue_pickup_is_still_allowed(
    client, db_session, donor, kitchen
):
    """`ACCEPTED` twice over: the offer is refused, the release is not.

    Reached from `VOLUNTEER_ASSIGNED` this transition hands a pickup back
    (D-41). Refusing it on the deadline would strand an overdue donation with a
    courier who has already given it up, and no other transition would free it.
    """
    ngo, _ = kitchen
    donation_id = post_donation(client, donor)
    assert accept(client, ngo, donation_id).status_code == 200

    courier = register(client, email="release-courier@test.com", role="volunteer")
    assert client.post(
        f"/api/donations/{donation_id}/status",
        json={"status": "VOLUNTEER_ASSIGNED"},
        headers=auth(courier),
    ).status_code == 200

    backdate(db_session, donation_id)

    response = accept(client, ngo, donation_id)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "ACCEPTED"
    assert body["volunteerId"] is None
