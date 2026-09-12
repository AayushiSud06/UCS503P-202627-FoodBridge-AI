# TASKS — FoodLink / FoodBridge-AI

> **Verified against the repository on 2026-09-12, `master` at `3d6f8f8`, plus the
> uncommitted Task 40 (P1-5) changes.** The full health audit of that date was run against
> `640af0c`. Context: `PROJECT_STATE.md`.
>
> **Provenance rule.** *Completed* is verified present in the repository. Everything else is
> recommended or open work derived from analysis, not a commitment. Each item traces to
> evidence: a file/line, a reproduction, or a tag — `HA-n` (health audit 2026-09-05),
> `QA-n` (QA audit 2026-09-02), `R-n`/`S-n`/`B-n` (`PROJECT_KNOWLEDGE_GUIDE.md` §22/§8.4),
> `D-n` (`DECISIONS.md`). "Repro" means reproduced against the real app during the
> 2026-09-10 audit (scratch tests, not committed).
>
> **Priorities.** P0 stop everything · P1 before new feature/UI work · P2 normal ·
> P3 backlog. Sizes: S < 1 h · M a few hours · L a day+.

---

## Current

**Task 40 · P1-5 — implemented, uncommitted, awaiting review.** Donation photos are resized
to 1280 px and re-encoded as JPEG in the browser before the data URL is built (D-56). See
P1-5 below.

## P0 — urgent

**None.** No authentication bypass, escalation or ordinary-use data corruption was found.

## P1 — before new feature work

### P1-1 · Unverified self-signup accounts read donors' exact pickup locations
- **Category:** SECURITY ISSUE (privacy)
- **Why it matters:** `ngo` and `volunteer` are self-signup roles. `DonationOut` carries
  `latitude`/`longitude`, free-text `location`, `donorName`, `donorOrganization`, the photo
  and event notes — for donors who may be individuals at home. The D-26 → D-41 lesson
  ("holding a self-signup role is not permission to read people") applied to donors.
- ✅ **(a) `ngo` half — FIXED by Task 37 (`c65c65f`), D-53.**
  `_readable_by`'s `ngo` branch now returns the open pool only when the caller's
  `Recipient.is_verified` is true; an unverified organisation reads only its own donations,
  and an `ngo` account with no organisation row reads nothing. Excluded from the scope, not
  redacted: list `[]`, id lookup and `/matches` 404. Verification is read live (revocation
  closes the pool next request). Four new tests in `test_donation_reads.py` plus the
  unverified kitchen added to its list-vs-id consistency loop; one test in
  `test_match_score_consistency.py` that asserted the pool read was corrected. All five
  fail against the pre-fix router. UI copy promising unverified kitchens could "browse"
  corrected on four screens.
- ⚠️ **(b) `volunteer` half — STILL OPEN.** Any self-signup courier still reads every
  unclaimed `ACCEPTED` pickup with the exact pin and donor name (`_readable_by` volunteer
  branch, unchanged). Blocked on DQ-1 (no courier vetting exists).
- **Risk if (b) postponed:** donor addresses harvestable by one courier registration.

### P1-2 · Verification survives the organisation editing what was verified
- **Category:** SECURITY ISSUE (trust model)
- ✅ **FIXED by Task 38 (`be831b8`), D-54.** `update_my_recipient`
  clears `is_verified` in the same commit when a submitted `name`, `latitude` or
  `longitude` differs from the stored value (`organisations.VERIFIED_IDENTITY_FIELDS`).
  Values are compared, so resubmitting them is a no-op; `type`, `location` (address text),
  `capacity`, `contact_person` and `phone` never void it; an unverified organisation stays
  unverified; an administrator re-verifies through the existing endpoint. DQ-2 answered: no
  exemption for a first pin, so an admin-created (verified, unpinned) NGO must be verified
  again after pinning itself.
- **Evidence:** new `test_recipient_reverification.py` (10 tests; 7 fail against the pre-fix
  router, the other 3 are preservation guards), including the audit's repro — a moved and renamed kitchen is no longer ranked,
  loses the open pool (D-53) and cannot accept.
- **No frontend change:** the desktop form has no coordinate inputs, resends the name
  unchanged on every save, and already refreshes after saving, so the badge shows "Awaiting
  verification" once a rename voids it. Wording follow-ups in P3.

### P1-3 · Lifecycle transitions other than the claim are lost-update races — on SQLite too
- **Category:** DATA INTEGRITY ISSUE
- ✅ **FIXED by Task 39 (`3d6f8f8`), D-55.** `_record` — the one
  function every transition's status write goes through — now advances the status with
  `UPDATE donations SET status=:to WHERE id=:id AND status=:from` and raises 409 on
  `rowcount != 1`, appending no event. It runs last, immediately before the single
  `commit()`, so a refusal rolls back the acceptance side effects (the
  `accepted_donations` increment, the frozen `match_score`, the cleared courier) with it.
  No business rule moved: the transition table, the role gate, ownership, the D-50 deadline
  refusal and the verification gate all still answer first, in the same order.
- **Evidence:** new `test_lifecycle_concurrency.py` (7 tests; 4 fail against the pre-fix
  router, where the losing kitchen was answered `200`). Two real transactions on a
  file-backed database, interleaved by hand as in `test_courier_claim.py`: one owner, one
  `ACCEPTED` event, one counted acceptance, and the loser told the state it now finds.
  Cancel-against-accept is covered too, and the database-level test is parametrised over
  `ACCEPTED` and `COMPLETED` to show the guard is not acceptance-only.

### P1-4 · A donor's cancellation is booked as the kitchen's failure
- **Category:** DATA INTEGRITY ISSUE
- **Why it matters:** `accepted_donations` rises at acceptance and `completed_donations` only
  at `COMPLETED`; `CANCELLED` adjusts neither, and `reliability_score = 100 × completed /
  accepted` once accepted ≥ 3. Any donor can therefore drive a kitchen's reliability down —
  the same class as `HA-2`. A donor may also cancel after the courier has `PICKED_UP` the food.
- **Subsystem:** `update_status` side effects; `models.Recipient.reliability_score`
- **Evidence:** repro — three accept → donor-cancel cycles: reliability 85 → **0**; a donor
  cancel from `PICKED_UP` → `200`.
- **Smallest scope:** after DQ-3, exclude donor-initiated cancellations from the denominator
  (decrement on donor `CANCELLED` of a bound donation, or derive the counts from events);
  regression tests.
- **Dependencies:** DQ-3. **Risk if postponed:** ranking manipulable by any donor account.

### P1-5 · Attaching a normal phone photo makes donation creation fail
- **Category:** CONFIRMED BUG (UX, core flow)
- ✅ **FIXED by Task 40 (uncommitted, awaiting review), D-56.** `HA-7` capped `imageUrl` at
  256 KiB but neither create screen resized, so both `readAsDataURL`-ed the raw file and a
  1–5 MB phone photo was a 422. New `frontend/src/lib/image.ts` decodes the file (the decode
  *is* the validation — neither extension nor MIME is trusted), clamps the long edge to
  1280 px without upscaling, re-encodes as JPEG down a fixed quality ladder until it fits
  the cap, and refuses with a readable sentence otherwise. Both screens use it; the
  server keeps the cap and gained a shape check (`IMAGE_URL_PATTERN`).
- **Evidence:** `lib/__tests__/image.test.ts` (12 tests, the platform seam injected because
  jsdom has neither `createImageBitmap` nor `toDataURL`) plus one backend test. **Measured
  in a real browser** against the dev server: a 4032×3024 photo went from 3,460,075 data-URL
  characters (over the cap by 3.2 M — a guaranteed 422) to 1280×960 and 220,651 characters
  in 104 ms; a 320×240 image kept its size.
- ⚠️ **Still inline in the donation row.** Object storage remains unbuilt (*Backlog → F*),
  so every donation read still carries its photo.

## P2 — normal

- **P2-1 · Abuse-limit donation creation (`HA-3a`).** SECURITY ISSUE. `POST /donations` has
  no limit (repro: 40 rapid creations, all 201). Each creation is also a probe of the 8 km
  eligibility gate (the residual membership oracle D-45 named) and a spam entry in every
  kitchen's pool. Scope: a per-account + per-IP limiter reusing `ratelimit.RateLimiter`. **S–M**
- **P2-2 · Bound every free-text field at the schema.** SECURITY/DATA INTEGRITY.
  `description`, `StatusUpdate.note`, `location`, `category`, `unit`, `storage_type`,
  requirement `food_type`/`unit`/`urgency`/`notes`, `phone`, recipient `type`/`location` have
  no `max_length`; `beneficiary_count` may be negative. Repro: a 2 MB description, a 1 MB
  status note and a 200-char `unit` (column `String(24)`) are all stored — and returned
  inline in every list (`limit=500`) after every write. On Postgres the `String(n)` overflows
  become 500s. Scope: `Field(max_length=…)` mirroring the columns, as `HA-7` did. **S**
- **P2-3 · Server errors look like outages.** CONFIRMED BUG. `{"name": null}` on
  `PATCH /recipients/me` (and `/volunteers/me`) is an unhandled `IntegrityError` → bare 500
  (repro), which `api.ts` renders as "Cannot reach the FoodLink server". Scope: skip explicit
  nulls as `update_requirement` does; add one exception handler returning a sentence and a
  correlation id. `[B-7 · R-18]` **S–M**
- **P2-4 · Residual misleading copy.** UX ISSUE. `mobile/nav.ts:64,70` hard-codes the seeded
  org names "College Central Mess" / "Helping Hands Kitchen" as the header kicker, rendered
  for **every** donor/NGO by `MobileShell.tsx:31` (I-1 missed it). Also `CreateDonation.tsx`
  "Future Intelligence Feature" note (line ~403, I-11) and its *Quick-fill demo* preset
  naming "Thapar University" (lines 58-74, button line ~172); `index.html` meta and
  `frontend/README.md` still say "AI-assisted" (I-10). Scope: copy only, plus absence tests
  in the Landing-test style. **S**
- **P2-5 · `/ngo/available/:id` opens nothing.** CONFIRMED BUG. The route
  (`App.tsx:83`) renders `NGOAvailableDonations`, which never reads the param, so the
  dashboard's deep link lands on an unselected list. `[QA-8]` **S**
- **P2-6 · Test gaps that match real risk.** TEST GAP. Backend: land each P1 with its
  regression test (concurrency beyond the claim, cancellation accounting, verification on
  edit, unverified read scope); a `UtcDateTime` round-trip (D-09). Frontend: nothing covers
  `AppContext`'s load/write-then-refetch, `useAction`, the create-donation form (would have
  caught P1-5) or per-role status buttons. **M**

## P3 — backlog

**Security hardening** — shorter tokens + refresh or a `token_version` revocation column
(D-13, `R-11`); CSP/security headers (`R-21`); `pip-audit`/`npm audit` in CI (`S-8`);
`PRAGMA foreign_keys=ON` for SQLite (`R-15`); registration's 409 reveals account existence
(D-18); email verification; MFA and an admin audit log (`R-34`).

**Deployment-sequenced** (do with the deployment, not ahead of it) — Postgres driver + move
`ensure_schema_current()` out of the lifespan (D-23) → deployment config (none exists) →
shared rate-limit store / `--proxy-headers` (D-27) → schedule the expiry sweep (`R-8`);
structured logging (`R-17`); readiness probe with `SELECT 1` (`R-20`); aggregate
`/api/metrics` in SQL (`R-12`); radius bounding box before scoring (`R-10`); pagination
(`R-9`, `limit` ≤ 500); per-portal code splitting (`R-27`).

**Small correctness / dead code** — the `MATCHED` activity line reads the *current*
`matchScore`, which acceptance overwrites (`adapters.ts:217`; narrowed by D-47 to admin and
the accepting kitchen) — record the score on the event; `TRANSITION_ROLES` lists admin for
`VOLUNTEER_ASSIGNED` but an admin has no courier profile, so it is always 422, and
`MATCHED → AVAILABLE` has no role at all; admin user management (`GET/POST /admin/users`,
`PATCH /admin/users/{id}`) and `GET /donations/{id}`, `GET /recipients/me` have **no frontend
consumer** — suspension is possible only through `/docs`; courier `latitude`/`longitude` is
write-only (D-40's rule); `Volunteer.rating` and `matching.COLD_STORAGE` are dead;
`mobile/useIsMobile.ts` is never imported. `POST /donations/{id}/status` runs the
transition-table check on an **unscoped** read before any scope check, so any authenticated
caller can learn any donation id's existence and current status from the 409/403 wording
(pre-existing; status only, no location). The NGO dashboard / mobile home "Nothing
available" empty states do not mention verification (D-53 made them empty for unverified
kitchens; the Available pages already say why). D-54 follow-ups: a change to `location`
(address text) keeps verification — whether it should void it is a product question; the
NGO profile gives no warning before a rename voids verification, and its success toast
("Capacity and location now feed the match ranking") is wrong when it has; the name
comparison is exact, so a whitespace-only difference counts as a rename. D-55 follow-up:
`routers/admin.expire_overdue` writes `status = EXPIRED` row by row **without** the
conditional guard, so an acceptance that commits between its `SELECT` and its write could
be overwritten — a narrow window (it selects only donations already past their deadline,
which D-50 refuses to accept) on a manual admin action, but the one status write left
unguarded.

**Product features (optional)** — controlled food category on `Requirement` so D-52 can
compare food, not only size (`R-35`, `R-32`); donor needs board on `/m/*`; needs board
narrowed by distance (needs a donor location); weight tuning on outcome data (`R-31`);
object-storage image upload (`R-19`); notifications (`R-28`); SSE feed (`R-29`); road
distance (`R-30`, see DQ); OpenAPI-generated client (`R-25`); React Query (`R-26`); recurring
donations (`R-35`); PostGIS (§16.3).

**Cleanup** — dead `npm run lint` (eslint not installed); C++ template residue in `code/`
(`Makefile`, `src/`, `inc/`, `run_main.o`); `pyproject.toml` template name and
`requires-python >=3.8`; duplicate `foodlink.db` (cwd-relative URL); unanchored
`build/`/`dist/`/`var/` in `.gitignore`; `conftest.py` sets no `DATABASE_URL`, so every
`TestClient(app)` lifespan runs migrations against `./foodlink.db` in the current directory
(a no-op at head today; not written during this audit's run).

## Decisions needed (blocked on product input, not effort)

- **DQ-1 · Who may see a donor's exact pickup location, and when?** Couriers have no vetting
  concept; options include a coarse pin until a courier claims, or courier verification.
  Blocks P1-1(b).
- ~~**DQ-2 · Which recipient edits void verification?**~~ ✅ **Answered (Task 38, D-54):**
  name, latitude, longitude; no first-pin exemption. Address text was left out — see P3.
- **DQ-3 · What counts against reliability, and may a donor cancel after pickup?** Blocks P1-4.
- **Older, still open:** road vs straight-line distance (`QA-1`, `R-30`); a real exportable
  impact report (`QA-4`); should an `ACCEPTED` donation past its deadline expire (the sweep
  covers `AVAILABLE`/`MATCHED` only); what revoking verification does to donations already
  accepted (nothing today); should `/api/metrics` stay platform-wide for every role; is
  `/m/*` meant to be link-only (D-20); should a courier get credit when a kitchen never
  confirms `DELIVERED → COMPLETED`; should `is_available` gate claiming (it gates nothing);
  should the requirement-screen wording be re-widened now that D-52 exists (it claims less
  than the system does); should sign-in keep the role chips (D-49).

## Status of earlier findings (re-verified 2026-09-10)

| Finding | Status | Evidence |
|---|---|---|
| `HA-1` courier roster readable by any ngo | FIXED | `_visible_volunteers`; `test_volunteer_reads.py` |
| `HA-2` release did not release | FIXED | `update_status` clears `volunteer_id`; `test_pickup_release.py` |
| `HA-3` `/matches` coordinate oracle | FIXED (blur, D-45) | `score_pair(blur_location)` |
| `HA-3a` 8 km gate membership oracle | STILL PRESENT | P2-1 |
| `HA-3b` `matchScore`/`distanceKm` on `DonationOut` | FIXED (D-47) | `serialize._may_measure` |
| `HA-4`/`HA-5` collinear, unit-blind size criteria | FIXED (D-42) | `matching.py`; `test_matching_scores.py` |
| `HA-6` invented landing figures | FIXED | `Landing.test.tsx` |
| `HA-7` unbounded `image_url` | FIXED, with consequence | cap works; no client resize → P1-5 |
| `HA-8` no frontend tests / not in CI | FIXED | 121 tests; `ci.yml` runs `npm test` since `d611424` |
| Lifecycle write ownership (D-34/D-35) | FIXED | `_needs_ownership`; `test_lifecycle_authorization.py` |
| Courier claim race | FIXED | `_claim_pickup` |
| Other transitions' races | STILL PRESENT, **worse than documented** | P1-3 |
| QA I-1…I-9 interface claims | FIXED | D-32…D-40 |
| I-10 `index.html` "AI-assisted", I-11 donor "Future Intelligence" note | STILL PRESENT | P2-4 |
| Hard-coded seeded identities (I-1) | PARTIALLY FIXED | desktop fixed; mobile kicker → P2-4 |
| Explicit-null PATCH → 500 | STILL PRESENT | P2-3 |
| `/ngo/available/:id` deep link | STILL PRESENT | P2-5 |
| `MATCHED` activity line uses current score | STILL PRESENT, narrowed | P3 |
| Retired requirement had no reader (`F-1`) | FIXED (D-46) | `includeInactive` |
| Requirements do not affect matching (`QA-2`) | SUPERSEDED by D-52 | tie-break + reason; score untouched |

**Task 36, verified in code and by repro:** editing a requirement changes the kitchen's own
`viewerMatch.reasons` line and its tie-break standing **on the next read** (both are computed
per request); `overallScore`, the frozen `Donation.match_score` and the `MATCHED` event note
do not change; retiring it removes the line. A donor's `/matches` sees verified kitchens'
requirement lines; a courier and a rival kitchen see none (`_requirement_disclosure_scope`).
Multiple needs resolve by a total order; mixed units abstain; nothing converts.

## Completed (verified in the repository)

Detail lives in `DECISIONS.md` and in each commit.

| Commit(s) | Work |
|---|---|
| uncommitted | Task 40 · P1-5: donation photos resized and re-encoded in the browser (D-56) |
| `3d6f8f8` | Task 39 · P1-3: every lifecycle status write is a conditional UPDATE (D-55) |
| `be831b8` | Task 38 · P1-2: a real name/coordinate change voids verification (D-54) |
| `c65c65f` | Task 37 · P1-1a: the open pool requires a verified organisation (D-53) |
| `640af0c` | Task 36 · requirement-aware tie-break and reasons (D-52) |
| `ca8bef6`, `df74466`, `cb65f38`, `db000d9` | Tasks 35–33 · the three post-login roadmap surfaces removed (D-48) |
| `a58a914` | Task 32 · courier history ends at `DELIVERED` (D-51) |
| `2ce3d71` | Task 31 · availability is a deadline as well as a status (D-50) |
| `f863a94`, `6961555` | Tasks 30, 29 · login and landing pages carry no credential, course IDs or roadmap (D-49, D-48) |
| `d611424` | Task 28 · `DonationOut` location-derived fields reader-scoped (D-47); `npm test` in CI |
| `8cbb736`, `883bcee`, `e72d4c2` | Tasks 27–25 · retired needs reopenable (D-46); `/matches` blur (D-45); donor needs board (D-44) |
| `9b11353`, `f33aeae`, `a9f190b`, `e7032ea` | Tasks 24–21 · health-audit fixes `HA-1`, `HA-2`, `HA-4`…`HA-8` (D-41…D-43) |
| `e8a8178` → `c274e99` | Interface-honesty pass I-1…I-9 (D-32…D-40) |
| `551c96d`, `efd5fd8` | Lifecycle write authorization (D-34, D-35) |
| `23c27f4`, `1181adb`, `e919f7b`, `91544e3`, `16497ea`, `e47bd86`/`8386371`, `ea0f499`, `3e1e168` | Frozen vs live score (D-30), requirement lifecycle (D-29), atomic claim (D-28), auth rate limit (D-27), recipient read scope (D-26), CI (D-25), donation read scope (D-24), Alembic + fail-closed key (D-22, D-23) |
| `e48c9e7`, `01a9861`, `eaeb51d` | Backend built; mock data removed; warm editorial redesign (D-10) |
