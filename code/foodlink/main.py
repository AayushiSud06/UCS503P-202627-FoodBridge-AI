"""FoodLink API application entry point.

Run locally with:
    uvicorn foodlink.main:app --reload --app-dir code
"""

import warnings
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import DEV_MODE_ENV_VAR, get_settings
from .migrate import ensure_schema_current
from .routers import admin, auth, donations, metrics, organisations

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    # A missing signing key has already stopped the process by this point —
    # `get_settings()` runs during import. What is left to do is say so when the
    # *development* key is in use, so that a box which was never meant to be
    # running it announces the fact on every boot instead of looking healthy.
    if settings.using_dev_secret:
        warnings.warn(
            "FoodLink is signing tokens with the development key "
            f"({DEV_MODE_ENV_VAR} is set). Anyone who can read the source can "
            "forge a token. Never expose this instance to an untrusted network.",
            RuntimeWarning,
            stacklevel=2,
        )

    # Alembic owns the schema — this applies any revision the database has not
    # seen and is a no-op once it is at head. See `foodlink.migrate` for why it
    # runs here rather than as a separate deploy step, and for what happens to
    # a database that predates migration control.
    ensure_schema_current()
    yield


app = FastAPI(
    lifespan=lifespan,
    title="FoodLink API",
    description=(
        "Coordination platform for surplus food redistribution. "
        "Status transitions are timestamped server-side; the metrics endpoint "
        "derives time-to-claim and rescue rate from that history."
    ),
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(donations.router)
app.include_router(organisations.router)
app.include_router(metrics.router)


@app.get("/api/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok", "time": datetime.now(timezone.utc).isoformat()}
