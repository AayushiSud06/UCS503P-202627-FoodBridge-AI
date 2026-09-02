# PROJECT_STATE — FoodLink / FoodBridge-AI

> Compressed project memory. Companions: `ARCHITECTURE.md` (how it is built),
> `TASKS.md` (what is left), `DECISIONS.md` (why it is built that way).
> Last verified against the repository: 2026-09-02, one commit past `8abc666` on
> branch `master`. ⚠️ The recipient read-scope fix below is **in the working tree,
> not yet committed** — it is the only difference from `origin/master`.

## What this project is

A coordination platform for redistributing surplus food. Donors post surplus with
coordinates and a pickup deadline; the server ranks nearby **verified** recipient
organisations and attaches an explainable match score; a recipient accepts, a
volunteer courier collects and delivers, the recipient confirms receipt. Every
transition is stamped server-side into an append-only ledger, which is what makes
the platform's metrics evidence rather than self-report.

Course project (UCS503P 2026-27 ODD). Four roles: `donor`, `ngo`, `volunteer`, `admin`.

⚠️ **The name says "AI" but the matcher is a transparent weighted-sum heuristic, not
a learned model.** This is deliberate (see `DECISIONS.md` D-05). Never describe it
as ML.

## Current status: working end-to-end, not deployed

| Area | State |
|---|---|
| Backend API | ✅ Complete and functional — 5 routers, 6 tables, full lifecycle |
| Frontend web | ✅ Complete — 4 role portals, wired to the live API |
| Frontend mobile | ✅ Screens exist at `/m/*`; ⚠️ unreachable without typing the URL |
| Auth / RBAC | ✅ Complete — JWT, 4 authorization layers; donation **and** recipient reads scoped by role/ownership |
| Signing-key config | ✅ Fail-closed — no insecure default; explicit dev opt-in |
| Backend tests | ✅ 91 tests passing (~54 s): 37 integration + 13 donation-read-scope + 11 recipient-read-scope + 22 config + 8 migration |
| Frontend tests | ❌ None exist |
| CI | ✅ GitHub Actions runs the tests, the frontend build and `alembic check` |
| Migrations | ✅ Alembic; 1 revision; startup applies `upgrade head` |
| Deployment | ❌ No configuration of any kind |

⚠️ **Local development now requires one env var.** A fresh clone must export either
`FOODLINK_SECRET_KEY` or `FOODLINK_DEV_INSECURE_SECRET=1` before the backend, the CLI
**or an `alembic` command** will start — `migrations/env.py` gets the database URL from
the same `Settings` object. The error message states both options. Tests supply their
own key in `conftest.py` and need no setup.

## Recently completed (newest first)

- *(uncommitted)* — **`GET /api/recipients` scoped by role and ownership.** It returned
  every organisation, `contact_person` and `phone` included, to any authenticated
  account. `_visible_recipients(user)` now returns the caller's scope as a WHERE clause
  applied in the query: admin → everything · ngo → its own row · donor and volunteer →
  nothing · unknown role → nothing. Denial is an empty list rather than a 403,
  deliberately unlike `GET /api/volunteers`; the frontend already treats the two
  identically. No individual-recipient read endpoint existed to scope alongside it, and
  the frontend, the lifecycle and the auth paths are untouched. 11 new tests, nine of
  which fail against the previous code. See `DECISIONS.md` D-26.
- `f8a7297` — **`TASKS.md` reconciled** against the repository and the Project Knowledge
  Guide's improvement roadmap. Documentation only, no code touched. The four completed
  hardening items were confirmed and removed from the open list; roadmap work that had
  never been transcribed was recovered (Postgres-for-deployment, deployment
  configuration, dependency auditing in CI, object storage, and others); the open list
  is now tagged back to its source (`R-n`/`B-n`/`S-n`) so it can be re-audited
  mechanically. *Next* is no longer empty — see **Current development focus** below.
- `8386371` — **`frontend/src/lib/` was never in the repository.** The vendored
  Python `.gitignore` template's unanchored `lib/` (under "Distribution / packaging")
  matches a directory of that name at *any* depth, so it silently swallowed five
  hand-written TypeScript modules — `api`, `adapters`, `hooks`, `time`, `geo`. They
  never appeared as untracked, existed in every developer's working tree, and were
  absent from every clone. CI's first run found it: TS2307 on all five. The pattern
  is now `/lib/`, anchored to the root where setuptools output would be, and the
  modules are committed. No application code or import changed.
  ⚠️ **Lesson worth keeping:** an unanchored `.gitignore` pattern applies at every
  depth. `build/`, `dist/`, `var/`, `share/` in the same block are still unanchored
  and would do the same to a frontend directory of that name.
- `e47bd86` — **CI.** `.github/workflows/ci.yml` runs on every push to
  `master`/`main` and every pull request: a backend job (`pytest code/tests`, then
  `alembic upgrade head` + `alembic check` against a throwaway SQLite file) and a
  frontend job (`npm ci` + `npm run build`, which is `tsc && vite build`). The
  mkdocs workflow is untouched. No application code changed. See `DECISIONS.md` D-25.
  Its first run already paid for itself — see the entry above.
- `ea0f499` — **Donation reads scoped by role and ownership.** `GET /api/donations`
  no longer returns every record to any authenticated account, and `GET /api/donations/{id}`
  (plus `/matches`) applies the same scope in the query — an unauthorised id returns the
  ordinary 404, so it does not confirm the donation exists. Admin stays unrestricted; the
  lifecycle, matching and auth paths are untouched. 13 new tests. See `DECISIONS.md` D-24.
- `3e1e168` — **Alembic migration system.** `code/alembic.ini` + `code/migrations/`;
  one revision (`ae4636b1e6d4`) representing the schema as it already was. All three
  `create_all` callers (`main.py` lifespan, `cli._session`, `seed`) now call
  `migrate.ensure_schema_current()`. Both existing dev databases baselined with
  `alembic stamp head`, data intact. 8 new tests. See `DECISIONS.md` D-23.
- `3e1e168` — **Signing-key hardening.** `config.py` no longer defaults the JWT
  secret; missing configuration raises `ConfigurationError` at import. Adds
  `FOODLINK_DEV_INSECURE_SECRET` as the explicit local-development opt-in and 22 config
  tests. See `DECISIONS.md` D-22.
- `5264fb3` — `ai/` context scaffolding committed (these four files, initially empty)
- `01a9861` — **`frontend/src/data/mockData.ts` deleted (506 lines).** Completes the
  migration from prototype mock data to the live API. No `mockData` references remain
  anywhere in `frontend/src/`.
- `e48c9e7` — **Entire backend built** (`code/foodlink/`, ~2,300 lines): models,
  schemas, security, matching, 5 routers, CLI, seed, plus 37 tests.
- `eaeb51d` — Frontend redesigned for mobile responsiveness; warm editorial palette
  retuned in `tailwind.config.js` (see `DECISIONS.md` D-10).

**Interpretation for future sessions:** the project just crossed from "prototype with
fake data" to "real client/server application". The frontend hook surface
(`useDonations`, `useStats`, …) was deliberately preserved during that migration so
the existing screens did not need rewriting — only the data source changed.

## Current development focus

No feature work is in progress. The hardening sequence — signing-key configuration,
migrations, donation read scoping, CI, recipient read scoping — is complete, and with it
every unscoped read of personal contact data is closed. `TASKS.md` → *Next* now holds two
ordered items:

1. Rate-limit `POST /api/auth/login` and `/register` — now the highest-severity open item
2. Fix the courier claim race — inert on SQLite, a real TOCTOU once Postgres lands

Everything else sits in `TASKS.md` → *Backlog* (grouped hardening, then optional
expansion and cleanup) or *Blocked* (four open decisions). None of it has been
committed to.

## Known issues and blockers

**Nothing blocks development or local use.** Ordered by severity; numbering is kept
stable as items are resolved, so gaps are expected.

✅ **Resolved:** the insecure default JWT signing key. `config.py` is now fail-closed —
a missing `FOODLINK_SECRET_KEY` raises `ConfigurationError` during import (before
uvicorn binds, and covering the CLI). Local development opts in explicitly via
`FOODLINK_DEV_INSECURE_SECRET=1`, which warns at every startup. The retired public key
is refused even when set deliberately.

✅ **Resolved:** no migration system. Alembic now owns the schema (D-23); a fresh
database is built from the revision history and a model change can be applied without
dropping data. **Remaining migration-related caveat:** `ensure_schema_current()` runs
inside the app's lifespan, which is safe only because SQLite confines a deployment to
one process. Moving to Postgres with multiple uvicorn workers requires moving it to a
deploy step first, or the workers race to migrate.

✅ **Resolved:** donation reads were not scoped by ownership. `routers/donations._readable_by()`
now returns the caller's read scope as a WHERE clause applied by the list, the id lookup
and `/matches` alike, so knowing an id is not a way past the list (D-24).

✅ **Resolved:** `GET /api/recipients` returned every organisation's contact person and
phone to any authenticated account. `routers/organisations._visible_recipients()` now
scopes it in the query the same way (D-26). **Remaining read-exposure caveat:**
`GET /api/metrics` is still platform-wide for everyone — a product question rather than a
defect, tracked in `TASKS.md` → *Blocked*.

✅ **Resolved:** tests never ran in CI. `.github/workflows/ci.yml` runs the backend
suite, the frontend build and `alembic check` on push and pull request (D-25).
**Remaining caveat:** there are still no frontend tests, so `tsc` is the only frontend
gate — a type-correct behavioural regression passes CI.

### High
3. **No rate limiting anywhere.** Login is brute-forceable; bcrypt cost is the only
   bound.

### Medium
5. **Courier claim is a read-then-write race.** The guard in `update_status` reads
   `volunteer_id` then writes it with no row lock or unique constraint. SQLite
   serialises writes so it holds today; on Postgres it is a genuine TOCTOU window.
6. **Expiry sweep has no scheduler.** `POST /api/admin/maintenance/expire` must be
   called manually, so the expiry-loss metric currently **understates** reality.
7. **`GET /api/metrics` loads the whole donations table plus all events into memory**
   and computes medians in Python.
8. **Match ranking loads every recipient**; the radius filter runs in Python after
   the rows are already fetched. `config.py`'s comment claims the radius bounds the
   work — it does not, as written.
9. **SQLite foreign keys are not enforced** — `PRAGMA foreign_keys` is never issued.

### Low / correctness oddities
10. **A donation accepted but never delivered is stuck forever** — the sweep only
    touches `AVAILABLE` and `MATCHED`. Undecided whether intentional.
11. **Revoking verification mid-lifecycle has no effect** on an already-accepted
    donation. Untested, undecided.
12. Two `foodlink.db` files exist (repo root and `code/`) because the SQLite path is
    relative to the working directory — a recurring "my data vanished" trap. Both are
    now stamped at head; only `code/foodlink.db` holds data (10 users, 6 donations).
13. `image_url` has no length or format validation; frontend sends base64 data URLs
    into a `Text` column.
14. An unhandled 500 reaches the user as "Cannot reach the FoodLink server" because
    `api.ts` maps a bodiless 5xx to `NetworkError` — a crash looks like an outage.

## Technical debt

**Dead code (verified unused):**
- `matching.COLD_STORAGE` — defined, never referenced, despite its comment saying
  storage type should gate matching.
- `frontend/src/mobile/useIsMobile.ts` — never imported. Consequence: nothing routes
  a phone visitor to `/m/*`; entry is by URL only.
- `Volunteer.rating` — never written by any API path (`VolunteerUpdate` excludes it);
  only `seed.py` varies it. Every courier created through the app is permanently 5.0.

**Template residue from the course scaffold (unrelated to FoodLink):**
- `code/Makefile`, `code/src/`, `code/inc/`, `code/run_main.o` — C++ build artefacts
  that compile `libbvr_math.so`. Safe to delete.
- `pyproject.toml` still names the template project and declares
  `requires-python = ">=3.8"`, but the code uses 3.10+ union syntax (`X | None`).

**Structural:**
- No service layer — business logic lives in router functions. `update_status` is
  ~80 lines mixing HTTP concerns with domain rules. Acceptable at this size; the cut
  line is documented in `DECISIONS.md` D-07.
- TypeScript wire types in `lib/api.ts` mirror the Pydantic schemas **by hand**. A
  backend rename is a silent runtime break, not a compile error.
- No structured logging anywhere; no `logging` configuration in the app.
- Requirements can be created and listed but never edited or deactivated — no
  `PATCH`/`DELETE` endpoints exist.

## Immediate priorities

1. Commit the recipient read-scope change sitting in the working tree
2. Rate-limit `POST /api/auth/login` and `/register`
3. Fix the courier claim race, before the Postgres work makes it exploitable

⚠️ These are **recommendations from analysis, not commitments the project has made.**
`TASKS.md` → *Next* is the canonical version with scope and estimates; update there
first so the two cannot drift.

## Conventions worth preserving

- **Wire format is camelCase**, Python is snake_case; `alias_generator=to_camel` on
  the shared Pydantic `Schema` base does the translation. Grepping the full stack for
  `food_name` will miss `foodName`.
- **Error `detail` strings are written as sentences for humans** and passed straight
  to frontend toasts. Keep new ones in that voice.
- **Test names are sentences describing security properties**
  (`test_a_suspended_accounts_existing_token_stops_working`), not `test_update_2`.
- Code comments explain *why*, not *what*, and several encode real design rationale.
  Preserve them when editing.
