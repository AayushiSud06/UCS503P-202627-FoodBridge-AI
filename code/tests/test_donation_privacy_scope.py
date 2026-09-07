"""D-45's reader boundary, applied to the donation itself rather than `/matches`.

Task 26 closed the trilateration on `GET /api/donations/{id}/matches`. It left
two readings of the same kind one endpoint over, both named in D-45's own list
of what it did not close, both on `DonationOut`:

* **`distanceKm`** - the exact straight line from the donor's pin to the
  kitchen that accepted, handed to the donor who chose that pin and to every
  courier browsing unclaimed pickups.
* **`matchScore`** - the frozen weighted sum, which moves about one point per
  320 m of distance, handed to the same readers.

Neither is closed by rounding, for the reason D-45 gives: the boundaries of a
rounded value sit at *known* distances, so walking the pin until one flips
recovers a circle of known radius, and three of those still give the point. And
neither can be recomputed from a blurred position without ceasing to be the
frozen record of a decision (D-30). So both are **withheld** from a reader
outside `donations._precise_distance_scope` - the same scope, the same three
answers, no second mechanism. `DECISIONS.md` D-47.

What these tests hold apart is the thing the fix is easiest to get wrong:

    internal matching decision -> persisted frozen decision -> reader exposure

Only the last arrow moved. `Donation.match_score` still stores the precise
figure, the freeze still runs on true coordinates, and the eligible set and its
order are the same for every reader.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from conftest import admin_token, auth, register, register_ngo
from foodlink.matching import blurred_coords, haversine_km, score_pair
from foodlink.models import Donation, Recipient

RADIUS_KM = 8.0

#: The donor's pin, and the fixture donation posted from it.
CAMPUS = {"latitude": 30.3540, "longitude": 76.3630}

#: 1.54 km from the campus, and 2.26 km from the campus once snapped to the
#: blur grid. The gap is what makes "was this figure computed from the true
#: position" an answerable question rather than a coincidence.
NEAR = {"latitude": 30.3449, "longitude": 76.3751}

#: ~4.7 km out: ranked and offered, never the winner. Far enough from `NEAR`
#: that no surrogate within one grid cell can reorder the two.
FAR = {"latitude": 30.3900, "longitude": 76.3400}

#: 7.98 km away - eligible - but 8.46 km from its surrogate. Borrowed from
#: `test_match_distance_privacy.py`, where the same point pins the gate on
#: `/matches`; here it pins that widening the *serialization* scope did not
#: reach back into the gate.
JUST_INSIDE = {"latitude": 30.4258, "longitude": 76.3635}

#: 8.02 km away - ineligible - but 7.52 km from its surrogate.
JUST_OUTSIDE = {"latitude": 30.4240, "longitude": 76.3830}


def make_donation_body(hours_ahead: float = 6) -> dict:
    return {
        "foodName": "Vegetarian Thali Meals",
        "category": "Vegetarian",
        "quantity": 50,
        "unit": "Meals",
        "storageType": "Room Temperature",
        "description": "Surplus from lunch service.",
        "location": "College Central Mess",
        **CAMPUS,
        "pickupDeadline": (
            datetime.now(timezone.utc) + timedelta(hours=hours_ahead)
        ).isoformat(),
    }


def _true_distance(point: dict) -> float:
    return haversine_km(
        CAMPUS["latitude"], CAMPUS["longitude"], point["latitude"], point["longitude"]
    )


def _blurred_distance(point: dict) -> float:
    lat, lon = blurred_coords(point["latitude"], point["longitude"])
    return haversine_km(CAMPUS["latitude"], CAMPUS["longitude"], lat, lon)


@pytest.fixture
def kitchens(client, db_session):
    """A near kitchen that wins the ranking and a further one that does not."""
    near_token, near_id = register_ngo(
        client, db_session, email="near@test.com", org="Helping Hands",
        capacity=150, **NEAR,
    )
    far_token, far_id = register_ngo(
        client, db_session, email="far@test.com", org="Umeed Shelter",
        capacity=80, **FAR,
    )
    return {"near": (near_token, near_id), "far": (far_token, far_id)}


@pytest.fixture
def posted(client) -> tuple[str, int]:
    """The donor who chose the pin, and the donation posted at it."""
    token = register(client, email="donor@test.com", role="donor", org="Central Mess")
    response = client.post("/api/donations", json=make_donation_body(), headers=auth(token))
    assert response.status_code == 201, response.text
    return token, response.json()["id"]


@pytest.fixture
def accepted(client, kitchens, posted) -> dict:
    """The near kitchen takes the donation, which is what binds `distanceKm`.

    `DonationOut.distanceKm` is measured against `donation.recipient`, so it
    does not exist at all until an organisation has accepted. Everything about
    that field therefore has to be asked of an accepted donation.
    """
    donor_token, donation_id = posted
    near_token, near_id = kitchens["near"]
    response = client.post(
        f"/api/donations/{donation_id}/status",
        json={"status": "ACCEPTED", "recipientId": near_id},
        headers=auth(near_token),
    )
    assert response.status_code == 200, response.text
    return {"id": donation_id, "donor": donor_token, "ngo": near_token, "ngo_id": near_id}


def _read(client, token: str, donation_id: int) -> dict:
    response = client.get(f"/api/donations/{donation_id}", headers=auth(token))
    assert response.status_code == 200, response.text
    return response.json()


def _matches(client, token: str, donation_id: int) -> list[dict]:
    response = client.get(
        f"/api/donations/{donation_id}/matches?limit=25", headers=auth(token)
    )
    assert response.status_code == 200, response.text
    return response.json()


# --- `distanceKm`: withheld from a reader who may not measure the kitchen ----

def test_a_donor_is_not_told_how_far_the_accepting_kitchen_is(client, accepted):
    """The donor chose the pin, so an exact distance is a circle about the kitchen.

    Three donations from three pins, all taken by the same named kitchen, and
    the circles intersect at a point `GET /api/recipients` refuses to give a
    donor at all (D-26). The name is not the leak and stays; the measurement
    goes.
    """
    donation = _read(client, accepted["donor"], accepted["id"])

    assert donation["distanceKm"] is None
    assert donation["recipientName"] == "Helping Hands"


def test_a_courier_browsing_unclaimed_pickups_is_not_told_either(client, accepted):
    """The weaker-looking reader is the stronger attacker.

    A courier does not choose any pin - but `_readable_by` shows them *every*
    unclaimed `ACCEPTED` pickup, from every donor, each one carrying its
    kitchen's name. Several donations bound to one kitchen from several donors
    trilaterate it with no pin-walking at all.
    """
    courier = register(client, email="courier@test.com", role="volunteer")
    donation = _read(client, courier, accepted["id"])

    assert donation["distanceKm"] is None
    assert donation["matchScore"] is None
    # Still readable, and still says which kitchen - only the measurement is gone.
    assert donation["recipientName"] == "Helping Hands"


def test_the_accepting_organisation_still_reads_its_own_true_distance(client, accepted):
    """D-33's display reads this field, and the kitchen is measuring itself."""
    donation = _read(client, accepted["ngo"], accepted["id"])

    assert donation["distanceKm"] == round(_true_distance(NEAR), 2)
    # The true position, not the surrogate - the same distinction `/matches`
    # draws for `viewerMatch`.
    assert donation["distanceKm"] != round(_blurred_distance(NEAR), 2)


def test_an_administrator_still_reads_the_true_distance(client, db_session, accepted):
    """Unrestricted, because `GET /api/recipients` already hands them the pins."""
    donation = _read(client, admin_token(client, db_session), accepted["id"])

    assert donation["distanceKm"] == round(_true_distance(NEAR), 2)


# --- `matchScore`: the same boundary, at ~320 m per point --------------------

def test_a_donor_is_not_told_the_frozen_score_of_a_donation_they_posted(
    client, db_session, accepted
):
    """Withheld, not rounded and not re-scored: the column is untouched."""
    donation = _read(client, accepted["donor"], accepted["id"])
    assert donation["matchScore"] is None

    # The decision is still recorded, precisely, exactly where D-30 puts it.
    stored = db_session.get(Donation, accepted["id"]).match_score
    assert stored is not None
    assert _read(client, admin_token(client, db_session), accepted["id"])[
        "matchScore"
    ] == stored


def test_the_accepting_organisation_reads_the_score_it_decided_on(client, accepted):
    """The frozen figure is about this kitchen, so this kitchen may have it.

    This is the number `NGOAcceptedDonations` prints as "match score at
    acceptance", and the one surface that would have gone blank had the field
    been withheld from everybody rather than scoped.
    """
    assert _read(client, accepted["ngo"], accepted["id"])["matchScore"] is not None


def test_a_peer_organisation_is_not_told_the_frozen_score_of_an_open_donation(
    client, kitchens, posted
):
    """Before acceptance the score is about *whichever* kitchen ranked first.

    Nothing in the row says which, so no scoped reader can be told the figure
    is about itself - including the kitchen that actually won it. Its own live
    ranking is `viewerMatch`, which is unaffected: that one is about the
    reader by construction, and D-30 is the decision that keeps the two apart.
    """
    _, donation_id = posted
    near_token, _ = kitchens["near"]
    far_token, _ = kitchens["far"]

    for token in (near_token, far_token):
        listed = _read(client, token, donation_id)
        assert listed["matchScore"] is None
        assert listed["viewerMatch"] is not None
        assert listed["viewerMatch"]["overallScore"] is not None


# --- The decision itself is unchanged: precise in, precise stored ------------

def test_the_frozen_score_is_still_computed_from_the_true_position(
    client, db_session, accepted
):
    """The seam is the *exposure*, not the arithmetic.

    Had the scope been pushed back into `rank_recipients` at the freeze - the
    obvious wrong fix, since the router already has a `precise_for` argument
    to hand it - the stored number would be the surrogate's. It is not: it is
    the true one, and the two differ here by design.

    Six hours of slack, so `deadline_score` saturates at 100 for both and the
    recomputation below does not race the clock.
    """
    donation = db_session.get(Donation, accepted["id"])
    kitchen = db_session.get(Recipient, accepted["ngo_id"])
    stored = donation.match_score

    precise = score_pair(donation, kitchen, radius_km=RADIUS_KM, blur_location=False)
    blurred = score_pair(donation, kitchen, radius_km=RADIUS_KM, blur_location=True)
    assert precise is not None and blurred is not None

    assert stored == precise.overall_score
    assert stored != blurred.overall_score


def test_withholding_the_figures_changes_nobody_who_qualifies_or_ranks(
    client, db_session, kitchens, posted
):
    """The eligible set and the winner are the same for every reader.

    Qualification runs on the true `haversine_km` before any blur, and the
    donation-side scope added here touches serialization only - so a donor, the
    kitchens themselves and an administrator all see the same candidates in the
    same order, and the top match is the same organisation for all of them.
    """
    donor_token, donation_id = posted
    near_token, _ = kitchens["near"]

    views = {
        "donor": _matches(client, donor_token, donation_id),
        "ngo": _matches(client, near_token, donation_id),
        "admin": _matches(client, admin_token(client, db_session), donation_id),
    }

    orders = {who: [m["recipientName"] for m in rows] for who, rows in views.items()}
    assert orders["donor"] == orders["ngo"] == orders["admin"]
    assert orders["donor"] == ["Helping Hands", "Umeed Shelter"]


def test_the_eligibility_gate_still_reads_the_true_coordinates(
    client, db_session, posted
):
    """The two boundary kitchens, restated for the donation-side change.

    `Just Inside` is 7.98 km away and its surrogate 8.46 km; `Just Outside` is
    8.02 km away and its surrogate 7.52 km. If any part of this task had moved
    the blur above the radius check, the first would vanish and the second
    would appear. `test_match_distance_privacy.py` pins the same gate against
    Task 26's change; this pins it against Task 28's.
    """
    donor_token, _ = posted
    db_session.add_all([
        Recipient(name="Just Inside", type="Community Kitchen", location="Edge",
                  capacity=150, is_verified=True, **JUST_INSIDE),
        Recipient(name="Just Outside", type="Community Kitchen", location="Beyond",
                  capacity=150, is_verified=True, **JUST_OUTSIDE),
    ])
    db_session.commit()

    response = client.post(
        "/api/donations", json=make_donation_body(), headers=auth(donor_token)
    )
    assert response.status_code == 201, response.text
    donation_id = response.json()["id"]

    for token in (donor_token, admin_token(client, db_session)):
        names = {m["recipientName"] for m in _matches(client, token, donation_id)}
        assert "Just Inside" in names
        assert "Just Outside" not in names


# --- Task 26's own boundary is untouched -------------------------------------

def test_the_matches_endpoint_still_blurs_exactly_as_it_did(client, db_session, posted):
    """A regression guard on D-45 itself, from the file that widened its scope."""
    donor_token, donation_id = posted

    for match in _matches(client, donor_token, donation_id):
        assert match["distanceKm"] is None

    for match in _matches(client, admin_token(client, db_session), donation_id):
        assert match["distanceKm"] is not None
