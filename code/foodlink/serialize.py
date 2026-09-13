"""Turning ORM rows into the shapes the frontend already expects."""

from __future__ import annotations

from .matching import blurred_coords, haversine_km
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


def _may_collect(volunteer_id: int | None, precise_pickup_for: set[int] | None) -> bool:
    """May this reader be told where to collect this donation, and from whom?

    `precise_pickup_for` is the scope `routers/donations._precise_pickup_scope`
    builds, in the same convention `_may_measure` follows: **`None` is
    unrestricted** — a donor, an organisation and an administrator read exactly
    what they always have — a set is the courier ids whose own runs may be read
    in full, and an empty set allows none.

    A courier is the one reader whose scope reaches donations nobody has bound
    them to: `_readable_by`'s volunteer branch offers the entire unclaimed
    `ACCEPTED` pool, which is the browsing this platform wants. So the question
    is answered by the row rather than by the account — an unclaimed pickup has
    `volunteer_id IS NULL` and is nobody's, which is not this reader's. That is
    the same boundary `_claim_pickup` writes across, read instead of written.
    See `DECISIONS.md` D-57.
    """
    if precise_pickup_for is None:
        return True
    return volunteer_id is not None and volunteer_id in precise_pickup_for


def coarse_pickup_area(latitude: float, longitude: float) -> str:
    """Roughly where a pickup is, for a reader not entitled to the pin itself.

    The donor's pin snapped to `matching.LOCATION_BLUR_GRID_DEG` — the 0.01°
    grid D-45 already blurs kitchens onto, about a kilometre a side — and
    printed at the two decimals that grid supports. Reusing the grid keeps one
    notion of "coarse enough" in the codebase instead of inventing a second.

    Unlike the blurred *distances* of D-45 this cannot be walked back to the
    true point: a courier cannot move the donor's pin and re-ask, so one
    donation yields one cell, with no boundary to search.

    Plain ASCII, unlike the comments around it: this one is a *response* value,
    so it also lands in logs and test output, and a degree sign buys nothing a
    courier pasting the pair into a map needs.
    """
    lat, lng = blurred_coords(latitude, longitude)
    return (
        f"Approx. {abs(lat):.2f}{'N' if lat >= 0 else 'S'}, "
        f"{abs(lng):.2f}{'E' if lng >= 0 else 'W'}"
    )


def donation_out(
    donation: Donation,
    *,
    viewer_match: MatchOut | None = None,
    precise_for: set[int] | None = None,
    precise_pickup_for: set[int] | None = None,
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

    `precise_pickup_for` is the same knowledge again, about the *donor*: the
    pin, the address text and who posted it. Those describe a person who may be
    at home, and a self-signup courier reads the whole unclaimed pool, so they
    are withheld until that courier has actually claimed the run — replaced by
    `pickupArea`, a coarse cell that is enough to decide whether a run is worth
    taking and not enough to find a doorstep (D-57).

    Withheld, not recomputed: `Donation.match_score` keeps its D-30 meaning as
    the precise frozen record of the decision, and `Donation.latitude` /
    `longitude` stay the exact pin the donor chose. Nothing here changes what is
    stored; this decides only who is shown it. Both scopes default to `None`
    (unrestricted) so an internal caller reading a row directly still sees the
    exact figures.
    """
    recipient = donation.recipient
    precise = _may_measure(donation.recipient_id, precise_for)
    collecting = _may_collect(donation.volunteer_id, precise_pickup_for)

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

    # Either the donor's own details or the coarse stand-in, never a blend and
    # never a placeholder dressed as the real thing: a reader outside the scope
    # is told nothing about the donor rather than something untrue about them.
    latitude: float | None
    longitude: float | None
    if collecting:
        donor_id = donation.donor_id
        donor_name = donation.donor.name if donation.donor else "Unknown"
        donor_organization = donation.donor.organization if donation.donor else None
        location = donation.location
        latitude = donation.latitude
        longitude = donation.longitude
        pickup_area = None
    else:
        donor_id = None
        donor_name = None
        donor_organization = None
        location = None
        latitude = None
        longitude = None
        pickup_area = coarse_pickup_area(donation.latitude, donation.longitude)

    return DonationOut(
        id=donation.id,
        donor_id=donor_id,
        donor_name=donor_name,
        donor_organization=donor_organization,
        food_name=donation.food_name,
        category=donation.category,
        quantity=donation.quantity,
        unit=donation.unit,
        storage_type=donation.storage_type,
        description=donation.description,
        image_url=donation.image_url,
        location=location,
        latitude=latitude,
        longitude=longitude,
        pickup_area=pickup_area,
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
