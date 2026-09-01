"""FoodLink API application entry point.

Run locally with:
    uvicorn foodlink.main:app --reload --app-dir code
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import Base, engine
from .routers import admin, auth, donations, metrics, organisations

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    # Fine for SQLite and coursework. Introduce Alembic before the schema has
    # to change without dropping data.
    Base.metadata.create_all(bind=engine)
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
