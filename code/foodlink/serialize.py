"""Turning ORM rows into the shapes the frontend already expects."""

from __future__ import annotations

from .matching import haversine_km
from .models import Donation
from .schemas import DonationOut, MatchOut, StatusEventOut


def donation_out(donation: Donation, *, viewer_match: MatchOut | None = None) -> DonationOut:
    """Flatten a donation and its relations into the client-facing shape.

    `distanceKm` is computed against the matched recipient rather than stored,
    so it is always consistent with the two locations it describes.

    `viewerMatch` is passed in rather than computed here: it depends on who is
    asking, which is a router's knowledge, not a row's. It stays optional so a
    caller with no organisation simply omits it.
    """
    recipient = donation.recipient
    distance_km = None
    if recipient is not None and recipient.latitude is not None:
        distance_km = round(
            haversine_km(
                donation.latitude, donation.longitude, recipient.latitude, recipient.longitude
            ),
            2,
        )

    volunteer_name = None
    if donation.volunteer is not None and donation.volunteer.user is not None:
        volunteer_name = donation.volunteer.user.name

    return DonationOut(
        id=donation.id,
        donor_id=donation.donor_id,
        donor_name=donation.donor.name if donation.donor else "Unknown",
        donor_organization=donation.donor.organization if donation.donor else None,
        food_name=donation.food_name,
        category=donation.category,
        quantity=donation.quantity,
        unit=donation.unit,
        storage_type=donation.storage_type,
        description=donation.description,
        image_url=donation.image_url,
        location=donation.location,
        latitude=donation.latitude,
        longitude=donation.longitude,
        prepared_at=donation.prepared_at,
        pickup_deadline=donation.pickup_deadline,
        status=donation.status,
        recipient_id=donation.recipient_id,
        recipient_name=recipient.name if recipient else None,
        volunteer_id=donation.volunteer_id,
        volunteer_name=volunteer_name,
        match_score=donation.match_score,
        viewer_match=viewer_match,
        distance_km=distance_km,
        created_at=donation.created_at,
        events=[
            StatusEventOut(
                to_status=e.to_status,
                from_status=e.from_status,
                occurred_at=e.occurred_at,
                note=e.note,
            )
            for e in donation.events
        ],
    )
