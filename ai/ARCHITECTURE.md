# ARCHITECTURE — FoodLink / FoodBridge-AI

> Structural map for AI context. Rationale lives in `DECISIONS.md`; current gaps in
> `PROJECT_STATE.md`. Verified against the repository on 2026-09-02, through the
> match-score consistency commit (`23c27f4`), and re-checked in the QA audit of the same
> date — which changed no source and is recorded in `TASKS.md`.

## Shape

```
React 18 SPA (Vite)                    FastAPI (uvicorn, ASGI)
  AuthProvider  (identity)               CORSMiddleware
  AppProvider   (domain state)           5 routers
  BrowserRouter → ProtectedRoute         Depends(): get_db, get_current_user,
       ↓                                           require_roles
  lib/api.ts  ── the ONLY fetch ──HTTP──►  matching.py · serialize.py · security.py
       Bearer token, ApiError,                     ↓
       global 401 handler               SQLAlchemy 2.0 ORM (no raw SQL)
                                                   ↓
  dev:  Vite proxies /api → :8000       SQLite ./foodlink.db
        (same origin, no CORS)          └─ Postgres via DATABASE_URL, no code change
  prod: cross-origin, CORS applies
```

**External services: none.** No email, SMS, push, payments, maps, object storage, or
any third-party API. The backend makes zero outbound HTTP requests.

## Stack

**Backend** — FastAPI ≥0.115 · SQLAlchemy 2.0 (typed `Mapped[...]`) · Alembic ≥1.13 ·
Pydantic 2.9 · PyJWT · bcrypt · uvicorn · python-multipart (login is OAuth2
form-encoded). Tests: pytest ≥8.3 + httpx.
**Frontend** — React 18.3 · TypeScript 5.5 · Vite 5.4 · React Router 6.26 ·
Tailwind 3.4 · lucide-react. No Redux, no Axios, no form library, no test framework.
**Python** — needs 3.10+ in practice (`X | None` syntax) despite `pyproject.toml`.

## Backend layout — `code/foodlink/`

| Module | Responsibility |
|---|---|
| `main.py` | App, CORS, mounts 5 routers, `/api/health`. Lifespan applies migrations and warns if the dev signing key is in use. |
| `config.py` | `Settings` from env, `@lru_cache`. All deployment variance lives here. **Fail-closed on the signing key** — raises `ConfigurationError` rather than defaulting. |
| `database.py` | Engine, `SessionLocal`, `Base`, `get_db` generator dependency. |
| `migrate.py` | `ensure_schema_current()` — in-process `alembic upgrade head`. The only schema-creation path outside the tests. |
| `models.py` | 6 tables + `UserRole` + `DonationStatus` + **`ALLOWED_TRANSITIONS`** + `SELF_SIGNUP_ROLES` + `UtcDateTime`. The most important file. |
| `schemas.py` | All request/response shapes. `alias_generator=to_camel`. Field constraints. |
| `security.py` | 73 lines: bcrypt, JWT mint/verify, `get_current_user`, `require_roles`. |
| `ratelimit.py` | `RateLimiter` (sliding window, per key, in this process) + the two route dependencies guarding login and registration. No new dependency; see D-27. |
| `matching.py` | Haversine + 5 scoring functions + `WEIGHTS` + `rank_recipients`. **Pure — no DB access**, so unit-testable. |
| `serialize.py` | `donation_out()` — ORM row + relations → wire shape; computes `distanceKm` live. |
| `routers/` | `auth` · `admin` · `donations` · `organisations` · `metrics` |
| `cli.py` | `create-admin`, `promote`, `reset-password`, `list-admins`. Bootstrap path. |
| `seed.py` | Demo data with deadlines relative to run time. |

**Layering is 3-tier, not 4:** router (HTTP + validation + business logic + ORM
calls) over shared domain modules. There is **no service layer and no repository
layer** — deliberate, see D-07.

## Frontend layout — `frontend/src/`

| Path | Responsibility |
|---|---|
| `lib/api.ts` | Only `fetch` in the app. Token attach, `ApiError`/`NetworkError`, global 401, wire types mirroring Pydantic. |
| `lib/adapters.ts` | Wire types → app domain types. The seam preventing backend shapes leaking into components. |
| `lib/hooks.ts` | `useAction` (keyed in-flight state + toasts), `useMatchAnalysis`. |
| `lib/geo.ts` | Coordinate capture (`navigator.geolocation`, the only two callers being donation creation) **and** `displayDistanceKm` — the one selector choosing between `distanceKm` and `viewerMatch.distanceKm`. No distance is computed in the browser and none is invented; see D-33. |
| `lib/impact.ts` | Per-account impact figures (`donorImpact`/`ngoImpact`/`volunteerImpact`) from the donation list plus the account's own server counters. Desktop and `/m/*` both read it, so one account gets one answer. `GET /api/metrics` is platform-wide and is **not** a source here — see D-32. |
| `context/AuthContext.tsx` | Identity: boot token→user exchange, sign in/up/out, 401 handling with a `useRef` re-entrancy guard. |
| `context/AppContext.tsx` | Domain state + mutations + toasts. **Write-then-refetch**, not optimistic. |
| `components/ProtectedRoute.tsx` | Route guard. **UX affordance, not a security control.** |
| `pages/` (29 files) | Desktop portals: `donor/`, `ngo/`, `volunteer/`, `admin/`. |
| `mobile/` (26 files) | Phone layouts at `/m/*` with an inner `MobileRole` guard. |
| `types/index.ts` | App-side domain types (`DonationStatus` union, etc.). |

## Database — 6 tables

```
users ──1:1?── recipients ──1:N── requirements
  │              │
  │  1:1?        │ 1:N
  ├── volunteers │
  │      │ 1:N   │
  └─1:N─ donations ──1:N── status_events   (append-only, server-stamped)
     (as donor)   ▲              ▲
                  └─ recipient_id (null until ACCEPTED)
                  └─ volunteer_id (null until VOLUNTEER_ASSIGNED)
```

- `users` — **single-table inheritance**: all 4 roles, one `role` column. Auth is one
  indexed query regardless of role.
- `recipients` / `volunteers` — optional 1:1 satellites created as a side effect of
  registration. Without them an NGO account could authenticate but not accept.
- `donations` — central entity. Stores coordinates (not distance) and an **absolute**
  `pickup_deadline`. `match_score` is frozen at acceptance.
- `status_events` — **the key structure.** Append-only, `occurred_at` stamped by the
  server, never from a client. Every metric derives from it.
- `requirements` — standing needs, so demand is visible before supply. `is_active` is
  the whole lifecycle: retiring one (met, or no longer needed) clears the flag and keeps
  the row; the list filters on it. No fulfilled/withdrawn distinction is stored (D-29).

**No many-to-many relationships.** Indexes cover the real access patterns: status,
deadline, owner FKs, `status_events.donation_id`.

**Schema evolution — Alembic** (`code/alembic.ini`, `code/migrations/`, D-23).
One revision so far: `ae4636b1e6d4 initial schema`, the six tables as they already
were. `env.py` takes the URL from `Settings`, not from the ini, so migrations and the
app cannot address different databases; it also needs the D-22 signing key, like every
other entry point. `main.py`, `cli.py` and `seed.py` all call
`migrate.ensure_schema_current()`, so a fresh database is built from the revision
history on first start. A database predating migrations is **reported, not rewritten** —
it is baselined once with `alembic stamp head` (both local dev databases already have
been). `code/migrations/README.md` carries the commands. The test suite is the one
exception: it still calls `create_all` on throwaway in-memory databases.

**`UtcDateTime`** (`models.py`) is a `TypeDecorator` normalising every datetime to
timezone-aware UTC in both directions. It exists because SQLite has no timezone type
and would otherwise return naive wall-clock times that a browser reads as local —
silently shifting every deadline. Postgres passes through unchanged.

## Domain model: the lifecycle

9 states: `AVAILABLE → MATCHED → ACCEPTED → VOLUNTEER_ASSIGNED → PICKED_UP →
DELIVERED → COMPLETED`, plus `CANCELLED` / `EXPIRED`.
Terminal states have an empty transition set.

Rules are **data, not conditionals**, in three dicts/sets:
- `models.ALLOWED_TRANSITIONS` — legal state graph. Violation → **409**.
- `donations.TRANSITION_ROLES` — which role may cause each target. Violation → **403**.
- `donations.OWNED_TRANSITIONS` — the targets that additionally require the caller to be
  *this* donation's party, not merely to hold the role. Violation → **404** (D-34).

| Target | Roles |
|---|---|
| `MATCHED` / `EXPIRED` | admin |
| `ACCEPTED` / `COMPLETED` | ngo, admin |
| `VOLUNTEER_ASSIGNED` / `PICKED_UP` / `DELIVERED` | volunteer, admin |
| `CANCELLED` | donor, admin |

`PICKED_UP`, `DELIVERED`, `COMPLETED` and `CANCELLED` are `OWNED_TRANSITIONS`: the
volunteer must be the courier assigned to that donation, the NGO the organisation that
accepted it, and the donor the one who posted it. Ownership is **not** a role exemption —
the role table gates the kind of actor, the scope gates which donation.

⚠️ **`MATCHED` assigns nobody** — `recipient_id` stays null. It records a suggestion.
Only `ACCEPTED` binds a recipient.
⚠️ `COMPLETED` is the **NGO's** action, not the courier's — the party receiving
confirms, not the party delivering.
⚠️ **The courier claim is the one transition that is not a read-then-write.** Binding a
courier goes through `donations._claim_pickup()`, a conditional
`UPDATE … WHERE status = :from AND (volunteer_id IS NULL OR volunteer_id = :courier)`;
a `rowcount` of 0 means the claim was lost and becomes the 409. Every other transition
still compares in Python and then writes — safe under SQLite's serialised writes, not
under PostgreSQL. See `DECISIONS.md` D-28.

## Auth & authorization

```
register → bcrypt(gensalt) → users row (+ satellite row for ngo/volunteer)
login    → bcrypt.checkpw → is_active check → JWT HS256 {sub, role, exp:+720min}
storage  → localStorage['foodlink.token']   (token only; user re-fetched on boot)
request  → Authorization: Bearer
verify   → jwt.decode(algorithms=["HS256"]) → db.get(User, sub) → is_active
```

**Central design point:** the token carries `role`, but `get_current_user` **ignores
it** and re-reads the user row every request. Costs one indexed PK lookup; buys
immediate mid-session suspension and immediate role changes.

**Four authorization layers:** role (`require_roles`) → ownership (query scoping /
explicit comparison) → lifecycle legality → trust (`is_verified`).

**Donation reads are scoped server-side** by `routers/donations._readable_by()`, which
returns the caller's read scope as a SQLAlchemy WHERE clause (`None` for admin). The
list, the lookup by id and `/matches` all apply the same clause, so an id the caller
may not read returns the ordinary 404 rather than a 403 that would confirm it exists.
Scope: donor → their own; ngo → `AVAILABLE`/`MATCHED` plus their own organisation's;
volunteer → unclaimed `ACCEPTED` plus their own assignments; admin → everything.
See `DECISIONS.md` D-24.

**Lifecycle writes on a donation that is already somebody's are scoped by the same
clause.** `POST /api/donations/{id}/status` re-resolves the donation through
`_get_readable_or_404` when the target is in `OWNED_TRANSITIONS`, after the transition and
role gates. For those targets the read scope *is* the ownership rule — a donor reads their
own donations, and a donation past `ACCEPTED` has left the open pool — so there is one
encoding of it rather than two. Admin scope is unrestricted, so the stand-in path is
untouched. See `DECISIONS.md` D-34.

**A requirement may only be changed by the organisation that posted it.**
`routers/organisations._own_requirement_or_404()` matches on the caller's own
`recipient_id` in the query, so `PATCH /api/requirements/{id}` answers 404 — not 403 —
for anyone else's requirement. Holding the `ngo` role passes the route's `require_roles`
gate and nothing more. See `DECISIONS.md` D-29.

**Recipient reads are scoped the same way** by
`routers/organisations._visible_recipients()`: admin → every organisation; ngo → its own
row only; donor and volunteer → none. `RecipientOut` carries a contact person and a
phone, so the list is a directory of people. Denial here is an empty list rather than a
403 — unlike `GET /volunteers`, which role-gates. See `DECISIONS.md` D-26.

⚠️ **`GET /api/requirements` is the one unscoped cross-organisation read left.** It takes
`Depends(get_current_user)` with no role gate and no ownership clause, so every
authenticated caller receives every organisation's active requirements including
`recipientName` — and `AppContext.load()` fetches it for every role, so a donor's client
already holds them. This is **consistent with D-26**, which scoped `RecipientOut` because
it carries `contact_person` and `phone` and explicitly recorded that organisation *names*
are already public here; `RequirementOut` carries no contact details. It is nonetheless
unscoped by omission rather than by a recorded decision — see `TASKS.md` → *Blocked*.

**Admin is two-tier:** `SELF_SIGNUP_ROLES` excludes `admin` and a Pydantic validator
enforces it, so the restriction appears in the OpenAPI contract. The first admin can
only come from `python -m foodlink.cli create-admin`; subsequent ones from
`POST /api/admin/users`. The admin router is gated **once** at the router level, so a
new admin endpoint cannot be added unprotected.

**Login and registration are rate limited** — the only two routes an anonymous caller
can drive. `routers/auth` attaches `ratelimit.login_rate_limit` / `register_rate_limit`
as route dependencies, so a request over the ceiling is refused before the handler runs.
Default policy: 30 logins per 5 minutes and 10 registrations per hour, **per client
address** (`request.client.host`; `X-Forwarded-For` is deliberately not trusted), all
four values settable from the environment. Over the limit: `429` + `Retry-After`, with a
message naming the network rather than the account so it says nothing about which
addresses have accounts. **The counter is a dict in the worker process**, so it is exact
only while the deployment is one process — see constraint 3 and `DECISIONS.md` D-27.

**Not present:** refresh tokens, token revocation/blocklist, MFA, email verification,
any limiting of authenticated endpoints. Logout is client-side only.

## API surface

Prefix `/api`. All bodies camelCase. Interactive docs at `/docs` and `/redoc`.

| Group | Endpoints |
|---|---|
| auth | `POST /auth/register` · `POST /auth/login` **(form-encoded)** · `GET|PATCH /auth/me` · `POST /auth/password` |
| donations | `POST /donations` (auto-ranks on create) · `GET /donations?mine=&status=&limit=` **(role-scoped; `mine` narrows further)** · `GET /donations/{id}` · `GET /donations/{id}/matches` · **`POST /donations/{id}/status`**. All four `DonationOut` responses carry `viewerMatch`, the caller's own ranking (D-30) |
| organisations | `GET /recipients` **(role/ownership-scoped)** · `GET|PATCH /recipients/me` · `GET|POST /requirements` · **`PATCH /requirements/{id}`** (owner only) · `GET /volunteers` (admin+ngo only) · `GET|PATCH /volunteers/me` |
| metrics | `GET /metrics` |
| admin | `GET|POST /admin/users` · `PATCH /admin/users/{id}` · `POST|DELETE /admin/recipients/{id}/verify` · `POST /admin/maintenance/expire` |
| meta | `GET /health` (does **not** touch the DB) |

`POST /donations/{id}/status` is the system's core endpoint — every lifecycle rule
converges there.

## Matching engine

Weighted sum over 5 normalised 0–100 criteria; `WEIGHTS` sum to exactly 1.0:
`distance .25 · quantity-fit .25 · capacity .20 · deadline .15 · reliability .15`.

⚠️ **Distance is great-circle, never road distance.** `matching.haversine_km` on two
coordinate pairs is the only distance function in the repository; there is no routing
provider, no geocoder and no map, here or anywhere else (see *External services: none*).
Travel time, which `_deadline_score` needs, is derived from it by a flat constant —
`travel_minutes = (distance / 20) * 60`, i.e. 20 km/h assumed city traffic
(`matching.py:132`). Both are deliberate and both are approximations. **Neither is
serialised to a client**: `DonationOut.distanceKm` and `MatchOut.distanceKm` carry the
great-circle kilometres, and travel time never leaves the module. Since I-2 the interface
says so — every distance is labelled straight-line, no travel estimate is displayed
anywhere, and `frontend/src/lib/geo.ts` is the single selector deciding which of the two
server distances a screen shows (D-33). *Blocked* covers whether to replace the model.

⚠️ **Requirements are not an input.** `matching.py` neither imports nor references
`Requirement`, and neither does `routers/donations.py`. The `requirements` table is a
notice board read only by `routers/organisations.py` and `seed.py` — demand is *visible*
before supply, but it does not influence any ranking. `Requirement.daily_recurring` is
likewise stored and displayed but never acted on: nothing re-posts a requirement and
there is no scheduler that could (constraint 7).

Three **hard gates** return `None` rather than a low score: unverified organisation,
missing coordinates, beyond `MAX_MATCH_RADIUS_KM` (default 8).
`reliability_score` is a computed property: `85` if fewer than 3 accepted donations
(cold-start prior), else `100 × completed/accepted`.
Returns per-criterion sub-scores plus human-readable `reasons` — the score is never a
bare number.

**Swap point:** replacing `score_pair` alone would substitute a learned ranker; the
router and response shape do not change.

⚠️ **Two scores reach the client, and they answer different questions** (D-30):

| Field | What it is | Where it is shown |
|---|---|---|
| `DonationOut.matchScore` | The stored `Donation.match_score`. Frozen: the top match at posting, re-frozen as the accepting organisation's own score at acceptance. The same number for every reader. | Donor screens, admin screens, and the NGO's *accepted* screen — labelled "at acceptance" |
| `DonationOut.viewerMatch` | The **calling** organisation's own ranking, computed per request by `routers/donations._viewer_match()` through the same `score_pair`. A full `MatchOut`, not just a total. Null unless the caller is an `ngo` with a profile **and** the donation is still in `OPEN_TO_RECIPIENTS`. | Every NGO surface that says "match": desktop and mobile available lists, the dashboard row, and the analysis panel |

Confusing the two is what let one donation read 94% on an NGO's list and 64% in the
panel beside it. The whole `MatchOut` travels rather than the total alone because every
criterion moves with the clock, so two independent live calls round apart: the list and
the panel now read **one object from one request**. The NGO screens therefore no longer
call `GET /donations/{id}/matches` — `lib/hooks.useMatchAnalysis` is donor-side only and
reports the leading match. `seed.py` ranks through `rank_recipients` like the API rather
than writing a literal score.

## Data flow

**Reads** — `GET` → router → `_loaded()` query with `selectinload(donor, recipient,
volunteer→user, events)` → `donation_out()` → camelCase JSON → `adapters.ts` → app
types → Context → components.
The eager loading is the N+1 fix: 100 donations = 5 queries, not 401.
`selectinload` (not `joinedload`) because a join on one-to-many `events` multiplies rows.

**Writes** — component → `useAction.run(key, …)` → `AppContext` mutation → `api.ts` →
`POST` → router validates (schema → business → lifecycle → role) → side effects →
append `StatusEvent` → **single `commit()`** → response → **client re-reads the
affected slice from the server** (write-then-refetch) → re-render + toast.

**Metrics** — every transition appends to `status_events`; `GET /api/metrics` derives
time-to-claim (created→ACCEPTED), handover (ACCEPTED→DELIVERED), rescue rate
(COMPLETED ≤ deadline) and expiry-loss rate. Returns `null`, not `0`, when history is
insufficient.

⚠️ **The Impact screens do not use it.** `useStats()` — the hook carrying those
ledger-derived figures — is read by the **four admin screens only**. Every per-role
*Impact* page (`pages/{donor,ngo,volunteer}/*Impact.tsx` and their mobile counterparts)
computes in the browser from `useDonations()`, and the desktop three then mix those
derived values with display literals and additive constants. So the platform has two
unrelated reporting paths: an evidence-backed one nobody outside admin sees, and a
client-side one that is what donors, kitchens and couriers actually read. That split is
the substance of `TASKS.md` → I-1, and whether to close it by serving impact from the
ledger is in *Blocked*.

## Configuration

| Env var | Default | Note |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./foodlink.db` | ⚠️ **relative path** — differs by cwd |
| `FOODLINK_SECRET_KEY` | **none — required** | Missing → `ConfigurationError` at import. Must be ≥32 chars; the retired public key is refused. |
| `FOODLINK_DEV_INSECURE_SECRET` | unset | Dev-only opt-in (`1/true/yes/on`) enabling a known development signing key. Warns loudly at startup. |
| `ACCESS_TOKEN_MINUTES` | `720` (12 h) | |
| `LOGIN_RATE_LIMIT` | `30` | per client address, per window |
| `LOGIN_RATE_WINDOW_SECONDS` | `300` (5 min) | |
| `REGISTER_RATE_LIMIT` | `10` | per client address, per window |
| `REGISTER_RATE_WINDOW_SECONDS` | `3600` (1 h) | |
| `CORS_ORIGINS` | the two localhost dev origins | comma-separated allowlist, not `*` |
| `MAX_MATCH_RADIUS_KM` | `8` | |
| `FOODLINK_ADMIN_PASSWORD` | unset | scripted CLI bootstrap only |

Frontend build-time: `VITE_API_URL` (empty = same origin), `VITE_API_PROXY` (dev
proxy target). `VITE_*` values are **inlined at build time** — never secrets.

## Architectural constraints

1. **SQLite has one writer.** Blocks multi-worker uvicorn. Postgres is prerequisite
   for horizontal scaling; the code already supports it via `DATABASE_URL`.
2. **Migrations run in the app's own startup.** Safe only while constraint 1 holds a
   deployment to one process; multiple workers against Postgres would race. At that
   point `ensure_schema_current()` leaves the lifespan and becomes a deploy step.
3. **The API holds no session state** (JWT, no server session store), so it *would*
   scale horizontally once the database does. The one piece of in-process state is the
   rate-limit counter (`ratelimit.py`), and it is deliberately not authoritative:
   restarting loses it and a second worker would not share it, which weakens the limit
   by a factor of `n` but breaks nothing. Correctness never depends on it.
4. **Invariants live in application code**, not the schema. The state machine,
   coordinate ranges, and counter consistency are unenforced at the DB level;
   anything writing outside the ORM can violate them. The single exception is the
   courier claim, whose condition is carried in the UPDATE itself (D-28) — and it is
   an exception because it had to survive concurrent transactions, not because the
   schema gained a constraint. It did not.
5. **Frontend route guards are not security.** The server re-checks every request.
6. **The mobile UI is a separate URL space** (`/m/*`), not a viewport branch.
7. **No background execution of any kind** — no scheduler, queue, worker, or
   WebSocket. Anything periodic (the expiry sweep) needs an external caller.

## Testing architecture

37 integration tests through FastAPI's `TestClient`, **no mocks**, full stack against
in-memory SQLite. `conftest.py` uses `StaticPool` — required because in-memory SQLite
exists per connection, so the default pool would give test and request different
databases. `app.dependency_overrides[get_db]` swaps the session in without
application code knowing.
Plus 22 config unit tests, 22 rate-limit tests and 8 migration tests
(`test_migrations.py`, temp file databases, never `DATABASE_URL`) — 162 in total. `test_donation_reads.py` (13) and
`test_recipient_reads.py` (11) hold the read-scope tests: for every role, what the list
withholds the id lookup withholds too, and no caller reads another organisation's
contact details.
`test_courier_claim.py` (9) covers the claim, including as a concurrency boundary. Its
last three tests **cannot use the shared-session fixture** — one Session over one
StaticPool connection means two requests share a transaction, so a competing claim
cannot commit independently. They build a file-backed SQLite database instead, giving
two real connections, and interleave by hand rather than with threads or sleeps: a
competitor commits at the exact point the handler has finished reading. Two of them
fail against the pre-fix code with a `200` where a `409` belongs.
`test_lifecycle_authorization.py` (14) covers the write side of the same boundary: for
each of `PICKED_UP`, `DELIVERED`, `COMPLETED` and `CANCELLED`, an actor with the right
role but the wrong donation gets a 404 **and the stored status does not move**, the real
party still succeeds, and an administrator still drives a donation they are not party to.
Four of them fail against the pre-fix code with a `200` where a `404` belongs. It also
pins the two answers that must *not* change: a role that may not cancel still gets 403
(the role gate runs first), and a cancel from a terminal state still gets 409 (so does the
owner's).
`test_requirement_lifecycle.py` (15) covers the requirement lifecycle as an ownership
boundary: who may revise, retire and reopen a requirement, that another organisation's id
is a 404, and that a retired one leaves `GET /api/requirements` without being deleted.
`test_match_score_consistency.py` (11) pins the frozen/live distinction: two kitchens at
different distances read one donation, and what the list gives each of them has to equal
what `/matches` gives the same organisation. It also asserts the frozen number is *not*
the reader's own — the property that made the UI bug possible — that the breakdown
reconciles to its headline by the published weights, and, as a unit test on `score_pair`
with an injected `now`, that a stored score cannot track the deadline it scored.
`test_rate_limit.py` (22) drives the limiter with an injected clock rather than sleeping,
and builds `TestClient`s with chosen peer addresses to prove two callers do not share a
budget; `conftest.py` clears the counters before every test, because they live in the
process rather than the per-test database.
Zero frontend tests; `tsc` in `npm run build` is the only frontend gate.

## Continuous integration — `.github/workflows/ci.yml`

Two independent jobs on push to `master`/`main` and on every pull request.
**backend** (Python 3.13): `pip install -r code/requirements-dev.txt` → `pytest code/tests`
→ `alembic -c code/alembic.ini upgrade head` + `alembic ... check` against a throwaway
SQLite file, which fails the build when the models have drifted from the revision history.
**frontend** (Node 20): `npm ci` → `npm run build`, i.e. `tsc` is the type gate.

The test step exports no signing key — `conftest.py` sets its own (D-22), and leaving CI
silent about it keeps that self-containment tested. Only the Alembic step needs one, because
`migrations/env.py` resolves `DATABASE_URL` through the fail-closed `Settings`; it gets a
literal non-secret placeholder. `.github/workflows/mkdocs.yml` remains separate and deploys
documentation only. Nothing here deploys the application — there is no deployment
configuration in the repository at all.
