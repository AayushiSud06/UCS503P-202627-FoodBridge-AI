# DECISIONS — FoodLink / FoodBridge-AI

> Decisions evident in the repository — D-01 to D-45. D-01 to D-31 were verified on
> 2026-09-02, through the match-score consistency commit (`23c27f4`); D-31 is the one
> decision the QA audit of that date settled, and the four questions it left open are in
> `TASKS.md` -> *Blocked*. **D-32** (impact reporting, I-1) is committed as `e8a8178` and
> **D-33** (distance, routing and GPS wording, I-2) as `fcbd03b`. **D-34**/**D-35**
> (lifecycle write authorization) are committed as `551c96d` and `efd5fd8`, **D-36**
> (notifications, I-4) as `6863451`, **D-37** (verification wording, I-5) as `6c82739`,
> **D-38** (courier status display, I-6) as `b41c4e6`, **D-39** (overdue deadlines, I-7)
> as `fc91091` and **D-40** (an account reads its own contact details, I-9) as `c274e99`,
> which is HEAD. Re-verified in the project health audit of 2026-09-05, which changed no
> source; the corrections it produced are marked in D-05, D-17, D-26 and D-35. **D-41**
> (courier read scope and the release's second meaning) is committed as `e7032ea`.
> **D-42** (matcher unit comparability and the absolute headroom criterion) is committed as
> `a9f190b` and **D-43** (the frontend test harness) as `f33aeae`, which is HEAD.
> **D-44** (requirement read scope and the donor needs board) is committed as `e72d4c2`,
> which is HEAD. **D-45** (match distance is scoped to the organisation it describes,
> `HA-3`) is **uncommitted in the working tree**.
>
> **Evidence key** — how the reasoning was established:
> **[documented]** stated in code comments/docstrings · **[inferred]** not stated, but
> the implementation only makes sense this way · **[uncertain]** genuinely unclear;
> flagged rather than guessed.
>
> Structural detail lives in `ARCHITECTURE.md`; open work in `TASKS.md`.

---

## D-01 · Append-only event ledger instead of timestamp columns **[documented]**

**Decision.** Every lifecycle transition appends a `status_events` row (from, to,
actor, server-stamped `occurred_at`) rather than updating a per-state timestamp
column on `donations`.

**Reasoning** (`models.py` docstring): the proposal's evaluation metrics —
time-to-claim, rescue rate — are derived from these rows, "so they must be
append-only and server-stamped". Also: the trail records *who* acted, which a column
cannot express; adding a state needs no migration; and re-entering a state
(`MATCHED → AVAILABLE → MATCHED`, which `ALLOWED_TRANSITIONS` permits) is
representable, whereas a single `matched_at` would be overwritten.

**Constraints.** Reading one timestamp means scanning a donation's events
(`Donation.timestamp_of` is a linear scan). Fastest-growing table in the schema.
`occurred_at` must never be populated from a request body — that would void the
metrics' credibility.

---

## D-02 · Lifecycle rules as data, not conditionals **[inferred]**

**Decision.** `models.ALLOWED_TRANSITIONS` (state graph → 409) and
`donations.TRANSITION_ROLES` (who may cause each target → 403) are module-level dicts
consulted by `update_status`.

**Reasoning.** Not stated as a rationale, but `ALLOWED_TRANSITIONS` carries the
comment "Anything not listed is rejected with 409, so the lifecycle cannot be driven
into a nonsense state by a buggy client." The table form makes the whole rule set
readable in one screen and testable without HTTP.

**Constraints.** Enforced **only in application code** — no DB CHECK constraint
mirrors it. Adding a `DonationStatus` member without updating both dicts fails two
ways: missing from `ALLOWED_TRANSITIONS` → `KeyError`/500; missing from
`TRANSITION_ROLES` → `.get(target, set())` means nobody can perform it (fails closed,
but silently). A startup assertion covering both would close this.

---

## D-03 · Re-read the user row on every request; ignore the token's `role` **[documented]**

**Decision.** `get_current_user` decodes the JWT for `sub`, then does
`db.get(User, id)` and checks `is_active`. The `role` claim in the token is never
trusted.

**Reasoning** (`api.ts` comment mirrors it): "the backend re-reads the account on
every request, so this can arrive at any moment rather than only at login" — an
administrator suspending an account takes effect immediately, mid-session, rather
than whenever the token happens to expire. Test
`test_a_suspended_accounts_existing_token_stops_working` locks the behaviour in.

**Constraints.** One indexed PK lookup per authenticated request — accepted cost.
Gives coarse revocation only: an account can be killed, an individual session cannot.

---

## D-04 · Two-tier administrator model **[documented]**

**Decision.** `SELF_SIGNUP_ROLES` excludes `admin`, enforced by a Pydantic
`field_validator` on `RegisterRequest`. The first admin comes only from
`python -m foodlink.cli create-admin`; later ones from `POST /api/admin/users`.

**Reasoning** (`models.py`): an administrator "can verify organisations, override any
lifecycle transition and read every record, so that role has to be granted by someone
who already holds it… Leaving it in the public enum would make 'become an admin' a
single unauthenticated POST." The validator sits in the **schema, not the router**,
specifically so the restriction appears in the published OpenAPI document
(`schemas.py`). `cli.py` adds that the bootstrap authority is whoever can already run
commands against the database — "the only authority that exists before any account
does" — and prompts via `getpass` because arguments land in shell history.

**Constraints.** Requires shell/database access to bootstrap. Paired with lockout
guards in `admin.py` (no self-demotion; last active admin protected) because on a
deployment this small, lockout is unrecoverable without shell access.

---

## D-05 · Explainable weighted heuristic, not machine learning **[documented]**

**Decision.** Recipient ranking is a weighted sum over five normalised criteria
(`distance .25`, `quantity .25`, `capacity .20`, `deadline .15`, `reliability .15`),
with published weights and per-criterion `reasons` returned alongside the total.

**Reasoning** (`matching.py`): "Deliberately not a learned model: the proposal commits
to an explainable heuristic that a recipient can read the reasoning for, and that a
marker can verify by hand." Structured so that "swapping in a learned ranker later
means replacing `score_pair` only; the router and the response shape do not change."

**Constraints.** Weights are judgement, not tuned against outcomes. The 20 km/h travel
constant and haversine straight-line distance are approximations (no routing API).
⚠️ **Never describe this system as AI/ML** — the repo name is misleading.

⚠️ **Two of the five criteria do not behave as five criteria** (health audit, 2026-09-05).
`_quantity_score` and `_capacity_score` take the same `(quantity, capacity)` and are
monotone in the same ratio `r` in opposite directions, so their weighted contribution is
`0.25(40 + 60r) + 0.20(100 − 50r) = 30 + 5r` — **45% of the published weight moves five
points across the entire feasible range**, then drops 11.5 at `r = 1`. And neither reads
`Donation.unit`, though `quantity` is a count in Meals · Kg · Boxes · Pieces while
`capacity` is meals per day: 100 Kg and 100 Meals score identically. So "a marker can
verify it by hand" still holds and "five weighted criteria" does not — the explainability
panel renders two collinear bars as two independent ones, which since I-8 are individually
captioned correctly. **The decision stands and the structure is not what needs changing;
the two functions are.** `TASKS.md` → *Next* step 2 (`HA-4`, `HA-5`). Re-tuning `WEIGHTS`
(`R-31`) is blocked behind it.

---

## D-06 · Ineligibility gates rather than low scores **[documented]**

**Decision.** `score_pair` returns `None` — excluding the recipient entirely — for
unverified organisations, missing coordinates, or distance beyond the radius, instead
of scoring them low.

**Reasoning** (`matching.py`): a suggestion the recipient "is not allowed to act on
would be a false promise to the donor, and an unvetted kitchen at the top of the list
is worse than a slightly further verified one." Coordinates being optional is the
paired decision: a recipient without them "simply cannot be matched yet, which is the
correct behaviour rather than an error — it keeps registration one short step instead
of a survey."

**Constraints.** Verification is enforced in **two places** — ranking (`score_pair`)
and acceptance (`update_status` → 403). Both are required: ranking alone is a UI
filter a client could bypass. Separate tests cover each half.

---

## D-07 · No service or repository layer **[inferred]**

**Decision.** Business logic lives in router functions calling the SQLAlchemy session
directly. Only genuinely reusable, HTTP-independent logic was extracted
(`matching.py`, `serialize.py`, `security.py`).

**Reasoning.** Not stated. The consistent pattern — pure logic extracted, orchestration
left in place — indicates a size judgement rather than an oversight: a service class
that only forwarded to the ORM would be indirection without insulation.

**Constraints.** `update_status` is ~80 lines mixing HTTP concerns with domain rules,
and lifecycle transitions cannot be driven from anything but an HTTP request. The
natural cut line is the moment a transition must also come from a scheduled job, queue
consumer, or the CLI.

---

## D-08 · SQLite by default, Postgres-capable **[documented]**

**Decision.** `DATABASE_URL` defaults to `sqlite:///./foodlink.db`; everything goes
through SQLAlchemy so Postgres needs no code change.

**Reasoning** (`config.py`): "SQLite by default so the project runs with no database
server. Point `DATABASE_URL` at Postgres in staging and nothing else changes."
`check_same_thread: False` is noted as "a SQLite-only concession" for FastAPI's
threadpool.

**Constraints.** Single writer — blocks multi-worker uvicorn. FKs unenforced
(`PRAGMA foreign_keys` never issued). No timezone type, which forced D-09. The path is
**relative to the working directory**, which is why two `foodlink.db` files exist.

---

## D-09 · `UtcDateTime` type decorator **[documented]**

**Decision.** A custom `TypeDecorator` normalises every datetime to timezone-aware UTC
on write and reattaches UTC on read.

**Reasoning** (`models.py`): SQLite's `DateTime(timezone=True)` "stores the naive
wall-clock and hands it back with no offset, which is silently wrong twice over" — the
API then serialises a zoneless timestamp and "a browser reads it as *local* time — a
deadline four hours out appears ninety minutes past in IST." Solved at the type layer
so no individual query has to remember. Postgres "already does this, and passes
through unchanged."

**Constraints.** Naive client input is *assumed* UTC rather than guessed at. No direct
test exists for this decorator.

---

## D-10 · Deliberate anti-generic visual design **[documented]**

**Decision.** `tailwind.config.js` overrides Tailwind's default palette: warm stone
neutrals replacing cool grays, moss/olive brand green replacing "neon SaaS emerald",
muted plum, sage-teal, and a terracotta `clay` accent. Fonts: Inter + Fraunces
(display serif).

**Reasoning** (config comments): explicitly framed against template-SaaS defaults —
"warm moss/olive instead of neon SaaS emerald", the plum accent chosen so it "sits
inside the warm palette instead of fighting it".

**Constraints.** Overriding `gray`/`emerald`/`purple`/`teal` **by name** means every
existing utility class in the app silently changes appearance — the retune cascades
app-wide rather than being opt-in.

---

## D-11 · Write-then-refetch instead of optimistic updates **[documented]**

**Decision.** `AppContext` mutations post to the server and then re-read the affected
slice, rather than patching local state optimistically.

**Reasoning** (`AppContext.tsx`): "That is slower than patching local state
optimistically, but it is the only way the client and server cannot disagree — and the
server is where the lifecycle rules and the server-stamped history live, so its answer
is the true one." The same file notes the hook surface was preserved from the prototype
"because the screens built against it are good and there is no reason to rewrite forty
components to change where the data comes from."

**Constraints.** Two round trips per mutation. React Query would preserve the
correctness while removing the chattiness.

---

## D-12 · Single API boundary in the frontend **[documented]**

**Decision.** `lib/api.ts` is the only place the app calls `fetch`, plus an
`adapters.ts` seam translating wire types to app domain types.

**Reasoning** (`api.ts`): three concerns handled "once instead of in forty components"
— token attachment, errors carrying the server's own `detail` (which "is written to be
shown to a person"), and a 401 meaning "the whole app needs to know at once rather than
each screen discovering it separately".

**Constraints.** Wire types are hand-mirrored from the Pydantic schemas — a backend
rename is a silent runtime break, not a compile error. Generating the client from
OpenAPI would close this.

---

## D-13 · JWT in localStorage, no refresh token **[documented]**

**Decision.** A single 720-minute HS256 access token in `localStorage`, sent as a
bearer header.

**Reasoning** (`api.ts`): "The token lives in localStorage so a refresh does not sign
the user out. That trades a little XSS exposure for the session surviving a page
reload, which is the right trade for this app: any script able to read it could just as
easily act through the already-authenticated page." Only the token is persisted — the
user is re-fetched from `/api/auth/me` on boot so "a suspended or re-roled account
cannot keep acting on a stale local copy of its own permissions" (`AuthContext.tsx`).

**Constraints.** XSS-readable. No revocation or blocklist; logout is client-side only,
so a copied token stays valid until `exp`. CSRF is inapplicable (header, not cookie) —
this would change immediately under cookie auth. Partial mitigation via D-03.

---

## D-14 · Route guards are UX, not security **[documented]**

**Decision.** `ProtectedRoute` gates portals client-side and admins are allowed into
every portal.

**Reasoning** (`ProtectedRoute.tsx`, `App.tsx`): "The server is the real authority —
every endpoint checks the caller's role on every request, and this component cannot
grant anything the API would refuse. What it does is stop the app from rendering a
portal that would only fill with 403s." Admins are included everywhere because "an
administrator can act on any donation through the API, and being able to see what a
donor or a kitchen sees is most of what platform support consists of."

**Constraints.** Must never be treated as an access control. Widens admin *visibility*
only, not privilege.

---

## D-15 · Derived values as properties, never stored **[documented]**

**Decision.** `Recipient.reliability_score`, `User.initials`, `User.recipient_id` /
`volunteer_id`, and `distanceKm` are computed, not columns.

**Reasoning.** For distance (`models.py`): "Distance is a relationship between two
places, not a property of a donation, and the matcher needs it against many
recipients." For reliability (`models.py`): new organisations "start optimistic (85)
rather than at zero, so a kitchen with no history is not permanently outranked by one
with a single lucky completion."

**Constraints.** The `85` prior and the 3-donation threshold are unjustified constants
— judgement, not data. ⚠️ **Exception to the pattern:** `match_score` *is* stored, and
deliberately — frozen at acceptance "so the number shown later is the one the decision
was actually made on". The *reader's* own score stayed derived: it is computed per
request as `DonationOut.viewerMatch` and never written (D-30).

---

## D-16 · Self-service schemas exclude privileged fields **[documented]**

**Decision.** `ProfileUpdate` omits `role`/`email`/`is_active`; `RecipientUpdate` omits
`is_verified`; `VolunteerUpdate` omits `rating`/`completedDeliveries`.

**Reasoning** (schema docstrings): those fields "decide what the account can do and who
it is, so they belong to an administrator, not to the holder"; an organisation "does not
get to vouch for itself"; delivery count and rating "are earned through completed runs,
so they are the server's to maintain, not the courier's."

**Constraints.** Privilege escalation is prevented by schema shape rather than a runtime
check — new self-service endpoints must follow the same discipline.

---

## D-17 · Integration tests only, no mocks **[documented]**

**Decision.** The **37 integration tests** — `test_api.py` (15) and `test_auth_admin.py`
(22) — exercise the full HTTP stack against in-memory SQLite via `StaticPool` and
`app.dependency_overrides[get_db]`, with no mocks. ⚠️ **37 is the integration subset, not
the suite**: the backend suite is **168 tests** at HEAD `c274e99`, the rest being the
read-scope, lifecycle-authorization, requirement-lifecycle, courier-claim,
match-score-consistency, rate-limit, config and migration files added since. Those follow
the same no-mocks discipline; the config, rate-limit and matching-boundary tests are the
deliberate exceptions that call the module directly.

**Reasoning** (`conftest.py`): `StaticPool` "keeps one in-memory database alive across
connections, which the request/test boundary would otherwise discard." The admin fixture
notes the API "has no path to a first administrator by design, so tests reach into the
database exactly as `create-admin` does, then authenticate normally through the API" —
respecting the security boundary rather than bypassing it.

**Constraints.** ~130 s runtime for the full 168, almost entirely real bcrypt hashing (the
original 37 ran in ~19 s). `matching.py` is still reached almost entirely through HTTP —
one test in `test_match_score_consistency.py` calls `score_pair` directly with an injected
`now`, and the individual `_*_score` helpers have no direct test at all, which is how the
collinearity in D-05 went unnoticed. Zero frontend tests.

---

## D-18 · Uniform, human-readable error messages **[documented]**

**Decision.** Errors are explicit `HTTPException`s whose `detail` is a sentence written
for a person; the frontend surfaces it directly. Login returns one message for both
unknown-email and wrong-password.

**Reasoning** (`auth.py`): one message because "distinguishing them would confirm which
addresses have accounts". A disabled account is refused at login rather than on its next
request "so 'your account has been suspended' is what the person actually sees."
`hooks.ts`: passing the server's message through "beats inventing a generic apology."

**Constraints.** No custom exception handler exists, so an *unhandled* 500 has no body —
and `api.ts` maps a bodiless 5xx to `NetworkError`, making a crash look like an outage.
⚠️ Registration still returns a distinct 409 for a duplicate email, so **registration
does leak account existence** even though login does not.

---

## D-19 · Vite proxies `/api` in development **[documented]**

**Decision.** `vite.config.ts` proxies `/api` to `127.0.0.1:8000`; the client uses
relative paths by default.

**Reasoning** (`vite.config.ts`, `api.ts`): "the browser only ever talks to one origin,
so there is no CORS negotiation in development and no API host to configure in the
client." `VITE_API_URL` overrides the origin for a real deployment.

**Constraints.** CORS is therefore **never exercised in development** — a whole class of
issues appears only in production. A CORS error in dev means something is bypassing the
proxy.

---

## D-20 · Separate mobile component tree at `/m/*` **[uncertain]**

**Decision.** 26 mobile screens under `frontend/src/mobile/`, mounted at `/m/*` behind a
plain `ProtectedRoute` with an inner per-portal `MobileRole` guard.

**Reasoning.** ⚠️ **Not documented.** `App.tsx` labels it only "the same portals in a
phone layout". The screens themselves (bottom nav in `nav.ts`, `CreateDonationCamera`)
suggest touch-first flows that CSS breakpoints alone would not produce — but this is
inference, not a stated rationale.

**Constraints.** Two screen sets to keep in sync. ⚠️ **`useIsMobile.ts` exists and is
never imported** — so entry is by URL only and nothing routes a phone visitor there.
Whether that is an unfinished intention or a deliberate choice is **unresolved**; see
`TASKS.md`.

---

## D-21 · `create_all` at startup instead of migrations — **superseded by D-23**

`main.py`, `cli.py` and `seed.py` each called `Base.metadata.create_all`, described in
`main.py` as "fine for SQLite and coursework. Introduce Alembic before the schema has
to change without dropping data" — an acknowledged temporary measure. It created
missing tables and never altered existing ones, so a new model column silently did not
appear and the only recovery was deleting the database file. Replaced by Alembic; see
D-23. The test suite still builds its throwaway schemas this way, deliberately.

---

## D-22 · The signing key is fail-closed, with an explicit development opt-in **[documented]**

**Decision.** `FOODLINK_SECRET_KEY` has no default. A missing key raises
`ConfigurationError` while `Settings` is constructed. Local development opts in via
`FOODLINK_DEV_INSECURE_SECRET=1`, which selects a stable, clearly-named development
key and makes `main.py` warn on every startup. The previously-shipped default is
refused even when set deliberately, and keys under 32 characters are rejected.

**Reasoning** (`config.py` docstring): the signing key "is the exception to 'sensible
default': there is no safe value to fall back to. A key that ships in the source is a
key an attacker can read, and with it they can mint a token for any account and any
role." Three sub-decisions worth keeping:

- **Validation lives in `Settings.__init__`, not in `main.py`'s lifespan.** Because
  `get_settings()` is called during import of `database`, `security` and `main`, the
  failure lands before uvicorn binds a port *and* covers `python -m foodlink.cli` —
  one check protecting every entry point.
- **The dev key is stable, not randomly generated per process.** A random key would be
  safer still, but `uvicorn --reload` restarts on every file save and would sign the
  developer out each time. Stability preserves the existing workflow (D-08's
  zero-setup value); the opt-in flag is what keeps it out of a deployment.
- **A single-purpose flag rather than an `APP_ENV`/`ENVIRONMENT` enum.** The repository
  has no environment concept and inventing one would be a much larger change; a
  variable named `FOODLINK_DEV_INSECURE_SECRET` is self-evidently wrong to find in a
  deployment's environment.

**Constraints.** ⚠️ **This changes the local development workflow**: a fresh clone must
now export one of the two variables before the backend or CLI will start — the
zero-setup property of D-08 no longer extends to the signing key. The error message
carries both remedies, since it is the only place a deployer learns them. `conftest.py`
sets its own key before importing the app, so the test suite needs no setup and never
exercises the dev fallback. Error messages deliberately never echo the configured
value, so a bad secret cannot leak into a log or crash report.

---

## D-23 · Alembic owns the schema, and runs in process at startup **[documented]**

**Decision.** Alembic (`code/alembic.ini`, `code/migrations/`) is the sole owner of the
schema, replacing D-21's `create_all` in `main.py`, `cli.py` and `seed.py`. All three
now call `foodlink.migrate.ensure_schema_current()`, which applies outstanding
revisions and is a no-op once the database is at head. One revision exists,
`ae4636b1e6d4 initial schema`, autogenerated from the models against an empty database
— it represents the schema exactly as it already was.

**Reasoning** (`foodlink/migrate.py` docstring). Four sub-decisions:

- **The URL is never in `alembic.ini`.** `env.py` reads it from
  `config.Settings.database_url`, so migrations and the application resolve
  `DATABASE_URL` through one piece of code and cannot be pointed at different
  databases. Consequence: Alembic inherits D-22, so `FOODLINK_SECRET_KEY` (or the dev
  opt-in) must be set to run a migration that does not need it — accepted, because one
  configuration path per entry point is worth more than the exemption.
- **`upgrade head` at startup rather than as a deploy step.** The project's local
  workflow is "start the server and the database is ready", and `cli._session`'s
  comment says bootstrapping on a bare checkout is a property worth keeping. The usual
  objection — several workers racing to migrate — cannot arise while SQLite's single
  writer already forbids multiple workers (ARCHITECTURE constraint 1).
- **A database predating migrations is reported, never rewritten.** It has all six
  tables and no `alembic_version` row; running the initial revision would fail on
  `CREATE TABLE users`, and nothing has verified that its schema is actually current.
  So startup warns with the exact non-destructive fix — `alembic stamp head` — and
  leaves the schema alone. Both local development databases were baselined this way;
  `alembic check` then reported no difference from the models, and no row was lost.
- **Tests keep building schemas with `create_all`.** `conftest.py` is unchanged. Its
  in-memory `StaticPool` databases exist to exercise the *application* against the
  current models (D-17); routing them through migrations would add per-test cost and
  make every API test depend on the revision history. The migration history is tested
  where it belongs — `test_migrations.py` builds a real file database from the
  revisions and asserts `compare_metadata` finds no difference from `Base.metadata`,
  which is what catches a model change committed without a revision.

**Constraints.** ⚠️ The startup call must move to the deploy script the moment this
project runs more than one process against Postgres. Revisions render with
`render_as_batch`, required for ALTER on SQLite and a no-op on Postgres. `env.py`'s
`render_item` hook renders `UtcDateTime` (D-09) as its DDL-equivalent
`sa.DateTime(timezone=True)`, so revision files never import the model layer and a
later rename of that class cannot break migrations that already ran. Autogenerate still
reads a column rename as a drop plus an add — revisions must be read before they are
committed.

---

## D-24 · Donation read scope is a WHERE clause, and denial is a 404 **[documented]**

**Decision.** `routers/donations._readable_by(db, user)` returns the set of donations a
caller may read as a SQLAlchemy WHERE clause — or `None`, meaning unrestricted, for an
administrator. `GET /donations`, `GET /donations/{id}` and `GET /donations/{id}/matches`
all apply that one clause. An id outside the caller's scope is filtered in the query, so
it returns the same `404 Donation not found` as an id that never existed.

**Reasoning.**

- **One clause, both endpoints.** The gap being closed was that list scoping and
  id lookup disagreed — `mine=false` returned everything and `/{id}` checked nothing.
  Deriving both from the same function is what makes "you cannot get round the list by
  knowing an id" a property rather than a pair of checks that can drift apart.
- **Scoping in SQL, not after the fetch.** The database never hands back rows the caller
  may not see, so there is no unfiltered object to leak through a later code path, and
  `limit` counts rows the caller can actually read.
- **404, not 403.** A 403 on a real id and a 404 on a fake one together answer "does
  donation 812 exist?" — which is part of what the scoping withholds (donations carry
  exact coordinates and donor names). This follows D-18's reasoning for the login
  message. Consequence: an authorisation failure is indistinguishable from a typo, which
  is worse for debugging and accepted deliberately.
- **`mine` stays a convenience filter.** It narrows within the scope; it is no longer
  load-bearing for authorisation. The frontend asks for the whole list and filters
  client-side (`AppContext.load`), so the server had to be the boundary regardless.
- **The scope map fails closed.** A role with no branch returns `false()` and reads
  nothing, rather than falling through to everyone's records.
- **`/matches` follows the donation.** The ranking explains a specific donation, so
  exposing it for an unreadable donation would leak the donation itself plus the
  recipient names and distances around it.

**Constraints.** The volunteer scope — unclaimed `ACCEPTED` pickups plus their own
assignments — is what the data model can express: there is **no** volunteer/donation
eligibility relationship in the schema, so "donations a courier is eligible for" can only
mean "not yet claimed". A geographic or availability-based courier scope would need a new
relationship.

⚠️ **The write path was left untouched here, and that was wrong.** This section used to
read that `update_status` could keep the unscoped `_get_or_404` "because its authorisation
is `TRANSITION_ROLES` plus ownership" — but no working ownership test existed for
`PICKED_UP`, `DELIVERED`, `COMPLETED` or `CANCELLED`, so the role gate was the only gate.
**D-34** closes that by reusing this clause on the write path; the claim step still
legitimately acts on a donation before the courier is bound to it, which is why it is not
covered by that scoping.

---

## D-25 · CI validates; it does not deploy, and holds no secret **[documented]**

**Decision.** `.github/workflows/ci.yml` runs the backend suite, `alembic check` and the
frontend build on push and pull request, as two parallel jobs. It is a second workflow
rather than steps added to `mkdocs.yml`. The `pytest` step is given no environment; the
Alembic step is given a literal placeholder `FOODLINK_SECRET_KEY`, not a repository secret.

**Reasoning.**

- **Separate from mkdocs.** The documentation workflow deploys to `gh-pages` and needs
  `contents: write`; validation needs only `contents: read` and must be able to fail
  without taking documentation down with it. Merging them would also mean a docs-only
  edit paying for a full test run.
- **No key for the tests.** `conftest.py` sets its own key before importing the app
  (D-22). If CI exported one globally, a future regression that made the suite depend on
  ambient configuration would pass here and fail on a developer's fresh clone. Saying
  nothing is what keeps that property under test.
- **A placeholder, not a secret, for `alembic check`.** `migrations/env.py` reads the
  database URL through `Settings`, so the fail-closed rule applies to migrations too — but
  the key signs nothing in that step, so there is no secret to protect. A repository secret
  would imply the value matters and add a rotation obligation for a string that does not.
  It is 45 characters (past `MIN_SECRET_KEY_LENGTH`) and is neither the retired public key
  nor `DEV_SIGNING_KEY`.
- **`upgrade head` then `check`, on a throwaway database.** `check` compares the models
  against a live schema, so it needs one built from the revision history; a file in the
  workspace is discarded with the runner. This catches the same drift as
  `test_migrations.py` but through the real `alembic` CLI, which is the path a developer
  actually uses.
- **Python 3.13, Node 20.** 3.13 is what the project is developed on, and the code needs
  3.10+ regardless (the root `pyproject.toml`'s `requires-python = ">=3.8"` is template
  residue and wrong). Node 20 is the current LTS and is what Vite 5 targets.

**Constraints.** CI proves the backend and the type layer, not the frontend's behaviour —
there are no frontend tests, so `tsc` passing is the whole frontend signal. The workflow
deliberately contains no deployment: the project has no deployment configuration, and
inventing one in CI would be the wrong place to start.

---

## D-26 · Recipient reads are scoped by ownership, and denial is an empty list **[documented]**

**Decision.** `routers/organisations._visible_recipients(user)` returns the organisations
a caller may read as a WHERE clause — `None` (unrestricted) for an administrator,
`Recipient.user_id == user.id` for an `ngo`, and `false()` for everyone else. `GET
/api/recipients` applies it in the query. A donor or a courier therefore receives `200 []`
rather than a 403.

**Reasoning.**

- **It is a directory of people, not of places.** `RecipientOut` carries
  `contact_person` and `phone`. That is the same objection the `GET /api/volunteers`
  docstring already raises about the courier roster, on the neighbouring table.
- **A kitchen sees only itself.** There is no workflow between two recipient
  organisations anywhere in the model — a donation binds a donor, one recipient and one
  courier. Peer organisation *names* are already public through `GET /api/requirements`
  and through `/matches`; their contact details had no reader.
- **Donors and couriers read nothing here.** Both learn which organisation a donation
  went to from `recipientName` on the donation itself, which carries no contact person
  and no phone. Giving them the row would be widening, not preserving.
- **A clause, not `require_roles`.** The `ngo` scope is per-row, so a role gate cannot
  express it; using one mechanism for all four roles is what keeps the boundary in one
  place. This is D-24's shape applied to the neighbouring table.
- **An empty list, not a 403.** ⚠️ **Deliberately unlike `GET /api/volunteers`**, which
  role-gates and returns 403. Nothing here is worth withholding by status code — the
  endpoint's existence is public in `/docs` and the response reveals nothing either way —
  and a single code path that always returns `list[RecipientOut]` keeps the contract
  intact for the client, which already treats a 403 and an empty list identically
  (`AppContext.optional`). Consequence, accepted: a misconfigured account sees an empty
  directory rather than an error explaining why.
- **The scope map fails closed.** A role with no branch reads nothing.

**Constraints.** `GET /api/recipients/me` remains the NGO portal's own-profile route and
is unchanged; the scoped list also still contains that row, because `useMyRecipient`
resolves the caller's organisation out of the list rather than from `/me`. No individual
`GET /api/recipients/{id}` exists, so there is no id path to scope — should one be added,
it must apply this same clause and 404, per D-24. Admin verification
(`POST|DELETE /api/admin/recipients/{id}/verify`) is untouched and stays unrestricted
behind the admin router gate.

✅ **This decision named the courier roster and did not fix it; that gap is now closed by
D-41** (Task 21, `e7032ea`). The first bullet above cites "the same objection the `GET /api/volunteers`
docstring already raises about the courier roster, on the neighbouring table" — and the
scope was applied to `RecipientOut` only. **`GET /api/volunteers` remains role-gated and
unscoped**: `require_roles(admin, ngo)` with no ownership clause, so every account holding
the `ngo` role reads every courier's name, location, availability and **phone**. Because
registration hands that role to a stranger and `is_verified` gates ranking and acceptance
but not this endpoint, the cost of the whole roster is one throwaway email address —
reproduced in the health audit of 2026-09-05. No decision was ever recorded for it and no
task was filed until that audit. **D-41 applies this decision's own shape one table over**,
which is what it should have done here.

⚠️ **A second, narrower bypass of this scoping exists in `/matches`.** `RecipientOut`
withholds `latitude`/`longitude` from a donor, and `MatchOut.distanceKm` gives them back: a
donor reads `200 []` here by design, then posts three donations at pins of its choosing and
trilaterates any verified organisation from the three distances — recovered exactly in the
same audit. `TASKS.md` → *Backlog → A* / `HA-3`. Rounding the serialised distance is the
cheap answer; removing the field is not, because I-2/D-33 depends on it.

---

## D-27 · Rate limiting is a per-process sliding window, written here rather than installed **[documented]**

**Decision.** `foodlink/ratelimit.py` holds a `RateLimiter` — a deque of request
timestamps per key, in this worker's memory — and exposes two route dependencies that
`POST /api/auth/login` and `POST /api/auth/register` carry in
`dependencies=[Depends(...)]`. The key is `request.client.host`. The default policy is
**30 logins per 5 minutes** and **10 registrations per hour** per address, all four
numbers settable from the environment. Over the ceiling: `429` with a `Retry-After`
header and one human sentence. No dependency was added.

**Reasoning.**

- **No library, because the library is bigger than the problem.** `slowapi` (over
  `limits`) is the obvious candidate and would have brought the `limits` package and its
  own transitive dependencies, a global limiter object, an exception handler registered
  on the app, and a `Request` parameter added to both handler signatures — to obtain a
  counter in process memory, which is what the 75 lines of code here already are. The project has no
  service layer, no middleware but CORS, and a deliberately short `requirements.txt`
  (D-07); a dependency earns its place by doing something the codebase cannot.
- **A route dependency, not middleware.** Middleware would have to re-derive which paths
  to limit from the URL, and a renamed route would silently lose its limit. On the route,
  the limit is part of the route definition and visible in the same three lines as the
  response model.
- **Keyed on the address, never the account.** Counting by submitted email would let
  anyone lock a person out of their own account by failing logins for them, and the
  response would differ between an address that has an account and one that does not —
  which is exactly what login's single error message withholds (D-18). The 429 message
  names the network for the same reason.
- **Every request counts, not just the failures.** The limiter runs before the handler
  and never learns the outcome, so authentication below the ceiling is unchanged. The
  cost is that a burst of *successful* logins from one address counts too, which the
  ceilings are set high enough to absorb.
- **A sliding window, not a fixed one.** A fixed window lets through twice the limit
  around its boundary. A deque of at most `limit` floats per active key is cheap enough
  that the exact answer was not worth trading away; a sweep drops keys whose window has
  passed so the dict cannot grow with every address ever seen.
- **A refused request is not counted.** Otherwise retrying pushes the window out ahead of
  the caller and `Retry-After` stops being true.
- **Conservative, not hostile.** The ceilings have to clear a person mistyping a password
  and a lecture theatre behind one NAT, while cutting an automated run from bcrypt-bound
  (hundreds a minute) to single figures. Because "how many people share one address" is a
  property of the network and not of the code, all four values are environment settings —
  and `config._positive_int` refuses `0` (which would refuse every request) and negatives
  (which would refuse none), in the same fail-closed spirit as the signing key (D-22).

**Constraints.**

- ⚠️ **The counter is process-local.** It is exact for the deployment the project has —
  SQLite confines it to one writer, and migrations already run in the app's own lifespan
  (D-23) — but `n` uvicorn workers would keep `n` independent counters and the effective
  limit would be `n` times the configured one. Multi-worker or multi-host deployment
  needs a shared store (Redis) or a limiter at the proxy; that is a deployment decision,
  tracked in `TASKS.md` → *Backlog → E*, not something this control pretends to solve.
- ⚠️ **Behind a reverse proxy, every request arrives from the proxy** and shares one
  budget unless uvicorn runs with `--proxy-headers --forwarded-allow-ips=<the proxy>`.
  `X-Forwarded-For` is not read in application code on purpose: any client can send it,
  so trusting it there would hand every caller a switch to turn the limiter off. The
  trust decision belongs to the deployment, which is the only place that can make it.
- **Distributed credential stuffing is not addressed.** One password tried against many
  accounts from many addresses stays under a per-address ceiling. Account lockout and MFA
  are the answers to that, and both remain unbuilt (`TASKS.md` → *Backlog → A*).
- **The 429 is not declared in the OpenAPI schema**, consistent with the rest of the API,
  where no error response is declared anywhere.
- **A restart forgets every counter**, which is the intended trade: no persistence, no
  storage, and the worst case is one extra window's worth of attempts. The clock is
  `time.monotonic`, so a system clock adjustment cannot widen or collapse a window
  either.

---

## D-28 · The courier claim is a conditional UPDATE, not a checked assignment **[documented]**

**Decision.** `routers/donations._claim_pickup()` binds a courier to a pickup with one
statement — `UPDATE donations SET volunteer_id = :courier WHERE id = :id AND status =
:from_status AND (volunteer_id IS NULL OR volunteer_id = :courier)` — and reads
`rowcount != 1` as having lost the claim. The Python comparison it replaces is gone. No
lock hint, no schema change, no new dependency, and the compiled SQL is byte-identical
on SQLite and PostgreSQL.

**Reasoning.**

- **The check and the write had to become one operation.** The previous code read
  `donation.volunteer_id`, compared it in Python, then assigned. Two couriers can both
  read `NULL` and both conclude they may have it; the value that authorised the write
  was fetched before the write, so nothing stopped the second from overwriting the
  first. Moving the condition into the WHERE clause means the database evaluates it
  against the row *as it applies the update*, which is the only moment at which the
  answer is still true.
- **`SELECT … FOR UPDATE` was rejected because SQLite discards it.** SQLAlchemy compiles
  `with_for_update()` to a plain `SELECT` on SQLite — verified against both dialects —
  so the lock would silently not exist on the engine the project develops and tests
  against. A fix that is inert exactly where it is exercised is worse than none: the
  suite would go green without ever having held a lock. The conditional UPDATE needs no
  dialect-specific support, so what the tests run is what a deployment runs.
- **The state is in the condition, not only the courier.** `status = :from_status` is
  the second half of "still claimable" and is what makes one courier's duplicate
  requests safe: by the time the second arrives, `volunteer_id` *is* the caller, so the
  courier half admits it. The state half refuses it, and the pickup does not transition
  or record an event twice.
- **Losing returns the answer arriving a moment later would have got.** On `rowcount`
  0 the row is re-read and the request is told either "Another courier has already
  claimed this pickup" or the transition table's own
  `Cannot move a donation from X to Y` — both pre-existing strings, chosen by what the
  row now says. So the concurrent outcome and the sequential outcome are the same
  response, and neither invents a message for a race the person cannot see (D-18).
- **No constraint, and no migration.** `volunteer_id` is a single nullable column on
  the donation row, so "one courier per pickup" is already structural — there is no
  second row a unique index could forbid, and a unique index on `volunteer_id` would be
  actively wrong, since a courier holds many pickups. The defect was a lost update, not
  a missing constraint. `alembic check` reports no drift.
- **The winner's row lock covers the rest of the transition.** A successful UPDATE
  holds the row's write lock until commit, so the `status` write and the appended
  `StatusEvent` that follow it cannot be interleaved with another claim. The guard did
  not need to be repeated on them.

**Constraints.**

- ⚠️ **This depends on READ COMMITTED**, which is PostgreSQL's default and which
  nothing in the project overrides — `create_engine` sets no `isolation_level` anywhere
  (verified). There, a second transaction's identical UPDATE blocks on the winner's row
  lock and re-evaluates its WHERE clause against the committed row, matching nothing.
  Under REPEATABLE READ or SERIALIZABLE it would instead raise a serialization failure,
  which without a retry or an exception handler would reach the caller as a 500 rather
  than the 409. Changing the isolation level is therefore not a free change.
- **On SQLite the property holds for a different reason:** writes serialise, so the
  loser's UPDATE runs after the winner's commit and matches nothing. Concurrency is
  still bounded by `SQLITE_BUSY` under contention, which is unchanged and not what this
  addresses.
- **The session's copy of the row is deliberately stale** after the UPDATE
  (`synchronize_session=False`, so no extra SELECT is issued), which is why the caller
  expires `volunteer_id`/`volunteer` rather than assigning them — assigning would make
  the ORM re-write the value it just wrote, unguarded.
- ⚠️ **Only the claim is protected this way.** Every other transition still reads
  `donation.status`, checks it in Python and writes. SQLite serialises those today; on
  PostgreSQL two concurrent transitions on one donation can still both succeed and
  append two events. Generalising the guard to `update_status` as a whole is real
  remaining work, tracked in `TASKS.md`, and was kept out of this change because it
  touches every lifecycle path rather than the one with a known defect.

---

## D-29 · Fulfilment is `is_active`, and the whole lifecycle is one PATCH **[documented]**

**Decision.** `PATCH /api/requirements/{id}` (`routers/organisations.update_requirement`)
is the only requirement-lifecycle operation. It revises fields, retires a requirement
(`isActive: false`) and reopens one (`isActive: true`). **There is no separate fulfilled
state and no `DELETE`.** Ownership is a term in the query — `_own_requirement_or_404`
matches on `Requirement.recipient_id == <caller's own recipient>.id` — so another
organisation's id answers 404.

**Reasoning.**

- **The model already had exactly one lifecycle flag**, `Requirement.is_active`, and
  `GET /api/requirements` already filtered on it. A `status` column distinguishing
  *fulfilled* from *withdrawn* would have meant a migration, a second state machine
  beside the donation one, and a second thing for the list filter to consider — to
  record a distinction nothing in the product reads. What both actions need is the same:
  the need leaves the board.
- **Retiring, not deleting.** The row is kept, so the demand a kitchen posted survives
  its own housekeeping and stays available to anything later derived from it. Deleting
  would also make the operation irreversible, and reopening is free once the flag is the
  only state.
- **One endpoint rather than PATCH + DELETE.** `is_active` is a field like the others,
  so a second route would be a second way to write the same column — the "competing
  lifecycle system" worth avoiding. `PATCH` also already matches `/recipients/me` and
  `/volunteers/me`, including their `model_dump(exclude_unset=True)` partial-update
  convention.
- **Role is not ownership.** `require_roles(ngo, admin)` mirrors `POST /requirements`,
  but passing it is not enough: the caller's own recipient row is resolved first and the
  requirement must belong to it. An administrator therefore reaches the same 422 on both
  routes — no admin account is linked to an organisation — which is existing behaviour,
  not new.
- **404, not 403,** for another organisation's requirement, following D-24: a status code
  that confirmed the id exists would leak what the scoping withholds.
- **`null` means "leave it alone".** No requirement column is nullable, so an explicit
  null cannot mean "clear this field"; it is skipped rather than written, which would
  otherwise be an IntegrityError surfacing as a 500.

**Constraints.**

- ⚠️ **A retired requirement has no reader.** `GET /api/requirements` returns active rows
  only and gained no `includeInactive` parameter, so the UI cannot list or reopen one —
  reopening is API-only. Preserving the read contract was the smaller change; a scoped
  parameter (an organisation's *own* inactive rows) is the shape to add if the history is
  ever wanted on screen.
- **Fulfilment is a UI word, not a stored one.** The NGO portal's "Mark fulfilled" and a
  need that simply lapsed produce the identical row. Anything that later needs to tell
  them apart needs a schema change, and this decision is what it would be revisiting.
- **No schema change:** `alembic check` reports no drift.
- Requirements still do not influence matching — `rank_recipients` has never read them,
  and this did not change that.

---

## D-30 · Two match scores, named apart: one frozen decision, one live offer **[documented]**

**Decision.** `DonationOut` carries **two** figures, and they answer different
questions. `matchScore` is the existing persisted `Donation.match_score` — frozen, the
same for every reader, about a *decision*: the top-ranked organisation at posting time,
overwritten with the accepting organisation's own score at acceptance. `viewerMatch` is
new, nullable, and about the *reader*: the calling organisation's own ranking against
this donation, computed now through `matching.score_pair`, present only for an `ngo`
caller with a recipient profile and only while the donation is still in
`OPEN_TO_RECIPIENTS`. Every NGO-facing surface that says "match" reads `viewerMatch`;
the frozen number stays, relabelled where it appears ("Match score at acceptance").

**Reasoning.**

- **The two were being shown as one.** The NGO list rendered `matchScore` under the
  label "% match" while the analysis panel beside it scored the reader's own pairing
  through `/matches`. Manual QA saw 94% and 64% for one donation and one kitchen. Both
  numbers were correct; neither answered the question the label asked.
- **Two independent causes, both real.** *Different subject* — `match_score` is written
  at creation from `rank_recipients(..., limit=1)`, so it describes whichever
  organisation ranked first, which is usually not the reader. *Different moment* —
  `deadline_score` is 15% of the sum and decays continuously, so a figure frozen at
  posting cannot track the pairing it described. `seed.py` added a third: it wrote a
  literal `94 - i*3` into the column, so the demo data's headline was never computed at
  all. That literal is gone; the seed now ranks through the same matcher the API uses.
- **Neither concept could be deleted.** The frozen score is what the donor was told and
  what the accepting kitchen decided on — re-scoring an accepted donation would slide as
  its pickup window closed and quietly rewrite the record. The live score is the only
  honest answer to "should we take this". So they are kept apart and named apart rather
  than collapsed.
- **Scored on the server, never in the browser.** `_viewer_match()` calls `score_pair`,
  the same function `rank_recipients` and therefore `/matches` funnel through. There is
  still exactly one implementation of the scoring, and D-05's swap point is unaffected.
- **The whole ranking travels, not just the total.** The list and the panel used to
  fetch two live scores independently; measured on the running app they disagreed by a
  point, because the deadline decayed between the two requests. Delivering the breakdown
  with the donation makes agreement a property of the payload rather than a coincidence
  of timing — the same reasoning as D-24's "one clause, both endpoints". The NGO screens
  no longer call `/matches` at all; `useMatchAnalysis` is now donor-side only and reports
  the leading match.
- **Null rather than a low number** when the reader is unverified, uncoordinated or out
  of radius, following D-06: `score_pair` gates instead of scoring, and the UI says the
  organisation cannot be scored rather than showing a stranger's ranking under its own
  heading.

**Constraints.**

- **Additive contract change**, no schema change (`alembic check` clean): `viewerMatch`
  is a new nullable field of the existing `MatchOut` shape, which had to move above
  `DonationOut` in `schemas.py`. Existing consumers of `matchScore` are unaffected.
- ⚠️ **`viewerMatch` is as fresh as the donation list.** `AppContext` fetches once and
  the screens read from that, so a page left open for an hour shows an hour-old score.
  That is the price of the two surfaces agreeing, and it is the right trade while
  nothing refreshes automatically — but the value is a *live* score, so anything that
  caches it for longer needs to say so.
- **Ranking cost is per donation now.** `GET /donations` runs `score_pair` once per row
  against the caller's own organisation — pure arithmetic on rows already loaded, plus
  one lookup of the caller's recipient for the whole page.
- The panel's static captions were removed alongside: "High Compatibility" is now derived
  from the score, and a hard-coded "95%+ Success Rate" badge that contradicted the real
  reliability figure beside it is gone.

---

## D-31 · A claim the interface makes is a claim the system must be able to honour **[documented]**

**Decision.** Interface text that states a present-tense capability is held to the same
standard as an API response: it must be true of the running system. A forward-looking
claim is allowed only when it is **labelled as one** at the point it appears. Where the
two conflict, the text changes — the fix for an unbuildable claim is to stop making it,
not to build it in a hurry. Established by the QA audit of 2026-09-02, which classified
twelve findings against this line; the resulting work is `TASKS.md` → *Backlog → I*.

**Reasoning.**

- **This project's product is its evidence.** The append-only ledger exists so metrics are
  attributable rather than self-reported (D-01); the matcher is a readable weighted sum so
  a score can be taken apart by hand (D-05); ineligibility is a gate returning `None`
  rather than a flattering low number (D-06); the frozen and live match scores were split
  and separately labelled precisely because one label over two numbers was indefensible
  (D-30). A screen reading "Live GPS tracking active" over a component with no GPS spends
  the credibility all four of those decisions were built to earn — and it spends it in
  front of exactly the audience they were built for.
- **The failure is asymmetric.** An honest interface over a modest system reads as an
  early-stage project. An interface that over-claims reads as one that cannot be trusted
  about the parts that *are* real — and the audit found that most of the backend is real.
  The invented numbers were doing active harm to true ones sitting beside them.
- **The worst form is a literal wearing a measurement's clothes.** `+ 1240` added to a real
  meal count, or `completed.length + 18`, is worse than a wholly fake number: it is
  unfalsifiable from the outside and it corrupts a figure that was correct. Ranked below
  those but still defects: standalone literals presented under a "real-time" or "verified"
  heading, and settings that accept input and discard it.
- **Labelling is a real remedy, not a loophole.** `components/FutureIntelligenceSection.tsx`
  describes a neural ranker, route optimisation and vision models the project has not
  built, and the audit passed it: every entry carries an explicit `phase` and `status`
  badge, and the section is titled as future work. Likewise `MatchAnalysis`'s "Rule-Based
  Model" chip beside its "AI Match Analysis" heading. The distinction that matters is not
  ambition versus modesty — it is whether a reader can tell which of the two they are
  looking at.
- **It keeps D-05 enforceable at the edge.** D-05 forbids describing the matcher as
  machine learning. That is a rule about the backend, and it held; the phrase "AI Scanning
  Active" over a table nothing scans is the same violation one layer out, where nobody was
  checking.

**Constraints.**

- **Scope: the interface, not the roadmap.** D-31 governs how a capability is described,
  never whether to build it. Requirement-aware matching, road distance, notification
  delivery and donor verification are all open questions in `TASKS.md` → *Blocked* and
  this decision deliberately does not answer any of them.
- ⚠️ **This is not a licence to delete features.** Where a real value exists and only the
  label is wrong — the frozen match score before D-30, `distanceKm` in the open pool today
  — the answer is to show the real value correctly, not to remove the surface.
- **Enforcement is mostly still a review habit.** There is no lint rule, and the frontend
  suite D-43 established covers the arithmetic behind these claims rather than the claims
  themselves — with one exception: `pages/__tests__/Landing.test.tsx` asserts the *absence*
  of the landing page's eight retired literals and of any "real time" wording, which is the
  first place D-31 is held mechanically. Everywhere else the check is manual: when a screen
  states a fact, the reviewer asks which row or function produced it. The audit is what a
  manual pass of that looks like, and it took one sitting. ⚠️ Neither gate runs in CI yet
  (`TASKS.md` → *Backlog → D*).
- **The seed data is inside the boundary.** `seed.py` writing a literal `94 - i * 3` into
  `match_score` is what put an invented number on screen next to a real one (D-30), and it
  now ranks through `rank_recipients` like the API does. Demo data that does not come from
  the real code path is a claim like any other.

---

## D-32 · Per-account impact is the account's own rows, not `/api/metrics` **[documented]**

**Decision.** Every donor / NGO / volunteer impact figure is computed by
`frontend/src/lib/impact.ts` from two sources and no others: the donations the API already
returned for that account, and the server-maintained counters on the account's own profile
row (`Volunteer.completed_deliveries`, `Recipient.accepted_donations` and the
`reliability_score` derived from it). Desktop and `/m/*` call the same function, so a
figure cannot differ between them. `GET /api/metrics` stays where it was — the admin
screens.

Three consequences follow, and they were the substance of I-1:

1. **Environmental equivalences were removed, not re-based.** `Donation.quantity` is a
   count in the donation's own `unit` (Meals, Kg, Boxes, Pieces), so a sum of it is not a
   mass and no per-kilogram factor can be applied to it. Desktop printed
   `completedMeals × 2.5` kg CO₂e and `× 85` litres of water; mobile printed
   `allListedMeals × 0.86`. Neither factor had a source and the inputs were not the same
   quantity. Picking a third would have made the two surfaces agree on a number that still
   meant nothing.
2. **Both "Download Impact Report" buttons were deleted.** They were `alert()` calls that
   produced no file. Whether a real export should exist is a live question in `TASKS.md` →
   *Blocked*, and its answer there is that a *verified* certificate should be rendered
   server-side from `status_events`. Building a client-side stand-in would have pre-empted
   that decision; leaving a button that lies was not an option.
3. **"Courier rating" is gone from every screen.** `Volunteer.rating` is a real column with
   a real stored value, but nothing in the API ever writes it — `VolunteerUpdate` excludes
   it by design, so every courier created through the app is permanently 5.0. A label
   reading "rating" asserts a feedback mechanism the system does not have, which is D-31's
   test, not D-30's.

**Reasoning.**

- **`/api/metrics` answers a different question.** It is ledger-derived and genuinely
  honest, but it is **platform-wide** — `total_meals` is every completed donation on
  FoodLink. A donor's impact page asks "what did *I* do", and pointing it at the platform
  total would have replaced invented numbers with real numbers that are not about the
  reader. Making it per-account would mean a scoped variant of the endpoint, which I-1 was
  explicitly not to build.
- **The donation list is already the right scope.** D-24's `_readable_by()` gives a donor
  exactly their own donations, an organisation the open pool plus its own, and a courier
  the unclaimed pool plus its own runs. The client does not have to filter for safety —
  the server did — so per-account arithmetic over that list reads only rows the account is
  entitled to.
- **One function is what makes desktop and mobile agree.** The two surfaces had drifted
  into different definitions of the same words: a courier's meal total counted `DELIVERED`
  on mobile and `COMPLETED` on desktop, and "kitchens served" meant matched on one screen
  and confirmed-received on the other. This is the shape of D-30 one layer up, and the
  remedy is the same — compute it once.
- **Where a server counter exists, it wins.** `completed_deliveries` is a lifetime tally;
  the donation list is only what this session loaded. `volunteerImpact()` prefers the
  counter and reports which source it used, so the subtitle can say so.

**Constraints.**

- ⚠️ **A list count and a lifetime counter are different numbers and must be labelled as
  such.** The NGO screens show both — "2 of 2 in your list" beside "42 acceptances on
  record" — because the seeded counters predate the loaded donations. Putting them under
  labels that read alike would recreate the contradiction this decision exists to remove.
- **`distanceKm` is great-circle, not road distance** (`matching.haversine_km`), and it is
  null until a donation has a recipient. Every screen showing it now says "straight-line".
  Whether road distance should exist is `TASKS.md` → *Blocked*; the routing claims
  elsewhere in the interface were closed by I-2 and are recorded in **D-33**.
- ✅ **The public landing page no longer fabricates** (Task 24, `HA-6`; working tree).
  `/api/metrics` requires authentication, so a pre-login page still cannot read a real
  total — and the resolution was to **stop asserting one** rather than to open the endpoint.
  The sections stayed and now describe *how* impact is counted; a substitute literal would
  have been the same defect at a lower volume. Where the underlying structure was honest and
  only the framing implied liveness — the page's sample match card, over the matcher's real
  five criteria — D-31's labelling remedy was used instead. Whether a **public** metrics
  endpoint should exist is unchanged by this and remains open and optional.
- **This is now tested.** D-43's suite covers `lib/impact.ts` directly (6 tests), so `tsc`
  is no longer the only automated gate. It is pure and takes plain arrays, which is why it
  was among the first modules the harness seeded.

---

## D-33 · One distance, named for what it is; no travel time at all **[documented]**

**Decision.** The interface shows exactly one kind of distance — the server's great-circle
kilometres from `matching.haversine_km` — and always says so. It shows **no travel time**.
Where a distance is unknown the screen says it is unknown rather than printing a plausible
number. Which of the two server-provided distances a screen uses is decided in one place,
`frontend/src/lib/geo.displayDistanceKm`, and nothing computes a distance in the browser.
This is D-31 applied to the routing and GPS claims, and it is what I-2 implemented.

**The selector.** Two distances can reach a donation and they answer different questions,
the same trap D-30 found with match scores:

| Field | What it measures | When it exists |
|---|---|---|
| `DonationOut.distanceKm` | donor pin → the **matched** kitchen | only once a recipient is bound (`serialize.donation_out()`) |
| `MatchOut.distanceKm` on `viewerMatch` | donor pin → the **calling** organisation's kitchen | only while that kitchen can still act on the donation (D-30) |

`displayDistanceKm` prefers the viewer's own figure and falls back to the matched one,
with **no third fallback**. An NGO browsing open listings is asking "how far is this from
us", and only `viewerMatch` answers it — which is also why this was not purely a wording
change: every NGO surface had been rendering `– km` (or silently falling back to a place
name) because it read `distanceKm` on donations that structurally never carry one.

**Reasoning.**

- **The claims were larger than the capability by a wide margin.** `MapPreview` captioned
  itself a "Redistribution Route Corridor", drew a hard-coded `~0.8 km` first leg and a
  `distanceKm - 0.8` second one, estimated travel as `distanceKm * 6 + 10` minutes, and
  footed the panel with "Live GPS tracking active in Phase 2" under a heading reading
  "Live Corridor Tracking". There is no routing provider, no geocoder, no map and no
  courier position anywhere in the repository — `navigator.geolocation` is called twice,
  both times to pin a donation at creation. Nothing in that panel except `distanceKm` was
  a measurement of anything.
- **Travel time was removed rather than corrected.** The frontend's 10 km/h contradicted
  the backend's 20 km/h, but fixing the constant would have been the wrong repair: the
  backend's figure is an input to `_deadline_score` and is **never serialised**, so the
  client has no travel estimate to display honestly. Inventing a better one in the browser
  would have been a second distance model — exactly what this decision forbids. The
  backend's constant is untouched; only the wording derived from it changed, so
  `reasons` now says "estimated collection time" rather than asserting a deadline
  "cannot be met".
- **An absent number is information.** `~2 km`, `?? 1.8`, `?? 2.4` and `?? '~2'` made an
  unmatched donation indistinguishable from a nearby one. "Distance unavailable" is
  shorter, true, and tells the reader something the invented number actively hid.
- **The diagram was worth keeping.** Pickup → courier → drop-off is the real shape of a
  handover and readers use it. What made it dishonest was the numbers pinned to it and the
  animation implying live telemetry, not the structure — so the schematic stayed, the
  per-leg distances went, and the footer states plainly that it is a schematic.

**Constraints.**

- ⚠️ **"Straight-line" has to survive future edits.** The wording is load-bearing, not
  decoration: `DISTANCE_HINT` in `lib/geo.ts` exists so the explanation is written once,
  and compact chips carry it as a `title` rather than repeating it inline.
- **This does not decide whether road distance should exist.** That is still `TASKS.md` →
  *Blocked* / `R-30`. I-2 only ensures the interface is honest under either answer; if
  routing is ever added, `displayDistanceKm` is the single place the meaning changes.
- **This is now tested.** D-43's suite covers `lib/geo.ts` (4 tests), including a mutation
  check that inverting the precedence below passes `tsc` and fails the suite. `tsc` is no
  longer the only automated gate.

---

## D-34 · A lifecycle write on a donation that is already somebody's is scoped by the read scope **[documented]**

**Decision.** `POST /api/donations/{id}/status` re-resolves the donation through
`_get_readable_or_404` — the same scope D-24 gives the read endpoints — for the targets
in `donations.OWNED_TRANSITIONS`: `PICKED_UP`, `DELIVERED`, `COMPLETED`, `CANCELLED`. An
actor holding the right role but outside that scope gets the read path's
`404 Donation not found`. `ACCEPTED` and `VOLUNTEER_ASSIGNED` keep the unscoped lookup.

**Reasoning.**

- **The role gate was the only gate.** `TRANSITION_ROLES` says *what kind* of actor may
  drive a target, and for these four that was all `update_status` checked: any volunteer
  account could collect and deliver a pickup assigned to a different courier, any NGO
  account could confirm receipt of a donation its organisation never accepted — writing
  another organisation's `completed_donations` counter, which the platform reports as
  evidence — and any donor could withdraw another donor's donation out from under the
  kitchen and courier already working on it. Reproduced through the HTTP endpoint before
  the fix: four `200`s where a `404` belongs.
- **`CANCELLED` looked guarded and was not.** `update_status` computed
  `is_owning_donor = user.role is donor and donation.donor_id == user.id` and consulted it
  only as `user.role not in allowed_roles and not (target is CANCELLED and
  is_owning_donor)` — but `donor` is itself in `TRANSITION_ROLES[CANCELLED]`, so the left
  operand was already false for every donor and the ownership comparison was unreachable.
  A named variable and a header comment claiming "the donor who owns a donation … may
  always cancel" described a test that never ran; that is what let the hole survive a read
  of the function. The clause and the variable are **deleted** rather than repaired:
  ownership now has one home, and a second copy beside the role gate is the drift D-24 was
  written to prevent. Removing it changes no answer — an `ngo` or `volunteer` targeting
  `CANCELLED` still fails the role gate with the same 403.
- **Reuse the clause; do not restate it.** `_readable_by` already evaluates to exactly the
  party each of these transitions belongs to: "the donations they posted" for a donor, and
  — since a donation past `ACCEPTED` has left the open pool — "the courier assigned to it"
  for a volunteer and "the organisation that accepted it" for an NGO. Writing a second
  ownership test beside it would be two encodings of one rule, free to drift — the failure
  D-24 was written to prevent between the list and the id lookup.
- **404, not 403,** for the same reason as D-24 and D-29: a 403 on a real id would confirm
  the donation exists. A write is not a reason to answer what a read would withhold.
- **A set, not a condition per branch.** The transitions that need this are data
  (`OWNED_TRANSITIONS`) beside `TRANSITION_ROLES` and `ALLOWED_TRANSITIONS`, so the
  lifecycle rules stay readable in one place.
- **The open transitions stay open, deliberately.** `ACCEPTED` and `VOLUNTEER_ASSIGNED`
  act on a donation nobody is bound to yet — scoping them would forbid the very act of
  binding — and each already resolves its own party: acceptance to the caller's own
  organisation, the claim to the conditional UPDATE of D-28.
  ⚠️ **Half of this bullet was wrong and is superseded by D-35.** `ACCEPTED` is not
  always a binding step: it is also reachable from `VOLUNTEER_ASSIGNED`, where the
  donation is already an organisation's and the transition is a *release*. Reasoning
  about the target alone, as this bullet does, cannot see that; `VOLUNTEER_ASSIGNED`
  is unaffected and stays unscoped for the reason given here.
- **Withdrawal is not narrowed to the early states.** `CANCELLED` stays legal from every
  state `ALLOWED_TRANSITIONS` already permits, including `VOLUNTEER_ASSIGNED` and
  `PICKED_UP`; the scope changes *whose* donation a donor may withdraw, not *when*.
- **Administrators are unaffected.** Their scope is `None`; the stand-in path support
  staff rely on is not narrowed, and a test asserts it.

**Constraints.** It costs one extra `SELECT` on those three transitions — the same row,
re-read under the scope. Rejected alternative: scoping the *first* lookup for these
targets, which would answer 404 before the transition table's 409 and change the existing
answer for legal-role/illegal-state attempts; the scope is therefore applied after the
`ALLOWED_TRANSITIONS` and `TRANSITION_ROLES` gates, so only the ownership outcome changes.

**Scope.** This covers `POST /api/donations/{id}/status` and nothing else. `ACCEPTED` and
`VOLUNTEER_ASSIGNED` are reasoned about above and left unscoped on purpose; no other
endpoint, router or authorisation path was examined as part of it. The `ACCEPTED` half of
that judgement did not survive the audit in D-35.

---

## D-35 · `ACCEPTED` needs ownership too, but only once the donation has left the pool **[documented]**

**Decision.** The ownership gate in `update_status` is no longer a set membership test on
the target. `donations._needs_ownership(donation, target)` returns true for everything in
`OWNED_TRANSITIONS` — unchanged — **and** for `ACCEPTED` when `donation.status` is not in
`OPEN_TO_RECIPIENTS`. The single reachable case is `VOLUNTEER_ASSIGNED → ACCEPTED`, which
now resolves through `_get_readable_or_404` like the other owned transitions and answers
the read path's 404 to anyone else. `OWNED_TRANSITIONS`, `TRANSITION_ROLES`,
`ALLOWED_TRANSITIONS`, the courier claim and every existing response are unchanged.

**Reasoning.**

- **It was an organisation-takeover hole, found by auditing the state graph rather than
  the target table.** Enumerating every edge in `ALLOWED_TRANSITIONS` against
  `TRANSITION_ROLES` and `OWNED_TRANSITIONS` showed three edges acting on an
  already-bound donation with no ownership gate. Two are sound: `ACCEPTED → EXPIRED` is
  admin-only, and `ACCEPTED → VOLUNTEER_ASSIGNED` is settled by the conditional UPDATE of
  D-28. The third, `VOLUNTEER_ASSIGNED → ACCEPTED`, was not. Reproduced through the HTTP
  endpoint before the fix: an unrelated verified kitchen `POST`s `{"status":"ACCEPTED"}`
  on a donation another kitchen accepted and a courier is already carrying, and the
  acceptance side effect runs to completion — `recipient_id` moves to the caller, its
  `accepted_donations` is incremented and `match_score` is re-frozen against it. The
  attacker then owns the donation for every later gate, `COMPLETED` included. The same
  account gets a **404 on the plain read** of that donation, so the write granted what the
  read refused — exactly the asymmetry D-34 was written to close.
- **The target does not carry enough information; the state does.** D-34 reasoned
  "`ACCEPTED` binds a party, so scoping it would forbid binding", which is true from
  `AVAILABLE`/`MATCHED` and false from `VOLUNTEER_ASSIGNED`, where the organisation was
  settled at the first acceptance and no offer is outstanding. A set keyed by target
  cannot express a rule whose answer depends on the state the donation is in, which is why
  this is a predicate and not a second set.
- **`OPEN_TO_RECIPIENTS` is the honest test of "still anybody's".** It is already the
  definition of the pool every organisation may consider, and already the NGO half of
  `_readable_by`. Reusing it keeps one definition of openness instead of a new list of
  states that could drift from the read scope.
- **`VOLUNTEER_ASSIGNED` is deliberately left alone.** Scoping it would replace
  `_claim_pickup`'s `409 Another courier has already claimed this pickup` with a 404 on
  the released-pickup path, changing a tested answer to fix nothing: the conditional
  UPDATE already refuses a stranger courier atomically (D-28).
- **The legitimate release is untouched**, because the scope names the owner rather than
  the act — the accepting kitchen reads its own donation whatever state it is in — and the
  administrator stand-in path is unnarrowed. Both are asserted.

**Constraints.** One extra `SELECT` on one further transition. The audit that produced
this was bounded to `POST /api/donations/{id}/status`; every edge of the donation state
graph is now accounted for, and the conclusion is recorded in `ARCHITECTURE.md`.

**Also found, not changed.** `MATCHED → AVAILABLE` is legal in `ALLOWED_TRANSITIONS` but
has no `TRANSITION_ROLES` entry, so `.get(target, set())` refuses it 403 for every role
including admin — a dead edge, failing closed. It is a lifecycle-modelling question, not a
security one, and is left for the Project Manager rather than resolved here.

✅ **The release this decision authorizes now works — fixed by D-41** (Task 21,
`e7032ea`). What was wrong, and why the audit that produced this decision could not have
seen it: The residue recorded here — "a release followed by a
re-acceptance increments the owning organisation's `accepted_donations` a second time and
leaves `volunteer_id` set" — understated its own consequence. **Nothing clears
`volunteer_id`**, so a released pickup is invisible to every other courier
(`_readable_by` requires `volunteer_id IS NULL`), unclaimable by them (`_claim_pickup`
answers `409 Another courier has already claimed this pickup`, which is false), and
re-runs the acceptance side effect, so the kitchen's `reliability_score` **falls as a
penalty for releasing**. All three reproduced on 2026-09-05. This is not a hole in the
authorization reasoning above, which is sound and was re-verified: the audit that produced
D-35 was bounded to *who may drive an edge*, and this is *what the edge does afterwards* —
which is exactly the class of defect a scope like that cannot see. Fix tracked as
D-41; no reasoning in this decision changes, and its tests still pass unmodified.

---

## D-36 · A dead toggle is removed, not disabled **[documented]**

**Decision.** The ten notification preference toggles across the four profile screens are
**deleted**, not relabelled, greyed out or badged "coming soon". Surrounding text that
asserted a delivery event — a kitchen being notified, an organisation being told, a
courier receiving a dispatch alert, a pickup being *offered* to a courier — is reworded to
what the system does. `is_available` is untouched. This is D-31 applied to notifications
(the QA audit's observation 5, tracked as I-4); nothing about it is a new principle.

**Reasoning.**

- **There is nothing to wire to, and this was checked rather than assumed.** The backend
  contains no occurrence of `notif`, `sms`, `smtp`, `twilio`, `sendgrid`, `fcm` or
  `websocket`; the only `email` is a login identity. There is no table, no provider, no
  queue and no worker. The toggles were `useState` that reset on remount.
- **Removed rather than disabled, because they were never settings.** A disabled control
  still says "this preference exists and will work later" — a roadmap commitment the
  project has not made, and one D-31 permits only where a phase label appears at the point
  of the claim. `FutureIntelligenceSection` earns its `SMS`/`dispatch` mentions that way
  (`status: 'Planned'`, `phase: 'Phase 2'`) and is deliberately left alone; a lone greyed
  checkbox on a settings screen carries no such frame. The desktop donor's pair was the
  worst case, because the form's own submit button then answered *"Profile saved."*
- **The adjacent prose mattered more than the controls.** A toggle a user never touches
  claims less than a receipt screen reading *"Kitchen notified · awaiting accept"*, which
  states that a message was delivered as a completed step. Those four were reworded rather
  than deleted, because each sits beside something real — a donation was listed, a match
  was scored, a duty flag was saved.
- **The availability toasts were the subtle case.** `is_available` genuinely persists
  through `PATCH /volunteers/me` and appears on the courier roster, so the *control* is
  real — but nothing dispatches on it. Every courier still sees the same unclaimed
  `ACCEPTED` pool whatever the flag says (`donations._readable_by`), so *"New pickups will
  not be offered to you"* was false in a way that could cost a courier work they thought
  they had declined. The wording now describes what the flag actually is: a status other
  organisations can see.

**Constraints.** No backend file changed; no schema, migration, endpoint or API contract.
Nothing was substituted for the removed state — no `localStorage`, no mock feed, no
simulated delivery — because a preference that persists but still reaches nothing is the
same false claim with a longer lifetime.

**Scope.** The four profile screens and the two donation-creation surfaces. Real
notification delivery remains unbuilt and unscheduled (`TASKS.md` `R-28`).

---

## D-37 · One verification boolean, one meaning, one entity **[documented]**

**Decision.** `Recipient.is_verified` means exactly *"a FoodLink administrator vouched that
this organisation is real and is where it claims to be."* The interface may say "verified"
of a **recipient organisation** and of no other entity, must render it from the field
rather than unconditionally, and may not restate it as certification, compliance, hygiene
or institutional validation. The fabricated donor claims are removed; the genuine recipient
ones are kept as they were. This is D-31 applied to trust language (QA observation 6,
tracked as I-5).

**Reasoning.**

- **The semantics come from the code, not the name.** `verify_recipient`'s own docstring
  defines it as a human judgement that a kitchen is real and located where it says.
  Nothing in the repository connects it to FSSAI, hygiene, licensing or any external
  body — there is no such field, provider, upload path or evidence store. Two consumers
  read it and both are about eligibility, not quality: `matching.score_pair` will not rank
  an unverified organisation, and the `ACCEPTED` transition will not let one take custody.
- **It is scoped to one entity, so the badge is too.** `is_verified` lives on `Recipient`.
  There is no donor and no volunteer verification in the model at all, which made
  *"Verified Institutional Donor"* — rendered unconditionally, so a self-registered account
  one minute old wore it — a claim with nothing behind it on both the desktop and mobile
  donor profiles.
- **"FSSAI Hygiene Standards Compliant" was the more serious of the two**, because it
  names a real Indian food-safety authority and asserted that *"This kitchen conforms"*.
  The platform performs no inspection of any kind. The **handling advice** in that panel is
  worth keeping, so it is reframed as guidance addressed to the donor rather than a finding
  the platform has made about them, and now says plainly that FoodLink does not inspect
  kitchens or assess hygiene.
- **The shield icon was half the claim.** A `ShieldCheck` in a green pill reads as a seal
  whatever the words beside it say, so the donor chip carries a neutral `Building2` and
  grey styling; the compliance panel's tick becomes an `Info`. Nothing else about the
  layout changed.
- **A missing value is not a verification.** `VolunteerHistory` printed *"Verified
  Delivery"* as the fallback when `deliveredAt` was null — inventing a trust claim out of
  absent data. It now says "Not recorded".
- **Seed data was left alone.** The three demo kitchens carry `is_verified=True`, which is
  an accurate representation of the field: an administrator vouched for them. Removing it
  would misrepresent the model rather than correct it, and no fake record was added.

**Constraints.** No backend, schema, migration, endpoint or seed change; no verification
provider, no upload workflow, no hardcoded boolean introduced to light a badge. Donor
verification is not proposed — building it is a far larger piece of work than making the
claim honest.

**Scope.** Trust, verification and compliance wording only. The recipient verification
flow itself — registration default, the admin toggle, the two hard gates — is unchanged and
was verified working in both states.

---

## D-38 · Lifecycle status decides the state shown; a courier's name is only assignment **[documented]**

**Decision.** On the NGO accepted-donations screen the courier/dispatch line is chosen by
the donation's `status`, never by whether `volunteerName` is populated. The name is
assignment information — *who is carrying, or carried, this food* — and is shown in every
status that binds a courier, `COMPLETED` included; the *state* beside it comes from the
status alone. This is D-31 applied to lifecycle display (QA observation 9, tracked as I-6);
no new status was introduced to express it.

**Reasoning.**

- **A courier stays attached to the record after the handover.** `volunteer_id` is written
  by `_claim_pickup` and no transition clears it, so it is populated for the whole of
  `PICKED_UP → DELIVERED → COMPLETED`. Reading it as "a courier is on the road" made a
  finished delivery describe itself in the present tense on a screen whose list includes
  `COMPLETED`.
- **The field is not even proof of a *current* assignment.** `ALLOWED_TRANSITIONS` permits
  `VOLUNTEER_ASSIGNED → ACCEPTED`, and that release leaves `volunteer_id` in place, so an
  `ACCEPTED` donation can name a courier who is no longer carrying it while the pickup is
  back in the open pool. Status is the only authority for either reading.
- **Shaped like the badge it sits beside.** `COURIER_STAGE` is a total
  `Record<DonationStatus, …>`, the same shape as `StatusBadge`'s `STATUS_CONFIG`, so a new
  lifecycle state is a compile error rather than a silently wrong caption.
- **The name is kept, because losing it would lose a real fact.** A completed donation
  showing *"Delivered — receipt confirmed"* still names the courier, and the handover
  schematic still labels its courier node with them. The fix removes a false state claim,
  not the assignment record.

**Constraints.** No backend, schema, migration or lifecycle change; no new status; no
courier-assignment logic touched. The captions are display strings only — nothing reads
them back.

**Scope.** `frontend/src/pages/ngo/NGOAcceptedDonations.tsx`. The donor's equivalent block
(`pages/donor/DonationDetails.tsx`) and `mobile/NGOAccepted.tsx` print the courier's name
with no state claim attached, so neither carries the defect and neither was changed.

---

## D-39 · A passed deadline is annotated, never enforced **[documented]**

**Decision.** `StatusTimeline` marks the current step **Overdue** when the pickup deadline
has passed and the donation is in one of the four statuses where the food has not been
collected — `AVAILABLE`, `MATCHED`, `ACCEPTED`, `VOLUNTEER_ASSIGNED`. It is an annotation
on the status the server reported, never a substitute for it: no lifecycle state is
invented, nothing is expired client-side, and the row keeps saying what it is. This is
D-31 applied to time (QA observation 7, tracked as I-7).

**Reasoning.**

- **The reading was incomplete, not wrong.** A donation whose window closed hours ago
  genuinely *is* still `MATCHED` — the expiry sweep is unbuilt and unscheduled
  (`TASKS.md` → *Backlog → E*), so `EXPIRED` is a state an administrator reaches, not one
  time reaches on its own. Printing "Matched · Current" was accurate; printing it with no
  mention of the deadline was the defect, and only on the detail view — the list and card
  surfaces already read `deadlineStatus()`.
- **The client must not expire anything.** Deriving `EXPIRED` in the browser would put the
  lifecycle in two places and let one screen disagree with the ledger, which is the whole
  reason transitions are server-stamped (D-01). The marker changes what is *said*, never
  what the donation *is*.
- **Overdue stops at collection.** After `PICKED_UP` the deadline has been answered — the
  food left the donor — so a completed donation is never flagged, however far in the past
  its pickup window sits. That is D-38's rule one field along: a value that outlives the
  moment it described is not current state.
- **It reuses what already computes this.** `lib/time.deadlineStatus()` and
  `URGENCY_STYLES.expired` already decide and colour "Overdue" everywhere else, and the
  component already receives the whole donation — so the timeline calls the same helper
  rather than taking a new prop, and none of its three call sites changed.

**Constraints.** No backend, schema, migration or lifecycle change; no new
`DonationStatus`; no timer or interval — the marker is computed at render, exactly like
every other deadline surface, so it appears on the next render after the deadline passes.

**Scope.** `frontend/src/components/StatusTimeline.tsx`, and therefore the three detail
views that render it. The `CANCELLED` and `EXPIRED` panels are unchanged.

---

## D-40 · An account can read the contact details it is allowed to write **[documented]**

**Decision.** `UserOut` carries `phone`. A field the holder may set — at registration
through `RegisterRequest`, and afterwards through `ProfileUpdate` — must be readable by
that holder, or the interface is asked to display something it cannot obtain. This closes
a write-only field rather than opening a new one; no endpoint, permission or column
changed.

**Reasoning.**

- **Write-only was the actual defect behind I-9.** `User.phone` has always been real
  column data and the donor profile form already sent it on save, but the only schema an
  account receives about *itself* left it out. So the number could be saved and never seen
  again, and the form's `phone: ''` was the only value available to it. The audit read that
  empty string as a lazy default in the component; it was a gap in the response.
- **It widens nobody else's contact data.** `UserOut` appears in exactly five places, all
  in `routers/auth.py`, and every one describes the caller's own account: register, login,
  `GET /me`, `PATCH /me`, `POST /password`. Other people's numbers are reached only through
  the admin-only `UserAdminOut` and through `RecipientOut`, whose scoping was closed
  separately (S-2). Adding the field here therefore has no read-scope consequence — which
  is why it was checked before the line was written rather than after.
- **The alternative was worse.** Leaving the response alone would have meant either a form
  that silently discards what it shows, or a second request to some other endpoint to
  recover a value the account had just sent. Both cost more than one optional field.
- **A donor still has no profile row, and none was invented.** NGOs have `Recipient`,
  couriers have `Volunteer`, donors have neither, and no user-level location column exists.
  The donor form's *Default Pickup Address* and *Operating Hours* consequently stay local
  and empty; giving them a home is a modelling decision the project has not made.

**Constraints.** No new endpoint, no schema table change, no migration — `phone` was
already on `users`. `ProfileUpdate` is unchanged, so what an account may *write* about
itself is exactly what it was. `UserAdminOut` still declares `phone` itself; the
redeclaration is now redundant but harmless, and was left rather than reordering an
admin response for cosmetics.

**Scope.** `schemas.UserOut`, its three frontend mirrors (`ApiUser`, `User`,
`adapters.toUser`) and the donor profile form's initialiser. `pages/donor/DonorProfile.tsx`
is the only screen that edits the field; `mobile/DonorProfile.tsx` lists the email only.

---

## D-41 · Couriers are read through the donation that connects them, and a release is not an acceptance **[documented]**

**Decision.** Two corrections that share one idea — *the relationship a row already carries
is the authority, not the role the caller holds and not the field that happens to be
populated.*

1. **`GET /api/volunteers` is scoped, not merely role-gated.**
   `routers/organisations._visible_volunteers(user)` returns the caller's scope as a WHERE
   clause: `None` for an administrator, the couriers on this organisation's **own**
   donations for an `ngo`, `false()` for anyone else. The route keeps
   `require_roles(admin, ngo)`.
2. **`ACCEPTED` reached from `VOLUNTEER_ASSIGNED` clears `volunteer_id`, and does not
   re-run the acceptance side effects when the donation is already bound to the accepting
   organisation.** `donations.update_status` gates `accepted_donations += 1` and the
   `match_score` re-freeze on `donation.recipient_id != recipient.id`.

**Reasoning.**

- **A role a stranger can self-assign is not an authorization boundary.** `VolunteerOut`
  carries a courier's phone number, and `ngo` is in `SELF_SIGNUP_ROLES`, so the roster cost
  one registration and a throwaway email address. `is_verified` does not help: it gates
  ranking (`score_pair`) and custody (the `ACCEPTED` transition), deliberately, and never
  reads. D-26 scoped `RecipientOut` for exactly this reason and cited this endpoint's own
  docstring while doing it; this is that decision finished.
- **The donation row already expresses "which couriers is this kitchen entitled to?"**
  `Donation.recipient_id` and `Donation.volunteer_id` are both on the same row, so the scope
  is a subquery and needed **no new relationship, column or migration**. Scoping through the
  donation also gives the right answer over time on its own: the courier stays visible after
  `COMPLETED`, because a finished donation is still this kitchen's record of who carried its
  food, and disappears for a kitchen that never had a donation at all.
- **Scoped rather than redacted.** Dropping `phone` from a non-admin response was the
  cheaper option and was rejected: a kitchen expecting a handover has a real reason to
  reach the courier bringing it, and a redacted field would have left the *existence* of
  every courier readable anyway. Narrowing the set answers both.
- **A clause, not a second `require_roles`.** The `ngo` scope is per-row, so a role gate
  cannot express it — D-24's shape, applied to a third table. The map fails closed: a role
  added later reads nothing until it is given a scope here.
- **`ACCEPTED` means two different things, and D-35 already knew it.** D-35 made the
  *authorization* depend on the source state — binding from the open pool, releasing from
  `VOLUNTEER_ASSIGNED`. The side effects were never given the same treatment, so the
  release ran the acceptance path: it bound a recipient that was already bound, counted a
  second acceptance, re-froze the score, and left the courier attached. Clearing
  `volunteer_id` is the missing half of the transition D-35 authorized.
- **The counter had a consequence, not just a wrong value.** `accepted_donations` is the
  denominator of `Recipient.reliability_score`, which is 15% of the match weight — so
  counting a release as an acceptance made a kitchen's own ranking fall as a penalty for
  releasing a courier. That is the reason this is a correctness fix rather than tidiness.
- **`match_score` is not re-frozen on a release**, because D-30 defines it as the number
  the accepting organisation actually decided on. Re-freezing would slide it as the
  deadline decayed, every time a pickup changed hands — quietly rewriting the record the
  field exists to preserve.
- **Idempotence is keyed on the binding, not on the source state.** The test is
  `donation.recipient_id == recipient.id`, so an administrator re-accepting on behalf of a
  *different* organisation is still a rebind and still counts. That keeps the stand-in path
  meaningful rather than making every second `ACCEPTED` free.

**Constraints.**

- **No schema change, no migration, no new endpoint, no response-shape change**;
  `alembic check` reports no drift. `ALLOWED_TRANSITIONS`, `TRANSITION_ROLES`,
  `OWNED_TRANSITIONS`, `_needs_ownership`, `_readable_by` and `_claim_pickup` are all
  untouched, and every D-24/D-34/D-35 answer is unchanged and still asserted.
- **No frontend change was required**, because no NGO screen renders the roster —
  `AdminVolunteers` (desktop and mobile) is its only consumer, and `AppContext.load()`
  simply receives a shorter list.
- ⚠️ **Only the accepting organisation or an administrator can release.**
  `TRANSITION_ROLES[ACCEPTED]` is `{ngo, admin}`, so a courier cannot hand back its own
  pickup — existing behaviour, deliberately not changed here, and a product question rather
  than a defect.
- ⚠️ **An old test asserted the defect and was rewritten, not deleted.**
  `test_courier_claim.py` reached `_claim_pickup`'s already-claimed guard *through* the
  unreleased release, describing the bug in its own docstring as the mechanism. `ACCEPTED`
  with a courier still bound is now unreachable through the API, so that branch is
  reachable only as a race — which the three file-backed two-transaction tests in the same
  module already cover, and which is the honest way to reach it.
- **A rebind still leaves the previous organisation's counter alone.** Pre-existing
  behaviour on the administrator path, unchanged and out of scope here.

**Scope.** `routers/organisations.list_volunteers` and the `ACCEPTED` branch of
`routers/donations.update_status`. Separately in the same change, `DonationCreate.image_url`
gained `max_length=schemas.MAX_IMAGE_URL_LENGTH` (256 KiB) — a bound at the request
boundary, published in the OpenAPI document like D-04's admin restriction, with the column
left as `Text` so no migration is needed. That is a constraint rather than a decision; the
real fix is object storage (`TASKS.md` → *Backlog → F*), and until then an unresized phone
photo is a 422.

---

## D-42 · Only meals are compared with capacity, and the second size criterion is absolute **[documented]**

**Decision.** Two corrections inside `matching.py`, no weight changed and no schema touched.

1. **`Recipient.capacity` counts meals, and only a donation counted in meals is compared
   with it.** `matching.CAPACITY_UNIT = "Meals"` names what the product already fixed;
   `is_comparable_unit()` accepts that unit alone. For any other unit both size criteria
   return `UNASSESSED_SIZE_SCORE` (50) and `reasons` states that the size was not assessed.
   **Nothing is converted.**
2. **`_capacity_score` measures absolute spare meals, not the fill ratio.** Spare capacity
   after the donation, saturating at `FULL_HEADROOM_MEALS` (100). `_quantity_score` is
   unchanged and remains the ratio.

**Reasoning.**

- **The unit was being ignored, and the numbers do not line up.** `Donation.quantity` is a
  count in `Donation.unit`; `Recipient.capacity` is meals per day. Comparing them directly
  scored 100 Kg exactly as 100 Meals, and 5 Boxes as a rounding error against a 100-meal
  kitchen. The prose was the same defect out loud: *"Donation exceeds stated capacity by
  150 kg"*, against a capacity counted in meals.
- **Capacity's unit was already decided; it was simply never written down.** Three places
  agree — the NGO profile's "Max Batch Capacity (Meals)", the mobile profile's "*n* meals",
  and `frontend/src/types/index.ts` ("max meals they can handle"). `CAPACITY_UNIT` records
  that rather than adding a `capacity_unit` column to restate it. **No migration.**
- **No conversion was invented, because the repository holds nothing to convert with.**
  There is no mass or portion field on a donation, no per-category yield table, no
  configuration. "One box is *n* meals" would be a fabricated constant inside the one number
  the platform invites people to check by hand (D-05), and it would be wrong per category —
  a box of bread rolls and a box of rice are not the same meal count. `lib/impact.ts`
  reached the identical conclusion for display totals and says so; this is that principle
  applied to the score.
- **Unassessed, not ineligible — a deliberate departure from D-06.** D-06 gates rather than
  scores when a *pairing* is not actionable. An unfamiliar unit is not a fact about the
  pairing: gating would mean a donation in kilograms matched **nobody**, and the seed data
  itself posts in Kg and Boxes. Instead the criterion abstains.
- **Abstaining is safe precisely because the unit belongs to the donation.** Every candidate
  receives the identical value for the same donation, so the two criteria cancel out of the
  comparison and cannot reorder anything. Ranking falls to distance, deadline and
  reliability — the criteria that remain meaningful — and the reader is told which question
  went unanswered rather than being handed a confident 50.
- **Strict rather than clever about unrecognised units.** The match is exact after trimming
  and case-folding. A unit added later is unassessed until someone decides what it means,
  which fails toward saying less rather than measuring wrongly.
- **The two size criteria were one criterion counted twice.** Both were monotone in
  `r = quantity / capacity` in opposite directions, and over the feasible range
  `capacity_score` was an exact affine function of `quantity_score`. Their combined
  contribution was `0.25(40 + 60r) + 0.20(100 − 50r) = 30 + 5r`: **45% of the published
  weight carrying five points of signal**, presented in the explainability panel as two
  independent bars.
- **Absolute headroom is the information the ratio discards.** `(quantity, capacity)` is
  two-dimensional and `r` is one; any scale-free function of the pair collapses back into
  `r`, so breaking the collinearity *requires* an absolute term. A 1000-meal kitchen taking
  500 and a 100-meal kitchen taking 50 fit equally well and are not equally free afterwards
  — one can still take another 500 meals today, the other 50.
- **`FULL_HEADROOM_MEALS = 100` is a named saturation constant, in the shape the module
  already uses.** `_deadline_score` saturates at two hours of slack for the same reason.
  It is anchored on the default `Recipient.capacity`, so "a full day's room still free"
  means a default-sized kitchen's entire service.
- **The result is a better ranking, not just a better-behaved formula.** How each criterion
  moves as candidate capacity grows, for a fixed donation `q`:

  | | `capacity < q` | `capacity = q` | `q < capacity < q + 100` | `capacity >= q + 100` |
  |---|---|---|---|---|
  | fit | rises out of the overflow penalty | peaks at 100 | falls | falls toward 40 |
  | headroom | 0 (does not fit) | 0 | rises 1 point per spare meal | saturated at 100 |

  So **among kitchens the donation fits**, fit alone prefers the smallest and headroom alone
  the largest — below that point fit falls away too, under the overflow penalty. Together
  they peak at `capacity = q + FULL_HEADROOM_MEALS`: the kitchen that takes the donation
  comfortably *and* still keeps a full day's room. That maximum is **global and interior** —
  the contribution is lower for smaller kitchens and, asymptotically, for arbitrarily large
  ones — and a criterion counted twice cannot put a maximum anywhere but a boundary, which
  is exactly where the old pair's sat (`c = q`). On the seeded kitchens, 50 meals now ranks
  Helping Hands (capacity 150) first on the strength of its headroom despite the *lowest*
  fit score of the three.
- ⚠️ **The combined curve is not single-peaked, and that was overstated when this decision
  was first written.** Between the exact-fit point and the saturation point the two criteria
  cross, leaving a shallow **local minimum** — so a kitchen slightly larger than the donation
  scores marginally below one sized exactly to it (for `q = 50`: 25.00 at `c = 50`, dipping
  to 24.40 near `c = 62`, then climbing to 35.00 at `c = 150`). The global maximum is
  unaffected and the criteria are still independent; this is an artefact of two honest
  criteria crossing, not a defect to design around, and it is recorded so nobody reads the
  peak as a clean unimodal curve.
- **Discrimination, stated defensibly.** Over feasible capacities for a fixed donation the
  old pair spanned **exactly 5.00 points** — `0.25(40 + 60r) + 0.20(100 - 50r) = 30 + 5r`,
  independent of donation size — and moved monotonically, so its best candidate was always
  the boundary. The new pair spans more, and by how much depends on donation size: roughly
  **10.6 to 17.5 points for donations of 20 to 500 meals**. ⚠️ An earlier draft quoted
  "10.5 versus 3.75"; those numbers are specific to one sample of candidate kitchens and are
  **not** general bounds — over the unrestricted domain both implementations span 0 to 35.
- **The weights were deliberately not touched.** Correcting what a criterion measures had to
  come before deciding how much it counts; tuning collinear criteria is tuning noise. `R-31`
  is now unblocked and is a separate piece of work.

**Constraints.**

- **No schema change, no migration** (`alembic check` clean), **no API shape change** — the
  explanation travels in the existing `reasons` list, which exists so a score is never a
  bare number, so no field was added and no frontend mirror had to move.
- **No frontend change.** Both `MatchAnalysis` captions stay accurate; *"Capacity the kitchen
  still has spare after taking this donation"* (written for I-8) now describes the
  implementation more exactly than it did when it was written.
- ⚠️ **For a single kitchen the two criteria still move in opposite directions** as the
  donation grows. That is the intended trade-off, not residual collinearity: what was wrong
  was that the opposition was exactly proportional at every scale, so the pair cancelled
  everywhere rather than only along that one axis.
- ⚠️ **A donation in Kg, Boxes or Pieces is now ranked on three criteria rather than five.**
  That is an honest reduction, not a regression — but it means the platform's headline score
  is less discriminating for those donations, and the way to change it is a real unit model,
  not a conversion constant.
- **`Donation.unit` is still unvalidated on the wire.** Anything a client sends is stored;
  the matcher simply declines to interpret it. Constraining the column to the four the
  picker offers is a separate change and was not made here.

**Scope.** `matching.py` only: `CAPACITY_UNIT`, `UNASSESSED_SIZE_SCORE`,
`FULL_HEADROOM_MEALS`, `is_comparable_unit()`, `_capacity_score()`, and the unit branch plus
`reasons` in `score_pair()`. `_quantity_score`, `_distance_score`, `_deadline_score`,
`reliability_score`, `WEIGHTS`, the three hard gates, `rank_recipients` and every caller are
unchanged. Requirement-aware matching (`R-35`) is untouched and remains a *Blocked*
question.

---

## D-43 · The frontend test runner is the frontend build tool **[documented]**

**Decision.** Frontend tests run on **Vitest 3.2 + Testing Library**, configured as a
`test` block inside the existing `frontend/vite.config.ts` rather than in a config of
their own. Four devDependencies: `vitest`, `jsdom`, `@testing-library/react`,
`@testing-library/dom`. `npm test` → `vitest run`; `npm run test:watch` → `vitest`.

**Reason.** The runner has to resolve modules the way the build does, or a green suite
stops meaning anything. Sharing `vite.config.ts` gets that by construction — one plugin
pipeline, one resolver, one set of aliases — instead of maintaining a second description
of the same thing. Vitest also reads `import.meta.env` natively, which `lib/api.ts`
touches at module load; under Jest that alone would need transform plumbing, and Jest
would additionally need an ESM story for a `"type": "module"` package. The `tsc` gate
does not have to be told about any of this, because the test files are inside `src` and
are typechecked with everything else.

**Constraint that fixed the version.** Vitest 5 requires **Vite ≥ 6**; this project is on
Vite 5.4. Vitest 3.2 is the newest line that pairs with Vite 5, so the alternative to
pinning it was upgrading the build tool — an unrelated risk taken for a test runner.
⚠️ Whenever Vite is upgraded, Vitest moves with it; they are one decision, not two.

**Scope of what is stubbed.** Two things, both process boundaries: `fetch` in the api
suite, and `useAuth` in the route-guard suite (`HOME_PATH` stays real). Nothing else. The
backend already has integration coverage on the far side of `fetch`, so re-simulating a
server here would test the simulation. The suites deliberately assert against **real**
application types and functions — the fixtures in `src/test/fixtures.ts` are typed as the
actual `api.ts` wire interfaces, so a wire shape that drifts from the backend fails to
compile rather than passing against a hand-written stand-in.

**DOM only where a test needs one.** The default environment is `node`. The two suites
that need `localStorage` or a rendered tree opt in per file with a
`// @vitest-environment jsdom` docblock. A global jsdom environment would have been one
line shorter and would have made every arithmetic test load a browser.

**What this is for.** `tsc` was the only frontend gate, and the regressions that matter
here are type-correct: `viewerMatch.distanceKm` and `distanceKm` are both `number | null`
(D-33), `deadlineScore` and `pickupAvailabilityScore` are both `number`, `recipientId`
and `volunteerId` are both nullable ids (D-32, D-40). Swapping any pair compiles. D-32,
D-33 and D-40 each closed with *"Nothing tests this"*; that is what the harness answers.
⚠️ Verified by mutation: inverting the D-33 precedence in `lib/geo.ts` typechecks cleanly
and fails the suite.

⚠️ **Consequences.**
- **Not wired into CI.** `ci.yml` still runs `npm run build` only, so the suite gates
  nothing automatically yet. Adding the step is outstanding work, not a decision.
- **No coverage thresholds, and no E2E or visual-regression layer.** Six modules are
  covered; 29 desktop pages and 26 mobile screens are not. The harness is a foundation,
  and its value is that the next frontend task adds a file rather than a toolchain.
- **`npm run lint` remains dead** — the script has always referenced an `eslint` that is
  not a dependency. Untouched here; it predates this work.

---

## D-44 · The needs board is scoped by role, and a donor's half of it is verification **[documented]**

**Decision.** `GET /api/requirements` narrows to the caller.
`routers/organisations._visible_requirements()` returns a WHERE clause — `None` for
admin — applied in the query alongside the existing `is_active` filter and newest-first
order: **admin** every active need; **donor** every active need posted by a *verified*
recipient; **ngo** its own organisation's needs only; **volunteer** nothing; anything
else `false()`. `RequirementOut` gains **`isVerified`**, read from
`Recipient.is_verified` at serialisation time. No column, no migration, no new model
field, and `POST`/`PATCH` authorization is untouched.

**Reason.** The endpoint was the last cross-organisation read that was open *by omission
rather than by decision* — `Depends(get_current_user)` and nothing more. That was
defensible and `TASKS.md` said so: unlike `RecipientOut` (D-26) and `VolunteerOut`
(D-41), which are directories of people, `RequirementOut` carries an organisation name
and a need and no contact details. But "defensible" is not "decided", and building the
donor needs board is what forced the question — a page is a commitment to a scope, so the
scope had to become one.

- **A donor's board is verified-only because that is the gate the rest of the system
  already applies.** `matching.score_pair` refuses an unverified organisation outright,
  so an unverified kitchen cannot be ranked for, cannot accept, and cannot receive. Its
  need on a donor's board would be an invitation to cook for a match the platform will
  not make. Verification is read live rather than copied onto the requirement, so an
  administrator vouching for an organisation makes its existing needs visible with
  nothing to backfill.
- **An NGO reads its own needs for D-26's reason, not for a new one.** Two kitchens have
  no workflow with each other. The desktop and mobile portals already filtered this list
  by `myRecipient` client-side; **that filter stays** as defence in depth — the server
  being right is not a reason to make the client depend on it.
- **A courier gets an empty list, not a 403,** following `GET /recipients` rather than
  `GET /volunteers`. There is no id to confirm or deny here, only a board that is empty
  for this caller, and `AppContext.load()` treats a 403 as a slice it may ignore — so a
  role gate would have been indistinguishable from success anyway.
- **Fail closed.** An unrecognised role matches nothing, so a role added later reads the
  board only once somebody gives it a scope.

**What the board is not.** Requirements still do not touch matching (`matching.py` has
never referenced `Requirement`), there is still no requirement-to-donation relationship,
and `daily_recurring` is still stored and displayed and acted on by nothing. The donor
page is therefore read-only and says so: no fulfil action, no count of needs met, and an
explicit line that posting a donation does not attach it to a need. This is D-31 applied
to a new surface — a screen may only claim what the system can honour.

⚠️ **Consequences.**
- **Platform-wide, not radius-scoped.** The obvious next filter is distance, and it
  cannot be built: a donor account stores no coordinates (`users` has none, and
  `Donation.latitude/longitude` belong to a *donation*, not to the person). Filtering
  would need either a donor location on the account or a "near this donation" board, and
  both are product decisions. `TASKS.md` → *Backlog*.
- **A retired requirement still has no reader** (D-29). Scoping narrows the board; it
  does not add a way to see what has left it.
- **One existing test changed.**
  `test_requirement_lifecycle.test_retiring_one_requirement_leaves_the_rest_of_the_board_alone`
  asserted that a rival kitchen's requirement stayed on *this* caller's board, which was
  only true because the endpoint was unscoped. It now checks the rival's requirement on
  the rival's own board — same property, correct board.
- ⚠️ **Newest-first is only as fine as the timestamp.** `created_at` is
  `CURRENT_TIMESTAMP`, which SQLite resolves to whole seconds, so requirements posted
  within the same second tie and fall back to insertion order. Pre-existing and not
  changed here; `test_requirement_reads.py` backdates its rows so it tests the `ORDER BY`
  rather than the tie.

---

## D-45 · A match distance belongs to the organisation it describes **[documented]**

**Decision.** `GET /api/donations/{id}/matches` still ranks every eligible kitchen for
every reader, but only describes the reader's *own* organisation from its real position.
For any other row, `matching.score_pair(..., blur_location=True)` snaps the recipient's
coordinates to a `LOCATION_BLUR_GRID_DEG` (0.01°, ≈ 1 km) grid and scores the pairing
against that surrogate point; `MatchOut.distanceKm` is then `None` and the distance
sentence in `reasons` drops its figure. The router supplies the scope through
`donations._precise_distance_scope`, which mirrors `_readable_by`: `None` (unrestricted)
for an administrator, `{own recipient id}` for an `ngo`, the empty set for a donor or a
courier. `DonationOut.viewerMatch` is always the caller's own organisation and is never
blurred.

**Reasoning.**

- **Rounding the published number does not close it.** `TASKS.md` proposed rounding
  `distance_km` to ~0.5 km. That fails to a boundary search: the rounding boundaries sit
  at *known* distances, so a donor who walks the pin until the value flips has found a
  circle of known radius about the kitchen, and three such circles still give the exact
  point. Any deterministic function of the true distance has this property. Snapping the
  kitchen's coordinates does not: everything the caller can measure is an exact function
  of one fixed surrogate, so probing recovers the surrogate and stops.
- **`distanceKm` was not the only reading, or even the finest.** `distance_score` decays
  linearly over the 8 km radius, so one point is 80 m. `_deadline_score` subtracts a
  travel estimate derived from the same distance, so one point there is ~400 m. And
  `overall_score` is a weighted sum of both — 4 points of `distance_score` move it by
  one, which is 320 m. A serialization-only transform can reach `distanceKm` and the
  reason text; it cannot reach the three scores, because they are computed from the
  distance rather than carrying it. That is why the blur is applied inside `score_pair`
  and not in `serialize.py`, against the first instinct: the seam has to sit *upstream*
  of the arithmetic, or the fix is cosmetic. ⚠️ `deadline_score` is invisible at a
  six-hour deadline, where the slack saturates at 100 for every candidate; a test posts a
  one-hour deadline so the criterion is off both rails and the channel is actually
  exercised.
- **Blurring the input keeps the panel self-consistent.** Every figure in a blurred match
  is derived from the same surrogate, so the weighted sum still reconciles by hand — the
  property D-05 and D-06 exist for, and the one that coarsening the published components
  individually would have broken.
- **`None`, not a blurred number, on `distanceKm`.** A distance computed from a surrogate
  is not the distance to the kitchen, and D-33 is explicit that a screen may not print a
  plausible number in place of one it does not have. Nothing renders this field from
  `/matches` today (the analysis panel draws the scores and the reasons), so withholding
  it costs no screen anything.
- **Eligibility is decided on the true position.** The blur is applied *after* the
  verification, coordinate and radius gates — all three `return None` branches run on the
  true `haversine_km` — so the same kitchens are ranked for every reader and D-06's gate is
  untouched. This is load-bearing in both directions and is pinned by test: a kitchen
  8.02 km away whose surrogate is 7.52 km away must stay out, and one 7.98 km away whose
  surrogate is 8.46 km away must stay in. Moving the blur above the gate fails exactly
  those tests. The rankings that freeze `Donation.match_score` — two in `routers/donations`
  and two in `seed.py` — pass no scope and stay exact.
- **The sort is on the blurred score, not the true one.** `rank_recipients` orders by
  `overall_score` as each reader receives it. Sorting on the true score while publishing
  blurred numbers would have left the *comparison* between two kitchens as a distance
  oracle of its own, which the pin can be walked against just as a value can.
- **An administrator is not scoped** because `GET /api/recipients` already gives them the
  coordinates in full; blurring would withhold nothing and would make the admin view
  disagree with the directory beside it.
- **An `ngo` is scoped like a donor for its peers.** Registration hands out the `ngo`
  role to any address, so treating "is an organisation" as "may locate other
  organisations" would leave the bypass open one role over — the mistake D-26 made about
  the courier roster and D-41 had to correct.

⚠️ **Constraints and what this does *not* close.**

- **The residual disclosure is one grid cell, ≈ 1 km across, and that is deliberate.** Two
  kitchens in the same cell are numerically identical to a donor; where in the cell either
  one stands is not recoverable from any number in the response.
  `tests/test_match_distance_privacy.py` (12) states exactly this — the two rows are
  compared whole, not field by field. Measured end to end: a donor
  posting five donations at pins of its choosing and solving for the kitchen from
  everything still exposed lands **465 m** away and fits every observation exactly, so it
  cannot refine further; the same solver on the pre-fix payload lands **15 m** away, at the
  limit of the search grid rather than of the data.
- **Membership in the ranking is itself an oracle, and this decision does not touch it.**
  A recipient appears iff the *true* distance is within the 8 km radius, so a donor who
  binary-searches the pin can still find points on that 8 km circle and trilaterate from
  three of them. Closing that would mean changing eligibility, which the matcher's
  correctness depends on. The control for it is abuse-limiting on donation creation, not
  a different distance representation. Filed in `TASKS.md` → *Backlog → A*.
- **Two smaller readings in the same family remain open**, both found while implementing
  this and both outside its endpoint: `Donation.match_score` is frozen from a precise
  ranking and shown to the donor who posted the pin (~320 m granularity, one number per
  donation, about whichever kitchen ranked first), and `DonationOut.distanceKm` is the
  exact distance to the kitchen that accepted — a kitchen the donor does not choose.
  Also `TASKS.md` → *Backlog → A*.
- **The wire contract widened.** `MatchOut.distanceKm` is `float | None`, and
  `ApiMatch.distanceKm` / `MatchAnalysis.distanceKm` are `number | null` to match.
  `displayDistanceKm` already coalesced, so no screen changed; `geo.test.ts` gained the
  case where a match carries no distance of its own.
