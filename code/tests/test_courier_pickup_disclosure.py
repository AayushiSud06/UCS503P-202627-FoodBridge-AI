"""D-57's reader boundary: what a courier is told before and after claiming.

`volunteer` is a self-signup role whose read scope deliberately covers every
unclaimed `ACCEPTED` pickup on the platform — browsing that pool is the job.
Until Task 41 the pool also handed over, for each of those donations, the
donor's exact pin, their address text and their name; a donor may be an
individual at home, so one registration harvested doorsteps (P1-1b, DQ-1).

The fix withholds those fields rather than coarsening them, exactly as D-47
withholds `matchScore` and `distanceKm`, and replaces them with `pickupArea`
— the pin snapped to the 0.01 degree grid D-45 already uses. The trust
boundary is the one the claim already writes across:

    ACCEPTED + volunteer_id IS NULL   ->  coarse area, no donor
    volunteer_id == this courier      ->  exact pin, address and donor

so the disclosure is a fact about the *row*, not about the account, and it
turns over at the moment `_claim_pickup`'s conditional UPDATE succeeds.

What these tests hold apart is the thing this is easiest to get wrong: the
pool must stay **readable** while it stops being **legible**. A courier who
can no longer see the pool cannot choose a run at all, and a courier who is
handed a placeholder donor has been told something untrue.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

import pytest

from conftest import admin_token, auth, register, register_ngo
from foodlink.matching import blurred_coords
from foodlink.models import User, Volunteer

#: The donor's pin, and the address text and identity that go with it. Kept
#: distinctive so a leak through any field at all is greppable in the response.
CAMPUS = {"latitude": 30.3540, "longitude": 76.3630}
ADDRESS = "42 Rajindra Road, Model Town, Patiala"
DONOR_NAME = "Asha Menon"
DONOR_ORG = "Green Leaf Cafe"

#: Every field the boundary withholds, so no test enumerates its own list and
#: a field added to the redaction has one place to be added to.
WITHHELD = ("latitude", "longitude", "location", "donorName", "donorOrganization", "donorId")


def donation_body(**overrides) -> dict:
    body = {
        "foodName": "Vegetarian Thali Meals",
        "category": "Vegetarian",
        "quantity": 50,
        "unit": "Meals",
        "storageType": "Room Temperature",
        "description": "Surplus from lunch service.",
        "location": ADDRESS,
        **CAMPUS,
        "pickupDeadline": (datetime.now(timezone.utc) + timedelta(hours=6)).isoformat(),
    }
    body.update(overrides)
    return body


@pytest.fixture
def accepted(client, db_session):
    """One donation carried as far as `ACCEPTED`, with nobody claiming it.

    Returns the tokens of everyone with a stake in it, so each test can ask
    the same donation the same question as a different reader.
    """
    donor = register(
        client, email="donor@example.com", role="donor", name=DONOR_NAME, org=DONOR_ORG
    )
    ngo, recipient_id = register_ngo(client, db_session, email="kitchen@example.com", org="Helping Hands")
    courier = register(client, email="courier@example.com", role="volunteer", name="Courier One")
    rival = register(client, email="rival@example.com", role="volunteer", name="Courier Two")

    created = client.post("/api/donations", json=donation_body(), headers=auth(donor))
    assert created.status_code == 201, created.text
    donation_id = created.json()["id"]

    accepted = client.post(
        f"/api/donations/{donation_id}/status",
        json={"status": "ACCEPTED"},
        headers=auth(ngo),
    )
    assert accepted.status_code == 200, accepted.text

    return {
        "id": donation_id,
        "donor": donor,
        "ngo": ngo,
        "courier": courier,
        "rival": rival,
        "recipient_id": recipient_id,
    }


def claim(client, token: str, donation_id: int):
    return client.post(
        f"/api/donations/{donation_id}/status",
        json={"status": "VOLUNTEER_ASSIGNED"},
        headers=auth(token),
    )


# ─── The pool stays readable ─────────────────────────────────────────────────

def test_a_self_signup_courier_still_browses_every_unclaimed_pickup(client, accepted):
    """The point of the pool is that a courier can find work in it."""
    listed = client.get("/api/donations", headers=auth(accepted["courier"]))
    assert listed.status_code == 200

    ids = [d["id"] for d in listed.json()]
    assert ids == [accepted["id"]]

    by_id = client.get(f"/api/donations/{accepted['id']}", headers=auth(accepted["courier"]))
    assert by_id.status_code == 200


def test_an_unclaimed_pickup_still_says_what_and_when(client, accepted):
    """Redaction is about the donor, not about the food or the deadline.

    A courier choosing between runs needs the load and the window; withholding
    those would close the pool by making it useless rather than by scoping it.
    """
    pickup = client.get("/api/donations", headers=auth(accepted["courier"])).json()[0]

    assert pickup["foodName"] == "Vegetarian Thali Meals"
    assert pickup["quantity"] == 50
    assert pickup["unit"] == "Meals"
    assert pickup["status"] == "ACCEPTED"
    assert pickup["pickupDeadline"] is not None
    assert pickup["recipientName"] == "Helping Hands"


# ─── Before the claim ────────────────────────────────────────────────────────

def test_an_unclaimed_pickup_carries_no_exact_pin_address_or_donor(client, accepted):
    pickup = client.get("/api/donations", headers=auth(accepted["courier"])).json()[0]

    for field in WITHHELD:
        assert pickup[field] is None, f"{field} reached a courier who has not claimed this pickup"


def test_the_withheld_pin_is_replaced_by_a_coarse_area(client, accepted):
    """Withheld, then stood in for — not coarsened in place.

    The area is the donation's own pin on D-45's 0.01 degree grid, about a
    kilometre a side, and it is text rather than a second pair of coordinates
    so that nothing downstream can mistake it for the pin it replaces.
    """
    pickup = client.get("/api/donations", headers=auth(accepted["courier"])).json()[0]

    blurred_lat, blurred_lng = blurred_coords(CAMPUS["latitude"], CAMPUS["longitude"])
    assert pickup["pickupArea"] == f"Approx. {blurred_lat:.2f}N, {blurred_lng:.2f}E"

    # Coarse, and demonstrably not the pin: the true position is inside the
    # cell and no digit in the response says where in it.
    assert f"{CAMPUS['latitude']}" not in pickup["pickupArea"]
    assert (blurred_lat, blurred_lng) != (CAMPUS["latitude"], CAMPUS["longitude"])


def test_the_coarse_area_is_not_the_address_text_under_another_name(client, accepted):
    pickup = client.get("/api/donations", headers=auth(accepted["courier"])).json()[0]

    assert ADDRESS not in pickup["pickupArea"]
    assert "Rajindra" not in pickup["pickupArea"]
    assert "Patiala" not in pickup["pickupArea"]


def test_no_field_of_an_unclaimed_pickup_leaks_the_donor(client, accepted):
    """The whole serialized response, not a field list, is what a reader gets.

    A redaction that leaves the same value reachable through `description`, an
    event note or a score is not a redaction, so this reads the response as the
    text it actually is.
    """
    pickup = client.get("/api/donations", headers=auth(accepted["courier"])).json()[0]
    blob = json.dumps(pickup)

    assert ADDRESS not in blob
    assert DONOR_NAME not in blob
    assert DONOR_ORG not in blob
    assert "30.354" not in blob
    assert "76.363" not in blob


def test_the_list_and_the_id_lookup_redact_alike(client, accepted):
    """Two readings of one donation cannot disagree about what is disclosed."""
    courier = auth(accepted["courier"])
    listed = client.get("/api/donations", headers=courier).json()[0]
    by_id = client.get(f"/api/donations/{accepted['id']}", headers=courier).json()

    assert listed == by_id


def test_a_couriers_matches_reading_carries_no_donor_pin(client, accepted):
    """`/matches` is about kitchens, and stays that way for a courier.

    Its read scope is the donation's, so a courier reaches it for an unclaimed
    pickup; what comes back describes recipients, and `distanceKm` was already
    withheld from this reader by D-47.
    """
    matches = client.get(
        f"/api/donations/{accepted['id']}/matches", headers=auth(accepted["courier"])
    )
    assert matches.status_code == 200

    blob = json.dumps(matches.json())
    assert ADDRESS not in blob
    assert DONOR_NAME not in blob
    assert "30.354" not in blob
    assert all(m["distanceKm"] is None for m in matches.json())


# ─── The claim is what discloses ─────────────────────────────────────────────

def test_claiming_a_pickup_discloses_the_pin_address_and_donor(client, accepted):
    claimed = claim(client, accepted["courier"], accepted["id"])
    assert claimed.status_code == 200, claimed.text

    body = claimed.json()
    assert body["latitude"] == CAMPUS["latitude"]
    assert body["longitude"] == CAMPUS["longitude"]
    assert body["location"] == ADDRESS
    assert body["donorName"] == DONOR_NAME
    assert body["donorOrganization"] == DONOR_ORG
    assert body["donorId"] is not None
    # The stand-in goes away with the thing it stood in for.
    assert body["pickupArea"] is None


def test_the_disclosure_survives_the_rest_of_the_run(client, accepted):
    """A courier collects and delivers against the address, not the response
    that happened to carry it once."""
    claim(client, accepted["courier"], accepted["id"])
    courier = auth(accepted["courier"])

    for target in ("PICKED_UP", "DELIVERED"):
        moved = client.post(
            f"/api/donations/{accepted['id']}/status",
            json={"status": target},
            headers=courier,
        )
        assert moved.status_code == 200, moved.text
        assert moved.json()["location"] == ADDRESS

    read_back = client.get(f"/api/donations/{accepted['id']}", headers=courier).json()
    assert read_back["location"] == ADDRESS
    assert read_back["latitude"] == CAMPUS["latitude"]
    assert read_back["donorName"] == DONOR_NAME


def test_a_rival_courier_gets_nothing_from_a_claimed_pickup(client, accepted):
    """Two guards, and the first is the read scope it always was."""
    claim(client, accepted["courier"], accepted["id"])
    rival = auth(accepted["rival"])

    assert client.get("/api/donations", headers=rival).json() == []

    by_id = client.get(f"/api/donations/{accepted['id']}", headers=rival)
    assert by_id.status_code == 404
    assert ADDRESS not in by_id.text
    assert DONOR_NAME not in by_id.text


def test_attempting_a_claim_that_loses_discloses_nothing(client, accepted):
    """Trying is not claiming.

    The losing courier is answered from `_claim_pickup`'s refusal, before any
    donation is serialized, so a second claim cannot be used as a read.
    """
    claim(client, accepted["courier"], accepted["id"])

    refused = claim(client, accepted["rival"], accepted["id"])
    assert refused.status_code == 409
    assert ADDRESS not in refused.text
    assert DONOR_NAME not in refused.text
    assert "30.354" not in refused.text


def test_releasing_a_pickup_closes_the_disclosure_again(client, accepted, db_session):
    """The boundary is the row's `volunteer_id`, so it turns back over too.

    A kitchen releasing a pickup (D-41) clears the courier, which puts the
    donation back in the unclaimed pool — and back behind the coarse area for
    the courier who used to hold it.
    """
    claim(client, accepted["courier"], accepted["id"])

    released = client.post(
        f"/api/donations/{accepted['id']}/status",
        json={"status": "ACCEPTED"},
        headers=auth(accepted["ngo"]),
    )
    assert released.status_code == 200, released.text

    after = client.get(f"/api/donations/{accepted['id']}", headers=auth(accepted["courier"]))
    assert after.status_code == 200
    for field in WITHHELD:
        assert after.json()[field] is None
    assert after.json()["pickupArea"] is not None


def test_a_courier_account_with_no_profile_reads_no_pin(client, accepted, db_session):
    """Fail closed, the way every other scope helper does.

    `_readable_by` still shows such an account the unclaimed pool, so the
    disclosure scope has to answer for itself rather than rely on the read
    scope having excluded the row.
    """
    profile = (
        db_session.query(Volunteer)
        .join(User, Volunteer.user_id == User.id)
        .filter(User.email == "courier@example.com")
        .one()
    )
    db_session.delete(profile)
    db_session.commit()

    pickup = client.get("/api/donations", headers=auth(accepted["courier"])).json()[0]
    for field in WITHHELD:
        assert pickup[field] is None
    assert pickup["pickupArea"] is not None


# ─── Everybody else reads what they always did ───────────────────────────────

@pytest.mark.parametrize("reader", ["donor", "ngo"])
def test_the_donor_and_the_accepting_kitchen_are_unaffected(client, accepted, reader):
    body = client.get(f"/api/donations/{accepted['id']}", headers=auth(accepted[reader])).json()

    assert body["latitude"] == CAMPUS["latitude"]
    assert body["longitude"] == CAMPUS["longitude"]
    assert body["location"] == ADDRESS
    assert body["donorName"] == DONOR_NAME
    assert body["donorOrganization"] == DONOR_ORG
    assert body["donorId"] is not None
    assert body["pickupArea"] is None


def test_an_administrator_is_unaffected(client, db_session, accepted):
    body = client.get(
        f"/api/donations/{accepted['id']}", headers=auth(admin_token(client, db_session))
    ).json()

    assert body["location"] == ADDRESS
    assert body["latitude"] == CAMPUS["latitude"]
    assert body["donorName"] == DONOR_NAME
    assert body["pickupArea"] is None


def test_a_courier_reading_a_claimed_pickup_does_not_widen_anyone_else(client, accepted):
    """The scope is per reader *and* per row, so one claim discloses one row."""
    second = client.post(
        "/api/donations",
        json=donation_body(foodName="Rice and Dal", location="9 Leela Bhawan, Patiala"),
        headers=auth(accepted["donor"]),
    )
    assert second.status_code == 201
    second_id = second.json()["id"]
    client.post(
        f"/api/donations/{second_id}/status", json={"status": "ACCEPTED"}, headers=auth(accepted["ngo"])
    )

    claim(client, accepted["courier"], accepted["id"])

    by_id = {d["id"]: d for d in client.get("/api/donations", headers=auth(accepted["courier"])).json()}
    assert by_id[accepted["id"]]["location"] == ADDRESS
    assert by_id[second_id]["location"] is None
    assert by_id[second_id]["pickupArea"] is not None
