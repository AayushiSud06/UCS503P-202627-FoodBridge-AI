"""Rate limiting on `POST /api/auth/login` and `POST /api/auth/register`.

Two properties, and they pull against each other: an automated run has to be
cut off, and an ordinary person — including one sharing an address with a
building full of other people — has to be left alone. So the endpoint tests
check both sides of the threshold, and that nothing about authentication
changes below it.

The endpoint tests shrink the limits rather than driving the real ceiling: the
mechanism is what they cover, and 31 bcrypt-priced logins per test would buy
nothing but seconds. The configured policy has its own tests at the bottom.
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from conftest import register
from foodlink import ratelimit
from foodlink.config import (
    DEFAULT_LOGIN_RATE_LIMIT,
    DEFAULT_LOGIN_RATE_WINDOW_SECONDS,
    DEFAULT_REGISTER_RATE_LIMIT,
    DEFAULT_REGISTER_RATE_WINDOW_SECONDS,
    ConfigurationError,
    Settings,
)
from foodlink.database import get_db
from foodlink.main import app
from foodlink.ratelimit import RATE_LIMITED_DETAIL, UNKNOWN_CLIENT, RateLimiter

PASSWORD = "testpassword123"


class FakeClock:
    """A clock the test moves by hand, so a window can pass without waiting."""

    def __init__(self, start: float = 1000.0) -> None:
        self.now = start

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


# ─── The limiter itself ───────────────────────────────────────────────────────

def test_requests_up_to_the_limit_are_allowed():
    limiter = RateLimiter(name="t", limit=3, window_seconds=60, clock=FakeClock())

    assert [limiter.record("caller") for _ in range(3)] == [None, None, None]


def test_the_request_past_the_limit_is_refused():
    limiter = RateLimiter(name="t", limit=3, window_seconds=60, clock=FakeClock())
    for _ in range(3):
        limiter.record("caller")

    # The whole window has to pass, because the oldest hit was taken just now.
    assert limiter.record("caller") == 60


def test_going_over_raises_429_carrying_retry_after():
    limiter = RateLimiter(name="t", limit=1, window_seconds=60, clock=FakeClock())
    limiter.check("caller")

    with pytest.raises(HTTPException) as caught:
        limiter.check("caller")

    assert caught.value.status_code == 429
    assert caught.value.detail == RATE_LIMITED_DETAIL
    assert caught.value.headers == {"Retry-After": "60"}


def test_two_keys_do_not_share_a_budget():
    limiter = RateLimiter(name="t", limit=2, window_seconds=60, clock=FakeClock())
    limiter.record("caller-a")
    limiter.record("caller-a")
    assert limiter.record("caller-a") is not None

    assert limiter.record("caller-b") is None


def test_the_window_slides_rather_than_resetting_wholesale():
    """Only the part of the history that has aged out is released."""
    clock = FakeClock()
    limiter = RateLimiter(name="t", limit=3, window_seconds=60, clock=clock)
    limiter.record("caller")  # t+0
    clock.advance(10)
    limiter.record("caller")  # t+10
    clock.advance(10)
    limiter.record("caller")  # t+20

    assert limiter.record("caller") == 40  # wait for the t+0 hit to expire

    clock.advance(41)  # now t+61, so only the t+0 hit has gone
    assert limiter.record("caller") is None
    assert limiter.record("caller") == 9  # ...and the t+10 hit is next to go


def test_a_refused_request_does_not_extend_the_lockout():
    """Otherwise retrying would keep pushing the window out in front of you."""
    clock = FakeClock()
    limiter = RateLimiter(name="t", limit=1, window_seconds=60, clock=clock)
    limiter.record("caller")

    clock.advance(59)
    for _ in range(20):
        assert limiter.record("caller") == 1

    clock.advance(1)
    assert limiter.record("caller") is None


def test_keys_whose_window_has_passed_are_swept():
    """The dict must not grow one entry per address seen, for ever."""
    clock = FakeClock()
    limiter = RateLimiter(name="t", limit=2, window_seconds=60, clock=clock)
    for n in range(ratelimit._SWEEP_THRESHOLD):
        limiter.record(f"caller-{n}")
    assert len(limiter._hits) == ratelimit._SWEEP_THRESHOLD

    clock.advance(61)
    limiter.record("someone-new")

    assert len(limiter._hits) == 1


def test_resetting_forgets_every_counter():
    limiter = RateLimiter(name="t", limit=1, window_seconds=60, clock=FakeClock())
    limiter.record("caller")

    limiter.reset()

    assert limiter.record("caller") is None


# ─── The endpoints ────────────────────────────────────────────────────────────

LOGIN_LIMIT = 3
REGISTER_LIMIT = 2


@pytest.fixture
def small_limits(monkeypatch):
    monkeypatch.setattr(ratelimit.login_limiter, "limit", LOGIN_LIMIT)
    monkeypatch.setattr(ratelimit.register_limiter, "limit", REGISTER_LIMIT)


@pytest.fixture
def client_at(db_session):
    """Build a `TestClient` presenting a chosen source address.

    The limiter counts per address, so showing that two callers do not share a
    budget takes two addresses; `TestClient` lets the peer it reports be set,
    and `request.client.host` is the only thing the limiter reads. These clients
    skip the context manager on purpose — the fixture database is already
    created, and entering it would re-run the startup migration step once per
    client a test builds.
    """

    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    try:
        yield lambda host: TestClient(app, client=(host, 50000))
    finally:
        app.dependency_overrides.clear()


def login(client: TestClient, email: str, password: str = PASSWORD):
    return client.post("/api/auth/login", data={"username": email, "password": password})


def sign_up(client: TestClient, email: str):
    return client.post(
        "/api/auth/register",
        json={"name": "Somebody", "email": email, "password": PASSWORD, "role": "donor"},
    )


def test_login_below_the_limit_behaves_exactly_as_before(client_at, small_limits):
    client = client_at("10.0.0.1")
    register(client, email="regular@test.com", role="donor")

    assert login(client, "regular@test.com").status_code == 200
    wrong = login(client, "regular@test.com", "not-the-password")
    assert wrong.status_code == 401
    assert wrong.json()["detail"] == "Incorrect email or password"


def test_login_past_the_limit_is_refused(client_at, small_limits):
    client = client_at("10.0.0.1")
    for _ in range(LOGIN_LIMIT):
        assert login(client, "nobody@test.com").status_code == 401

    refused = login(client, "nobody@test.com")

    assert refused.status_code == 429
    assert refused.json()["detail"] == RATE_LIMITED_DETAIL
    assert 0 < int(refused.headers["retry-after"]) <= ratelimit.login_limiter.window_seconds


def test_a_limited_login_says_nothing_about_the_account(client_at, small_limits):
    """Valid credentials buy no way past the limit, and the refusal for a real
    account is indistinguishable from the refusal for one that does not exist —
    the same reason login has a single error message for both."""
    client = client_at("10.0.0.1")
    register(client, email="real@test.com", role="donor")
    for _ in range(LOGIN_LIMIT):
        login(client, "nobody@test.com")

    real = login(client, "real@test.com")
    unknown = login(client, "also-nobody@test.com")

    assert real.status_code == unknown.status_code == 429
    assert real.json() == unknown.json()
    assert "real@test.com" not in real.text


def test_a_login_limit_lifts_once_its_window_has_passed(client_at, small_limits, monkeypatch):
    """The endpoint recovers on its own: a limited caller is not shut out for
    the life of the process."""
    clock = FakeClock()
    monkeypatch.setattr(ratelimit.login_limiter, "_clock", clock)
    client = client_at("10.0.0.1")
    for _ in range(LOGIN_LIMIT):
        login(client, "nobody@test.com")
    assert login(client, "nobody@test.com").status_code == 429

    clock.advance(ratelimit.login_limiter.window_seconds + 1)

    assert login(client, "nobody@test.com").status_code == 401


def test_registration_past_the_limit_is_refused(client_at, small_limits):
    client = client_at("10.0.0.1")
    for n in range(REGISTER_LIMIT):
        assert sign_up(client, f"signup{n}@test.com").status_code == 201

    refused = sign_up(client, "one-too-many@test.com")

    assert refused.status_code == 429
    assert refused.json()["detail"] == RATE_LIMITED_DETAIL
    # The refused request never reached the handler, so no account exists.
    assert login(client, "one-too-many@test.com").status_code == 401


def test_one_address_being_limited_does_not_touch_another(client_at, small_limits):
    limited = client_at("10.0.0.1")
    for _ in range(LOGIN_LIMIT):
        login(limited, "nobody@test.com")
    assert login(limited, "nobody@test.com").status_code == 429

    assert login(client_at("10.0.0.2"), "nobody@test.com").status_code == 401


def test_one_address_exhausting_registration_does_not_touch_another(client_at, small_limits):
    limited = client_at("10.0.0.1")
    for n in range(REGISTER_LIMIT):
        sign_up(limited, f"first-network-{n}@test.com")
    assert sign_up(limited, "first-network-extra@test.com").status_code == 429

    assert sign_up(client_at("10.0.0.2"), "second-network@test.com").status_code == 201


def test_the_two_endpoints_keep_separate_budgets(client_at, small_limits):
    """Failing to log in must not consume the ability to create an account."""
    client = client_at("10.0.0.1")
    for _ in range(LOGIN_LIMIT):
        login(client, "nobody@test.com")
    assert login(client, "nobody@test.com").status_code == 429

    assert sign_up(client, "still-welcome@test.com").status_code == 201


def test_a_caller_with_no_reported_address_still_has_a_budget():
    """A transport that reports no peer must not read as 'unlimited'."""
    anonymous = type("Request", (), {"client": None})()

    assert ratelimit.client_key(anonymous) == UNKNOWN_CLIENT


# ─── The configured policy ────────────────────────────────────────────────────

RATE_ENV_VARS = (
    "LOGIN_RATE_LIMIT",
    "LOGIN_RATE_WINDOW_SECONDS",
    "REGISTER_RATE_LIMIT",
    "REGISTER_RATE_WINDOW_SECONDS",
)


@pytest.fixture
def clean_rate_env(monkeypatch):
    """Nothing in this section may be swayed by the developer's shell."""
    for name in RATE_ENV_VARS:
        monkeypatch.delenv(name, raising=False)


def test_the_defaults_are_the_documented_policy(clean_rate_env):
    settings = Settings()

    assert (settings.login_rate_limit, settings.login_rate_window_seconds) == (30, 300)
    assert (settings.register_rate_limit, settings.register_rate_window_seconds) == (10, 3600)
    assert DEFAULT_LOGIN_RATE_LIMIT == 30
    assert DEFAULT_LOGIN_RATE_WINDOW_SECONDS == 300
    assert DEFAULT_REGISTER_RATE_LIMIT == 10
    assert DEFAULT_REGISTER_RATE_WINDOW_SECONDS == 3600


def test_a_deployment_can_retune_the_policy(clean_rate_env, monkeypatch):
    """A hot NAT needs a looser ceiling; a public deployment a tighter one."""
    monkeypatch.setenv("LOGIN_RATE_LIMIT", "5")
    monkeypatch.setenv("REGISTER_RATE_WINDOW_SECONDS", "60")

    settings = Settings()

    assert settings.login_rate_limit == 5
    assert settings.register_rate_window_seconds == 60
    assert settings.login_rate_window_seconds == DEFAULT_LOGIN_RATE_WINDOW_SECONDS


@pytest.mark.parametrize("value", ["0", "-1"])
def test_a_limit_that_would_refuse_everything_or_nothing_is_rejected(
    clean_rate_env, monkeypatch, value
):
    monkeypatch.setenv("LOGIN_RATE_LIMIT", value)

    with pytest.raises(ConfigurationError) as caught:
        Settings()
    assert "LOGIN_RATE_LIMIT" in str(caught.value)


def test_a_non_numeric_limit_is_rejected(clean_rate_env, monkeypatch):
    monkeypatch.setenv("REGISTER_RATE_LIMIT", "lots")

    with pytest.raises(ConfigurationError):
        Settings()
