---
name: finish-task
description: Close out a FoodLink implementation task the way CLAUDE.md §10–18 requires — review the diff, run the validation the change actually needs, update only the ai/ docs it affects, and write the completion report. Use when implementation is done, before reporting back.
---

# Finish a FoodLink task

`CLAUDE.md` is the authority. This is the order of operations plus the details that are easy
to get wrong in this repository.

## 1. Review the diff

`git status --short`, then `git diff`. Everything in it must belong to the task (§11).
Anything unrelated you noticed goes under FOLLOW-UP, not into the diff.

If the diff touches `code/foodlink/routers/`, `serialize.py`, `schemas.py` or `security.py`,
run the `authz-reviewer` agent on it before going further.

## 2. Validate what changed

Run what the diff needs, for real, and keep each command and its result for the report.
Paths are for this Windows checkout (`.venv/bin/python` elsewhere); CI runs the same
checks on Linux.

| Changed | Run |
|---|---|
| `code/foodlink/**` | While iterating, the matching test files: `.venv/Scripts/python.exe -m pytest code/tests/test_<area>.py -q` (`ai/ARCHITECTURE.md` → Testing maps files to areas). Before reporting, the full `pytest code/tests -q` once — about 7 minutes, so run it in the background. |
| `code/foodlink/models.py`, `code/migrations/**` | The Alembic check below. The PostToolUse hook already runs it after each `models.py` edit; run it by hand after adding a revision. |
| `frontend/**` | In `frontend/`: `npm test`, then `npm run build` (`tsc && vite build`, so this is the type check). |
| `ai/`, `docs/`, copy in Markdown only | Nothing to run. Say so. |

Alembic check, as CI runs it. The key is a placeholder that signs nothing, but
`foodlink.config` refuses to load without one of at least 32 characters:

```bash
d=$(mktemp -d); command -v cygpath >/dev/null && d=$(cygpath -m "$d")
export FOODLINK_SECRET_KEY=placeholder-key-not-a-secret-signs-nothing DATABASE_URL="sqlite:///$d/check.db"
.venv/Scripts/python.exe -m alembic -c code/alembic.ini upgrade head && .venv/Scripts/python.exe -m alembic -c code/alembic.ini check
```

Do not run `npm run lint`: eslint is not installed (a known, tracked gap). A failure you
did not fix is reported as a failure.

## 3. Update the ai/ docs the change affects — and only those (§15)

| Change | Files |
|---|---|
| Styling, typo, small fix with no project-level effect | None — the report says "No AI documentation changes were necessary." |
| A feature, or a fix that changes what the project can claim | `PROJECT_STATE.md`, `TASKS.md` |
| Structure, data flow, auth, API shape, schema, CI | also `ARCHITECTURE.md` |
| A real technical decision | `DECISIONS.md` |

- **New decision.** The id is the last heading plus one:
  `grep -n "^## D-" ai/DECISIONS.md | tail -1`. The title states the rule as a sentence;
  tag it `**[documented]**`. Record decision, reason, constraints and rejected alternatives
  there once; the other files cite the D-id instead of repeating the rationale.
- **Provenance (§15A).** Uncommitted work is labelled "uncommitted". Never write a hash that
  does not contain the change yet. Where a file's header says what it was verified against,
  state HEAD's real hash plus the uncommitted task. Do not plan a docs-only update for when
  the human commits.
- **Numbers come from runs.** Test counts from an actual run, or
  `.venv/Scripts/python.exe -m pytest code/tests --collect-only -q` (about 2 s).
- **Keep them short.** Present state, not a diary. Distinguish implemented, partial,
  planned and blocked (§16).

The `docs-verifier` agent can check the updated docs against the repository.

## 4. Completion report (§18)

Exactly these sections: **IMPLEMENTATION**, **FILES CHANGED**, **AI DOCUMENTATION**,
**VALIDATION**, **FOLLOW-UP**. VALIDATION lists each command actually run with its result,
and names every relevant check that was not run and why. FOLLOW-UP holds only genuine
remaining issues.
