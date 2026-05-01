/**
 * Cloud → Local 마이그레이션 스크립트
 *
 * 구 스키마(cloud) → 신 스키마(local, Shared PK) 변환
 * 모든 계정 비밀번호 = 1111
 *
 * 사용법: node scripts/migrate-cloud-to-local.mjs
 */

import { createClient } from "@supabase/supabase-js";

// ── 설정 ──────────────────────────────────────────────
const CLOUD_URL = "https://jxrzhonxnkjpjmzdhyoi.supabase.co";
const CLOUD_SERVICE_KEY = "sb_secret_Bwc8pu-wphNspUaXMH4pdg_5m9GYCJ7";

const LOCAL_URL = "http://127.0.0.1:54321";
const LOCAL_SERVICE_KEY =
  "***REMOVED***";

const BATCH = 50; // upsert 배치 크기

// ── 클라이언트 ────────────────────────────────────────
const cloud = createClient(CLOUD_URL, CLOUD_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const local = createClient(LOCAL_URL, LOCAL_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── 유틸 ─────────────────────────────────────────────
function usernameFromEmail(email) {
  return email.split("@")[0];
}

async function upsertBatch(client, table, rows, onConflict) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await client
      .from(table)
      .upsert(chunk, { onConflict, ignoreDuplicates: true });
    if (error) throw new Error(`[${table}] ${error.message}`);
  }
}

function log(msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

// ── 메인 ─────────────────────────────────────────────
async function main() {
  log("=== SC Wonderland Cloud → Local 마이그레이션 시작 ===");
  log("비밀번호: 모든 계정 1111");

  // ── 1. cloud 데이터 읽기 ──────────────────────────
  log("1/7 cloud 데이터 읽는 중...");

  // auth.users (Admin API로 페이지네이션)
  const authUsers = [];
  let page = 1;
  while (true) {
    const { data, error } = await cloud.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;
    authUsers.push(...data.users);
    if (data.users.length < 1000) break;
    page++;
  }
  log(`  auth.users: ${authUsers.length}명`);

  // email → id 맵
  const emailToId = new Map(authUsers.map((u) => [u.email, u.id]));
  const idToEmail = new Map(authUsers.map((u) => [u.id, u.email]));

  // profiles
  const { data: profiles, error: pErr } = await cloud
    .from("profiles")
    .select("id, first_name, last_name, role, deleted_at");
  if (pErr) throw pErr;
  log(`  profiles: ${profiles.length}행`);

  // students (구 스키마: profile_id 컬럼)
  const { data: students, error: sErr } = await cloud
    .from("students")
    .select("id, profile_id, korean_name, english_name, age");
  if (sErr) throw sErr;
  log(`  students: ${students.length}행`);

  // teachers (구 스키마: profile_id 컬럼)
  const { data: teachers, error: tErr } = await cloud
    .from("teachers")
    .select("id, profile_id, name, teacher_type");
  if (tErr) throw tErr;
  log(`  teachers: ${teachers.length}행`);

  // classes
  const { data: classes, error: cErr } = await cloud
    .from("classes")
    .select("id, name, group_label, created_at");
  if (cErr) throw cErr;
  log(`  classes: ${classes.length}행`);

  // class_students (구 스키마: student_profile_id)
  const { data: classStudents, error: csErr } = await cloud
    .from("class_students")
    .select("class_id, student_profile_id");
  if (csErr) throw csErr;
  log(`  class_students: ${classStudents.length}행`);

  // class_teachers (구 스키마: teacher_profile_id)
  const { data: classTeachers, error: ctErr } = await cloud
    .from("class_teachers")
    .select("class_id, teacher_profile_id");
  if (ctErr) throw ctErr;
  log(`  class_teachers: ${classTeachers.length}행`);

  // bus 기준 테이블
  const { data: busTimeSlots } = await cloud
    .from("bus_time_slots")
    .select("id, label, time");
  const { data: busNumbers } = await cloud
    .from("bus_numbers")
    .select("id, label");
  const { data: busStops } = await cloud
    .from("bus_stops")
    .select("id, name");
  log(
    `  bus: ${busTimeSlots.length} slots, ${busNumbers.length} numbers, ${busStops.length} stops`
  );

  // ── 2. local auth.users 생성 ──────────────────────
  log("2/7 local auth.users 생성 중...");

  // 기존 유저 확인
  const { data: existingAuthData } = await local.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const existingIds = new Set(existingAuthData.users.map((u) => u.id));

  let created = 0,
    skipped = 0;
  for (const u of authUsers) {
    if (existingIds.has(u.id)) {
      skipped++;
      continue;
    }
    const { error } = await local.auth.admin.createUser({
      email: u.email,
      password: "1111",
      email_confirm: true,
      user_metadata: {},
    });
    // createUser가 id 지정을 지원하지 않으면 아래 fallback으로 패치
    if (error) {
      console.warn(`  [auth] ${u.email}: ${error.message}`);
    } else {
      created++;
    }
  }
  log(`  생성: ${created}, 스킵(기존): ${skipped}`);

  // ID가 다를 수 있으므로 다시 맵 갱신
  const { data: localAuthData } = await local.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const localEmailToId = new Map(
    localAuthData.users.map((u) => [u.email, u.id])
  );
  log(`  local auth.users 총 ${localAuthData.users.length}명`);

  // cloud id → local id 매핑 (email 기준)
  const cloudToLocalId = new Map();
  for (const [email, cloudId] of emailToId) {
    const localId = localEmailToId.get(email);
    if (localId) cloudToLocalId.set(cloudId, localId);
  }

  // ── 3. profiles (새 스키마) ───────────────────────
  log("3/7 profiles 삽입...");

  const VALID_ROLES = new Set(["admin", "teacher", "student"]);

  const profileRows = profiles
    .map((p) => {
      const email = idToEmail.get(p.id);
      if (!email) return null;
      const localId = localEmailToId.get(email);
      if (!localId) return null;
      // 신 스키마 user_role enum: admin/teacher/student만 허용 (bus 없음)
      if (!VALID_ROLES.has(p.role)) {
        console.warn(`  [profiles] 스킵 (role=${p.role}): ${email}`);
        return null;
      }
      return {
        id: localId,
        username: usernameFromEmail(email),
        role: p.role,
        deleted_at: p.deleted_at ?? null,
      };
    })
    .filter(Boolean);

  await upsertBatch(local, "profiles", profileRows, "id");
  log(`  ${profileRows.length}행 완료`);

  // ── 4. students (새 스키마, shared PK) ───────────
  log("4/7 students 삽입...");

  // profile_id → local id
  const studentRows = students
    .map((s) => {
      const email = idToEmail.get(s.profile_id);
      if (!email) return null;
      const localId = localEmailToId.get(email);
      if (!localId) return null;
      return {
        id: localId,           // shared PK
        korean_name: s.korean_name,
        english_name: s.english_name,
        age: s.age ?? null,
      };
    })
    .filter(Boolean);

  await upsertBatch(local, "students", studentRows, "id");
  log(`  ${studentRows.length}행 완료`);

  // ── 5. teachers (새 스키마, shared PK) ───────────
  log("5/7 teachers 삽입...");

  const teacherRows = teachers
    .map((t) => {
      const email = idToEmail.get(t.profile_id);
      if (!email) return null;
      const localId = localEmailToId.get(email);
      if (!localId) return null;
      return {
        id: localId,           // shared PK
        name: t.name,
        teacher_type: t.teacher_type,
      };
    })
    .filter(Boolean);

  await upsertBatch(local, "teachers", teacherRows, "id");
  log(`  ${teacherRows.length}행 완료`);

  // ── 6. classes ────────────────────────────────────
  log("6/7 classes 및 반 배정 삽입...");

  const GROUP_LABEL_MAP = {
    "유치부": "kindergarten",
    "방과후": "afterschool",
    "오후반": "afternoon",
  };

  const classRows = classes.map((c) => ({
    id: c.id,
    name: c.name,
    group_type: GROUP_LABEL_MAP[c.group_label] ?? "afternoon",
    created_at: c.created_at,
  }));

  await upsertBatch(local, "classes", classRows, "id");
  log(`  classes: ${classRows.length}행`);

  // class_students: student_profile_id → student_id (local id)
  const csRows = classStudents
    .map((r) => {
      const email = idToEmail.get(r.student_profile_id);
      if (!email) return null;
      const localId = localEmailToId.get(email);
      if (!localId) return null;
      return { class_id: r.class_id, student_id: localId };
    })
    .filter(Boolean);

  await upsertBatch(local, "class_students", csRows, "class_id,student_id");
  log(`  class_students: ${csRows.length}행`);

  // class_teachers: teacher_profile_id → teacher_id (local id)
  const ctRows = classTeachers
    .map((r) => {
      const email = idToEmail.get(r.teacher_profile_id);
      if (!email) return null;
      const localId = localEmailToId.get(email);
      if (!localId) return null;
      return { class_id: r.class_id, teacher_id: localId };
    })
    .filter(Boolean);

  await upsertBatch(local, "class_teachers", ctRows, "class_id,teacher_id");
  log(`  class_teachers: ${ctRows.length}행`);

  // ── 7. bus 기준 데이터 ────────────────────────────
  log("7/7 bus 기준 데이터 삽입...");

  await upsertBatch(local, "bus_time_slots", busTimeSlots, "id");
  await upsertBatch(local, "bus_numbers", busNumbers, "id");
  await upsertBatch(local, "bus_stops", busStops, "id");
  log(`  bus 완료`);

  // ── 완료 ─────────────────────────────────────────
  log("=== 마이그레이션 완료 ===");
  log("검증: http://127.0.0.1:54323 (Supabase Studio)");
  log("로그인 테스트: s1@scwonderland.com / 1111");
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
