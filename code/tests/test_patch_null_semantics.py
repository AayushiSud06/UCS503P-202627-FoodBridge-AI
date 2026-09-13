"""What an explicit `null` means in a PATCH body (`TASKS.md` P2-3).

A PATCH field has three states, not two: left out of the body, sent as a value,
or sent as `null`. Leaving a field out never changes it. A value is applied. A
`null` clears the column only where the column can hold null — a pin, a contact
person, a phone number — and leaves a column that cannot alone, the rule D-29
set for requirements.

The defect this pins down: every self-service and admin PATCH other than the
requirement one wrote `null` straight into the row, so `{"name": null}` on
`PATCH /recipients/me` reached the database as a NOT NULL violation and came
back as a bare 500, which the client shows as "Cannot reach the FoodLink
server" (health audit 2026-09-10, reproduced).
"""

from __future__ import annotations

import pytest
from pydantic.alias_generators import to_camel

from conftest import admin_token, auth, register, register_ngo
from foodlink.models import Recipient, Requirement, User, UserRole, Volunteer
from foodlink.schemas import (
    ProfileUpdate, RecipientUpdate, RequirementUpdate, UserUpdate, VolunteerUpdate,
)


# ─── Accounts and rows under test ────────────────────────────────────────────

def stored(db_session, model, row_id: int, field: str):
    """The value in the database now, not the session's cached copy of it."""
    db_session.expire_all()
    return getattr(db_session.get(model, row_id), field)


def snapshot(db_session, model, row_id: int, fields) -> dict:
    db_session.expire_all()
    row = db_session.get(model, row_id)
    return {field: getattr(row, field) for field in fields}


def kitchen(client, db_session) -> tuple[str, int]:
    return register_ngo(client, db_session, email="kitchen@test.com", org="Helping Hands")


def courier(client) -> tuple[str, int]:
    token = register(client, email="courier@test.com", role="volunteer")
    return token, client.get("/api/auth/me", headers=auth(token)).json()["volunteerId"]


def donor(client) -> tuple[str, int]:
    token = register(client, email="donor@test.com", role="donor", org="Campus Mess")
    return token, client.get("/api/auth/me", headers=auth(token)).json()["id"]


def requirement(client, token: str) -> int:
    response = client.post(
        "/api/requirements",
        json={
            "foodType": "Hot meals", "quantityNeeded": 120, "unit": "Meals",
            "beneficiaryCount": 140, "urgency": "High", "dailyRecurring": True,
            "notes": "Before 7 PM.",
        },
        headers=auth(token),
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


#: Every PATCH endpoint, as `(schema, model)`. The coverage guard at the bottom
#: checks that the two tables below between them name every field of every one.
ENDPOINTS = {
    "recipient": (RecipientUpdate, Recipient),
    "volunteer": (VolunteerUpdate, Volunteer),
    "profile": (ProfileUpdate, User),
    "admin": (UserUpdate, User),
    "requirement": (RequirementUpdate, Requirement),
}

#: Fields whose column is NOT NULL: `null` must leave the stored value alone.
NOT_NULL_FIELDS = [
    ("recipient", "name"), ("recipient", "type"), ("recipient", "location"),
    ("recipient", "capacity"),
    ("volunteer", "is_available"), ("volunteer", "location"),
    ("profile", "name"),
    ("admin", "is_active"), ("admin", "role"), ("admin", "name"),
    ("requirement", "food_type"), ("requirement", "quantity_needed"),
    ("requirement", "unit"), ("requirement", "beneficiary_count"),
    ("requirement", "urgency"), ("requirement", "daily_recurring"),
    ("requirement", "notes"), ("requirement", "is_active"),
]

#: Fields whose column is nullable, with a valid value to set first: `null` must
#: clear them, as it always has.
NULLABLE_FIELDS = [
    ("recipient", "latitude", 30.35), ("recipient", "longitude", 76.39),
    ("recipient", "contact_person", "Asha"), ("recipient", "phone", "+91 98765 43210"),
    ("volunteer", "latitude", 30.35), ("volunteer", "longitude", 76.39),
    ("profile", "organization", "Campus Mess"), ("profile", "phone", "+91 98765 43210"),
    ("admin", "organization", "Campus Mess"), ("admin", "phone", "+91 98765 43210"),
]


def target(client, db_session, endpoint: str) -> tuple[str, dict, object, int]:
    """`(url, headers, model, row id)` for one fresh row behind `endpoint`."""
    if endpoint == "recipient":
        token, recipient_id = kitchen(client, db_session)
        return "/api/recipients/me", auth(token), Recipient, recipient_id
    if endpoint == "volunteer":
        token, volunteer_id = courier(client)
        return "/api/volunteers/me", auth(token), Volunteer, volunteer_id
    if endpoint == "profile":
        token, user_id = donor(client)
        return "/api/auth/me", auth(token), User, user_id
    if endpoint == "admin":
        _, user_id = donor(client)
        return f"/api/admin/users/{user_id}", auth(admin_token(client, db_session)), User, user_id
    token, _ = kitchen(client, db_session)
    requirement_id = requirement(client, token)
    return f"/api/requirements/{requirement_id}", auth(token), Requirement, requirement_id


# ─── The audit's reproduction ────────────────────────────────────────────────

def test_a_null_organisation_name_is_no_longer_a_server_error(client, db_session):
    token, recipient_id = kitchen(client, db_session)

    response = client.patch("/api/recipients/me", json={"name": None}, headers=auth(token))

    assert response.status_code == 200, response.text
    assert response.json()["name"] == "Helping Hands"
    assert stored(db_session, Recipient, recipient_id, "name") == "Helping Hands"


def test_a_null_courier_availability_is_no_longer_a_server_error(client, db_session):
    token, volunteer_id = courier(client)

    response = client.patch("/api/volunteers/me", json={"isAvailable": None}, headers=auth(token))

    assert response.status_code == 200, response.text
    assert response.json()["isAvailable"] is True
    assert stored(db_session, Volunteer, volunteer_id, "is_available") is True


# ─── Every field, every endpoint ─────────────────────────────────────────────

@pytest.mark.parametrize(
    "endpoint,field", NOT_NULL_FIELDS, ids=[f"{e}-{f}" for e, f in NOT_NULL_FIELDS]
)
def test_null_leaves_a_column_that_cannot_hold_null_unchanged(client, db_session, endpoint, field):
    url, headers, model, row_id = target(client, db_session, endpoint)
    columns = [c.key for c in model.__table__.columns]
    before = snapshot(db_session, model, row_id, columns)

    response = client.patch(url, json={to_camel(field): None}, headers=headers)

    assert response.status_code == 200, response.text
    assert snapshot(db_session, model, row_id, columns) == before


@pytest.mark.parametrize(
    "endpoint,field,value", NULLABLE_FIELDS, ids=[f"{e}-{f}" for e, f, _ in NULLABLE_FIELDS]
)
def test_null_still_clears_a_column_that_can_hold_null(client, db_session, endpoint, field, value):
    url, headers, model, row_id = target(client, db_session, endpoint)
    set_response = client.patch(url, json={to_camel(field): value}, headers=headers)
    assert set_response.status_code == 200, set_response.text
    assert stored(db_session, model, row_id, field) == value

    response = client.patch(url, json={to_camel(field): None}, headers=headers)

    assert response.status_code == 200, response.text
    assert stored(db_session, model, row_id, field) is None


# ─── The three states side by side ───────────────────────────────────────────

def test_a_nullable_field_omitted_null_and_valued(client, db_session):
    """Omitted keeps the phone, a value sets it, null clears it."""
    token, recipient_id = kitchen(client, db_session)

    def phone_after(body: dict):
        response = client.patch("/api/recipients/me", json=body, headers=auth(token))
        assert response.status_code == 200, response.text
        assert response.json()["phone"] == stored(db_session, Recipient, recipient_id, "phone")
        return response.json()["phone"]

    assert phone_after({"phone": "+91 98765 43210"}) == "+91 98765 43210"
    assert phone_after({"capacity": 180}) == "+91 98765 43210"
    assert phone_after({"phone": None}) is None


def test_a_field_that_cannot_hold_null_omitted_null_and_valued(client, db_session):
    """Omitted keeps the capacity, null keeps it, a value sets it."""
    token, recipient_id = kitchen(client, db_session)

    def capacity_after(body: dict):
        response = client.patch("/api/recipients/me", json=body, headers=auth(token))
        assert response.status_code == 200, response.text
        assert response.json()["capacity"] == stored(db_session, Recipient, recipient_id, "capacity")
        return response.json()["capacity"]

    assert capacity_after({"phone": "+91 98765 43210"}) == 150
    assert capacity_after({"capacity": None}) == 150
    assert capacity_after({"capacity": 180}) == 180


def test_an_empty_body_changes_nothing(client, db_session):
    token, recipient_id = kitchen(client, db_session)
    columns = [c.key for c in Recipient.__table__.columns]
    before = snapshot(db_session, Recipient, recipient_id, columns)

    response = client.patch("/api/recipients/me", json={}, headers=auth(token))

    assert response.status_code == 200, response.text
    assert snapshot(db_session, Recipient, recipient_id, columns) == before


def test_a_null_beside_real_changes_applies_only_the_real_changes(client, db_session):
    token, recipient_id = kitchen(client, db_session)

    response = client.patch(
        "/api/recipients/me",
        json={"name": None, "type": None, "capacity": 220, "phone": None, "contactPerson": "Asha"},
        headers=auth(token),
    )

    assert response.status_code == 200, response.text
    after = snapshot(
        db_session, Recipient, recipient_id,
        ["name", "type", "location", "capacity", "phone", "contact_person", "latitude"],
    )
    assert after == {
        "name": "Helping Hands", "type": "Community Kitchen", "location": "Model Town, Patiala",
        "capacity": 220, "phone": None, "contact_person": "Asha", "latitude": 30.34,
    }


def test_the_organisation_forms_own_save_still_clears_the_phone(client, db_session):
    """`NGOProfile` sends `phone: null` when the field is blank."""
    token, recipient_id = kitchen(client, db_session)
    client.patch("/api/recipients/me", json={"phone": "+91 98765 43210"}, headers=auth(token))

    response = client.patch(
        "/api/recipients/me",
        json={
            "name": "Helping Hands", "location": "Model Town, Patiala", "capacity": 150,
            "contactPerson": "Kitchen Lead", "phone": None,
        },
        headers=auth(token),
    )

    assert response.status_code == 200, response.text
    assert response.json()["phone"] is None
    assert response.json()["isVerified"] is True


# ─── A refused PATCH writes nothing ──────────────────────────────────────────

@pytest.mark.parametrize(
    "body",
    [
        {"name": None, "phone": None, "capacity": 0},
        {"latitude": None, "contactPerson": "Asha", "longitude": 500},
        {"type": None, "location": "Elsewhere", "name": ""},
    ],
    ids=["zero-capacity", "longitude-out-of-range", "empty-name"],
)
def test_an_invalid_value_beside_nulls_is_refused_and_writes_nothing(client, db_session, body):
    token, recipient_id = kitchen(client, db_session)
    client.patch("/api/recipients/me", json={"phone": "+91 98765 43210"}, headers=auth(token))
    columns = [c.key for c in Recipient.__table__.columns]
    before = snapshot(db_session, Recipient, recipient_id, columns)

    response = client.patch("/api/recipients/me", json=body, headers=auth(token))

    assert response.status_code == 422, response.text
    assert snapshot(db_session, Recipient, recipient_id, columns) == before


# ─── Rules that read the changes ─────────────────────────────────────────────

def test_a_null_name_is_not_a_rename_and_keeps_the_verification(client, db_session):
    """D-54 compares submitted values; a skipped null is not a submitted name."""
    token, _ = kitchen(client, db_session)

    response = client.patch("/api/recipients/me", json={"name": None}, headers=auth(token))

    assert response.status_code == 200, response.text
    assert response.json()["isVerified"] is True


def test_clearing_the_pin_still_voids_the_verification(client, db_session):
    """D-54: clearing a pin is a change to what was vouched for."""
    token, recipient_id = kitchen(client, db_session)

    response = client.patch("/api/recipients/me", json={"latitude": None}, headers=auth(token))

    assert response.status_code == 200, response.text
    assert response.json()["latitude"] is None
    assert response.json()["isVerified"] is False
    assert stored(db_session, Recipient, recipient_id, "is_verified") is False


def test_a_null_role_is_not_a_demotion(client, db_session):
    """Before, the lockout guard read `role: null` as a demotion and refused it."""
    root = admin_token(client, db_session)
    me = client.get("/api/auth/me", headers=auth(root)).json()

    for body in ({"role": None}, {"isActive": None}, {"role": None, "isActive": None}):
        response = client.patch(f"/api/admin/users/{me['id']}", json=body, headers=auth(root))
        assert response.status_code == 200, f"{body}: {response.text}"
        assert response.json()["role"] == "admin"
        assert response.json()["isActive"] is True

    assert stored(db_session, User, me["id"], "role") is UserRole.admin


def test_a_real_self_demotion_is_still_refused(client, db_session):
    root = admin_token(client, db_session)
    me = client.get("/api/auth/me", headers=auth(root)).json()

    response = client.patch(
        f"/api/admin/users/{me['id']}", json={"role": "donor", "name": None}, headers=auth(root)
    )

    assert response.status_code == 409, response.text
    assert stored(db_session, User, me["id"], "role") is UserRole.admin


# ─── Coverage guard ──────────────────────────────────────────────────────────

def test_every_patch_field_has_its_null_meaning_under_test():
    """A field added to an update schema must land in one of the two tables.

    Which one is not a choice made here: it is the column's own nullability.
    """
    covered = {(e, f) for e, f in NOT_NULL_FIELDS} | {(e, f) for e, f, _ in NULLABLE_FIELDS}
    for endpoint, (schema, model) in ENDPOINTS.items():
        for field in schema.model_fields:
            assert (endpoint, field) in covered, f"{endpoint}.{field} has no null test"
            nullable = model.__table__.columns[field].nullable
            listed_nullable = any(e == endpoint and f == field for e, f, _ in NULLABLE_FIELDS)
            assert nullable == listed_nullable, f"{endpoint}.{field} is in the wrong table"
