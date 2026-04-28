#!/usr/bin/env node
// SessionStart hook — CLAUDE.md + ARCHITECTURE.md 를 세션 컨텍스트로 주입.
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const root = process.env.CLAUDE_PROJECT_DIR
  ? resolve(process.env.CLAUDE_PROJECT_DIR)
  : resolve(".");

const sections = [];
for (const file of ["CLAUDE.md", "ARCHITECTURE.md"]) {
  const p = join(root, file);
  if (existsSync(p)) {
    sections.push(`# ${file}\n\n${readFileSync(p, "utf8")}`);
  }
}

const additionalContext = sections.join("\n\n---\n\n");

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext,
  },
}));
