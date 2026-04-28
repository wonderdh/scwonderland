#!/usr/bin/env node
// SessionStart hook — ARCHITECTURE.md 를 세션 컨텍스트로 주입한다.
// CLAUDE.md 는 Claude Code 가 자동 로드하므로 여기선 다루지 않는다.
// 매 실행마다 .claude/hooks/session-start.log 에 한 줄 append 해
// 사용자가 cat 으로 동작 여부를 확인할 수 있게 한다.
import { readFileSync, existsSync, appendFileSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";

const root = process.env.CLAUDE_PROJECT_DIR
  ? resolve(process.env.CLAUDE_PROJECT_DIR)
  : resolve(".");

const archPath = join(root, "ARCHITECTURE.md");
const logPath = join(root, ".claude", "hooks", "session-start.log");

let additionalContext;
let logStatus;

if (existsSync(archPath)) {
  const body = readFileSync(archPath, "utf8");
  additionalContext = `# ARCHITECTURE.md\n\n${body}`;
  logStatus = `OK bytes=${body.length}`;
} else {
  additionalContext =
    `⚠️ ARCHITECTURE.md not found at ${archPath}\n\n` +
    `세션 컨텍스트에 프로젝트 구조 인덱스가 주입되지 않았다. ` +
    `루트에 ARCHITECTURE.md 를 생성하거나 경로를 점검하라.`;
  logStatus = `MISSING path=${archPath}`;
}

try {
  mkdirSync(dirname(logPath), { recursive: true });
  appendFileSync(logPath, `${new Date().toISOString()} ${logStatus}\n`);
} catch {
  // 로그 실패는 무시 — 훅의 핵심 책임은 stdout JSON 출력
}

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext,
  },
}));
