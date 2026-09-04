"""One pickup, one courier — including when two of them ask at the same time.

`test_api.py` covers the claim as part of the happy-path lifecycle. These cover
the claim as a *concurrency* boundary: the guard that decides whether a courier
may take a pickup has to be evaluated by the database as it performs the write,
not by Python beforehand, or two requests that both read an unclaimed donation
can both go on to assign themselves to it.

The last three tests do not share the suite's usual single-session fixture.
They build a file-backed SQLite database so that two *real* connections, and so
two real transactions, exist — which is the only way to interleave a competing
claim against a request that is already in flight. What that does and does not
prove is written out in `test_the_claim_condition_is_evaluated_by_the_database`.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, update
from sqlalchemy.orm import sessionmaker

from conftest import admin_token, auth, register, register_ngo
from foodlink.database import Base, get_db
from foodlink.main import app
from foodlink.models import Donation, DonationStatus, StatusEvent, Volunteer
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


def accepted_donation(client, db_session, tag: str) -> int:
    """A donation a verified kitchen has accepted — the state a claim starts from."""
    donor = register(client, email=f"{tag}-donor@test.com", role="donor")
    ngo, _ = register_ngo(
        client, db_session, email=f"{tag}-ngo@test.com", org=f"{tag.title()} Kitchen"
    )

    donation_id = client.post(
        "/api/donations", json=donation_body(), headers=auth(donor)
    ).json()["id"]

    response = client.post(
        f"/api/donations/{donation_id}/status",
        json={"status": "ACCEPTED"},
        headers=auth(ngo),
    )
    assert response.status_code == 200, response.text
    return donation_id


def claim(client, token: str, donation_id: int):
    return client.post(
        f"/api/donations/{donation_id}/status",
        json={"status": "VOLUNTEER_ASSIGNED"},
        headers=auth(token),
    )


def release(client, token: str, donation_id: int):
    """A kitchen sending an assigned pickup back to ACCEPTED."""
    return client.post(
        f"/api/donations/{donation_id}/status",
        json={"status": "ACCEPTED"},
        headers=auth(token),
    )


# ─── The claim, in sequence ──────────────────────────────────────────────────

def test_an_unclaimed_pickup_can_be_claimed(client, db_session):
    donation_id = accepted_donation(client, db_session, "plain")
    courier = register(client, email="plain-courier@test.com", role="volunteer")

    response = claim(client, courier, donation_id)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "VOLUNTEER_ASSIGNED"
    assert body["volunteerName"] is not None
    assert [e["toStatus"] for e in body["events"]].count("VOLUNTEER_ASSIGNED") == 1


def test_a_second_courier_can_take_a_pickup_released_by_the_first(client, db_session):
    """A released pickup is genuinely back in the pool.

    ⚠️ **This assertion used to be its inverse, and the old one was the bug.**
    It was written as "the only sequential route to the already-claimed guard",
    on the reasoning that a released pickup returns to ACCEPTED "with
    `volunteer_id` still set" — which described the defect rather than the
    intent. Keeping the courier bound meant a release released nothing: the
    donation stayed invisible to every other courier, because
    `donations._readable_by` gives a volunteer `ACCEPTED AND volunteer_id IS
    NULL`, and any who reached it by id were told a pickup had "already been
    claimed" when nobody was carrying it. The release now clears the assignment,
    so this sequence has the outcome its name always implied.

    **No guard coverage is lost with it.** `ACCEPTED` with a courier still bound
    is now unreachable through the API, so the "another courier has already
    claimed this pickup" branch is reachable only as a race — which is what the
    three file-backed, two-transaction tests at the end of this module exist for,
    and they are the honest way to reach it in any case.
    """
    donor = register(client, email="released-donor@test.com", role="donor")
    ngo, _ = register_ngo(
        client, db_session, email="released-ngo@test.com", org="Released Kitchen"
    )
    donation_id = client.post(
        "/api/donations", json=donation_body(), headers=auth(donor)
    ).json()["id"]
    assert client.post(
        f"/api/donations/{donation_id}/status",
        json={"status": "ACCEPTED"},
        headers=auth(ngo),
    ).status_code == 200

    first = register(client, email="released-first@test.com", role="volunteer")
    second = register(client, email="released-second@test.com", role="volunteer")

    assert claim(client, first, donation_id).status_code == 200
    assert release(client, ngo, donation_id).status_code == 200

    response = claim(client, second, donation_id)

    assert response.status_code == 200, response.text
    # The second courier now holds it, and the first is off the row entirely.
    donation = db_session.get(Donation, donation_id)
    db_session.refresh(donation)
    assert donation.status is DonationStatus.VOLUNTEER_ASSIGNED
    assert donation.volunteer.user.email == "released-second@test.com"


def test_the_original_courier_may_reclaim_a_pickup_released_back_to_them(
    client, db_session
):
    """A courier who let a pickup go may take it back.

    The property is unchanged; the mechanism moved. It used to exercise
    `_claim_pickup`'s `volunteer_id == the caller` half, because a release left
    the caller bound. Now that the release clears the assignment it goes through
    the `volunteer_id IS NULL` half, like any other courier — which is the point
    of a release. The `== the caller` half is still load-bearing for one
    courier's duplicate concurrent requests, covered at the end of this module.
    """
    donor = register(client, email="reclaim-donor@test.com", role="donor")
    ngo, _ = register_ngo(
        client, db_session, email="reclaim-ngo@test.com", org="Reclaim Kitchen"
    )
    donation_id = client.post(
        "/api/donations", json=donation_body(), headers=auth(donor)
    ).json()["id"]
    assert client.post(
        f"/api/donations/{donation_id}/status",
        json={"status": "ACCEPTED"},
        headers=auth(ngo),
    ).status_code == 200

    courier = register(client, email="reclaim-courier@test.com", role="volunteer")
    assert claim(client, courier, donation_id).status_code == 200
    assert release(client, ngo, donation_id).status_code == 200

    response = claim(client, courier, donation_id)

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "VOLUNTEER_ASSIGNED"


def test_a_courier_cannot_claim_a_pickup_no_kitchen_has_accepted(client, db_session):
    donor = register(client, email="early-donor@test.com", role="donor")
    donation_id = client.post(
        "/api/donations", json=donation_body(), headers=auth(donor)
    ).json()["id"]
    courier = register(client, email="early-courier@test.com", role="volunteer")

    assert claim(client, courier, donation_id).status_code == 409


def test_an_account_with_no_courier_profile_cannot_claim(client, db_session):
    donation_id = accepted_donation(client, db_session, "profileless")

    response = claim(client, admin_token(client, db_session), donation_id)

    assert response.status_code == 422
    assert response.json()["detail"] == "No courier profile for this account"


def test_a_kitchen_cannot_claim_a_pickup(client, db_session):
    donor = register(client, email="rolegate-donor@test.com", role="donor")
    ngo, _ = register_ngo(
        client, db_session, email="rolegate-ngo@test.com", org="Rolegate Kitchen"
    )
    donation_id = client.post(
        "/api/donations", json=donation_body(), headers=auth(donor)
    ).json()["id"]
    assert client.post(
        f"/api/donations/{donation_id}/status",
        json={"status": "ACCEPTED"},
        headers=auth(ngo),
    ).status_code == 200

    assert claim(client, ngo, donation_id).status_code == 403


# ─── The claim, concurrently ─────────────────────────────────────────────────
#
# Everything below runs against a file-backed database. The suite's `client`
# fixture hands every request the same Session over a single StaticPool
# connection, which is what keeps the ordinary tests fast — but it also means
# two requests there share one transaction, so a competing claim cannot be
# committed independently of the request it is competing with.

@pytest.fixture
def file_db(tmp_path):
    """A real file database and a session factory over it — two connections possible."""
    engine = create_engine(f"sqlite:///{tmp_path / 'race.db'}")
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
def contested_pickup(race_client, file_db):
    """An accepted donation and two couriers who both want it."""
    session = file_db()
    try:
        donation_id = accepted_donation(race_client, session, "race")
    finally:
        session.close()

    first = register(race_client, email="race-first@test.com", role="volunteer")
    second = register(race_client, email="race-second@test.com", role="volunteer")

    session = file_db()
    try:
        ids = {
            v.user.email: v.id
            for v in session.scalars(select(Volunteer).join(Volunteer.user))
        }
    finally:
        session.close()

    return donation_id, (first, ids["race-first@test.com"]), (second, ids["race-second@test.com"])


def test_the_claim_condition_is_evaluated_by_the_database(file_db, contested_pickup):
    """Two transactions that both read an unclaimed pickup; only one may take it.

    This is the time-of-check/time-of-use sequence itself, driven deterministic-
    ally rather than by hoping two threads overlap: both sessions read
    `volunteer_id IS NULL`, then both run the claim. Because it is the real
    `_claim_pickup` from the router, what is under test is the statement the
    endpoint actually issues.

    **What this proves:** the condition that establishes "still unclaimed" is
    part of the write, so a value read earlier cannot authorise a write later.
    The loser is told it lost by the database, not by Python.

    **What it does not prove:** that the *engine* serialises two claims arriving
    at the same instant. That is a property of SQLite's write locking and of
    PostgreSQL's row locking at READ COMMITTED, not of this code, and testing it
    needs the engine in question. Here the two transactions are interleaved by
    hand, which is strictly harder than the real thing: the loser reads before
    the winner has committed and still cannot write.
    """
    donation_id, (_, first_id), (_, second_id) = contested_pickup
    winner, loser = file_db(), file_db()
    try:
        # Both couriers look at the same pickup and see nobody on it.
        assert winner.get(Donation, donation_id).volunteer_id is None
        assert loser.get(Donation, donation_id).volunteer_id is None

        assert donations_router._claim_pickup(
            winner, donation_id, DonationStatus.ACCEPTED, first_id
        ) is True
        winner.commit()

        # The loser is still holding the read that said "unclaimed".
        assert donations_router._claim_pickup(
            loser, donation_id, DonationStatus.ACCEPTED, second_id
        ) is False
        loser.rollback()
    finally:
        winner.close()
        loser.close()

    check = file_db()
    try:
        assert check.get(Donation, donation_id).volunteer_id == first_id
    finally:
        check.close()


def interleave_after_the_request_reads(monkeypatch, competitor):
    """Let `competitor` commit the instant a request has read its donation.

    The hook is the handler's own opening read, which is the last thing that
    happens before it decides whether the pickup is claimable. Wrapping *that*
    rather than the claim itself is deliberate: the window being opened has to
    be one the previous implementation went through too, or the test would only
    be able to fail on code that already has the fix in it.

    Returns a list that stays empty if the window was never opened.
    """
    real_read = donations_router._get_or_404
    opened: list[int] = []

    def read_then_let_a_competitor_in(db, donation_id):
        donation = real_read(db, donation_id)
        if not opened:
            opened.append(donation_id)
            competitor(donation_id, donation.status)
        return donation

    monkeypatch.setattr(donations_router, "_get_or_404", read_then_let_a_competitor_in)
    return opened


def test_a_request_that_loses_the_race_cannot_overwrite_the_winner(
    race_client, file_db, contested_pickup, monkeypatch
):
    """A competing claim commits mid-request, in the window the old code lost.

    Both couriers reach "this pickup is unclaimed" — the second one's read is
    real and is genuinely stale by the time it writes, which is the whole of the
    bug. The previous implementation compared that stale copy in Python and
    assigned over the winner; this one puts the comparison in the write.
    """
    donation_id, (_, first_id), (second_token, _) = contested_pickup
    real_claim = donations_router._claim_pickup

    def another_courier_claims_it(donation_id_, from_status):
        competitor = file_db()
        try:
            assert real_claim(competitor, donation_id_, from_status, first_id)
            competitor.commit()
        finally:
            competitor.close()

    interleaved = interleave_after_the_request_reads(monkeypatch, another_courier_claims_it)

    response = claim(race_client, second_token, donation_id)

    assert interleaved, "the request never reached the claim — the window was not opened"
    assert response.status_code == 409
    assert response.json()["detail"] == "Another courier has already claimed this pickup"

    session = file_db()
    try:
        donation = session.get(Donation, donation_id)
        # The winner keeps it, and the loser's transition was not recorded.
        assert donation.volunteer_id == first_id
        assert donation.status is DonationStatus.ACCEPTED
        assert session.scalars(
            select(StatusEvent).where(
                StatusEvent.donation_id == donation_id,
                StatusEvent.to_status == DonationStatus.VOLUNTEER_ASSIGNED,
            )
        ).all() == []
    finally:
        session.close()


def test_one_couriers_duplicate_requests_claim_a_pickup_only_once(
    race_client, file_db, contested_pickup, monkeypatch
):
    """The same courier submitting twice at once must not transition twice.

    `volunteer_id IS NULL OR volunteer_id == the caller` cannot tell these apart
    — the second request's courier *is* the assignee by then. It is the other
    half of the condition, that the row is still in the state the transition was
    authorised from, that refuses it, and the answer is the same 409 a
    sequential duplicate already gets.
    """
    donation_id, (first_token, first_id), _ = contested_pickup
    real_claim = donations_router._claim_pickup

    def its_own_twin_gets_there_first(donation_id_, from_status):
        twin = file_db()
        try:
            assert real_claim(twin, donation_id_, from_status, first_id)
            # The twin request finishes its transition, as the handler would.
            twin.execute(
                update(Donation)
                .where(Donation.id == donation_id_)
                .values(status=DonationStatus.VOLUNTEER_ASSIGNED)
            )
            twin.add(
                StatusEvent(
                    donation_id=donation_id_,
                    from_status=from_status,
                    to_status=DonationStatus.VOLUNTEER_ASSIGNED,
                    actor_id=1,
                )
            )
            twin.commit()
        finally:
            twin.close()

    interleaved = interleave_after_the_request_reads(monkeypatch, its_own_twin_gets_there_first)

    response = claim(race_client, first_token, donation_id)

    assert interleaved
    assert response.status_code == 409
    # Word for word what the transition check tells a duplicate that arrives
    # after the first one rather than alongside it.
    assert response.json()["detail"] == (
        "Cannot move a donation from VOLUNTEER_ASSIGNED to VOLUNTEER_ASSIGNED"
    )

    session = file_db()
    try:
        donation = session.get(Donation, donation_id)
        assert donation.volunteer_id == first_id
        assert donation.status is DonationStatus.VOLUNTEER_ASSIGNED
        # One transition, one event — not two.
        assert len(session.scalars(
            select(StatusEvent).where(
                StatusEvent.donation_id == donation_id,
                StatusEvent.to_status == DonationStatus.VOLUNTEER_ASSIGNED,
            )
        ).all()) == 1
    finally:
        session.close()
