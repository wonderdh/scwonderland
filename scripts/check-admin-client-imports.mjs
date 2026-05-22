#!/usr/bin/env node
// @ts-check
/**
 * `@/lib/supabase/admin` (service-role, RLS 우회) 가 client 코드에 import 되지 않도록 정적 검증.
 *
 * 검출 규칙:
 *   - src/**\/*.{ts,tsx} 에서 `from "@/lib/supabase/admin"` import 한 파일을 찾는다.
 *   - 그 파일의 첫 비공백 라인이 `"use client"` 또는 `'use client'` 이면 위반.
 *
 * SUPABASE_SERVICE_ROLE_KEY 가 클라이언트 번들에 노출되는 1차 위협만 막는 단순 체크.
 * import 그래프 전이는 따지지 않음 — server action / route handler 안에서 호출되는 것은 정상.
 *
 * 운영:
 *   - `npm run check:admin-imports` 로 수동 실행.
 *   - PR / CI 에서 lint 와 함께 돌리면 됨.
 *   - 위반 1건이라도 있으면 exit 1.
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(REPO_ROOT, "src");
const IMPORT_RE = /from\s+["']@\/lib\/supabase\/admin["']/;
const USE_CLIENT_RE = /^\s*["']use client["']\s*;?\s*$/;

/** @param {string} dir */
async function walk(dir) {
  /** @type {string[]} */
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
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

/** @param {string} content */
function isClientFile(content) {
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("//") || line.startsWith("/*") || line.startsWith("*")) continue;
    return USE_CLIENT_RE.test(line);
  }
  return false;
}

async function main() {
  try {
    await stat(SRC);
  } catch {
    console.error(`[check-admin-imports] src/ not found at ${SRC}`);
    process.exit(2);
  }
  const files = await walk(SRC);
  /** @type {string[]} */
  const violations = [];
  for (const f of files) {
    const content = await readFile(f, "utf8");
    if (!IMPORT_RE.test(content)) continue;
    if (isClientFile(content)) {
      violations.push(relative(REPO_ROOT, f).split(sep).join("/"));
    }
  }
  if (violations.length) {
    console.error(
      `[check-admin-imports] ❌ client 파일에서 @/lib/supabase/admin import 발견:`
    );
    for (const v of violations) console.error(`  - ${v}`);
    console.error(
      `\n  → admin client 는 service-role key 를 쓰므로 'use client' 파일에서 import 금지.`
    );
    console.error(`     서버 액션(@/lib/supabase/admin import OK)을 통해서만 사용.`);
    process.exit(1);
  }
  console.log(`[check-admin-imports] ✅ ${files.length} 파일 검사, 위반 0건`);
}

main().catch((err) => {
  console.error(`[check-admin-imports] FATAL:`, err);
  process.exit(2);
});
