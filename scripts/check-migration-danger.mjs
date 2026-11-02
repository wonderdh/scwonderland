#!/usr/bin/env node
// @ts-check
/**
 * 새로 추가된 마이그레이션 중 위험 구문(정책·트리거·테이블·컬럼 삭제, anon 권한 부여,
 * 전체 공개 정책) 이 들어간 파일은 `-- reviewed-by: <누가> <날짜>` 한 줄이 있어야 통과.
 *
 * 배경: 2026-06 `remote_schema.sql`(db pull 덤프) 가 검토 없이 머지되어 보안 패치 6개가
 * 되돌아갔고 4개월간 발견되지 않았다. 사람이 읽었다는 흔적을 강제하는 게 목적.
 *
 * 대상 = `MIGRATION_BASE`(기본 origin/main) 이후 추가(A)된 파일 + 아직 커밋 안 된 새 파일.
 * 운영: `pnpm check:migration-danger` (CI 포함). 위반 1건이라도 있으면 exit 1.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const BASE = process.env.MIGRATION_BASE || "origin/main";
const DIR = "supabase/migrations";

const DANGER_RE =
  /\b(drop\s+policy|drop\s+trigger|drop\s+table|drop\s+column|to\s+anon\b|using\s*\(\s*true\s*\)|with\s+check\s*\(\s*true\s*\)|disable\s+row\s+level\s+security)/i;
const REVIEWED_RE = /^\s*--\s*reviewed-by:\s*\S+/m;

/** @param {string[]} args */
function git(args) {
  return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean);
}

function newMigrations() {
  const added = git(["diff", "--name-only", "--diff-filter=A", `${BASE}..HEAD`, "--", DIR]);
  const untracked = git(["ls-files", "--others", "--exclude-standard", "--", DIR]);
  return [...new Set([...added, ...untracked])].filter((f) => f.endsWith(".sql"));
}

function main() {
  const files = newMigrations();
  /** @type {string[]} */
  const violations = [];
  for (const f of files) {
    const sql = readFileSync(`${REPO_ROOT}/${f}`, "utf8");
    const hit = DANGER_RE.exec(sql);
    if (hit && !REVIEWED_RE.test(sql)) violations.push(`${f}  (${hit[1].replace(/\s+/g, " ")})`);
  }
  if (violations.length) {
    console.error(`[check-migration-danger] ❌ ${violations.length}건 — 위험 구문 있는데 리뷰 표시 없음:`);
    for (const v of violations) console.error(`  - ${v}`);
    console.error(`\n  → 파일을 사람이 끝까지 읽고 맨 위에 \`-- reviewed-by: <이름> <YYYY-MM-DD>\` 를 적는다.`);
    console.error(`     db pull 덤프(remote_schema) 는 특히 기존 정책을 되돌리는지 확인.`);
    process.exit(1);
  }
  console.log(`[check-migration-danger] ✅ ${BASE} 이후 새 마이그레이션 ${files.length}개 검사, 위반 0건`);
}

try {
  main();
} catch (err) {
  console.error(`[check-migration-danger] FATAL:`, err instanceof Error ? err.message : err);
  process.exit(2);
}
