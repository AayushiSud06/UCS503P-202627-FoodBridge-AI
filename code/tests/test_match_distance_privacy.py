"""A donor cannot read a kitchen's coordinates out of `/matches`.

`GET /api/recipients` answers a donor `200 []` on purpose (D-26): the recipient
directory carries `latitude`/`longitude` alongside a contact person and a
phone number, and a donor has no workflow that needs any of it. The health
audit of 2026-09-05 then recovered a verified kitchen's coordinates exactly, on
the first attempt, by posting three donations at pins of the donor's choosing
and trilaterating the three `MatchOut.distanceKm` values that came back — a
demonstrated bypass of that decision, filed as `HA-3`.

The fix does not round the published distance. Rounding leaves the boundaries
of the rounded value at *known* distances, so a donor who walks the pin until
one flips has recovered a circle of known radius about the kitchen, and three
of those still give the exact point. Instead the kitchen's own coordinates are
snapped to a ~1 km grid before a pairing is scored for anybody but that
organisation, so every figure the reader can measure is an exact function of
one fixed surrogate point: probing recovers the surrogate and stops there.
`DECISIONS.md` D-45.

These tests pin all three readings the audit found — `distanceKm`, the
`distanceScore` the analysis panel draws, and the sentence in `reasons` — plus
the two things the fix must not disturb: an organisation's own distance, which
D-33's display depends on, and who gets ranked at all.
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

import pytest

from conftest import admin_token, auth, register, register_ngo
from foodlink.matching import _distance_score, blurred_coords, haversine_km
from foodlink.models import Recipient

RADIUS_KM = 8.0

#: The donor's pin, and the fixture donation posted from it.
CAMPUS = {"latitude": 30.3540, "longitude": 76.3630}

#: Two kitchens roughly 600 m apart that snap to the *same* grid cell. Neither
#: sits on the grid, so the surrogate is a different point from either of them
#: — which is what makes the difference between the two views measurable.
INSIDE_A = {"latitude": 30.3449, "longitude": 76.3751}
INSIDE_B = {"latitude": 30.3401, "longitude": 76.3799}

#: Two kitchens astride the 8 km eligibility boundary, each placed so that the
#: blur moves it across:
#:
#: * `JUST_OUTSIDE` is 8.02 km away — ineligible — but snaps to a surrogate
#:   7.52 km away. A gate reading the surrogate would let it in.
#: * `JUST_INSIDE` is 7.98 km away — eligible — but snaps to a surrogate
#:   8.46 km away. A gate reading the surrogate would throw it out.
#:
#: Roughly half a kilometre of margin either side, so neither depends on
#: floating-point luck.
JUST_OUTSIDE = {"latitude": 30.4240, "longitude": 76.3830}
JUST_INSIDE = {"latitude": 30.4258, "longitude": 76.3635}

#: Any figure that reads as a distance in kilometres.
KM_FIGURE = re.compile(r"\d+(\.\d+)?\s*km", re.IGNORECASE)


def make_donation_body(hours_ahead: float = 6, quantity: int = 50) -> dict:
    return {
        "foodName": "Vegetarian Thali Meals",
        "category": "Vegetarian",
        "quantity": quantity,
        "unit": "Meals",
        "storageType": "Room Temperature",
        "description": "Surplus from lunch service.",
        "location": "College Central Mess",
        **CAMPUS,
        "pickupDeadline": (
            datetime.now(timezone.utc) + timedelta(hours=hours_ahead)
        ).isoformat(),
    }


def _distance_from_campus(point: dict) -> float:
    return haversine_km(
        CAMPUS["latitude"], CAMPUS["longitude"], point["latitude"], point["longitude"]
    )


def _blurred_distance_from_campus(point: dict) -> float:
    lat, lon = blurred_coords(point["latitude"], point["longitude"])
    return haversine_km(CAMPUS["latitude"], CAMPUS["longitude"], lat, lon)


@pytest.fixture
def kitchens(client, db_session):
    """Two verified kitchens sharing one grid cell, identical but for position.

    Same capacity and no history, so `quantity`, `capacity` and `reliability`
    contribute the same number to both. Position is the only variable left,
    which is what lets a test say whether a reader can see it.
    """
    a_token, a_id = register_ngo(
        client, db_session, email="a@test.com", org="Helping Hands",
        capacity=150, **INSIDE_A,
    )
    b_token, b_id = register_ngo(
        client, db_session, email="b@test.com", org="Umeed Shelter",
        capacity=150, **INSIDE_B,
    )
    return {"a": (a_token, a_id), "b": (b_token, b_id)}


@pytest.fixture
def boundary_kitchens(db_session):
    """Verified kitchens either side of the radius, added straight to the table.

    No accounts: these exist to be ranked or not ranked, and nothing here reads
    on their behalf.
    """
    db_session.add_all([
        Recipient(name="Just Outside", type="Community Kitchen", location="Beyond",
                  capacity=150, is_verified=True, **JUST_OUTSIDE),
        Recipient(name="Just Inside", type="Community Kitchen", location="Edge",
                  capacity=150, is_verified=True, **JUST_INSIDE),
    ])
    db_session.commit()


@pytest.fixture
def posted(client) -> tuple[str, int]:
    """The donor who chose the pin, and the donation posted at it.

    The attack is the poster's: `_readable_by` scopes a donor to their own
    donations, so this account is the only donor who can read this donation's
    ranking at all — and the only one who could have chosen where to stand.
    """
    token = register(client, email="donor@test.com", role="donor", org="Central Mess")
    response = client.post("/api/donations", json=make_donation_body(), headers=auth(token))
    assert response.status_code == 201, response.text
    return token, response.json()["id"]


def _matches(client, token: str, donation_id: int) -> dict[str, dict]:
    response = client.get(
        f"/api/donations/{donation_id}/matches?limit=25", headers=auth(token)
    )
    assert response.status_code == 200, response.text
    return {m["recipientName"]: m for m in response.json()}


# ─── The three readings the audit found ──────────────────────────────────────

def test_a_donor_is_not_told_how_far_away_any_kitchen_is(client, kitchens, posted):
    """`distanceKm`: the field the trilateration was run on."""
    donor_token, donation_id = posted
    matches = _matches(client, donor_token, donation_id)

    assert set(matches) == {"Helping Hands", "Umeed Shelter"}
    assert all(m["distanceKm"] is None for m in matches.values())


def test_no_reason_shown_to_a_donor_prints_a_distance(client, kitchens, posted):
    """`reasons`: the same distance again, to one decimal place, in prose."""
    donor_token, donation_id = posted
    matches = _matches(client, donor_token, donation_id)

    for match in matches.values():
        for reason in match["reasons"]:
            assert not KM_FIGURE.search(reason), reason
    # Not by emptying the list: the explanation is still there (D-06), it just
    # no longer carries the number.
    assert all(m["reasons"] for m in matches.values())


def test_a_donors_scores_come_from_the_blurred_position(client, kitchens, posted):
    """`distanceScore`: one point per 80 m, which is the same disclosure again.

    The score a donor reads is the score of the surrogate point, and for a
    kitchen that does not sit on the grid that is a different number from the
    true one.
    """
    donor_token, donation_id = posted
    match = _matches(client, donor_token, donation_id)["Helping Hands"]

    assert match["distanceScore"] == _distance_score(
        _blurred_distance_from_campus(INSIDE_A), RADIUS_KM
    )
    assert match["distanceScore"] != _distance_score(
        _distance_from_campus(INSIDE_A), RADIUS_KM
    )


def test_two_kitchens_in_one_cell_are_indistinguishable_to_a_donor(
    client, kitchens, posted, db_session
):
    """The disclosure floor, stated directly.

    Two organisations ~600 m apart in the same cell produce byte-identical
    numbers for a donor, so no amount of probing separates them. An
    administrator — who already reads the directory in full — still sees the
    two apart, which is what shows the numbers were not simply flattened for
    everyone.
    """
    donor_token, donation_id = posted
    donor_view = _matches(client, donor_token, donation_id)
    admin_view = _matches(client, admin_token(client, db_session), donation_id)

    def without_identity(row: dict) -> dict:
        return {k: v for k, v in row.items() if k not in ("recipientId", "recipientName")}

    # Not field by field: *everything* the donor is given about the two is the
    # same object. That also settles the ordering question — `rank_recipients`
    # sorts on `overall_score`, which for this reader is computed from the
    # surrogate, so the order of the list is no channel either. (Had the sort
    # kept the true score while the numbers were blurred, the comparison
    # between two kitchens would itself have been a distance oracle.)
    assert without_identity(donor_view["Helping Hands"]) == without_identity(
        donor_view["Umeed Shelter"]
    )

    assert (
        admin_view["Helping Hands"]["distanceScore"]
        != admin_view["Umeed Shelter"]["distanceScore"]
    )


# ─── What the fix must not disturb ───────────────────────────────────────────

def test_an_organisation_still_reads_its_own_true_distance(client, kitchens, posted):
    """D-33: every distance the NGO interface shows comes from this field."""
    _, donation_id = posted
    a_token, _ = kitchens["a"]
    matches = _matches(client, a_token, donation_id)

    own = matches["Helping Hands"]
    assert own["distanceKm"] == round(_distance_from_campus(INSIDE_A), 2)
    assert any(KM_FIGURE.search(reason) for reason in own["reasons"])
    assert own["distanceScore"] == _distance_score(
        _distance_from_campus(INSIDE_A), RADIUS_KM
    )

    # And only its own: the kitchen down the road is scoped exactly as it is
    # for a donor, so an `ngo` account cannot trilaterate a peer either.
    assert matches["Umeed Shelter"]["distanceKm"] is None


def test_the_viewer_match_on_a_donation_is_the_organisations_own_figure(
    client, kitchens, posted
):
    """The path D-33's `displayDistanceKm` actually reads, end to end."""
    _, donation_id = posted
    a_token, _ = kitchens["a"]
    listed = next(
        row
        for row in client.get("/api/donations", headers=auth(a_token)).json()
        if row["id"] == donation_id
    )

    assert listed["viewerMatch"]["distanceKm"] == round(_distance_from_campus(INSIDE_A), 2)
    assert listed["viewerMatch"]["distanceKm"] == (
        _matches(client, a_token, donation_id)["Helping Hands"]["distanceKm"]
    )


def test_blurring_changes_no_score_the_platform_itself_acts_on(
    client, kitchens, posted, db_session
):
    """Eligibility and the frozen score are decided on the true position.

    The blur is a read scope, not a change to the matcher: the same kitchens
    are ranked for every reader, and `matchScore` — frozen when the donation
    was posted, and the number the donor was shown at the time — is still the
    precise one an administrator reads back.
    """
    donor_token, donation_id = posted
    donor_view = _matches(client, donor_token, donation_id)
    admin_view = _matches(client, admin_token(client, db_session), donation_id)

    assert set(donor_view) == set(admin_view)
    assert all(m["distanceKm"] is not None for m in admin_view.values())

    donation = client.get(
        f"/api/donations/{donation_id}", headers=auth(admin_token(client, db_session))
    ).json()
    top = max(admin_view.values(), key=lambda m: m["overallScore"])
    assert donation["matchScore"] == top["overallScore"]


# ─── The eligibility gate reads the true position, not the surrogate ─────────

def test_a_kitchen_outside_the_radius_stays_out_though_its_surrogate_is_inside(
    client, boundary_kitchens, posted, db_session
):
    """The gate the blur must not move, in the direction that would widen it.

    `Just Outside` is 8.02 km away and therefore ineligible, but its surrogate
    is 7.52 km away. Scoring the surrogate *before* the radius check would put a
    kitchen the matcher has ruled out in front of a donor — a false promise of
    exactly the kind D-06 gates against, and a change to the candidate set made
    by a privacy control. It must be absent for every reader alike.
    """
    donor_token, donation_id = posted

    for token in (donor_token, admin_token(client, db_session)):
        assert "Just Outside" not in _matches(client, token, donation_id)


def test_a_kitchen_inside_the_radius_stays_in_though_its_surrogate_is_outside(
    client, boundary_kitchens, posted, db_session
):
    """The same gate in the direction that would narrow it.

    `Just Inside` is 7.98 km away and eligible; its surrogate is 8.46 km away.
    Gating on the surrogate would quietly drop a kitchen the matcher accepts.
    """
    donor_token, donation_id = posted

    donor_view = _matches(client, donor_token, donation_id)
    admin_view = _matches(client, admin_token(client, db_session), donation_id)
    assert "Just Inside" in donor_view
    assert "Just Inside" in admin_view

    edge = donor_view["Just Inside"]
    assert edge["distanceKm"] is None
    # Clamped to the radius, so the reported pairing is never further away than
    # the list it appears in — and at this range the score is 0 from either
    # position, so the clamp introduces no artefact of its own.
    assert edge["distanceScore"] == 0
    assert admin_view["Just Inside"]["distanceScore"] == 0
    assert admin_view["Just Inside"]["distanceKm"] == round(
        _distance_from_campus(JUST_INSIDE), 2
    )


def test_the_eligible_set_is_the_same_for_every_reader(
    client, kitchens, boundary_kitchens, posted, db_session
):
    """Stated once over all four kitchens, both boundary cases included."""
    donor_token, donation_id = posted

    donor_view = _matches(client, donor_token, donation_id)
    admin_view = _matches(client, admin_token(client, db_session), donation_id)
    a_token, _ = kitchens["a"]

    assert set(donor_view) == set(admin_view) == set(
        _matches(client, a_token, donation_id)
    )
    assert set(donor_view) == {"Helping Hands", "Umeed Shelter", "Just Inside"}


def test_only_the_distance_derived_figures_differ_between_readers(
    client, kitchens, posted, db_session
):
    """The blur moves the distance and what is computed from it — nothing else.

    `quantity`, `capacity` and `reliability` are functions of the donation and
    the kitchen's own record, never of where it is, so a donor and an
    administrator must read the same three numbers for the same pairing.
    """
    donor_token, donation_id = posted

    donor_view = _matches(client, donor_token, donation_id)
    admin_view = _matches(client, admin_token(client, db_session), donation_id)

    for name in donor_view:
        for field in ("quantityScore", "capacityScore", "reliabilityScore"):
            assert donor_view[name][field] == admin_view[name][field], (name, field)


def test_the_deadline_and_overall_scores_are_surrogate_derived_too(
    client, kitchens, db_session
):
    """The two channels that only bite once `deadline_score` is off its ceiling.

    `_deadline_score` subtracts `travel_minutes = distance / 20 * 60`, so it
    reads the distance as surely as `distance_score` does — about 400 m per
    point — and `overall_score` is a weighted sum of both. Neither shows it at
    the six-hour deadline the other tests use, because the slack saturates at
    100 for every candidate alike. At one hour it does not.

    `Helping Hands` is 1.54 km away and its surrogate 2.26 km, so the donor's
    figures must come out *below* the administrator's rather than equal to
    them.
    """
    token = register(client, email="tight@test.com", role="donor", org="Central Mess")
    response = client.post(
        "/api/donations", json=make_donation_body(hours_ahead=1), headers=auth(token)
    )
    assert response.status_code == 201, response.text
    donation_id = response.json()["id"]

    donor = _matches(client, token, donation_id)["Helping Hands"]
    admin = _matches(client, admin_token(client, db_session), donation_id)["Helping Hands"]

    # The test is only meaningful while the criterion is off both rails.
    assert 0 < admin["deadlineScore"] < 100

    assert donor["deadlineScore"] < admin["deadlineScore"]
    assert donor["overallScore"] < admin["overallScore"]
