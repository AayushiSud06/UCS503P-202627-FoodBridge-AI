# PROJECT_STATE — FoodLink / FoodBridge-AI

> Compressed project memory. Companions: `ARCHITECTURE.md` (how it is built),
> `TASKS.md` (what is left), `DECISIONS.md` (why it is built that way).
> Last verified against the repository: 2026-09-01, commit `5264fb3`, branch `master`.

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
| Auth / RBAC | ✅ Complete — JWT, 4 authorization layers |
| Backend tests | ✅ 37 integration tests, all passing (~19 s) |
| Frontend tests | ❌ None exist |
| CI | ⚠️ Docs-only workflow; tests never run automatically |
| Migrations | ❌ None — `create_all` at startup |
| Deployment | ❌ No configuration of any kind |

Working tree is clean. Untracked: `CLAUDE.md`, `PROJECT_KNOWLEDGE_GUIDE.{md,pdf}`.

## Recently completed (newest first)

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

No feature work is in progress. The natural next phase is **hardening**: the
application works, but nothing about it is production-safe yet. The highest-value
work is in `TASKS.md` → Next, and it is mostly infrastructure and authorization
scoping rather than new features.

## Known issues and blockers

**Nothing blocks development or local use.** Items 1–2 below do block *deployment* —
that is a gate on shipping, not on continuing to build. Ordered by severity.

### Critical
1. **Default JWT signing key ships in code.** `config.py` falls back to
   `"dev-only-insecure-key-replace-me-in-deployment"` when `FOODLINK_SECRET_KEY` is
   unset, and **the app starts anyway**. A misconfigured deployment allows anyone to
   forge an admin token. Blocks any deployment.
2. **No migrations.** `Base.metadata.create_all` creates missing tables but never
   alters existing ones. Adding a model column silently does nothing; queries then
   fail. Current workaround is deleting the `.db` file. Blocks any deployment that
   must retain data.

### High
3. **Donation reads are not scoped by ownership.** `GET /api/donations` defaults to
   `mine=false` and `GET /api/donations/{id}` has no ownership check, so any
   authenticated account can read every donation including exact coordinates and
   donor names. `GET /api/recipients` likewise exposes contact person and phone.
4. **No rate limiting anywhere.** Login is brute-forceable; bcrypt cost is the only
   bound.
5. **Tests never run in CI.** Only `.github/workflows/mkdocs.yml` exists and it
   deploys documentation. A commit breaking all 37 tests merges with no signal.

### Medium
6. **Courier claim is a read-then-write race.** The guard in `update_status` reads
   `volunteer_id` then writes it with no row lock or unique constraint. SQLite
   serialises writes so it holds today; on Postgres it is a genuine TOCTOU window.
7. **Expiry sweep has no scheduler.** `POST /api/admin/maintenance/expire` must be
   called manually, so the expiry-loss metric currently **understates** reality.
8. **`GET /api/metrics` loads the whole donations table plus all events into memory**
   and computes medians in Python.
9. **Match ranking loads every recipient**; the radius filter runs in Python after
   the rows are already fetched. `config.py`'s comment claims the radius bounds the
   work — it does not, as written.
10. **SQLite foreign keys are not enforced** — `PRAGMA foreign_keys` is never issued.

### Low / correctness oddities
11. **A donation accepted but never delivered is stuck forever** — the sweep only
    touches `AVAILABLE` and `MATCHED`. Undecided whether intentional.
12. **Revoking verification mid-lifecycle has no effect** on an already-accepted
    donation. Untested, undecided.
13. Two `foodlink.db` files exist (repo root and `code/`) because the SQLite path is
    relative to the working directory — a recurring "my data vanished" trap.
14. `image_url` has no length or format validation; frontend sends base64 data URLs
    into a `Text` column.
15. An unhandled 500 reaches the user as "Cannot reach the FoodLink server" because
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

1. Fail fast on the default secret key
2. Add Alembic and an initial revision
3. Scope donation reads by role/ownership
4. Add CI running `pytest` + `npm run build`

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
