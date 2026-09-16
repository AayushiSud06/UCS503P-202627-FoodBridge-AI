---
name: prove-fix
description: Prove that new regression tests actually guard a FoodLink fix — run them with the fix set aside (they should fail) and with it in place (they must pass), then report "N of M fail against the pre-fix code". Use after writing tests for a bug fix.
argument-hint: "[new test files]"
disable-model-invocation: true
---

# Prove a fix

`ai/TASKS.md` records, for each fix, how many of its new tests fail against the pre-fix
code. A test that passes both with and without the fix proves nothing about the bug: it
either never reaches the broken path or it is a preservation guard. This skill measures
which is which.

## Rules

- Set aside **only the fix's source files**, by explicit path. Never stash test files
  (`code/tests/**`, `frontend/src/**/__tests__/**`, `conftest.py`, `src/test/fixtures.ts`),
  unrelated files, or the whole tree.
- Never use `git checkout --`, `git restore` or `git reset` to remove the fix. A stash is
  the only way here, because it keeps the fix recoverable.
- Always restore, including when the test run errors or is interrupted.

## Steps

1. **Classify the diff.** `git status --short`. Split the changed paths into fix source
   files and test files. If a file mixes both, stop and ask.
2. **Snapshot.** Save `git status --short` output and `git stash list` to compare later.
3. **Set the fix aside.**
   `git stash push -u -m "prove-fix: <task>" -- <source paths...>`
   (`-u` also sets aside source files the fix newly created). Check that `git stash list`
   shows it at `stash@{0}`, and that `git status` still shows the test files.
4. **Run only the new tests, without the fix.**
   - Backend: `.venv/Scripts/python.exe -m pytest <test files> -q --tb=line`
   - Frontend, in `frontend/`: `npx vitest run <test files>`

   Record which tests failed and why. An assertion failure is evidence. An import or
   collection error only shows that the new code is missing: say so, and do not count it
   as a behavioural failure.
5. **Restore.** `git stash pop`. The status must equal the snapshot from step 2 exactly,
   and the stash list must be back to what it was. If the pop conflicts, stop and tell the
   user. Do not resolve it by discarding either side.
6. **Run the same tests with the fix.** All must pass.
7. **Report** in the TASKS.md evidence style:
   "N of M new tests fail against the pre-fix code; the other M−N are preservation guards"
   — then list the guards and say what each one holds in place.
