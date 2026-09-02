# TASKS — FoodLink / FoodBridge-AI

> Verified against the repository on 2026-09-02; the most recent implementation commit
> is `1181adb` (requirement lifecycle), plus the match-score consistency work described
> under *Completed*, which was verified in the working tree and uncommitted at the time of
> writing. Context: `PROJECT_STATE.md`.
>
> **Provenance rule:** everything under *Completed* is verified present in the
> repository. Everything under *Current / Next / Backlog / Blocked* is **recommended or
> open work derived from analysis — not a commitment made by the project.** No task here
> was invented from a template; each traces to a specific gap, defect or open question.
>
> **Traceability tags** make this list cheap to re-audit:
> `R-n` = *Improvement Roadmap* item n · `B-n` = *Known bugs and questionable behaviour*
> item n (both `PROJECT_KNOWLEDGE_GUIDE.md` §22) · `S-n` = §8.4 security recommendation n ·
> `§x` = another section of that guide · `D-n` = `DECISIONS.md` · `repo` = a gap verified
> directly in the source and not recorded anywhere else.
>
> **Estimates.** Hour figures are the roadmap's own (§22); where it gives none, the bucket
> is **S** (under an hour), **M** (a few hours), **L** (a day or more). All are for
> ordering, not promises.

---

## Current

**Nothing in progress.** The match-score consistency fix is finished and its tests pass;
it is uncommitted in the working tree, awaiting review. No feature branch, no partial
implementation, no TODO/FIXME markers in `code/foodlink/` or `frontend/src/`.

The seven-item hardening sequence — signing key → migrations → donation read scope →
CI → recipient read scope → auth rate limiting → courier claim race — is finished, the
first item out of *Backlog → F* (requirement `PATCH`) is done, and the QA-reported
match-score discrepancy is closed; see *Completed*.

---

## Next — hardening (recommended, ordered)

**Empty.** The item that stood here is done, and nothing has been promoted from
*Backlog* in its place — that is a Project Manager call, not one to make by writing it
down here.

Two things are worth knowing when it is made. **Group E is no longer gated:** the
courier claim was the one correctness defect that had to land before Postgres, and it
has. And **group E is where the largest amount of unbuilt work sits**, while groups A
and B hold several **S**-sized items (foreign-key enforcement, an `image_url` cap, a
readiness probe) that are cheap enough to clear without displacing it.

---

## Backlog

Grouped by kind; within a group, roughly by value over effort. **Groups A–F are
hardening** — work that makes the application that already exists safer or more reliable.
**Group G is optional product expansion** and should not compete with A–F for attention.

### A. Security

- [ ] Shorten access tokens (720 min today) and add refresh tokens, **or** add a
      `token_version` column compared in `get_current_user` for real revocation. Logout is
      client-side only; nothing can invalidate an issued token. `[R-11 · S-4 · D-13]` — ~4 h
- [ ] Issue `PRAGMA foreign_keys = ON` for SQLite through a connection event listener —
      declared foreign keys are unenforced on the default configuration. `[R-15 · S-5 · D-08]` — **S**
- [ ] Validate and length-cap `image_url` — an unconstrained `Text` column
      (`code/foodlink/models.py:219`) receiving base64 data URLs from the frontend. This is
      the cheap guard; the real fix is object storage (group F). `[B-6 · R-19 · S-6]` — **S**
- [ ] Security headers + CSP (and HSTS wherever TLS terminates). Nothing is sent today. A
      CSP is the single largest mitigation available for the localStorage-token choice the
      project has deliberately accepted (D-13). `[R-21 · S-7]` — **S**
- [ ] Add `pip-audit` / `npm audit` to CI. This was explicitly deferred until CI existed;
      CI exists now (`e47bd86`) and `ci.yml` has no audit step. `[S-8]` — **S**
- [ ] Email verification at registration — any address is accepted and never confirmed.
      `[§8.2]` — **M**
- [ ] MFA and an admin audit log. An admin compromise is currently total, with no record
      beyond `status_events`. Listed last because it presumes everything above. `[R-34]` — **L**

### B. Correctness & reliability

- [ ] Global exception handler returning a correlation id. `main.py` registers no
      `exception_handler`, and `frontend/src/lib/api.ts` maps a bodiless 5xx to
      `NetworkError` — so an unhandled 500 reaches the user as *"Cannot reach the FoodLink
      server"* and a crash is indistinguishable from an outage. `[B-7 · R-18]` — **M**
- [ ] Structured logging. The application has no `logging` configuration at all; the only
      `logging` references in the tree are Alembic's, which `migrate.py` deliberately
      declines to reconfigure. `[R-17]` — **M**
- [ ] Readiness probe that runs `SELECT 1`. `/api/health` (`code/foodlink/main.py:71`)
      returns `ok` with a dead database. Keep the existing endpoint as liveness. `[R-20]` — **S**

### C. Performance & scale

- [ ] Aggregate `GET /api/metrics` in SQL and cache it (~60 s). It loads every donation
      with every event and computes medians in Python
      (`code/foodlink/routers/metrics.py:36`), and `Donation.timestamp_of`
      (`code/foodlink/models.py:253`) then linearly scans that event list once per metric
      per donation. `[R-12 · §16.2]` — **M**
- [ ] Push the match radius into SQL as a lat/long bounding box before scoring.
      `rank_recipients` receives every recipient row and the radius filters in Python
      (`code/foodlink/matching.py:128`); `config.py`'s comment claims the radius bounds the
      work — as written, it does not. `[R-10]` — ~2 h
- [ ] Cursor or offset pagination. `limit` is capped at 500
      (`code/foodlink/routers/donations.py:194`) with no way to reach a second page, so
      lists truncate silently. `[R-9]` — ~3 h
- [ ] Frontend code splitting per portal (`React.lazy`). `App.tsx` eagerly imports all
      four portals plus the mobile tree; there is no `lazy(` anywhere in
      `frontend/src`. `[R-27]` — **M**

### D. Testing

- [ ] Unit tests for `matching.py`'s scoring functions at their boundaries —
      `_quantity_score` at the overflow ratio, `_deadline_score` on negative slack, the
      reliability cliff at 3 accepted donations. Partially started: one test in
      `test_match_score_consistency.py` calls `score_pair` directly with an injected `now`
      to pin the deadline decay, but the individual `_*_score` helpers are still reached
      only through the API. `[R-13]` — **M**
- [ ] Round-trip test for `UtcDateTime`. The decorator exists to prevent one specific
      timezone bug (D-09) and has no direct test. `[§14.4]` — **S**
- [ ] Frontend tests (Vitest + Testing Library), starting with `ProtectedRoute`. 84 files
      under `frontend/src`, zero tests — `tsc` in `npm run build` is the only frontend gate
      in CI, so a type-correct behavioural regression passes. `[R-14]` — **L**
- [x] ~~Concurrency test for the courier claim.~~ Done with the fix — see *Completed*.
      `test_courier_claim.py` opens the window deterministically against a file-backed
      database. `[§14.4]`
- [ ] **Generalise the claim's concurrency guard to the rest of `update_status`.** The
      courier claim now carries its condition in the UPDATE (D-28); every other
      transition still reads `donation.status`, checks it in Python and writes. SQLite
      serialises them today, so this is inert — on Postgres two concurrent transitions
      on one donation can both succeed and append two events. Deliberately out of scope
      of the claim fix, which touched the one path with a demonstrated defect.
      `[D-28 · repo]` — **M**

### E. Operability & deployment

> **Sequenced, not independent.** Alembic (`3e1e168`) and the fail-closed signing key were
> the prerequisites for deploying at all, and both are done — but the schema still migrates
> inside the app's own lifespan (D-23; `ARCHITECTURE.md` constraint 2). So the first two
> below are strictly ordered, and the third needs the second to give it somewhere to run.

- [ ] **Postgres for deployment.** `DATABASE_URL` already works with no code change (D-08),
      but `code/requirements.txt` ships no driver (`psycopg`/`psycopg2-binary`), nothing has
      been run against Postgres, and `ensure_schema_current()` must move out of the lifespan
      into a deploy step first or concurrent uvicorn workers race to migrate. `[R-4 · D-23]` — **L**
- [ ] **Deployment configuration.** None of any kind exists: no Dockerfile, no compose file,
      no Procfile, no proxy config, no SPA rewrite for the built frontend, no TLS
      termination. §15.5 holds the checklist. Depends on the Postgres item above.
      `[§1.5 · §15.5]` — **L**
- [ ] **Decide whether the rate-limit counter has to be shared.** `foodlink/ratelimit.py`
      counts in the worker's own memory, which is exact while SQLite confines the app to one
      process and becomes an `n`-fold weaker limit across `n` workers (D-27). Deployment also
      has to run uvicorn with `--proxy-headers --forwarded-allow-ips=<proxy>`, or every
      request arrives from the proxy and shares a single budget. Both are decisions for the
      two items above, not standalone work. `[D-27 · repo]` — **M** if a shared store is chosen
- [ ] **Schedule the expiry sweep.** `POST /api/admin/maintenance/expire` exists and must be
      called by hand; there is no scheduler, queue or worker anywhere (`ARCHITECTURE.md`
      constraint 7). Until it runs, the expiry-loss metric **understates** reality. It needs
      a home first — cron holding an admin token, or in-process APScheduler, which reopens
      the single-process assumption. `[R-8]` — ~1 h once there is somewhere to run it

### F. Product gaps in what already exists

Places where a shipped feature is incomplete — not new ideas.

- [ ] Let an organisation see its own retired requirements. `PATCH /api/requirements/{id}`
      can reopen one, but `GET /api/requirements` returns active rows only and gained no
      parameter, so a retired requirement has no reader and the UI cannot list or reopen
      it. The shape: an `includeInactive` flag widening the caller's view of **its own**
      organisation's rows only, never anyone else's. `[D-29 · repo]` — **S**
- [ ] Courier rating flow, **or** drop `Volunteer.rating`. The column is written by nothing
      but `seed.py`; `VolunteerUpdate` excludes it deliberately, so every courier created
      through the app is permanently 5.0. `[B-3 · R-33]` — **M**
- [ ] Real image upload to object storage. There is no `UploadFile` endpoint anywhere;
      images arrive as base64 strings into a `Text` column and inflate every donation
      response. Supersedes the cheap cap in group A rather than duplicating it. `[R-19]` — **L**
- [ ] Use `COLD_STORAGE` to gate matching as its own comment describes, or delete it.
      Defined at `code/foodlink/matching.py:34`, referenced nowhere. Bound up with recipient
      food-category preferences (group G) — that is what would give it something to compare
      against. `[B-2 · R-22 · R-32]` — **S**

- [ ] Show an NGO the distance to a donation it has not accepted yet.
      `serialize.donation_out()` measures `distanceKm` against the **matched** recipient,
      so it is null for everything in the open pool: the lists read "– km" and mobile's
      *Nearest* sort is a no-op there. The figure already exists per-viewer as
      `viewerMatch.distanceKm` (D-30); this is wiring, not computation. `[repo]` — **S**
- [ ] Record the match score on the `MATCHED` event rather than reading the column later.
      `adapters.activityMessage` renders "Matched … at {matchScore}%", and acceptance
      overwrites `match_score`, so the line retroactively changes to the accepting
      organisation's figure. The event ledger is the right home for a number that
      describes a moment. `[repo]` — **S**
- [ ] Make `/ngo/available/:id` open that donation. The route renders
      `NGOAvailableDonations`, which tracks its selection in local state and never reads
      the param, so the dashboard's *Open to claim* row deep-links to a list with nothing
      selected. `[repo]` — **S**

### G. Future features — optional expansion, not hardening

- [ ] Generate the TypeScript client from the OpenAPI schema. `lib/api.ts` mirrors the
      Pydantic schemas by hand, so a backend rename is a silent runtime break rather than a
      compile error. `[R-25]`
- [ ] React Query for server state — keeps write-then-refetch correctness (D-11) while
      removing its chattiness. `[R-26]`
- [ ] Notifications (email/SMS/push) on match and assignment. The system currently has zero
      external service dependencies. `[R-28]`
- [ ] WebSockets/SSE for a live donation feed. `[R-29]`
- [ ] Real routing distance instead of haversine — which also retires the 20 km/h travel
      constant in `score_pair`. `[R-30]`
- [ ] Recipient food-category preferences. Would also give `COLD_STORAGE` a purpose. `[R-32]`
- [ ] Tune the matching weights against real outcome data; revisit the 85 reliability
      prior. `[R-31]`
- [ ] Recurring donation schedules. `Requirement.daily_recurring` exists on the recipient
      side; donations have no equivalent. `[R-35]`
- [ ] Postgres + PostGIS for spatial indexing — only once organisation count makes the
      bounding box in group C insufficient. Distinct from the Postgres *move* in group E,
      which is about deployment, not indexing. `[§16.3]`

### H. Cleanup

- [ ] Delete the C++ template residue: `code/Makefile`, `code/src/`, `code/inc/`,
      `code/run_main.o`. It builds `libbvr_math.so` and has nothing to do with
      FoodLink. `[R-23]` — **S**
- [ ] Fix `pyproject.toml`. It still carries the course template's name, author and
      description, and `requires-python = ">=3.8"` contradicts the 3.10+ union syntax the
      code uses — CI pins 3.13 and carries a comment pointing at this entry. `[R-24]` — **S**
- [ ] Resolve the duplicate `foodlink.db`. Both `./foodlink.db` and `./code/foodlink.db`
      exist because the default SQLite URL is relative to the working directory — a
      recurring "my data vanished" trap. `[B-5 · D-08]` — **S**
- [ ] Audit the remaining unanchored `.gitignore` patterns. `8386371` anchored `lib/`, but
      `build/`, `dist/` and `var/` still match at any depth — `git check-ignore` confirms
      that `frontend/src/build/`, `frontend/src/dist/` and `frontend/src/var/` would each be
      silently excluded. Nothing is hidden today; this is the same latent defect that cost
      the first CI run. `[repo]` — **S**

---

## Blocked — open decisions, not unbuilt work

Each of these has a working implementation whose *intended* behaviour has never been
settled. They sit here rather than in *Backlog* so that nobody implements one by guessing.

- **Should a donation stuck in `ACCEPTED` past its deadline expire?** The sweep only
  touches `AVAILABLE` and `MATCHED` (`code/foodlink/routers/admin.py:200`), so an
  accepted-but-never-delivered donation stays in that state forever and never counts as an
  expiry loss. Deliberate or oversight — undecided. `[B-1 · §14.4]`
- **What should revoking an organisation's verification do to a donation it has already
  accepted?** Today, nothing: verification gates ranking and acceptance, not the lifecycle
  afterwards. Untested and undecided. `[B-4]`
- **Should `GET /api/metrics` stay platform-wide for every role?** It returns the whole
  platform's figures to any authenticated account. Defensible as a transparency dashboard,
  questionable as a per-tenant view. A product call, not a defect — and it blocks nothing
  else. `[§8.2]`
- **Is `/m/*` a deliberately link-only experience, or unfinished routing?**
  `frontend/src/mobile/useIsMobile.ts` is never imported, so nothing sends a phone visitor
  to the mobile tree; entry is by typing the URL. D-20 records the rationale as unknown.
  Decide before either wiring the redirect or deleting the hook. `[B-8 · R-22 · D-20]`

**Sequenced rather than blocked:** multi-worker uvicorn needs Postgres *and* the migration
step moved out of the app lifespan. Both are group E above, and neither waits on anything
external.

---

## Completed (verified in the repository)

### Match-score consistency — working tree (uncommitted at verification) `[QA]`
- [x] **Root cause traced, not guessed.** The NGO list rendered the persisted
      `Donation.match_score` — written at creation from `rank_recipients(…, limit=1)`, so
      it is the *top-ranked organisation's* score, frozen — under a label reading
      "% match", beside a panel that scored the reader's own pairing live through
      `/matches`. Two independent divergences: a different organisation, and a different
      moment (`deadline_score` decays continuously). `seed.py` wrote a literal
      `94 - i * 3`, which is the exact 94 QA saw.
- [x] **`DonationOut.viewerMatch`** (`routers/donations._viewer_match`) — the calling
      organisation's own ranking, via the same `matching.score_pair` `/matches` uses.
      Null for a non-NGO caller and once the donation leaves `OPEN_TO_RECIPIENTS`. The
      whole `MatchOut` travels so the headline and its breakdown are one object from one
      request. Additive contract change, no schema change, `alembic check` clean.
      See `DECISIONS.md` D-30.
- [x] **The frozen score kept, and labelled.** `matchScore` still shows on the donor and
      admin screens and on the NGO's accepted screen, now as "Match score at acceptance"
      / "at acceptance", so the two numbers cannot be read as each other.
- [x] **NGO surfaces switched, desktop and mobile.** `DonationCard`, `DonationRow`,
      `mobile/NGOAvailable` (list, sort and sheet) and `mobile/NGOHome` read
      `viewerMatch`; the analysis panels render from it rather than fetching `/matches`
      again. `useMatchAnalysis` is donor-side only now and lost its recipient parameter.
- [x] **`seed.py` ranks through `rank_recipients`** at MATCHED and re-freezes against the
      accepting organisation at ACCEPTED, the way the API does — no more invented score
      in the demo data.
- [x] **Two static claims removed from the analysis panel:** a hard-coded "95%+ Success
      Rate" badge that contradicted the real reliability figure beside it, and a constant
      "High Compatibility" caption under a variable score.
- [x] 11 tests in `code/tests/test_match_score_consistency.py`, plus manual verification
      through the running app on seeded data (Helping Hands 79% on both surfaces, Umeed
      Shelter 77% on both, for the same donation).
- [x] ⚠️ Three defects found while tracing and deliberately **not** fixed, as unrelated
      to the score: the missing per-viewer `distanceKm`, the `MATCHED` activity line
      reading a score that acceptance overwrites, and the unread `:id` route param — all
      three are now in *Backlog → F*.

### Requirement lifecycle — `1181adb` `[R-16]`
- [x] **`PATCH /api/requirements/{id}`** (`routers/organisations.update_requirement`) —
      the one lifecycle operation. It revises fields, retires a requirement
      (`isActive: false`) and reopens one. No `DELETE`, no new column, no migration
      (`alembic check` clean). See `DECISIONS.md` D-29.
- [x] **Fulfilment is retirement.** The model has one flag, `is_active`, and
      `GET /api/requirements` already filtered on it, so "mark fulfilled" and "no longer
      needed" write the same row and the record is kept rather than deleted. The API and
      the UI say so in those words rather than implying a stored distinction.
- [x] **Ownership is enforced in the query.** `_own_requirement_or_404()` matches the
      caller's own `recipient_id`; another organisation's id is a 404, per D-24. Holding
      the `ngo` role only passes `require_roles`. `RequirementUpdate` repeats
      `RequirementCreate`'s constraints, so a quantity that cannot be posted cannot be
      edited in either, and an explicit `null` is skipped rather than written to a
      non-nullable column.
- [x] **NGO UI, desktop and mobile.** `pages/ngo/NGORequirements.tsx` and
      `mobile/NGORequirements.tsx` reuse their existing modal/sheet for editing and add
      *Edit* / *Mark fulfilled* per card; `AppContext` gains `updateRequirement` and
      `retireRequirement` on the existing write-then-refetch path. Neither page was
      redesigned.
- [x] 15 tests in `code/tests/test_requirement_lifecycle.py`, plus manual verification
      through the running app (edit and retire as a seeded NGO, against a copy of the dev
      database).
- [x] ⚠️ A retired requirement has no reader: the list stayed active-only, so reopening is
      API-only — see the new *Backlog → F* item.

### Courier claim race — `e919f7b` `[R-7 · repo]`
- [x] **The claim is atomic.** `routers/donations._claim_pickup()` assigns the courier
      with one conditional `UPDATE … WHERE id = :id AND status = :from_status AND
      (volunteer_id IS NULL OR volunteer_id = :courier)`, and `rowcount != 1` means the
      claim was lost. The Python read-compare-assign it replaces is gone, so the value
      that authorises the write is the one the database holds *at* the write.
- [x] `SELECT … FOR UPDATE` was rejected: SQLAlchemy compiles `with_for_update()` to a
      plain `SELECT` on SQLite, so the lock would silently not exist on the engine the
      project tests against. The conditional UPDATE compiles identically on both
      dialects. See `DECISIONS.md` D-28.
- [x] **No schema change and no constraint.** One nullable column on the donation row
      already makes "one courier per pickup" structural; the defect was a lost update.
      `alembic check` reports no drift.
- [x] Behaviour preserved: role, lifecycle and verification gates run first and are
      untouched; the same courier may still reclaim a pickup released back to them; a
      loser is told either *"Another courier has already claimed this pickup"* or the
      transition table's own message, whichever the row now warrants — both existing
      strings. Concurrent duplicates from **one** courier are refused too, by the
      `status` half of the condition.
- [x] 9 tests in `code/tests/test_courier_claim.py`. Six are sequential; three build a
      file-backed SQLite database so two real transactions exist and interleave them by
      hand rather than with threads or sleeps. **Two fail against the pre-fix code with
      a `200` where a `409` belongs** — the overwrite itself, reproduced through the
      HTTP endpoint.
- [x] ⚠️ Only the claim is guarded — see the new *Backlog → D* item for the rest of
      `update_status`.

### Authentication rate limiting — `91544e3` `[R-6 · S-3]`
- [x] **`POST /api/auth/login` and `POST /api/auth/register` are rate limited**, the two
      routes an anonymous caller can drive. `code/foodlink/ratelimit.py` holds a
      sliding-window counter per client address; both routes carry it as a
      `dependencies=[Depends(...)]` entry, so a request over the ceiling never reaches the
      handler. No new dependency was added — see `DECISIONS.md` D-27.
- [x] Policy: **30 logins per 5 minutes** and **10 registrations per hour**, per address.
      All four values are read from the environment (`LOGIN_RATE_LIMIT`,
      `LOGIN_RATE_WINDOW_SECONDS`, `REGISTER_RATE_LIMIT`, `REGISTER_RATE_WINDOW_SECONDS`)
      through `config._positive_int`, which refuses a value that would refuse every
      request (`0`) or none (negative).
- [x] Over the ceiling: `429` with `{"detail": "Too many attempts from this network.
      Please wait and try again."}` and a `Retry-After` header. The message names the
      network, never the account, so the response is identical for a real address and an
      unknown one (D-18's reasoning). Below the ceiling authentication is byte-for-byte
      unchanged.
- [x] Keyed on `request.client.host` only. `X-Forwarded-For` is deliberately not read —
      trusting it would let any caller switch the limiter off.
- [x] 22 tests in `code/tests/test_rate_limit.py`: the limiter (window slide, key
      isolation, refusals not extending the lockout, key sweeping), both endpoints either
      side of the threshold, address and endpoint isolation, recovery after the window,
      and the configured policy. `conftest.py` clears the counters per test, since they
      outlive the throwaway database.
- [x] ⚠️ **The counter is process-local** — see *Backlog → E*.

### Recipient read authorization — `16497ea` `[S-2 (recipients half) · repo]`
- [x] **`GET /api/recipients` is scoped server-side by role and ownership.** It returned
      every organisation — `contact_person` and `phone` included — to any authenticated
      account. `_visible_recipients(user)`
      (`code/foodlink/routers/organisations.py`) now returns the caller's scope as a
      WHERE clause applied in the query, the same shape as `_readable_by` (D-24).
- [x] Scope: admin → every organisation · ngo → its own row only · donor → none ·
      volunteer → none · unknown role → none (`false()`, fails closed). Denial is an
      empty list, not a 403 — deliberately unlike `GET /api/volunteers`. See
      `DECISIONS.md` D-26.
- [x] **No individual-recipient read endpoint exists** to scope alongside it.
      `GET|PATCH /recipients/me` was already `require_roles(ngo)` plus a `user_id` lookup;
      `POST|DELETE /admin/recipients/{id}/verify` sits behind the admin router gate. Both
      untouched, so every path returning `RecipientOut` is now scoped.
- [x] Frontend untouched and unbroken: the only consumers of the collection are the two
      admin organisation screens (admin keeps everything) and `useMyRecipient`, which
      resolves the caller's own row out of the list — which the ngo scope keeps. A donor
      or courier receiving `[]` is already indistinguishable from the 403 that
      `AppContext.optional` swallows today.
- [x] 11 tests in `code/tests/test_recipient_reads.py`, including a role matrix and
      negative tests asserting another organisation's phone number appears nowhere in the
      response body. Nine of them fail against the previous code.

### Continuous integration — `e47bd86`, `8386371` `[R-5]`
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
      Backend job passed on the same run. The fix is pushed, and the follow-up run is
      reported green — GitHub run history is not readable from the working tree, so that
      last part rests on report rather than local verification.

### Donation read authorization — `ea0f499` `[R-3 · S-2 (donations half)]`
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
      code.

### Database migrations — `3e1e168` `[R-1]`
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

### Security hardening — `3e1e168` `[R-2 · S-1]`
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
- [x] 22 collected tests in `code/tests/test_config.py` (14 functions, two of them
      parametrised). JWT signing/verification in `security.py` unchanged.

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
      `dependency_overrides`. **122 tests pass today** (~60 s) — 37 integration + 13
      donation-read-scope + 11 recipient-read-scope + 9 courier-claim + 22 rate-limit +
      22 config + 8 migration.

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
- [x] Vite dev proxy `/api → 127.0.0.1:8000` (overridable through `VITE_API_PROXY`),
      eliminating CORS in development
- [x] `.claude/launch.json` frontend dev-server config
- [x] `.gitignore` covering `.env`, `node_modules`; no `.db` or `.env` tracked.
      `lib/` anchored to `/lib/` (`8386371`) after it hid `frontend/src/lib/` — the
      neighbouring `build/`, `dist/` and `var/` are still unanchored, tracked under
      *Backlog → H*
- [x] mkdocs documentation workflow — `.github/workflows/mkdocs.yml` (docs only;
      validation lives in `ci.yml`)
- [x] `ai/` context scaffolding — `5264fb3`
