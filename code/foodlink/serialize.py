"""Turning ORM rows into the shapes the frontend already expects."""

from __future__ import annotations

from .matching import haversine_km
from .models import Donation
from .schemas import DonationOut, MatchOut, StatusEventOut


def _may_measure(recipient_id: int | None, precise_for: set[int] | None) -> bool:
    """May this reader be told a location-derived figure about `recipient_id`?

    `precise_for` is the scope `routers/donations._precise_distance_scope`
    builds, in the convention `_readable_by` and `rank_recipients` already use:
    **`None` is unrestricted**, a set is the recipient ids allowed, and an empty
    set allows none.

    A figure about *no* organisation — `match_score` on a donation nobody has
    accepted yet, which describes whichever kitchen happened to rank first — is
    precise only for an unrestricted reader. A scoped reader cannot be told the
    figure is about them, because nothing in the row says whose it is.
    """
    if precise_for is None:
        return True
    return recipient_id is not None and recipient_id in precise_for


def donation_out(
    donation: Donation,
    *,
    viewer_match: MatchOut | None = None,
    precise_for: set[int] | None = None,
) -> DonationOut:
    """Flatten a donation and its relations into the client-facing shape.

    `distanceKm` is computed against the matched recipient rather than stored,
    so it is always consistent with the two locations it describes.

    `viewerMatch` is passed in rather than computed here: it depends on who is
    asking, which is a router's knowledge, not a row's. It stays optional so a
    caller with no organisation simply omits it.

    `precise_for` is the same knowledge for the two *location-derived* fields.
    `matchScore` and `distanceKm` are both exact functions of a kitchen's true
    coordinates — one at ~320 m per point, the other outright — and a donor
    chooses the donation's pin, so D-45's argument about `/matches` applies to
    them unchanged: read back from three pins of the reader's choosing, either
    one trilaterates a kitchen the recipient directory withholds (D-26). Both
    are therefore withheld from a reader outside the scope, rather than
    coarsened — a rounded figure keeps its boundaries at *known* distances and
    a boundary search recovers the same point (D-45), and D-33 forbids printing
    a plausible number in place of one the server does not have.

    Withheld, not recomputed: `Donation.match_score` keeps its D-30 meaning as
    the precise frozen record of the decision. Nothing here changes what is
    stored; this decides only who is shown it. Default `None` (unrestricted) so
    an internal caller reading a row directly still sees the exact figures.
    """
    recipient = donation.recipient
    precise = _may_measure(donation.recipient_id, precise_for)

    distance_km = None
    if precise and recipient is not None and recipient.latitude is not None:
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
        match_score=donation.match_score if precise else None,
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
