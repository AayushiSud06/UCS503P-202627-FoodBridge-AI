# PROJECT_STATE — FoodLink / FoodBridge-AI

> Compressed project memory. Companions: `ARCHITECTURE.md` (how it is built),
> `TASKS.md` (what is left), `DECISIONS.md` (why it is built that way).
> Last verified against the repository: 2026-09-02, branch `master`. The most recent
> implementation commit is `1181adb` (requirement lifecycle). The match-score
> consistency work was verified in the working tree, uncommitted at the time of writing;
> it is the only source change outside that commit.

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
| Auth rate limiting | ✅ Login and registration limited per client address; ⚠️ counter is **process-local** |
| Signing-key config | ✅ Fail-closed — no insecure default; explicit dev opt-in |
| Courier claim | ✅ Atomic — conditional UPDATE, safe on SQLite **and** Postgres; ⚠️ other transitions still read-then-write |
| Backend tests | ✅ 148 tests passing (~100 s): 37 integration + 15 requirement-lifecycle + 13 donation-read-scope + 11 recipient-read-scope + 11 match-score-consistency + 9 courier-claim + 22 rate-limit + 22 config + 8 migration |
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

- **working tree (uncommitted at verification)** — **One donation, one kitchen, one
  number.** The NGO's *Available Donations* list showed 94% for a donation whose analysis
  panel, on the same screen, said 64%. Both were right and neither answered the label's
  question: the list rendered `Donation.match_score`, which is **frozen at posting and
  describes whichever organisation ranked first platform-wide**, while the panel scored
  the reader's own pairing live. Two causes, both real — a different organisation, and a
  different moment (`deadline_score` decays continuously). `seed.py` supplied a third: it
  wrote a literal `94 - i*3` into the column, which is the exact 94 QA saw.
  `DonationOut` now carries **`viewerMatch`**, the calling organisation's own ranking
  computed per request through the same `score_pair`, and every NGO surface saying
  "match" reads it. The frozen score keeps its place and its meaning, relabelled where it
  shows ("Match score at acceptance"). The **whole** `MatchOut` travels, not just the
  total, so the list and the panel are one object from one request — measured on the
  running app, two independent live fetches disagreed by a point as the deadline decayed
  between them. No new column, no migration, `alembic check` clean. 11 new tests, plus
  manual verification through the running app on seeded data: Helping Hands reads 79% on
  both surfaces, Umeed Shelter 77% on both, for the same donation. See `DECISIONS.md`
  D-30.

- `1181adb` — **Requirements have a lifecycle.**
  An NGO can now revise, retire and reopen its own standing needs, not only post them.
  One new operation, `PATCH /api/requirements/{id}`: partial update in the existing
  `exclude_unset` style, with ownership as a term in the query, so another organisation's
  requirement is a 404 rather than a 403 and holding the `ngo` role alone is not enough.
  **Fulfilment is retirement** — the model carries one flag, `is_active`, and the list
  already filtered on it, so "mark fulfilled" and "no longer needed" write the same row
  and neither deletes it. No new column, no migration, `alembic check` clean. The NGO
  portal (desktop and mobile) reuses its existing modal for editing and adds *Edit* /
  *Mark fulfilled* per card. 15 new tests, plus manual verification through the running
  app against a copy of the dev database. See `DECISIONS.md` D-29.

- `e919f7b` — **The courier claim is atomic.**
  `donations._claim_pickup()` binds a courier with one conditional
  `UPDATE … WHERE id = :id AND status = :from_status AND (volunteer_id IS NULL OR
  volunteer_id = :courier)`; a `rowcount` of 0 means the claim was lost and becomes the
  409. The read-compare-assign it replaces let two couriers who both read an unclaimed
  pickup both assign themselves — reproduced through the HTTP endpoint, where the
  pre-fix code answers the loser `200` and overwrites the winner. `SELECT … FOR UPDATE`
  was rejected because SQLAlchemy compiles it away on SQLite, so the lock would not have
  existed on the engine the project tests against. No schema change; `alembic check`
  clean. 9 new tests, three of them driving two real transactions against a file-backed
  database. See `DECISIONS.md` D-28.

- `91544e3` — **`POST /api/auth/login` and `POST /api/auth/register` are rate
  limited.** A sliding-window counter per client address in `foodlink/ratelimit.py`,
  attached as a route dependency; over the ceiling the request never reaches the
  handler and gets `429` + `Retry-After`. Default policy: **30 logins per 5 minutes**
  and **10 registrations per hour**, per address, all four values tunable from the
  environment. Below the limit nothing about authentication changed. The counter lives
  in the process, which matches the one-worker deployment SQLite already forces — see
  `DECISIONS.md` D-27 for what that does and does not buy.

- `16497ea` — **`GET /api/recipients` scoped by role and ownership.** It returned
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

**Nothing is in progress, and `TASKS.md` → *Next* is empty.** The seven-step hardening
sequence — signing-key configuration, migrations, donation read scoping, CI, recipient
read scoping, authentication rate limiting, courier claim race — is complete, and the
requirement lifecycle was the first item taken out of *Backlog → F*. Every unscoped read
of personal contact data is closed, bcrypt is no longer the only bound on a
credential-stuffing run, and the one correctness defect that had to be fixed before
Postgres is fixed. The match-score work above came in from QA rather than from this
list, and is finished.

**What follows is a Project Manager call**, deliberately not decided here. The
consequence worth carrying into it: *Backlog → E* (Postgres, then deployment
configuration) is no longer gated by anything in the codebase, and it is also the
largest remaining block of work — while groups A and B hold several sub-hour items
(SQLite foreign-key enforcement, an `image_url` cap, a readiness probe) that would not
displace it.

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

✅ **Resolved:** there was no rate limiting anywhere, so bcrypt's cost was the only
bound on a credential-stuffing run. `POST /api/auth/login` and `POST /api/auth/register`
now count requests per client address over a sliding window and answer `429` above the
ceiling (D-27). **Remaining caveat — the counter is process-local:** it is a dict in
the worker, so two uvicorn workers would each keep their own and the effective limit
would double, and two hosts would multiply it again. That is honest for the deployment
the project has (SQLite confines it to one process), and it is a real constraint the
moment that changes. Behind a reverse proxy the limiter also needs
`uvicorn --proxy-headers --forwarded-allow-ips=<proxy>`, or every request arrives from
the proxy's address and shares one budget.

✅ **Resolved:** the courier claim was a read-then-write race. `donations._claim_pickup()`
now carries the condition in the UPDATE, so the database decides the winner as it applies
the write (D-28). **Remaining caveat — this covers the claim only:** every other
lifecycle transition still reads `donation.status`, checks it in Python and writes.
SQLite's serialised writes make that inert today; on Postgres two concurrent transitions
on one donation can both succeed and append two events. Tracked in `TASKS.md` →
*Backlog → D*.

### Medium
6. **Expiry sweep has no scheduler.** `POST /api/admin/maintenance/expire` must be
   called manually, so the expiry-loss metric currently **understates** reality.
7. **`GET /api/metrics` loads the whole donations table plus all events into memory**
   and computes medians in Python.
8. **Match ranking loads every recipient**; the radius filter runs in Python after
   the rows are already fetched. `config.py`'s comment claims the radius bounds the
   work — it does not, as written.
9. **SQLite foreign keys are not enforced** — `PRAGMA foreign_keys` is never issued.

✅ **Resolved:** the same donation could show two contradictory match percentages to one
NGO. `DonationOut.viewerMatch` now carries the reader's own ranking, computed through the
same `score_pair` as `/matches` and delivered with the donation, so the list and the
analysis panel are one value (D-30). **Remaining caveat — it is only as fresh as the
donations list:** `AppContext` fetches once and the screens read from that, so a page
left open shows a score computed when it loaded. That is deliberate (agreement between
surfaces was the point) but the value is a *live* score, so nothing should cache it
longer without saying so.

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
15. **`serialize.donation_out()` computes `distanceKm` against the *matched* recipient,
    so it is null for every donation an NGO is still deciding on** — the lists show
    "– km", and mobile's *Nearest* sort is therefore a no-op on the available list. The
    figure now exists per-viewer inside `viewerMatch.distanceKm`; wiring it up was left
    out of the match-score fix as unrelated to the score.
16. **A donation's `MATCHED` activity line reads the current `match_score`**
    (`adapters.activityMessage`), which acceptance overwrites — so "Matched X at 94%"
    silently becomes "at 79%" afterwards. Recording the score on the event would fix it;
    the column cannot.
17. **`/ngo/available/:id` renders `NGOAvailableDonations`, which never reads the
    param** — a deep link from the dashboard row opens the list with nothing selected.
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
- A retired requirement has no reader: `GET /api/requirements` is active-only, so
  reopening one is possible through the API but not through the UI (`TASKS.md` → *Backlog
  → F*).
- `PATCH /recipients/me` and `PATCH /volunteers/me` assign an explicit `null` straight to
  a non-nullable column, so `{"name": null}` is a 500 rather than a 422. The requirement
  PATCH skips nulls; the two older routes were left alone as out of scope.

## Immediate priorities

1. Decide what follows the hardening sequence — *Next* is empty and nothing has been
   promoted into it
2. Decide whether the rate-limit counter has to be shared, when deployment is
   designed — it is per-process today (`TASKS.md` → *Backlog → E*)
3. Extend the claim's concurrency guard to the remaining lifecycle transitions before
   Postgres lands, for the same reason the claim itself was fixed first

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
