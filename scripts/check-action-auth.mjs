#!/usr/bin/env node
// @ts-check
/**
 * "use server" 파일의 export 함수마다 인증 가드가 있는지 정적 검증.
 *
 * 통과 조건 (하나라도 만족):
 *   - 함수 본문에 verifyAdmin( / verifyTeacherOrAdmin( / verifyAuthenticated( 호출
 *   - 함수 바로 위 주석 블록에 `@auth-skip:` 마커
 *   - 파일이 ALLOW_FILES 에 있음 (가드 자체를 정의하는 파일, 수동 getUser 검증 파일)
 *
 * 함수 본문 = `export …` 줄부터 0열에 닫는 괄호만 있는 첫 줄(`}`, `});`, `)`) 까지.
 * prettier 포맷 전제. export type / interface / * 는 검사 대상 아님.
 *
 * 운영: `pnpm check:action-auth` (CI 포함). 위반 1건이라도 있으면 exit 1.
 */

import { readFile, readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(REPO_ROOT, "src");

const ALLOW_FILES = new Set([
  "src/app/(admin)/admin/actions/auth-helpers.ts", // 가드 정의
  "src/app/(admin)/admin/actions/run-action.ts", // 가드 래퍼 인프라
  "src/app/academy/actions.ts", // 함수마다 supabase.auth.getUser() 수동 검증 (학생·교사 본인 데이터)
  "src/app/bus/actions.ts", // 비활성 도메인 stub (return null)
]);

const USE_SERVER_RE = /^\s*["']use server["']\s*;?\s*$/;
const EXPORT_FN_RE = /^export\s+(?:default\s+)?(?:async\s+function|function|const|let)\s+(\w+)/;
const VERIFY_RE = /\bverify(?:Admin|TeacherOrAdmin|Authenticated)\s*\(/;
const SKIP_RE = /@auth-skip:/;

/** @param {string} dir */
async function walk(dir) {
  /** @type {string[]} */
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next") continue;
      out.push(...(await walk(full)));
    } else if (e.isFile() && /\.(ts|tsx)$/.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

/** @param {string[]} lines */
function isServerFile(lines) {
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("//") || line.startsWith("/*") || line.startsWith("*")) continue;
    return USE_SERVER_RE.test(line);
  }
  return false;
}

/** 함수 바로 위의 연속 주석 줄들에 @auth-skip 이 있는지. @param {string[]} lines @param {number} idx */
function hasSkipMarker(lines, idx) {
  for (let i = idx - 1; i >= 0; i--) {
    const t = lines[i].trim();
    if (t.startsWith("//") || t.startsWith("/*") || t.startsWith("*")) {
      if (SKIP_RE.test(t)) return true;
      continue;
    }
    return false;
  }
  return false;
}

/** export 줄부터 본문 끝까지. @param {string[]} lines @param {number} idx */
function functionBody(lines, idx) {
  // 0열에서 닫는 괄호만 있는 줄 (`}`, `});`, `)` …). 시그니처 연속줄 `}> {` / `): Promise<T> {` 은 제외.
  const end = lines.findIndex((l, i) => i > idx && /^[})]+\s*;?\s*$/.test(l));
  return lines.slice(idx, end === -1 ? lines.length : end + 1).join("\n");
}

async function main() {
  const files = await walk(SRC);
  /** @type {string[]} */
  const violations = [];
  let scanned = 0;

  for (const f of files) {
    const rel = relative(REPO_ROOT, f).split(sep).join("/");
    if (ALLOW_FILES.has(rel)) continue;
    const lines = (await readFile(f, "utf8")).split(/\r?\n/);
    if (!isServerFile(lines)) continue;
    scanned++;
    lines.forEach((line, idx) => {
      const m = EXPORT_FN_RE.exec(line);
      if (!m) return;
      if (VERIFY_RE.test(functionBody(lines, idx))) return;
      if (hasSkipMarker(lines, idx)) return;
      violations.push(`${rel}:${idx + 1} ${m[1]}`);
    });
  }

  if (violations.length) {
    console.error(`[check-action-auth] ❌ ${violations.length}건 — verify* 호출도 @auth-skip 도 없음:`);
    for (const v of violations) console.error(`  - ${v}`);
    console.error(
      `\n  → 본문에 verifyAdmin() / verifyTeacherOrAdmin() / verifyAuthenticated() 를 넣거나,`
    );
    console.error(`     못 넣을 사정이면 함수 위에 \`// @auth-skip: <이유>\` 를 적는다.`);
    process.exit(1);
  }
  console.log(`[check-action-auth] ✅ "use server" 파일 ${scanned}개 검사, 위반 0건`);
}

main().catch((err) => {
  console.error(`[check-action-auth] FATAL:`, err);
  process.exit(2);
});
