"""Recipient ranking.

A transparent weighted-sum over five normalised criteria. Deliberately not a
learned model: the proposal commits to an explainable heuristic that a
recipient can read the reasoning for, and that a marker can verify by hand.

Every criterion returns 0-100, the weights are published in `WEIGHTS` and sum
to 1.0, and `explain()` reports the per-criterion figures alongside the total
so a score can always be taken apart.

Swapping in a learned ranker later means replacing `score_pair` only; the
router and the response shape do not change.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timezone

from .models import Donation, Recipient

WEIGHTS: dict[str, float] = {
    "distance": 0.25,
    "quantity": 0.25,
    "capacity": 0.20,
    "deadline": 0.15,
    "reliability": 0.15,
}

#: Storage that a recipient must be able to handle. A kitchen without cold
#: storage should not be offered frozen goods at all, so this gates rather
#: than scores.
COLD_STORAGE = {"Refrigerated", "Frozen"}

#: The unit `Recipient.capacity` is counted in.
#:
#: There is no `capacity_unit` column and none was added: the product already
#: fixes this in three places — the NGO profile field is labelled "Max Batch
#: Capacity (Meals)", the mobile profile prints "<n> meals", and
#: `frontend/src/types/index.ts` documents it as "max meals they can handle".
#: This constant names what those already agree on so the matcher stops
#: assuming it silently.
CAPACITY_UNIT = "Meals"

#: What the two size criteria score when the donation's unit cannot be compared
#: with `CAPACITY_UNIT`.
#:
#: Neither credited nor penalised. The unit is a property of the *donation*, so
#: an unassessable one is unassessable for every candidate alike — the value is
#: identical across the whole ranking and therefore cannot reorder it. What is
#: left deciding the ranking is distance, deadline and reliability, which is
#: exactly the information that remains meaningful. See `DECISIONS.md` D-42.
UNASSESSED_SIZE_SCORE = 50

#: Spare capacity, in meals, at which a kitchen counts as keeping a full day's
#: room after taking a donation. Anchored on the default `Recipient.capacity`
#: of 100: retaining that much means a default-sized kitchen's entire service
#: is still free. Saturating rather than linear-to-capacity is what stops this
#: criterion collapsing back into the fit ratio — see `_capacity_score`.
FULL_HEADROOM_MEALS = 100


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in kilometres."""
    radius = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    )
    return 2 * radius * math.asin(math.sqrt(a))


@dataclass
class MatchResult:
    recipient_id: int
    recipient_name: str
    overall_score: int
    distance_km: float
    distance_score: int
    quantity_score: int
    capacity_score: int
    deadline_score: int
    reliability_score: int
    reasons: list[str] = field(default_factory=list)


def _distance_score(distance_km: float, radius_km: float) -> int:
    """Linear decay to zero at the service radius."""
    if distance_km >= radius_km:
        return 0
    return round(100 * (1 - distance_km / radius_km))


def is_comparable_unit(unit: str) -> bool:
    """Can a donation counted in `unit` be measured against `Recipient.capacity`?

    Only if it is already in the same unit. `Donation.unit` is free text on the
    wire (`String(24)`, no enum) and the product's picker offers Meals, Kg,
    Boxes and Pieces — of which only Meals is what capacity counts.

    **Nothing here converts, because the repository holds nothing to convert
    with.** There is no mass or portion field on a donation, no per-category
    yield table, and no conversion rule anywhere in the codebase; the frontend
    reached the same conclusion for impact totals and says so in
    `lib/impact.ts`. Inventing "1 box = n meals" would put a fabricated number
    inside the one score the platform asks to be checked by hand (D-05).

    Matching is deliberately strict: an unrecognised unit is not comparable, so
    a new unit added later is unassessed rather than silently mismeasured.
    """
    return unit.strip().casefold() == CAPACITY_UNIT.casefold()


def _quantity_score(quantity: int, capacity: int) -> int:
    """How well the donation's *size* suits this kitchen — a relative measure.

    Best when the donation nearly fills, but does not exceed, capacity.
    Under-filling wastes a trip; over-filling means food the kitchen cannot use
    in time. The peak sits at 100% of capacity and falls off either side.

    Unchanged, and deliberately a pure function of `quantity / capacity`: "does
    this fit" is a question about proportion. What changed is its partner —
    `_capacity_score` used to answer the same question upside down.

    Both arguments are in `CAPACITY_UNIT`; the caller checks that first.
    """
    if capacity <= 0:
        return 0
    ratio = quantity / capacity
    if ratio <= 1:
        # 0.0 -> 40, 1.0 -> 100
        return round(40 + 60 * ratio)
    # Overflow is penalised twice as steeply as underfill.
    return max(0, round(100 - 120 * (ratio - 1)))


def _capacity_score(quantity: int, capacity: int) -> int:
    """How much room the kitchen keeps afterwards — an *absolute* measure.

    Spare meals left over, saturating at `FULL_HEADROOM_MEALS`. Zero once the
    donation would not fit at all.

    ⚠️ **This is the fix for a real defect, not a re-tuning.** It used to return
    `100 * (1 - 0.5 * quantity / capacity)`, which is a function of the same
    ratio `_quantity_score` uses — and, over the whole feasible range, an exact
    affine function of `_quantity_score` itself. The two criteria were one
    criterion counted twice in opposite directions: their weighted contribution
    came to `0.25(40 + 60r) + 0.20(100 - 50r) = 30 + 5r`, so 45% of the
    published weight moved five points from an empty kitchen to a full one
    while presenting itself as two independent bars.

    Absolute headroom is the information the ratio throws away. A 1000-meal
    kitchen taking 500 and a 100-meal kitchen taking 50 fit equally well and are
    not equally free afterwards: one can still take another 500 meals today, the
    other 50. That difference is what decides whether sending this donation here
    also costs the network its next placement.

    Both arguments are in `CAPACITY_UNIT`; the caller checks that first.
    """
    if capacity <= 0:
        return 0
    spare = capacity - quantity
    if spare <= 0:
        return 0
    return round(100 * min(1.0, spare / FULL_HEADROOM_MEALS))


def _deadline_score(deadline: datetime, now: datetime, travel_minutes: float) -> int:
    """How comfortably a collection fits before the food expires."""
    minutes_left = (deadline - now).total_seconds() / 60
    slack = minutes_left - travel_minutes
    if slack <= 0:
        return 0
    # Two hours of slack is treated as fully comfortable.
    return round(100 * min(1.0, slack / 120))


def score_pair(
    donation: Donation,
    recipient: Recipient,
    *,
    radius_km: float,
    now: datetime | None = None,
) -> MatchResult | None:
    """Score one donation/recipient pair, or None if the pair is ineligible."""
    now = now or datetime.now(timezone.utc)

    # Unverified organisations are not ranked. A suggestion the recipient is
    # not allowed to act on (see the ACCEPTED transition) would be a false
    # promise to the donor, and an unvetted kitchen at the top of the list is
    # worse than a slightly further verified one.
    if not recipient.is_verified:
        return None

    if recipient.latitude is None or recipient.longitude is None:
        return None

    distance = haversine_km(
        donation.latitude, donation.longitude, recipient.latitude, recipient.longitude
    )
    if distance > radius_km:
        return None

    # A flat 20 km/h over the great-circle distance. This is a rough estimate
    # feeding `_deadline_score`, not a routed journey: nothing here knows about
    # roads or traffic, and this figure is never serialised to a client as an
    # ETA. Any wording derived from it has to read as an estimate.
    travel_minutes = (distance / 20) * 60

    distance_score = _distance_score(distance, radius_km)

    # Both size criteria measure the donation against `Recipient.capacity`, so
    # both need the donation to be counted in the same unit. Where it is not,
    # neither is assessed rather than computed from numbers that do not line up
    # — 100 Kg is not 100 meals, and scoring it as though it were is the kind of
    # invented figure the explainability panel exists to rule out.
    size_comparable = is_comparable_unit(donation.unit)
    if size_comparable:
        quantity_score = _quantity_score(donation.quantity, recipient.capacity)
        capacity_score = _capacity_score(donation.quantity, recipient.capacity)
    else:
        quantity_score = capacity_score = UNASSESSED_SIZE_SCORE

    deadline = donation.pickup_deadline
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
    deadline_score = _deadline_score(deadline, now, travel_minutes)

    reliability_score = recipient.reliability_score

    overall = (
        distance_score * WEIGHTS["distance"]
        + quantity_score * WEIGHTS["quantity"]
        + capacity_score * WEIGHTS["capacity"]
        + deadline_score * WEIGHTS["deadline"]
        + reliability_score * WEIGHTS["reliability"]
    )

    reasons: list[str] = []
    if distance_score >= 70:
        reasons.append(
            f"{distance:.1f} km away in a straight line — well inside the collection radius"
        )
    if not size_comparable:
        # Said plainly rather than left as a silent 50. The old prose below was
        # the same defect in words — "exceeds stated capacity by 50 kg" against
        # a capacity counted in meals.
        reasons.append(
            f"Donation size not assessed: {donation.quantity} "
            f"{donation.unit.lower()} cannot be compared with a capacity stated "
            f"in {CAPACITY_UNIT.lower()}"
        )
    elif quantity_score >= 80:
        reasons.append(
            f"{donation.quantity} {donation.unit.lower()} fits the {recipient.capacity}-meal "
            f"daily capacity closely"
        )
    elif donation.quantity > recipient.capacity:
        reasons.append(
            f"Donation exceeds stated capacity by "
            f"{donation.quantity - recipient.capacity} {donation.unit.lower()}"
        )
    if size_comparable and capacity_score >= 70:
        reasons.append(
            f"{recipient.capacity - donation.quantity} meals of capacity still "
            f"free afterwards"
        )
    if deadline_score >= 70:
        reasons.append("Comfortable margin before the pickup deadline")
    elif deadline_score == 0:
        reasons.append("Deadline is too close for the estimated collection time")
    if reliability_score >= 85:
        reasons.append(f"{reliability_score}% completion record on accepted donations")

    return MatchResult(
        recipient_id=recipient.id,
        recipient_name=recipient.name,
        overall_score=round(overall),
        distance_km=round(distance, 2),
        distance_score=distance_score,
        quantity_score=quantity_score,
        capacity_score=capacity_score,
        deadline_score=deadline_score,
        reliability_score=reliability_score,
        reasons=reasons,
    )


def rank_recipients(
    donation: Donation,
    recipients: list[Recipient],
    *,
    radius_km: float,
    limit: int | None = None,
    now: datetime | None = None,
) -> list[MatchResult]:
    """Every eligible recipient, best first.

    This is the part the prototype faked: it scored a single hard-coded
    organisation. Ranking the full eligible set is what makes the number on
    screen mean anything.
    """
    scored = [
        result
        for recipient in recipients
        if (result := score_pair(donation, recipient, radius_km=radius_km, now=now)) is not None
    ]
    scored.sort(key=lambda r: r.overall_score, reverse=True)
    return scored[:limit] if limit else scored
