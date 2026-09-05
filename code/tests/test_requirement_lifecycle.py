"""Who may change a standing requirement after it has been posted.

Creation and listing were covered in `test_api.py` from the start; these cover
the rest of the life of a requirement — revising one, taking one off the board,
and putting it back. The property under test throughout is that holding the
`ngo` role is not permission to touch a requirement: belonging to the
organisation that posted it is.
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
def two_kitchens(client, db_session):
    """Two organisations, each with one requirement of its own on the board."""
    mine, _ = register_ngo(client, db_session, email="mine-req@test.com", org="My Kitchen")
    theirs, _ = register_ngo(client, db_session, email="their-req@test.com", org="Rival Kitchen")
    return mine, post_requirement(client, mine), theirs, post_requirement(client, theirs)


# ─── Editing ─────────────────────────────────────────────────────────────────

def test_an_ngo_can_revise_its_own_requirement(client, two_kitchens):
    mine, req, _, _ = two_kitchens

    response = client.patch(
        f"/api/requirements/{req['id']}",
        json={"quantityNeeded": 200, "urgency": "Medium"},
        headers=auth(mine),
    )
    assert response.status_code == 200, response.text

    body = response.json()
    assert body["quantityNeeded"] == 200
    assert body["urgency"] == "Medium"
    assert body["id"] == req["id"]
    assert body["recipientName"] == "My Kitchen"


def test_fields_left_out_of_the_patch_are_left_alone(client, two_kitchens):
    mine, req, _, _ = two_kitchens

    body = client.patch(
        f"/api/requirements/{req['id']}",
        json={"notes": "Now needed by 6 PM."},
        headers=auth(mine),
    ).json()

    assert body["notes"] == "Now needed by 6 PM."
    assert body["foodType"] == REQUIREMENT["foodType"]
    assert body["quantityNeeded"] == REQUIREMENT["quantityNeeded"]
    assert body["beneficiaryCount"] == REQUIREMENT["beneficiaryCount"]
    assert body["dailyRecurring"] is True
    assert body["isActive"] is True


def test_an_ngo_cannot_revise_another_organisations_requirement(client, two_kitchens):
    mine, _, theirs, their_req = two_kitchens

    response = client.patch(
        f"/api/requirements/{their_req['id']}",
        json={"quantityNeeded": 1},
        headers=auth(mine),
    )
    # A 404 rather than a 403: a rival kitchen's id should not be confirmable
    # by trying to edit it. Same rule as an unreadable donation id.
    assert response.status_code == 404, response.text

    theirs_board = board(client, theirs)
    still_there = [r for r in theirs_board if r["id"] == their_req["id"]][0]
    assert still_there["quantityNeeded"] == REQUIREMENT["quantityNeeded"]


def test_editing_a_requirement_that_does_not_exist_is_a_404(client, two_kitchens):
    mine, req, _, _ = two_kitchens
    response = client.patch(
        f"/api/requirements/{req['id'] + 500}", json={"urgency": "Low"}, headers=auth(mine)
    )
    assert response.status_code == 404, response.text


# ─── Who may mutate at all ───────────────────────────────────────────────────

def test_a_donor_cannot_change_a_requirement(client, two_kitchens):
    _, req, _, _ = two_kitchens
    donor = register(client, email="donor-req@test.com", role="donor")

    response = client.patch(
        f"/api/requirements/{req['id']}", json={"quantityNeeded": 1}, headers=auth(donor)
    )
    assert response.status_code == 403, response.text


def test_a_courier_cannot_change_a_requirement(client, two_kitchens):
    _, req, _, _ = two_kitchens
    courier = register(client, email="courier-req@test.com", role="volunteer")

    response = client.patch(
        f"/api/requirements/{req['id']}", json={"isActive": False}, headers=auth(courier)
    )
    assert response.status_code == 403, response.text


def test_an_unauthenticated_caller_cannot_change_a_requirement(client, two_kitchens):
    _, req, _, _ = two_kitchens
    response = client.patch(f"/api/requirements/{req['id']}", json={"urgency": "Low"})
    assert response.status_code == 401, response.text


def test_an_administrator_has_no_organisation_to_edit_requirements_for(
    client, db_session, two_kitchens
):
    """The same answer `POST /api/requirements` already gives an administrator.

    Admin passes the role gate on both routes and then fails the ownership
    lookup, because vouching for organisations — not posting demand — is the
    admin's job and no admin account is linked to a recipient organisation.
    """
    _, req, _, _ = two_kitchens
    admin = admin_token(client, db_session)

    response = client.patch(
        f"/api/requirements/{req['id']}", json={"urgency": "Low"}, headers=auth(admin)
    )
    assert response.status_code == 422, response.text


# ─── Retiring and reopening ──────────────────────────────────────────────────

def test_retiring_a_requirement_takes_it_off_the_board(client, two_kitchens):
    mine, req, _, _ = two_kitchens
    assert req["id"] in board_ids(client, mine)

    response = client.patch(
        f"/api/requirements/{req['id']}", json={"isActive": False}, headers=auth(mine)
    )
    assert response.status_code == 200, response.text
    assert response.json()["isActive"] is False

    # `GET /api/requirements` filters on the same flag, so retiring is all it
    # takes to leave the board — for its owner and for everyone else.
    assert req["id"] not in board_ids(client, mine)


def test_a_retired_requirement_is_kept_and_can_be_reopened(client, two_kitchens):
    mine, req, _, _ = two_kitchens
    client.patch(f"/api/requirements/{req['id']}", json={"isActive": False}, headers=auth(mine))

    reopened = client.patch(
        f"/api/requirements/{req['id']}", json={"isActive": True}, headers=auth(mine)
    )
    assert reopened.status_code == 200, reopened.text

    # The row was never deleted, so everything it recorded is still there.
    body = reopened.json()
    assert body["isActive"] is True
    assert body["foodType"] == REQUIREMENT["foodType"]
    assert body["notes"] == REQUIREMENT["notes"]
    assert req["id"] in board_ids(client, mine)


def test_an_ngo_cannot_retire_another_organisations_requirement(client, two_kitchens):
    mine, _, theirs, their_req = two_kitchens

    response = client.patch(
        f"/api/requirements/{their_req['id']}", json={"isActive": False}, headers=auth(mine)
    )
    assert response.status_code == 404, response.text
    assert their_req["id"] in board_ids(client, theirs)


def test_retiring_one_requirement_leaves_the_rest_of_the_board_alone(client, two_kitchens):
    """Retirement is per-requirement, not per-board.

    This used to also assert that the rival kitchen's requirement stayed on
    *this* caller's board, which was true only because `GET /api/requirements`
    was unscoped. Since D-44 an organisation reads its own needs and nothing
    else, so the surviving requirement to check is this kitchen's second one —
    and the rival's is checked on the rival's own board, where it belongs.
    """
    mine, req, theirs, their_req = two_kitchens
    second = post_requirement(client, mine, foodType="Dry rations")

    client.patch(f"/api/requirements/{req['id']}", json={"isActive": False}, headers=auth(mine))

    remaining = board_ids(client, mine)
    assert second["id"] in remaining
    assert req["id"] not in remaining
    assert their_req["id"] in board_ids(client, theirs)


# ─── Validation ──────────────────────────────────────────────────────────────

def test_a_quantity_that_could_not_be_posted_cannot_be_edited_in(client, two_kitchens):
    mine, req, _, _ = two_kitchens
    response = client.patch(
        f"/api/requirements/{req['id']}", json={"quantityNeeded": 0}, headers=auth(mine)
    )
    assert response.status_code == 422, response.text


def test_a_food_type_cannot_be_emptied(client, two_kitchens):
    mine, req, _, _ = two_kitchens
    response = client.patch(
        f"/api/requirements/{req['id']}", json={"foodType": ""}, headers=auth(mine)
    )
    assert response.status_code == 422, response.text


def test_an_explicit_null_leaves_the_field_alone_rather_than_clearing_it(client, two_kitchens):
    """No requirement column is nullable, so `null` cannot mean "clear this"."""
    mine, req, _, _ = two_kitchens
    response = client.patch(
        f"/api/requirements/{req['id']}", json={"notes": None, "unit": None}, headers=auth(mine)
    )
    assert response.status_code == 200, response.text
    assert response.json()["notes"] == REQUIREMENT["notes"]
    assert response.json()["unit"] == REQUIREMENT["unit"]
