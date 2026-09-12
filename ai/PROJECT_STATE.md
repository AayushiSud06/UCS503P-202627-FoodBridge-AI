# PROJECT_STATE — FoodLink / FoodBridge-AI

> Compressed project memory. Companions: `ARCHITECTURE.md` (how it is built), `TASKS.md`
> (what is left, prioritised), `DECISIONS.md` (why it is built that way).
> **Last verified: 2026-09-12, `master` at `be831b8` plus the uncommitted Task 39
> (P1-3) changes.** The full health audit of that date ran against `640af0c`. This file
> describes the present; how the project got here is in git history and `DECISIONS.md`.

## What this project is

A coordination platform for redistributing surplus food. A donor posts surplus with a
pickup pin and an absolute deadline; the server ranks nearby **admin-verified** recipient
organisations with an explainable weighted score; a recipient accepts; a volunteer courier
claims, collects and delivers; the recipient confirms receipt. Every transition is stamped
server-side into an append-only ledger (`status_events`), which is what makes the
platform's metrics evidence rather than self-report.

Course project (UCS503P 2026-27 ODD). Four roles: `donor`, `ngo`, `volunteer`, `admin`.
`donor`, `ngo` and `volunteer` are **self-signup**; `admin` only via CLI or another admin.

⚠️ **The name says "AI" but the matcher is a transparent weighted-sum heuristic, not a
learned model** (D-05). Never describe it as ML. The rename away from "FoodLink AI" is
separate, undecided work.

## Health verdict (audit 2026-09-10)

- **No P0.** No authentication bypass, no role escalation, no data corruption in ordinary
  sequential use; every core lifecycle path works end to end (331 backend tests, and seven
  audit reproductions run against the real app).
- **Five P1s**, all confirmed by reproduction or direct code reading — see `TASKS.md` → P1:
  1. Self-registered, **unverified** accounts read every open donation's exact donor pin,
     address text and donor name. ✅ The `ngo` half is fixed by Task 37 (`c65c65f`,
     D-53): the open pool now requires a verified organisation. ⚠️ The `volunteer` half
     (unclaimed pickups) is open, pending DQ-1.
  2. ✅ `Recipient.is_verified` used to survive the organisation editing its own name and
     coordinates. Fixed by Task 38 (`be831b8`, D-54): a real change clears it until an
     administrator verifies again.
  3. ✅ Every lifecycle transition except the courier claim used to be read-then-write, and
     raced on SQLite too — two kitchens accepting together both got `200`. Fixed by Task 39
     (uncommitted, D-55): every status write is now a conditional UPDATE, so the loser gets
     a 409 and its side effects roll back.
  4. A **donor's cancellation counts against the kitchen's reliability** — three
     accept→cancel cycles take a kitchen from the 85 prior to 0.
  5. **Phone photos break donation creation**: the 256 KiB `image_url` cap has no
     client-side resize, so a typical photo is a 422.
- **Safe to continue development**, but the P1s should precede new feature/UI work; none
  of them needs a schema change except possibly P1-4.

## Current status

| Area | State |
|---|---|
| Backend API | ✅ 5 routers, 6 tables, full 9-state lifecycle, role/ownership/lifecycle/trust gates. ⚠️ P1-1b, P1-3, P1-4 above |
| Matching | ✅ 5-criterion weighted sum (D-05, D-42); requirements break ties and add a reason, never move a score (D-52); non-owners get blurred distances (D-45, D-47). ⚠️ `HA-3a` membership oracle still open (P2-1) |
| Frontend web | ✅ 4 role portals on the live API; interface-honesty pass complete (D-31…D-40, D-48). ⚠️ residual copy: mobile header hard-codes seeded org names, donor create page still has a "Future Intelligence" note (P2-4) |
| Frontend mobile | ✅ `/m/*` screens exist; ⚠️ reachable only by typing the URL (`useIsMobile` unused, D-20) |
| Auth | ✅ JWT HS256 (12 h, `localStorage`), user row re-read every request, fail-closed signing key, login/register rate-limited per IP (process-local). No revocation, no CSP. An `ngo` reads the open pool only when verified (D-53); a real name/coordinate edit clears verification (D-54) |
| Concurrency | ✅ every lifecycle status write is a conditional UPDATE — the courier claim (D-28) and, since Task 39, every other transition (D-55, uncommitted). ⚠️ the expiry sweep writes `EXPIRED` unguarded (P3) |
| Backend tests | ✅ **352 passed** (~4 min, bcrypt-bound), 22 files |
| Frontend tests | ✅ **122 passed** over 15 files (~3 s); `tsc --noEmit` and `vite build` clean. ⚠️ `npm run lint` is dead (no eslint installed) |
| CI | ✅ backend `pytest` + `alembic upgrade head && alembic check`; frontend `npm test` + `npm run build` |
| Migrations | ✅ Alembic, one revision `ae4636b1e6d4`; `alembic check` clean; applied in the app lifespan |
| Deployment | ❌ none of any kind |

⚠️ **Local development needs one env var**: `FOODLINK_SECRET_KEY` or
`FOODLINK_DEV_INSECURE_SECRET=1`, for the backend, the CLI **and** `alembic`.
`Start_FoodLink.bat` sets the dev flag. Tests set their own key in `conftest.py`.

## Recently completed (newest first)

| Commit | Work | Decision |
|---|---|---|
| uncommitted | Task 39 — P1-3: every lifecycle status write is a conditional UPDATE | D-55 |
| `be831b8` | Task 38 — P1-2: a real name/coordinate change voids an organisation's verification | D-54 |
| `c65c65f` | Task 37 — P1-1a: unverified NGOs excluded from the open donation pool | D-53 |
| `640af0c` | Task 36 — requirement-aware ranking: tie-break + reason line, score untouched | D-52 |
| `ca8bef6`, `df74466` | Task 35 — admin Analytics "Future Intelligence" section and component removed | D-48 |
| `cb65f38` | Task 34 — admin dashboard "Intelligence Roadmap" removed | D-48 |
| `db000d9` | Task 33 — "ML Architecture Roadmap" note removed from the recipient match panel | D-48 |
| `a58a914` | Task 32 — courier history shows `DELIVERED` as well as `COMPLETED` | D-51 |
| `2ce3d71` | Task 31 — overdue donations leave the recipient offer pool; overdue accept is 409 | D-50 |
| `f863a94` | Task 30 — login page redesign, no demo credentials | D-49 |
| `6961555` | Task 29 — landing page is a product page (no course IDs, roadmap, dead links) | D-48 |
| `ed5d069`, `d5a6b68` | UML diagrams and use-case scenarios under `docs/uml/` (docs only) | — |
| `d611424` | Task 28 — `DonationOut.matchScore`/`distanceKm` reader-scoped; `npm test` added to CI | D-47 |
| `8cbb736` | Task 27 — retired requirements readable by their owner and reopenable | D-46 |
| `883bcee` | Task 26 — `/matches` distances blurred for non-owners | D-45 |
| `e72d4c2` | Task 25 — donor needs board; `GET /requirements` role-scoped | D-44 |
| `9b11353`, `f33aeae`, `a9f190b`, `e7032ea` | Tasks 24–21 — landing figures removed, frontend test harness, matcher size criteria, courier roster scope + release fix + image cap | D-41…D-43 |

Earlier milestones: the interface-honesty pass I-1…I-9 (`e8a8178` → `c274e99`, D-32…D-40),
lifecycle write authorization (`551c96d`, `efd5fd8`, D-34/D-35), and the hardening sequence
— signing key and Alembic (`3e1e168`), donation read scope (`ea0f499`), CI (`e47bd86`),
recipient read scope (`16497ea`), auth rate limiting (`91544e3`), atomic courier claim
(`e919f7b`), requirement lifecycle (`1181adb`), frozen-vs-live match score (`23c27f4`).

## Audits on record

- QA audit, 2026-09-02, against `23c27f4` — interface claims the system could not honour
  (`QA-n`); all resolved except I-10/I-11 residue.
- Health audit, 2026-09-05, against `c274e99` — `HA-1`…`HA-8`; all fixed except `HA-3a`.
- **Health audit, 2026-09-10, against `640af0c`** — this snapshot; findings are the P-ids in
  `TASKS.md`, with a status table for every earlier finding.

## Immediate next step

Review Task 39 (P1-3). Then P1-5 (image resize), which needs no product input; P1-1b and
P1-4 each need one decision (DQ-1, DQ-3) recorded in `TASKS.md` → *Decisions needed* first.

## Conventions worth preserving

- Wire format is camelCase, Python snake_case (`alias_generator=to_camel`); grepping
  `food_name` misses `foodName`.
- Error `detail` strings are sentences for humans; the frontend shows them verbatim.
- Authorization scopes are WHERE clauses returned by `_readable_by`-shaped helpers, and
  denial on a read is a 404 (donations) or an empty list (directories), never a 403 that
  confirms existence.
- Test names are sentences describing a property. Code comments explain *why*.
- Nothing in the UI may claim a capability the system lacks (D-31); no invented figures.
- **Keep these four files short.** Record the present state, not a diary; put rationale in
  `DECISIONS.md` once.
