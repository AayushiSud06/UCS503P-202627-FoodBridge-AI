# ARCHITECTURE — FoodLink / FoodBridge-AI

> Structural map for AI context. Rationale lives in `DECISIONS.md`; open work in `TASKS.md`.
> **Verified against `master` at `640af0c` on 2026-09-10** by the health audit of that
> date; updated for Tasks 37–39 (`c65c65f`, `be831b8`, `3d6f8f8`; D-53–D-55) and the
> uncommitted Task 40 (D-56). ⚠️ marks a known weakness with its `TASKS.md` id.

## Shape

```
React 18 SPA (Vite)                    FastAPI (uvicorn, ASGI)
  AuthProvider  (identity)               CORSMiddleware (allowlist)
  AppProvider   (domain state)           5 routers: auth · admin · donations ·
  BrowserRouter → ProtectedRoute                    organisations · metrics
       ↓                                 Depends(): get_db, get_current_user, require_roles
  lib/api.ts  ── the ONLY fetch ──HTTP──►  matching.py · serialize.py · security.py
       Bearer token, ApiError,                     ↓
       global 401 handler               SQLAlchemy 2.0 ORM (no raw SQL)
                                                   ↓
  dev:  Vite proxies /api → :8000       SQLite ./foodlink.db (cwd-relative)
  prod: cross-origin, CORS applies      Postgres via DATABASE_URL — untested, no driver pinned
```

**External services: none.** No email, SMS, push, payments, maps, object storage or
third-party API; the backend makes zero outbound HTTP requests. **No background execution**:
no scheduler, queue, worker or WebSocket.

## Stack

**Backend** — Python 3.13 (needs ≥3.10), FastAPI ≥0.115, SQLAlchemy 2.0 typed `Mapped`,
Alembic, Pydantic 2, PyJWT, bcrypt, uvicorn. Tests: pytest + httpx `TestClient`.
**Frontend** — React 18.3, TypeScript 5.5, Vite 5.4, React Router 6, Tailwind 3.4,
lucide-react. Tests: Vitest 3.2 + Testing Library (pinned for Vite 5, D-43). No Redux, no
Axios, no form library, no eslint.

## Backend — `code/foodlink/` (~4,150 lines)

| Module | Responsibility |
|---|---|
| `main.py` | App, CORS, routers, `/api/health` (no DB touch). Lifespan runs `ensure_schema_current()` and warns on the dev key. |
| `config.py` | `Settings` from env (`lru_cache`). Fail-closed signing key (D-22). |
| `database.py` | Engine, `SessionLocal`, `Base`, `get_db`. No isolation level set; no `PRAGMA foreign_keys`. |
| `migrate.py` | In-process `alembic upgrade head`; a pre-Alembic DB is reported, never rewritten (D-23). |
| `models.py` | 6 tables, `UserRole`, `DonationStatus`, `ALLOWED_TRANSITIONS`, `SELF_SIGNUP_ROLES`, `UtcDateTime` (D-09). |
| `schemas.py` | All wire shapes, camelCase aliases. `imageUrl` ≤ 256 KiB and must be an image data URL or an http(s) link (`IMAGE_URL_PATTERN`, D-56); ⚠️ most other strings unbounded (P2-2). |
| `security.py` | bcrypt, JWT HS256 mint/verify, `get_current_user` (re-reads the user row, D-03), `require_roles`. |
| `ratelimit.py` | Per-IP sliding window, process-local, on login and register only (D-27). |
| `matching.py` | Pure (no DB): haversine, 5 criteria, `WEIGHTS`, blur, requirement fit, `rank_recipients`. |
| `serialize.py` | `donation_out()` — ORM → `DonationOut`, applying the reader's `precise_for` scope (D-47). |
| `routers/donations.py` | Read scopes, lifecycle endpoint, ranking calls. The core of the system (~820 lines). |
| `routers/organisations.py` | Recipients, requirements, couriers and their scopes. |
| `routers/admin.py` | Router-level admin gate; users, verification, expiry sweep. |
| `routers/metrics.py` | Ledger-derived platform metrics, computed in Python over all rows. |
| `cli.py`, `seed.py` | Admin bootstrap; demo data (seed accounts documented in `docs/authentication.md`). |

**Layering is router → shared pure modules → ORM.** No service or repository layer (D-07);
`update_status` mixes HTTP and domain rules and is the natural extraction point once a
transition must come from anything but a request.

## Frontend — `frontend/src/`

| Path | Responsibility |
|---|---|
| `lib/api.ts` | The only `fetch`. Token attach, `ApiError`/`NetworkError`, global 401, hand-mirrored wire types. ⚠️ a bodiless 5xx becomes `NetworkError` ("cannot reach server", P2-3). |
| `lib/adapters.ts` | Wire → domain types; activity feed text. |
| `lib/hooks.ts` | `useAction` (keyed in-flight state + toasts); `useMatchAnalysis` (leading match via `/matches`, used only by the mobile camera flow). |
| `lib/geo.ts`, `lib/time.ts`, `lib/impact.ts` | Distance selection (D-33), deadline/urgency, per-account impact (D-32). |
| `lib/image.ts` | The donation photo pipeline: decode (which is the validation), clamp the long edge to 1280 px without upscaling, re-encode as JPEG down a quality ladder until it fits the server cap (D-56). Its decode/encode pair is injectable, because jsdom has no canvas. Both create-donation screens call it. |
| `context/AuthContext.tsx` | Token in `localStorage['foodlink.token']`; user re-fetched on boot. |
| `context/AppContext.tsx` | Loads everything once per sign-in (`listDonations(limit=500)` + role-gated slices) and **re-loads after every write** (D-11). Selectors: `useAvailableDonations` (D-50), `useRequirements` (active) / `useAllRequirements`. |
| `components/ProtectedRoute.tsx` | Route guard — UX, not security (D-14). |
| `pages/` (30 files) | Desktop portals `donor/`, `ngo/`, `volunteer/`, `admin/`, plus `Landing`, `Login`. |
| `mobile/` (26 files) | `/m/*` phone layouts with an inner role guard. ⚠️ only reachable by URL; header kicker hard-codes seeded org names (P2-4). |

**Unused API surface:** the client never calls `GET /donations/{id}`, `GET /recipients/me`
or any `/admin/users` route — there is no admin UI for suspending or re-roling accounts.

## Database — 6 tables, one Alembic revision (`ae4636b1e6d4`)

```
users ──1:1?── recipients ──1:N── requirements
  │              │ 1:N
  ├─1:1?─ volunteers ─1:N─┐
  └─1:N── donations ◄─────┘──1:N── status_events  (append-only, server-stamped)
          recipient_id: null until ACCEPTED · volunteer_id: null until claimed
```

- `users` — single table for all roles. `recipients`/`volunteers` are satellites created at
  registration (an admin-created NGO starts **verified** with no coordinates, and loses the
  verification when it first pins itself, D-54).
- `donations` — coordinates and an absolute `pickup_deadline`; `match_score` frozen (D-30).
- `status_events` — every metric derives from it (D-01).
- `requirements` — standing needs; `is_active` is the whole lifecycle (D-29).
- Counters `Recipient.accepted_donations`/`completed_donations` and
  `Volunteer.completed_deliveries` are maintained by `update_status`, not derived.
  ⚠️ donor cancellations are counted against the kitchen (P1-4).
- Invariants (state machine, coordinate ranges, counters) live in application code only.
  SQLite FKs are unenforced.

## Donation lifecycle

`AVAILABLE → MATCHED → ACCEPTED → VOLUNTEER_ASSIGNED → PICKED_UP → DELIVERED → COMPLETED`,
plus `CANCELLED` / `EXPIRED`. Rules are data:

- `models.ALLOWED_TRANSITIONS` — the graph; violation → **409**.
- `donations.TRANSITION_ROLES` — role per target; violation → **403**.
- `donations.OWNED_TRANSITIONS` (`PICKED_UP`, `DELIVERED`, `COMPLETED`, `CANCELLED`) plus
  `ACCEPTED` from outside the open pool (the *release*) — the caller must be this donation's
  party, checked by re-reading through the read scope; violation → **404** (D-34, D-35).

| Target | Roles | Notes |
|---|---|---|
| `MATCHED` / `EXPIRED` | admin | `MATCHED` is set at creation if any kitchen ranks |
| `ACCEPTED` | ngo, admin | verified org only; overdue from the open pool → 409 (D-50); from `VOLUNTEER_ASSIGNED` it is the release: clears the courier, skips counters (D-41) |
| `VOLUNTEER_ASSIGNED` | volunteer (admin listed, always 422) | atomic conditional `UPDATE` (D-28) |
| `PICKED_UP` / `DELIVERED` | volunteer, admin | owned |
| `COMPLETED` | ngo, admin | owned; increments kitchen and courier counters |
| `CANCELLED` | donor, admin | owned; legal up to `PICKED_UP` |

**Every status write is a conditional write.** `_record` advances the status with
`UPDATE ... WHERE id = :id AND status = :from` and refuses with 409 on `rowcount != 1`, so a
transition happens once and the loser of a race keeps none of its side effects (D-55); the
claim additionally binds the courier the same way (D-28). ⚠️ The expiry sweep
(`POST /admin/maintenance/expire`) is manual, touches only `AVAILABLE`/`MATCHED`, and writes
`EXPIRED` **outside** that guard (`TASKS.md` P3).

## Authorization

JWT HS256, 720 min, `sub` + `role`; the role claim is ignored and the user row re-read on
every request, so suspension is immediate (D-03). No refresh, revocation, MFA or email
verification. Admin is not self-signup (D-04); the admin router is gated once.

**Four layers:** role (`require_roles`) → ownership (a WHERE clause) → lifecycle legality →
trust (`Recipient.is_verified`, admin-set, read by ranking, acceptance and the `ngo` open-pool
read scope, D-37, D-53).
A real change to the organisation's `name`, `latitude` or `longitude` through
`PATCH /recipients/me` clears it in the same commit (`organisations.VERIFIED_IDENTITY_FIELDS`,
D-54); an administrator re-verifies through the existing endpoint.

**Read scopes** — each is a helper returning a WHERE clause (`None` = unrestricted):

| Data | admin | donor | ngo | volunteer | Helper |
|---|---|---|---|---|---|
| Donations (list, by id, `/matches`) | all | own | own org's, plus the open pool (status **and** deadline, D-50) **only if the org is verified** (D-53); no org row → none | unclaimed `ACCEPTED` + own runs | `donations._readable_by` (D-24) |
| Recipients (`RecipientOut`, has phone) | all | none | own row | none | `organisations._visible_recipients` (D-26) |
| Couriers (`VolunteerOut`, has phone) | all | 403 | couriers on own donations | 403 | `organisations._visible_volunteers` (D-41) |
| Requirements | all active | active, verified orgs' | own (retired too with `includeInactive`) | none | `_visible_requirements` + `_may_read_inactive` (D-44, D-46) |
| True distances / frozen score | all | none | own org | none | `donations._precise_distance_scope` (D-45, D-47) |
| Requirement inputs to ranking | all | verified orgs | own org | none | `donations._requirement_disclosure_scope` (D-52) |

Denial is a 404 for donations and an empty list for directories. ⚠️ The volunteer donation
scope is still open to any **self-signup** courier and carries exact donor coordinates and
names (P1-1b, DQ-1); the ngo scope has required verification since D-53.

## API — prefix `/api`, camelCase bodies, docs at `/docs`

| Group | Endpoints |
|---|---|
| auth | `POST /auth/register` · `POST /auth/login` (form-encoded) · `GET|PATCH /auth/me` · `POST /auth/password` |
| donations | `POST /donations` (ranks on create; ⚠️ not rate-limited, P2-1) · `GET /donations?status=&mine=&limit≤500` · `GET /donations/{id}` · `GET /donations/{id}/matches?limit≤25` · `POST /donations/{id}/status` |
| organisations | `GET /recipients` · `GET|PATCH /recipients/me` · `GET /requirements?includeInactive=` · `POST /requirements` · `PATCH /requirements/{id}` (owner) · `GET /volunteers` · `GET|PATCH /volunteers/me` |
| metrics | `GET /metrics` — platform-wide, any authenticated role |
| admin | `GET|POST /admin/users` · `PATCH /admin/users/{id}` · `POST|DELETE /admin/recipients/{id}/verify` · `POST /admin/maintenance/expire` |

`DonationOut` carries `matchScore` (frozen decision, reader-scoped) and `viewerMatch` (the
calling kitchen's live `MatchOut`, open-pool donations only) — two different questions
(D-30). No error responses are declared in OpenAPI; there is no global exception handler.

## Matching engine — `matching.py`

- **Score:** `distance .25 · quantity-fit .25 · capacity-headroom .20 · deadline .15 ·
  reliability .15`, each 0–100, rounded to an integer `overall_score`, with per-criterion
  figures and `reasons` (D-05, D-06).
- **Gates** (return `None`): unverified, no coordinates, beyond `MAX_MATCH_RADIUS_KM` (8).
  Evaluated on the **true** position before any blur, so the eligible set never depends on
  the reader. ⚠️ that gate is itself a membership oracle (`HA-3a`, P2-1).
- **Distance** is haversine only; travel time is a flat 20 km/h and never leaves the module.
- **Size:** only `unit == "Meals"` is compared with `Recipient.capacity` (meals by
  convention); other units score 50/50 and say so. Headroom is absolute, saturating at 100
  spare meals (D-42).
- **Reliability:** 85 below 3 acceptances, else `100 × completed / accepted`.
- **Privacy:** non-owners are scored against coordinates snapped to a 0.01° grid and get
  `distanceKm = null` (D-45).
- **Requirements (D-52):** the router passes each in-scope kitchen's **active** needs;
  `best_requirement_fit` picks one by a total order (assessable · fit · urgency · oldest ·
  id), comparing quantity only when units are identical. It affects only `_ranking_key`
  (after `overall_score`) and adds one `reasons` line. `food_type`, `beneficiary_count`,
  `daily_recurring`, `notes` are not inputs. Everything is computed per request, so an edited
  requirement shows on the next read; the frozen `match_score` never changes.
- **Freezes:** `match_score` is written at creation (top candidate, unscoped) and at
  acceptance (the accepting org alone, no requirements).
- ⚠️ Every recipient row is loaded and filtered in Python (`R-10`).

## Data flow

**Reads:** `_loaded()` uses `selectinload` for donor, recipient, volunteer→user and events
(no N+1) → `donation_out()` → `adapters.ts` → context → components.
**Writes:** component → `useAction.run` → `AppContext` mutation → `api.ts` → router
(schema → transition → role → ownership → side effects → `StatusEvent`) → single commit →
client reloads **all** slices. Every write therefore re-downloads up to 500 donations with
their inline images, notes and events.
**Metrics:** `/api/metrics` loads every donation with events and computes medians in
Python; only admin screens read it. Per-role impact pages compute from the account's own
donation list (D-32).

## Configuration

| Env var | Default | Note |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./foodlink.db` | cwd-relative — two dev DB files exist |
| `FOODLINK_SECRET_KEY` | required | ≥32 chars; retired public key refused |
| `FOODLINK_DEV_INSECURE_SECRET` | unset | dev opt-in to a known key; warns at startup |
| `ACCESS_TOKEN_MINUTES` | 720 | |
| `LOGIN_RATE_LIMIT` / `_WINDOW_SECONDS` | 30 / 300 | per client IP |
| `REGISTER_RATE_LIMIT` / `_WINDOW_SECONDS` | 10 / 3600 | per client IP |
| `CORS_ORIGINS` | localhost:5173 pair | allowlist |
| `MAX_MATCH_RADIUS_KM` | 8 | |
| `FOODLINK_ADMIN_PASSWORD` | unset | scripted CLI bootstrap |

Frontend build-time: `VITE_API_URL`, `VITE_API_PROXY` (inlined — never secrets).

## Architectural constraints

1. SQLite has one writer; multi-worker uvicorn needs Postgres (untested; no driver in
   `requirements.txt`).
2. Migrations run in the lifespan — safe only while there is one process (D-23).
3. The API is stateless (JWT) except the process-local rate-limit counters (D-27).
4. Invariants live in application code, not in schema constraints — but the lifecycle's
   own writes carry their preconditions: every status transition (D-55) and the courier
   claim (D-28) are conditional UPDATEs, so a lost update is refused rather than applied.
   ⚠️ The expiry sweep is the exception (`TASKS.md` P3).
5. Frontend route guards are not security (D-14).
6. Mobile is a separate URL space `/m/*`, not a viewport branch (D-20).
7. No background execution — the expiry sweep needs an external caller.

## Testing

**Backend — `pytest code/tests`: 353 tests, ~4 min** (almost all bcrypt). `conftest.py`
builds an in-memory SQLite per test with `StaticPool`, overrides `get_db`, and sets its own
signing key; no mocks (D-17). ⚠️ It sets no `DATABASE_URL`, so the app lifespan migrates
`./foodlink.db` in the working directory (a no-op at head).

| Area | Files |
|---|---|
| Happy paths, auth/admin | `test_api.py`, `test_auth_admin.py`, `test_config.py`, `test_rate_limit.py`, `test_migrations.py`, `test_recipient_reverification.py` |
| Read scopes | `test_donation_reads.py`, `test_recipient_reads.py`, `test_volunteer_reads.py`, `test_requirement_reads.py` |
| Lifecycle | `test_lifecycle_authorization.py`, `test_pickup_release.py`, `test_courier_claim.py` and `test_lifecycle_concurrency.py` (both file-backed concurrency), `test_available_donations_deadline.py`, `test_volunteer_delivery_history.py`, `test_requirement_lifecycle.py` |
| Matching & privacy | `test_matching_scores.py` (unit), `test_match_score_consistency.py`, `test_match_distance_privacy.py`, `test_donation_privacy_scope.py`, `test_requirement_matching.py` |

Strong: authorization boundaries per role, matcher arithmetic, privacy scopes, transition
and claim concurrency. Missing: cancellation accounting, the expiry sweep under
concurrency, `UtcDateTime`, input size bounds.

**Frontend — `npm test`: 134 tests over 16 files, ~3 s.** Vitest on the project's own
`vite.config.ts`; node environment by default, jsdom per file where rendering. Covers the
`lib/` arithmetic (adapters, time, geo, impact, api), `ProtectedRoute`, the requirements
slice, and content/absence tests for Landing, Login, DonorNeedsBoard, NGORequirements,
NGOAvailableDonations, VolunteerHistory, AdminDashboard, AdminAnalytics. `src/test/fixtures.ts`
holds typed wire builders. Missing: `AppContext` load/refetch, `useAction`, donation
creation, lifecycle action buttons, any mobile screen.

## CI — `.github/workflows/ci.yml`

On push to `master`/`main` and every PR. **backend** (Python 3.13): `pytest code/tests`, then
`alembic upgrade head` + `alembic check` on a throwaway SQLite file with a placeholder key.
**frontend** (Node 20): `npm ci` → `npm test` → `npm run build` (`tsc && vite build`). No
lint, no dependency audit, no deployment. `mkdocs.yml` deploys documentation separately.
