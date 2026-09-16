#!/usr/bin/env bash
# PostToolUse (Edit|Write): after a change to code/foodlink/models.py, run the
# check CI runs — `alembic upgrade head` then `alembic check` on a throwaway
# SQLite file — so a model change without a revision is caught at the edit.
# Exit 2 shows stderr to Claude; every other outcome is silent.
input=$(cat)
case "$input" in *models.py*) ;; *) exit 0 ;; esac

root=$(printf '%s' "$input" | node -e '
  let s = "";
  process.stdin.on("data", (d) => (s += d)).on("end", () => {
    let f = "";
    try { f = String(JSON.parse(s).tool_input?.file_path ?? "").replace(/\\/g, "/"); } catch {}
    const m = f.match(/^(.*)\/code\/foodlink\/models\.py$/);
    if (m) console.log(m[1]);
  });')
[ -n "$root" ] && cd "$root" || exit 0

if   [ -x .venv/Scripts/python.exe ]; then py=.venv/Scripts/python.exe
elif [ -x .venv/bin/python ];         then py=.venv/bin/python
else exit 0  # no venv to check with; CI still runs the check
fi

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
db="$tmp/check.db"
command -v cygpath >/dev/null && db=$(cygpath -m "$db")  # native Windows Python needs X:/ paths

# A placeholder that signs nothing. `foodlink.config` refuses to load without a
# key, and refuses one shorter than 32 characters.
export FOODLINK_SECRET_KEY=hook-placeholder-key-not-a-secret-signs-nothing
export DATABASE_URL="sqlite:///$db"

if ! out=$("$py" -m alembic -c code/alembic.ini upgrade head 2>&1 &&
           "$py" -m alembic -c code/alembic.ini check 2>&1); then
  {
    echo "Alembic check failed after editing code/foodlink/models.py; CI will fail the same way."
    echo "If the models changed on purpose, add a revision (alembic revision --autogenerate, with"
    echo "FOODLINK_SECRET_KEY and a DATABASE_URL at head, as in .github/workflows/ci.yml)."
    printf '%s\n' "$out" | grep -v '^INFO ' | tail -6
  } >&2
  exit 2
fi
