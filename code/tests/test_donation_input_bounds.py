"""Free text a donor or a kitchen submits is bounded at the schema (P2-2).

Every one of these strings is stored in the row and returned inline by the
lists that re-download after each write, so an unbounded one priced a single
account's payload into everyone else's next request. The audit stored a 2 MB
description, a 1 MB status note and a 200-character `unit` into a `String(24)`
column (which Postgres would answer with a 500).

The bounds, and where each number comes from:

* a field stored in a `String(n)` column is bounded at `n`, the column's own
  size — so the API never accepts what the database could not hold;
* a field stored in an unbounded `Text` column — a donation's description, a
  status note, a requirement's notes — is bounded at 2,000 characters, the
  shared ceiling the Project Manager set for Task 44.

`beneficiaryCount` lives on a standing requirement, not on a donation, and may
not be negative. Requirements are also the one PATCH path here: a donation
changes after posting only through `POST /donations/{id}/status`, whose note is
bounded like every other free text.

The refusals are FastAPI's ordinary 422 field errors, which `api.ts` already
turns into a sentence; nothing is truncated to fit.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import String, Text

from conftest import auth, register, register_ngo
from foodlink import schemas
from foodlink.models import Donation, Recipient, Requirement, StatusEvent

#: Stated here rather than imported, so these tests pin the contract instead of
#: agreeing with whatever the schema module happens to say.
FREE_TEXT_LIMIT = 2_000

DONATION_TEXT_LIMITS = [
    ("category", 60),
    ("unit", 24),
    ("storageType", 40),
    ("location", 255),
    ("description", FREE_TEXT_LIMIT),
]

REQUIREMENT_TEXT_LIMITS = [
    ("unit", 24),
    ("urgency", 16),
    ("notes", FREE_TEXT_LIMIT),
]

REQUIREMENT = {
    "foodType": "Hot vegetarian meals",
    "quantityNeeded": 120,
    "unit": "Meals",
    "beneficiaryCount": 140,
    "urgency": "High",
    "dailyRecurring": True,
    "notes": "Before 7 PM.",
}


def donation_body(**overrides) -> dict:
    return {
        "foodName": "Vegetarian Thali Meals",
        "category": "Vegetarian",
        "quantity": 50,
        "unit": "Meals",
        "storageType": "Room Temperature",
        "description": "Surplus from lunch service.",
        "location": "College Central Mess",
        "latitude": 30.3540,
        "longitude": 76.3630,
        "pickupDeadline": (datetime.now(timezone.utc) + timedelta(hours=6)).isoformat(),
        **overrides,
    }


def assert_refused_for(response, field: str, error_type: str) -> None:
    """The ordinary FastAPI validation response, naming the wire field."""
    assert response.status_code == 422, response.text
    detail = response.json()["detail"]
    assert isinstance(detail, list), detail
    assert any(
        entry["loc"] == ["body", field] and entry["type"] == error_type for entry in detail
    ), detail


def my_donations(client, token: str) -> list[dict]:
    response = client.get("/api/donations?mine=true", headers=auth(token))
    assert response.status_code == 200, response.text
    return response.json()


def my_board(client, token: str) -> list[dict]:
    response = client.get("/api/requirements", headers=auth(token))
    assert response.status_code == 200, response.text
    return response.json()


def post_requirement(client, token: str, **overrides):
    return client.post(
        "/api/requirements", json={**REQUIREMENT, **overrides}, headers=auth(token)
    )


@pytest.fixture
def donor(client) -> str:
    return register(client, email="bounds-donor@test.com", role="donor")


@pytest.fixture
def kitchen(client, db_session) -> str:
    # Posting and editing a need does not depend on verification, so this skips
    # the administrator step and its extra bcrypt round.
    token, _ = register_ngo(
        client, db_session, email="bounds-kitchen@test.com", org="Bounds Kitchen", verified=False
    )
    return token


# ─── Donation creation ───────────────────────────────────────────────────────

@pytest.mark.parametrize(("field", "limit"), DONATION_TEXT_LIMITS)
def test_a_donation_text_field_is_accepted_up_to_its_limit_and_refused_past_it(
    client, donor, field, limit
):
    for length in (limit - 1, limit):
        value = "x" * length
        response = client.post(
            "/api/donations", json=donation_body(**{field: value}), headers=auth(donor)
        )
        assert response.status_code == 201, f"{field} at {length}: {response.text}"
        assert response.json()[field] == value

    response = client.post(
        "/api/donations", json=donation_body(**{field: "x" * (limit + 1)}), headers=auth(donor)
    )
    assert_refused_for(response, field, "string_too_long")

    # Refused whole, not stored cut down to size.
    assert len(my_donations(client, donor)) == 2


def test_the_audit_payloads_are_refused_at_donation_creation(client, donor):
    two_megabytes = "x" * (2 * 1024 * 1024)
    response = client.post(
        "/api/donations", json=donation_body(description=two_megabytes), headers=auth(donor)
    )
    assert_refused_for(response, "description", "string_too_long")

    response = client.post(
        "/api/donations", json=donation_body(unit="x" * 200), headers=auth(donor)
    )
    assert_refused_for(response, "unit", "string_too_long")

    assert my_donations(client, donor) == []


def test_optional_donation_text_keeps_its_defaults(client, donor):
    body = donation_body()
    for field in ("description", "unit", "storageType"):
        del body[field]

    response = client.post("/api/donations", json=body, headers=auth(donor))
    assert response.status_code == 201, response.text
    created = response.json()
    assert created["description"] == ""
    assert created["unit"] == "Meals"
    assert created["storageType"] == "Room Temperature"

    response = client.post(
        "/api/donations", json=donation_body(description=""), headers=auth(donor)
    )
    assert response.status_code == 201, response.text
    assert response.json()["description"] == ""


# ─── Status notes ────────────────────────────────────────────────────────────

def test_a_status_note_past_the_limit_is_refused_and_changes_nothing(client, donor):
    donation = client.post("/api/donations", json=donation_body(), headers=auth(donor)).json()
    before = my_donations(client, donor)

    response = client.post(
        f"/api/donations/{donation['id']}/status",
        json={"status": "CANCELLED", "note": "x" * (FREE_TEXT_LIMIT + 1)},
        headers=auth(donor),
    )
    assert_refused_for(response, "note", "string_too_long")
    assert my_donations(client, donor) == before

    at_limit = "x" * FREE_TEXT_LIMIT
    response = client.post(
        f"/api/donations/{donation['id']}/status",
        json={"status": "CANCELLED", "note": at_limit},
        headers=auth(donor),
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "CANCELLED"
    assert body["events"][-1]["note"] == at_limit


def test_the_audit_status_note_is_refused(client, donor):
    donation = client.post("/api/donations", json=donation_body(), headers=auth(donor)).json()

    response = client.post(
        f"/api/donations/{donation['id']}/status",
        json={"status": "CANCELLED", "note": "x" * (1024 * 1024)},
        headers=auth(donor),
    )
    assert_refused_for(response, "note", "string_too_long")


def test_short_and_omitted_status_notes_are_recorded_as_before(client, donor):
    noted = client.post("/api/donations", json=donation_body(), headers=auth(donor)).json()
    silent = client.post("/api/donations", json=donation_body(), headers=auth(donor)).json()

    response = client.post(
        f"/api/donations/{noted['id']}/status",
        json={"status": "CANCELLED", "note": "Collected internally"},
        headers=auth(donor),
    )
    assert response.status_code == 200, response.text
    assert response.json()["events"][-1]["note"] == "Collected internally"

    response = client.post(
        f"/api/donations/{silent['id']}/status",
        json={"status": "CANCELLED"},
        headers=auth(donor),
    )
    assert response.status_code == 200, response.text
    assert response.json()["events"][-1]["note"] is None


# ─── Requirement text ────────────────────────────────────────────────────────

@pytest.mark.parametrize(("field", "limit"), REQUIREMENT_TEXT_LIMITS)
def test_a_requirement_text_field_is_accepted_up_to_its_limit_and_refused_past_it(
    client, kitchen, field, limit
):
    for length in (limit - 1, limit):
        value = "x" * length
        response = post_requirement(client, kitchen, **{field: value})
        assert response.status_code == 201, f"{field} at {length}: {response.text}"
        assert response.json()[field] == value

    response = post_requirement(client, kitchen, **{field: "x" * (limit + 1)})
    assert_refused_for(response, field, "string_too_long")

    assert len(my_board(client, kitchen)) == 2


@pytest.mark.parametrize(("field", "limit"), REQUIREMENT_TEXT_LIMITS)
def test_a_requirement_patch_is_held_to_the_same_limits(client, kitchen, field, limit):
    requirement = post_requirement(client, kitchen).json()
    url = f"/api/requirements/{requirement['id']}"

    # Paired with a valid change, so a partial write would show.
    response = client.patch(
        url, json={"quantityNeeded": 999, field: "x" * (limit + 1)}, headers=auth(kitchen)
    )
    assert_refused_for(response, field, "string_too_long")
    assert my_board(client, kitchen) == [requirement]

    for length in (limit, limit - 1):
        value = "x" * length
        response = client.patch(url, json={field: value}, headers=auth(kitchen))
        assert response.status_code == 200, f"{field} at {length}: {response.text}"
        assert response.json()[field] == value


def test_omitted_requirement_text_keeps_its_defaults(client, kitchen):
    response = client.post(
        "/api/requirements",
        json={"foodType": "Dry rations", "quantityNeeded": 10},
        headers=auth(kitchen),
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["unit"] == "Meals"
    assert body["urgency"] == "Medium"
    assert body["notes"] == ""
    assert body["beneficiaryCount"] == 0


# ─── Beneficiary count ───────────────────────────────────────────────────────

def test_zero_and_positive_beneficiary_counts_are_accepted(client, kitchen):
    for count in (0, 1, 140):
        response = post_requirement(client, kitchen, beneficiaryCount=count)
        assert response.status_code == 201, f"{count}: {response.text}"
        assert response.json()["beneficiaryCount"] == count


def test_a_negative_beneficiary_count_is_refused_on_create(client, kitchen):
    for count in (-1, -140):
        response = post_requirement(client, kitchen, beneficiaryCount=count)
        assert_refused_for(response, "beneficiaryCount", "greater_than_equal")

    assert my_board(client, kitchen) == []


def test_a_negative_beneficiary_count_is_refused_on_patch_and_changes_nothing(client, kitchen):
    requirement = post_requirement(client, kitchen).json()
    url = f"/api/requirements/{requirement['id']}"

    response = client.patch(
        url, json={"notes": "Changed", "beneficiaryCount": -1}, headers=auth(kitchen)
    )
    assert_refused_for(response, "beneficiaryCount", "greater_than_equal")
    assert my_board(client, kitchen) == [requirement]

    for count in (0, 75):
        response = client.patch(url, json={"beneficiaryCount": count}, headers=auth(kitchen))
        assert response.status_code == 200, response.text
        assert response.json()["beneficiaryCount"] == count


def test_a_null_beneficiary_count_on_patch_still_leaves_it_alone(client, kitchen):
    requirement = post_requirement(client, kitchen).json()

    response = client.patch(
        f"/api/requirements/{requirement['id']}",
        json={"beneficiaryCount": None, "notes": "Still 140 people"},
        headers=auth(kitchen),
    )
    assert response.status_code == 200, response.text
    assert response.json()["beneficiaryCount"] == REQUIREMENT["beneficiaryCount"]
    assert response.json()["notes"] == "Still 140 people"


# ─── Stored rows and columns ─────────────────────────────────────────────────

def test_a_requirement_stored_before_the_bounds_still_reads_and_edits(
    client, db_session, kitchen
):
    """The bounds apply to what is submitted, never to what is served back.

    A row posted before this change — a negative count from the desktop form,
    or an over-long unit on SQLite, which does not enforce `String(n)` — must
    not turn its organisation's board, or the donor board, into a 500.
    """
    recipient = db_session.query(Recipient).filter_by(name="Bounds Kitchen").one()
    legacy = Requirement(
        recipient_id=recipient.id,
        food_type="Legacy need",
        quantity_needed=10,
        unit="x" * 30,
        beneficiary_count=-5,
        urgency="x" * 20,
        notes="x" * (FREE_TEXT_LIMIT + 500),
    )
    db_session.add(legacy)
    db_session.commit()

    [row] = my_board(client, kitchen)
    assert row["beneficiaryCount"] == -5
    assert row["unit"] == "x" * 30
    assert len(row["notes"]) == FREE_TEXT_LIMIT + 500

    response = client.patch(
        f"/api/requirements/{legacy.id}", json={"beneficiaryCount": 12}, headers=auth(kitchen)
    )
    assert response.status_code == 200, response.text
    assert response.json()["beneficiaryCount"] == 12
    assert response.json()["urgency"] == "x" * 20


INPUT_SCHEMAS = [
    (schemas.DonationCreate, Donation),
    (schemas.StatusUpdate, StatusEvent),
    (schemas.RequirementCreate, Requirement),
    (schemas.RequirementUpdate, Requirement),
]


def _max_length(field) -> int | None:
    return next(
        (m.max_length for m in field.metadata if getattr(m, "max_length", None) is not None),
        None,
    )


@pytest.mark.parametrize(("schema", "model"), INPUT_SCHEMAS, ids=lambda x: x.__name__)
def test_every_stored_text_input_is_bounded_and_fits_its_column(schema, model):
    columns = model.__table__.columns
    checked = 0
    for name, field in schema.model_fields.items():
        if field.annotation not in (str, str | None) or name not in columns:
            continue
        column_type = columns[name].type
        bound = _max_length(field)
        assert bound is not None, f"{schema.__name__}.{name} has no max_length"
        if isinstance(column_type, String) and not isinstance(column_type, Text):
            assert column_type.length is not None
            assert bound <= column_type.length, (
                f"{schema.__name__}.{name} allows {bound}, column holds {column_type.length}"
            )
        checked += 1
    assert checked, f"no stored text fields found on {schema.__name__}"
