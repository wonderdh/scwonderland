/**
 * 로컬 Supabase 모든 auth.users 비밀번호를 "1111" 로 일괄 변경
 *
 * 사용법:
 *   LOCAL_SUPABASE_URL=http://127.0.0.1:54321 \
 *   LOCAL_SUPABASE_SERVICE_KEY=eyJ... \
 *   node scripts/reset-local-passwords.mjs
 *
 * 환경변수:
 *   LOCAL_SUPABASE_URL          (기본 http://127.0.0.1:54321)
 *   LOCAL_SUPABASE_SERVICE_KEY  (필수, supabase status 의 service_role key)
 *   TARGET_PASSWORD             (기본 "1111")
 *   DRY_RUN                     ("true" 면 실제 변경 안 함)
 *
 * 주의:
 *   - Supabase 기본 password_min_length=6 정책에서 "1111" 거부될 수 있음.
 *     로컬 supabase/config.toml 의 [auth] password_min_length 확인 필요.
 *   - 운영 DB(원격 URL) 에 절대 사용하지 말 것 — 안전장치로 127.0.0.1 외 URL 은 명시적 ALLOW_REMOTE=true 필요
 */

import { createClient } from "@supabase/supabase-js";

const URL = process.env.LOCAL_SUPABASE_URL ?? "http://127.0.0.1:54321";
const KEY = process.env.LOCAL_SUPABASE_SERVICE_KEY;
const PASSWORD = process.env.TARGET_PASSWORD ?? "1111";
const DRY_RUN = process.env.DRY_RUN === "true";
const ALLOW_REMOTE = process.env.ALLOW_REMOTE === "true";

if (!KEY) {
  console.error("ERROR: LOCAL_SUPABASE_SERVICE_KEY 가 필요합니다");
  console.error('  힌트: supabase status 출력에서 "service_role key" 값');
  process.exit(1);
}

if (!URL.includes("127.0.0.1") && !URL.includes("localhost") && !ALLOW_REMOTE) {
  console.error(`ERROR: 원격 URL 감지 (${URL}). 운영 DB 비번 일괄 변경 위험.`);
  console.error("       의도적으로 실행하려면 ALLOW_REMOTE=true 추가");
  process.exit(1);
}

const log = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);

const supabase = createClient(URL, KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function listAllUsers() {
  const all = [];
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    all.push(...data.users);
    if (data.users.length < 1000) break;
    page++;
  }
  return all;
}

async function main() {
  log(`=== 비밀번호 일괄 리셋 시작${DRY_RUN ? " [DRY_RUN]" : ""} ===`);
  log(`URL: ${URL}`);
  log(`Password: "${PASSWORD}"`);

  const users = await listAllUsers();
  log(`대상 user: ${users.length}명`);

  let ok = 0;
  let fail = 0;
  const failures = [];

  for (const u of users) {
    if (DRY_RUN) {
      ok++;
      continue;
    }
    const { error } = await supabase.auth.admin.updateUserById(u.id, {
      password: PASSWORD,
    });
    if (error) {
      fail++;
      failures.push({ email: u.email, message: error.message });
    } else {
      ok++;
    }
  }

  log(`=== 완료: 성공 ${ok}명 / 실패 ${fail}명 ===`);
  if (failures.length > 0) {
    console.warn("실패 목록:");
    failures.slice(0, 10).forEach((f) => console.warn(`  - ${f.email}: ${f.message}`));
    if (failures.length > 10) console.warn(`  ...외 ${failures.length - 10}건`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  if (e.stack) console.error(e.stack);
  process.exit(1);
});
