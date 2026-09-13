"""Rate limiting on `POST /api/donations` (DQ-4, D-59).

A donor may post 10 donations an hour from their account, and donors on one
network may post 30 between them. The audit posted 40 in a row and every one was
a `201`; each of those was also a probe of the 8 km matching gate (`HA-3a`).

The tests drive the real policy rather than shrunken limits: donation creation
is not bcrypt-priced, so exact boundaries at 10 and 30 cost little. The limiters
are pinned to the documented defaults anyway, so an override exported in a
developer's shell cannot move a boundary under test, and a hand-moved clock
stands in for the hour.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from conftest import admin_token, auth, register
from foodlink import ratelimit
from foodlink.config import (
    DEFAULT_DONATION_ACCOUNT_RATE_LIMIT,
    DEFAULT_DONATION_ACCOUNT_RATE_WINDOW_SECONDS,
    DEFAULT_DONATION_IP_RATE_LIMIT,
    DEFAULT_DONATION_IP_RATE_WINDOW_SECONDS,
    ConfigurationError,
    Settings,
    get_settings,
)
from foodlink.database import get_db
from foodlink.main import app
from foodlink.ratelimit import (
    DONATION_ACCOUNT_RATE_LIMITED_DETAIL,
    RATE_LIMITED_DETAIL,
    RateLimiter,
)

ACCOUNT_LIMIT = DEFAULT_DONATION_ACCOUNT_RATE_LIMIT
NETWORK_LIMIT = DEFAULT_DONATION_IP_RATE_LIMIT
WINDOW = DEFAULT_DONATION_ACCOUNT_RATE_WINDOW_SECONDS

CAMPUS = {"latitude": 30.3540, "longitude": 76.3630}


class FakeClock:
    """A clock the test moves by hand, so an hour can pass without waiting."""

    def __init__(self, start: float = 1000.0) -> None:
        self.now = start

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


@pytest.fixture
def clock(monkeypatch) -> FakeClock:
    """Both donation limiters on the DQ-4 policy, sharing one hand-moved clock."""
    clock = FakeClock()
    account, network = ratelimit.donation_account_limiter, ratelimit.donation_ip_limiter
    monkeypatch.setattr(account, "limit", DEFAULT_DONATION_ACCOUNT_RATE_LIMIT)
    monkeypatch.setattr(account, "window_seconds", DEFAULT_DONATION_ACCOUNT_RATE_WINDOW_SECONDS)
    monkeypatch.setattr(network, "limit", DEFAULT_DONATION_IP_RATE_LIMIT)
    monkeypatch.setattr(network, "window_seconds", DEFAULT_DONATION_IP_RATE_WINDOW_SECONDS)
    monkeypatch.setattr(account, "_clock", clock)
    monkeypatch.setattr(network, "_clock", clock)
    return clock


@pytest.fixture
def client_at(db_session):
    """Build a `TestClient` presenting a chosen source address.

    As in `test_rate_limit.py`: the network budget is keyed on
    `request.client.host`, and these clients skip the context manager so the
    startup migration step does not run once per client.
    """

    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    try:
        yield lambda host: TestClient(app, client=(host, 50000))
    finally:
        app.dependency_overrides.clear()


def donation_body(hours_ahead: float = 6, **overrides) -> dict:
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
        **overrides,
    }


def post(client: TestClient, token: str, **body_overrides):
    return client.post("/api/donations", json=donation_body(**body_overrides), headers=auth(token))


def own_donations(client: TestClient, token: str) -> list[dict]:
    response = client.get("/api/donations", headers=auth(token))
    assert response.status_code == 200, response.text
    return response.json()


def fill_network(client: TestClient, donors: list[str]) -> None:
    """Three donors each post their full account budget: the network's thirty."""
    assert len(donors) * ACCOUNT_LIMIT == NETWORK_LIMIT
    for token in donors:
        for _ in range(ACCOUNT_LIMIT):
            created = post(client, token)
            assert created.status_code == 201, created.text


def donors_on(client: TestClient, count: int, prefix: str = "donor") -> list[str]:
    return [register(client, email=f"{prefix}{n}@test.com", role="donor") for n in range(count)]


# ─── The account budget ───────────────────────────────────────────────────────

def test_a_donor_can_post_right_up_to_the_account_limit(client_at, clock):
    client = client_at("10.0.0.1")
    token = register(client, email="donor@test.com", role="donor")

    for _ in range(ACCOUNT_LIMIT):
        created = post(client, token)
        assert created.status_code == 201, created.text
        # Below the limit creation is what it always was: stamped, unassigned.
        assert created.json()["status"] == "AVAILABLE"
        assert [e["toStatus"] for e in created.json()["events"]] == ["AVAILABLE"]

    assert len(own_donations(client, token)) == ACCOUNT_LIMIT


def test_the_post_after_the_account_limit_is_refused_for_the_account(client_at, clock):
    client = client_at("10.0.0.1")
    token = register(client, email="donor@test.com", role="donor")
    assert post(client, token).status_code == 201  # at t+0
    clock.advance(600)
    for _ in range(ACCOUNT_LIMIT - 1):
        assert post(client, token).status_code == 201  # at t+600

    refused = post(client, token)

    assert refused.status_code == 429
    # One sentence naming the account, and nothing about how it is counted.
    assert refused.json() == {"detail": DONATION_ACCOUNT_RATE_LIMITED_DETAIL}
    # The t+0 post is the one that has to leave the hour.
    assert refused.headers["retry-after"] == str(WINDOW - 600)
    # The refused post never reached the handler.
    assert len(own_donations(client, token)) == ACCOUNT_LIMIT


def test_the_audits_forty_rapid_posts_stop_at_the_account_limit(client_at, clock):
    """The 2026-09-10 reproduction: 40 posts in a row were 40 × `201`."""
    client = client_at("10.0.0.1")
    token = register(client, email="donor@test.com", role="donor")

    statuses = [post(client, token).status_code for _ in range(40)]

    assert statuses == [201] * ACCOUNT_LIMIT + [429] * (40 - ACCOUNT_LIMIT)
    assert len(own_donations(client, token)) == ACCOUNT_LIMIT


def test_the_account_window_slides_and_refused_retries_do_not_extend_it(client_at, clock):
    client = client_at("10.0.0.1")
    token = register(client, email="donor@test.com", role="donor")
    assert post(client, token).status_code == 201  # at t+0
    clock.advance(600)
    for _ in range(ACCOUNT_LIMIT - 1):
        assert post(client, token).status_code == 201  # at t+600
    for _ in range(5):
        assert post(client, token).status_code == 429

    clock.advance(WINDOW - 600 - 1)  # t+3599: the t+0 post is still inside
    assert post(client, token).headers["retry-after"] == "1"

    clock.advance(1)  # t+3600: only the t+0 post has aged out
    assert post(client, token).status_code == 201
    refused = post(client, token)
    assert refused.status_code == 429
    assert refused.headers["retry-after"] == "600"  # the t+600 posts are next


def test_a_second_donor_on_the_same_network_has_an_account_budget_of_their_own(client_at, clock):
    client = client_at("10.0.0.1")
    first, second = donors_on(client, 2)
    for _ in range(ACCOUNT_LIMIT):
        assert post(client, first).status_code == 201
    assert post(client, first).status_code == 429

    for _ in range(ACCOUNT_LIMIT):
        assert post(client, second).status_code == 201
    refused = post(client, second)
    assert refused.status_code == 429
    assert refused.json()["detail"] == DONATION_ACCOUNT_RATE_LIMITED_DETAIL


def test_moving_to_another_network_does_not_reset_the_account_budget(client_at, clock):
    home = client_at("10.0.0.1")
    token = register(home, email="donor@test.com", role="donor")
    for _ in range(ACCOUNT_LIMIT):
        assert post(home, token).status_code == 201

    refused = post(client_at("10.0.0.2"), token)

    assert refused.status_code == 429
    assert refused.json()["detail"] == DONATION_ACCOUNT_RATE_LIMITED_DETAIL


# ─── The network budget ───────────────────────────────────────────────────────

def test_donors_sharing_a_network_share_its_budget(client_at, clock):
    client = client_at("10.0.0.1")
    *first_three, fourth = donors_on(client, 4)
    fill_network(client, first_three)

    # The fourth donor has not posted anything, and is still refused.
    refused = post(client, fourth)

    assert refused.status_code == 429
    assert refused.json() == {"detail": RATE_LIMITED_DETAIL}
    assert refused.headers["retry-after"] == str(WINDOW)
    assert own_donations(client, fourth) == []


def test_the_network_budget_lifts_when_its_hour_has_passed(client_at, clock):
    client = client_at("10.0.0.1")
    *first_three, fourth = donors_on(client, 4)
    fill_network(client, first_three)
    assert post(client, fourth).status_code == 429

    clock.advance(WINDOW)

    assert post(client, fourth).status_code == 201


def test_a_limited_network_leaves_other_networks_and_sign_in_alone(client_at, clock):
    busy = client_at("10.0.0.1")
    *first_three, fourth = donors_on(busy, 4)
    fill_network(busy, first_three)
    assert post(busy, fourth).status_code == 429

    assert post(client_at("10.0.0.2"), fourth).status_code == 201
    # The auth budgets are separate limiters and are not spent by donations.
    signed_in = busy.post(
        "/api/auth/login", data={"username": "donor0@test.com", "password": "testpassword123"}
    )
    assert signed_in.status_code == 200


# ─── How the two budgets meet ─────────────────────────────────────────────────

def test_a_post_refused_for_the_account_spends_none_of_the_network_budget(client_at, clock):
    """A donor hammering past their own ceiling must not lock out their network."""
    client = client_at("10.0.0.1")
    hammering, *others = donors_on(client, 4)
    for _ in range(ACCOUNT_LIMIT):
        assert post(client, hammering).status_code == 201
    for _ in range(NETWORK_LIMIT):
        assert post(client, hammering).json()["detail"] == DONATION_ACCOUNT_RATE_LIMITED_DETAIL

    # Ten posts of the network's thirty are spent; two more donors fill the rest.
    for token in others[:2]:
        for _ in range(ACCOUNT_LIMIT):
            assert post(client, token).status_code == 201

    refused = post(client, others[2])
    assert refused.status_code == 429
    assert refused.json()["detail"] == RATE_LIMITED_DETAIL


def test_a_post_refused_for_the_network_spends_none_of_the_account_budget(client_at, clock):
    """A donor turned away because their network is busy keeps their own budget."""
    busy = client_at("10.0.0.1")
    *first_three, late = donors_on(busy, 4)
    fill_network(busy, first_three)
    for _ in range(5):
        assert post(busy, late).json()["detail"] == RATE_LIMITED_DETAIL

    elsewhere = client_at("10.0.0.2")
    for _ in range(ACCOUNT_LIMIT):
        assert post(elsewhere, late).status_code == 201
    refused = post(elsewhere, late)
    assert refused.status_code == 429
    assert refused.json()["detail"] == DONATION_ACCOUNT_RATE_LIMITED_DETAIL


def test_a_donor_over_both_budgets_is_told_about_the_account(client_at, clock):
    """The account is checked first, so its sentence is the one a donor sees."""
    client = client_at("10.0.0.1")
    donors = donors_on(client, 3)
    fill_network(client, donors)

    refused = post(client, donors[0])

    assert refused.status_code == 429
    assert refused.json()["detail"] == DONATION_ACCOUNT_RATE_LIMITED_DETAIL


# ─── Who is counted, and what counts ──────────────────────────────────────────

def test_an_administrator_is_not_limited_and_spends_no_donor_budget(client_at, db_session, clock):
    client = client_at("10.0.0.1")
    root = admin_token(client, db_session)

    for _ in range(NETWORK_LIMIT + 1):
        created = post(client, root)
        assert created.status_code == 201, created.text

    # Thirty-one admin posts from this address left its donor budget whole.
    fill_network(client, donors_on(client, 3))
    assert len(own_donations(client, root)) == 2 * NETWORK_LIMIT + 1


def test_a_request_without_a_donor_identity_spends_nothing(client_at, clock):
    """401 and 403 are answered by the role gate before the limit is reached."""
    client = client_at("10.0.0.1")
    courier = register(client, email="courier@test.com", role="volunteer")

    for _ in range(NETWORK_LIMIT + 1):
        assert client.post("/api/donations", json=donation_body()).status_code == 401
        assert post(client, "not-a-token").status_code == 401
        assert post(client, courier).status_code == 403

    fill_network(client, donors_on(client, 3))


def test_a_post_the_server_rejects_as_invalid_still_counts(client_at, clock):
    """D-27: the limiter runs before the handler and never learns the outcome.

    FastAPI resolves route dependencies before it validates the body, so a post
    the schema rejects counts, and so does one the handler itself refuses.
    """
    client = client_at("10.0.0.1")
    token = register(client, email="donor@test.com", role="donor")
    for _ in range(ACCOUNT_LIMIT - 1):
        assert post(client, token, quantity=0).status_code == 422  # the schema
    assert post(client, token, hours_ahead=-1).status_code == 422  # the handler

    refused = post(client, token)

    assert refused.status_code == 429
    assert refused.json()["detail"] == DONATION_ACCOUNT_RATE_LIMITED_DETAIL
    assert own_donations(client, token) == []


# ─── The limiter additions ────────────────────────────────────────────────────

def test_a_limiter_refuses_with_its_own_message_when_given_one():
    limiter = RateLimiter(name="t", limit=1, window_seconds=60, detail="Slow down.", clock=FakeClock())
    limiter.check("caller")

    with pytest.raises(HTTPException) as caught:
        limiter.check("caller")

    assert caught.value.status_code == 429
    assert caught.value.detail == "Slow down."
    assert caught.value.headers == {"Retry-After": "60"}


def test_releasing_takes_back_only_the_newest_hit():
    clock = FakeClock()
    limiter = RateLimiter(name="t", limit=2, window_seconds=60, clock=clock)
    limiter.record("caller")  # t+0
    clock.advance(10)
    limiter.record("caller")  # t+10
    assert limiter.record("caller") == 50

    limiter.release("caller")

    assert limiter.record("caller") is None  # the t+10 hit's slot is free again
    assert limiter.record("caller") == 50  # and the t+0 hit is still counted
    limiter.release("nobody")  # a key never seen is not an error


# ─── The configured policy ────────────────────────────────────────────────────

DONATION_RATE_ENV_VARS = (
    "DONATION_ACCOUNT_RATE_LIMIT",
    "DONATION_ACCOUNT_RATE_WINDOW_SECONDS",
    "DONATION_IP_RATE_LIMIT",
    "DONATION_IP_RATE_WINDOW_SECONDS",
)


@pytest.fixture
def clean_donation_env(monkeypatch):
    for name in DONATION_RATE_ENV_VARS:
        monkeypatch.delenv(name, raising=False)


def test_the_defaults_are_the_dq4_policy(clean_donation_env):
    settings = Settings()

    assert (settings.donation_account_rate_limit, settings.donation_account_rate_window_seconds) == (10, 3600)
    assert (settings.donation_ip_rate_limit, settings.donation_ip_rate_window_seconds) == (30, 3600)


def test_the_live_limiters_are_built_from_the_settings():
    settings = get_settings()
    account, network = ratelimit.donation_account_limiter, ratelimit.donation_ip_limiter

    assert (account.limit, account.window_seconds) == (
        settings.donation_account_rate_limit, settings.donation_account_rate_window_seconds
    )
    assert (network.limit, network.window_seconds) == (
        settings.donation_ip_rate_limit, settings.donation_ip_rate_window_seconds
    )
    assert account.detail == DONATION_ACCOUNT_RATE_LIMITED_DETAIL
    assert network.detail == RATE_LIMITED_DETAIL


def test_a_deployment_can_retune_the_donation_policy(clean_donation_env, monkeypatch):
    monkeypatch.setenv("DONATION_IP_RATE_LIMIT", "60")

    settings = Settings()

    assert settings.donation_ip_rate_limit == 60
    assert settings.donation_account_rate_limit == DEFAULT_DONATION_ACCOUNT_RATE_LIMIT


@pytest.mark.parametrize("name", DONATION_RATE_ENV_VARS)
@pytest.mark.parametrize("value", ["0", "-1", "lots"])
def test_a_donation_limit_that_is_not_a_positive_number_is_rejected(
    clean_donation_env, monkeypatch, name, value
):
    monkeypatch.setenv(name, value)

    with pytest.raises(ConfigurationError) as caught:
        Settings()
    assert name in str(caught.value)
