# DECISIONS — FoodLink / FoodBridge-AI

> Decisions evident in the repository — D-01 to D-33. D-01 to D-31 were verified on
> 2026-09-02, through the match-score consistency commit (`23c27f4`); D-31 is the one
> decision the QA audit of that date settled, and the four questions it left open are in
> `TASKS.md` -> *Blocked*. **D-32** (impact reporting, I-1) is committed as `e8a8178`;
> **D-33 describes uncommitted working-tree changes** made on 2026-09-03 for I-2
> (distance, routing and GPS wording).
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
relationship. The write path is untouched: `update_status` still uses the unscoped
`_get_or_404`, because its authorisation is `TRANSITION_ROLES` plus ownership, and the
claim step legitimately acts on a donation before the courier is bound to it.

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
- **Nothing enforces it automatically.** There is no lint rule and no frontend test suite
  to hold it (`TASKS.md` → *Backlog → D*), so it is a review habit: when a screen states a
  fact, the reviewer asks which row or function produced it. The audit is what a manual
  pass of that check looks like, and it took one sitting.
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
- **The public landing page is out of scope and still fabricates.** `pages/Landing.tsx`
  prints four literal platform statistics. `/api/metrics` requires authentication, so a
  pre-login page cannot read the real ones without a scope decision — see `TASKS.md` →
  *Backlog → I*.
- **Nothing tests this.** There is still no frontend test suite, so `tsc` is the only
  automated gate on `lib/impact.ts`. It is pure and takes plain arrays, which makes it the
  most testable module in the frontend the moment one exists.

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
- **Nothing tests it.** There is still no frontend test suite, so `tsc` remains the only
  automated gate. `displayDistanceKm` is pure and takes a plain object, so it is trivially
  testable once one exists.
