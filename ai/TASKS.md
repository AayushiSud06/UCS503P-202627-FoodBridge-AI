# TASKS — FoodLink / FoodBridge-AI

> Verified against the repository on 2026-09-05. HEAD is `883bcee` (Task 26: the
> match-distance privacy fix, `HA-3`, D-45); the working tree carries the **uncommitted
> Task 27 requirement-reopen work** (`F-1`, D-46) described under *Current*. Task 25's
> donor needs board and requirement read scope (D-44) are committed as `e72d4c2`, Task
> 22's matcher correction as `a9f190b`, Task 23's frontend test harness as `f33aeae` and
> Task 24's landing-page correction as `9b11353`.
> The lifecycle write-authorization work is committed — D-34 as `551c96d`, the D-35
> ownership-takeover follow-up as `efd5fd8` — as are the I-4 notification-honesty pass
> (`6863451`), the I-5 trust/verification pass (`6c82739`), the I-6 courier status-display
> fix (`b41c4e6`), the I-7 overdue-deadline fix (`fc91091`), the I-8 match-criteria wording
> fix (`ed56bd5`), the I-9 donor-profile binding fix (`c274e99`) and the Task 21
> foundation fixes (`e7032ea`, now HEAD).
> Context: `PROJECT_STATE.md`.
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
> *Blocked* · `HA-n` = finding *n* of the **project health audit of 2026-09-05**, which
> changed no source and whose six confirmed defects carry that tag below. Every `HA-n` was
> reproduced against a throwaway database rather than inferred.
>
> **Estimates.** Hour figures are the roadmap's own (§22); where it gives none, the bucket
> is **S** (under an hour), **M** (a few hours), **L** (a day or more). All are for
> ordering, not promises.

---

## Current

**Uncommitted in the working tree: Task 27 — reopening retired requirements, complete.**
Task 26 is now committed (`883bcee`) and its entry has moved to *Completed*.

### Task 27 — `F-1` · a retired requirement gets a reader, and the portal a reopen action `[F-1 · D-29 · D-44 · D-46]`

**An NGO can now see and reopen its own retired needs.** D-29 kept the row on retirement
and left it unreadable, so reopening was API-only; D-44 narrowed the board without adding
a way to see what had left it. Both ⚠️s are answered by the parameter D-29 itself
described. **No schema change, no migration, no new status column, no new endpoint.**

- **The lifecycle filter became a second, independent axis.**
  `GET /api/requirements?includeInactive=true` drops the `is_active` term when
  `organisations._may_read_inactive(user)` allows — **admin and ngo only**. It is applied
  *beside* `_visible_requirements()` (D-44), never instead of it, so asking for history
  cannot widen whose history it is. `_visible_requirements` itself is unchanged.
- **A donor is refused the flag, not filtered after it.** The donor listing stays
  active-only whatever the query string says; the needs board is a board of what is open
  now. A courier's scope is empty either way. The default listing is byte-for-byte what
  it was for every caller.
- **Reopening is the existing PATCH.** `isActive: true` on
  `PATCH /api/requirements/{id}`, the same field and route retiring already used (D-29).
  `AppContext.reopenRequirement` mirrors `retireRequirement`; no new client method.
- **One slice, two selectors — not a second source of truth.** `AppContext` sends
  `includeInactive` for an `ngo` account and nobody else. `useRequirements()` now returns
  the **active** needs, so the donor needs board and the mobile NGO home are untouched;
  the new `useAllRequirements()` returns the whole slice and `pages/ngo/NGORequirements.tsx`
  is its only reader. The client filter is presentation — the server never sends a donor
  an inactive row.
- **The portal shows retired needs in their own section**, set back, chipped *Retired*,
  saying "off the demand board", with a single **Reopen** action. The active card keeps
  Edit and Mark fulfilled exactly as they were; the two states share one card component.
  Nothing claims a need was *fulfilled* rather than simply retired — the row cannot tell
  the two apart (D-29) and the card does not pretend it can.
- **`NGORequirement.isActive` can now be false on the client**, where its comment said it
  was "always true through the list endpoint". Corrected in `frontend/src/types/index.ts`.
- **Tests.** `test_requirement_reads.py` gained 10: an NGO reads its own retired needs and
  still not a rival's, an administrator reads them platform-wide, a donor is refused the
  flag and keeps the active board, a courier still reads nothing, the default listing is
  unchanged, a reopened need returns to every board it was on, and the combined listing
  keeps newest-first order. New `pages/ngo/__tests__/NGORequirements.test.tsx` (8) holds
  the portal contract, and new `context/__tests__/requirements.test.tsx` (7) holds the
  boundary the shared slice created — including the **real** `DonorNeedsBoard` rendered
  through the **real** provider with a retired row in the payload, which shows none of it.

Validation: `pytest code/tests` **252/252** (242 → 252, ~177 s), `npm test` **74/74**
(10 files, 59 → 74), `npm run typecheck` clean, `npm run build` clean, `alembic check`
reports no new upgrade operations. Verified in the browser as the seeded NGO account
(`raj@helpinghands.org`): retiring a need moved it into the retired section, reopening
returned it to the active board, no console errors. `GET /api/requirements?includeInactive=true`
as the seeded donor returned the active board only.

### Task 24 — the landing page (*Next* step 4, committed `9b11353`)

**`pages/Landing.tsx` no longer prints a platform figure.** All three sites the health
audit recorded are gone, and **nothing was replaced with a substitute number**: `GET
/api/metrics` is behind `get_current_user`, so a pre-login page has no source, and inventing
a smaller literal would have been the same defect at a lower volume.

- **The four-stat strip → how impact is counted.** `1,240+` meals, `32` partner
  organizations, `56` volunteers and `84` pickups are replaced by four non-numeric claims
  the repository backs: server-stamped status events, a weighted sum of five published
  criteria, the verified-recipient gate (`matching.py:195`), and per-account figures from
  `lib/impact.ts`. The section keeps its `#impact` id — `Navbar` anchors to it — its grid
  and its dividers; only the cell contents changed. A caption says plainly why no total is
  published.
- **The hero "Live this term" card → how a handover is recorded.** The pulsing dot,
  `1,240+`, "32 partner NGOs" and "18% more than last month" are gone; the card keeps its
  rotation, shadow and three-part layout and now names the lifecycle it actually stamps.
- **`HOW_IT_WORKS`'s "in real time" → what the dashboards actually do.** They total the
  account's own records when the page loads. There is still no polling, SSE or WebSocket
  (`ARCHITECTURE.md` constraint 7).
- **The sample match card was labelled, not deleted** — *Example match analysis*, a static
  dot in place of the pulsing one, and an *Illustrative sample* footnote. Its five criteria
  are the matcher's real ones (`WEIGHTS`), so D-31's labelling remedy applies rather than
  removal. It was not in the audit's list; it is the same defect and it was one label away.
- **New: `pages/__tests__/Landing.test.tsx`** (4 tests). It asserts the **absence** of the
  eight literals and of any "real time"/"live" wording, plus the `#impact` anchor — so a
  redesign stays free while a reintroduced figure fails.

Validation: `npm test` **44/44** (7 files), `npm run typecheck` clean, `npm run build`
clean, and the page read in the running dev server at desktop and tablet widths with no
console errors. The backend suite was **not** re-run — no backend file was touched.

### Task 23 — the frontend test harness (*Next* step 3, committed `f33aeae`)

**`npm test` in `frontend/` runs 40 tests over 6 files in ~1.5 s, all passing.** Vitest 3.2
+ Testing Library, configured as a `test` block in the project's existing `vite.config.ts`
so tests resolve modules exactly as the build does — D-43 records the choice and the Vite 5
constraint that pinned the version. **No application source file was modified**: the change
is four devDependencies, the config block, two `package.json` scripts, and seven new files
under `frontend/src`.

- **Seams covered** — `lib/adapters.ts` (9), `lib/time.ts` (8), `lib/api.ts` (8),
  `lib/impact.ts` (6), `lib/geo.ts` (4), `components/ProtectedRoute.tsx` (5). These carry
  the arithmetic behind D-32, D-33 and D-40, each of which closed with *"Nothing tests
  this"*.
- **Why these and not components** — the regressions that matter here are type-correct.
  `viewerMatch.distanceKm` and `distanceKm` are both `number | null`; `deadlineScore` and
  `pickupAvailabilityScore` are both `number`. Swapping either pair compiles and ships.
  ⚠️ Confirmed by mutation: inverting the D-33 precedence in `lib/geo.ts` passes `tsc`
  and fails the suite.
- **Two stubs, both process boundaries** — `fetch` in the api suite, `useAuth` in the
  route-guard suite. Nothing else is mocked; `src/test/fixtures.ts` builds wire objects
  typed as the real `api.ts` interfaces, so backend drift becomes a compile error.
- ⚠️ **Not wired into CI.** `ci.yml` still runs `npm run build` only, so the suite gates
  nothing automatically. That step is the one piece of *Next* step 3 not done — see
  *Backlog → D*.
- ⚠️ **`npm run lint` is still dead** — it calls an `eslint` that has never been a
  dependency. Pre-existing, deliberately untouched, still in *Backlog → H*.

Validation: `npm test` 40/40, `npm run typecheck` (`tsc --noEmit`) clean, `npm run build`
clean (1647 modules, no test code in the bundle). The backend suite was **not** re-run —
no backend file was touched.

### Task 22 — the matcher correction (*Next* step 2)

The matcher's two size criteria are corrected; **216 backend tests pass** (191 → 216), `alembic check` reports
no drift, and **one file changed** — `code/foodlink/matching.py`. No schema, migration, API,
frontend, dependency or configuration change, and no weight was touched.

- **`HA-5` — units.** `Recipient.capacity` counts meals; the product already fixed that in
  three places and `matching.CAPACITY_UNIT` now names it rather than a new column naming it
  again. Only a donation counted in meals is compared with capacity. For Kg, Boxes, Pieces
  or anything unrecognised, both size criteria return `UNASSESSED_SIZE_SCORE` (50) and
  `reasons` says the size was not assessed. **Nothing is converted** — the repository holds
  no mass field, no per-category yield table and no conversion rule, and inventing one would
  put a fabricated constant inside the score the platform asks people to check by hand.
  Abstaining is safe because the unit belongs to the *donation*: every candidate gets the
  same value, so the pair cancels out of the comparison and such donations rank on distance,
  deadline and reliability.
- **`HA-4` — collinearity.** `_capacity_score` now measures **absolute** spare meals,
  saturating at `FULL_HEADROOM_MEALS` (100, the default capacity); `_quantity_score` is
  unchanged and stays the ratio. Breaking the collinearity required an absolute term —
  any scale-free function of `(quantity, capacity)` collapses back into the ratio. Along the
  axis the matcher ranks on (one donation, many kitchens) the pair now has a **global
  maximum at `capacity = quantity + 100`** that is interior — lower for smaller kitchens and,
  asymptotically, for arbitrarily large ones — where the old pair's maximum sat on the
  boundary (`capacity = quantity`). The best candidate is the kitchen that takes the donation
  comfortably *and* keeps a full day's room. On the seeded kitchens a 50-meal donation now
  ranks Helping Hands first on headroom despite the lowest fit score of the three.
  ⚠️ **Not a single-peaked curve:** between exact fit and saturation the two criteria cross,
  leaving a shallow local minimum, so a kitchen slightly larger than the donation scores
  marginally below one sized exactly to it. Recorded in D-42 rather than designed around.
- **Discrimination, stated defensibly.** Over feasible capacities for a fixed donation the
  old pair spanned **exactly 5.00 points** (`30 + 5r`) whatever the donation size; the new
  pair spans roughly **10.6–17.5 points for donations of 20–500 meals**. ⚠️ The "10.5 vs
  3.75" figures quoted in the first Task 22 report are **sample-set specific** — one chosen
  spread of candidate kitchens — and are not general bounds.
- ⚠️ **`WEIGHTS` deliberately unchanged**, so `R-31` (weight tuning) is now unblocked and is
  separate work. Correcting what a criterion measures had to precede deciding how much it
  counts.

**No existing test needed modification.** `test_match_score_consistency.py` reconciles the
breakdown against the published weights and still passes unchanged, which is the check that
the contract held.

---

**Nothing else is in progress.** No feature branch, no TODO/FIXME markers in
`code/foodlink/` or `frontend/src/`. See *Completed*.

---

## Next — hardening (recommended, ordered)

**All four steps are done** — step 1 as `e7032ea`, step 2 as `a9f190b`, step 3 as
`f33aeae`, step 4 as `9b11353`.
These four steps are the health audit's confirmed defects in the order it recommended, and
they are a bounded list rather than an open-ended hardening programme: its strategic
conclusion is that everything *after* step 4 is unbuilt infrastructure rather than broken
behaviour, and should be sequenced with the deployment it serves rather than ahead of it.
**Steps 1–4 are done, and the donor needs board that followed them is done too** (Task 25,
*Current*). What remains in *Blocked* is open questions rather than sequenced work.

### ✅ Step 1 — the three demonstrated defects — **DONE (Task 21, `e7032ea`)**

`[HA-1 · HA-2 · B-6 · R-19 · S-6 · D-41]` — **S**. Grouped
because each is a few lines and each needs a regression test that does not exist yet.

- [x] **`HA-1` · Scope `GET /api/volunteers`.** It is gated by `require_roles(admin, ngo)`
      (`code/foodlink/routers/organisations.py:209`) and applies **no ownership scope**, so
      `VolunteerOut` — name, location, availability and **phone** — is returned in full to
      any account holding the `ngo` role. Registration accepts `role: "ngo"` from a stranger
      and the row starts `is_verified=False`; verification gates ranking and acceptance, not
      this endpoint. Reproduced: a freshly registered, unverified NGO receives `200` and the
      whole roster. ⚠️ This is **D-26's own recorded objection, applied to `RecipientOut`
      and never to `VolunteerOut`.** The shape to follow is `_visible_recipients`: a WHERE
      clause — admin unrestricted, an `ngo` seeing only the couriers bound to its own
      donations, everyone else nothing. `AppContext.optional()` already treats a narrow
      result as ordinary. Dropping `phone` from the non-admin response is the cheaper
      alternative. `pages/admin/AdminVolunteers.tsx` is the only screen wanting the full
      roster.
- [x] **`HA-2` · Clear `volunteer_id` when a pickup is released, and stop the second
      `accepted_donations` increment.** `VOLUNTEER_ASSIGNED → ACCEPTED` is legal, role-gated
      to the accepting kitchen and described throughout this documentation as a release —
      but nothing clears `volunteer_id`, so the "released" pickup is **invisible to every
      other courier** (`_readable_by` requires `volunteer_id IS NULL`), unclaimable by them
      (`_claim_pickup` answers `409 Another courier has already claimed this pickup`, which
      is not true), and re-runs the acceptance side effect — taking the kitchen's
      `accepted_donations` from 1 to 2 for one donation and therefore **lowering its own
      `reliability_score`**, 15% of the ranking weight, as a penalty for releasing a
      courier. All three reproduced. The side effect should be skipped when
      `donation.recipient_id` already equals the caller's organisation. Regression test:
      after a release a *different* courier can see and claim the pickup, and the counter
      did not move — the property the existing D-35 tests do not assert, which is how this
      survived an authorization audit of the same edge.
- [x] **Bound `image_url`.** Unchanged in substance from group A, promoted here because it
      is the same size of change and the audit measured its cost: a 3 MB base64 data URL is
      accepted (`code/foodlink/models.py:219`; `schemas.DonationCreate.image_url` has no
      `max_length`), and `AppContext.load()` re-reads `limit=500` donations after **every**
      mutation, so one photo is 3 MB on every write by every user. This is the cheap guard;
      object storage (group F) remains the real fix. `[B-6 · R-19 · S-6 · HA-7]`

### ✅ Step 2 — repair the matcher's scoring — **DONE (Task 22, `a9f190b`)**

`[HA-4 · HA-5 · R-13 · D-05 · D-42]` — **M**. Delivered as one file, `matching.py`, with no
schema, API or frontend change and no weight touched.

- [x] **`HA-4` · `_quantity_score` and `_capacity_score` are the same input inverted.** Both
      take `(quantity, capacity)` and are monotone in the same ratio `r = quantity /
      capacity`, in opposite directions, so their weighted contribution is
      `0.25(40 + 60r) + 0.20(100 − 50r) = 30 + 5r`: **45% of the published weight moves five
      points across the entire feasible range**, then drops 11.5 points at `r = 1`. Ranking
      is therefore decided in practice by distance (25%) and deadline (15%), since
      `reliability_score` is the flat `85` cold-start prior for any kitchen under three
      acceptances. Since I-8 the explainability panel captions both correctly, which makes
      two collinear bars read as two independent criteria.
- [x] **`HA-5` · The fit criterion compares mixed units.** `Donation.quantity` is a count in
      `Donation.unit` (Meals · Kg · Boxes · Pieces); `Recipient.capacity` is meals per day;
      `matching.py` never reads `unit`. Measured: 100 Kg and 100 Meals score identically
      (88), 5 Boxes scores 83. `lib/impact.ts` carries a prominent warning about this exact
      hazard for display totals; the matcher has no equivalent guard.
- [x] Landed the boundary unit tests group D wanted **with** the change:
      `test_matching_scores.py` (25), including one asserting the two criteria are not
      collinear along the ranking axis, which fails against the pre-fix code.
      ⚠️ **Do not re-tune `WEIGHTS` before this lands** (`Backlog → G`, `R-31`): tuning two
      collinear criteria is tuning noise.

### ✅ Step 3 — a frontend test harness — **DONE (Task 23, `f33aeae`)**

`[HA-8 · R-14]` — **M**.

- [x] Vitest 3.2 + Testing Library, seeded with the modules carrying the arithmetic behind
      every honesty decision: `lib/adapters.ts`, `lib/time.ts`, `lib/impact.ts`,
      `lib/geo.ts` and `lib/api.ts`, plus `components/ProtectedRoute.tsx`. **40 tests,
      ~1.5 s.** See *Completed* and D-43.
- [ ] ⚠️ **Not done: the `ci.yml` step.** The suite exists but gates nothing automatically;
      CI still runs `npm run build` only. Small and separate — see *Backlog → D*.
- [ ] ⚠️ **Not done: the dead `npm run lint` script.** Left untouched as unrelated to the
      harness; still in *Backlog → H*.

### ✅ Step 4 — `HA-6` · finish the landing page — **DONE (Task 24, `9b11353`)**

`[HA-6 · QA-4 · repo]` — **S**. Superseded I-1a, which was scoped too narrowly. Three sites
removed, one labelled, no substitute number introduced; detail under *Completed*.
**Group I is now complete.**

**Then stop hardening.** The audit's recommended first product feature was the **donor
needs board**, done as Task 25 (`e72d4c2`), and `HA-3` — the `/matches` distance
disclosure — followed it as Task 26 (see *Current* and D-45). What sequences behind them
is *Backlog → E* (concurrency guard → Postgres → deployment configuration), with `HA-3a`
(the residual membership oracle, group A) the nearest remaining security item.

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
- [x] ✅ **Done (Task 21, `e7032ea`)** — `image_url` is capped at 256 KiB by
      `schemas.MAX_IMAGE_URL_LENGTH` on `DonationCreate`; the column stays `Text`, an
      unconstrained `Text` column (`code/foodlink/models.py:219`) receiving base64 data URLs
      from the frontend. The cheap guard; object storage (group F) is the real fix.
      `[B-6 · R-19 · S-6 · HA-7]` — **S**
- [x] ✅ **Done (Task 21, `e7032ea`)** — `HA-1`: `GET /api/volunteers` is scoped by
      `_visible_volunteers`, so an `ngo` reads only the couriers on its own donations.
      `[HA-1 · D-26 · repo]` — **S**
- [x] ✅ **Done (Task 26, uncommitted)** — `HA-3`: a match describes the reader's own
      organisation from its real position and every other from a ~1 km surrogate, so
      `distanceKm`, `distanceScore`, `deadlineScore`, `overallScore` and the `reasons`
      sentence are all functions of one blurred point rather than of the kitchen.
      ⚠️ **This item's own proposed mitigation was wrong**: rounding `distance_km` to
      ~0.5 km leaves the rounding boundaries at known distances, so walking the pin until
      one flips still recovers a circle of known radius and three of those still give the
      exact point. D-45 records what was done instead and why the seam had to sit upstream
      of the scoring arithmetic rather than in `serialize.py`. `[HA-3 · D-26 · D-33 · D-45]` — **S**
- [ ] **`HA-3a` · ranking membership is still a coordinate oracle.** A recipient appears in
      `/matches` iff the *true* distance is within the 8 km radius, so a donor who
      binary-searches the pin can find points on that circle and trilaterate from three of
      them — tens of donations rather than three, but the same recovery. D-45 deliberately
      did not touch this: the gate is D-06's and the matcher's correctness rests on it. The
      control is abuse-limiting on `POST /api/donations` (nothing rate-limits it today;
      `ratelimit.py` covers login and registration only), not another distance
      representation. `[HA-3a · D-06 · D-27 · D-45 · repo]` — **M**
- [ ] **`HA-3b` · two smaller distance readings outside `/matches`.** Found while
      implementing D-45, both left alone as out of that task's scope. `Donation.match_score`
      is frozen from a precise ranking and shown to the donor who chose the pin — one number
      per donation, about whichever kitchen ranked first, resolving to ~320 m. And
      `DonationOut.distanceKm` is the exact donor-pin-to-kitchen distance once a recipient
      binds, readable by the donor; weaker, because the donor does not choose which kitchen
      accepts. Neither is the reproduced bypass `HA-3` was, and fixing them touches D-30's
      frozen score and `serialize.donation_out`. `[HA-3b · D-30 · D-45 · repo]` — **S**
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

- [x] ✅ **Done (Task 21, `e7032ea`)** — `HA-2`: the release clears `volunteer_id` and
      no longer re-runs the acceptance side effects for a donation already bound here. `[HA-2 · D-35 · D-38 · repo]` — **S**
- [x] ✅ **Done (Task 22, `a9f190b`)** — `HA-4`/`HA-5`: `_capacity_score` now measures
      absolute spare meals rather than the fill ratio, and only meal-denominated donations
      are compared with capacity. `[HA-4 · HA-5 · D-05 · D-42 · R-13]`
- [ ] Skip explicit nulls in `PATCH /recipients/me` and `PATCH /volunteers/me`. Both assign
      an explicit `null` straight to a non-nullable column, so `{"name": null}` raises an
      uncaught `IntegrityError` — and because no exception handler exists the response has
      no body and `api.ts` renders it as *"Cannot reach the FoodLink server"*. Reproduced.
      `RequirementUpdate` already skips nulls (D-29); these two were left as out of scope.
      `[repo · HA]` — **S**
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

- [x] ✅ **Done (Task 22, `a9f190b`)** — `test_matching_scores.py` (25) is the matcher's
      first direct unit-test file: boundaries, overflow, zero capacity, unit comparability,
      and the collinearity property itself. Originally filed as unit tests for the
      boundaries —
      `_quantity_score` at the overflow ratio, `_deadline_score` on negative slack, the
      reliability cliff at 3 accepted donations. Partially started: one test in
      `test_match_score_consistency.py` calls `score_pair` directly with an injected `now`
      to pin the deadline decay, but the individual `_*_score` helpers are still reached
      only through the API. `[R-13]` — **M**
- [ ] Round-trip test for `UtcDateTime`. The decorator exists to prevent one specific
      timezone bug (D-09) and has no direct test. `[§14.4]` — **S**
- [x] ✅ **Done (Task 21, `e7032ea`)** — read-scope coverage for the courier roster.
      `test_volunteer_reads.py` (8) is the missing third of the read-scope trio beside
      `test_donation_reads.py` and `test_recipient_reads.py`; the endpoint previously had
      **no test of any kind**. `test_pickup_release.py` (13) covers what the release edge
      does after authorization allows it. `[HA-1 · HA-2]`
- [x] ✅ **Done (Task 23, `f33aeae`)** — the frontend test harness. Vitest 3.2 +
      Testing Library on the project's own `vite.config.ts` (D-43); 40 tests over
      `lib/adapters.ts`, `lib/time.ts`, `lib/impact.ts`, `lib/geo.ts`, `lib/api.ts` and
      `components/ProtectedRoute.tsx`. `[R-14 · HA-8]`
- [ ] **Add `npm test` to `ci.yml`.** The frontend job still runs `npm run build` only, so
      the suite gates nothing automatically — a failing test does not fail the build.
      One step in the existing frontend job. `[HA-8]` — **S**
- [ ] **Extend the frontend suite beyond the six seeded modules.** 84 files under
      `frontend/src`; the harness covers 6. The obvious next targets are `lib/hooks.ts`
      (`useAction`'s keyed in-flight state) and `context/AppContext.tsx`'s
      write-then-refetch. `[R-14]` — **L**
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

- [x] ~~Let an organisation see its own retired requirements.~~ **Done (Task 27, D-46),
      uncommitted in the working tree.** Built as this entry described: an `includeInactive`
      flag on `GET /api/requirements`, applied beside the D-44 scope rather than instead of
      it, so it widens the lifecycle filter and never the organisation. The NGO portal lists
      retired needs in their own section and reopens one through the existing PATCH.
      `[D-29 · D-46 · repo]`
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

- [x] ~~Show an NGO the distance to a donation it has not accepted yet.~~ **Done as part
      of I-2 (`fcbd03b`)** and confirmed by the health audit — this entry was left open by
      mistake. `serialize.donation_out()` still measures `distanceKm` against the *matched*
      recipient, so it is still null in the open pool, but no screen reads it directly any
      more: `lib/geo.displayDistanceKm` prefers `viewerMatch.distanceKm` (D-30, D-33) and
      `DonationCard`, `DonationRow` and `mobile/NGOAvailable` (list, sort **and** sheet) all
      go through it. The "– km" rows and the `?? 99` no-op sort are both gone.
      `[repo · QA-8 · HA]`
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
- [ ] **Narrow the donor needs board by distance.** It is platform-wide today (D-44) and
      cannot be otherwise: a donor account stores **no coordinates** — `users` has none,
      and `Donation.latitude/longitude` belong to a donation, not to the person who posted
      it. So this needs a product decision first: a donor location on the account (a new
      column and a profile field), or a "needs near this donation" board reached from a
      donation rather than from the nav. Only then is it a filter. `[D-44 · QA-3]` — **M**
- [ ] Tune the matching weights against real outcome data; revisit the 85 reliability
      prior. ✅ **Unblocked by Task 22** — the two size criteria are independent now, so
      re-weighting measures something. Still wants outcome data the project does not have.
      `[R-31 · D-42]`
- [ ] **The donor needs board on `/m/*`.** Task 25 built the desktop page only; the mobile
      donor portal has no Needs tab, so a phone user reads no standing demand. The data
      flow is shared (`useRequirements()` and the same adapter), so this is a screen and a
      tab entry rather than new plumbing. `[D-44]` — **S**
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
- [ ] Fix or delete the dead `npm run lint` script. `frontend/package.json` declares an
      `eslint` invocation, but eslint is in neither `devDependencies` nor
      `package-lock.json` and no config file exists, so the script fails if run. CI does not
      call it, which is why nothing has noticed. `[HA · repo]` — **S**
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

- [x] **I-1a / `HA-6` · The public landing page no longer prints invented platform
      figures.** `[repo · QA-4 · HA-6]` — **done, Task 24, `9b11353`, in the working
      tree.** All three sites in `pages/Landing.tsx` are closed, and the chosen remedy was
      **delete, not relabel**, for the two that asserted totals:

      1. The four-stat strip (`1,240+` meals, `32` partner organisations, `56` volunteers,
         `84` pickups) is now four non-numeric claims the repository backs, under the same
         `#impact` id, grid and dividers.
      2. The "Live this term" hero card no longer carries a pulsing dot, `1,240+`,
         "32 partner NGOs" or "18% more than last month"; it names the lifecycle the server
         actually stamps.
      3. `HOW_IT_WORKS`'s "**in real time** on every dashboard" now says the dashboards total
         the account's own records when the page loads.

      A fourth site the audit did not record — the sample match card, whose figures sat under
      a pulsing dot captioned "Match analysis" — was **labelled rather than deleted**: its
      five criteria are the matcher's real ones, so D-31's labelling remedy applies. It reads
      *Example match analysis* with an *Illustrative sample* footnote.

      **No decision was needed in the end.** The original entry was blocked on whether any
      metric may be read without authentication (`GET /api/metrics` is
      `Depends(get_current_user)`). Removing the figures made the question moot: whether a
      **public metrics endpoint** should exist is still open, still optional, and still
      D-26's neighbour. Covered by `pages/__tests__/Landing.test.tsx` (4 tests).

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
      commit `fc91091`, 2026-09-04.** `components/StatusTimeline.tsx` was driven
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

- [x] **I-8 · Correct the explainability panel's criterion descriptions.** `[QA-12 · D-06]` —
      **done, commit `ed56bd5`, 2026-09-04.** Both captions were re-read against
      `matching.py` before either was rewritten, and both audit findings were confirmed:

      * *Recipient Capacity* said "Cold storage and immediate consumption bandwidth".
        `_capacity_score(quantity, capacity)` takes those two numbers and nothing else —
        `100 * (1 - (quantity / capacity) * 0.5)`, or `0` when the donation does not fit —
        so it is the headroom the kitchen keeps afterwards. `matching.py` never reads
        `storage_type`, and `COLD_STORAGE` is still the dead constant tracked in group F.
        Now: **"Capacity the kitchen still has spare after taking this donation."**
      * *Pickup Availability* said "Recipient intake volunteers ready before deadline".
        No volunteer data reaches the matcher at all. `_deadline_score` measures the slack
        between now and the pickup deadline less an estimated collection trip (a flat
        20 km/h over the straight-line distance), full marks at two hours of slack.
        Now: **"Time left before the pickup deadline, less an estimated collection trip."**

      Two strings and an explanatory comment in `components/MatchAnalysis.tsx`. **No
      scoring change:** no weight, formula, threshold, criterion, label or API field was
      touched, and `matching.py` is byte-identical. The panel's own `label` for the second
      criterion still predates the API's `deadlineScore` name — `adapters.toMatchAnalysis`
      already carries a comment saying so — and renaming it was left alone as out of scope.

- [x] **I-9 · Fix the donor profile form's field wiring.** `[QA-12 · repo]` — **done,
      commit `c274e99`, 2026-09-04.** Each of the audit's three claims was checked
      against the source before anything was changed, and **two of them were wrong**:

      * *"The input labelled Email Address is bound to `profile.operatingHours`"* — **not
        true, and never was.** Every label/input pair on the form is correctly matched, at
        HEAD and at the audit's own commit (`23c27f4`): the email input reads
        `profile.email`, rendered read-only with the title *"Your sign-in address. An
        administrator can change it."* Verified with `git show 23c27f4:` and in the running
        app. A misread, not a defect.
      * *"`profile.email` is initialised and never rendered"* — **not true** for the same
        reason. It is initialised from `user.email` and it is rendered.
      * *"`phone` and `location` initialise to `''` instead of reading the signed-in
        account"* — **true of `phone`, and the cause was in the API, not the form.**

      **The real defect.** `User.phone` is real column data: `RegisterRequest` accepts it at
      sign-up, `ProfileUpdate` lets the holder change it, and the donor form already sent it
      on save. But `UserOut` — the only schema an account receives about *itself* (register,
      login, `GET|PATCH /auth/me`, `POST /auth/password`) — omitted `phone`, exposing it
      solely through the admin-only `UserAdminOut`. The field was therefore **write-only**:
      a donor could save a number and never see it again, and the form's `phone: ''` was the
      only value available to it rather than laziness. Fixed by adding `phone: str | None`
      to `UserOut` and mirroring it through `ApiUser` → `User` → `toUser()` → the form's
      initialiser. See `DECISIONS.md` D-40 for why widening that one response is safe.

      **`location` is a different thing and was left alone.** A donor account has no profile
      row — NGOs have `Recipient`, couriers have `Volunteer`, donors have neither — and no
      user-level location column exists anywhere. `RegisterRequest`'s `location`, `latitude`
      and `longitude` are NGO-only and seed the recipient organisation. So *Default Pickup
      Address* and *Operating Hours* have nothing to read from, correctly start empty, and
      were not given an invented source. The comparison with `VolunteerProfile.tsx`'s
      `useEffect` does not carry over for the same reason: it syncs from a `Volunteer` row
      that loads asynchronously, while `user` is already present before this page renders.

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

- ~~**Should donors see a needs board?**~~ ✅ **Answered and built — Task 25, D-44.**
  `[QA-3 · §8.2]`
  Yes. `pages/donor/DonorNeedsBoard.tsx` at `/donor/needs` is a read-only board over the
  existing `useRequirements()` flow. **Both sub-questions this entry left open were settled
  rather than dodged:**
  - *Explicit scope for `GET /api/requirements`* — **decided, not inherited.** It is now
    role-scoped (D-44): a donor reads active needs from **verified** recipients, an ngo its
    own, a courier none, an admin all. The old openness was defensible — `RequirementOut`
    carries a name and a need, no contact details — but it was openness by omission, and a
    donor-facing page is a commitment to a scope.
  - *Radius vs platform-wide* — **platform-wide, and the reason is a data gap.** A donor
    account stores no coordinates; only a *donation* has them. Radius filtering therefore
    needs either a donor location on the account or a "near this donation" board, both of
    which are product decisions. Moved to *Backlog* as its own item rather than left here.

  ⚠️ What was **not** built and is still open: requirements do not drive matching (the
  entry above), nothing fulfils a need from the board, and a retired requirement still has
  no reader (D-29).

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

### Match distance is scoped to the organisation it describes — **`883bcee`** `[HA-3 · D-26 · D-33 · D-45]`

**A donor can no longer read a verified kitchen's coordinates out of
`GET /api/donations/{id}/matches`.** The ranking is unchanged — same weights, same 8 km
radius, same eligibility gates, same candidates for every reader — and so is every number
an organisation reads about *itself*. **No schema change and no migration.**

- **The mitigation this list previously proposed was wrong and has been replaced.**
  Rounding `distance_km` to ~0.5 km does not close the disclosure: the boundaries of a
  rounded value sit at known distances, so moving the pin until one flips recovers a
  circle of known radius about the kitchen, and three of those still give the exact point.
- **`distanceKm` was also not the only reading.** `distance_score` resolves to 80 m,
  `deadline_score` (which subtracts a distance-derived travel estimate) to ~400 m, and
  `overall_score` — a weighted sum of both — to ~320 m. A serialization-only fix cannot
  reach the three scores, because they are *computed from* the distance rather than
  carrying it.
- **What was done instead.** `matching.score_pair(..., blur_location=True)` snaps the
  recipient's coordinates to `LOCATION_BLUR_GRID_DEG` (0.01°, ≈ 1 km) and scores the
  pairing against that surrogate, so every figure a non-owning reader can measure is an
  exact function of one fixed point. `MatchOut.distanceKm` is `None` for such a row, and
  the distance sentence in `reasons` drops its figure. Eligibility is still decided on the
  true position, *before* the blur.
- **The scope lives in the router,** `donations._precise_distance_scope`, in the shape
  `_readable_by` already uses: `None` for an administrator, `{own recipient id}` for an
  `ngo`, empty for a donor or a courier. An `ngo` is scoped for its *peers* — registration
  hands that role to any address, which is the D-41 lesson.
- **D-33 is untouched.** `DonationOut.viewerMatch` is always the caller's own organisation
  and is never blurred, and the four internal rankings that freeze `Donation.match_score`
  — two in `routers/donations`, two in `seed.py` — pass no scope and stay exact.
- **The gate is above the blur, verified by mutation.** All three `return None` branches
  (verification, coordinates, radius) run on the true `haversine_km`; the blur is applied
  only afterwards. Moving it above the gate fails the two boundary tests and the
  same-eligible-set test, and nothing else. The sort is on the blurred score, so ordering
  is not a channel either.
- **Contract widened:** `MatchOut.distanceKm` is `float | None`; `ApiMatch.distanceKm` and
  `MatchAnalysis.distanceKm` are `number | null`. `displayDistanceKm` already coalesced,
  so **no screen changed** — the analysis panel draws the scores and the reasons, never
  this field.
- **Tests.** New `code/tests/test_match_distance_privacy.py` (12): the three readings the
  audit found; the disclosure floor stated directly (two kitchens ~600 m apart in one cell
  give a donor whole rows that compare equal, which settles the ordering channel too); the
  `deadline_score`/`overall_score` pair exercised at a one-hour deadline, where the
  criterion is off its ceiling and actually carries the distance; the organisation's own
  distance; the `viewerMatch` path; and **both directions of the 8 km gate** — a kitchen
  8.02 km away whose surrogate is 7.52 km away stays out, and one 7.98 km away whose
  surrogate is 8.46 km away stays in. One existing test —
  `test_api.test_a_nearer_kitchen_outranks_a_further_one` — read the ranking through
  `distanceKm` as a donor and now reads it through `distanceScore`. `geo.test.ts` gained
  the null-distance case.

⚠️ **What this does not close, recorded rather than hidden.** Ranking *membership* is
still an oracle — a recipient appears iff the true distance is within 8 km — so a donor
who binary-searches the pin can find the 8 km circle and trilaterate from three points on
it. That needs abuse-limiting on donation creation, not a different distance
representation, and closing it by changing eligibility was explicitly out of scope. Two
smaller readings in the same family are also open: `Donation.match_score` (~320 m, one
number per donation) and `DonationOut.distanceKm` (exact, to the kitchen that accepted —
which the donor does not choose). All three are in *Backlog → A*; D-45 has the detail.

Validation: `pytest code/tests` **242/242** (230 → 242, ~205 s), `npm test` **59/59**
(8 files), `npm run typecheck` clean, `npm run build` clean, `alembic check` reports no new
upgrade operations. The attack was also re-run end to end against a throwaway database: a
donor posting five donations at pins of its choosing and solving for the kitchen from
everything still exposed lands **465 m** from the true position and cannot refine further
(the solution fits every observation exactly — it has converged on the surrogate). The same
solver on the pre-fix payload shape, which is what an administrator still receives, lands
**15 m** away, i.e. at the limit of the search grid rather than of the data.

### The donor needs board and requirement read scope — **`e72d4c2`** `[QA-3 · §8.2 · D-44]`

Task 25. **Donors have a real read-only Needs Board, and `GET /api/requirements` is scoped by role
for the first time.** The board reads through the existing `useRequirements()` flow — no
new endpoint, no second fetch, no duplicate state — and the scope decision it forced is
recorded as D-44. **No schema change, no migration, no new Requirement field, and
`matching.py` is untouched.**

- **Backend scope.** `routers/organisations._visible_requirements(user)` returns a WHERE
  clause in the shape `_visible_recipients` / `_visible_volunteers` already use: admin →
  every active need; **donor → needs from *verified* recipients**; ngo → its own only;
  volunteer → none; unknown role → `false()`. Applied inside the existing query, so
  authentication, active-only and newest-first are unchanged, and denial is an empty list
  rather than a 403.
- **`RequirementOut` gained `isVerified`,** read from `Recipient.is_verified` at
  serialisation. It is not a column and nothing backfills: an administrator vouching for an
  organisation makes its existing needs visible immediately.
- **New `pages/donor/DonorNeedsBoard.tsx` at `/donor/needs`,** plus a *Needs Board* entry
  in `DonorLayout`'s nav. Each card carries the organisation and its verified state, the
  food, quantity and unit, urgency, beneficiaries **when stated** (the field defaults to 0,
  which means "not said" rather than "nobody"), whether it recurs, the operator notes, and
  `timeAgo(createdAt)`. Loading, empty and failure states use `useLoadState()` and the
  existing `EmptyState` primitive.
- **Nothing on it claims a commitment.** No fulfil action, no needs-met count, no
  statistic the page was not given, and a line saying plainly that posting a donation does
  not attach it to a need — because nothing in the system connects the two. D-31 at a new
  boundary.
- **The NGO client-side `myRecipient` filter was kept** on both the desktop and mobile
  requirement screens, deliberately, even though the server now enforces the same scope.
- **`notes` is now donor-facing.** It is operator-authored free text and is rendered
  through ordinary React interpolation; there is no `dangerouslySetInnerHTML` anywhere in
  the change, and a test asserts markup inside a note stays text.
- **Tests.** New `code/tests/test_requirement_reads.py` (14) and
  `frontend/src/pages/donor/__tests__/DonorNeedsBoard.test.tsx` (14). One existing test —
  `test_retiring_one_requirement_leaves_the_rest_of_the_board_alone` — asserted a rival
  kitchen's need stayed on *this* caller's board, which was only true while the endpoint
  was unscoped; it now checks that need on the rival's own board.

Validation: `pytest code/tests` **230/230** (216 → 230, ~157 s), `npm test` **58/58**
(8 files), `npm run typecheck` clean, `npm run build` clean, and the board read in a
browser against a seeded throwaway database — a donor sees the two verified organisations'
needs and not the unverified one's, an NGO sees only its own, and an NGO requirement edit
still round-trips.

### Landing page: no platform figure without a source — **`9b11353`** `[HA-6 · I-1a · QA-4]`

Task 24 / *Next* step 4. **One page changed**
(`frontend/src/pages/Landing.tsx`) and **one test file added**; no other application source,
no backend, schema, API, routing or dependency change. Detail under *Current*. **This closes
group I**: every interface claim the QA audit found the system could not honour is now
either true or labelled as future work.

- [x] **The two blocks that asserted totals lost their numbers rather than gaining smaller
      ones.** A pre-login page has no authenticated source, so any figure would be a literal;
      the sections were kept and re-pointed at *how* the system counts — server-stamped
      status events, five published criteria, the verified-recipient gate, per-account
      arithmetic in `lib/impact.ts`. Every replacement claim was checked against source.
- [x] **The "in real time" claim is gone.** `ARCHITECTURE.md` constraint 7 still holds:
      no polling, no SSE, no WebSocket.
- [x] **The sample match card was labelled, not removed** — D-31 treats labelling as a real
      remedy where the underlying structure is honest, and its five criteria are `WEIGHTS`.
- [x] **`pages/__tests__/Landing.test.tsx`** — 4 tests asserting the absence of the eight
      literals and of "real time"/"live" wording, plus the `#impact` anchor `Navbar` links
      to. The frontend suite is **44 tests over 7 files**. Written as absence assertions so
      it constrains honesty, not layout.
- [x] Validation: `npm test` 44/44, `npm run typecheck` clean, `npm run build` clean, and
      the rendered page inspected in the dev server (desktop and tablet widths, no console
      errors).
- ⚠️ **Structure and styling were preserved deliberately.** This was a content-correctness
      task, not a redesign; the grid, dividers, card rotation and section ids are unchanged.


### Frontend test harness — `f33aeae` `[HA-8 · R-14]`

Task 23 / *Next* step 3, committed as `f33aeae`. **40 frontend tests over
6 files, ~1.5 s, all passing.** No application source file was modified — the change is
four devDependencies, a `test` block in `vite.config.ts`, two `package.json` scripts and
seven new files under `frontend/src`. Decision recorded as **D-43**.

- [x] **Vitest 3.2 + Testing Library, on the project's own `vite.config.ts`.** One plugin
      pipeline and one resolver shared with the build, so a green test means the same
      module graph the bundle uses. Vitest 5 needs Vite ≥ 6 and this project is on Vite
      5.4, so the version is pinned deliberately — see D-43.
- [x] **`npm test` (`vitest run`) and `npm run test:watch`** added; `npm run typecheck`
      (`tsc --noEmit`) added as a name for the gate `build` already ran. `dev`, `build`,
      `preview` and `lint` untouched.
- [x] **jsdom per file, not globally.** Default environment is `node`; only
      `api.test.ts` and `ProtectedRoute.test.tsx` carry a `// @vitest-environment jsdom`
      docblock.
- [x] **`src/test/fixtures.ts`** — builders typed as the real `api.ts` wire interfaces, so
      a test states only the field it is about and backend drift is a compile error.
- [x] **Seams covered.** `lib/adapters.ts` (9): entityId precedence per role, the
      event-list → named-timestamp fold, the `deadlineScore` → `pickupAvailabilityScore`
      rename, feed ordering and the limit applying after the sort. `lib/time.ts` (8):
      urgency bands asserted **at** the 2 h and 6 h boundaries, the days label, the
      overdue case, and the deadline roll-forward that makes a late-evening pickup
      acceptable to the API. `lib/api.ts` (8): bearer attach, login staying anonymous so a
      wrong password cannot evict a good token, the 401 evicting the token and firing the
      handler exactly once, Pydantic's field-error list flattened to one sentence, and a
      bodyless 5xx reported as unreachable rather than as a 500. `lib/impact.ts` (6):
      `COMPLETED`-only counting, the server's lifetime counter beating the loaded list,
      unmatched donations left out of the breakdown. `lib/geo.ts` (4): D-33 precedence and
      the honest null. `components/ProtectedRoute.tsx` (5): splash while a token is being
      exchanged, redirect to login, redirect to the account's own portal, pass-through.
- [x] **Mutation-verified.** Inverting the D-33 precedence in `lib/geo.ts` typechecks
      cleanly and fails the suite — which is the whole argument for the harness, since
      `tsc` was the only frontend gate.
- ⚠️ **Two stubs only, both process boundaries** — `fetch` and `useAuth`. `HOME_PATH`
      and every other import stay real.
- ⚠️ **Not done: the `ci.yml` step.** The suite gates nothing automatically yet.
- ⚠️ **Not done: the dead `npm run lint` script.** Unrelated to the harness; untouched.
- ⚠️ **Coverage is a foundation, not a sweep.** 6 of 84 files under `frontend/src`. No
      E2E, no visual regression, no coverage threshold — none were in scope.


### Matcher correctness: unit comparability and absolute headroom — `a9f190b` `[HA-4 · HA-5]`

Task 22 / *Next* step 2, committed as `a9f190b`. 191 → **216 tests**;
`alembic check` clean; **one source file changed** (`code/foodlink/matching.py`); no schema,
migration, API, frontend, dependency or configuration change; no weight altered.

- [x] **`HA-5` · Only meal-denominated donations are compared with capacity.**
      `CAPACITY_UNIT = "Meals"` names what the product had already fixed in three places —
      the NGO profile's "Max Batch Capacity (Meals)", the mobile profile's "*n* meals", and
      `types/index.ts` — rather than adding a `capacity_unit` column to say it a fourth
      time. `is_comparable_unit()` accepts that unit alone, after trimming and case-folding.
- [x] **Nothing is converted, deliberately.** No mass field, no per-category yield table and
      no conversion rule exists anywhere in the repository, and a box of bread rolls is not
      a box of rice. A fabricated factor inside the one number the platform invites people
      to check by hand is the defect D-05 exists to prevent. `lib/impact.ts` had already
      reached the same conclusion for display totals.
- [x] **Unassessed, not ineligible.** Both size criteria return `UNASSESSED_SIZE_SCORE` (50)
      for any other unit, with a `reasons` line saying so. Gating instead would mean a
      donation in kilograms matched **nobody** — and the seed data posts in Kg and Boxes.
      Safe because the unit belongs to the donation: every candidate gets the same value, so
      the pair cancels out of the comparison and cannot reorder a ranking. Such donations
      rank on distance, deadline and reliability.
- [x] **`HA-4` · `_capacity_score` measures absolute spare meals**, saturating at
      `FULL_HEADROOM_MEALS` (100, the default capacity), where it used to return
      `100 * (1 - 0.5 * quantity / capacity)` — an exact affine function of
      `_quantity_score` over the feasible range. An absolute term was *required*: any
      scale-free function of `(quantity, capacity)` collapses back into the ratio.
      `_quantity_score` is unchanged.
- [x] **What that bought, measured.** The pair's maximum moved off the boundary: it now
      sits at `capacity = quantity + 100` and is **global and interior**, where the old
      pair's best candidate was always the smallest kitchen the donation fitted. **Among
      feasible kitchens** fit alone prefers the smallest and headroom alone the largest —
      below that point fit falls away too, under the overflow penalty — so together they
      pick the kitchen that takes the donation comfortably *and* keeps a full day's room.
      On the seeded kitchens a 50-meal donation now ranks Helping Hands first on headroom
      despite the lowest fit score of the three.
- [x] **Discrimination over feasible capacities, for a fixed donation:** the old pair spanned
      **exactly 5.00 points** (`30 + 5r`, independent of donation size) and moved
      monotonically; the new pair spans roughly **10.6–17.5 points for donations of 20–500
      meals**. ⚠️ The "10.5 vs 3.75" pair quoted in the first Task 22 report is specific to
      one sample of candidate kitchens and is **not** a general bound — across the
      unrestricted domain both implementations span 0–35.
- [x] ⚠️ **The combined curve is not single-peaked**, and the first report implied it was.
      Between exact fit and saturation the criteria cross, leaving a shallow local minimum
      (for a 50-meal donation: 25.00 at capacity 50, 24.40 near 62, 35.00 at 150). The
      global maximum and the independence are unaffected. Corrected in D-42.
- [x] **25 tests** in the new `code/tests/test_matching_scores.py` — the matcher's first
      direct unit-test file, and the item *Backlog → D* had been asking for. Boundaries,
      overflow, zero and negative capacity, every unit in the picker, the reasons text, the
      hard gates, the unchanged weights, and the breakdown reconciling to the headline.
- [x] **No existing test needed modification.** `test_match_score_consistency.py` reconciles
      the breakdown against the published weights and passes unchanged, which is the check
      that the contract held.
- [x] ⚠️ **`WEIGHTS` untouched on purpose**, so correcting what a criterion measures came
      before deciding how much it counts. `R-31` is unblocked by this and is separate work.
- [x] See `DECISIONS.md` D-42.


### Foundation hardening: roster scope, pickup release, image bound — `e7032ea` `[HA-1 · HA-2 · HA-7]`

Task 21 / *Next* step 1, committed as `e7032ea`. 168 → **191 tests**;
`alembic check` clean; no schema, migration, frontend, dependency or configuration change.

- [x] **`HA-1` · `GET /api/volunteers` is scoped, not merely role-gated.**
      `_visible_volunteers(user)` is a WHERE clause in `_visible_recipients`' shape — admin
      unrestricted, `ngo` narrowed to the couriers on its own donations (subquery joined
      through `Recipient`, so an account with no organisation row matches nothing rather
      than needing a branch), everyone else `false()`. The existing `require_roles(admin,
      ngo)` gate, the response shape and `/volunteers/me` are all untouched. **No new
      relationship was introduced** — `Donation.recipient_id` and `Donation.volunteer_id`
      already express the connection. No frontend change: `AdminVolunteers` is the only
      screen rendering the roster.
- [x] **What was open:** `ngo` is a self-signup role and `is_verified` gates ranking and
      acceptance, not reads, so every courier's name, location and **phone number** was one
      registration away from anybody. Reproduced before the fix; the same probe now returns
      `[]`.
- [x] **`HA-2` · The release clears the courier and does not re-count the acceptance.**
      `update_status` nulls `volunteer_id` when `ACCEPTED` is reached from
      `VOLUNTEER_ASSIGNED`, and runs the acceptance side effects only when the donation is
      not already bound to the accepting organisation. A released pickup is now visible and
      claimable to other couriers; `accepted_donations` counts one donation once however
      many times it is released; `match_score` is not re-frozen, so D-30's number survives.
      `ALLOWED_TRANSITIONS`, `TRANSITION_ROLES`, `OWNED_TRANSITIONS`, `_needs_ownership` and
      `_claim_pickup` are unchanged, and so are the D-35 ownership answers.
- [x] **`image_url` is bounded at 256 KiB** (`schemas.MAX_IMAGE_URL_LENGTH`, 262,144
      characters) via `Field(max_length=...)`, so the constraint is in the OpenAPI document
      (D-04's shape). The column stays `Text`: the bound belongs at the request boundary,
      and this way there is no migration. ⚠️ A raw phone photo is now a 422 — a real bound,
      not a formality.
- [x] **21 new tests**, 12 of which fail against the pre-fix code:
      `test_volunteer_reads.py` (8, a new file completing the read-scope trio),
      `test_pickup_release.py` (13), plus 2 in `test_api.py` for the image bound.
- [x] ⚠️ **One existing test asserted the defect and was rewritten rather than deleted.**
      `test_courier_claim.py`'s second-courier test reached the already-claimed guard
      *through* the unreleased release, and said so in its docstring. It now asserts the
      corrected outcome under a name that matches it. No guard coverage was lost: `ACCEPTED`
      with a courier still bound is unreachable through the API now, so that branch is
      reachable only as a race — which the three file-backed two-transaction tests in the
      same module already cover. The reclaim test's docstring was updated for the same
      reason: the property holds, the mechanism moved from `volunteer_id == caller` to
      `volunteer_id IS NULL`.
- [x] See `DECISIONS.md` D-41.


### Project health audit — 2026-09-05, documentation only `[HA-1 … HA-8]`

Documentation only. **No source file was changed**, no schema touched, no dependency added;
168 backend tests re-run passing, `alembic check` clean, `tsc && vite build` clean, working
tree left empty. A full architecture, security, database, API-contract, matching, frontend,
testing and deployment review against HEAD `c274e99`.

- [x] **The architecture, the authorization model and the decision log were checked and
      largely cleared.** Every edge of the donation state graph was re-derived against
      `ALLOWED_TRANSITIONS`, `TRANSITION_ROLES` and `_needs_ownership` and **no remaining
      unscoped write on a bound donation was found** — D-34/D-35 hold. No privilege
      escalation was found: `SELF_SIGNUP_ROLES` blocks `admin` in the *schema*, the admin
      router is gated once at router level, the self-service schemas omit privileged fields
      by shape, and `get_current_user` ignores the token's `role`. Verdict: **no major
      blocker; nothing architectural to fix.**
- [x] **Six defects confirmed, each reproduced rather than inferred**, and five of them were
      carried by none of the four AI files: `HA-1` (courier roster readable by any
      self-registered account), `HA-2` (releasing a pickup strands it and double-increments
      `accepted_donations`), `HA-3` (`/matches` discloses recipient coordinates), `HA-4`
      (two of five match criteria collinear), `HA-5` (matcher compares mixed units), `HA-6`
      (the landing page fabricates in two places, not one). They are in *Next* and
      *Backlog → A/B/I*; `PROJECT_STATE.md` carries them as issues 23–28.
- [x] **Documentation reconciled against the source.** Corrections applied across all four
      files: stale HEAD/provenance (I-9 recorded as uncommitted when it is `c274e99`);
      `ARCHITECTURE.md`'s test count (162 → 168) and its claim that `GET /api/requirements`
      was "the one unscoped cross-organisation read left" (it is not — `HA-1` and `HA-3`);
      the release-behaviour description; D-17's "37 tests" (integration subset, not the
      total); D-26's courier-roster objection, which was recorded and never implemented; and
      one already-closed group-F item still listed open (the NGO open-pool distance, closed
      by I-2).
- [x] ⚠️ **One earlier audit claim was checked and stands retracted**, alongside the two
      I-9 already retracted: nothing here re-opens them. The QA audit's *"Email Address
      input bound to `operatingHours`"* was a misread; the real defect was the write-only
      `User.phone` that I-9 fixed (D-40).
- [x] ⚠️ **Nothing was promoted into *Current*.** The audit recommends an order and *Next*
      records it as a recommendation; the promotion is a Project Manager call.


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
| 3 | No donor needs board | **Product gap; no security obstacle** — the endpoint was already open and the client already fetched it | ✅ built — Task 25 / D-44 (and the endpoint is now role-scoped) |
| 4 | Impact figures partly invented; PDF export is an `alert()` | **Confirmed — the audit's most serious finding** | I-1 · real export → *Blocked* |
| 5 | Notification settings send nothing | **Misleading UI claim** — 10 dead toggles, 4 screens | ✅ toggles and claims removed by I-4 · delivery itself → `R-28` |
| 6 | "FSSAI Compliant" / "Verified Institutional Donor" | **Misleading UI claim** — no donor verification exists in the model at all | ✅ both removed by I-5 · D-37 |
| 7 | Past-deadline donation still "Matched — Current" | **Acceptable state, incomplete display** — the row *is* `MATCHED`; the sweep is unscheduled (group E) | ✅ display fixed by I-7 · sweep → group E · `B-1` unchanged |
| 8 | Three match-score follow-ups | **Confirmed still open, unchanged** | group F, all three re-verified |
| 9 | "En route" on a completed donation | **Confirmed bug** — the line ignores `status` | ✅ false claim removed by I-2 · line made status-aware by I-6 |
| 10 | "LIVE CORRIDOR TRACKING" / "Live GPS" | **Misleading UI claim** — no GPS, no routing, no map in the repository | ✅ I-2 |
| 11 | "Daily Recurring" requirements | **Storage only** — the flag is written and displayed, never acted on | ✅ relabelled "Needed daily" by I-3 · real recurrence → `R-35` |
| 12 | Other findings | Hard-coded seed identities on three screens; two wrong criterion descriptions in the explainability panel; the donor "Email Address" input bound to `operatingHours` | I-1 · ✅ captions corrected by I-8 · ⚠️ the email-binding claim was **wrong** — I-9 fixed the real defect instead (a write-only `phone`) |

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
