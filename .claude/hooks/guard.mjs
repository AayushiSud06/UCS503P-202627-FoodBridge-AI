// PreToolUse (Edit|Write): refuse edits to files that must only change another way.
//   - an Alembic revision already committed to HEAD is shared migration history
//   - frontend/package-lock.json is written by npm, not by hand
// Exit 2 blocks the call and shows stderr to Claude. Anything unexpected exits 0,
// so a malformed payload never blocks ordinary work. Bash edits are not covered:
// this catches mistakes, it is not a security boundary.
import { execFileSync } from "node:child_process";

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

let file = "";
try {
  file = String(JSON.parse(raw).tool_input?.file_path ?? "").replace(/\\/g, "/");
} catch {
  process.exit(0);
}

if (/(^|\/)frontend\/package-lock\.json$/.test(file)) {
  console.error("frontend/package-lock.json is generated. Change dependencies with npm install in frontend/.");
  process.exit(2);
}

const migration = file.match(/^(.*)\/(code\/migrations\/versions\/[^/]+\.py)$/);
if (migration) {
  const [, root, rel] = migration;
  try {
    execFileSync("git", ["-C", root, "cat-file", "-e", `HEAD:${rel}`], { stdio: "ignore" });
  } catch {
    process.exit(0); // not in HEAD: a revision still being written may be edited
  }
  console.error(
    `${rel} is a committed Alembic revision. Add a new revision ` +
      "(alembic -c code/alembic.ini revision --autogenerate) instead of rewriting history.",
  );
  process.exit(2);
}
