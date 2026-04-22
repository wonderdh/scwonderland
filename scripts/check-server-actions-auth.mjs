#!/usr/bin/env node
// Server Action auth check — mutation 호출하는 export async function에서
// verifyAdmin/verifyTeacherOrAdmin/verifyAuthenticated 중 하나를 호출하지 않으면 실패.
//
// 2026-04-22 리뷰의 C1/C3(공지·homework) 류 재발 방지용.
//
// 스킵 방법: 함수 본문에 `// @auth-skip: <이유>` 주석 추가.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = [
  "src/app/(admin)/admin/actions",
  "src/app/(academy)/academy",
];

const MUTATION_PATTERNS = [
  /\.insert\(/,
  /\.update\(/,
  /\.upsert\(/,
  /\.delete\(\)/,
  /\.auth\.admin\.createUser\(/,
  /\.auth\.admin\.deleteUser\(/,
  /\.auth\.admin\.updateUserById\(/,
  /\.auth\.signUp\(/,
  /storage\s*\.from\([^)]+\)\s*\.upload\(/,
  /storage\s*\.from\([^)]+\)\s*\.remove\(/,
];

const AUTH_CALLS = [
  /verifyAdmin\s*\(/,
  /verifyTeacherOrAdmin\s*\(/,
  /verifyAuthenticated\s*\(/,
];

const SKIP_MARKER = /@auth-skip/;

function walkTs(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); }
  catch { return out; }
  for (const name of entries) {
    const full = join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) walkTs(full, out);
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

function extractFunctions(source) {
  // 각 함수의 "영역" = [함수 바로 위 연속 주석/공백 블록] + [함수 body] + ... + [다음 함수 직전까지].
  // 이렇게 해야 JSDoc·@auth-skip 주석을 그 함수 소유로 인식.
  const lines = source.split("\n");
  const starts = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^export\s+async\s+function\s+(\w+)/.exec(lines[i]);
    if (m) starts.push({ name: m[1], idx: i });
  }

  const commentStarts = starts.map(({ idx }) => {
    let c = idx;
    for (let k = 1; k <= 15 && idx - k >= 0; k++) {
      const ln = lines[idx - k].trim();
      if (
        ln === "" ||
        ln.startsWith("//") ||
        ln.startsWith("*") ||
        ln.startsWith("/*") ||
        ln.endsWith("*/")
      ) {
        c = idx - k;
      } else break;
    }
    return c;
  });

  const fns = [];
  for (let f = 0; f < starts.length; f++) {
    const { name, idx } = starts[f];
    const start = commentStarts[f];
    const end = f + 1 < starts.length ? commentStarts[f + 1] - 1 : lines.length - 1;
    fns.push({
      name,
      startLine: idx + 1,
      text: lines.slice(start, end + 1).join("\n"),
    });
  }
  return fns;
}

function checkFile(filePath) {
  const source = readFileSync(filePath, "utf8");
  if (!/"use server"/.test(source)) return [];
  const fns = extractFunctions(source);
  const issues = [];
  for (const fn of fns) {
    if (SKIP_MARKER.test(fn.text)) continue;
    const hasMutation = MUTATION_PATTERNS.some((p) => p.test(fn.text));
    if (!hasMutation) continue;
    const hasAuth = AUTH_CALLS.some((p) => p.test(fn.text));
    if (!hasAuth) issues.push({ file: filePath, line: fn.startLine, name: fn.name });
  }
  return issues;
}

function main() {
  const files = ROOTS.flatMap((r) => walkTs(r));
  const issues = files.flatMap(checkFile);

  if (issues.length === 0) {
    console.log("[check:auth] OK — mutation action 전부 verify* 호출 확인됨");
    process.exit(0);
  }

  console.error("\n[check:auth] Server Action 권한 검증 누락\n");
  for (const i of issues) {
    console.error(`  ${i.file}:${i.line}  ${i.name}()`);
  }
  console.error(
    "\n해결:\n" +
      "  · verifyAdmin() / verifyTeacherOrAdmin() / verifyAuthenticated() 중 하나 호출\n" +
      "  · 또는 의도적으로 스킵할 경우 함수 본문에 `// @auth-skip: <이유>` 주석 추가\n" +
      `\n총 ${issues.length}건.\n`
  );
  process.exit(1);
}

main();
