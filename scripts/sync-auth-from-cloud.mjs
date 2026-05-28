/**
 * Cloud auth.users → Local 동기화 (UUID 보존, 비밀번호 "1111")
 *
 * Dump-based migration 의 사전 단계로 실행.
 * UUID 를 보존해야 cloud public dump 의 FK 가 그대로 유효함.
 *
 * 사용법:
 *   set -a; source .env.scripts; set +a
 *   node scripts/sync-auth-from-cloud.mjs
 *
 * 환경변수:
 *   SOURCE_URL / SOURCE_SERVICE_KEY  cloud
 *   TARGET_URL / TARGET_SERVICE_KEY  local
 *   TARGET_PASSWORD  (기본 "1111")
 */

import { createClient } from "@supabase/supabase-js";

const { SOURCE_URL, SOURCE_SERVICE_KEY, TARGET_URL, TARGET_SERVICE_KEY } = process.env;
const PASSWORD = process.env.TARGET_PASSWORD ?? "1111";

if (!SOURCE_URL || !SOURCE_SERVICE_KEY || !TARGET_URL || !TARGET_SERVICE_KEY) {
  console.error("ERROR: SOURCE_URL/SOURCE_SERVICE_KEY/TARGET_URL/TARGET_SERVICE_KEY 모두 필요");
  process.exit(1);
}

const src = createClient(SOURCE_URL, SOURCE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const tgt = createClient(TARGET_URL, TARGET_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const log = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);

async function listAll(client) {
  const users = [];
  let page = 1;
  while (true) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) break;
    page++;
  }
  return users;
}

async function main() {
  log(`=== auth.users sync 시작 (password="${PASSWORD}") ===`);
  log(`SOURCE: ${SOURCE_URL}`);
  log(`TARGET: ${TARGET_URL}`);

  const cloudUsers = await listAll(src);
  log(`cloud users: ${cloudUsers.length}명`);

  const existing = await listAll(tgt);
  const existingIds = new Set(existing.map((u) => u.id));
  const existingEmails = new Set(existing.map((u) => u.email));
  log(`local 기존 users: ${existing.length}명`);

  let created = 0;
  let skipped = 0;
  const failures = [];

  for (const u of cloudUsers) {
    if (existingIds.has(u.id) || existingEmails.has(u.email)) {
      skipped++;
      continue;
    }
    const { error } = await tgt.auth.admin.createUser({
      id: u.id,
      email: u.email,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) {
      failures.push({ email: u.email, message: error.message });
    } else {
      created++;
    }
  }

  log(`=== 완료: 생성 ${created}, 스킵(기존) ${skipped}, 실패 ${failures.length} ===`);
  if (failures.length > 0) {
    console.warn("실패 목록:");
    failures.slice(0, 10).forEach((f) => console.warn(`  ✗ ${f.email}: ${f.message}`));
    if (failures.length > 10) console.warn(`  ...외 ${failures.length - 10}건`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  if (e.stack) console.error(e.stack);
  process.exit(1);
});
