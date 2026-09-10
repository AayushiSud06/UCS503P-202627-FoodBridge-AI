"""Requirement-aware matching: what a standing need does, and what it must not.

A recipient's standing needs are now an input to ranking — but only as a
tie-break and an explanation. `DECISIONS.md` D-52 records why: a requirement
that reached `overall_score` would reach `Donation.match_score` with it, and
that column is frozen, platform-wide and read by callers who may not read
requirements at all. It would become an unscopeable disclosure channel in
exactly the way distance did (D-45, D-47).

So the central property this file pins is a **negative** one, asserted from both
ends of the stack: the five weighted criteria, their weights and the resulting
`overall_score` are byte-for-byte what they were, whatever a kitchen has posted.
Everything requirement-aware happens after that number, in the order candidates
come back and in the sentences beside them.

The matcher half runs against `foodlink.matching` directly, which is DB-free on
purpose (D-05). The API half runs through HTTP like the rest of the suite, and
carries the privacy boundary: a donor, a kitchen, a courier and an administrator
each read a different amount of a kitchen's demand.
"""

from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import event

from foodlink.matching import (
    WEIGHTS, best_requirement_fit, rank_recipients, score_pair, urgency_rank,
)
from foodlink.models import Donation, Recipient, Requirement

from conftest import admin_token, auth, register, register_ngo

CAMPUS = {"latitude": 30.3540, "longitude": 76.3630}
NEARBY = {"latitude": 30.3560, "longitude": 76.3650}

EPOCH = datetime(2026, 1, 1, tzinfo=timezone.utc)


def make_donation(*, quantity: int = 50, unit: str = "Meals", hours: float = 6) -> Donation:
    return Donation(
        food_name="Surplus Lunch",
        category="Vegetarian",
        quantity=quantity,
        unit=unit,
        storage_type="Room Temperature",
        description="",
        location="College Central Mess",
        pickup_deadline=datetime.now(timezone.utc) + timedelta(hours=hours),
        **CAMPUS,
    )


def make_kitchen(*, id: int = 1, capacity: int = 100, verified: bool = True) -> Recipient:
    return Recipient(
        id=id,
        name=f"Kitchen {id}",
        type="Community Kitchen",
        location="Model Town",
        capacity=capacity,
        is_verified=verified,
        accepted_donations=0,
        completed_donations=0,
        **NEARBY,
    )


def make_requirement(
    *,
    id: int = 1,
    quantity_needed: int = 120,
    unit: str = "Meals",
    urgency: str = "Medium",
    is_active: bool = True,
    age_days: int = 0,
    food_type: str = "Hot vegetarian meals",
    beneficiary_count: int = 140,
    daily_recurring: bool = False,
    notes: str = "Before 7 PM. No onion or garlic.",
) -> Requirement:
    """An unflushed requirement row.

    Every column defaulted at the database is set explicitly, because a row that
    has never been flushed carries `None` for each of them — including
    `is_active`, which the matcher filters on.
    """
    return Requirement(
        id=id,
        recipient_id=1,
        food_type=food_type,
        quantity_needed=quantity_needed,
        unit=unit,
        beneficiary_count=beneficiary_count,
        urgency=urgency,
        daily_recurring=daily_recurring,
        notes=notes,
        is_active=is_active,
        created_at=EPOCH + timedelta(days=age_days),
    )


def requirement_reasons(result) -> list[str]:
    """The reason lines that came from a standing need, and only those."""
    return [r for r in result.reasons if "standing need" in r]


# ─── The invariant: a requirement never moves the score ──────────────────────

def test_a_kitchen_with_no_requirements_scores_exactly_what_it_scored_before():
    """The whole feature rests on this: absent requirements, nothing changed."""
    now = datetime.now(timezone.utc)
    donation, kitchen = make_donation(), make_kitchen()

    before = score_pair(donation, kitchen, radius_km=8, now=now)
    after = score_pair(donation, kitchen, radius_km=8, now=now, requirements=[])

    assert before is not None and after is not None
    assert after.overall_score == before.overall_score
    assert after.reasons == before.reasons
    assert after.requirement_fit is None
    assert (
        after.distance_score,
        after.quantity_score,
        after.capacity_score,
        after.deadline_score,
        after.reliability_score,
    ) == (
        before.distance_score,
        before.quantity_score,
        before.capacity_score,
        before.deadline_score,
        before.reliability_score,
    )


@pytest.mark.parametrize(
    "requirement",
    [
        make_requirement(quantity_needed=50),  # a perfect fit
        make_requirement(quantity_needed=500, urgency="High"),  # a partial one
        make_requirement(unit="Boxes"),  # unassessable
        make_requirement(is_active=False),  # retired
    ],
    ids=["exact-fit", "partial-fit", "incomparable-unit", "retired"],
)
def test_no_requirement_of_any_kind_changes_the_weighted_sum(requirement):
    """`overall_score` is the published sum over five criteria and stays so.

    This is the property that keeps requirement-derived information out of
    `Donation.match_score`, and it holds for every shape a requirement can take.
    """
    now = datetime.now(timezone.utc)
    donation, kitchen = make_donation(), make_kitchen()

    plain = score_pair(donation, kitchen, radius_km=8, now=now)
    with_need = score_pair(
        donation, kitchen, radius_km=8, now=now, requirements=[requirement]
    )

    assert plain is not None and with_need is not None
    assert with_need.overall_score == plain.overall_score
    assert with_need.overall_score == round(
        with_need.distance_score * WEIGHTS["distance"]
        + with_need.quantity_score * WEIGHTS["quantity"]
        + with_need.capacity_score * WEIGHTS["capacity"]
        + with_need.deadline_score * WEIGHTS["deadline"]
        + with_need.reliability_score * WEIGHTS["reliability"]
    )


def test_the_published_weights_are_untouched_by_this_work():
    """Requirement-awareness was added without re-tuning anything."""
    assert WEIGHTS == {
        "distance": 0.25,
        "quantity": 0.25,
        "capacity": 0.20,
        "deadline": 0.15,
        "reliability": 0.15,
    }
    assert sum(WEIGHTS.values()) == pytest.approx(1.0)


# ─── Quantity fit, once the units agree ──────────────────────────────────────

def test_a_donation_that_covers_the_whole_stated_need_fits_completely():
    result = score_pair(
        make_donation(quantity=120),
        make_kitchen(capacity=200),
        radius_km=8,
        requirements=[make_requirement(quantity_needed=120)],
    )

    assert result is not None
    assert result.requirement_fit is not None
    assert result.requirement_fit.fit == 100
    assert requirement_reasons(result) == [
        "Matches a standing need this kitchen posted for 120 meals"
    ]


def test_a_donation_larger_than_the_need_is_not_penalised_for_it():
    """A standing need is a request, not a ceiling.

    Overflow is already priced against `Recipient.capacity` twice, by fit and by
    headroom. Charging for it a third time here would rebuild the collinearity
    D-42 had to remove.
    """
    exact = score_pair(
        make_donation(quantity=120),
        make_kitchen(capacity=400),
        radius_km=8,
        requirements=[make_requirement(quantity_needed=120)],
    )
    over = score_pair(
        make_donation(quantity=400),
        make_kitchen(capacity=400),
        radius_km=8,
        requirements=[make_requirement(quantity_needed=120)],
    )

    assert exact is not None and over is not None
    assert over.requirement_fit.fit == exact.requirement_fit.fit == 100


def test_a_partial_donation_is_worth_something_and_says_so():
    """Twenty meals against a need for a hundred and twenty is real help."""
    result = score_pair(
        make_donation(quantity=20),
        make_kitchen(),
        radius_km=8,
        requirements=[make_requirement(quantity_needed=120)],
    )

    assert result is not None
    assert result.requirement_fit.fit == 50  # 40 + 60 * (20/120)
    assert requirement_reasons(result) == [
        "Covers part of a standing need this kitchen posted for 120 meals"
    ]


def test_more_of_the_stated_need_covered_is_a_better_fit():
    def fit(quantity: int) -> int:
        result = score_pair(
            make_donation(quantity=quantity),
            make_kitchen(capacity=400),
            radius_km=8,
            requirements=[make_requirement(quantity_needed=200)],
        )
        return result.requirement_fit.fit

    assert fit(20) < fit(100) < fit(180) < fit(200) == 100


# ─── Units: comparable or abstain, never converted ───────────────────────────

@pytest.mark.parametrize("unit", ["Kg", "Boxes", "Pieces", "Crates"])
def test_a_need_in_another_unit_is_not_assessed_and_says_nothing(unit):
    """Nothing converts. 40 Boxes is not 40 meals and is not guessed at."""
    result = score_pair(
        make_donation(quantity=40, unit="Meals"),
        make_kitchen(),
        radius_km=8,
        requirements=[make_requirement(quantity_needed=40, unit=unit)],
    )

    assert result is not None
    assert result.requirement_fit is not None
    assert result.requirement_fit.fit is None
    assert requirement_reasons(result) == []


def test_units_are_compared_after_the_projects_existing_normalisation():
    """Trimmed and case-folded, exactly as `is_comparable_unit` does it."""
    result = score_pair(
        make_donation(quantity=40, unit="  meals "),
        make_kitchen(),
        radius_km=8,
        requirements=[make_requirement(quantity_needed=40, unit="MEALS")],
    )

    assert result.requirement_fit.fit == 100


def test_any_shared_unit_is_comparable_not_only_meals():
    """A requirement carries its own unit, unlike `Recipient.capacity`.

    So a donation in Boxes can be measured against a need in Boxes even though
    the two size criteria decline to measure it against capacity (D-42).
    """
    result = score_pair(
        make_donation(quantity=40, unit="Boxes"),
        make_kitchen(),
        radius_km=8,
        requirements=[make_requirement(quantity_needed=40, unit="Boxes")],
    )

    assert result.requirement_fit.fit == 100
    assert result.quantity_score == result.capacity_score == 50  # still unassessed
    assert requirement_reasons(result) == [
        "Matches a standing need this kitchen posted for 40 boxes"
    ]


def test_an_unassessable_need_is_not_an_eligibility_gate():
    """D-06 gates what a recipient may not act on. This is not that."""
    result = score_pair(
        make_donation(unit="Meals"),
        make_kitchen(),
        radius_km=8,
        requirements=[make_requirement(unit="Kg")],
    )

    assert result is not None


def test_having_no_requirement_at_all_is_not_an_eligibility_gate():
    assert score_pair(make_donation(), make_kitchen(), radius_km=8, requirements=[]) is not None


# ─── Which need, when there are several ──────────────────────────────────────

def test_a_retired_need_is_ignored_even_if_it_would_have_fitted_best():
    """It is off the demand board (D-29) and a donor may not read one (D-46)."""
    fit = best_requirement_fit(
        make_donation(quantity=50),
        [
            make_requirement(id=1, quantity_needed=50, is_active=False),
            make_requirement(id=2, quantity_needed=500, is_active=True),
        ],
    )

    assert fit is not None
    assert fit.requirement_id == 2


def test_all_requirements_retired_reads_as_no_requirement_at_all():
    assert (
        best_requirement_fit(
            make_donation(), [make_requirement(id=1, is_active=False)]
        )
        is None
    )


def test_the_best_fitting_need_is_the_one_the_donation_is_judged_against():
    fit = best_requirement_fit(
        make_donation(quantity=50),
        [
            make_requirement(id=1, quantity_needed=500),
            make_requirement(id=2, quantity_needed=50),
            make_requirement(id=3, quantity_needed=200),
        ],
    )

    assert fit.requirement_id == 2 and fit.fit == 100


def test_an_assessable_need_beats_an_unassessable_one_however_urgent():
    fit = best_requirement_fit(
        make_donation(quantity=20, unit="Meals"),
        [
            make_requirement(id=1, unit="Kg", urgency="High"),
            make_requirement(id=2, quantity_needed=500, unit="Meals", urgency="Low"),
        ],
    )

    assert fit.requirement_id == 2 and fit.fit is not None


def test_urgency_separates_two_needs_the_donation_fits_equally_well():
    fit = best_requirement_fit(
        make_donation(quantity=50),
        [
            make_requirement(id=1, quantity_needed=50, urgency="Low"),
            make_requirement(id=2, quantity_needed=50, urgency="High"),
            make_requirement(id=3, quantity_needed=50, urgency="Medium"),
        ],
    )

    assert fit.requirement_id == 2


def test_an_unrecognised_urgency_ranks_below_low_rather_than_raising():
    """`urgency` is `String(16)` with no enum, so anything can be stored."""
    assert urgency_rank("Critical") < urgency_rank("Low") < urgency_rank("Medium")
    assert urgency_rank("HIGH") == urgency_rank("high") == urgency_rank(" High ")

    fit = best_requirement_fit(
        make_donation(quantity=50),
        [
            make_requirement(id=1, quantity_needed=50, urgency="Critical"),
            make_requirement(id=2, quantity_needed=50, urgency="Low"),
        ],
    )
    assert fit.requirement_id == 2


def test_the_longest_standing_need_wins_when_fit_and_urgency_agree():
    fit = best_requirement_fit(
        make_donation(quantity=50),
        [
            make_requirement(id=1, quantity_needed=50, urgency="High", age_days=9),
            make_requirement(id=2, quantity_needed=50, urgency="High", age_days=1),
        ],
    )

    assert fit.requirement_id == 2  # posted first


def test_the_lowest_id_settles_a_need_that_ties_on_everything_else():
    """`created_at` is second-resolution on SQLite (D-44), so ties are real."""
    fit = best_requirement_fit(
        make_donation(quantity=50),
        [
            make_requirement(id=7, quantity_needed=50, urgency="High"),
            make_requirement(id=3, quantity_needed=50, urgency="High"),
            make_requirement(id=5, quantity_needed=50, urgency="High"),
        ],
    )

    assert fit.requirement_id == 3


def test_the_chosen_need_does_not_depend_on_the_order_they_are_supplied_in():
    """`Recipient.requirements` declares no `order_by`, so this matters."""
    requirements = [
        make_requirement(id=1, quantity_needed=500, urgency="High"),
        make_requirement(id=2, quantity_needed=50, urgency="Low"),
        make_requirement(id=3, quantity_needed=50, urgency="Low", age_days=5),
        make_requirement(id=4, unit="Kg", urgency="High"),
    ]
    donation = make_donation(quantity=50)

    chosen = set()
    rng = random.Random(20260910)
    for _ in range(25):
        shuffled = requirements[:]
        rng.shuffle(shuffled)
        chosen.add(best_requirement_fit(donation, shuffled).requirement_id)

    assert chosen == {2}


# ─── Ranking: a tie-break, and only a tie-break ──────────────────────────────

def two_identical_kitchens() -> tuple[Recipient, Recipient]:
    """Two kitchens the five weighted criteria cannot tell apart."""
    return make_kitchen(id=1), make_kitchen(id=2)


def test_a_matching_need_wins_a_tie_between_otherwise_identical_kitchens():
    donation = make_donation(quantity=50)
    first, second = two_identical_kitchens()

    ranked = rank_recipients(
        donation,
        [first, second],
        radius_km=8,
        requirements_by_recipient={2: [make_requirement(id=1, quantity_needed=50)]},
    )

    assert [r.recipient_id for r in ranked] == [2, 1]
    assert ranked[0].overall_score == ranked[1].overall_score


def test_a_need_never_overtakes_a_genuinely_better_score():
    """The headline stays the headline: no hidden bonus contradicts it."""
    donation = make_donation(quantity=50)
    strong = make_kitchen(id=1, capacity=150)  # scores higher on headroom
    weak = make_kitchen(id=2, capacity=50)

    ranked = rank_recipients(
        donation,
        [strong, weak],
        radius_km=8,
        requirements_by_recipient={2: [make_requirement(id=1, quantity_needed=50)]},
    )

    assert ranked[0].overall_score > ranked[1].overall_score
    assert [r.recipient_id for r in ranked] == [1, 2]


def test_an_active_but_unassessable_need_still_beats_no_need_at_all():
    donation = make_donation(quantity=50, unit="Meals")
    first, second = two_identical_kitchens()

    ranked = rank_recipients(
        donation,
        [first, second],
        radius_km=8,
        requirements_by_recipient={2: [make_requirement(id=1, unit="Kg")]},
    )

    assert [r.recipient_id for r in ranked] == [2, 1]


def test_urgency_breaks_a_tie_the_fit_cannot():
    donation = make_donation(quantity=50)
    first, second = two_identical_kitchens()

    ranked = rank_recipients(
        donation,
        [first, second],
        radius_km=8,
        requirements_by_recipient={
            1: [make_requirement(id=1, quantity_needed=50, urgency="Low")],
            2: [make_requirement(id=2, quantity_needed=50, urgency="High")],
        },
    )

    assert [r.recipient_id for r in ranked] == [2, 1]


def test_a_kitchen_with_no_need_is_ranked_not_dropped():
    donation = make_donation(quantity=50)
    first, second = two_identical_kitchens()

    ranked = rank_recipients(
        donation,
        [first, second],
        radius_km=8,
        requirements_by_recipient={1: [make_requirement(id=1, quantity_needed=50)]},
    )

    assert {r.recipient_id for r in ranked} == {1, 2}


def test_ranking_is_total_so_a_tie_cannot_depend_on_database_row_order():
    """Before this the sort was stable over whatever `select(Recipient)` gave."""
    donation = make_donation(quantity=50)
    kitchens = [make_kitchen(id=i) for i in (4, 2, 9, 7)]

    rng = random.Random(20260910)
    orders = set()
    for _ in range(25):
        shuffled = kitchens[:]
        rng.shuffle(shuffled)
        ranked = rank_recipients(donation, shuffled, radius_km=8)
        assert len({r.overall_score for r in ranked}) == 1  # genuinely tied
        orders.add(tuple(r.recipient_id for r in ranked))

    assert orders == {(2, 4, 7, 9)}


# ─── What a reason may say ───────────────────────────────────────────────────

def test_a_requirement_reason_names_only_what_the_fit_was_computed_from():
    """Not `notes`, not `beneficiaryCount`, not `foodType`, not the urgency.

    None of them is an input, so naming one would describe a kitchen's private
    demand without explaining anything. Urgency is left out for a second reason:
    it is self-declared and the posting form defaults it to `High`, so printing
    it back would advertise a field worth inflating.
    """
    result = score_pair(
        make_donation(quantity=50),
        make_kitchen(),
        radius_km=8,
        requirements=[
            make_requirement(
                quantity_needed=50,
                urgency="High",
                food_type="Hot vegetarian meals",
                beneficiary_count=140,
                daily_recurring=True,
                notes="Before 7 PM. No onion or garlic.",
            )
        ],
    )

    joined = " ".join(result.reasons)
    for secret in ("vegetarian meals", "140", "onion", "7 PM", "High", "daily"):
        assert secret not in joined


def test_requirement_reasons_never_collide_with_the_other_reason_lines():
    """`mobile/NGOAvailable.tsx` keys the rendered list on the string itself."""
    result = score_pair(
        make_donation(quantity=50),
        make_kitchen(capacity=150),
        radius_km=8,
        requirements=[make_requirement(quantity_needed=50)],
    )

    assert len(result.reasons) == len(set(result.reasons))
    assert len(requirement_reasons(result)) == 1


# ─── Through the API: the behaviour a kitchen actually sees ──────────────────

REQUIREMENT = {
    "foodType": "Hot vegetarian meals",
    "quantityNeeded": 200,
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


def post_donation(client, token: str, *, quantity: int = 50, unit: str = "Meals") -> int:
    response = client.post(
        "/api/donations",
        json={
            "foodName": "Vegetarian Thali Meals",
            "category": "Vegetarian",
            "quantity": quantity,
            "unit": unit,
            "storageType": "Room Temperature",
            "description": "",
            "location": "College Central Mess",
            "latitude": CAMPUS["latitude"],
            "longitude": CAMPUS["longitude"],
            "pickupDeadline": (
                datetime.now(timezone.utc) + timedelta(hours=6)
            ).isoformat(),
        },
        headers=auth(token),
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def viewer_reasons(client, token: str, donation_id: int) -> list[str]:
    response = client.get(f"/api/donations/{donation_id}", headers=auth(token))
    assert response.status_code == 200, response.text
    return response.json()["viewerMatch"]["reasons"]


def matches(client, token: str, donation_id: int) -> list[dict]:
    response = client.get(f"/api/donations/{donation_id}/matches", headers=auth(token))
    assert response.status_code == 200, response.text
    return response.json()


def needs_mentioned(rows: list[dict]) -> set[int]:
    """Which recipients this reader was told anything about the demand of."""
    return {
        row["recipientId"]
        for row in rows
        if any("standing need" in reason for reason in row["reasons"])
    }


@pytest.fixture
def donor(client):
    return register(client, email="donor@example.com", role="donor")


def test_a_kitchen_is_told_when_a_donation_answers_a_need_it_posted(client, db_session, donor):
    token, _ = register_ngo(client, db_session, email="own@ngo.org", org="Helping Hands")
    post_requirement(client, token, quantityNeeded=50)
    donation_id = post_donation(client, donor, quantity=50)

    assert "Matches a standing need this kitchen posted for 50 meals" in viewer_reasons(
        client, token, donation_id
    )


def test_editing_a_requirement_changes_the_next_matching_calculation(client, db_session, donor):
    """The complaint this task started from.

    A requirement edit used to change nothing about matching, because the
    matcher had never read one. It reads them now — live, per request, from the
    current row, so a revision shows up on the next calculation with nothing to
    invalidate or refresh.
    """
    token, _ = register_ngo(client, db_session, email="own@ngo.org", org="Helping Hands")
    requirement = post_requirement(client, token, quantityNeeded=200)
    donation_id = post_donation(client, donor, quantity=50)

    before = viewer_reasons(client, token, donation_id)
    assert "Covers part of a standing need this kitchen posted for 200 meals" in before

    response = client.patch(
        f"/api/requirements/{requirement['id']}",
        json={"quantityNeeded": 50},
        headers=auth(token),
    )
    assert response.status_code == 200, response.text

    after = viewer_reasons(client, token, donation_id)
    assert "Matches a standing need this kitchen posted for 50 meals" in after


def test_retiring_a_requirement_takes_it_out_of_matching_too(client, db_session, donor):
    token, _ = register_ngo(client, db_session, email="own@ngo.org", org="Helping Hands")
    requirement = post_requirement(client, token, quantityNeeded=50)
    donation_id = post_donation(client, donor, quantity=50)

    assert any("standing need" in r for r in viewer_reasons(client, token, donation_id))

    client.patch(
        f"/api/requirements/{requirement['id']}",
        json={"isActive": False},
        headers=auth(token),
    )

    assert not any("standing need" in r for r in viewer_reasons(client, token, donation_id))


def test_a_kitchen_with_no_requirement_reads_exactly_what_it_read_before(
    client, db_session, donor
):
    token, _ = register_ngo(client, db_session, email="own@ngo.org", org="Helping Hands")
    donation_id = post_donation(client, donor, quantity=50)

    response = client.get(f"/api/donations/{donation_id}", headers=auth(token))
    match = response.json()["viewerMatch"]

    assert match is not None
    assert not any("standing need" in r for r in match["reasons"])
    assert match["overallScore"] == round(
        match["distanceScore"] * 0.25
        + match["quantityScore"] * 0.25
        + match["capacityScore"] * 0.20
        + match["deadlineScore"] * 0.15
        + match["reliabilityScore"] * 0.15
    )


def test_the_frozen_score_is_the_same_number_whether_a_need_exists_or_not(
    client, db_session, donor
):
    """`Donation.match_score` must carry no requirement-derived information."""
    register_ngo(client, db_session, email="own@ngo.org", org="Helping Hands")
    without = post_donation(client, donor, quantity=50)

    token, _ = register_ngo(client, db_session, email="second@ngo.org", org="Umeed")
    post_requirement(client, token, quantityNeeded=50)
    with_need = post_donation(client, donor, quantity=50)

    admin = auth(admin_token(client, db_session))
    first = client.get(f"/api/donations/{without}", headers=admin).json()
    second = client.get(f"/api/donations/{with_need}", headers=admin).json()

    assert first["matchScore"] is not None
    assert second["matchScore"] == first["matchScore"]


# ─── Privacy: whose demand a reader may be told about ────────────────────────

@pytest.fixture
def two_kitchens_with_needs(client, db_session):
    """Two verified kitchens in range, each with an active standing need."""
    own_token, own_id = register_ngo(
        client, db_session, email="own@ngo.org", org="Helping Hands"
    )
    rival_token, rival_id = register_ngo(
        client, db_session, email="rival@ngo.org", org="Umeed Shelter",
        latitude=30.3450, longitude=76.3700,
    )
    post_requirement(client, own_token, quantityNeeded=50)
    post_requirement(client, rival_token, quantityNeeded=50)
    return {"own": (own_token, own_id), "rival": (rival_token, rival_id)}


def test_a_kitchen_is_told_about_its_own_demand_and_never_a_rivals(
    client, donor, two_kitchens_with_needs
):
    """`/matches` lists peers; a kitchen reads only its own board (D-44)."""
    own_token, own_id = two_kitchens_with_needs["own"]
    _, rival_id = two_kitchens_with_needs["rival"]
    donation_id = post_donation(client, donor, quantity=50)

    rows = matches(client, own_token, donation_id)

    assert {row["recipientId"] for row in rows} == {own_id, rival_id}
    assert needs_mentioned(rows) == {own_id}


def test_a_courier_gains_no_requirement_visibility_at_all(
    client, db_session, donor, two_kitchens_with_needs
):
    """A courier reads no requirements today and must not start here.

    `_readable_by` shows them every unclaimed `ACCEPTED` pickup, so `/matches`
    is reachable — which is what made them the strongest reader in D-47.
    """
    own_token, _ = two_kitchens_with_needs["own"]
    courier = register(client, email="courier@example.com", role="volunteer")
    donation_id = post_donation(client, donor, quantity=50)

    response = client.post(
        f"/api/donations/{donation_id}/status",
        json={"status": "ACCEPTED"},
        headers=auth(own_token),
    )
    assert response.status_code == 200, response.text

    rows = matches(client, courier, donation_id)

    assert rows  # the ranking itself is unchanged for them
    assert needs_mentioned(rows) == set()


def test_a_donor_is_told_about_the_needs_the_needs_board_already_shows_them(
    client, donor, two_kitchens_with_needs
):
    """Every ranked kitchen is verified, and a donor reads verified needs (D-44).

    So this discloses nothing the donor could not already read — which is why
    it is allowed rather than withheld.
    """
    _, own_id = two_kitchens_with_needs["own"]
    _, rival_id = two_kitchens_with_needs["rival"]
    donation_id = post_donation(client, donor, quantity=50)

    assert needs_mentioned(matches(client, donor, donation_id)) == {own_id, rival_id}


def test_an_administrator_is_told_about_every_kitchens_needs(
    client, db_session, donor, two_kitchens_with_needs
):
    _, own_id = two_kitchens_with_needs["own"]
    _, rival_id = two_kitchens_with_needs["rival"]
    donation_id = post_donation(client, donor, quantity=50)

    rows = matches(client, admin_token(client, db_session), donation_id)

    assert needs_mentioned(rows) == {own_id, rival_id}


def test_an_unverified_kitchens_need_reaches_nobody_through_matching(
    client, db_session, donor
):
    """`score_pair` gates on verification, so it is never ranked at all."""
    token, recipient_id = register_ngo(
        client, db_session, email="new@ngo.org", org="Unvouched Kitchen", verified=False
    )
    post_requirement(client, token, quantityNeeded=50)
    donation_id = post_donation(client, donor, quantity=50)

    rows = matches(client, donor, donation_id)

    assert recipient_id not in {row["recipientId"] for row in rows}


def test_no_reader_receives_a_requirement_field_on_the_wire(
    client, donor, two_kitchens_with_needs
):
    """The fit is internal: it reaches a client as prose or not at all."""
    donation_id = post_donation(client, donor, quantity=50)

    for row in matches(client, donor, donation_id):
        assert set(row) == {
            "recipientId", "recipientName", "overallScore", "distanceKm",
            "distanceScore", "quantityScore", "capacityScore", "deadlineScore",
            "reliabilityScore", "reasons",
        }


# ─── Loading: bounded queries, not one per row ───────────────────────────────

class RequirementQueryCounter:
    """Counts statements that read the `requirements` table."""

    def __init__(self, bind):
        self.bind = bind
        self.count = 0

    def _seen(self, conn, cursor, statement, parameters, context, executemany):
        normalised = " ".join(statement.split()).lower()
        if normalised.startswith("select") and "from requirements" in normalised:
            self.count += 1

    def __enter__(self):
        event.listen(self.bind, "before_cursor_execute", self._seen)
        return self

    def __exit__(self, *exc):
        event.remove(self.bind, "before_cursor_execute", self._seen)
        return False


def test_a_longer_donation_list_does_not_cost_more_requirement_queries(
    client, db_session, donor
):
    """The caller's own needs are resolved once per request, not per donation."""
    token, _ = register_ngo(client, db_session, email="own@ngo.org", org="Helping Hands")
    post_requirement(client, token, quantityNeeded=50)
    post_donation(client, donor, quantity=50)

    with RequirementQueryCounter(db_session.get_bind()) as counter:
        client.get("/api/donations", headers=auth(token))
        one_donation = counter.count

    for _ in range(5):
        post_donation(client, donor, quantity=50)

    with RequirementQueryCounter(db_session.get_bind()) as counter:
        response = client.get("/api/donations", headers=auth(token))
        six_donations = counter.count

    assert len(response.json()) == 6
    assert one_donation == six_donations == 1


def test_ranking_many_kitchens_loads_their_needs_in_one_query(client, db_session, donor):
    """`/matches` groups in Python rather than loading per candidate."""
    for i in range(4):
        token, _ = register_ngo(
            client, db_session, email=f"ngo{i}@ngo.org", org=f"Kitchen {i}",
            latitude=30.3400 + i * 0.001,
        )
        post_requirement(client, token, quantityNeeded=50)

    donation_id = post_donation(client, donor, quantity=50)

    with RequirementQueryCounter(db_session.get_bind()) as counter:
        rows = matches(client, donor, donation_id)

    assert len(rows) == 4
    assert counter.count == 1
