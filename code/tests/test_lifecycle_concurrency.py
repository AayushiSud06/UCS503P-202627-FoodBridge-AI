"""One donation, one transition — including when two requests arrive together.

`test_courier_claim.py` covers the claim, which has carried its condition inside
the UPDATE since D-28. These cover the rest of `update_status`, which did not:
the handler read the row, tested `ALLOWED_TRANSITIONS` in Python and then wrote,
so two kitchens could both read the open pool and both accept the same donation
— both answered `200`, two `ACCEPTED` events were appended, and the losing
kitchen's `accepted_donations` stayed incremented (audit 2026-09-10, `TASKS.md`
P1-3). `_record` now advances the status with `UPDATE ... WHERE id = :id AND
status = :from` and refuses on `rowcount != 1` (D-55).

The concurrency tests do not use the suite's single-session fixture: one Session
over one StaticPool connection means two requests share a transaction, so a
competitor could not commit independently of the request it competes with. They
build a file-backed SQLite database instead, giving two real connections and so
two real transactions, and interleave by hand rather than with threads or sleeps
— the competitor commits at the exact point the request under test has finished
its read, which is strictly harder than two requests arriving together.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from conftest import admin_token, auth, register, register_ngo
from foodlink.database import Base, get_db
from foodlink.main import app
from foodlink.models import Donation, DonationStatus, Recipient, StatusEvent, User, UserRole
from foodlink.routers import donations as donations_router

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


def accept(client, token: str, donation_id: int):
    return client.post(
        f"/api/donations/{donation_id}/status",
        json={"status": "ACCEPTED"},
        headers=auth(token),
    )


def events_reaching(session, donation_id: int, target: DonationStatus) -> list[StatusEvent]:
    return list(
        session.scalars(
            select(StatusEvent).where(
                StatusEvent.donation_id == donation_id,
                StatusEvent.to_status == target,
            )
        )
    )


# ─── Sequentially, nothing changed ───────────────────────────────────────────

def test_a_verified_kitchen_still_accepts_an_open_donation(client, db_session):
    donor = register(client, email="plain-donor@test.com", role="donor")
    ngo, recipient_id = register_ngo(
        client, db_session, email="plain-ngo@test.com", org="Helping Hands"
    )
    donation_id = client.post(
        "/api/donations", json=donation_body(), headers=auth(donor)
    ).json()["id"]

    response = accept(client, ngo, donation_id)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "ACCEPTED"
    assert body["recipientId"] == recipient_id
    assert [e["toStatus"] for e in body["events"]].count("ACCEPTED") == 1

    donation = db_session.get(Donation, donation_id)
    db_session.refresh(donation)
    assert donation.status is DonationStatus.ACCEPTED
    assert donation.match_score is not None
    assert db_session.get(Recipient, recipient_id).accepted_donations == 1


def test_a_second_kitchen_cannot_accept_an_already_accepted_donation(client, db_session):
    """The sequential answer the concurrent one has to agree with."""
    donor = register(client, email="seq-donor@test.com", role="donor")
    first, first_id = register_ngo(
        client, db_session, email="seq-first@test.com", org="First Kitchen"
    )
    second, second_id = register_ngo(
        client, db_session, email="seq-second@test.com", org="Second Kitchen"
    )
    donation_id = client.post(
        "/api/donations", json=donation_body(), headers=auth(donor)
    ).json()["id"]

    assert accept(client, first, donation_id).status_code == 200

    response = accept(client, second, donation_id)

    assert response.status_code == 409
    assert response.json()["detail"] == "Cannot move a donation from ACCEPTED to ACCEPTED"

    donation = db_session.get(Donation, donation_id)
    db_session.refresh(donation)
    assert donation.recipient_id == first_id
    assert db_session.get(Recipient, second_id).accepted_donations == 0
    assert len(events_reaching(db_session, donation_id, DonationStatus.ACCEPTED)) == 1


def test_the_guard_runs_after_the_role_and_trust_gates(client, db_session):
    """Authorization still answers first: 403, not a 409 about the state."""
    donor = register(client, email="gates-donor@test.com", role="donor")
    donation_id = client.post(
        "/api/donations", json=donation_body(), headers=auth(donor)
    ).json()["id"]

    courier = register(client, email="gates-courier@test.com", role="volunteer")
    assert accept(client, courier, donation_id).status_code == 403

    pending, pending_id = register_ngo(
        client, db_session, email="gates-pending@test.com", org="Pending Kitchen",
        verified=False,
    )
    unverified = accept(client, pending, donation_id)
    assert unverified.status_code == 403
    assert "verification" in unverified.json()["detail"].lower()

    donation = db_session.get(Donation, donation_id)
    db_session.refresh(donation)
    assert donation.status is not DonationStatus.ACCEPTED
    assert donation.recipient_id is None
    assert db_session.get(Recipient, pending_id).accepted_donations == 0
    assert events_reaching(db_session, donation_id, DonationStatus.ACCEPTED) == []


# ─── Concurrently: two real transactions ─────────────────────────────────────

@pytest.fixture
def file_db(tmp_path):
    """A real file database and a session factory over it — two connections possible."""
    engine = create_engine(f"sqlite:///{tmp_path / 'lifecycle-race.db'}")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    try:
        yield Session
    finally:
        engine.dispose()


@pytest.fixture
def race_client(file_db):
    """The app over the file database, one session per request as in production."""
    def override_get_db():
        db = file_db()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def contested_donation(race_client, file_db):
    """An open donation and two verified kitchens that both want it."""
    session = file_db()
    try:
        donor = register(race_client, email="race-donor@test.com", role="donor")
        first, first_id = register_ngo(
            race_client, session, email="race-first@test.com", org="First Kitchen"
        )
        second, second_id = register_ngo(
            race_client, session, email="race-second@test.com", org="Second Kitchen"
        )
    finally:
        session.close()

    donation_id = race_client.post(
        "/api/donations", json=donation_body(), headers=auth(donor)
    ).json()["id"]
    return donation_id, (first, first_id), (second, second_id)


def interleave_after_the_request_reads(monkeypatch, competitor):
    """Let `competitor` commit the instant a request has read its donation.

    The hook is the handler's own opening read — the last thing to happen before
    it decides whether the transition is legal — so the window opened is one the
    pre-fix code went through too, rather than one only the fixed code can reach.
    Returns a list that stays empty if the window was never opened.
    """
    real_read = donations_router._get_or_404
    opened: list[int] = []

    def read_then_let_a_competitor_in(db, donation_id):
        donation = real_read(db, donation_id)
        if not opened:
            opened.append(donation_id)
            competitor(donation_id)
        return donation

    monkeypatch.setattr(donations_router, "_get_or_404", read_then_let_a_competitor_in)
    return opened


@pytest.mark.parametrize(
    ("reached_from", "target"),
    [
        (DonationStatus.MATCHED, DonationStatus.ACCEPTED),
        (DonationStatus.DELIVERED, DonationStatus.COMPLETED),
    ],
    ids=["accepted", "completed"],
)
def test_the_transition_condition_is_evaluated_by_the_database(file_db, reached_from, target):
    """Two transactions that both read the same status; only one may write it.

    The time-of-check/time-of-use sequence itself, driven deterministically
    rather than by hoping two threads overlap: both sessions hold a row saying
    `reached_from`, and both then call the real `_record`.

    **What this proves:** the condition establishing "still in that state" is
    part of the write, so a value read earlier cannot authorise a write later,
    and the loser is refused by the database rather than by Python. Both targets
    are covered because the guard sits in the one function every transition's
    status write goes through, not in the acceptance branch alone.

    **What it does not prove:** that the engine serialises two writes arriving at
    the same instant. That is a property of SQLite's write locking and of
    PostgreSQL's row locking at READ COMMITTED (D-28), not of this code. Here the
    loser reads before the winner has committed and still cannot write, which is
    the harder case.
    """
    setup = file_db()
    try:
        actor = User(
            name="Stand-in Admin",
            email=f"actor-{target.value}@test.com",
            password_hash="not-a-real-hash",
            role=UserRole.admin,
        )
        donation = Donation(
            donor_id=1,
            food_name="Vegetarian Thali Meals",
            category="Vegetarian",
            quantity=50,
            unit="Meals",
            location="College Central Mess",
            **CAMPUS,
            pickup_deadline=datetime.now(timezone.utc) + timedelta(hours=6),
            status=reached_from,
        )
        setup.add_all([actor, donation])
        setup.commit()
        donation_id, actor_id = donation.id, actor.id
    finally:
        setup.close()

    winner, loser = file_db(), file_db()
    try:
        winner_row = winner.get(Donation, donation_id)
        loser_row = loser.get(Donation, donation_id)
        assert winner_row.status is reached_from
        assert loser_row.status is reached_from

        donations_router._record(winner, winner_row, target, winner.get(User, actor_id))
        winner.commit()

        # The loser is still holding the read that said `reached_from`.
        with pytest.raises(HTTPException) as refused:
            donations_router._record(loser, loser_row, target, loser.get(User, actor_id))
        assert refused.value.status_code == 409
        assert refused.value.detail == (
            f"Cannot move a donation from {target.value} to {target.value}"
        )
        loser.rollback()
    finally:
        winner.close()
        loser.close()

    check = file_db()
    try:
        assert check.get(Donation, donation_id).status is target
        assert len(events_reaching(check, donation_id, target)) == 1
    finally:
        check.close()


def test_a_kitchen_that_loses_the_race_cannot_overwrite_the_winner(
    race_client, file_db, contested_donation, monkeypatch
):
    """The audit reproduction: both kitchens used to be told `200`.

    The second kitchen commits its acceptance inside the window the first one's
    request has already opened, so the first one's read is genuinely stale by the
    time it writes — the whole of the bug. One owner, one event, one counted
    acceptance.
    """
    donation_id, (first_token, first_id), (_, second_id) = contested_donation

    def the_other_kitchen_accepts_it(donation_id_):
        session = file_db()
        try:  # exactly what the handler does for an acceptance, committed
            donation = session.get(Donation, donation_id_)
            recipient = session.get(Recipient, second_id)
            actor = session.scalar(select(User).where(User.email == "race-second@test.com"))
            recipient.accepted_donations += 1
            donations_router._record(session, donation, DonationStatus.ACCEPTED, actor)
            donation.recipient_id = second_id
            session.commit()
        finally:
            session.close()

    interleaved = interleave_after_the_request_reads(monkeypatch, the_other_kitchen_accepts_it)

    response = accept(race_client, first_token, donation_id)

    assert interleaved, "the request never reached the transition — the window was not opened"
    assert response.status_code == 409
    assert response.json()["detail"] == "Cannot move a donation from ACCEPTED to ACCEPTED"

    session = file_db()
    try:
        donation = session.get(Donation, donation_id)
        assert donation.status is DonationStatus.ACCEPTED
        assert donation.recipient_id == second_id
        assert len(events_reaching(session, donation_id, DonationStatus.ACCEPTED)) == 1
        assert session.get(Recipient, second_id).accepted_donations == 1
        # The loser side effects went back with its transaction.
        assert session.get(Recipient, first_id).accepted_donations == 0
    finally:
        session.close()


def test_a_cancellation_that_lands_first_refuses_the_acceptance(
    race_client, file_db, contested_donation, monkeypatch
):
    """The other pair the audit named: cancel against accept, same guard."""
    donation_id, (first_token, first_id), _ = contested_donation

    def the_donor_cancels_it(donation_id_):
        session = file_db()
        try:
            donation = session.get(Donation, donation_id_)
            actor = session.scalar(select(User).where(User.email == "race-donor@test.com"))
            donations_router._record(session, donation, DonationStatus.CANCELLED, actor)
            session.commit()
        finally:
            session.close()

    interleaved = interleave_after_the_request_reads(monkeypatch, the_donor_cancels_it)

    response = accept(race_client, first_token, donation_id)

    assert interleaved
    assert response.status_code == 409
    assert response.json()["detail"] == "Cannot move a donation from CANCELLED to ACCEPTED"

    session = file_db()
    try:
        donation = session.get(Donation, donation_id)
        assert donation.status is DonationStatus.CANCELLED
        assert donation.recipient_id is None
        assert events_reaching(session, donation_id, DonationStatus.ACCEPTED) == []
        assert session.get(Recipient, first_id).accepted_donations == 0
    finally:
        session.close()


# ─── A cancellation uncounts an acceptance at most once ──────────────────────
#
# A donor's or an administrator's cancellation takes the acceptance back out of
# the kitchen's `accepted_donations` (D-58). That adjustment runs only after
# `_record` has moved the status, in the same transaction, so a cancellation
# that loses its race must leave the counter exactly where the winner left it.

def cancel(client, token: str, donation_id: int):
    return client.post(
        f"/api/donations/{donation_id}/status",
        json={"status": "CANCELLED"},
        headers=auth(token),
    )


@pytest.fixture
def claimed_donation(race_client, file_db):
    """A donation one kitchen accepted and one courier claimed, on the file database."""
    session = file_db()
    try:
        donor = register(race_client, email="cancel-race-donor@test.com", role="donor")
        kitchen, recipient_id = register_ngo(
            race_client, session, email="cancel-race-ngo@test.com", org="Helping Hands"
        )
        courier = register(race_client, email="cancel-race-courier@test.com", role="volunteer")
    finally:
        session.close()

    donation_id = race_client.post(
        "/api/donations", json=donation_body(), headers=auth(donor)
    ).json()["id"]
    assert accept(race_client, kitchen, donation_id).status_code == 200
    assert race_client.post(
        f"/api/donations/{donation_id}/status",
        json={"status": "VOLUNTEER_ASSIGNED"},
        headers=auth(courier),
    ).status_code == 200
    return donation_id, donor, recipient_id, courier


def test_a_second_cancellation_racing_the_first_uncounts_nothing(
    race_client, file_db, claimed_donation, monkeypatch
):
    """A double-submitted cancel: one transition, one event, one decrement.

    The request under test read the donation while it could still be cancelled
    and passed every gate on that read; the first cancellation then commits. Its
    `_record` is refused, so its decrement never runs — the counter ends at 0,
    not -1 or a second acceptance lost from a real one.
    """
    donation_id, donor_token, recipient_id, _ = claimed_donation

    def the_first_cancellation_commits(donation_id_):
        session = file_db()
        try:  # exactly what the handler does for a donor's cancellation, committed
            donation = session.get(Donation, donation_id_)
            actor = session.scalar(
                select(User).where(User.email == "cancel-race-donor@test.com")
            )
            donations_router._record(session, donation, DonationStatus.CANCELLED, actor)
            donations_router._withdraw_acceptance(session, recipient_id)
            session.commit()
        finally:
            session.close()

    interleaved = interleave_after_the_request_reads(monkeypatch, the_first_cancellation_commits)

    response = cancel(race_client, donor_token, donation_id)

    assert interleaved
    assert response.status_code == 409
    assert response.json()["detail"] == "Cannot move a donation from CANCELLED to CANCELLED"

    session = file_db()
    try:
        assert session.get(Donation, donation_id).status is DonationStatus.CANCELLED
        assert len(events_reaching(session, donation_id, DonationStatus.CANCELLED)) == 1
        assert session.get(Recipient, recipient_id).accepted_donations == 0
    finally:
        session.close()


def test_a_donor_cancellation_that_loses_to_the_pickup_is_refused_and_uncounts_nothing(
    race_client, file_db, claimed_donation, monkeypatch
):
    """The collection boundary holds under a race, not only in sequence.

    The donor's request read `VOLUNTEER_ASSIGNED`, which a donor may cancel from;
    the courier then collects. The guard refuses the cancellation with the same
    words a donor gets asking after the pickup, and the kitchen keeps the
    acceptance of a donation that is now on its way to it.
    """
    donation_id, donor_token, recipient_id, _ = claimed_donation

    def the_courier_collects_it(donation_id_):
        session = file_db()
        try:
            donation = session.get(Donation, donation_id_)
            actor = session.scalar(
                select(User).where(User.email == "cancel-race-courier@test.com")
            )
            donations_router._record(session, donation, DonationStatus.PICKED_UP, actor)
            session.commit()
        finally:
            session.close()

    interleaved = interleave_after_the_request_reads(monkeypatch, the_courier_collects_it)

    response = cancel(race_client, donor_token, donation_id)

    assert interleaved
    assert response.status_code == 409
    assert response.json()["detail"] == "Cannot move a donation from PICKED_UP to CANCELLED"

    session = file_db()
    try:
        assert session.get(Donation, donation_id).status is DonationStatus.PICKED_UP
        assert events_reaching(session, donation_id, DonationStatus.CANCELLED) == []
        assert session.get(Recipient, recipient_id).accepted_donations == 1
    finally:
        session.close()


def test_an_administrator_cancellation_that_loses_to_the_delivery_uncounts_nothing(
    race_client, file_db, claimed_donation, monkeypatch
):
    """An administrator may cancel from `PICKED_UP`, but not a donation delivered since.

    The request read `PICKED_UP`; the courier then delivers. `DELIVERED` is not
    cancellable by anyone, and the donation can still be completed, so its
    acceptance must stay counted — uncounting it here would let a later
    completion stand on no acceptance at all.
    """
    donation_id, _, recipient_id, courier_token = claimed_donation
    assert race_client.post(
        f"/api/donations/{donation_id}/status",
        json={"status": "PICKED_UP"},
        headers=auth(courier_token),
    ).status_code == 200
    session = file_db()
    try:
        root = admin_token(race_client, session)
    finally:
        session.close()

    def the_courier_delivers_it(donation_id_):
        session = file_db()
        try:
            donation = session.get(Donation, donation_id_)
            actor = session.scalar(
                select(User).where(User.email == "cancel-race-courier@test.com")
            )
            donations_router._record(session, donation, DonationStatus.DELIVERED, actor)
            session.commit()
        finally:
            session.close()

    interleaved = interleave_after_the_request_reads(monkeypatch, the_courier_delivers_it)

    response = cancel(race_client, root, donation_id)

    assert interleaved
    assert response.status_code == 409
    assert response.json()["detail"] == "Cannot move a donation from DELIVERED to CANCELLED"

    session = file_db()
    try:
        assert session.get(Donation, donation_id).status is DonationStatus.DELIVERED
        assert events_reaching(session, donation_id, DonationStatus.CANCELLED) == []
        assert session.get(Recipient, recipient_id).accepted_donations == 1
    finally:
        session.close()
