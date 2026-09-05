"""Who may read which standing requirement.

`GET /api/requirements` used to be scoped by omission — `get_current_user` and
nothing else — so every authenticated caller read every organisation's board.
That was defensible (`RequirementOut` carries an organisation name and a need,
never a contact or a phone) but it had never been decided, and the donor needs
board is what forced the decision. D-44 records it.

These cover the scope itself, in the shape `test_recipient_reads.py` and
`test_volunteer_reads.py` already use for the neighbouring tables: an admin
reads everything, a donor reads the **verified** organisations' needs, a kitchen
reads its own, a courier reads nothing, and retirement still removes a
requirement from every board it was on.

`test_requirement_lifecycle.py` covers who may *change* one; this file is only
about who may see one.
"""

from __future__ import annotations

import pytest

from conftest import admin_token, auth, register, register_ngo


REQUIREMENT = {
    "foodType": "Hot vegetarian meals",
    "quantityNeeded": 120,
    "unit": "Meals",
    "beneficiaryCount": 140,
    "urgency": "High",
    "dailyRecurring": True,
    "notes": "Before 7 PM.",
}


def post_requirement(client, token: str, **overrides) -> dict:
    response = client.post(
        "/api/requirements", json={**REQUIREMENT, **overrides}, headers=auth(token)
    )
    assert response.status_code == 201, response.text
    return response.json()


def board(client, token: str) -> list[dict]:
    """What `GET /api/requirements` shows this caller."""
    response = client.get("/api/requirements", headers=auth(token))
    assert response.status_code == 200, response.text
    return response.json()


def board_ids(client, token: str) -> set[int]:
    return {r["id"] for r in board(client, token)}


@pytest.fixture
def board_of_two(client, db_session):
    """A verified kitchen and an unverified one, each with a need posted.

    Verification is the donor scope's whole term, so the fixture makes the two
    cases differ in exactly that and in nothing else.
    """
    verified, _ = register_ngo(
        client, db_session, email="verified-req@test.com", org="Verified Kitchen"
    )
    unverified, _ = register_ngo(
        client,
        db_session,
        email="unverified-req@test.com",
        org="Unvouched Kitchen",
        verified=False,
    )
    return (
        verified,
        post_requirement(client, verified, foodType="Cooked lunch"),
        unverified,
        post_requirement(client, unverified, foodType="Dry rations"),
    )


# ─── Admin ───────────────────────────────────────────────────────────────────

def test_an_admin_sees_every_active_requirement(client, db_session, board_of_two):
    """Unrestricted, as everywhere else — verification does not narrow an admin."""
    _, verified_req, _, unverified_req = board_of_two
    admin = admin_token(client, db_session)

    assert board_ids(client, admin) == {verified_req["id"], unverified_req["id"]}


# ─── Donor ───────────────────────────────────────────────────────────────────

def test_a_donor_sees_requirements_from_verified_organisations(client, board_of_two):
    _, verified_req, _, _ = board_of_two
    donor = register(client, email="donor-board@test.com", role="donor")

    assert verified_req["id"] in board_ids(client, donor)


def test_a_donor_does_not_see_an_unverified_organisations_requirement(client, board_of_two):
    """The same gate the matcher applies (`matching.score_pair`).

    A need from an organisation nobody has vouched for could not receive the
    donation anyway, so showing it to a donor would be an invitation to cook
    for a match that cannot happen.
    """
    _, verified_req, _, unverified_req = board_of_two
    donor = register(client, email="donor-unverified@test.com", role="donor")

    visible = board_ids(client, donor)
    assert unverified_req["id"] not in visible
    assert visible == {verified_req["id"]}


def test_a_donor_sees_every_verified_organisation_not_only_one(client, db_session, board_of_two):
    """Platform-wide, not radius-scoped and not bound to any donation.

    The donor account has no stored coordinates to filter on, so the board is
    deliberately every verified organisation's demand.
    """
    verified, first, _, _ = board_of_two
    second, _ = register_ngo(
        client, db_session, email="second-verified@test.com", org="Second Kitchen"
    )
    second_req = post_requirement(client, second, foodType="Fruit")
    donor = register(client, email="donor-wide@test.com", role="donor")

    assert board_ids(client, donor) == {first["id"], second_req["id"]}


def test_a_donor_reads_the_board_newest_first(client, db_session):
    """Ordering is part of the contract the board is built on.

    The three are backdated through the session rather than posted a second
    apart, because `created_at` is `CURRENT_TIMESTAMP` and SQLite resolves that
    to whole seconds — three requirements posted in the same second carry the
    same timestamp and the sort is a tie, which would test the insertion order
    rather than the `ORDER BY`. Backdating makes the timestamps genuinely
    differ, so this asserts the clause and nothing else.
    """
    from datetime import datetime, timedelta, timezone as tz

    from foodlink.models import Requirement

    kitchen, _ = register_ngo(client, db_session, email="order-req@test.com", org="Order Kitchen")
    oldest = post_requirement(client, kitchen, foodType="Posted first")
    middle = post_requirement(client, kitchen, foodType="Posted second")
    newest = post_requirement(client, kitchen, foodType="Posted third")

    now = datetime.now(tz.utc)
    for requirement_id, age_hours in ((oldest["id"], 48), (middle["id"], 24), (newest["id"], 1)):
        db_session.get(Requirement, requirement_id).created_at = now - timedelta(hours=age_hours)
    db_session.commit()

    donor = register(client, email="donor-order@test.com", role="donor")
    listed = board(client, donor)
    assert [r["id"] for r in listed] == [newest["id"], middle["id"], oldest["id"]]


# ─── NGO ─────────────────────────────────────────────────────────────────────

def test_an_ngo_sees_its_own_requirements(client, db_session):
    mine, _ = register_ngo(client, db_session, email="mine-board@test.com", org="My Kitchen")
    first = post_requirement(client, mine)
    second = post_requirement(client, mine, foodType="Dry rations")

    assert board_ids(client, mine) == {first["id"], second["id"]}


def test_an_ngo_does_not_see_another_organisations_requirements(client, db_session):
    """Two kitchens have no workflow with each other — D-26's reasoning, on this table.

    Both are verified, so the only thing separating them here is ownership.
    """
    mine, _ = register_ngo(client, db_session, email="mine-scope@test.com", org="My Kitchen")
    theirs, _ = register_ngo(client, db_session, email="their-scope@test.com", org="Rival Kitchen")
    my_req = post_requirement(client, mine)
    their_req = post_requirement(client, theirs, foodType="Dry rations")

    assert board_ids(client, mine) == {my_req["id"]}
    assert board_ids(client, theirs) == {their_req["id"]}


def test_an_unverified_ngo_still_sees_its_own_requirements(client, db_session):
    """Verification is the *donor's* term, not a condition on reading your own board.

    An organisation waiting to be vouched for can still record and review the
    demand it has posted; what it does not get is a donor audience yet.
    """
    kitchen, _ = register_ngo(
        client, db_session, email="waiting-req@test.com", org="Waiting Kitchen", verified=False
    )
    own = post_requirement(client, kitchen)

    assert board_ids(client, kitchen) == {own["id"]}


# ─── Volunteer ───────────────────────────────────────────────────────────────

def test_a_courier_sees_no_requirements(client, board_of_two):
    """Empty list rather than a 403, following `GET /recipients`.

    A courier carries an assigned donation; standing demand is not an input to
    that and reaches no courier screen.
    """
    courier = register(client, email="courier-board@test.com", role="volunteer")

    assert board(client, courier) == []


# ─── Active-only, unchanged ──────────────────────────────────────────────────

def test_a_retired_requirement_is_invisible_to_every_role(client, db_session, board_of_two):
    """Scoping narrows the board; it does not resurrect anything.

    `is_active` is still the first term of the query, so a retired requirement
    leaves the donor's board and the admin's along with its owner's.
    """
    verified, verified_req, _, _ = board_of_two
    donor = register(client, email="donor-retired@test.com", role="donor")
    admin = admin_token(client, db_session)
    assert verified_req["id"] in board_ids(client, donor)

    response = client.patch(
        f"/api/requirements/{verified_req['id']}",
        json={"isActive": False},
        headers=auth(verified),
    )
    assert response.status_code == 200, response.text

    assert verified_req["id"] not in board_ids(client, donor)
    assert verified_req["id"] not in board_ids(client, verified)
    assert verified_req["id"] not in board_ids(client, admin)


# ─── Verification state on the response ──────────────────────────────────────

def test_the_response_reports_the_posting_organisations_verification_state(
    client, db_session, board_of_two
):
    """`isVerified` is the recipient's, read live rather than stored on the need."""
    _, verified_req, _, unverified_req = board_of_two
    admin = admin_token(client, db_session)

    by_id = {r["id"]: r for r in board(client, admin)}
    assert by_id[verified_req["id"]]["isVerified"] is True
    assert by_id[unverified_req["id"]]["isVerified"] is False


def test_verifying_an_organisation_flips_the_state_on_its_existing_requirements(
    client, db_session, board_of_two
):
    """No new column, so nothing has to be backfilled when an admin vouches.

    The same requirement row that was invisible to a donor becomes visible and
    reports `isVerified: true`, without being touched.
    """
    _, _, unverified, unverified_req = board_of_two
    donor = register(client, email="donor-flip@test.com", role="donor")
    assert unverified_req["id"] not in board_ids(client, donor)

    # The admin route takes the recipient id, which is the account's own.
    recipient_id = client.get("/api/recipients/me", headers=auth(unverified)).json()["id"]
    response = client.post(
        f"/api/admin/recipients/{recipient_id}/verify",
        headers=auth(admin_token(client, db_session)),
    )
    assert response.status_code == 200, response.text

    now_visible = {r["id"]: r for r in board(client, donor)}
    assert unverified_req["id"] in now_visible
    assert now_visible[unverified_req["id"]]["isVerified"] is True


def test_creating_a_requirement_returns_its_organisations_verification_state(client, db_session):
    """The POST response goes through the same serialiser as the list."""
    kitchen, _ = register_ngo(
        client, db_session, email="create-verified@test.com", org="Create Kitchen"
    )
    created = post_requirement(client, kitchen)

    assert created["isVerified"] is True
    assert created["recipientName"] == "Create Kitchen"


# ─── Authentication is still required ────────────────────────────────────────

def test_an_unauthenticated_caller_cannot_read_the_board(client, board_of_two):
    assert client.get("/api/requirements").status_code == 401
