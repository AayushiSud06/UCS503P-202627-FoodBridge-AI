# ARCHITECTURE — FoodLink / FoodBridge-AI

> Structural map for AI context. Rationale lives in `DECISIONS.md`; current gaps in
> `PROJECT_STATE.md`. Verified against the repository on **2026-09-05**, at HEAD `9b11353`
> **plus the uncommitted Task 25 changes** in the working tree — requirement read scope and
> the donor needs board (D-44), `TASKS.md` → *Current*. Earlier verification points: the
> project health audit at `c274e99`, and `23c27f4` on 2026-09-02.

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
Tailwind 3.4 · lucide-react. Tests: Vitest 3.2 + Testing Library (D-43).
No Redux, no Axios, no form library.
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
| `pages/` (30 files) | Desktop portals: `donor/`, `ngo/`, `volunteer/`, `admin/`. `donor/DonorNeedsBoard.tsx` (`/donor/needs`) is the read-only demand board — `useRequirements()`, no API call of its own. |
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
  Applied through `donations._needs_ownership()`, which adds the one case a target set
  cannot express: `ACCEPTED` is owned too, but only from a state outside
  `OPEN_TO_RECIPIENTS` (D-35).

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

⚠️ **`ACCEPTED` is owned conditionally, on the source state.** From `AVAILABLE`/`MATCHED`
it is the open offer any verified organisation may take. From `VOLUNTEER_ASSIGNED` it is
the *release* of a pickup, and belongs to the organisation already holding the donation —
otherwise any kitchen could re-accept a delivery in flight and the binding side effect
would move `recipient_id` on to it. See `DECISIONS.md` D-35.

**The release puts a pickup back in the pool, and clears the courier with it**
(Task 21, D-41). `update_status` nulls `volunteer_id` when `ACCEPTED` is reached from
`VOLUNTEER_ASSIGNED`, so `_readable_by` shows the donation to every courier again
(`ACCEPTED AND volunteer_id IS NULL`) and `_claim_pickup` admits the next one. The
acceptance side effects — `accepted_donations += 1` and re-freezing `match_score` — are
skipped when the donation is **already bound to the accepting organisation**, so a release
is not counted as a second acceptance: that counter is the denominator of
`Recipient.reliability_score`, and counting it made a kitchen's own match score fall as a
penalty for releasing a courier. An administrator re-accepting on behalf of a *different*
organisation is still a rebind and still counts.

⚠️ **Only the accepting organisation (or an administrator) can release** —
`TRANSITION_ROLES[ACCEPTED]` is `{ngo, admin}`, so a courier cannot hand back its own
pickup. That is existing behaviour, not a consequence of the fix, and whether it should
change is a product question rather than a defect.

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

**The whole trust model is one boolean, and it means one specific thing.**
`Recipient.is_verified` (`models.py:165`) records that **a FoodLink administrator vouched
that this organisation is real and is where it claims to be** — nothing about hygiene,
food safety, licensing or any external certifier. It exists on `Recipient` only: there is
no donor and no volunteer verification anywhere in the data model. It defaults to `false`
at registration, is writable *only* by `POST|DELETE /admin/recipients/{id}/verify`, and is
deliberately not settable through `PATCH /recipients/me` — an organisation does not vouch
for itself. Two things read it: `matching.score_pair` refuses to rank an unverified
organisation, and the `ACCEPTED` transition refuses to let one take custody. The UI may
therefore say "verified" of a recipient and of nobody else, and may not dress it up as
certification. See `DECISIONS.md` D-37.

**Donation reads are scoped server-side** by `routers/donations._readable_by()`, which
returns the caller's read scope as a SQLAlchemy WHERE clause (`None` for admin). The
list, the lookup by id and `/matches` all apply the same clause, so an id the caller
may not read returns the ordinary 404 rather than a 403 that would confirm it exists.
Scope: donor → their own; ngo → `AVAILABLE`/`MATCHED` plus their own organisation's;
volunteer → unclaimed `ACCEPTED` plus their own assignments; admin → everything.
See `DECISIONS.md` D-24.

**Lifecycle writes on a donation that is already somebody's are scoped by the same
clause.** `POST /api/donations/{id}/status` re-resolves the donation through
`_get_readable_or_404` when `_needs_ownership()` says so — the `OWNED_TRANSITIONS`
targets, plus `ACCEPTED` from a state outside the open pool — after the transition and
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

**Courier reads are scoped the same way**, by `routers/organisations._visible_volunteers()`
(Task 21, `DECISIONS.md` D-41): admin → every courier; ngo → the couriers carrying, or who
have carried, one of that organisation's **own** donations; anyone else → none. The scope is
a subquery over `Donation.volunteer_id` joined through `Recipient`, so it needs no new
relationship and an `ngo` account with no organisation row matches nothing. The route keeps
its `require_roles(admin, ngo)` gate, so a donor or a courier still gets a 403 here rather
than the empty list `GET /recipients` returns — the D-26 asymmetry is deliberate and
unchanged. `GET /volunteers/me` is a separate route and is untouched.

**Standing requirements are scoped the same way**, by
`routers/organisations._visible_requirements()` (Task 25, `DECISIONS.md` D-44): admin →
every active need; **donor → every active need posted by a *verified* recipient**, which is
what the donor needs board reads; ngo → its own organisation's needs only; volunteer →
none. Verification is the gate `matching.score_pair` already applies, so a donor is never
shown demand from an organisation that could not receive the donation. Denial is an empty
list rather than a 403, following `GET /recipients`. `RequirementOut` also now carries
**`isVerified`**, read live from `Recipient.is_verified` — no column and no migration. The
NGO portals keep their client-side `myRecipient` filter as defence in depth.

⚠️ **One cross-organisation read remains open:** **`GET /donations/{id}/matches` discloses
recipient coordinates.** `MatchOut.distanceKm` is a real measurement to a named
organisation, so a donor who reads `200 []` from `GET /api/recipients` by design can post
three donations at pins of its choosing and trilaterate any verified kitchen exactly.
`TASKS.md` → *Backlog → A* / `HA-3`.

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
| donations | `POST /donations` (auto-ranks on create; `imageUrl` capped at `schemas.MAX_IMAGE_URL_LENGTH` = 256 KiB) · `GET /donations?mine=&status=&limit=` **(role-scoped; `mine` narrows further)** · `GET /donations/{id}` · `GET /donations/{id}/matches` · **`POST /donations/{id}/status`**. All four `DonationOut` responses carry `viewerMatch`, the caller's own ranking (D-30). ⚠️ `/matches` returns named organisations with real distances — see `HA-3` |
| organisations | `GET /recipients` **(role/ownership-scoped)** · `GET|PATCH /recipients/me` · `GET /requirements` **(role-scoped; a donor reads verified organisations' needs, an ngo its own)** · `POST /requirements` · **`PATCH /requirements/{id}`** (owner only) · `GET /volunteers` (**admin+ngo only, and scoped within that** — an ngo sees only its own donations' couriers) · `GET|PATCH /volunteers/me` |
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
before supply, but it does not influence any ranking. Since Task 25 that board has a donor
audience (`pages/donor/DonorNeedsBoard.tsx`), which changes who reads it and nothing about
what it does: there is no requirement-to-donation relationship in the schema, no endpoint
fulfils a need, and the page says so in as many words. `Requirement.daily_recurring` is
likewise stored and displayed but never acted on: nothing re-posts a requirement and
there is no scheduler that could (constraint 7).

Three **hard gates** return `None` rather than a low score: unverified organisation,
missing coordinates, beyond `MAX_MATCH_RADIUS_KM` (default 8).
`reliability_score` is a computed property: `85` if fewer than 3 accepted donations
(cold-start prior), else `100 × completed/accepted`.
Returns per-criterion sub-scores plus human-readable `reasons` — the score is never a
bare number.

**The two size criteria measure different things, and only one of them is a ratio**
(Task 22, D-42; the health audit found them collinear and that is fixed).

| Criterion | Question | Shape |
|---|---|---|
| `quantity_score` | does this donation *fit* this kitchen? | relative — `quantity / capacity`, peaking at a just-filled kitchen, overflow penalised twice as steeply |
| `capacity_score` | how much room does the kitchen *keep*? | absolute — spare meals left over, saturating at `FULL_HEADROOM_MEALS` (100, the default capacity) |

**Among kitchens the donation actually fits** (`capacity >= quantity`), fit alone prefers
the smallest and headroom alone the largest; below that point fit falls away too, under the
overflow penalty. Being independent, together they now peak at the kitchen that takes the
donation comfortably *and* still keeps a full day's room — a **global maximum at
`capacity = quantity + FULL_HEADROOM_MEALS`**, which is interior: the contribution is lower
both for smaller kitchens and, asymptotically, for arbitrarily large ones. A single
criterion counted twice cannot produce a peak away from the boundary.

⚠️ **The curve is not single-peaked.** Between the exact-fit point and the saturation point
there is a shallow local minimum, so a kitchen slightly larger than the donation scores
marginally below one sized exactly to it. That is a known artefact of the two criteria
crossing, not a defect to design around.

**Discrimination, stated defensibly.** Over feasible capacities for a fixed donation the old
pair spanned **exactly 5.00 points** (`0.25(40+60r) + 0.20(100-50r) = 30 + 5r`) and moved
monotonically, so its maximum sat on the boundary. The new pair spans more, and how much
more depends on donation size — roughly **10.6 to 17.5 points for donations of 20 to 500
meals**. (An earlier note quoted "10.5 versus 3.75"; those figures are specific to one
sample of candidate kitchens and are not general bounds.)

⚠️ **Units gate both of them.** `Recipient.capacity` counts **meals** — there is no
`capacity_unit` column, and the product fixes this in three places (the NGO profile field
"Max Batch Capacity (Meals)", the mobile profile's "*n* meals", and `types/index.ts`).
`Donation.unit` is free text (`String(24)`, no enum) and the picker offers Meals · Kg ·
Boxes · Pieces. Only Meals is comparable, **nothing in the repository can convert the
others**, so for any other unit both size criteria return `UNASSESSED_SIZE_SCORE` (50) and
`reasons` says so. Because the unit belongs to the *donation*, that value is identical for
every candidate and cannot reorder a ranking — such a donation is ranked on distance,
deadline and reliability, which is the information that stays meaningful. See D-42.

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

### Backend — `pytest code/tests`

37 integration tests through FastAPI's `TestClient`, **no mocks**, full stack against
in-memory SQLite. `conftest.py` uses `StaticPool` — required because in-memory SQLite
exists per connection, so the default pool would give test and request different
databases. `app.dependency_overrides[get_db]` swaps the session in without
application code knowing.
Plus 22 config unit tests, 22 rate-limit tests and 8 migration tests
(`test_migrations.py`, temp file databases, never `DATABASE_URL`) — **216 in total**
(~142 s, almost entirely real bcrypt hashing). `test_donation_reads.py` (13),
`test_volunteer_reads.py` (8) and
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
`test_lifecycle_authorization.py` (20) covers the write side of the same boundary: for
each of `PICKED_UP`, `DELIVERED`, `COMPLETED` and `CANCELLED`, an actor with the right
role but the wrong donation gets a 404 **and the stored status does not move**, the real
party still succeeds, and an administrator still drives a donation they are not party to.
Four of them fail against the pre-fix code with a `200` where a `404` belongs. The last
six cover the same boundary for `ACCEPTED` from `VOLUNTEER_ASSIGNED` (D-35), asserting
that the stranger kitchen's 404 leaves `recipient_id` where it was — two of them fail
against the pre-D-35 code — while the owning kitchen's release, an administrator's, and an
ordinary acceptance from the open pool all still return 200. It also pins the answers that
must *not* change: a role that may not cancel or accept still gets 403 (the role gate runs
first), and a cancel from a terminal state still gets 409 (so does the owner's).
`test_requirement_lifecycle.py` (15) covers the requirement lifecycle as an ownership
boundary: who may revise, retire and reopen a requirement, that another organisation's id
is a 404, and that a retired one leaves `GET /api/requirements` without being deleted.
`test_requirement_reads.py` (14) covers the read side (D-44): admin sees every active
need, a donor sees verified organisations' needs and not an unverified one's, an ngo sees
its own and not a rival's, a courier sees none, a retired need is invisible to all three,
and `isVerified` tracks the organisation — verifying one flips the flag on its existing
requirements with nothing backfilled. One of them backdates rows through the session
because `created_at` is second-resolution, so it tests the `ORDER BY` and not a tie.
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

### Frontend — `npm test` in `frontend/`

**58 tests over 8 files**, Vitest 3.2 driven through the project's own
`vite.config.ts`, so a module resolves in a test exactly as it does in the build (D-43).
Runner config is the `test` block in that file; there is no separate config and no setup
file. Default environment is **node**; the four suites that render — `lib/api.test.ts`,
`components/ProtectedRoute.test.tsx`, `pages/Landing.test.tsx` and
`pages/donor/DonorNeedsBoard.test.tsx` — opt into jsdom with a
`// @vitest-environment jsdom` docblock, so the arithmetic suites do not pay for a DOM
they never touch. The whole suite runs in ~2 s.

The seams chosen are the ones carrying logic that `tsc` cannot check, because every
field involved is a string or a number on both sides of the change:
`lib/adapters.ts` (9 — entityId precedence, event→timestamp folding, the
`deadlineScore`→`pickupAvailabilityScore` rename, feed ordering), `lib/time.ts` (8 —
urgency bands at their boundaries, the deadline roll-forward), `lib/impact.ts` (6 — D-32,
`COMPLETED`-only counting and the server counter winning over the loaded list),
`lib/geo.ts` (4 — D-33, `viewerMatch.distanceKm` beating `distanceKm`), `lib/api.ts`
(8 — token attach, the 401 eviction, Pydantic detail flattening, bodyless 5xx →
`NetworkError`) and `components/ProtectedRoute.tsx` (5 — the three redirect decisions).
Two page suites hold content claims rather than arithmetic, which is the other thing `tsc`
cannot see: `pages/__tests__/Landing.test.tsx` (4 — the absence of the invented platform
figures) and `pages/donor/__tests__/DonorNeedsBoard.test.tsx` (14 — that a need renders in
full, and that the board claims no fulfilment, commitment, automatic matching or statistic
it was not given). Both are D-31 held at a boundary.

`src/test/fixtures.ts` holds typed builders for the wire shapes (`apiDonation`,
`apiUser`, `apiMatch`, `apiRequirement`, …), so a test states only the field it is about
and a wire type that drifts from the backend fails to compile rather than failing
silently.

**Three things are stubbed, all of them boundaries into the page under test:** `fetch` in
the api suite, `useAuth` in the route-guard suite, and `useRequirements`/`useLoadState` in
the needs-board suite. `HOME_PATH` stays real, and so does `toRequirement` — the board's
fixtures go through the real adapter from the real wire shape. Nothing else is mocked;
there is no component-level test double anywhere in the suite.

⚠️ **`npm test` is not yet a CI step** — `ci.yml` still runs only `npm run build`. See
`TASKS.md` → *Backlog → D*.

## Continuous integration — `.github/workflows/ci.yml`

Two independent jobs on push to `master`/`main` and on every pull request.
**backend** (Python 3.13): `pip install -r code/requirements-dev.txt` → `pytest code/tests`
→ `alembic -c code/alembic.ini upgrade head` + `alembic ... check` against a throwaway
SQLite file, which fails the build when the models have drifted from the revision history.
**frontend** (Node 20): `npm ci` → `npm run build`, i.e. `tsc` is the type gate. ⚠️ The
frontend test suite exists but **is not wired into CI yet**; adding the step is outstanding.

The test step exports no signing key — `conftest.py` sets its own (D-22), and leaving CI
silent about it keeps that self-containment tested. Only the Alembic step needs one, because
`migrations/env.py` resolves `DATABASE_URL` through the fail-closed `Settings`; it gets a
literal non-secret placeholder. `.github/workflows/mkdocs.yml` remains separate and deploys
documentation only. Nothing here deploys the application — there is no deployment
configuration in the repository at all.
