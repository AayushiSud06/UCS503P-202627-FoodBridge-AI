"""Signing-key configuration.

The property under test is narrow and load-bearing: the application must not
run on a signing key that anybody can read. Everything here builds `Settings`
directly rather than going through `get_settings`, because that one is
`lru_cache`d and the cache is process-wide.
"""

from __future__ import annotations

import pytest

from foodlink.config import (
    DEV_MODE_ENV_VAR,
    DEV_SIGNING_KEY,
    MIN_SECRET_KEY_LENGTH,
    RETIRED_INSECURE_SECRET,
    ConfigurationError,
    Settings,
    get_settings,
)

VALID_KEY = "a-perfectly-adequate-signing-key-of-sufficient-length"


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    """Every test starts with neither variable set.

    `conftest.py` exports a key for the rest of the suite, so without this the
    "missing key" cases would silently pass for the wrong reason.
    """
    monkeypatch.delenv("FOODLINK_SECRET_KEY", raising=False)
    monkeypatch.delenv(DEV_MODE_ENV_VAR, raising=False)


# ─── The critical property ────────────────────────────────────────────────────

def test_missing_key_refuses_to_start():
    with pytest.raises(ConfigurationError) as caught:
        Settings()

    message = str(caught.value)
    assert "FOODLINK_SECRET_KEY is not set" in message
    # The message has to be actionable on its own — this is the only place a
    # deployer finds out what to do.
    assert "secrets.token_urlsafe" in message
    assert DEV_MODE_ENV_VAR in message


def test_the_retired_default_is_refused_even_when_set_deliberately(monkeypatch):
    """The old fallback is public, so setting it back is not a way in."""
    monkeypatch.setenv("FOODLINK_SECRET_KEY", RETIRED_INSECURE_SECRET)

    with pytest.raises(ConfigurationError) as caught:
        Settings()
    assert "public" in str(caught.value)


def test_a_short_key_is_refused(monkeypatch):
    monkeypatch.setenv("FOODLINK_SECRET_KEY", "too-short")

    with pytest.raises(ConfigurationError) as caught:
        Settings()
    assert str(MIN_SECRET_KEY_LENGTH) in str(caught.value)


def test_a_key_of_exactly_the_minimum_length_is_accepted(monkeypatch):
    monkeypatch.setenv("FOODLINK_SECRET_KEY", "k" * MIN_SECRET_KEY_LENGTH)

    assert Settings().secret_key == "k" * MIN_SECRET_KEY_LENGTH


def test_whitespace_only_key_counts_as_missing(monkeypatch):
    """`export FOODLINK_SECRET_KEY=` must not read as 'configured'."""
    monkeypatch.setenv("FOODLINK_SECRET_KEY", "   ")

    with pytest.raises(ConfigurationError):
        Settings()


# ─── Errors must not leak the value they are complaining about ────────────────

def test_error_messages_never_echo_the_configured_secret(monkeypatch):
    secret = "short-but-secret"
    monkeypatch.setenv("FOODLINK_SECRET_KEY", secret)

    with pytest.raises(ConfigurationError) as caught:
        Settings()
    assert secret not in str(caught.value)


# ─── A configured key is used as-is ───────────────────────────────────────────

def test_a_configured_key_is_used_and_not_flagged_as_development(monkeypatch):
    monkeypatch.setenv("FOODLINK_SECRET_KEY", VALID_KEY)

    settings = Settings()
    assert settings.secret_key == VALID_KEY
    assert settings.using_dev_secret is False


def test_surrounding_whitespace_is_trimmed(monkeypatch):
    monkeypatch.setenv("FOODLINK_SECRET_KEY", f"  {VALID_KEY}  ")

    assert Settings().secret_key == VALID_KEY


def test_an_explicit_key_wins_over_development_mode(monkeypatch):
    monkeypatch.setenv("FOODLINK_SECRET_KEY", VALID_KEY)
    monkeypatch.setenv(DEV_MODE_ENV_VAR, "1")

    settings = Settings()
    assert settings.secret_key == VALID_KEY
    assert settings.using_dev_secret is False


# ─── The development opt-in ───────────────────────────────────────────────────

@pytest.mark.parametrize("value", ["1", "true", "TRUE", "yes", "on"])
def test_development_mode_opt_in_is_accepted(monkeypatch, value):
    monkeypatch.setenv(DEV_MODE_ENV_VAR, value)

    settings = Settings()
    assert settings.secret_key == DEV_SIGNING_KEY
    assert settings.using_dev_secret is True


@pytest.mark.parametrize("value", ["0", "false", "no", "", "maybe"])
def test_anything_other_than_an_affirmative_is_not_an_opt_in(monkeypatch, value):
    """Only a deliberate yes enables the development key."""
    monkeypatch.setenv(DEV_MODE_ENV_VAR, value)

    with pytest.raises(ConfigurationError):
        Settings()


def test_the_development_key_is_not_the_retired_one():
    """The published key stays retired; dev mode does not resurrect it."""
    assert DEV_SIGNING_KEY != RETIRED_INSECURE_SECRET
    assert len(DEV_SIGNING_KEY) >= MIN_SECRET_KEY_LENGTH


# ─── Unrelated settings still behave ──────────────────────────────────────────

def test_other_settings_keep_their_defaults(monkeypatch):
    monkeypatch.setenv("FOODLINK_SECRET_KEY", VALID_KEY)

    settings = Settings()
    assert settings.access_token_minutes == 720
    assert settings.max_match_radius_km == 8
    assert settings.is_sqlite is True
    assert settings.cors_origins == [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


def test_get_settings_is_cached(monkeypatch):
    monkeypatch.setenv("FOODLINK_SECRET_KEY", VALID_KEY)
    get_settings.cache_clear()
    try:
        assert get_settings() is get_settings()
    finally:
        # Leave the cache holding the suite's own key, not this test's.
        get_settings.cache_clear()
