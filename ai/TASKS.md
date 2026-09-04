# TASKS — FoodLink / FoodBridge-AI

> Verified against the repository on 2026-09-04. The lifecycle write-authorization work is
> committed — D-34 as `551c96d`, the D-35 ownership-takeover follow-up as `efd5fd8` — as are
> the I-4 notification-honesty pass (`6863451`), the I-5 trust/verification pass
> (`6c82739`) and the I-6 courier status-display fix (`b41c4e6`). On top of those the
> working tree carries the **uncommitted** I-7 overdue-deadline fix described under
> *Backlog → I*. Context: `PROJECT_STATE.md`.
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
> directly in the source and not recorded anywhere else · `QA-n` = finding *n* of the
> manual QA audit of 2026-09-02, whose classifications are recorded in **Group I** and in
> *Blocked*.
>
> **Estimates.** Hour figures are the roadmap's own (§22); where it gives none, the bucket
> is **S** (under an hour), **M** (a few hours), **L** (a day or more). All are for
> ordering, not promises.

---

## Current

**Nothing in progress.** No feature branch, no partial implementation, no TODO/FIXME
markers in `code/foodlink/` or `frontend/src/`. 162 backend tests pass (untouched by the
current work, which is frontend-only); `tsc --noEmit` and `tsc && vite build` are clean.

**Uncommitted in the working tree (2026-09-04): I-7, the overdue pickup deadline in
`StatusTimeline`.** The detail-view timeline was driven purely by `status`, so a donation
whose collection window closed hours ago read *"Matched · Current"* with no warning — the
one surface that never said the deadline had gone. It now annotates the current step when
the deadline has passed **and** the food is still uncollected. One frontend file, no
backend or schema change, no client-side expiry — see *Backlog → I*.

The seven-item hardening sequence — signing key → migrations → donation read scope →
CI → recipient read scope → auth rate limiting → courier claim race — is finished, the
first item out of *Backlog → F* (requirement `PATCH`) is done, and the QA-reported
match-score discrepancy is closed and committed (`23c27f4`); see *Completed*.

**I-1 (`e8a8178`), I-2 (`fcbd03b`), I-3 (`b5e09ee`), I-4 (`6863451`), I-5 (`6c82739`) and
I-6 (`b41c4e6`) are committed; I-7 is done and sitting uncommitted in the working tree**
(2026-09-04). I-7: `StatusTimeline` marks the current step *Overdue* and names the time the
pickup window closed, in the four statuses where the food has not been collected yet
(`DECISIONS.md` D-39). I-6: the NGO accepted-donations courier line is chosen by the
donation's status instead of by the presence of a courier name, so a `COMPLETED` donation
no longer reads as one still being carried (`DECISIONS.md` D-38). I-4: the ten dead
notification toggles are gone from
all four profile screens and the claims around them are reworded to what the system does
(`DECISIONS.md` D-36). I-5: the fabricated donor
verification badge and the FSSAI compliance panel are gone, and "verified" now appears only
where `Recipient.is_verified` backs it (`DECISIONS.md` D-37). I-1: the six per-role impact surfaces and two dashboards no longer
print invented figures, computed from one module for desktop and `/m/*` (`DECISIONS.md`
D-32). I-2: the routing, travel-time and live-GPS claims are gone, invented distance
fallbacks are replaced by an unavailable state, and one selector decides which
server-provided straight-line distance a screen shows (`DECISIONS.md` D-33). See
*Backlog → I* for exactly what changed in each. Nothing else is in progress.

**A manual QA audit was run on 2026-09-02** across twelve observations. It changed no
source code — its output is this list. Its central result: **the backend is broadly
honest and the frontend is not.** Every server-side number the audit traced is derived
from real rows through code that says what it does; a large amount of interface text
claims capability the system does not have — requirement-aware matching, live GPS
tracking, notification delivery, FSSAI verification, and impact figures padded with
literals. That body of work is now **Group I**, and the four questions it could not
answer from the code are in *Blocked*. See *Completed → QA audit* for the classification
of all twelve.

---

## Next — hardening (recommended, ordered)

**Empty — still a Project Manager call**, and neither the QA audit nor the Task 14
lifecycle audit promoted anything into it. (The `CANCELLED` ownership gap that sat here
briefly was folded into the D-34 change itself, and the `ACCEPTED` takeover Task 14 found
into the D-35 change — see *Completed*.)
What the audit did change is what the list looks like when that call is made:

- **Group I now exists and did not before.** It is hardening, not polish: `DECISIONS.md`
  D-31 records why an interface claim the system cannot honour is a defect in a project
  whose evaluation rests on evidence. Most of its items are **S**, and the two a demo
  audience sees first (I-1, I-2) are now both done, as are I-3, I-4 and I-5.
- **Group E is still the largest block and is still ungated** — the courier claim was
  the last correctness prerequisite for Postgres, and it landed in `e919f7b`.
- **Group F is unchanged and confirmed.** QA independently re-observed all three
  match-score follow-ups; they are real and they are still small.

**The audit's own recommended order**, offered as analysis and not as a commitment:
~~**I-1** (impact figures)~~ and ~~**I-2** (live-GPS and routing claims)~~ **— both done,
2026-09-03**, ~~**I-3** (requirement matching claims)~~, ~~**I-4** (notification
settings)~~ and ~~**I-5** (verification and compliance badges)~~ **— all done 2026-09-04**
→ **F**
(the three match-score follow-ups, one sitting) → **E** (Postgres, once the demo-facing
claims are true). The reasoning is in *Group I*'s header:
the cheapest way to stop over-claiming is to stop printing the claims, and that has to
happen before or alongside deciding which of them to actually build (*Blocked*).

---

## Backlog

Grouped by kind; within a group, roughly by value over effort. **Groups A–F and I are
hardening** — work that makes the application that already exists safer, more reliable, or
more honest about itself. **Group G is optional product expansion** and should not compete
with them for attention. **Group I is placed last only so the existing letters keep their
meaning**; by value it belongs beside A–F, and `DECISIONS.md` D-31 records why.

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

> The three below came out of the match-score fix (D-30) and were **re-confirmed
> unchanged by the QA audit** against `23c27f4`. They are independent of each other and
> small enough to take in one sitting.

- [ ] Show an NGO the distance to a donation it has not accepted yet.
      `serialize.donation_out()` measures `distanceKm` against the **matched** recipient
      (`code/foodlink/serialize.py:21`), so it is null for everything in the open pool.
      `mobile/NGOAvailable.tsx:100` therefore reads "– km" for every row and its *Nearest*
      sort (`?? 99`, line 24) is a no-op; desktop `DonationCard.tsx:58` quietly falls back
      to the location string instead. The figure already exists per-viewer as
      `viewerMatch.distanceKm` (D-30); this is wiring, not computation.
      `[repo · QA-8]` — **S**
- [ ] Record the match score on the `MATCHED` event rather than reading the column later.
      `adapters.activityMessage` (`frontend/src/lib/adapters.ts:213`) renders
      "Matched … at {matchScore}%", and acceptance overwrites `match_score`, so the line
      retroactively changes to the accepting organisation's figure. The event ledger is the
      right home for a number that describes a moment — and it is the same
      frozen-versus-live confusion D-30 was about, one layer down. `[repo · QA-8]` — **S**
- [ ] Make `/ngo/available/:id` open that donation. The route exists
      (`frontend/src/App.tsx:81`) and renders `NGOAvailableDonations`, which tracks its
      selection in `useState` (line 18) and never calls `useParams`, so the dashboard's
      *Open to claim* row deep-links to a list with nothing selected. `[repo · QA-8]` — **S**

### G. Future features — optional expansion, not hardening

- [ ] Generate the TypeScript client from the OpenAPI schema. `lib/api.ts` mirrors the
      Pydantic schemas by hand, so a backend rename is a silent runtime break rather than a
      compile error. `[R-25]`
- [ ] React Query for server state — keeps write-then-refetch correctness (D-11) while
      removing its chattiness. `[R-26]`
- [ ] Notifications (email/SMS/push) on match and assignment. The system currently has zero
      external service dependencies — no SMTP, no provider SDK, no outbound HTTP anywhere in
      `code/foodlink/`. ⚠️ **Ten preference toggles across four profile screens already
      offer this to users** and none of them reach the server; until this is built, I-4
      is what has to happen instead. `[R-28 · QA-5]`
- [ ] WebSockets/SSE for a live donation feed. `[R-29]`
- [ ] Real routing distance instead of haversine — which also retires the 20 km/h travel
      constant in `matching.py:132`. ⚠️ **Blocked on a product decision, not on
      effort:** the audit confirmed the matcher measures great-circle distance only
      (`matching.haversine_km`) while the interface presents it as a road corridor with a
      travel estimate. Deciding whether the number should *become* road distance is the
      first *Blocked* entry. **I-2 has since made the interface honest either way** —
      every distance is now labelled straight-line and no travel time is displayed — so
      this decision is no longer urgent, only open. `[R-30 · QA-1]`
- [ ] Recipient food-category preferences. Would also give `COLD_STORAGE` a purpose. `[R-32]`
- [ ] Tune the matching weights against real outcome data; revisit the 85 reliability
      prior. `[R-31]`
- [ ] Recurring donation schedules. `Requirement.daily_recurring` exists on the recipient
      side; donations have no equivalent. ⚠️ **The recipient-side flag is storage only:**
      `models.py:293` declares it, `RequirementOut` echoes it, and the NGO UI renders a
      *Daily Recurring* badge from it — nothing reads it, nothing re-posts a requirement
      daily, and there is no scheduler to do so (`ARCHITECTURE.md` constraint 7). So this
      item is where recurrence would actually be *implemented*, on both sides; I-3 covers
      the badge in the meantime. `[R-35 · QA-11]`
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

### I. Claims the interface makes that the system does not implement

> **This is hardening, not polish.** The project's whole argument is that its numbers are
> evidence rather than self-report — the append-only ledger exists for that reason (D-01),
> the matcher is a readable heuristic for that reason (D-05), and the score is never a bare
> number for that reason (D-06). Interface text that claims a capability the code does not
> have spends exactly the credibility those decisions were built to earn. `DECISIONS.md`
> D-31 draws the line the audit used: a **labelled** roadmap claim is fine; an
> **unlabelled** present-tense one is a defect.
>
> Every item below was verified against the source on 2026-09-02. None requires a schema
> change, an API change, or a decision from *Blocked* — each is reachable by deleting or
> rewording front-end text, or by reading a value the client already holds. The decisions
> about which of these capabilities to actually *build* are separate and are in *Blocked*.

- [x] **I-1 · Stop printing impact figures that are not measurements.** `[QA-4 · repo]` — **done,
      commit `e8a8178`, 2026-09-03.** Six impact surfaces (three desktop, three
      mobile) plus two dashboards now read `frontend/src/lib/impact.ts`, which derives every
      figure from the account's own donation list and its own server counters. Removed: the
      `+ 1240` / `+ 18` / `+ 42` / `+ 8` literal offsets, the pure-literal cards (`5`
      shelters, `850+` beneficiaries, `8` kitchens, `42` mins, `48.5` km, `4.9` rating),
      every fabricated `trend`/`equivalent` string, the two fabricated badge blocks, the
      hard-coded category and demographic distributions, the literal six-month `BARS` array,
      the `95%`/`150` figures in the NGO standards panel, and the hard-coded identities on
      `DonorImpact` / `DonorDashboard` / `VolunteerDashboard`. Both "Download Impact Report"
      buttons are gone — no `alert(` remains anywhere in `frontend/src/`. The desktop/mobile
      CO₂e contradiction is resolved by deleting both: `quantity` is a mixed-unit count, so
      no per-kilogram factor applies to it. Charts are now real (`category`, `createdAt`,
      recipient/donor shares) with insufficient-data states. Reasoning and constraints in
      `DECISIONS.md` D-32; verified in the running app against the dev database for a donor,
      an NGO and a courier on desktop and `/m/*`.

- [ ] **I-1a · The public landing page still prints four invented platform statistics.**
      `[repo]` — **S**, and it needs a decision first. `pages/Landing.tsx:8-13` renders
      `1,240+` meals redistributed, `32` partner organisations, `56` active volunteers and
      `84` successful pickups as facts. (The first is the same literal I-1 removed from
      `NGOImpact`.) I-1 did not touch it because it is not a per-role impact surface and
      because the fix is not free: `GET /api/metrics` is `Depends(get_current_user)`, so a
      pre-login page cannot read the real figures without either a public metrics endpoint
      or a public subset of one — a scope decision, and D-26's neighbour. Cheap honest
      options that need no backend change: delete the strip, or relabel it as illustrative.

- [x] **I-2 · Remove the live-tracking and road-routing claims.** `[QA-1 · QA-10 · repo]` — **done,
      commit `fcbd03b`, 2026-09-03.** The audit's findings were all confirmed against
      the source first: there is no GPS tracking, no routing provider and no map anywhere in
      the repository, and `navigator.geolocation` is still called in exactly two places
      (`lib/geo.ts` via `CreateDonation.tsx` and `CreateDonationCamera.tsx`), both to pin a
      donation at creation. A courier's position is never read, stored or transmitted.

      `components/MapPreview.tsx` is now a **Handover Overview**: the three-node schematic is
      kept, but the animated ping dots, the hard-coded `~0.8 km` leg, the derived
      `distanceKm - 0.8` second leg, the `'Aarav Sharma (0.8 km away)'` default courier, the
      `distanceKm * 6 + 10` travel estimate and the **"Live GPS tracking active in Phase 2"**
      footer are gone. The footer now carries the one figure with something behind it —
      the server's straight-line distance, or *unavailable* — beside "Schematic only — no
      road route, travel time or courier location". `distanceKm` became optional so callers
      stop inventing one. The travel estimate was **removed rather than corrected**: no
      travel time is serialised to the client at all, so there was no honest number to show.

      Also corrected: `NGOAcceptedDonations` ("Live Corridor Tracking" → "Pickup and
      Drop-off"; "in real time"; "En route on vehicle" → "Courier assigned"),
      `CreateDonation`'s *"ranked by real travel distance"* hint, `MatchAnalysis`'s
      "reduces volunteer travel time" description, `TaskCard`'s "Accept this task to get
      directions", `VolunteerHistory`'s "km route", and `mobile/VolunteerHome`'s "Distance"
      label. Every invented fallback is gone — `~2 km`, `?? 1.8`, `?? 2.4`, `?? '~2'` — and
      an unknown distance now reads *unavailable* rather than a plausible number.

      **One behavioural fix came with the wording.** An open donation carries no
      `distanceKm` (`serialize.donation_out()` measures it against a *matched* recipient),
      so every NGO surface was rendering `– km` or falling back to a place name. The right
      figure was already on the wire as `viewerMatch.distanceKm` — this kitchen's own
      straight-line distance (D-30) — and `lib/geo.displayDistanceKm` now picks between the
      two for every screen, desktop and mobile. Two backend `reasons` strings were qualified
      ("in a straight line", "estimated collection time"); no scoring logic changed.
      Reasoning in `DECISIONS.md` D-33.

      Left alone deliberately: `components/FutureIntelligenceSection.tsx`, which the audit
      classified as **acceptable** because every entry carries an explicit `phase` and
      `status` badge — that is the labelling D-31 asks for.

- [x] **I-3 · Stop claiming requirements drive matching.** `[QA-2 · QA-11 · repo]` — **done,
      commit `b5e09ee`, 2026-09-04.** Re-verified against the source first:
      `matching.py` imports only `Donation` and `Recipient`, `score_pair` takes only those
      two, `MatchOut` carries no requirement field, `select(Recipient)` in the ranking paths
      loads no `requirements` relationship, and the only readers of the table in the whole
      backend remain `routers/organisations.py` and `seed.py`. Requirements are a **notice
      board** and stay one — no schema, API, lifecycle or test changed, and **no backend
      file changed at all**.

      Seven strings corrected across three files. Desktop `pages/ngo/NGORequirements.tsx`:
      *"so FoodLink AI prioritizes donations matching your requirements"*, **"AI Scanning
      Active"**, **"Auto-matching enabled"**, and the **"Daily Recurring"** badge (now
      "Needed daily" — it describes the need, not a scheduler that does not exist). Mobile
      `NGORequirements.tsx`: *"lets the platform rank incoming surplus against your demand
      before you even open the app"* and *"matching donations are pushed to you first"*.
      Mobile `NGOHome.tsx`: *"Listings matching this are ranked for you first."*

      ⚠️ **Also corrected, and worth recording because it was not in the audit:** four toast
      subtitles read *"Donors can now see what you need"* / *"Donors now see the revised
      need"*. `useRequirements()` is called by three components and **all three are NGO
      screens** — no donor surface renders requirements at all, which is QA-3 / the donor
      needs board in *Blocked*. The toasts now say the requirement is on the kitchen's own
      demand board, which is what actually happens.

      Building the claim instead remains the first *Blocked* question and R-35. The
      roadmap surfaces that name "Demand-aware redistribution" were left alone: all three
      (`FutureIntelligenceSection`, `AdminDashboard`, `Landing`) carry an explicit phase and
      a `done: false` / `status: 'Planned'` badge, which is exactly the labelling D-31
      asks for.

- [x] **I-4 · Stop offering notification settings that reach nothing.** `[QA-5 · repo]` —
      **done, commit `6863451`, 2026-09-04.** Confirmed against the source first:
      the backend contains no occurrence of `notif`, `sms`, `smtp`, `twilio`, `sendgrid`,
      `fcm` or `websocket` — there is no delivery mechanism of any kind to wire a
      preference to.

      **All ten toggles removed** rather than relabelled (2 + 3 + 3 + 2): the desktop
      donor's "real-time email updates…" / "SMS alerts…" checkboxes, whose submit button
      answered *"Profile saved"*; `mobile/DonorProfile.tsx`'s "Auto-accept best match"
      (which claimed an automatic lifecycle transition, not merely an alert), "Pickup
      reminders" and "Weekly impact digest"; `mobile/NGOProfile.tsx`'s whole
      **Notifications** section; and `mobile/VolunteerProfile.tsx`'s "Only alert me under
      3 km" / "Available after 8 PM". Removal over labelling because none of them is a
      *setting* — there is nothing for a "not yet active" badge to be about, and a disabled
      control still advertises a roadmap the project has not committed to (D-31, D-36).

      **Four adjacent claims reworded**, not just the controls: `mobile/CreateDonationCamera`'s
      *"Kitchen notified · awaiting accept"* → *"Listed for kitchens · awaiting accept"*;
      `pages/donor/CreateDonation`'s *"…to notify the best recipient organization"* → the
      scoring it really does, with organisations seeing the donation when they browse;
      the desktop volunteer's *"Active & ready to receive new pickup dispatch alerts"* →
      *"On duty — show me as available on the courier roster"*; and both availability
      toasts, which promised *"you will be offered pickups" / "no new pickups will be
      offered"* — an offer mechanism that does not exist, since every courier sees the same
      open pool regardless of the flag.

      ⚠️ The volunteer **availability** control was preserved on both screens, as this entry
      required: `is_available` is a real `VolunteerUpdate` field. Verified end-to-end after
      the change — toggling it in the mobile UI wrote `is_available = 0` to the database.
      Nothing was replaced with `localStorage`, a mock, or a new endpoint.

- [x] **I-5 · Remove or ground the donor verification badges.** `[QA-6 · repo]` — **done,
      commit `6c82739`, 2026-09-04.** The whole trust model was mapped from the
      source first and is one boolean: `Recipient.is_verified`, meaning *"an administrator
      vouched that this organisation is real and is where it claims to be"* — default
      `false`, writable only by `POST|DELETE /admin/recipients/{id}/verify`, deliberately
      not settable through `PATCH /recipients/me`, read by exactly two consumers
      (`matching.score_pair` and the `ACCEPTED` gate). No donor or volunteer verification
      exists anywhere in the model; no FSSAI field, provider, upload path or evidence store
      exists at all.

      **Removed:** the unconditional *"Verified Institutional Donor"* badge
      (`pages/donor/DonorProfile.tsx`) and its mobile twin *"Verified donor"*
      (`mobile/DonorProfile.tsx`) → a neutral *"Donor account"* chip with a `Building2`
      icon; the *"FSSAI Hygiene Standards Compliant"* panel → **Safe Handling Guidance**,
      the same advice reframed as guidance addressed to the donor and stating plainly that
      *"FoodLink does not inspect kitchens or assess hygiene"*; the page subtitle's *"kitchen
      safety badges"*; and `VolunteerHistory`'s *"Verified Delivery"* fallback for a missing
      timestamp → *"Not recorded"*. `MatchAnalysis`'s *"Verified Recipient Organization"* is
      true by construction (`score_pair` returns `None` for an unverified recipient) but now
      names the authority: *"Admin-verified recipient organisation"*.

      **Preserved unchanged:** every genuine recipient surface — both `NGOProfile`s, both
      `NGOImpact`s, `NGOAvailableDonations`, `AdminOrganizations` — all of which already
      render conditionally from `me.isVerified`. Both states were exercised in the running
      app: a seeded kitchen shows *"Verified recipient"*, a freshly registered one shows
      *"Awaiting verification"*. No backend, schema, seed or API change. See `DECISIONS.md`
      D-37.

- [x] **I-6 · Make the courier line follow the donation's status.** `[QA-9 · repo]` — **done,
      commit `b41c4e6`, 2026-09-04.** `pages/ngo/NGOAcceptedDonations.tsx` chose both
      the courier name and the dispatch caption from `volunteerName` alone, on a screen whose
      list includes `COMPLETED`. I-2 had already replaced the worst string (*"En route on
      vehicle"*) with *"Courier assigned"*, but the residue was a real misreading: that
      present-tense line, under a "COURIER DISPATCH" heading, was still the last thing a
      finished delivery said about itself, and an `ACCEPTED` donation whose courier was released
      still named that courier — `volunteer_id` is set by the claim and no transition clears
      it (`routers/donations.py`).

      **Changed:** a module-level `COURIER_STAGE`, total over `DonationStatus` in the same
      shape as `StatusBadge`'s `STATUS_CONFIG`, gives each status a caption and a
      `courierBound` flag; the caption is read from it, and `assignedCourierName()` returns
      the name only where the lifecycle actually binds a courier. `ACCEPTED` → *"Open to
      nearby couriers"*, `VOLUNTEER_ASSIGNED` → *"Courier assigned, heading to pickup"*,
      `PICKED_UP` → *"Collected — on the way to you"*, `DELIVERED` → *"Handed over at your
      kitchen"*, `COMPLETED` → *"Delivered — receipt confirmed"*. The courier's name is kept
      in every bound state, `COMPLETED` included, and still labels the handover schematic's
      courier node. No new status, no backend change, no lifecycle change. See `DECISIONS.md`
      D-38.

      The donor's equivalent block (`DonationDetails.tsx:101`) and `mobile/NGOAccepted.tsx`
      print the courier's name with no state claim attached, so neither carries the defect
      and neither was touched.

- [x] **I-7 · Surface "overdue" where the deadline has passed.** `[QA-7 · repo]` — **done,
      uncommitted working tree, 2026-09-04.** `components/StatusTimeline.tsx` was driven
      purely by `status`, so a donation whose collection window closed hours ago read
      *"Matched · Current"* with nothing said about the deadline — the detail view was the
      one surface that never mentioned it, while the list and card surfaces already used
      `deadlineStatus()`.

      **Changed:** the timeline now calls the same `lib/time.deadlineStatus()` on the
      donation it already holds — no prop was added, and the three call sites
      (`donor/DonationDetails`, `ngo/NGOAcceptedDonations`, `ngo/NGOAvailableDonations`) are
      untouched. When the deadline has passed **and** the status is one of the four in
      `AWAITING_COLLECTION` (`AVAILABLE`, `MATCHED`, `ACCEPTED`, `VOLUNTEER_ASSIGNED`), the
      current step gains an *Overdue* chip in `URGENCY_STYLES.expired` and a line reading
      *"Pickup deadline passed at 8:00 PM"*. Once the food is collected the deadline has been
      answered, so `PICKED_UP`, `DELIVERED` and `COMPLETED` are never marked overdue however
      long ago that time was — D-38's rule one field further along. `CANCELLED` and `EXPIRED`
      keep their existing panels and gain nothing.

      **Not done, deliberately:** no new lifecycle state, no client-side expiry, no timer —
      the marker is computed at render like every other deadline surface, and the row is
      still exactly the status the server says it is. The sweep that would actually retire
      these rows remains unbuilt (*Backlog → E*). See `DECISIONS.md` D-39.

- [ ] **I-8 · Correct the explainability panel's criterion descriptions.** `[QA-12 · D-06]` — **S**
      `components/MatchAnalysis.tsx:98–122` describes *Recipient Capacity* as "Cold storage
      and immediate consumption bandwidth" — `matching._capacity_score` measures headroom
      after the donation and nothing else, and `COLD_STORAGE` is the dead constant already
      tracked in group F — and describes *Pickup Availability* as "Recipient intake
      volunteers ready before deadline", where `_deadline_score` measures slack between now
      and the deadline less assumed travel. Smaller than the rest of this group, but it is
      the one panel whose entire purpose is to explain the score correctly (D-06), so a
      wrong caption there costs more than it would anywhere else.

- [ ] **I-9 · Fix the donor profile form's field wiring.** `[QA-12 · repo]` — **S**
      `pages/donor/DonorProfile.tsx` binds the input labelled **"Email Address"** to
      `profile.operatingHours` (line ~120), so the field renders empty and edits an
      unrelated key; `profile.email` is initialised and never rendered. The same form
      initialises `phone` and `location` to `''` instead of reading the signed-in account,
      unlike `VolunteerProfile.tsx`, which syncs from `useMyVolunteer()` in a `useEffect`.
      Grouped here rather than in B because it is the same screen as I-4 and I-5 and should
      be opened once.

---

## Blocked — open decisions, not unbuilt work

Each of these has a working implementation whose *intended* behaviour has never been
settled. They sit here rather than in *Backlog* so that nobody implements one by guessing.

### Opened by the QA audit of 2026-09-02

> Three of these four are capabilities the interface currently claims and the code does
> not have; Group I stops the claim (road distance → I-2, requirement matching → I-3, the
> impact report → I-1), and these entries are the separate question of whether to **build**
> them. Answering "no" to any of the three therefore costs nothing beyond the wording change
> Group I already covers. The fourth — the donor needs board — is the opposite shape: a
> capability the data supports and the UI never offers, so it is a straight yes/no.

- **Should the match distance become real road/travel distance?** `[QA-1 · R-30]`
  Today it is great-circle only: `matching.haversine_km` on two coordinate pairs, feeding
  `_distance_score` (25% of the total weight) and a travel estimate of
  `(distance / 20) * 60` minutes — a flat 20 km/h assumption, in a project whose subject
  is urban logistics. The straight line under-states every real journey, and does so
  unevenly: a river, a railway line or a one-way system distorts some pairs far more than
  others, so it is not a constant the weights absorb. **What deciding "yes" costs, and why
  it is a decision rather than a task:** it puts the first outbound HTTP dependency into a
  backend that currently makes none (`ARCHITECTURE.md` — *External services: none*), and
  with it an API key, a quota, a per-request failure mode and a latency budget on the
  ranking path — which runs on every donation POST and now, since D-30, on every donation
  read by an NGO. It needs a cache (recipient locations are near-static, so a
  distance-matrix cache is natural) and a defined fallback for when the provider is
  unreachable — presumably haversine, which means both numbers stay in the system anyway.
  It also weakens D-17's no-mocks testing stance. A cheaper middle option exists and should
  be considered first: keep haversine, apply a calibrated detour factor, and **say so** in
  the UI. **Do not implement any of this before the decision.**

- **Should requirements actually drive matching?** `[QA-2 · R-32]`
  They do not today — `matching.py` never sees a `Requirement`. Making them count means
  choosing what a requirement *is* to the matcher: a sixth weighted criterion (the
  `WEIGHTS` dict must keep summing to 1.0, so every existing weight is re-tuned by the
  choice), or a gate like verification and radius (D-06's shape — but a kitchen with no
  posted requirement would then rank nowhere, which is worse than today), or a tie-break.
  It also needs a matching rule between a donation's free-text `category` and a
  requirement's free-text `food_type` — neither is a controlled vocabulary, so this
  overlaps R-32 (recipient food-category preferences) and would give `COLD_STORAGE` its
  purpose at last. **Scope if approved: M–L**, mostly in `matching.py` and its tests, and
  it changes every score on every screen — which is a demo-visible event worth scheduling
  deliberately.

- **Should donors see a needs board?** `[QA-3 · §8.2]`
  There is a real product gap here and **no authorization obstacle to close it.**
  `GET /api/requirements` is already `Depends(get_current_user)` with no role gate and no
  ownership scope, so every authenticated caller reads every organisation's active
  requirements; `AppContext.load()` already fetches them for **every** role, so a donor's
  browser holds this data today and simply never renders it — donor navigation
  (`DonorLayout.tsx:11`) has no Needs entry, only the NGO's does. ⚠️ This is **not** a hole
  in D-26: that decision scoped `RecipientOut` because it carries `contact_person` and
  `phone`, and it explicitly recorded that "peer organisation *names* are already public
  through `GET /api/requirements`". `RequirementOut` carries a name and a need, no contact
  details. **So the question is product, not security:** does a donor deciding what to
  cook or list benefit from seeing standing demand, and does showing it change how donors
  behave in a way the project wants? If yes, it is a read-only page over data the client
  already has — **S**, and no endpoint changes. Two things to settle alongside: whether the
  board should be scoped by radius rather than shown platform-wide, and whether
  `GET /api/requirements` should gain an explicit scope decision of its own now that it is
  the one unscoped cross-organisation read left (it is defensible, but it is currently
  unscoped by omission rather than by a recorded decision).

- **Should there be a real, exportable impact report?** `[QA-4 · repo]`
  ✅ **The misleading half is closed:** I-1 deleted both stub buttons (2026-09-03), so
  nothing in the app now claims a verified artefact was produced. **This decision is
  therefore free to answer either way**, and answering "not now" costs nothing. Whether a
  real one should exist is the open question, and it is a larger one than it looks: a *verified* impact
  certificate is a claim about evidence, so it should be generated server-side from
  `status_events` — the ledger D-01 exists to make exactly this kind of statement
  defensible — rather than assembled in the browser from whatever the client happens to
  hold. That means a new endpoint and a rendering choice (CSV is trivial and honest;
  PDF is a new dependency). Note `AdminDonations.tsx:55` already does a real client-side
  CSV download, so the cheap honest version has a working precedent in the repository.
  **Scope if approved: M for CSV, L for a server-rendered PDF.**

### Older open decisions

- **Should a donation stuck in `ACCEPTED` past its deadline expire?** The sweep only
  touches `AVAILABLE` and `MATCHED` (`code/foodlink/routers/admin.py:200`), so an
  accepted-but-never-delivered donation stays in that state forever and never counts as an
  expiry loss. Deliberate or oversight — undecided. `[B-1 · §14.4]`
  ⚠️ **Not the same thing QA-7 saw.** QA found a **`MATCHED`** donation past its deadline,
  which this sweep *does* cover — it had simply never been run, because nothing schedules
  it (group E). The state machine is behaving correctly in that case; only the display is
  silent about it (I-7). This entry remains open on its own terms.
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

### Lifecycle authorization audit (Task 14) — committed `efd5fd8` `[repo]`
- [x] **Every edge of `ALLOWED_TRANSITIONS` enumerated against `TRANSITION_ROLES` and
      `OWNED_TRANSITIONS`.** Three edges act on an already-bound donation with no
      ownership gate. Two are sound: `ACCEPTED → EXPIRED` (admin-only, unrestricted scope)
      and `ACCEPTED → VOLUNTEER_ASSIGNED` (settled atomically by `_claim_pickup`, D-28).
- [x] **The third was an organisation-takeover hole, now closed.**
      `VOLUNTEER_ASSIGNED → ACCEPTED` — releasing a pickup — is role-gated to `ngo`/`admin`
      and was unscoped, so **any verified kitchen could take custody of a donation another
      kitchen had accepted and a courier was already carrying**: the binding side effect
      moved `recipient_id`, `accepted_donations` and `match_score` on to the caller, who
      then owned it for every later gate including `COMPLETED`. The same account got a
      **404 on the plain read** of that donation. Reproduced through the endpoint before
      the fix.
- [x] **The gate is now a predicate, not a set membership test.**
      `donations._needs_ownership(donation, target)` keeps every `OWNED_TRANSITIONS`
      target and adds `ACCEPTED` whenever `donation.status` is outside
      `OPEN_TO_RECIPIENTS` — the case a target-keyed set cannot express, because the
      answer depends on the state the donation is in. See `DECISIONS.md` D-35.
- [x] **6 regression tests** in `code/tests/test_lifecycle_authorization.py`; two fail
      against the pre-fix code. Full suite 162 → 168 passing; `alembic check` clean; no
      existing test modified, no schema/API/frontend change.
- [ ] ⚠️ **Not fixed, reported instead** — two things the audit found that are outside its
      authorization scope, for the Project Manager to rule on: `MATCHED → AVAILABLE` is
      legal in `ALLOWED_TRANSITIONS` but has no `TRANSITION_ROLES` entry, so it is a dead
      edge refused 403 for every role including admin (fails closed); and a release
      followed by a re-acceptance increments the owning organisation's
      `accepted_donations` a second time and leaves `volunteer_id` set.

### Lifecycle write authorization — committed `551c96d` `[repo]`
- [x] **`POST /api/donations/{id}/status` now scopes the write for the transitions that
      act on a donation that is already somebody's.** `donations.OWNED_TRANSITIONS`
      (`PICKED_UP`, `DELIVERED`, `COMPLETED`, `CANCELLED`) re-resolves the row through
      `_get_readable_or_404` — the D-24 read clause — after the `ALLOWED_TRANSITIONS` and
      `TRANSITION_ROLES` gates. See `DECISIONS.md` D-34.
- [x] **What was open:** the role gate was the only gate on those four. Any volunteer
      account could set `PICKED_UP` and `DELIVERED` on a pickup assigned to a *different*
      courier; any NGO account could `COMPLETED` a donation its organisation never
      accepted — incrementing that other organisation's `completed_donations` counter,
      which the platform reports as evidence; and any donor could `CANCELLED` another
      donor's donation, out from under the kitchen and courier working on it. All four
      reproduced through the endpoint as a `200`.
- [x] **`CANCELLED` looked guarded and was not.** `is_owning_donor` was consulted only
      after `user.role not in allowed_roles`, and `donor` is itself in
      `TRANSITION_ROLES[CANCELLED]` — so the comparison was unreachable and the header
      comment promising "the donor who owns a donation … may always cancel" described a
      test that never ran. The dead clause and its variable are deleted, not repaired:
      ownership has one home now. No answer changed — `ngo`/`volunteer` targeting
      `CANCELLED` still fail the role gate with the same 403 (pinned by a test).
- [x] **No new authorisation architecture.** The read scope already evaluates to exactly
      the party each transition belongs to — the posting donor, and once a donation has
      left the open pool the assigned courier or the accepting organisation — so the fix
      reuses that clause rather than adding a second ownership test to keep in step with
      it. Denial is the read path's 404, not a 403.
- [x] **Behaviour preserved:** `ACCEPTED` and `VOLUNTEER_ASSIGNED` are deliberately not
      scoped (they act on a donation nobody is bound to yet, and each binds its own party);
      the 409 for an illegal transition and the 403 for a wrong role still come first and
      are unchanged; `CANCELLED` is still legal from every state the transition table
      already allowed, including `VOLUNTEER_ASSIGNED` and `PICKED_UP`; the courier claim's
      concurrency guard (D-28) is untouched; an administrator's stand-in path is
      unnarrowed.
- [x] **No schema change, no migration, no frontend change** — no request or response
      shape moved, and the only new status code appears where a write used to wrongly
      succeed.
- [x] 14 tests in `code/tests/test_lifecycle_authorization.py`; **four fail against the
      pre-fix code with a `200` where a `404` belongs.** The refusals assert the stored
      status as well as the response, so they prove the write did not happen. Full suite
      148 → 162, no existing test changed.

### QA audit and roadmap reconciliation — 2026-09-02 `[QA-1 … QA-12]`

Documentation only. **No source file was changed**, no schema touched, no dependency added;
148 backend tests pass unchanged. Twelve manual-QA observations were each traced
frontend → API → router → matching/service → model before being classified, and the
resulting work is *Backlog → I*, four new entries in *Blocked*, and reconciliation of
existing items in F and G.

| # | Observation | Classification | Where it now lives |
|---|---|---|---|
| 1 | Distance is straight-line, not road | **Intentional, but misleadingly presented** | ✅ wording done → I-2 · building it → *Blocked* · `R-30` |
| 2 | Requirements do not drive matching | **Misleading UI claim** — verified: `matching.py` never references `Requirement` | ✅ wording done → I-3 · building it → *Blocked* |
| 3 | No donor needs board | **Product gap; no security obstacle** — the endpoint is already open and the client already fetches it | *Blocked* |
| 4 | Impact figures partly invented; PDF export is an `alert()` | **Confirmed — the audit's most serious finding** | I-1 · real export → *Blocked* |
| 5 | Notification settings send nothing | **Misleading UI claim** — 10 dead toggles, 4 screens | ✅ toggles and claims removed by I-4 · delivery itself → `R-28` |
| 6 | "FSSAI Compliant" / "Verified Institutional Donor" | **Misleading UI claim** — no donor verification exists in the model at all | ✅ both removed by I-5 · D-37 |
| 7 | Past-deadline donation still "Matched — Current" | **Acceptable state, incomplete display** — the row *is* `MATCHED`; the sweep is unscheduled (group E) | ✅ display fixed by I-7 · sweep → group E · `B-1` unchanged |
| 8 | Three match-score follow-ups | **Confirmed still open, unchanged** | group F, all three re-verified |
| 9 | "En route" on a completed donation | **Confirmed bug** — the line ignores `status` | ✅ false claim removed by I-2 · line made status-aware by I-6 |
| 10 | "LIVE CORRIDOR TRACKING" / "Live GPS" | **Misleading UI claim** — no GPS, no routing, no map in the repository | ✅ I-2 |
| 11 | "Daily Recurring" requirements | **Storage only** — the flag is written and displayed, never acted on | ✅ relabelled "Needed daily" by I-3 · real recurrence → `R-35` |
| 12 | Other findings | Hard-coded seed identities on three screens; two wrong criterion descriptions in the explainability panel; the donor "Email Address" input bound to `operatingHours` | I-1, I-8, I-9 |

- [x] **The backend was checked and largely cleared.** Every server-computed number the
      audit traced is derived from real rows: `/api/metrics` from `status_events` (D-01),
      `reliability_score` from the recipient's own counters, `viewerMatch` live through
      `score_pair` (D-30), `distanceKm` from two coordinate pairs. The invented figures are
      all in the browser. The one substantive backend observation is that
      `GET /api/requirements` is unscoped — recorded in *Blocked* as worth an explicit
      decision, and **not** a contradiction of D-26, which already accounted for it.
- [x] **A boundary was drawn rather than a blanket rule applied.**
      `components/FutureIntelligenceSection.tsx` and `MatchAnalysis`'s "Rule-Based Model"
      chip and roadmap note were classified **acceptable** — they carry explicit phase and
      status labelling. `DECISIONS.md` D-31 records that distinction so this audit does not
      have to be repeated by argument.
- [x] Existing roadmap items reconciled instead of duplicated: `R-28`, `R-30`, `R-35` each
      gained the audit's finding; the three group-F follow-ups gained file and line
      references and confirmation against `23c27f4`; `B-1` gained a note distinguishing it
      from QA-7.
- [x] ⚠️ **Nothing was promoted into *Next*.** The audit recommends an order and says so as
      a recommendation; the promotion is a Project Manager call.

### Match-score consistency — `23c27f4` `[QA]`
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
      the donation unscoped, ~~because its own role/ownership gates authorise it~~.
      ⚠️ **That reasoning was wrong for three transitions** (no ownership gate existed for
      `PICKED_UP` / `DELIVERED` / `COMPLETED`) and is corrected by the lifecycle
      write-authorization entry below. The read-scope work itself stands as described.
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
