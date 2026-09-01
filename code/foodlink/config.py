"""Runtime configuration.

Everything that differs between a laptop, the staging box and the phone build
is read from the environment so that no deployment detail is baked into code.
"""

import os
from functools import lru_cache


class Settings:
    def __init__(self) -> None:
        # SQLite by default so the project runs with no database server.
        # Point DATABASE_URL at Postgres in staging and nothing else changes.
        self.database_url: str = os.getenv("DATABASE_URL", "sqlite:///./foodlink.db")

        # Signing key for access tokens. MUST be overridden in any deployment;
        # the default exists only so a fresh clone starts without setup.
        # 32+ bytes so HS256 is used at its intended strength even in dev.
        self.secret_key: str = os.getenv(
            "FOODLINK_SECRET_KEY",
            "dev-only-insecure-key-replace-me-in-deployment",
        )
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
