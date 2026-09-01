# DECISIONS — FoodLink / FoodBridge-AI

> Decisions evident in the repository at commit `5264fb3`.
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
was actually made on".

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

**Decision.** All 37 tests exercise the full HTTP stack against in-memory SQLite via
`StaticPool` and `app.dependency_overrides[get_db]`.

**Reasoning** (`conftest.py`): `StaticPool` "keeps one in-memory database alive across
connections, which the request/test boundary would otherwise discard." The admin fixture
notes the API "has no path to a first administrator by design, so tests reach into the
database exactly as `create-admin` does, then authenticate normally through the API" —
respecting the security boundary rather than bypassing it.

**Constraints.** ~19 s runtime, almost entirely real bcrypt hashing. Zero unit tests —
`matching.py` is pure and only tested through HTTP. Zero frontend tests.

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
