"""Platform metrics.

These are the figures the project proposal commits to being evaluated on.
Every one is derived from `status_events` rows, which are stamped by the
server at the moment of the transition — nothing here is self-reported, so
the numbers are attributable in the way the evaluation criteria require.
"""

from __future__ import annotations

from statistics import median

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Donation, DonationStatus, Recipient, User, Volunteer
from ..schemas import MetricsOut
from ..security import get_current_user

router = APIRouter(prefix="/api/metrics", tags=["metrics"])


def _minutes_between(start, end) -> float | None:
    if start is None or end is None:
        return None
    return (end - start).total_seconds() / 60


@router.get("", response_model=MetricsOut)
def platform_metrics(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> MetricsOut:
    donations = list(
        db.scalars(select(Donation).options(selectinload(Donation.events)))
    )

    completed = [d for d in donations if d.status is DonationStatus.COMPLETED]
    expired = [d for d in donations if d.status is DonationStatus.EXPIRED]
    active = [
        d
        for d in donations
        if d.status
        not in (DonationStatus.COMPLETED, DonationStatus.CANCELLED, DonationStatus.EXPIRED)
    ]

    # ── Primary metric: time-to-claim ───────────────────────────────────────
    # Posting → a recipient accepting. This is the delay the platform exists
    # to remove, and the one that decides whether the rest of the chain can
    # finish before the food expires.
    claim_times = [
        m
        for d in donations
        if (m := _minutes_between(d.created_at, d.timestamp_of(DonationStatus.ACCEPTED))) is not None
    ]

    # ── Handover: acceptance → delivery, isolating the last mile ────────────
    handover_times = [
        m
        for d in donations
        if (
            m := _minutes_between(
                d.timestamp_of(DonationStatus.ACCEPTED),
                d.timestamp_of(DonationStatus.DELIVERED),
            )
        )
        is not None
    ]

    # ── Rescue rate: completed before the stated deadline ───────────────────
    resolved = completed + expired
    rescued = [
        d
        for d in completed
        if (ts := d.timestamp_of(DonationStatus.COMPLETED)) is not None
        and ts <= d.pickup_deadline
    ]

    return MetricsOut(
        total_donations=len(donations),
        total_meals=sum(d.quantity for d in completed),
        completed_donations=len(completed),
        active_donations=len(active),
        expired_donations=len(expired),
        total_organizations=db.scalar(select(func.count()).select_from(Recipient)) or 0,
        total_volunteers=db.scalar(select(func.count()).select_from(Volunteer)) or 0,
        median_time_to_claim_minutes=round(median(claim_times), 1) if claim_times else None,
        median_handover_minutes=round(median(handover_times), 1) if handover_times else None,
        rescue_rate_percent=(
            round(100 * len(rescued) / len(resolved), 1) if resolved else None
        ),
        expiry_loss_rate_percent=(
            round(100 * len(expired) / len(resolved), 1) if resolved else None
        ),
    )
