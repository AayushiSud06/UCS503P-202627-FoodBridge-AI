# PROJECT_STATE — FoodLink / FoodBridge-AI

> Compressed project memory. Companions: `ARCHITECTURE.md` (how it is built),
> `TASKS.md` (what is left), `DECISIONS.md` (why it is built that way).
> Last verified against the repository: 2026-09-04, branch `master`. The lifecycle
> write-authorization work is committed — D-34 as `551c96d`, the D-35 ownership-takeover
> follow-up as `efd5fd8` — as are the I-4 notification-honesty pass (`6863451`), the I-5
> trust/verification pass (`6c82739`), the I-6 courier status-display fix (`b41c4e6`) and
> the I-7 overdue-deadline fix (`fc91091`). On top of those the working tree carries the
> **uncommitted** I-8 match-criteria wording fix described below. A QA audit was run
> against `23c27f4` on 2026-09-02; it changed no source and its conclusions are in
> `TASKS.md`.

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
| Frontend web | ✅ Complete — 4 role portals, wired to the live API; impact reporting (I-1), distance/GPS wording (I-2), requirement-matching claims (I-3), notification claims (I-4), verification wording (I-5), the NGO courier status line (I-6), the overdue pickup deadline (I-7) and the match-criteria captions (I-8) are now honest; ⚠️ several *other* screens still **claim capability the backend does not have** (QA audit; `TASKS.md` → *Backlog → I*) |
| Frontend mobile | ✅ Screens exist at `/m/*`; ⚠️ unreachable without typing the URL |
| Auth / RBAC | ✅ Complete — JWT, 4 authorization layers; donation **and** recipient reads scoped by role/ownership, and every lifecycle **write** on a donation that is already somebody's (`PICKED_UP`, `DELIVERED`, `COMPLETED`, `CANCELLED`, and `ACCEPTED` once the donation has left the open pool) scoped by the same clause (D-34, D-35). Every edge of the donation state graph has now been audited against the role and ownership tables |
| Auth rate limiting | ✅ Login and registration limited per client address; ⚠️ counter is **process-local** |
| Signing-key config | ✅ Fail-closed — no insecure default; explicit dev opt-in |
| Courier claim | ✅ Atomic — conditional UPDATE, safe on SQLite **and** Postgres; ⚠️ other transitions still read-then-write |
| Backend tests | ✅ 162 tests passing (~105 s): 37 integration + 15 requirement-lifecycle + 14 lifecycle-write-authorization + 13 donation-read-scope + 11 recipient-read-scope + 11 match-score-consistency + 9 courier-claim + 22 rate-limit + 22 config + 8 migration |
| Frontend tests | ❌ None exist |
| CI | ✅ GitHub Actions runs the tests, the frontend build and `alembic check` |
| Migrations | ✅ Alembic; 1 revision; startup applies `upgrade head` |
| Deployment | ❌ No configuration of any kind |

⚠️ **Local development now requires one env var.** A fresh clone must export either
`FOODLINK_SECRET_KEY` or `FOODLINK_DEV_INSECURE_SECRET=1` before the backend, the CLI
**or an `alembic` command** will start — `migrations/env.py` gets the database URL from
the same `Settings` object. The error message states both options. Tests supply their
own key in `conftest.py` and need no setup.

## Recently completed (newest first)

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

- **2026-09-04, uncommitted working tree** — **I-8: the explainability panel describes the
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

**Nothing is in progress, and `TASKS.md` → *Next* is still empty** — the `CANCELLED`
ownership gap found while fixing the other three was folded into the same change (D-34)
rather than left open. But what would fill the list has changed. The seven-step hardening sequence — signing-key configuration, migrations,
donation read scoping, CI, recipient read scoping, authentication rate limiting, courier
claim race — is complete, and the requirement lifecycle was the first item taken out of
*Backlog → F*. Every unscoped read of personal contact data is closed, bcrypt is no longer
the only bound on a credential-stuffing run, and the one correctness defect that had to be
fixed before Postgres is fixed.

**The QA audit added a body of work that did not exist on the list before**, and it is not
optional polish. `TASKS.md` → *Backlog → I* covered nine interface claims the system cannot
honour — invented impact figures, live-GPS text over a component with no GPS, matching
promises the matcher does not keep, dead notification settings, unearned verification
badges. **I-1 (the largest), I-2, I-3, I-4, I-5, I-6, I-7 and I-8 are done**; one remains
(**I-9**, **S**), plus the small I-1a residue on the landing page. D-31 explains why that ranks as hardening in
this project specifically: the platform's argument is that its numbers are evidence, and
fabricated ones sitting beside real ones cost more here than they would elsewhere.

**The order is still a Project Manager call.** Two things worth carrying into it. First,
group I is cheap and demo-facing: it is what an evaluator sees in the first five minutes,
and most of it is deletion and rewording rather than construction. Second, *Backlog → E*
(Postgres, then deployment configuration) remains the largest block of unbuilt work and is
no longer gated by anything in the codebase — while groups A and B still hold several
sub-hour items (SQLite foreign-key enforcement, an `image_url` cap, a readiness probe)
that would not displace it.

Everything else sits in `TASKS.md` → *Backlog* (grouped hardening, then optional expansion
and cleanup) or *Blocked*, which now holds **eight** open decisions: the original four,
plus the four the audit opened — road distance, requirement-aware matching, a donor needs
board, and a real impact report. None of it has been committed to.

## Known issues and blockers

**Nothing blocks development or local use.** Ordered by severity; numbering is kept
stable as items are resolved, so gaps are expected.

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

### Medium
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

### Low / correctness oddities
10. **A donation accepted but never delivered is stuck forever** — the sweep only
    touches `AVAILABLE` and `MATCHED`. Undecided whether intentional.
11. **Revoking verification mid-lifecycle has no effect** on an already-accepted
    donation. Untested, undecided.
12. Two `foodlink.db` files exist (repo root and `code/`) because the SQLite path is
    relative to the working directory — a recurring "my data vanished" trap. Both are
    now stamped at head; only `code/foodlink.db` holds data (10 users, 6 donations).
13. `image_url` has no length or format validation; frontend sends base64 data URLs
    into a `Text` column.
15. **`serialize.donation_out()` computes `distanceKm` against the *matched* recipient,
    so it is null for every donation an NGO is still deciding on** — the lists show
    "– km", and mobile's *Nearest* sort is therefore a no-op on the available list. The
    figure now exists per-viewer inside `viewerMatch.distanceKm`; wiring it up was left
    out of the match-score fix as unrelated to the score.
16. **A donation's `MATCHED` activity line reads the current `match_score`**
    (`adapters.activityMessage`), which acceptance overwrites — so "Matched X at 94%"
    silently becomes "at 79%" afterwards. Recording the score on the event would fix it;
    the column cannot.
17. **`/ngo/available/:id` renders `NGOAvailableDonations`, which never reads the
    param** — a deep link from the dashboard row opens the list with nothing selected.
14. An unhandled 500 reaches the user as "Cannot reach the FoodLink server" because
    `api.ts` maps a bodiless 5xx to `NetworkError` — a crash looks like an outage.

### Claims the interface makes that the code cannot honour (QA audit, 2026-09-02)

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
    **Remaining, and now tracked as `TASKS.md` → I-1a:** `pages/Landing.tsx` still prints
    four invented platform statistics pre-login, which cannot be fixed by reading real
    data without a scope decision on the authenticated metrics endpoint.
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
22. **Smaller, same family:** "En route on vehicle" renders on a `COMPLETED` donation
    because the line ignores `status`; `StatusTimeline` shows "Matched · Current" with no
    hint that the deadline passed, though `lib/time.ts` already computes "Overdue"; three
    screens hard-code seeded identities ("College Central Mess", "Aarav") for every account;
    the explainability panel mis-describes two of its five criteria; the donor profile's
    "Email Address" input is bound to `operatingHours`.

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
- No structured logging anywhere; no `logging` configuration in the app.
- A retired requirement has no reader: `GET /api/requirements` is active-only, so
  reopening one is possible through the API but not through the UI (`TASKS.md` → *Backlog
  → F*).
- `PATCH /recipients/me` and `PATCH /volunteers/me` assign an explicit `null` straight to
  a non-nullable column, so `{"name": null}` is a 500 rather than a 422. The requirement
  PATCH skips nulls; the two older routes were left alone as out of scope.

## Immediate priorities

1. Decide what follows the hardening sequence — *Next* is empty and nothing has been
   promoted into it. **I-1 through I-8 are done**, leaving only I-9 (**S**, one form), so
   the audit's suggested order now points at the three group-F match-score follow-ups in
   one sitting → group E. I-1a (the landing page's
   invented statistics) is the small residue I-1 left, and it is the one group-I item that
   cannot simply be implemented: it needs a decision on whether any metric may be read
   without authentication.
2. Answer at least the cheap half of the four decisions the audit opened
   (`TASKS.md` → *Blocked*). Three of them — road distance, requirement-aware matching, a
   real impact report — can be answered "not now" at zero cost, because group I removes the
   claim either way; for the impact report that is now literally true, since I-1 has already
   deleted both stub buttons. Only the donor needs board is a "yes/no build it" question,
   and it is **S** if yes.
3. Decide whether the rate-limit counter has to be shared, when deployment is
   designed — it is per-process today (`TASKS.md` → *Backlog → E*)
4. Extend the claim's concurrency guard to the remaining lifecycle transitions before
   Postgres lands, for the same reason the claim itself was fixed first

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
