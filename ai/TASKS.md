# TASKS — FoodLink / FoodBridge-AI

> **Verified against the repository on 2026-09-10, `master` at `640af0c`, clean working
> tree**, by the full health audit of that date. Context: `PROJECT_STATE.md`.
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

Nothing in progress. The 2026-09-10 audit changed documentation only.

## P0 — urgent

**None.** No authentication bypass, escalation or ordinary-use data corruption was found.

## P1 — before new feature work

### P1-1 · Unverified self-signup accounts read donors' exact pickup locations
- **Category:** SECURITY ISSUE (privacy)
- **Why it matters:** `ngo` and `volunteer` are self-signup roles, and `is_verified` gates
  ranking and acceptance, not reads. `_readable_by` gives **any** `ngo` account the whole
  `AVAILABLE`/`MATCHED` pool and **any** `volunteer` every unclaimed `ACCEPTED` pickup, each
  carrying `latitude`/`longitude`, free-text `location`, `donorName`, `donorOrganization`,
  the photo, and event notes (including `"Top match: <rival kitchen>"`). It is the D-26 →
  D-41 lesson ("holding a self-signup role is not permission to read people") applied to
  donors, who may be individuals at home.
- **Subsystem:** `routers/donations._readable_by` (`donations.py:186-200`), `serialize.donation_out`
- **Evidence:** repro — an unverified kitchen registered seconds earlier and a fresh courier
  both read the donor's exact pin and name. Registration costs one email (10/hour/IP).
- **Smallest scope:** (a) require `Recipient.is_verified` in the `ngo` open-pool half of
  `_readable_by` — an unverified kitchen cannot accept anyway, and `NGOAvailableDonations`
  already has an awaiting-verification state; tests in `test_donation_reads.py`.
  (b) the courier half needs *Decisions needed* DQ-1 (no courier vetting exists).
- **Dependencies:** DQ-1 for (b) only. **Risk if postponed:** donor addresses harvestable by
  strangers.

### P1-2 · Verification survives the organisation editing what was verified
- **Category:** SECURITY ISSUE (trust model)
- **Why it matters:** D-37 defines `is_verified` as "an administrator vouched this
  organisation is real and is where it claims to be". `PATCH /recipients/me` lets the
  organisation change `name`, `type`, `location`, `latitude`, `longitude`, `contact_person`
  and `phone` without touching the flag, so a vetted account can relocate or rename and
  keep ranking and accepting.
- **Subsystem:** `routers/organisations.update_my_recipient`
- **Evidence:** repro — a verified kitchen moved its pin ~250 km and renamed itself; still
  verified, ranked first for a donation at the new location.
- **Smallest scope:** clear `is_verified` when an identity/location field changes; tests;
  a warning line on `NGOProfile`. ⚠️ `POST /admin/users` creates a **verified** NGO with no
  coordinates, which must then pin itself — DQ-2 decides whether a first pin from `null` is
  exempt.
- **Dependencies:** DQ-2. **Risk if postponed:** the only trust control is one-shot.

### P1-3 · Lifecycle transitions other than the claim are lost-update races — on SQLite too
- **Category:** DATA INTEGRITY ISSUE
- **Why it matters:** `update_status` reads the row, checks `ALLOWED_TRANSITIONS` in Python
  and writes unconditionally. Only `_claim_pickup` carries its condition in the `UPDATE`
  (D-28). ⚠️ D-28 and `ARCHITECTURE.md` said SQLite serialises the rest "so this is inert" —
  **wrong**: pysqlite holds no lock across a plain `SELECT`, which is exactly why the
  pre-D-28 claim race reproduced on SQLite.
- **Subsystem:** `routers/donations.update_status` / `_record`
- **Evidence:** repro on a file-backed DB built by the real migrations: kitchen B's
  acceptance commits between kitchen A's read and write (same interleaving technique as
  `test_courier_claim.py`) → A gets `200` and the donation, B's `accepted_donations` stays
  incremented, two `ACCEPTED` events are recorded. Cancel-vs-accept and similar pairs share
  the shape.
- **Smallest scope:** make the status write conditional — `UPDATE … WHERE id=:id AND
  status=:from`, `rowcount != 1` → 409 — before any side effect, reusing the
  `_claim_pickup` pattern; file-backed tests for `ACCEPTED` and one owned transition.
- **Dependencies:** none. **Risk if postponed:** corrupted reliability counters (15% of the
  score), duplicate ledger events, a kitchen told it owns food it does not.

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
- **Why it matters:** `HA-7` capped `imageUrl` at 256 KiB (~190 KB image) but neither
  `pages/donor/CreateDonation.tsx:76-82` nor `mobile/CreateDonationCamera.tsx:65` resizes —
  both `readAsDataURL` the raw file. A 1–5 MB phone photo makes `POST /donations` a 422 with
  a Pydantic length message, and the donation is not created. The camera-first mobile flow
  fails on its own premise.
- **Evidence:** code (`schemas.MAX_IMAGE_URL_LENGTH`, both readers). NOT VERIFIED in a
  browser — the flow needs a signed-in donor.
- **Smallest scope:** one shared `lib/` helper that downsizes via canvas (≈1024 px JPEG) and
  refuses with a plain message if still over the cap; used by both screens; unit test on
  the guard.
- **Dependencies:** none. **Risk if postponed:** donors who add photos cannot post.

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
`mobile/useIsMobile.ts` is never imported.

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
- **DQ-2 · Which recipient edits void verification?** Name/address/coordinates at least;
  whether an admin-created org's first pin is exempt. Blocks P1-2.
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
