"""Who may read which recipient organisation.

`RecipientOut` carries a named contact and a phone number, so `GET /api/recipients`
is a directory of people as much as of places. These cover who may see one at
all — the same property `test_donation_reads.py` covers for donations, on the
neighbouring table.
"""

from __future__ import annotations

import pytest

from conftest import admin_token, auth, register, register_ngo


def set_contact(client, token: str, *, person: str, phone: str) -> None:
    """Put real contact details on the caller's own organisation."""
    response = client.patch(
        "/api/recipients/me",
        json={"contactPerson": person, "phone": phone},
        headers=auth(token),
    )
    assert response.status_code == 200, response.text


def listed(client, token: str) -> list[dict]:
    response = client.get("/api/recipients", headers=auth(token))
    assert response.status_code == 200, response.text
    return response.json()


def listed_ids(client, token: str) -> set[int]:
    return {r["id"] for r in listed(client, token)}


MY_PHONE = "+91-98100-00001"
THEIR_PHONE = "+91-98100-00002"
THEIR_CONTACT = "Ravi Kapoor"


@pytest.fixture
def two_kitchens(client, db_session):
    """Two organisations, each with a contact person and a phone on file."""
    mine, mine_id = register_ngo(client, db_session, email="mine-org@test.com", org="My Kitchen")
    theirs, theirs_id = register_ngo(
        client, db_session, email="their-org@test.com", org="Rival Kitchen"
    )
    set_contact(client, mine, person="Asha Mehra", phone=MY_PHONE)
    set_contact(client, theirs, person=THEIR_CONTACT, phone=THEIR_PHONE)
    return mine, mine_id, theirs, theirs_id


# ─── NGO ─────────────────────────────────────────────────────────────────────

def test_an_ngo_sees_only_its_own_organisation(client, two_kitchens):
    mine, mine_id, _, theirs_id = two_kitchens
    assert listed_ids(client, mine) == {mine_id}
    assert theirs_id not in listed_ids(client, mine)


def test_an_ngo_cannot_read_another_kitchens_contact_details(client, two_kitchens):
    """The defect this scoping closes: a phone number belonging to somebody else."""
    mine, _, _, _ = two_kitchens
    body = client.get("/api/recipients", headers=auth(mine)).text
    assert THEIR_PHONE not in body
    assert THEIR_CONTACT not in body


def test_an_ngo_still_reads_its_own_profile_from_the_list(client, two_kitchens):
    """The NGO portal resolves its own organisation out of this list, so it must stay."""
    mine, mine_id, _, _ = two_kitchens
    own = listed(client, mine)
    assert [r["id"] for r in own] == [mine_id]
    assert own[0]["contactPerson"] == "Asha Mehra"
    assert own[0]["phone"] == MY_PHONE


def test_an_ngo_with_no_organisation_row_reads_nothing(client, db_session):
    """A narrowed clause, not a widened one — and not a 500 either."""
    from foodlink.models import Recipient, User

    token, recipient_id = register_ngo(
        client, db_session, email="orphan-ngo@test.com", org="Orphan Kitchen"
    )
    # Detach the account from its organisation the way an administrator's
    # cleanup could, leaving an ngo account with nothing of its own.
    db_session.query(Recipient).filter(Recipient.id == recipient_id).update({"user_id": None})
    db_session.commit()
    assert db_session.query(User).count() >= 1

    assert listed(client, token) == []


# ─── Donor ───────────────────────────────────────────────────────────────────

def test_a_donor_reads_no_organisations(client, two_kitchens):
    donor = register(client, email="scope-donor@test.com", role="donor")
    assert listed(client, donor) == []


def test_a_donor_cannot_reach_contact_details_through_any_recipient_route(client, two_kitchens):
    donor = register(client, email="probing-donor@test.com", role="donor")
    assert THEIR_PHONE not in client.get("/api/recipients", headers=auth(donor)).text
    # `/recipients/me` is the only other read of this shape, and it is ngo-only.
    assert client.get("/api/recipients/me", headers=auth(donor)).status_code == 403


# ─── Volunteer ───────────────────────────────────────────────────────────────

def test_a_volunteer_reads_no_organisations(client, two_kitchens):
    """A courier is given the delivery address on the donation, not the roster."""
    courier = register(client, email="scope-courier@test.com", role="volunteer")
    assert listed(client, courier) == []


def test_a_volunteer_cannot_reach_contact_details_through_any_recipient_route(
    client, two_kitchens
):
    courier = register(client, email="probing-courier@test.com", role="volunteer")
    assert THEIR_PHONE not in client.get("/api/recipients", headers=auth(courier)).text
    assert client.get("/api/recipients/me", headers=auth(courier)).status_code == 403


# ─── Admin ───────────────────────────────────────────────────────────────────

def test_an_administrator_reads_every_organisation(client, db_session, two_kitchens):
    """Verification is an administrator's job, so the whole directory stays theirs."""
    _, mine_id, _, theirs_id = two_kitchens
    root = admin_token(client, db_session)
    assert listed_ids(client, root) >= {mine_id, theirs_id}
    assert THEIR_PHONE in client.get("/api/recipients", headers=auth(root)).text


# ─── The matrix ──────────────────────────────────────────────────────────────

def test_only_an_administrator_reads_an_organisation_it_does_not_own(client, db_session):
    """For every role: the list returns exactly what that role's scope allows."""
    mine, mine_id = register_ngo(client, db_session, email="mx-mine@test.com", org="Mine")
    theirs, theirs_id = register_ngo(client, db_session, email="mx-theirs@test.com", org="Theirs")
    donor = register(client, email="mx-donor@test.com", role="donor")
    courier = register(client, email="mx-courier@test.com", role="volunteer")
    root = admin_token(client, db_session)

    expected = {
        "own kitchen": (mine, {mine_id}),
        "other kitchen": (theirs, {theirs_id}),
        "donor": (donor, set()),
        "volunteer": (courier, set()),
    }
    for label, (token, visible) in expected.items():
        assert listed_ids(client, token) == visible, label

    assert listed_ids(client, root) >= {mine_id, theirs_id}


def test_an_unauthenticated_caller_reads_nothing(client, two_kitchens):
    assert client.get("/api/recipients").status_code == 401
