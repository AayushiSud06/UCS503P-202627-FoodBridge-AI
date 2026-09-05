"""The matcher's size criteria: what they measure, and what they refuse to.

Unit tests on the pure functions in `foodlink.matching`. Everything else in the
suite reaches the matcher through HTTP; these do not, because two of the defects
covered here are only visible in the arithmetic — `matching.py` is deliberately
DB-free precisely so it can be exercised this way (`DECISIONS.md` D-05).

Two corrections are pinned here.

**Units.** `Recipient.capacity` counts meals — the product says so in three
places and there is no `capacity_unit` column. `Donation.unit` is free text and
the picker offers Meals, Kg, Boxes and Pieces. Only Meals is comparable, nothing
in the repository can convert the others, so the size criteria report themselves
unassessed rather than pretending 100 Kg is 100 meals.

**Collinearity.** `_quantity_score` and `_capacity_score` were both monotone in
`quantity / capacity`, in opposite directions — one criterion counted twice, on
45% of the published weight. Fit is still the ratio; headroom is now the
absolute meals left over, which is the information the ratio discards.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from foodlink.matching import (
    CAPACITY_UNIT, FULL_HEADROOM_MEALS, UNASSESSED_SIZE_SCORE, WEIGHTS,
    _capacity_score, _quantity_score, is_comparable_unit, score_pair,
)
from foodlink.models import Donation, Recipient

CAMPUS = {"latitude": 30.3540, "longitude": 76.3630}
NEARBY = {"latitude": 30.3560, "longitude": 76.3650}


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


def make_kitchen(*, capacity: int = 100, verified: bool = True) -> Recipient:
    return Recipient(
        name="Helping Hands",
        type="Community Kitchen",
        location="Model Town",
        capacity=capacity,
        is_verified=verified,
        accepted_donations=0,
        completed_donations=0,
        **NEARBY,
    )


# ─── Fit: the relative question ──────────────────────────────────────────────

def test_fit_peaks_when_the_donation_just_fills_the_kitchen():
    assert _quantity_score(100, 100) == 100


def test_fit_falls_away_on_both_sides_of_a_full_kitchen():
    """Under-filling wastes a trip; over-filling leaves food nobody can use."""
    assert _quantity_score(20, 100) < _quantity_score(80, 100) < _quantity_score(100, 100)
    assert _quantity_score(120, 100) < _quantity_score(100, 100)


def test_fit_penalises_overflow_twice_as_steeply_as_underfill():
    """Preserved shape: 40 at empty, 100 at full, -120 per unit ratio above."""
    assert _quantity_score(0, 100) == 40
    assert _quantity_score(150, 100) == 40  # 100 - 120 * 0.5
    assert _quantity_score(300, 100) == 0


def test_fit_is_zero_rather_than_undefined_for_a_kitchen_with_no_capacity():
    assert _quantity_score(50, 0) == 0
    assert _quantity_score(50, -10) == 0


# ─── Headroom: the absolute question ─────────────────────────────────────────

def test_headroom_is_the_meals_left_over_not_the_proportion():
    """The correction. 100 spare meals is 100 spare meals at any kitchen size."""
    assert _capacity_score(0, FULL_HEADROOM_MEALS) == 100
    assert _capacity_score(50, 100) == 50   # 50 spare
    assert _capacity_score(75, 100) == 25   # 25 spare


def test_headroom_saturates_once_a_full_days_room_remains():
    assert _capacity_score(0, FULL_HEADROOM_MEALS) == 100
    assert _capacity_score(0, FULL_HEADROOM_MEALS * 10) == 100
    assert _capacity_score(500, 1000) == 100  # 500 spare, well past saturation


def test_headroom_is_zero_when_the_donation_does_not_fit():
    """Preserved: a donation larger than capacity leaves no room at all."""
    assert _capacity_score(101, 100) == 0
    assert _capacity_score(100, 100) == 0
    assert _capacity_score(50, 0) == 0


# ─── The two are no longer one criterion counted twice ───────────────────────

def test_the_same_fit_can_carry_very_different_headroom():
    """The property the old implementation could not express.

    Three kitchens, all filled to exactly 90% by their donation, so `fit` is
    identical for all three by construction. What differs is how much room each
    keeps — 1 meal, 10 meals, 100 meals — and that is what decides whether the
    kitchen can still take anything else today.
    """
    small = (9, 10)
    medium = (90, 100)
    large = (900, 1000)

    fits = {_quantity_score(q, c) for q, c in (small, medium, large)}
    headrooms = [_capacity_score(q, c) for q, c in (small, medium, large)]

    assert len(fits) == 1, "same ratio must still mean the same fit"
    assert headrooms == sorted(headrooms) and len(set(headrooms)) == 3


#: The axis the matcher actually ranks on: `rank_recipients` scores **one**
#: donation against **many** kitchens, so `quantity` is fixed and `capacity`
#: varies. Independence has to hold here or the pair cannot separate candidates.
CANDIDATE_CAPACITIES = (60, 80, 100, 150, 300, 1000)


def test_headroom_is_not_an_affine_function_of_fit_across_candidates():
    """The precise defect: `capacity_score = a * quantity_score + b` held exactly.

    Two samples fix any affine map; a third that misses it proves there is none.
    Under the old implementation every pairing satisfied
    `capacity_score = 100 - (5/6)(quantity_score - 40)`, so this could not pass.
    """
    points = [(_quantity_score(50, c), _capacity_score(50, c)) for c in (60, 100, 150)]
    (f0, c0), (f1, c1), (f2, c2) = points

    slope = (c1 - c0) / (f1 - f0)
    predicted = c0 + slope * (f2 - f0)

    assert abs(predicted - c2) > 1, f"still collinear: {points}"


def test_the_two_criteria_separate_candidates_far_better_than_they_did():
    """Together they used to carry almost no signal between kitchens.

    For one donation across a realistic spread of kitchen sizes, the old pair
    moved 34.1 -> 30.35 out of 45 — under four points, and monotone, so 45% of
    the published weight amounted to a weak "prefer the smaller kitchen".
    """
    def contribution(capacity: int) -> float:
        return (
            _quantity_score(50, capacity) * WEIGHTS["quantity"]
            + _capacity_score(50, capacity) * WEIGHTS["capacity"]
        )

    band = [contribution(c) for c in CANDIDATE_CAPACITIES]

    assert max(band) - min(band) > 8


def test_the_pair_now_prefers_a_kitchen_that_both_fits_and_keeps_room():
    """Two criteria pulling different ways produce an interior optimum.

    Fit alone would always pick the smallest kitchen the donation fits in;
    headroom alone would always pick the largest. Because they are now
    independent, the best candidate for 50 meals is neither extreme — it is the
    kitchen that takes the donation comfortably *and* still has a day's room
    left. A single criterion counted twice cannot produce this shape.
    """
    def contribution(capacity: int) -> float:
        return (
            _quantity_score(50, capacity) * WEIGHTS["quantity"]
            + _capacity_score(50, capacity) * WEIGHTS["capacity"]
        )

    scored = {c: contribution(c) for c in CANDIDATE_CAPACITIES}
    best = max(scored, key=scored.__getitem__)

    assert best not in (min(CANDIDATE_CAPACITIES), max(CANDIDATE_CAPACITIES))
    assert scored[best] > scored[60] and scored[best] > scored[1000]


def test_within_one_kitchen_the_two_still_trade_off_against_each_other():
    """Not a residual defect — this opposition is the point of two criteria.

    For a *fixed* kitchen, a larger donation fits better and leaves less room.
    Both are true, and a weighted sum exists to trade them off. What was wrong
    before was that the opposition was exactly proportional at every scale, so
    the pair cancelled to a near-constant everywhere instead of only here.
    """
    fits = [_quantity_score(q, 200) for q in (40, 100, 160)]
    headrooms = [_capacity_score(q, 200) for q in (40, 100, 160)]

    assert fits == sorted(fits)
    assert headrooms == sorted(headrooms, reverse=True)


# ─── Units ───────────────────────────────────────────────────────────────────

def test_meals_is_the_only_unit_comparable_with_capacity():
    assert is_comparable_unit(CAPACITY_UNIT)
    assert is_comparable_unit("meals")
    assert is_comparable_unit("  Meals  ")
    for unit in ("Kg", "Boxes", "Pieces", "", "portions", "kg"):
        assert not is_comparable_unit(unit), unit


def test_a_hundred_kg_is_not_scored_as_a_hundred_meals():
    """The defect, stated as the product would state it."""
    kitchen = make_kitchen(capacity=100)

    meals = score_pair(make_donation(quantity=100, unit="Meals"), kitchen, radius_km=8)
    kilos = score_pair(make_donation(quantity=100, unit="Kg"), kitchen, radius_km=8)

    assert meals is not None and kilos is not None
    assert meals.quantity_score == 100
    assert kilos.quantity_score == UNASSESSED_SIZE_SCORE
    assert kilos.quantity_score != meals.quantity_score


@pytest.mark.parametrize("unit", ["Kg", "Boxes", "Pieces"])
def test_an_incomparable_unit_leaves_both_size_criteria_unassessed(unit):
    result = score_pair(make_donation(quantity=40, unit=unit), make_kitchen(), radius_km=8)

    assert result is not None
    assert result.quantity_score == UNASSESSED_SIZE_SCORE
    assert result.capacity_score == UNASSESSED_SIZE_SCORE


def test_an_unassessable_unit_says_so_rather_than_reporting_a_bare_number():
    """D-05/D-06: a score is never handed over without its reasoning."""
    result = score_pair(make_donation(quantity=35, unit="Kg"), make_kitchen(), radius_km=8)

    assert result is not None
    assert any("not assessed" in reason for reason in result.reasons)
    assert any("cannot be compared" in reason for reason in result.reasons)


def test_an_unassessable_unit_never_claims_a_mixed_unit_overflow():
    """The old prose said "exceeds stated capacity by 150 kg" against meals."""
    result = score_pair(make_donation(quantity=250, unit="Kg"), make_kitchen(capacity=100), radius_km=8)

    assert result is not None
    assert not any("exceeds stated capacity" in reason for reason in result.reasons)


def test_an_unassessable_unit_cannot_reorder_the_ranking():
    """Why a neutral score is safe: the unit belongs to the donation, not the pair.

    Every candidate gets the identical unassessed value for the same donation, so
    the two criteria drop out of the comparison entirely and the ranking is left
    to distance, deadline and reliability — which stay meaningful.
    """
    donation = make_donation(quantity=40, unit="Boxes")
    tiny = make_kitchen(capacity=10)
    huge = make_kitchen(capacity=5000)

    small_result = score_pair(donation, tiny, radius_km=8)
    large_result = score_pair(donation, huge, radius_km=8)

    assert small_result is not None and large_result is not None
    assert small_result.quantity_score == large_result.quantity_score
    assert small_result.capacity_score == large_result.capacity_score
    assert small_result.overall_score == large_result.overall_score


# ─── Unrelated criteria and the hard gates are untouched ─────────────────────

def test_the_hard_gates_still_exclude_rather_than_score_low():
    """D-06 is unchanged: ineligibility is `None`, not a bad number."""
    donation = make_donation()

    assert score_pair(donation, make_kitchen(verified=False), radius_km=8) is None

    no_coordinates = make_kitchen()
    no_coordinates.latitude = None
    no_coordinates.longitude = None
    assert score_pair(donation, no_coordinates, radius_km=8) is None

    assert score_pair(donation, make_kitchen(), radius_km=0.001) is None


def test_an_incomparable_unit_is_not_a_gate():
    """It is missing information about the pairing, not grounds to exclude it.

    Gating here would mean a donation measured in kilograms matched nobody at
    all, which is worse than ranking it on the criteria that do apply — and the
    seed data itself posts donations in Kg and Boxes.
    """
    assert score_pair(make_donation(unit="Kg"), make_kitchen(), radius_km=8) is not None


def test_distance_deadline_and_reliability_are_unaffected_by_the_unit():
    donation_meals = make_donation(quantity=50, unit="Meals")
    donation_boxes = make_donation(quantity=50, unit="Boxes")
    kitchen = make_kitchen()
    now = datetime.now(timezone.utc)

    a = score_pair(donation_meals, kitchen, radius_km=8, now=now)
    b = score_pair(donation_boxes, kitchen, radius_km=8, now=now)

    assert a is not None and b is not None
    assert a.distance_score == b.distance_score
    assert a.distance_km == b.distance_km
    assert a.reliability_score == b.reliability_score
    # Deadlines are built from `now()` a moment apart, so allow one point.
    assert abs(a.deadline_score - b.deadline_score) <= 1


def test_the_published_weights_still_sum_to_one_and_are_unchanged():
    """This task corrected the criteria, deliberately not their weights."""
    assert WEIGHTS == {
        "distance": 0.25,
        "quantity": 0.25,
        "capacity": 0.20,
        "deadline": 0.15,
        "reliability": 0.15,
    }
    assert sum(WEIGHTS.values()) == pytest.approx(1.0)


def test_the_breakdown_still_reconciles_to_the_headline():
    """The explainability contract: the total is the published weighted sum."""
    result = score_pair(make_donation(quantity=60), make_kitchen(capacity=100), radius_km=8)

    assert result is not None
    expected = (
        result.distance_score * WEIGHTS["distance"]
        + result.quantity_score * WEIGHTS["quantity"]
        + result.capacity_score * WEIGHTS["capacity"]
        + result.deadline_score * WEIGHTS["deadline"]
        + result.reliability_score * WEIGHTS["reliability"]
    )
    assert result.overall_score == round(expected)
