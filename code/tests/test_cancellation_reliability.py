"""A donor's cancellation is not the kitchen's failure, and ends at collection.

`Recipient.reliability_score` is `100 × completed / accepted` once a kitchen has
three acceptances, and `accepted_donations` rises at acceptance. `CANCELLED` used
to adjust neither counter, so a donor withdrawing a donation left the kitchen
charged with an acceptance it never had the chance to complete — three accept →
donor-cancel cycles took a kitchen from the 85 prior to 0 (audit 2026-09-10,
`TASKS.md` P1-4). A donor could also cancel after the courier had already
collected the food.

DQ-3, as decided (D-58): reliability measures the kitchen's own fulfilment, not
outcomes the donor or the platform caused. A donor may cancel until `PICKED_UP`
and not from it; an administrator may still cancel from `PICKED_UP`. Either
cancellation of an accepted donation takes the acceptance back out of
`accepted_donations` and leaves `completed_donations` alone.

`test_lifecycle_authorization.py` covers who may cancel; the races are in
`test_lifecycle_concurrency.py`.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from conftest import admin_token, auth, register, register_ngo
from foodlink.models import Donation, DonationStatus, Recipient, StatusEvent, User, Volunteer

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


def post_donation(client, donor: str) -> int:
    created = client.post("/api/donations", json=donation_body(), headers=auth(donor))
    assert created.status_code == 201, created.text
    return created.json()["id"]


def kitchen_row(db_session, recipient_id: int) -> Recipient:
    """The organisation as the database now holds it."""
    recipient = db_session.get(Recipient, recipient_id)
    db_session.refresh(recipient)
    return recipient


def counters(db_session, recipient_id: int) -> tuple[int, int, int]:
    recipient = kitchen_row(db_session, recipient_id)
    return (
        recipient.accepted_donations,
        recipient.completed_donations,
        recipient.reliability_score,
    )


def state_of(db_session, donation_id: int) -> DonationStatus:
    donation = db_session.get(Donation, donation_id)
    db_session.refresh(donation)
    return donation.status


def deliveries_of(db_session, courier_email: str) -> int:
    courier = db_session.scalar(
        select(Volunteer).join(User).where(User.email == courier_email)
    )
    db_session.refresh(courier)
    return courier.completed_deliveries


def give_history(db_session, recipient_id: int, accepted: int, completed: int) -> None:
    """A kitchen past the cold-start threshold, so its score is the real ratio."""
    recipient = db_session.get(Recipient, recipient_id)
    recipient.accepted_donations = accepted
    recipient.completed_donations = completed
    db_session.commit()


@pytest.fixture
def parties(client, db_session):
    """A donor, a verified kitchen and a courier — each other's only counterparts."""
    donor = register(client, email="rel-donor@test.com", role="donor")
    kitchen, recipient_id = register_ngo(
        client, db_session, email="rel-ngo@test.com", org="Helping Hands"
    )
    courier = register(client, email="rel-courier@test.com", role="volunteer")
    return {
        "donor": donor,
        "kitchen": kitchen,
        "recipient_id": recipient_id,
        "courier": courier,
        "courier_email": "rel-courier@test.com",
    }


# ─── A donor's cancellation before collection is neutral ─────────────────────

def test_a_donor_cancelling_an_accepted_donation_does_not_keep_the_acceptance(
    client, db_session, parties
):
    """The kitchen ends exactly where it stood before it accepted.

    A kitchen with a perfect record past the threshold makes the score itself
    observable: an acceptance left counted would pull 4/4 = 100 down to 4/5 = 80.
    """
    give_history(db_session, parties["recipient_id"], accepted=4, completed=4)
    assert counters(db_session, parties["recipient_id"]) == (4, 4, 100)

    donation_id = post_donation(client, parties["donor"])
    assert advance(client, parties["kitchen"], donation_id, "ACCEPTED").status_code == 200
    assert counters(db_session, parties["recipient_id"]) == (5, 4, 80)

    response = advance(client, parties["donor"], donation_id, "CANCELLED")

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "CANCELLED"
    assert state_of(db_session, donation_id) is DonationStatus.CANCELLED
    assert counters(db_session, parties["recipient_id"]) == (4, 4, 100)


def test_the_ledger_still_records_the_acceptance_the_counter_no_longer_counts(
    client, db_session, parties
):
    """Only the counter is corrected; the history is not rewritten (D-01)."""
    donation_id = post_donation(client, parties["donor"])
    assert advance(client, parties["kitchen"], donation_id, "ACCEPTED").status_code == 200

    response = advance(client, parties["donor"], donation_id, "CANCELLED")

    assert response.status_code == 200, response.text
    assert [e["toStatus"] for e in response.json()["events"]][-2:] == ["ACCEPTED", "CANCELLED"]
    donor_id = db_session.scalar(select(User.id).where(User.email == "rel-donor@test.com"))
    cancelled = db_session.scalar(
        select(StatusEvent).where(
            StatusEvent.donation_id == donation_id,
            StatusEvent.to_status == DonationStatus.CANCELLED,
        )
    )
    assert cancelled.from_status is DonationStatus.ACCEPTED
    assert cancelled.actor_id == donor_id


def test_repeated_donor_cancellations_cannot_drive_a_kitchens_reliability_to_zero(
    client, db_session, parties
):
    """The audit reproduction: three accept → donor-cancel cycles used to end at 0.

    With every cancelled acceptance counted the kitchen crossed the three-
    acceptance threshold on zero completions. Now it has no acceptances at all,
    so it keeps the prior — and the next real outcome is still counted normally.
    """
    assert counters(db_session, parties["recipient_id"]) == (0, 0, 85)

    for _ in range(3):
        donation_id = post_donation(client, parties["donor"])
        assert advance(client, parties["kitchen"], donation_id, "ACCEPTED").status_code == 200
        assert advance(client, parties["donor"], donation_id, "CANCELLED").status_code == 200

    assert counters(db_session, parties["recipient_id"]) == (0, 0, 85)

    # The threshold still engages on acceptances the kitchen actually holds.
    for _ in range(3):
        donation_id = post_donation(client, parties["donor"])
        assert advance(client, parties["kitchen"], donation_id, "ACCEPTED").status_code == 200

    assert counters(db_session, parties["recipient_id"]) == (3, 0, 0)


def test_a_donor_cancelling_before_any_kitchen_accepted_changes_no_counter(
    client, db_session, parties
):
    """Nothing was counted, so nothing is taken away."""
    give_history(db_session, parties["recipient_id"], accepted=3, completed=2)
    donation_id = post_donation(client, parties["donor"])

    response = advance(client, parties["donor"], donation_id, "CANCELLED")

    assert response.status_code == 200, response.text
    assert counters(db_session, parties["recipient_id"]) == (3, 2, 67)


def test_a_donor_may_cancel_while_a_courier_is_assigned_and_it_stays_neutral(
    client, db_session, parties
):
    """`VOLUNTEER_ASSIGNED` is before collection: the courier has not got the food."""
    give_history(db_session, parties["recipient_id"], accepted=4, completed=4)
    donation_id = post_donation(client, parties["donor"])
    assert advance(client, parties["kitchen"], donation_id, "ACCEPTED").status_code == 200
    assert advance(client, parties["courier"], donation_id, "VOLUNTEER_ASSIGNED").status_code == 200
    assert counters(db_session, parties["recipient_id"]) == (5, 4, 80)

    response = advance(client, parties["donor"], donation_id, "CANCELLED")

    assert response.status_code == 200, response.text
    assert state_of(db_session, donation_id) is DonationStatus.CANCELLED
    assert counters(db_session, parties["recipient_id"]) == (4, 4, 100)
    assert deliveries_of(db_session, parties["courier_email"]) == 0


def test_a_release_then_a_donor_cancellation_uncounts_the_one_acceptance_once(
    client, db_session, parties
):
    """A release is not an acceptance (D-41), so the cancellation has one to undo."""
    donation_id = post_donation(client, parties["donor"])
    assert advance(client, parties["kitchen"], donation_id, "ACCEPTED").status_code == 200
    assert advance(client, parties["courier"], donation_id, "VOLUNTEER_ASSIGNED").status_code == 200
    assert advance(client, parties["kitchen"], donation_id, "ACCEPTED").status_code == 200
    assert counters(db_session, parties["recipient_id"])[0] == 1

    assert advance(client, parties["donor"], donation_id, "CANCELLED").status_code == 200

    assert counters(db_session, parties["recipient_id"]) == (0, 0, 85)


# ─── A donor may not cancel once the food has been collected ─────────────────

@pytest.mark.parametrize(
    ("reached", "courier_steps"),
    [("PICKED_UP", ["PICKED_UP"]), ("DELIVERED", ["PICKED_UP", "DELIVERED"])],
    ids=["picked-up", "delivered"],
)
def test_a_donor_cannot_cancel_once_the_courier_has_collected(
    client, db_session, parties, reached, courier_steps
):
    donation_id = post_donation(client, parties["donor"])
    assert advance(client, parties["kitchen"], donation_id, "ACCEPTED").status_code == 200
    assert advance(client, parties["courier"], donation_id, "VOLUNTEER_ASSIGNED").status_code == 200
    for step in courier_steps:
        assert advance(client, parties["courier"], donation_id, step).status_code == 200

    response = advance(client, parties["donor"], donation_id, "CANCELLED")

    assert response.status_code == 409
    assert response.json()["detail"] == f"Cannot move a donation from {reached} to CANCELLED"
    assert state_of(db_session, donation_id) is DonationStatus(reached)
    assert counters(db_session, parties["recipient_id"]) == (1, 0, 85)
    assert deliveries_of(db_session, parties["courier_email"]) == 0
    assert db_session.scalars(
        select(StatusEvent).where(
            StatusEvent.donation_id == donation_id,
            StatusEvent.to_status == DonationStatus.CANCELLED,
        )
    ).all() == []


def test_a_donor_who_does_not_own_a_collected_donation_is_still_answered_404(
    client, db_session, parties
):
    """The collection rule runs after ownership, so it confirms nothing to a stranger."""
    stranger = register(client, email="rel-stranger@test.com", role="donor")
    donation_id = post_donation(client, parties["donor"])
    for token, step in (
        (parties["kitchen"], "ACCEPTED"),
        (parties["courier"], "VOLUNTEER_ASSIGNED"),
        (parties["courier"], "PICKED_UP"),
    ):
        assert advance(client, token, donation_id, step).status_code == 200

    response = advance(client, stranger, donation_id, "CANCELLED")

    assert response.status_code == 404
    assert state_of(db_session, donation_id) is DonationStatus.PICKED_UP


# ─── An administrator's cancellation is still allowed, and is neutral too ────

@pytest.mark.parametrize(
    "courier_steps",
    [[], ["VOLUNTEER_ASSIGNED"], ["VOLUNTEER_ASSIGNED", "PICKED_UP"]],
    ids=["accepted", "courier-assigned", "picked-up"],
)
def test_an_administrator_cancelling_an_accepted_donation_does_not_keep_the_acceptance(
    client, db_session, parties, courier_steps
):
    """A platform cancellation is not the kitchen's failure, at any cancellable state.

    `PICKED_UP` included: the pickup is the courier's step, not the kitchen's, and
    nothing is cancellable once it is `DELIVERED`, so no fulfilled donation can be
    undone this way. The 4/4 history makes the score itself observable.
    """
    give_history(db_session, parties["recipient_id"], accepted=4, completed=4)
    donation_id = post_donation(client, parties["donor"])
    assert advance(client, parties["kitchen"], donation_id, "ACCEPTED").status_code == 200
    for step in courier_steps:
        assert advance(client, parties["courier"], donation_id, step).status_code == 200
    assert counters(db_session, parties["recipient_id"]) == (5, 4, 80)

    response = advance(client, admin_token(client, db_session), donation_id, "CANCELLED")

    assert response.status_code == 200, response.text
    assert state_of(db_session, donation_id) is DonationStatus.CANCELLED
    assert counters(db_session, parties["recipient_id"]) == (4, 4, 100)
    assert deliveries_of(db_session, parties["courier_email"]) == 0


def test_repeated_administrator_cancellations_cannot_drive_a_kitchens_reliability_down(
    client, db_session, parties
):
    """The P1-4 reproduction with support staff cancelling instead of the donor."""
    root = admin_token(client, db_session)

    for _ in range(3):
        donation_id = post_donation(client, parties["donor"])
        assert advance(client, parties["kitchen"], donation_id, "ACCEPTED").status_code == 200
        assert advance(client, root, donation_id, "CANCELLED").status_code == 200

    assert counters(db_session, parties["recipient_id"]) == (0, 0, 85)


def test_an_administrator_cancelling_before_any_kitchen_accepted_changes_no_counter(
    client, db_session, parties
):
    """No acceptance was counted, so there is none to take back."""
    give_history(db_session, parties["recipient_id"], accepted=3, completed=2)
    donation_id = post_donation(client, parties["donor"])

    response = advance(client, admin_token(client, db_session), donation_id, "CANCELLED")

    assert response.status_code == 200, response.text
    assert counters(db_session, parties["recipient_id"]) == (3, 2, 67)


@pytest.mark.parametrize("canceller", ["donor", "admin"])
def test_a_cancellation_never_takes_the_counter_below_zero(
    client, db_session, parties, canceller
):
    """The floor, for a row whose counter was edited out from under its donation.

    The lifecycle never produces this — a bound donation always carries its
    counted acceptance — but seeded and hand-edited rows can.
    """
    donation_id = post_donation(client, parties["donor"])
    assert advance(client, parties["kitchen"], donation_id, "ACCEPTED").status_code == 200
    give_history(db_session, parties["recipient_id"], accepted=0, completed=0)
    token = parties["donor"] if canceller == "donor" else admin_token(client, db_session)

    response = advance(client, token, donation_id, "CANCELLED")

    assert response.status_code == 200, response.text
    assert counters(db_session, parties["recipient_id"]) == (0, 0, 85)


# ─── Completion is counted exactly as before ─────────────────────────────────

def test_a_completed_donation_still_counts_for_the_kitchen_and_the_courier(
    client, db_session, parties
):
    donation_id = post_donation(client, parties["donor"])
    assert advance(client, parties["kitchen"], donation_id, "ACCEPTED").status_code == 200
    assert counters(db_session, parties["recipient_id"]) == (1, 0, 85)

    for token, step in (
        (parties["courier"], "VOLUNTEER_ASSIGNED"),
        (parties["courier"], "PICKED_UP"),
        (parties["courier"], "DELIVERED"),
        (parties["kitchen"], "COMPLETED"),
    ):
        assert advance(client, token, donation_id, step).status_code == 200

    assert state_of(db_session, donation_id) is DonationStatus.COMPLETED
    assert counters(db_session, parties["recipient_id"]) == (1, 1, 85)
    assert deliveries_of(db_session, parties["courier_email"]) == 1


def test_three_completions_still_leave_the_prior_for_the_real_ratio(
    client, db_session, parties
):
    for _ in range(3):
        donation_id = post_donation(client, parties["donor"])
        for token, step in (
            (parties["kitchen"], "ACCEPTED"),
            (parties["courier"], "VOLUNTEER_ASSIGNED"),
            (parties["courier"], "PICKED_UP"),
            (parties["courier"], "DELIVERED"),
            (parties["kitchen"], "COMPLETED"),
        ):
            assert advance(client, token, donation_id, step).status_code == 200

    assert counters(db_session, parties["recipient_id"]) == (3, 3, 100)
    assert deliveries_of(db_session, parties["courier_email"]) == 3


# ─── Who may cancel is unchanged ─────────────────────────────────────────────

@pytest.mark.parametrize("party", ["kitchen", "courier"])
def test_the_donations_other_parties_still_may_not_cancel_it(
    client, db_session, parties, party
):
    """Changing what a cancellation counts must not widen who may cause one."""
    donation_id = post_donation(client, parties["donor"])
    assert advance(client, parties["kitchen"], donation_id, "ACCEPTED").status_code == 200
    assert advance(client, parties["courier"], donation_id, "VOLUNTEER_ASSIGNED").status_code == 200

    response = advance(client, parties[party], donation_id, "CANCELLED")

    assert response.status_code == 403
    assert response.json()["detail"] == "Your role cannot set a donation to CANCELLED"
    assert state_of(db_session, donation_id) is DonationStatus.VOLUNTEER_ASSIGNED
    assert counters(db_session, parties["recipient_id"]) == (1, 0, 85)
