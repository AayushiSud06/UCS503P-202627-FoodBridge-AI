# TASKS — FoodLink / FoodBridge-AI

> Verified against commit `8386371`, working tree clean. Context: `PROJECT_STATE.md`.
>
> **Provenance rule:** everything under *Completed* is verified present in the
> repository. Everything under *Current / Next / Backlog* is **recommended work
> derived from analysis — not a commitment made by the project.** No task here was
> invented from a template; each traces to a specific gap or defect found in the code.

---

## Current

**Nothing in progress.** The working tree is clean; `e47bd86` (CI) and `8386371`
(the `frontend/src/lib/` gitignore fix) are committed locally but **not pushed**, so
the CI failure they fix is still the last run visible on GitHub. No feature branch, no
partial implementation, no TODO/FIXME markers in `code/foodlink/` or `frontend/src/`.

The hardening phase is finished — *Next* is empty.

---

## Next — hardening (recommended, ordered)

**Empty.** Every item that was here — the signing key, Alembic, donation read scoping
and CI — is done; see *Completed*.

Nothing has been promoted from *Backlog* to replace them. The strongest candidates, if
hardening continues, are rate limiting on `/api/auth/login` and scoping
`GET /api/recipients`; both are recommendations from analysis, not commitments.

---

## Backlog

### Security
- [ ] Rate-limit `POST /api/auth/login` and `/register` (`slowapi`). No limiting exists anywhere.
- [ ] Shorten access tokens (currently 720 min) and add refresh tokens, **or** add a
      `token_version` column compared in `get_current_user` for real revocation.
      Today logout is client-side only.
- [ ] Issue `PRAGMA foreign_keys = ON` for SQLite via a connection event listener —
      declared FKs are currently unenforced on the default configuration.
- [ ] Validate and length-cap `image_url` (currently unconstrained `Text`, receives
      base64 data URLs).
- [ ] Send security headers + a CSP (none are sent today; would materially reduce the
      localStorage-token risk).
- [ ] MFA and an admin audit log — an admin compromise is currently total, with no
      record beyond `status_events`.

### Correctness / concurrency
- [ ] Fix the courier claim race: replace the read-then-write guard in `update_status`
      with a conditional `UPDATE … WHERE volunteer_id IS NULL` + row-count check, or
      `SELECT … FOR UPDATE`. Holds on SQLite today; a real TOCTOU on Postgres.
- [ ] **Decide** whether a donation stuck in `ACCEPTED` past its deadline should expire.
      The sweep only touches `AVAILABLE`/`MATCHED`. Currently undecided, not merely unbuilt.
- [ ] **Decide** what revoking verification should do to an already-accepted donation.
      Currently nothing happens; untested.
- [ ] Add a global exception handler returning a correlation id — an unhandled 500
      currently reaches the user as "cannot reach the server".

### Performance
- [ ] Aggregate `GET /api/metrics` in SQL and cache it (~60 s). Currently loads every
      donation and every event into memory.
- [ ] Push the match radius into SQL as a lat/long bounding box before scoring.
      `rank_recipients` currently receives every recipient; the radius filters in Python.
- [ ] Add cursor or offset pagination. `limit` is capped at 500 with no way to page.
- [ ] Frontend code splitting per portal (`React.lazy`) — `App.tsx` eagerly imports all
      four portals plus the mobile tree.

### Testing
- [ ] Unit tests for `matching.py`'s five scoring functions at their boundaries
      (overflow ratio, negative deadline slack, the reliability cliff at 3 donations).
      The module is pure and currently only exercised through the API.
- [ ] Round-trip test for `UtcDateTime` — it exists to prevent a subtle timezone bug
      and has no direct test.
- [ ] Frontend tests (Vitest + Testing Library), starting with `ProtectedRoute`.
      83 TS files, zero tests.
- [ ] Concurrency test for the courier claim (currently tested sequentially).

### Features / gaps
- [ ] `PATCH` / `DELETE` for requirements — they can be created and listed but never
      edited or deactivated.
- [ ] Schedule the expiry sweep (cron or APScheduler holding an admin token). Until
      then the expiry-loss metric understates reality.
- [ ] Wire `useIsMobile` into a redirect, **or** decide `/m/*` is a deliberately-linked
      experience. Currently the hook is dead code and nothing routes phones there.
- [ ] Use `COLD_STORAGE` to gate matching as its comment describes, or delete it.
- [ ] Implement a courier rating flow, or drop `Volunteer.rating` (never written by any
      API path).
- [ ] Structured logging — the app has no `logging` configuration at all.
- [ ] Readiness probe that runs `SELECT 1`. `/api/health` reports healthy with a dead
      database.

### Cleanup
- [ ] Delete template residue: `code/Makefile`, `code/src/`, `code/inc/`,
      `code/run_main.o` (C++ scaffold, unrelated to FoodLink).
- [ ] Fix `pyproject.toml` — still names the course template; `requires-python = ">=3.8"`
      contradicts the 3.10+ syntax in use.
- [ ] Resolve the duplicate `foodlink.db` (repo root vs `code/`) caused by the relative
      SQLite path.

### Longer-term
- [ ] Generate the TypeScript client from the OpenAPI schema instead of hand-mirroring
      types in `lib/api.ts`.
- [ ] Adopt React Query for server state — would keep write-then-refetch correctness
      while removing its chattiness.
- [ ] Postgres + PostGIS for spatial indexing once organisation count grows.
- [ ] Notifications (email/SMS/push) on match and assignment — no integration exists.
- [ ] WebSockets/SSE for a live donation feed.
- [ ] Tune matching weights against real outcome data; revisit the 20 km/h travel
      constant and the 85 reliability prior.

---

## Blocked

**Nothing is blocked by an external dependency or unavailable decision.**

One item is *sequenced* rather than blocked:
- Multi-worker uvicorn deployment → requires Postgres first; SQLite's single writer
  would corrupt under concurrent workers. It also requires moving
  `ensure_schema_current()` out of the app lifespan into a deploy step, or the workers
  race to migrate (D-23).

*(Postgres was sequenced behind Alembic, which now exists.)*

---

## Completed (verified in the repository)

### Continuous integration — `e47bd86`, `8386371`
- [x] **`.github/workflows/ci.yml`** runs on push to `master`/`main` and on every pull
      request, in two parallel jobs.
- [x] Backend job (Python 3.13): `pip install -r code/requirements-dev.txt`, then
      `pytest code/tests` — no signing key is exported for it, because `conftest.py`
      supplies its own, which keeps the suite's self-containment under test.
- [x] Migration drift is caught by `alembic -c code/alembic.ini upgrade head` followed by
      `alembic ... check`, against a throwaway SQLite file in the workspace. That step
      needs a key only because `migrations/env.py` resolves the URL through the
      fail-closed `Settings`; the workflow supplies a literal non-secret placeholder.
- [x] Frontend job (Node 20): `npm ci` + `npm run build` (= `tsc && vite build`), so a
      type regression fails CI. pip and npm caches keyed off the lockfile/requirements.
- [x] `.github/workflows/mkdocs.yml` left alone — documentation deployment stays
      separate from validation. No application code changed. See `DECISIONS.md` D-25.
- [x] **First run caught a real defect** (`8386371`): the frontend job failed with
      TS2307 for `frontend/src/lib/{api,adapters,hooks,time,geo}`, which the root
      `.gitignore`'s unanchored `lib/` had been excluding from every clone since the
      files were written. Pattern anchored to `/lib/`; the five modules committed.
      Backend job passed on the same run.

### Donation read authorization — `ea0f499`
- [x] **`GET /api/donations` is scoped server-side by role and ownership**, whatever
      `mine` is set to. `mine` remains a narrowing convenience filter only.
- [x] **`GET /api/donations/{id}` applies the identical scope**, in the query, so an
      unauthorised id returns the same 404 as a nonexistent one — no existence leak.
      `GET /api/donations/{id}/matches` follows the same scope.
- [x] Scope: donor → their own · ngo → `AVAILABLE`/`MATCHED` plus their organisation's
      accepted · volunteer → unclaimed `ACCEPTED` plus their own assignments · admin →
      unrestricted. One helper (`_readable_by`) serves all three endpoints, and fails
      closed for a role it does not know. See `DECISIONS.md` D-24.
- [x] Lifecycle, matching and authentication untouched — `update_status` still resolves
      the donation unscoped, because its own role/ownership gates authorise it.
- [x] 13 tests in `code/tests/test_donation_reads.py`, including a matrix asserting the
      id lookup and the list agree for every role. Six of them fail against the previous
      code; the full suite is 80 passing.

### Database migrations — `3e1e168`
- [x] **Alembic added** — `code/alembic.ini` + `code/migrations/`. `env.py` takes the
      URL from `Settings` rather than the ini, so no environment-specific value is
      committed and migrations cannot address a different database than the app.
- [x] Initial revision `ae4636b1e6d4 initial schema`, autogenerated from the models
      against an empty database — the six tables exactly as they already were.
- [x] `create_all` replaced by `migrate.ensure_schema_current()` in `main.py`'s
      lifespan, `cli._session()` and `seed()`. A fresh database is now built from the
      revision history; the test suite still uses `create_all` deliberately (D-23).
- [x] A database predating migrations is warned about with the `alembic stamp head`
      remedy and left untouched, rather than being re-created over. Both local dev
      databases baselined this way — `code/foodlink.db` kept all 10 users / 6
      donations / 29 events, and `alembic check` then found no difference from the
      models.
- [x] 8 migration tests (`code/tests/test_migrations.py`), including a
      `compare_metadata` assertion that a migrated fresh database matches
      `Base.metadata`, and a test that the baselining procedure loses no rows.

### Security hardening — `3e1e168`
- [x] **Signing key is fail-closed.** `config.py` no longer defaults
      `FOODLINK_SECRET_KEY`; a missing key raises `ConfigurationError` while `Settings`
      is built — during import, so it precedes uvicorn binding and also covers
      `python -m foodlink.cli`.
- [x] The retired public key (`dev-only-insecure-key-replace-me-in-deployment`) is
      refused even when set deliberately; keys shorter than 32 chars are refused;
      error messages never echo the configured value.
- [x] `FOODLINK_DEV_INSECURE_SECRET=1` is the explicit local-development opt-in, using
      a stable dev key (so `--reload` does not sign developers out) that is **not** the
      retired one. `main.py`'s lifespan warns on every startup when it is active.
- [x] `conftest.py` exports its own test key before importing the app, so the suite
      needs no environment setup and never depends on the dev fallback.
- [x] 22 focused tests in `code/tests/test_config.py`. JWT signing/verification in
      `security.py` unchanged.

### Backend — `e48c9e7`
- [x] FastAPI application: 5 routers (`auth`, `admin`, `donations`, `organisations`,
      `metrics`) + `/api/health`, CORS allowlist, lifespan schema creation
- [x] 6-table SQLAlchemy 2.0 schema with a custom `UtcDateTime` type decorator
- [x] 9-state donation lifecycle enforced by `ALLOWED_TRANSITIONS` (409) and
      `TRANSITION_ROLES` (403)
- [x] Append-only `status_events` ledger, server-stamped, with actor attribution
- [x] Auth: bcrypt hashing, HS256 JWTs, per-request user re-read (immediate
      suspension), `require_roles` dependency factory, router-level admin gate
- [x] Two-tier admin model: `SELF_SIGNUP_ROLES` blocks self-registration as admin;
      CLI bootstraps the first administrator
- [x] Admin lockout guards: no self-demotion, last active admin protected
- [x] Organisation verification gating both match ranking and acceptance
- [x] Explainable matching engine: 5 weighted criteria, 3 hard gates, per-criterion
      sub-scores and reasons
- [x] Metrics derived from the event ledger: time-to-claim, handover, rescue rate,
      expiry-loss rate
- [x] Admin CLI (`create-admin`, `promote`, `reset-password`, `list-admins`) with
      `getpass` prompting
- [x] Seed script with deadlines relative to run time
- [x] 37 integration tests, no mocks, in-memory SQLite via `StaticPool` +
      `dependency_overrides` — **all passing** (80 total today, with the config,
      migration and read-scope tests above)

### Frontend
- [x] Four role portals (donor, ngo, volunteer, admin) with nested layouts — `eaeb51d`
- [x] Mobile screen set at `/m/*` with an inner `MobileRole` guard — `eaeb51d`/`bff0151`
- [x] Two-context state model (`AuthContext` identity, `AppContext` domain)
- [x] Single API boundary (`lib/api.ts`): token attachment, `ApiError`/`NetworkError`,
      global 401 handling with a re-entrancy guard, `extractDetail` for Pydantic errors
- [x] `ProtectedRoute` with loading splash, `from` memory, wrong-portal redirect
- [x] `useAction` keyed in-flight tracking; `useMatchAnalysis` preferring the caller's
      own organisation
- [x] Adapter layer isolating wire types from app domain types
- [x] Warm editorial palette retuned in `tailwind.config.js` — `eaeb51d`
- [x] **Mock data fully removed** (`mockData.ts`, 506 lines) — `01a9861`. No
      `mockData` references remain; the app runs entirely on the live API.

### Infrastructure
- [x] Vite dev proxy `/api → :8000`, eliminating CORS in development
- [x] `.claude/launch.json` frontend dev-server config
- [x] `.gitignore` covering `.env`, `node_modules`; no `.db` or `.env` tracked.
      `lib/` anchored to `/lib/` (`8386371`) after it hid `frontend/src/lib/` — the
      neighbouring `build/`, `dist/`, `var/`, `share/` are still unanchored
- [x] mkdocs documentation workflow — `.github/workflows/mkdocs.yml` (docs only;
      validation lives in `ci.yml`)
- [x] `ai/` context scaffolding — `5264fb3`
