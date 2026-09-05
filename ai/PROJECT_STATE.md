# PROJECT_STATE — FoodLink / FoodBridge-AI

> Compressed project memory. Companions: `ARCHITECTURE.md` (how it is built),
> `TASKS.md` (what is left), `DECISIONS.md` (why it is built that way).
> Last verified against the repository: 2026-09-05, branch `master`, HEAD `f33aeae`
> (Task 23: the frontend test harness). The Task 22 matcher correction is committed as
> `a9f190b` and the Task 23 harness as `f33aeae`. ⚠️ **The working tree carries the
> uncommitted Task 24 landing-page content correction** (`HA-6`; one page and one new test
> file, 44 frontend tests pass, no other application source touched).
> See `TASKS.md` → *Current*. The lifecycle write-authorization work is committed — D-34 as
> `551c96d`, the D-35 ownership-takeover follow-up as `efd5fd8` — as are the I-4
> notification-honesty pass (`6863451`), the I-5 trust/verification pass (`6c82739`), the
> I-6 courier status-display fix (`b41c4e6`), the I-7 overdue-deadline fix (`fc91091`), the
> I-8 match-criteria wording fix (`ed56bd5`), the I-9 donor-profile binding fix
> (`c274e99`) and the Task 21 foundation fixes (`e7032ea`, now HEAD).
>
> Two audits have been run against this codebase and neither changed source: a manual QA
> audit against `23c27f4` on 2026-09-02, and a **full project health audit against
> `c274e99` on 2026-09-05**. The health audit's confirmed findings are issues 23–28 below
> and tag `HA-n` in `TASKS.md`. **23, 24 and the `image_url` half of 13 are fixed in
> `e7032ea`; 26 and 27 in `a9f190b`; 28 is fixed in the working tree.** Open: 25 (`HA-3`)
> alone.

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
| Frontend web | ✅ Complete — 4 role portals, wired to the live API; impact reporting (I-1), distance/GPS wording (I-2), requirement-matching claims (I-3), notification claims (I-4), verification wording (I-5), the NGO courier status line (I-6), the overdue pickup deadline (I-7), the match-criteria captions (I-8) and the donor profile's field bindings (I-9) and the pre-login landing page (I-1a / `HA-6`) are all done. **No screen now prints an invented platform figure**; the landing page explains how impact is counted instead of asserting a total, and its one sample match card is labelled as an example |
| Frontend mobile | ✅ Screens exist at `/m/*`; ⚠️ unreachable without typing the URL |
| Auth / RBAC | ✅ Donation lifecycle authorization is complete — JWT, 4 authorization layers; donation **and** recipient reads scoped by role/ownership, and every lifecycle **write** on a donation that is already somebody's (`PICKED_UP`, `DELIVERED`, `COMPLETED`, `CANCELLED`, and `ACCEPTED` once the donation has left the open pool) scoped by the same clause (D-34, D-35). Every edge of the donation state graph has been audited against the role and ownership tables. Read scoping now covers donations, recipients **and couriers** — `GET /api/volunteers` is scoped to a kitchen's own couriers (issue 23, fixed). ⚠️ Still open: `/matches` discloses recipient geometry (issue 25) and `GET /api/requirements` is unscoped by omission |
| Auth rate limiting | ✅ Login and registration limited per client address; ⚠️ counter is **process-local** |
| Signing-key config | ✅ Fail-closed — no insecure default; explicit dev opt-in |
| Courier claim | ✅ Atomic — conditional UPDATE, safe on SQLite **and** Postgres; ⚠️ other transitions still read-then-write |
| Backend tests | ✅ 216 tests passing (~142 s): 39 integration + 25 matcher-scoring + 20 lifecycle-write-authorization + 15 requirement-lifecycle + 13 donation-read-scope + 13 pickup-release + 11 recipient-read-scope + 11 match-score-consistency + 9 courier-claim + 8 volunteer-read-scope + 22 rate-limit + 22 config + 8 migration |
| Frontend tests | ✅ 40 tests passing (~1.5 s), **uncommitted**: 9 adapters + 8 time + 8 api-client + 6 impact + 5 route-guard + 4 geo. Vitest 3.2 + Testing Library on the project's own `vite.config.ts` (D-43). ⚠️ 6 of 84 files under `frontend/src` — a foundation, not a sweep |
| CI | ✅ GitHub Actions runs the backend tests, the frontend build and `alembic check`. ⚠️ **The frontend test suite is not a CI step yet** — the frontend job still runs `npm run build` only |
| Migrations | ✅ Alembic; 1 revision; startup applies `upgrade head` |
| Deployment | ❌ No configuration of any kind |

⚠️ **Local development now requires one env var.** A fresh clone must export either
`FOODLINK_SECRET_KEY` or `FOODLINK_DEV_INSECURE_SECRET=1` before the backend, the CLI
**or an `alembic` command** will start — `migrations/env.py` gets the database URL from
the same `Settings` object. The error message states both options. Tests supply their
own key in `conftest.py` and need no setup.

## Recently completed (newest first)

- **2026-09-05, uncommitted working tree** — **Task 23: the frontend has an automated test
  command.** `npm test` in `frontend/` runs **40 tests over 6 files in ~1.5 s**, all
  passing. Vitest 3.2 + Testing Library, configured as a `test` block in the existing
  `vite.config.ts` so tests resolve modules exactly as the build does; Vitest 5 requires
  Vite ≥ 6 and this project is on Vite 5.4, so the version is pinned deliberately. Seeded
  on the seams that carry logic `tsc` cannot check: `lib/adapters.ts`, `lib/time.ts`,
  `lib/api.ts`, `lib/impact.ts`, `lib/geo.ts` and `components/ProtectedRoute.tsx` — the
  arithmetic behind D-32, D-33 and D-40, each of which closed with *"Nothing tests this"*.
  **No application source file was modified**: four devDependencies, the config block, two
  `package.json` scripts, seven new files under `frontend/src`. Only `fetch` and `useAuth`
  are stubbed, both process boundaries. Verified by mutation — inverting the D-33 distance
  precedence in `lib/geo.ts` passes `tsc` and fails the suite. `npm test` 40/40,
  `tsc --noEmit` clean, `npm run build` clean. ⚠️ Not yet a CI step. See `DECISIONS.md`
  D-43.
- **2026-09-05, uncommitted working tree** — **Task 22: the matcher's two size criteria now
  measure two different things, and only comparable units are compared.** `HA-5`:
  `Recipient.capacity` counts meals — the product fixed that in three places and
  `matching.CAPACITY_UNIT` now names it, rather than a new column naming it again. Only a
  meal-denominated donation is scored against it; Kg, Boxes, Pieces and anything
  unrecognised leave both size criteria at `UNASSESSED_SIZE_SCORE` with a `reasons` line
  saying the size was not assessed. **Nothing is converted** — the repository holds no mass
  field, no per-category yield table and no conversion rule, and a fabricated factor inside
  the score the platform asks people to check by hand is exactly what D-05 forbids.
  Abstaining is safe rather than a fudge because the unit belongs to the *donation*: every
  candidate gets the same value, so it cannot reorder a ranking, and such donations rank on
  distance, deadline and reliability. `HA-4`: `_capacity_score` now measures **absolute**
  spare meals, saturating at `FULL_HEADROOM_MEALS`, where it used to be an exact affine
  function of `_quantity_score`. An absolute term was required — any scale-free function of
  `(quantity, capacity)` collapses back into the ratio. The pair's maximum has moved off the
  boundary: it now sits at `capacity = quantity + 100` and is **global and interior**, where
  the old pair's best candidate was always the smallest kitchen the donation fitted, so the
  winner is the kitchen that takes the donation comfortably *and* keeps a full day's room.
  Over feasible capacities the old pair spanned **exactly 5.00 points** whatever the donation
  size; the new pair spans roughly **10.6–17.5 points for donations of 20–500 meals**.
  ⚠️ The curve is **not** single-peaked — the criteria cross between exact fit and
  saturation, leaving a shallow local minimum (D-42). `WEIGHTS` untouched, so `R-31` is
  unblocked and separate. One source file
  changed; 25 new tests (`test_matching_scores.py`, the matcher's first direct unit tests);
  191 → **216 passing**, no existing test modified; `alembic check` clean; no schema, API or
  frontend change. See `DECISIONS.md` D-42.


- **2026-09-05, commit `e7032ea`** — **Task 21: the three defects the health audit
  could reproduce.** `HA-1`: `GET /api/volunteers` was role-gated to `admin`/`ngo` and
  scoped no further, so every courier's name, location and **phone number** was one
  self-registration away from anybody — `ngo` is a self-signup role and `is_verified` gates
  ranking and acceptance, not reads. `organisations._visible_volunteers()` now returns the
  caller's scope as a WHERE clause in `_visible_recipients`' shape: admin unrestricted, an
  `ngo` narrowed to the couriers on its **own** donations, everyone else nothing. No new
  relationship was needed — the donation row already carries both foreign keys — and no
  frontend change, because `AdminVolunteers` is the only screen that renders the roster.
  `HA-2`: the release now releases. `update_status` clears `volunteer_id` when `ACCEPTED`
  is reached from `VOLUNTEER_ASSIGNED`, and skips the acceptance side effects for a
  donation already bound to the accepting organisation — so a released pickup is visible
  and claimable to every courier, one donation counts as one acceptance however many times
  it is released, and `match_score` keeps the value the kitchen actually decided on. The
  state graph, the role table, `OWNED_TRANSITIONS`, `_needs_ownership` and the atomic
  courier claim are all untouched. And `image_url` is bounded at 256 KiB
  (`schemas.MAX_IMAGE_URL_LENGTH`) by `Field(max_length=...)`, so the limit is in the
  OpenAPI document; the column stays `Text`, so there is no migration. 21 new tests, 12 of
  which fail against the pre-fix code; 168 → **191 passing**; `alembic check` clean.
  ⚠️ One existing test asserted the `HA-2` defect as intent and was **rewritten, not
  deleted** — see `TASKS.md` → *Completed*. See `DECISIONS.md` D-41.


- **2026-09-05, documentation only** — **Full project health audit against `c274e99`.**
  No source changed; 168 tests re-run passing, `alembic check` clean, `tsc && vite build`
  clean. It confirmed the architecture, the authorization model and the decision log as
  broadly sound, and found **five defects none of the four AI files carried**, each
  reproduced against a throwaway database rather than inferred: the courier roster is
  readable by any self-registered account (23), releasing a pickup strands it (24),
  `/matches` discloses recipient coordinates (25), and two of the matcher's five criteria
  are collinear (26) and dimensionally invalid (27). It also found the landing page
  fabricates more than I-1a recorded (28). All six are in `TASKS.md` under the tag `HA-n`;
  none is architectural, and none needs a schema change. **Verdict: no major blocker —
  close 23, 24 and the `image_url` cap, then the matcher, then switch to product work.**

- **2026-09-04, commit `551c96d`** — **Lifecycle write authorization: the
  four transitions that acted on a donation without checking whose it was.**
  `POST /api/donations/{id}/status` gated `PICKED_UP`, `DELIVERED`, `COMPLETED` and
  `CANCELLED` on the caller's *role* alone, so any volunteer account could collect and
  deliver a pickup assigned to a different courier; any NGO account could confirm receipt
  of a donation its organisation never accepted — incrementing that organisation's
  `completed_donations`, a counter the platform presents as evidence; and any donor could
  withdraw another donor's donation out from under the kitchen and courier working on it.
  All four were reproduced through the endpoint as a `200`. `CANCELLED` was the subtle
  one: an `is_owning_donor` comparison sat right beside the role gate but was unreachable,
  because `donor` was already in the role set — a named variable describing a test that
  never ran, which is what let it survive a read of the function. The fix is one set,
  `donations.OWNED_TRANSITIONS`, and one re-read: those targets now resolve the donation
  through `_get_readable_or_404`, the same D-24 clause the read endpoints use, which for
  each of them already means the party it belongs to — the posting donor, the assigned
  courier, the accepting organisation. So ownership has one encoding rather than two, and
  the dead clause is deleted rather than repaired. Denial is the read path's 404.
  `ACCEPTED` and `VOLUNTEER_ASSIGNED` are deliberately still unscoped (they act on a
  donation nobody is bound to yet), the courier claim's atomic guard is untouched, an
  administrator's stand-in path is unnarrowed, and `CANCELLED` is still legal from every
  state the transition table already allowed. No schema change, no migration, no frontend
  change. 14 new tests (four fail against the pre-fix code); 148 → 162 passing, no
  existing test modified. See `DECISIONS.md` D-34.

- **2026-09-04, commit `c274e99`** — **I-9: an account can read the phone number it
  is allowed to write.** The audit filed three claims here and two were wrong: the donor
  form's *Email Address* input has been bound to `profile.email` since the first commit, at
  the audit's own commit included, and that value is rendered — both were verified with
  `git show 23c27f4:` and in the running app. The third was real, and the cause sat in the
  API rather than the form. `User.phone` is written at registration (`RegisterRequest`) and
  by the holder (`ProfileUpdate` via `PATCH /auth/me`), and the donor form already sent it
  on save — but `UserOut`, the only schema an account receives about itself, omitted it, so
  the number was **write-only** and the form had nothing to initialise from. `UserOut` now
  carries `phone`, mirrored through `ApiUser` → `User` → `toUser()`, and the form reads it.
  Every response carrying `UserOut` describes the caller's own account, so no other
  person's contact data is widened; other people's numbers stay behind `UserAdminOut` and
  `RecipientOut` (`DECISIONS.md` D-40). *Default Pickup Address* and *Operating Hours* were
  left empty on purpose: a donor account has no profile row and no location column exists
  for one, so there is nothing to read and none was invented. Round-trip verified in the
  running app — seeded number loads, an edit saves through `PATCH /auth/me`, a full reload
  shows the new value, and an account with no number shows an empty field. 168 backend
  tests pass.

- **2026-09-04, commit `ed56bd5`** — **I-8: the explainability panel describes the
  criteria the matcher actually scores.** Two of the four captions in
  `components/MatchAnalysis.tsx` named inputs `matching.py` never reads. *Recipient
  Capacity* claimed "Cold storage and immediate consumption bandwidth", where
  `_capacity_score` takes only the donation quantity and the kitchen's stated capacity and
  returns the headroom left afterwards — the matcher never reads `storage_type`, and
  `COLD_STORAGE` remains the dead constant tracked in *Backlog → F*. *Pickup Availability*
  claimed "Recipient intake volunteers ready before deadline", where `_deadline_score`
  measures the slack between now and the pickup deadline less an estimated collection trip,
  and no volunteer data reaches the matcher at all. Both now say what their criterion
  computes. **Nothing about the scoring changed** — no weight, formula, threshold or API
  field, and `matching.py` is untouched. This is D-06 being kept rather than a new
  decision: the panel exists so a score can be read back, and a caption naming a
  non-existent input defeats it.

- **2026-09-04, commit `fc91091`** — **I-7: the detail-view timeline says when a
  pickup deadline has gone.** `components/StatusTimeline.tsx` was driven purely by `status`,
  so a donation whose collection window closed hours ago read *"Matched · Current"* with no
  mention of the deadline — the one surface that never showed it, while the list and card
  surfaces already used `lib/time.deadlineStatus()`. The timeline now calls that same
  helper on the donation it already holds (no new prop, no change at the three call sites)
  and marks the current step *Overdue*, naming the time the window closed, in the four
  statuses where the food is still uncollected. `PICKED_UP`, `DELIVERED` and `COMPLETED`
  are never marked overdue — the pickup happened, so the deadline has been answered, which
  is D-38's rule one field along. **No new lifecycle state and no client-side expiry:** the
  row is still exactly the status the server says it is, and the sweep that would retire
  these rows remains unbuilt (`TASKS.md` → *Backlog → E*). Verified in the running app
  against a scratch database holding all ten cases — the four uncollected statuses past
  deadline, an accepted donation still inside its window, picked-up/delivered/completed
  past deadline, and the existing `EXPIRED` and `CANCELLED` panels. See `DECISIONS.md` D-39.

- **2026-09-04, commit `b41c4e6`** — **I-6: the NGO courier line follows the
  donation's status, not the presence of a name.** `pages/ngo/NGOAcceptedDonations.tsx`
  picked both the courier name and the "COURIER DISPATCH" caption from `volunteerName`
  alone, on a screen that lists `COMPLETED` donations — so a finished delivery still
  described a courier in the present tense, and an `ACCEPTED` donation whose courier had
  been released still named them (`volunteer_id` is set by the claim and no transition
  clears it). A `COURIER_STAGE` map, total over `DonationStatus` in the same shape as
  `StatusBadge`'s `STATUS_CONFIG`, now supplies the caption per status, and the name is
  shown only in the statuses that actually bind a courier — kept for `COMPLETED`, where it
  is the record of who carried the food. No new status, no backend, schema or lifecycle
  change; one frontend file. Verified in the running app against a scratch database holding
  every case: accepted-without-courier, accepted-with-released-courier, volunteer-assigned,
  picked-up, delivered and completed-with-courier. See `DECISIONS.md` D-38.

- **2026-09-04, commit `6c82739`** — **I-5: "verified" now means the one thing the
  database actually records.** The trust model was mapped before anything was edited, and
  it is a single boolean: `Recipient.is_verified` — *an administrator vouched that this
  organisation is real and is where it claims to be*. It exists on `Recipient` only,
  defaults to `false`, is writable only by the admin verify endpoints, and is read by
  `matching.score_pair` (unverified organisations are not ranked) and the `ACCEPTED` gate
  (they cannot take custody). There is **no** donor or volunteer verification in the model,
  and no FSSAI field, provider or evidence store anywhere. **No backend, schema or seed
  change.** Removed from the donor profile on both desktop and mobile: the unconditional
  *"Verified Institutional Donor"* / *"Verified donor"* badge — worn by a self-registered
  account one minute old — now a neutral *"Donor account"* chip; and the *"FSSAI Hygiene
  Standards Compliant"* panel, reframed as **Safe Handling Guidance** that keeps the
  handling advice and states plainly that FoodLink does not inspect kitchens or assess
  hygiene. Also `VolunteerHistory`'s *"Verified Delivery"* fallback for a **missing**
  timestamp → *"Not recorded"*, and `MatchAnalysis`'s badge → *"Admin-verified recipient
  organisation"*. Every genuine recipient surface is untouched; both `is_verified` states
  were exercised in the running app. See `DECISIONS.md` D-37.

- **2026-09-04, commit `6863451`** — **I-4: the interface no longer offers
  notifications it cannot send.** Verified first that there is nothing to wire to: the
  backend contains no occurrence of `notif`, `sms`, `smtp`, `twilio`, `sendgrid`, `fcm` or
  `websocket`. **No backend file changed.** All ten dead toggles removed across four
  profile screens — the desktop donor's email/SMS checkboxes, the mobile donor's
  auto-accept/reminders/digest, the mobile NGO's entire *Notifications* section, and the
  mobile courier's proximity/night-hours pair. Four adjacent claims reworded rather than
  deleted, because each sits on a screen that does do something real: *"Kitchen notified"*
  → *"Listed for kitchens"*, *"…notify the best recipient organization"* → the scoring the
  matcher actually performs, *"ready to receive new pickup dispatch alerts"* → *"show me as
  available on the courier roster"*, and both availability toasts, which promised an offer
  mechanism that does not exist. **Volunteer availability was preserved and re-verified
  end-to-end** — `is_available` is a real `VolunteerUpdate` field, and toggling it in the
  running mobile UI wrote `is_available = 0` to the database. Nothing replaced with
  `localStorage`, mocks or new endpoints. Typecheck and production build clean. See
  `DECISIONS.md` D-36.

- **2026-09-04, commit `efd5fd8`** — **Lifecycle authorization audit (Task 14):
  one more ownership hole, closed.** Every edge of `ALLOWED_TRANSITIONS` was enumerated
  against `TRANSITION_ROLES` and `OWNED_TRANSITIONS`. Three edges act on an already-bound
  donation with no ownership gate; two are sound (`ACCEPTED → EXPIRED` is admin-only,
  `ACCEPTED → VOLUNTEER_ASSIGNED` is settled atomically by `_claim_pickup`). The third was
  **an organisation-takeover vulnerability**: `VOLUNTEER_ASSIGNED → ACCEPTED` — the
  release of a pickup — is role-gated to `ngo`/`admin` and was unscoped, so any verified
  kitchen could `POST` `ACCEPTED` on a donation another kitchen had accepted and a courier
  was already carrying, and the binding side effect moved `recipient_id`,
  `accepted_donations` and `match_score` on to the attacker, who then owned it for every
  later gate including `COMPLETED`. The same account got a **404 on the plain read** of
  that donation, so the write granted what the read refused. Reproduced through the HTTP
  endpoint before the fix. D-34 had reasoned about the *target* (`ACCEPTED` binds a party,
  so scoping it would forbid binding) when the answer depends on the *source state*; the
  gate is now `_needs_ownership(donation, target)`, adding `ACCEPTED` from any state
  outside `OPEN_TO_RECIPIENTS`. `OWNED_TRANSITIONS`, `TRANSITION_ROLES`,
  `ALLOWED_TRANSITIONS`, the courier claim and every existing response are unchanged; no
  schema change, no migration, no frontend change. 6 new tests (two fail against the
  pre-fix code); 162 → 168 passing, no existing test modified. See `DECISIONS.md` D-35.

- **2026-09-04, commit `b5e09ee`** — **I-3: the requirements board no longer claims
  to drive matching.** The matcher was re-verified first and is unchanged: `score_pair`
  takes a `Donation` and a `Recipient`, `MatchOut` has no requirement field, and the only
  backend readers of the table are still `routers/organisations.py` and `seed.py`. **No
  backend file changed.** Removed from the NGO requirement surfaces: *"so FoodLink AI
  prioritizes donations matching your requirements"*, **"AI Scanning Active"**,
  **"Auto-matching enabled"**, *"lets the platform rank incoming surplus against your
  demand"*, *"matching donations are pushed to you first"* and *"Listings matching this are
  ranked for you first"*. The **"Daily Recurring"** badge now reads "Needed daily" — the
  flag describes the need, and nothing re-posts a requirement (constraint 7). Four toasts
  claiming *"Donors can now see what you need"* were also corrected: all three callers of
  `useRequirements()` are NGO screens, so no donor surface renders requirements at all.
  Requirement creation, editing, retirement, the API and all 15 lifecycle tests are
  untouched. Roadmap surfaces naming "Demand-aware redistribution" were left alone — each
  carries an explicit phase and a not-done badge.

- **2026-09-03, commit `fcbd03b`** — **I-2: the interface no longer claims routing
  or live GPS.** `MapPreview` was captioned "Redistribution Route Corridor" with a
  hard-coded `~0.8 km` first leg, a second leg derived as `distanceKm - 0.8`, an "Estimated
  Travel" of `distanceKm * 6 + 10` minutes (a 10 km/h assumption contradicting the
  backend's own 20 km/h) and a footer reading **"Live GPS tracking active in Phase 2"**,
  under an NGO heading reading **"Live Corridor Tracking"**. It is now a *Handover
  Overview*: the same three-node schematic, no per-leg numbers, no travel estimate, and a
  footer carrying the one real figure — the server's straight-line distance — beside
  "Schematic only — no road route, travel time or courier location". Invented fallbacks
  are gone (`~2 km`, `1.8`, `2.4`, `~2`); an unknown distance now reads *unavailable*.
  `CreateDonation`'s "ranked by real travel distance" hint, the NGO "in real time" /
  "En route on vehicle" copy, `TaskCard`'s "get directions" and `VolunteerHistory`'s
  "km route" are corrected. **The one behavioural fix:** open donations carry no
  `distanceKm` (it is measured against a *matched* recipient), so every NGO surface was
  showing `– km`; `lib/geo.displayDistanceKm` now prefers `viewerMatch.distanceKm`, the
  server's straight-line distance to the *calling* kitchen, which is what those screens
  were asking for. Two backend `reasons` strings were qualified ("in a straight line";
  "estimated collection time") — no scoring change. See `DECISIONS.md` D-33.
  148 backend tests pass; `tsc && vite build` clean.

- **2026-09-03, commit `e8a8178`** — **I-1: the impact screens now only print what
  the app knows.** Six impact surfaces and two dashboards were reading a mixture of real
  counts, real counts with a literal added, and pure invention under headings reading
  "real-time" and "verified". Everything now comes from `frontend/src/lib/impact.ts`, one
  module both the desktop portal and `/m/*` call, fed by the account's own donation list
  (already scoped server-side by D-24) and its own server counters. Gone: `+ 1240`, `+ 18`,
  `+ 42`, `+ 8`; the literal cards (`5` shelters, `850+` beneficiaries, `8` kitchens, `42`
  min delivery, `48.5` km, `4.9` rating); every invented `trend`/`equivalent` line; both
  fabricated badge blocks; the 68/18/10/4 category chart, the literal demographics and the
  literal six-month bar array; and the hard-coded "College Central Mess" / "Aarav"
  identities. Both **"Download Impact Report" buttons are deleted** — they were `alert()`
  calls producing no file, and `alert(` no longer appears anywhere in `frontend/src/`.
  The desktop/mobile CO₂e contradiction is closed by **removing both** rather than picking
  a third factor: `quantity` is a mixed-unit count (Meals · Kg · Boxes · Pieces), so no
  per-kilogram figure applies to it. Charts are now derived (`category`, `createdAt`,
  recipient and donor shares) and degrade to insufficient-data states. **`GET /api/metrics`
  is deliberately still not read here** — it is platform-wide, and a per-role page asking
  "how am I doing" would be answered with FoodLink's total. See `DECISIONS.md` D-32.
  148 backend tests pass unchanged (no backend change); `tsc && vite build` clean; verified
  in the running app for a donor, an NGO and a courier, desktop and mobile, with the
  dashboard strips matching their impact pages figure for figure.

- **2026-09-02, documentation only** — **A QA audit, and what it found.** Twelve manual-QA
  observations were traced through the stack and classified; no source changed and the 148
  tests were re-run unchanged. The result is worth carrying forward as one sentence:
  **the backend is broadly honest and the frontend is not.** Every server-computed figure
  the audit followed comes from real rows — `/api/metrics` from the ledger, `viewerMatch`
  live through `score_pair`, reliability from the recipient's own counters. Meanwhile the
  interface claims requirement-aware matching that `matching.py` cannot do (it never
  references `Requirement`), live GPS tracking that exists nowhere in the repository,
  notification delivery through ten dead toggles (all four of those claim families since
  removed — I-1, I-2, I-3, I-4), FSSAI verification of a donor the data
  model has no verification concept for, and impact totals padded with literals — one real
  meal count with `+ 1240` added to it, another with `+ 18`. Two "Download Impact Report"
  buttons are an `alert()` and produce no file. Nine items in `TASKS.md` → *Backlog → I*,
  four new questions in *Blocked*, and one new decision, `DECISIONS.md` D-31: a claim the
  interface makes is a claim the system must be able to honour, and a roadmap claim is fine
  **if it is labelled as one**. Three findings were classified acceptable on that basis.

- `23c27f4` — **One donation, one kitchen, one number.** The NGO's *Available Donations* list showed 94% for a donation whose analysis
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

**`TASKS.md` → *Next* is no longer empty.** The seven-step hardening sequence —
signing-key configuration, migrations, donation read scoping, CI, recipient read scoping,
authentication rate limiting, courier claim race — is complete, and group I (the nine
interface claims the QA audit found the system could not honour) is complete except the
landing page. What replaced them is the health audit's six confirmed findings, and unlike
group I they are **defects in the running system, not in its description**.

**Steps 1–4 of that sequence are done** — step 1 (`HA-1`, `HA-2`, the `image_url` cap) as
`e7032ea`, step 2 (the matcher's scoring, `HA-4`/`HA-5`) as `a9f190b`, step 3 (the frontend
test harness, `HA-8`/`R-14`) as `f33aeae`, and step 4 (the landing page, `HA-6`)
uncommitted in the working tree. **Group I is now complete**, which closes the QA audit's
interface-honesty programme: no screen in the project states a capability the system
cannot honour.

Two smaller pieces of step 3 were deliberately left out and are now in `TASKS.md` →
*Backlog → D*: adding `npm test` to `ci.yml`, and the dead `npm run lint` script
(*Backlog → H*), which has always referenced an `eslint` that is not a dependency.

**Then stop hardening.** The audit's strategic conclusion is that the remaining backlog
splits into things that are *broken* (steps 1–3 of *Next*, two to three days) and things
that are merely *unbuilt* — Postgres, deployment, logging, pagination. The second group is
infrastructure for a deployment that does not exist yet and should be sequenced *with* that
deployment rather than ahead of it. The recommended first product feature is the **donor
needs board** (*Blocked*): **S**, no endpoint or schema change, over data
`AppContext.load()` already fetches for every role.

Everything else sits in `TASKS.md` → *Backlog* (grouped hardening, then optional expansion
and cleanup) or *Blocked*, which holds **eight** open decisions: the original four, plus
the four the QA audit opened — road distance, requirement-aware matching, a donor needs
board, and a real impact report. None of it has been committed to.

## Known issues and blockers

**Nothing blocks development or local use.** Ordered by severity; numbering is kept
stable as items are resolved, so gaps are expected.

### High — found by the health audit, 2026-09-05, each reproduced

23. ✅ **Resolved (Task 21, `e7032ea`).** `GET /api/volunteers` is role-gated **and**
    scoped: `_visible_volunteers()` narrows an `ngo` to the couriers on its own donations,
    admin stays unrestricted, everyone else reads nothing. What was open —
    **the whole courier roster —
    names, locations and *phone numbers* — is readable by any account holding the `ngo`
    role.** Registration accepts `role: "ngo"` from a stranger and the row starts
    `is_verified=False`; verification gates ranking and acceptance, not this endpoint. So
    the cost of reading every courier's phone number is one throwaway email address.
    Reproduced: a freshly registered, unverified NGO gets `200` and the full roster.
    ⚠️ This is the objection **D-26 wrote down and then fixed only on the neighbouring
    table** — `RecipientOut` was scoped, `VolunteerOut` was not, and no task was filed.
    Now covered by `test_volunteer_reads.py` (8 tests), the read-scope file this endpoint
    never had. See `DECISIONS.md` D-41.
24. ✅ **Resolved (Task 21, `e7032ea`).** The release clears `volunteer_id` and no
    longer re-runs the acceptance side effects, so a released pickup returns to the pool
    and one donation counts as one acceptance. What was open — **releasing a pickup did
    not release it.** `VOLUNTEER_ASSIGNED → ACCEPTED` is legal,
    role-gated to the accepting kitchen, and described throughout this documentation as
    "the release of a pickup" — but **nothing clears `volunteer_id`**. Three consequences,
    all reproduced: `_readable_by` gives a courier `ACCEPTED AND volunteer_id IS NULL`, so
    the donation becomes **invisible to every other courier**; `_claim_pickup`'s
    `volunteer_id IS NULL OR volunteer_id = :courier` means only the original courier can
    ever take it again and anyone else gets a `409` that is not true; and the acceptance
    side effect runs a second time, so `recipient.accepted_donations` goes 1 → 2 for one
    donation — which, since `reliability_score = 100 × completed/accepted`, means **a
    kitchen that releases a courier permanently damages its own match score** (15% of the
    ranking weight) for doing the right thing. Now covered by `test_pickup_release.py`
    (13 tests). See `DECISIONS.md` D-41.

### Medium — found by the health audit, 2026-09-05

25. **`GET /donations/{id}/matches` gives back the recipient coordinates D-26 withholds.**
    A donor reads `[]` from `GET /api/recipients` by design, then posts three donations at
    pins of their choosing and trilaterates any verified kitchen from `MatchOut.distanceKm`.
    Reproduced: recovered `(30.3600, 76.3700)` exactly, first try. Whether it matters is a
    product judgement — a community kitchen's address is often public, a shelter's may not
    be — but it is a demonstrated bypass of a scoping decision made on purpose. `HA-3`.
26. ✅ **Resolved (Task 22, uncommitted).** `_capacity_score` now measures absolute spare
    meals, saturating at `FULL_HEADROOM_MEALS`. Over feasible capacities the old pair spanned
    exactly 5.00 points whatever the donation size; the new pair spans roughly 10.6–17.5
    points for donations of 20–500 meals, and its maximum is now interior
    (`capacity = quantity + 100`) rather than on the boundary — though the curve is not
    single-peaked (D-42). `WEIGHTS` untouched.
    What was open — **two of the five criteria were the same input inverted.** `_quantity_score`
    and `_capacity_score` take the same two arguments and are monotone in the same ratio
    `r = quantity / capacity`, in opposite directions:
    `0.25(40 + 60r) + 0.20(100 − 50r) = 30 + 5r`. So 45% of the published weight moves
    **five points across the entire feasible range**, then falls off an 11.5-point cliff at
    `r = 1`. In practice the ranking is decided by distance (25%) and deadline (15%) —
    reliability is the flat `85` prior for any kitchen under three acceptances. The
    explainability panel renders them as two independent bars, which since I-8 are captioned
    accurately and now describe two genuinely different measurements. See `DECISIONS.md`
    D-42; covered by `test_matching_scores.py`.
27. ✅ **Resolved (Task 22, uncommitted).** Only meal-denominated donations are compared
    with capacity; any other unit leaves both size criteria unassessed and says so in
    `reasons`, and nothing is converted. What was open — **the matcher compared
    `Donation.quantity` against `Recipient.capacity` without reading `Donation.unit`.** `quantity` is a count in Meals · Kg · Boxes · Pieces; `capacity` is
    meals per day. Measured: 100 Kg and 100 Meals score identically (88); 5 Boxes scores 83.
    `lib/impact.ts` carried a prominent warning about exactly this mixed-unit hazard for
    display totals and the matcher had no equivalent guard; it does now. See `DECISIONS.md`
    D-42. ⚠️ **Consequence worth carrying:** a Kg/Boxes/Pieces donation is now ranked on
    three criteria rather than five. That is honest, not a regression, but the platform's
    headline score is less discriminating for those donations until a real unit model
    exists.
28. ✅ **Resolved (working tree, Task 24) — the landing page no longer prints a platform
    figure.** All three sites are gone: the four-stat strip (`1,240+` meals, `32` partner
    organizations, `56` volunteers, `84` pickups), the hero card captioned **"Live this
    term"** under a pulsing dot, and `HOW_IT_WORKS`'s "**in real time** on every dashboard".
    Nothing was replaced with a substitute number — `GET /api/metrics` is behind
    `get_current_user`, so a pre-login page has no source and the honest section is one that
    explains **how** impact is counted rather than asserting a total. The sample match card
    in the same page kept its figures but is now titled *Example match analysis* with an
    *Illustrative sample* footnote, which is D-31's labelling remedy rather than a deletion:
    the five criteria it shows are the matcher's real ones. Covered by
    `pages/__tests__/Landing.test.tsx`, which asserts the absence of the eight literals and
    of any "real time" wording.

### Resolved, and earlier open items (1–22)

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

#### Medium — earlier
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

#### Low / correctness oddities
10. **A donation accepted but never delivered is stuck forever** — the sweep only
    touches `AVAILABLE` and `MATCHED`. Undecided whether intentional.
11. **Revoking verification mid-lifecycle has no effect** on an already-accepted
    donation. Untested, undecided.
12. Two `foodlink.db` files exist (repo root and `code/`) because the SQLite path is
    relative to the working directory — a recurring "my data vanished" trap. Both are
    now stamped at head; only `code/foodlink.db` holds data (10 users, 6 donations).
13. `image_url` has no length or format validation; frontend sends base64 data URLs
    into a `Text` column. ⚠️ The health audit measured the cost: a 3 MB data URL is
    accepted and stored, and `AppContext.load()` re-fetches `limit=500` donations after
    **every** mutation, so one photo is 3 MB on every write by every user. Promoted to
    ✅ **The length half is resolved (Task 21, `e7032ea`):**
    `DonationCreate.image_url` now carries `max_length=MAX_IMAGE_URL_LENGTH` (256 KiB),
    enforced at the request boundary and published in the OpenAPI document; the column
    stays `Text`, so there is no migration. ⚠️ Real consequence: an unresized phone photo
    is now a 422, and the frontend still encodes at full size. **Format validation is still
    absent**, and object storage (`TASKS.md` → *Backlog → F*) remains the real fix.
15. ✅ **Resolved (`fcbd03b`, I-2) — an NGO now sees its own distance to an open
    donation.** `serialize.donation_out()` still measures `distanceKm` against the
    *matched* recipient, so it is still null in the open pool — but that is no longer
    what the screens read. `lib/geo.displayDistanceKm` prefers `viewerMatch.distanceKm`
    (D-30, D-33), and `DonationCard`, `DonationRow` and `mobile/NGOAvailable` (list, sort
    and sheet) all go through it. The "– km" symptom and the `?? 99` no-op sort are gone.
16. **A donation's `MATCHED` activity line reads the current `match_score`**
    (`adapters.activityMessage`), which acceptance overwrites — so "Matched X at 94%"
    silently becomes "at 79%" afterwards. Recording the score on the event would fix it;
    the column cannot.
17. **`/ngo/available/:id` renders `NGOAvailableDonations`, which never reads the
    param** — a deep link from the dashboard row opens the list with nothing selected.
14. An unhandled 500 reaches the user as "Cannot reach the FoodLink server" because
    `api.ts` maps a bodiless 5xx to `NetworkError` — a crash looks like an outage.

#### Claims the interface makes that the code cannot honour (QA audit, 2026-09-02)

Full evidence and per-item scope in `TASKS.md` → *Backlog → I*; the principle is
`DECISIONS.md` D-31. Listed here because severity is a judgement about the project's
credibility rather than about its correctness, and that judgement belongs in this file.

18. ✅ **Resolved (`e8a8178`, 2026-09-03) — impact figures are no longer invented.**
    The padded reals (`+ 1240`, `+ 18`, and two more the audit missed on
    `VolunteerDashboard`: `+ 42` and `+ 8`), the literal cards, the fabricated
    charts, the badge blocks and both `alert()` export buttons are gone; desktop and
    `/m/*` now share `lib/impact.ts`, so the CO₂e contradiction cannot recur — both
    equivalences were removed rather than re-based (D-32). **`GET /api/metrics` is still
    read by the admin screens only, and deliberately so**: it is platform-wide, and a
    per-role page asking "how am I doing" must not be answered with FoodLink's total.
    **The remainder — `pages/Landing.tsx`'s invented pre-login statistics, tracked as I-1a
    and widened by the audit into `HA-6` — was closed by Task 24** (issue 28). It needed no
    scope decision on the authenticated metrics endpoint in the end: the figures were
    removed rather than sourced, so whether a public metrics endpoint should exist stays an
    open, optional question.
19. ✅ **Resolved (`b5e09ee`, 2026-09-04) — the requirement screens no longer claim to
    drive matching.** Re-verified that `matching.py` never references `Requirement`, then
    corrected seven strings across the desktop and mobile requirement surfaces plus four
    toasts that promised donor visibility no donor screen provides. `daily_recurring` is
    still stored and displayed — now as "Needed daily", describing the need rather than a
    scheduler. **Requirements remain a notice board and the matcher is unchanged;** whether
    to make ranking requirement-aware is still the first *Blocked* question (R-35).
20. ✅ **Resolved (`fcbd03b`, 2026-09-03) — the GPS and routing claims are gone.**
    `navigator.geolocation` is still called only to pin a donation at creation; a courier's
    position is never read or stored, and there is no map or routing provider anywhere —
    so `MapPreview` is now a schematic *Handover Overview* with no per-leg distances and no
    travel estimate, and the "Live GPS" / "Live Corridor Tracking" text is gone. The
    hard-coded `0.8 km` leg and the 10 km/h estimate that contradicted the backend's 20 km/h
    were deleted rather than corrected: no travel time is serialised to the client at all.
    See `DECISIONS.md` D-33.
21. ✅ **Resolved 2026-09-04 — verification and notification settings that
    were pure display.** The notification half went with I-4 (`6863451`, D-36): ten `useState` toggles
    across four profile screens, one of them promising to "Auto-accept best match". The
    verification half went with I-5 (`6c82739`, D-37): the unconditional "Verified Institutional
    Donor" badge and the "FSSAI Hygiene Standards Compliant" panel are gone from a role the
    data model has **no** verification concept for. `NGOProfile`, which always read the real
    `me.isVerified`, is unchanged and remains the model the rest now follows.
22. ✅ **Resolved — the smaller items of the same family.** "En route on vehicle" on a
    `COMPLETED` donation (I-2, then I-6 made the whole line status-driven); `StatusTimeline`
    showing "Matched · Current" past the deadline (I-7); the hard-coded seeded identities
    (I-1); the two mis-described criteria in the explainability panel (I-8). ⚠️ The audit's
    sixth claim here — *"the donor profile's Email Address input is bound to
    `operatingHours`"* — **was wrong and is retracted**: that input has read `profile.email`
    since the first commit. The real defect was a **write-only `User.phone`**, fixed by I-9
    (D-40).

## Technical debt

**Dead code (verified unused):**
- `matching.COLD_STORAGE` — defined, never referenced, despite its comment saying
  storage type should gate matching.
- `frontend/src/mobile/useIsMobile.ts` — never imported. Consequence: nothing routes
  a phone visitor to `/m/*`; entry is by URL only.
- `Volunteer.rating` — never written by any API path (`VolunteerUpdate` excludes it);
  only `seed.py` varies it. Every courier created through the app is permanently 5.0.
  **No screen reads it any more:** I-1 removed the "Courier rating" displays, because a
  rating label asserts a feedback mechanism the system does not have (D-32). The column is
  now wholly dead — drop it, or build the mechanism, but it should not come back to a screen
  first.

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
- **One more write-only field, the same shape I-9 fixed one table over:**
  `VolunteerUpdate` writes `latitude`/`longitude` and `VolunteerOut` does not return them,
  so a courier can set a base location it can never read back. D-40's rule — a field the
  holder may write must appear in the schema the holder reads — has not been applied here.
- No structured logging anywhere; no `logging` configuration in the app.
- A retired requirement has no reader: `GET /api/requirements` is active-only, so
  reopening one is possible through the API but not through the UI (`TASKS.md` → *Backlog
  → F*).
- `PATCH /recipients/me` and `PATCH /volunteers/me` assign an explicit `null` straight to
  a non-nullable column, so `{"name": null}` is a 500 rather than a 422. The requirement
  PATCH skips nulls; the two older routes were left alone as out of scope.

## Immediate priorities

1. ✅ **Done and committed — `HA-1` + `HA-2` + the `image_url` bound** (Task 21, `e7032ea`).
2. ✅ **Done and committed — the matcher's size criteria** (Task 22, `HA-4` + `HA-5`,
   `a9f190b`). 216 backend tests pass; `alembic check` clean; one source file changed.
3. ✅ **Done and committed — the frontend test harness** (Task 23, `HA-8` + `R-14`,
   `f33aeae`). Vitest 3.2 + Testing Library over `lib/adapters.ts`, `lib/time.ts`,
   `lib/api.ts`, `lib/impact.ts`, `lib/geo.ts` and `ProtectedRoute`; **40 tests pass**,
   `tsc --noEmit` and `npm run build` clean, no application source file changed. ⚠️ **The
   `ci.yml` step was not added**, so the honesty invariants D-31 → D-40 are now covered by
   tests but those tests do not yet gate a build — see `TASKS.md` → *Backlog → D*.
4. ✅ **Done, uncommitted — the landing page** (Task 24, `HA-6` / I-1a). Review and commit.
   Two fabricated blocks and the real-time claim are gone, replaced by copy about how the
   system counts rather than by substitute numbers; **44 frontend tests pass**,
   `tsc --noEmit` and `npm run build` clean; one page and one new test file changed.
5. **Stop hardening and build the donor needs board** (*Blocked*) — the smallest real
   feature in the project and the one that gives `requirements` an audience. This is now
   the next task: every step of the *Next* sequence is done.

Sequenced behind those, unchanged: `HA-3` (the `/matches` distance disclosure), then
*Backlog → E* (concurrency guard → Postgres → deployment configuration), which is where the
rate-limit-sharing decision gets answered. `R-31` (weight tuning) is unblocked by Task 22
but still wants outcome data the project does not have.

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
