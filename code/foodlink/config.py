"""Runtime configuration.

Everything that differs between a laptop, the staging box and the phone build
is read from the environment so that no deployment detail is baked into code.

The signing key is the exception to "sensible default": there is no safe value
to fall back to. A key that ships in the source is a key an attacker can read,
and with it they can mint a token for any account and any role. So a missing
key is a startup failure, not a default — and local development opts in
explicitly via `FOODLINK_DEV_INSECURE_SECRET` rather than getting the insecure
path for free.
"""

import os
from functools import lru_cache


class ConfigurationError(RuntimeError):
    """Configuration is missing or unsafe, and the process must not continue.

    Raised while `Settings` is built, which happens on the first
    `get_settings()` call — during import of `foodlink.database`,
    `foodlink.security` and `foodlink.main`. The failure therefore lands before
    uvicorn binds a port, and covers `python -m foodlink.cli` too.
    """


#: Opt-in for local development. Set to 1/true/yes/on to run with the
#: development signing key below. Named so that seeing it in a deployment's
#: environment is self-evidently wrong.
DEV_MODE_ENV_VAR = "FOODLINK_DEV_INSECURE_SECRET"

#: The key earlier revisions fell back to silently. It is in the git history and
#: in the project documentation, so it is public knowledge and is refused even
#: when set deliberately.
RETIRED_INSECURE_SECRET = "dev-only-insecure-key-replace-me-in-deployment"

#: Development-only signing key, reachable *only* through DEV_MODE_ENV_VAR.
#: Stable rather than randomly generated so `uvicorn --reload` does not sign
#: every developer out on each file save.
DEV_SIGNING_KEY = "foodlink-development-signing-key-not-for-any-deployment"

#: HS256 derives its strength from key length; below this the algorithm is
#: being used well under its intended margin.
MIN_SECRET_KEY_LENGTH = 32

_MISSING_KEY_MESSAGE = f"""\
FOODLINK_SECRET_KEY is not set.

This key signs and verifies every access token. There is no safe default, so
the application will not start without it.

  For a deployment, generate a key and put it in the environment:

      python -c "import secrets; print(secrets.token_urlsafe(48))"
      export FOODLINK_SECRET_KEY="<the generated value>"

  For local development, opt in to the insecure development key instead:

      export {DEV_MODE_ENV_VAR}=1

Never use the development key for anything reachable from a network you do not
control."""

_TRUTHY = {"1", "true", "yes", "on"}


def _dev_mode_enabled() -> bool:
    return os.getenv(DEV_MODE_ENV_VAR, "").strip().lower() in _TRUTHY


def _resolve_secret_key() -> tuple[str, bool]:
    """Return `(key, is_development_key)` or raise `ConfigurationError`.

    Error messages deliberately describe the *problem* and never echo the
    configured value, so a misconfigured secret cannot leak into a log or a
    crash report.
    """
    configured = os.getenv("FOODLINK_SECRET_KEY", "").strip()

    if configured:
        if configured == RETIRED_INSECURE_SECRET:
            raise ConfigurationError(
                "FOODLINK_SECRET_KEY is set to the insecure key that earlier "
                "revisions used as a default. That value is public, so it is "
                "refused. Generate a new one:\n\n"
                '    python -c "import secrets; print(secrets.token_urlsafe(48))"'
            )
        if len(configured) < MIN_SECRET_KEY_LENGTH:
            raise ConfigurationError(
                f"FOODLINK_SECRET_KEY is too short: it must be at least "
                f"{MIN_SECRET_KEY_LENGTH} characters, and the configured value "
                f"is {len(configured)}. Generate one:\n\n"
                '    python -c "import secrets; print(secrets.token_urlsafe(48))"'
            )
        return configured, False

    if _dev_mode_enabled():
        return DEV_SIGNING_KEY, True

    raise ConfigurationError(_MISSING_KEY_MESSAGE)


class Settings:
    def __init__(self) -> None:
        # SQLite by default so the project runs with no database server.
        # Point DATABASE_URL at Postgres in staging and nothing else changes.
        self.database_url: str = os.getenv("DATABASE_URL", "sqlite:///./foodlink.db")

        # Signing key for access tokens. Required — see the module docstring.
        # `using_dev_secret` lets startup say so out loud rather than leaving it
        # to be discovered.
        self.secret_key: str
        self.using_dev_secret: bool
        self.secret_key, self.using_dev_secret = _resolve_secret_key()

        self.access_token_minutes: int = int(os.getenv("ACCESS_TOKEN_MINUTES", "720"))

        # Browser origins allowed to call the API.
        self.cors_origins: list[str] = [
            o.strip()
            for o in os.getenv(
                "CORS_ORIGINS",
                "http://localhost:5173,http://127.0.0.1:5173",
            ).split(",")
            if o.strip()
        ]

        # Recipients further than this are not scored at all — it bounds the
        # ranking work as the number of organisations grows.
        self.max_match_radius_km: float = float(os.getenv("MAX_MATCH_RADIUS_KM", "8"))

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")


@lru_cache
def get_settings() -> Settings:
    return Settings()
