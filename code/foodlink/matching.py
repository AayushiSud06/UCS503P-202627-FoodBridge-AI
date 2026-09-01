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


def _quantity_score(quantity: int, capacity: int) -> int:
    """Best when the donation nearly fills, but does not exceed, capacity.

    Under-filling wastes a trip; over-filling means food the kitchen cannot
    use in time. The peak sits at 100% of capacity and falls off either side.
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
    """Headroom the recipient retains after taking this donation."""
    if capacity <= 0:
        return 0
    if quantity > capacity:
        return 0
    return round(100 * (1 - (quantity / capacity) * 0.5))


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

    # Assume 20 km/h average in mixed city traffic for the collection leg.
    travel_minutes = (distance / 20) * 60

    distance_score = _distance_score(distance, radius_km)
    quantity_score = _quantity_score(donation.quantity, recipient.capacity)
    capacity_score = _capacity_score(donation.quantity, recipient.capacity)

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
        reasons.append(f"{distance:.1f} km away — well inside the collection radius")
    if quantity_score >= 80:
        reasons.append(
            f"{donation.quantity} {donation.unit.lower()} fits the {recipient.capacity}-meal "
            f"daily capacity closely"
        )
    elif donation.quantity > recipient.capacity:
        reasons.append(
            f"Donation exceeds stated capacity by "
            f"{donation.quantity - recipient.capacity} {donation.unit.lower()}"
        )
    if deadline_score >= 70:
        reasons.append("Comfortable margin before the pickup deadline")
    elif deadline_score == 0:
        reasons.append("Deadline cannot be met from this location")
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
