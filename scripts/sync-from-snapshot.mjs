/**
 * JSON snapshot → 로컬 Supabase 직접 적재 (스키마 변환 없음)
 *
 * 사용법:
 *   SNAPSHOT_IN=tmp/cloud-snapshot.json \
 *   TARGET_URL=http://127.0.0.1:54321 \
 *   TARGET_SERVICE_KEY=sb_secret_... \
 *   node scripts/sync-from-snapshot.mjs
 *
 * snapshot JSON 형식:
 *   {
 *     "auth_users": [{ id, email, ... }, ...],
 *     "profiles":   [{ id, ... }, ...],
 *     ...각 public 테이블...
 *   }
 *
 * 동작:
 *   1. auth.users: 같은 UUID 로 createUser (password = TARGET_PASSWORD, 기본 "1111")
 *      → cloud FK 가 그대로 유효 (id 보존)
 *   2. 각 public 테이블: upsert (FK 의존성 순서대로)
 *
 * 환경변수:
 *   SNAPSHOT_IN          (필수)  JSON 파일 경로
 *   TARGET_URL           (필수)  로컬 Supabase URL
 *   TARGET_SERVICE_KEY   (필수)  로컬 service_role
 *   TARGET_PASSWORD      (옵션)  새 user 비밀번호 (기본 "1111")
 *   DRY_RUN="true"       (옵션)  쓰기 스킵, 카운트만
 */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const SNAPSHOT_IN = process.env.SNAPSHOT_IN;
const TARGET_URL = process.env.TARGET_URL;
const TARGET_SERVICE_KEY = process.env.TARGET_SERVICE_KEY;
const TARGET_PASSWORD = process.env.TARGET_PASSWORD ?? "1111";
const DRY_RUN = process.env.DRY_RUN === "true";

if (!SNAPSHOT_IN || !TARGET_URL || !TARGET_SERVICE_KEY) {
  console.error("ERROR: SNAPSHOT_IN, TARGET_URL, TARGET_SERVICE_KEY 모두 필요");
  process.exit(1);
}

const log = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
const target = createClient(TARGET_URL, TARGET_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BATCH = 100;

// FK 의존성 순서. 각 테이블은 cloud 와 동일 스키마 가정.
// (없는 테이블은 건너뜀)
const TABLE_ORDER = [
  "profiles",
  "students",
  "teachers",
  "classes",
  "class_students",
  "class_teachers",
  "bus_time_slots",
  "bus_numbers",
  "bus_stops",
  "academy_periods",
  "bus_stop_day_assignments",
  "bus_stop_schedules",
  "student_bus_defaults",
  "class_schedules",
  "afterschool_enrollments",
  "attendance",
  "bus_change_requests",
  "bus_check_records",
  "report_cards",
  "weekly_sentences",
  "weekly_sentence_config",
  "notices",
];

async function upsertTable(name, rows) {
  if (!rows || rows.length === 0) {
    log(`  ${name}: 0행 (skip)`);
    return;
  }
  if (DRY_RUN) {
    log(`  [DRY_RUN] ${name}: ${rows.length}행 예정`);
    return;
  }
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await target.from(name).upsert(chunk, { ignoreDuplicates: false });
    if (error) {
      throw new Error(`[${name}] upsert ${i}~${i + chunk.length}: ${error.message}`);
    }
  }
  log(`  ${name}: ${rows.length}행 완료`);
}

async function syncAuthUsers(cloudUsers) {
  log(`── auth.users (${cloudUsers.length}명) ──`);
  const { data: existing } = await target.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existingIds = new Set(existing.users.map((u) => u.id));
  const existingEmails = new Set(existing.users.map((u) => u.email));

  let created = 0;
  let skipped = 0;
  const failures = [];

  for (const u of cloudUsers) {
    if (existingIds.has(u.id) || existingEmails.has(u.email)) {
      skipped++;
      continue;
    }
    if (DRY_RUN) {
      created++;
      continue;
    }
    const { error } = await target.auth.admin.createUser({
      id: u.id,
      email: u.email,
      password: TARGET_PASSWORD,
      email_confirm: true,
    });
    if (error) {
      failures.push({ email: u.email, message: error.message });
    } else {
      created++;
    }
  }

  log(`  생성: ${created}, 스킵(기존): ${skipped}, 실패: ${failures.length}`);
  if (failures.length > 0) {
    failures.slice(0, 5).forEach((f) => console.warn(`    ✗ ${f.email}: ${f.message}`));
    if (failures.length > 5) console.warn(`    ...외 ${failures.length - 5}건`);
  }
}

async function main() {
  log(`=== Snapshot → 로컬 동기화 시작${DRY_RUN ? " [DRY_RUN]" : ""} ===`);
  log(`SNAPSHOT_IN: ${SNAPSHOT_IN}`);
  log(`TARGET_URL:  ${TARGET_URL}`);
  log(`PASSWORD:    "${TARGET_PASSWORD}"`);

  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_IN, "utf-8"));
  log(`snapshot keys: ${Object.keys(snapshot).join(", ")}`);

  if (snapshot.auth_users) {
    await syncAuthUsers(snapshot.auth_users);
  } else {
    log("auth_users 없음 (스킵)");
  }

  log("── public 테이블 적재 ──");
  for (const t of TABLE_ORDER) {
    if (!(t in snapshot)) {
      log(`  ${t}: snapshot 에 없음 (skip)`);
      continue;
    }
    await upsertTable(t, snapshot[t]);
  }

  log("=== 완료 ===");
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  if (e.stack) console.error(e.stack);
  process.exit(1);
});
