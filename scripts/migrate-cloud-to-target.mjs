/**
 * Cloud → Target 일반화 마이그레이션 스크립트 (v2: snapshot 모드 + KEEP_AUTH)
 *
 * [세 가지 모드]
 *   1. LEGACY (default): SOURCE → TARGET 직접 (cloud → local 등)
 *   2. SNAPSHOT_OUT:     SOURCE → JSON 파일만 (auth는 dump 안 함)
 *   3. SNAPSHOT_IN:      JSON 파일 → TARGET (마이그레이션 후 데이터 복원)
 *
 * [핵심 옵션]
 *   KEEP_AUTH=true       auth.users 생성/수정 스킵 (target에 이미 user 있을 때)
 *
 * 사용법 1 — 로컬 dev (LEGACY 모드, auth 새로 만듦):
 *   SOURCE_URL=https://xxx.supabase.co \
 *   SOURCE_SERVICE_KEY=sb_secret_... \
 *   TARGET_URL=http://127.0.0.1:54321 \
 *   TARGET_SERVICE_KEY=eyJ... \
 *   node scripts/migrate-cloud-to-target.mjs
 *
 * 사용법 2 — Production cutover (in-place, 2단계, auth 보존):
 *   # 단계 A: 마이그레이션 직전 cloud public 데이터 dump (auth는 안 dump, cloud에 그대로 있음)
 *   SOURCE_URL=cloud_url SOURCE_SERVICE_KEY=cloud_key \
 *   SNAPSHOT_OUT=backups/cloud-snapshot-$(date +%Y%m%d).json \
 *   node scripts/migrate-cloud-to-target.mjs
 *
 *   # 단계 B (마이그레이션 적용 후): snapshot 복원, cloud auth.users 안 건드림
 *   TARGET_URL=cloud_url TARGET_SERVICE_KEY=cloud_key \
 *   SNAPSHOT_IN=backups/cloud-snapshot-20260430.json \
 *   KEEP_AUTH=true \
 *   node scripts/migrate-cloud-to-target.mjs
 *
 * 환경변수:
 *   SOURCE_URL/SOURCE_SERVICE_KEY  source Supabase   (LEGACY, SNAPSHOT_OUT 모드 필수)
 *   TARGET_URL/TARGET_SERVICE_KEY  target Supabase   (LEGACY, SNAPSHOT_IN 모드 필수)
 *   SNAPSHOT_OUT  =path/to/file    source → JSON 저장 후 종료
 *   SNAPSHOT_IN   =path/to/file    JSON 읽어서 target에 적용
 *   KEEP_AUTH     ="true"          auth.users 생성/수정 스킵 (모든 모드)
 *   TARGET_DEFAULT_PASSWORD =pwd   신규 user 비번 (KEEP_AUTH=false 일 때만 사용, 기본 "1111")
 *   DRY_RUN       ="true"          쓰기 모두 스킵, 카운트만 출력
 *
 * 처리 테이블 (FK 의존성 순):
 *   1.  auth.users    (KEEP_AUTH=true 면 스킵)
 *   2.  profiles      (cloud first_name+last_name → 무시, username = email 앞부분)
 *   3.  students      (id = profiles.id, shared PK)
 *   4.  teachers      (id = profiles.id, shared PK)
 *   5.  classes       (group_label → group_type 변환)
 *   6.  class_students (student_profile_id → student_id)
 *   7.  class_teachers (teacher_profile_id → teacher_id)
 *   8.  bus_time_slots / bus_numbers / bus_stops
 *   9.  academy_periods (group_label → group_type)
 *   10. bus_stop_day_assignments
 *   11. bus_stop_schedules
 *   12. student_bus_defaults (student_profile_id → student_id)
 *   13. class_schedules     (teacher_profile_id → teacher_id)
 *   14. afterschool_enrollments (student_profile_id → student_id)
 *   15. attendance          (student_profile_id → student_id)
 *   16. bus_change_requests (student_profile_id → student_id, reviewed_by → 매핑)
 *   17. bus_check_records   (student_profile_id → student_id, checked_by → 매핑)
 *   18. report_cards        (student_profile_id → student_id, author_id → 매핑)
 *   19. weekly_sentences    (그대로)
 *   20. weekly_sentence_config (그대로)
 *   21. notices             (author_id → 매핑)
 *
 * 주의사항:
 *   - bus_staff: 신 스키마에서 제거됨 → 스킵
 *   - class_schedules: cloud에서 class_id가 NULL인 행 스킵 (신 스키마 호환 불가)
 *   - 매핑 키: email (source/target user UUID 다를 수 있음). KEEP_AUTH=true + 같은 cloud 인스턴스면 UUID 동일.
 */

import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

// ── 환경변수 ──────────────────────────────────────────
const SOURCE_URL = process.env.SOURCE_URL;
const SOURCE_SERVICE_KEY = process.env.SOURCE_SERVICE_KEY;
const TARGET_URL = process.env.TARGET_URL;
const TARGET_SERVICE_KEY = process.env.TARGET_SERVICE_KEY;
const SNAPSHOT_OUT = process.env.SNAPSHOT_OUT;
const SNAPSHOT_IN = process.env.SNAPSHOT_IN;
const KEEP_AUTH = process.env.KEEP_AUTH === "true";
const TARGET_DEFAULT_PASSWORD = process.env.TARGET_DEFAULT_PASSWORD ?? "1111";
const DRY_RUN = process.env.DRY_RUN === "true";

// ── 모드 결정 ────────────────────────────────────────
let MODE;
if (SNAPSHOT_OUT && SNAPSHOT_IN) {
  console.error("ERROR: SNAPSHOT_OUT 과 SNAPSHOT_IN 둘 다 지정할 수 없습니다");
  process.exit(1);
}
if (SNAPSHOT_OUT) MODE = "snapshot-out";
else if (SNAPSHOT_IN) MODE = "snapshot-in";
else MODE = "legacy";

if (MODE === "legacy" || MODE === "snapshot-out") {
  if (!SOURCE_URL || !SOURCE_SERVICE_KEY) {
    console.error(`ERROR: ${MODE} 모드는 SOURCE_URL/SOURCE_SERVICE_KEY 가 필요합니다`);
    process.exit(1);
  }
}
if (MODE === "legacy" || MODE === "snapshot-in") {
  if (!TARGET_URL || !TARGET_SERVICE_KEY) {
    console.error(`ERROR: ${MODE} 모드는 TARGET_URL/TARGET_SERVICE_KEY 가 필요합니다`);
    process.exit(1);
  }
}

const BATCH = 50;
const GROUP_LABEL_MAP = {
  "유치부": "kindergarten",
  "방과후": "afterschool",
  "오후반": "afternoon",
};
const VALID_ROLES = new Set(["admin", "teacher", "student"]);

// ── Supabase 클라이언트 ──────────────────────────────
const source = MODE !== "snapshot-in"
  ? createClient(SOURCE_URL, SOURCE_SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;
const target = MODE !== "snapshot-out"
  ? createClient(TARGET_URL, TARGET_SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

// ── 유틸 ─────────────────────────────────────────────
function log(msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

function usernameFromEmail(email) {
  return email.split("@")[0];
}

async function upsertBatch(table, rows, onConflict) {
  if (rows.length === 0) {
    log(`  ${table}: 0행 (없음)`);
    return;
  }
  if (DRY_RUN) {
    log(`  [DRY_RUN] ${table}: ${rows.length}행 예정`);
    return;
  }
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await target
      .from(table)
      .upsert(chunk, { onConflict, ignoreDuplicates: true });
    if (error) throw new Error(`[${table}] upsert 오류: ${error.message}`);
  }
  log(`  ${table}: ${rows.length}행 완료`);
}

// ── Source 읽기 ──────────────────────────────────────
async function readSourceData() {
  log("── [읽기] source 전체 데이터 ──");

  // auth.users (snapshot에는 id+email만 저장)
  const authUsersFull = [];
  let page = 1;
  while (true) {
    const { data, error } = await source.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    authUsersFull.push(...data.users);
    if (data.users.length < 1000) break;
    page++;
  }
  const authUsers = authUsersFull.map((u) => ({ id: u.id, email: u.email }));
  log(`  auth.users: ${authUsers.length}명`);

  const queries = [
    ["profiles", "id, first_name, last_name, role, deleted_at"],
    ["students", "id, profile_id, korean_name, english_name, age"],
    ["teachers", "id, profile_id, name, teacher_type"],
    ["classes", "id, name, group_label, created_at"],
    ["class_students", "class_id, student_profile_id"],
    ["class_teachers", "class_id, teacher_profile_id"],
    ["bus_time_slots", "id, label, time"],
    ["bus_numbers", "id, label"],
    ["bus_stops", "id, name"],
    ["academy_periods", "id, name, start_time, end_time, group_label, has_dropoff, is_active, created_at, updated_at"],
    ["bus_stop_day_assignments", "id, bus_stop_id, bus_number_id, day_of_week, bus_time_slot_id, sort_order, created_at, updated_at"],
    ["bus_stop_schedules", "id, bus_stop_id, day_of_week, bus_time_slot_id, estimated_time, created_at, updated_at"],
    ["student_bus_defaults", "id, student_profile_id, day_of_week, bus_time_slot_id, bus_stop_id, estimated_time, note, created_at, updated_at"],
    ["class_schedules", "id, class_id, academy_period_id, day_of_week, teacher_profile_id, label, created_at, updated_at"],
    ["afterschool_enrollments", "id, class_id, student_profile_id, day_of_week, created_at"],
    ["attendance", "id, student_profile_id, attendance_date, status, note, recorded_by, created_at, updated_at"],
    ["bus_change_requests", "id, student_profile_id, request_date, change_type, new_bus_time_slot_id, new_bus_number_id, new_bus_stop_id, reason, status, reviewed_by, reviewed_at, review_note, requested_at, created_at, updated_at"],
    ["bus_check_records", "id, student_profile_id, check_date, bus_time_slot_id, bus_number_id, boarded_at, checked_at, checked_by, created_at"],
    ["report_cards", "id, student_profile_id, year, month, author_id, content, content_ko, reply, reply_en, created_at, updated_at"],
    ["weekly_sentences", "id, week_number, level, english, korean, example, answer, created_at, updated_at"],
    ["weekly_sentence_config", "id, mode, manual_week, auto_base_week, auto_base_sunday, updated_at"],
    ["notices", "id, title, content, excerpt, author_id, is_published, is_pinned, published_at, created_at, updated_at"],
  ];

  const tables = {};
  for (const [name, cols] of queries) {
    const { data, error } = await source.from(name).select(cols);
    if (error) throw new Error(`[read ${name}] ${error.message}`);
    tables[name] = data ?? [];
    log(`  ${name}: ${tables[name].length}행`);
  }

  return { authUsers, ...tables };
}

function writeSnapshotFile(data, filePath) {
  const dir = path.dirname(filePath);
  if (dir && dir !== ".") fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  const stats = fs.statSync(filePath);
  log(`  snapshot 저장: ${filePath} (${(stats.size / 1024).toFixed(1)} KB)`);
}

function readSnapshotFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw);
  log(`  snapshot 로드: ${filePath} (auth.users ${data.authUsers.length}명)`);
  return data;
}

// ── Target 적용 ──────────────────────────────────────
async function applyToTarget(snapshot) {
  const {
    authUsers, profiles, students, teachers, classes,
    class_students, class_teachers,
    bus_time_slots, bus_numbers, bus_stops,
    academy_periods, bus_stop_day_assignments, bus_stop_schedules,
    student_bus_defaults, class_schedules, afterschool_enrollments,
    attendance: sourceAttendance,
    bus_change_requests, bus_check_records, report_cards,
    weekly_sentences, weekly_sentence_config, notices,
  } = snapshot;

  // source email ↔ id (cloud 기준)
  const emailToId = new Map(authUsers.map((u) => [u.email, u.id]));
  const idToEmail = new Map(authUsers.map((u) => [u.id, u.email]));

  // ── auth.users ──
  log("── [쓰기] auth.users ──");
  const { data: targetAuthData } = await target.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const targetEmailToId = new Map(targetAuthData.users.map((u) => [u.email, u.id]));

  if (KEEP_AUTH) {
    log(`  [KEEP_AUTH] target에 이미 ${targetAuthData.users.length}명. 생성/수정 스킵`);
    const missing = authUsers.filter((u) => !targetEmailToId.has(u.email));
    if (missing.length > 0) {
      console.warn(`  ⚠️  source에 있지만 target에 없는 user: ${missing.length}명`);
      missing.slice(0, 5).forEach((u) => console.warn(`     - ${u.email}`));
      if (missing.length > 5) console.warn(`     ...외 ${missing.length - 5}명`);
      console.warn(`  ⚠️  해당 user의 데이터는 target에 들어가지 않습니다 (FK 매핑 실패)`);
    }
  } else {
    const existingEmails = new Set(targetAuthData.users.map((u) => u.email));
    let authCreated = 0, authSkipped = 0;
    for (const u of authUsers) {
      if (existingEmails.has(u.email)) { authSkipped++; continue; }
      if (!DRY_RUN) {
        const { error } = await target.auth.admin.createUser({
          email: u.email,
          password: TARGET_DEFAULT_PASSWORD,
          email_confirm: true,
          user_metadata: {},
        });
        if (error) console.warn(`  [auth] ${u.email}: ${error.message}`);
        else authCreated++;
      } else {
        authCreated++;
      }
    }
    log(`  생성: ${authCreated}, 스킵(기존): ${authSkipped}${DRY_RUN ? " [DRY_RUN]" : ""}`);

    if (!DRY_RUN && authCreated > 0) {
      const { data: refreshed } = await target.auth.admin.listUsers({ page: 1, perPage: 1000 });
      targetEmailToId.clear();
      for (const u of refreshed.users) targetEmailToId.set(u.email, u.id);
    }
  }

  // cloud id → target id (email pivot)
  const cloudToTargetId = new Map();
  for (const [email, cloudId] of emailToId) {
    const tId = targetEmailToId.get(email);
    if (tId) cloudToTargetId.set(cloudId, tId);
  }

  // ── profiles ──
  log("── [쓰기] profiles ──");
  const profileRows = profiles.map((p) => {
    const email = idToEmail.get(p.id);
    if (!email) return null;
    const tId = targetEmailToId.get(email);
    if (!tId) return null;
    if (!VALID_ROLES.has(p.role)) {
      console.warn(`  [profiles] 스킵(role=${p.role}): ${email}`);
      return null;
    }
    return {
      id: tId,
      username: usernameFromEmail(email),
      role: p.role,
      deleted_at: p.deleted_at ?? null,
    };
  }).filter(Boolean);
  await upsertBatch("profiles", profileRows, "id");

  // ── students (shared PK) ──
  log("── [쓰기] students ──");
  const studentRows = students.map((s) => {
    const email = idToEmail.get(s.profile_id);
    if (!email) return null;
    const tId = targetEmailToId.get(email);
    if (!tId) return null;
    return {
      id: tId,
      korean_name: s.korean_name,
      english_name: s.english_name,
      age: s.age ?? null,
    };
  }).filter(Boolean);
  await upsertBatch("students", studentRows, "id");

  // ── teachers (shared PK) ──
  log("── [쓰기] teachers ──");
  const teacherRows = teachers.map((t) => {
    const email = idToEmail.get(t.profile_id);
    if (!email) return null;
    const tId = targetEmailToId.get(email);
    if (!tId) return null;
    return { id: tId, name: t.name, teacher_type: t.teacher_type };
  }).filter(Boolean);
  await upsertBatch("teachers", teacherRows, "id");

  // ── classes / class_students / class_teachers ──
  log("── [쓰기] classes / class_students / class_teachers ──");
  const classRows = classes.map((c) => ({
    id: c.id,
    name: c.name,
    group_type: GROUP_LABEL_MAP[c.group_label] ?? "afternoon",
    created_at: c.created_at,
  }));
  await upsertBatch("classes", classRows, "id");

  const csRows = class_students.map((r) => {
    const email = idToEmail.get(r.student_profile_id);
    if (!email) return null;
    const tId = targetEmailToId.get(email);
    if (!tId) return null;
    return { class_id: r.class_id, student_id: tId };
  }).filter(Boolean);
  await upsertBatch("class_students", csRows, "class_id,student_id");

  const ctRows = class_teachers.map((r) => {
    const email = idToEmail.get(r.teacher_profile_id);
    if (!email) return null;
    const tId = targetEmailToId.get(email);
    if (!tId) return null;
    return { class_id: r.class_id, teacher_id: tId };
  }).filter(Boolean);
  await upsertBatch("class_teachers", ctRows, "class_id,teacher_id");

  // ── bus 기준 테이블 ──
  log("── [쓰기] bus 기준 테이블 ──");
  await upsertBatch("bus_time_slots", bus_time_slots, "id");
  await upsertBatch("bus_numbers", bus_numbers, "id");
  await upsertBatch("bus_stops", bus_stops, "id");

  // ── academy_periods ──
  log("── [쓰기] academy_periods ──");
  const apRows = academy_periods.map((p) => {
    const groupType = GROUP_LABEL_MAP[p.group_label];
    if (!groupType) {
      console.warn(`  [academy_periods] 스킵(group_label="${p.group_label}"): ${p.name}`);
      return null;
    }
    return {
      id: p.id,
      name: p.name,
      start_time: p.start_time,
      end_time: p.end_time,
      group_label: p.group_label,
      group_type: groupType,
      has_dropoff: p.has_dropoff ?? false,
      is_active: p.is_active ?? true,
      sort_order: 0,
      created_at: p.created_at,
      updated_at: p.updated_at,
    };
  }).filter(Boolean);
  await upsertBatch("academy_periods", apRows, "id");

  // ── bus_stop_day_assignments ──
  log("── [쓰기] bus_stop_day_assignments ──");
  const bsdaRows = bus_stop_day_assignments.map((r) => ({
    id: r.id,
    bus_stop_id: r.bus_stop_id,
    bus_number_id: r.bus_number_id,
    day_of_week: r.day_of_week,
    bus_time_slot_id: r.bus_time_slot_id ?? null,
    sort_order: r.sort_order ?? 0,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
  await upsertBatch("bus_stop_day_assignments", bsdaRows, "id");

  // ── bus_stop_schedules ──
  log("── [쓰기] bus_stop_schedules ──");
  const bssRows = bus_stop_schedules.map((r) => ({
    id: r.id,
    bus_stop_id: r.bus_stop_id,
    day_of_week: r.day_of_week,
    bus_time_slot_id: r.bus_time_slot_id ?? null,
    estimated_time: r.estimated_time != null ? String(r.estimated_time) : null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
  await upsertBatch("bus_stop_schedules", bssRows, "id");

  // ── student_bus_defaults ──
  log("── [쓰기] student_bus_defaults ──");
  const sbdRows = student_bus_defaults.map((r) => {
    const email = idToEmail.get(r.student_profile_id);
    if (!email) return null;
    const tId = targetEmailToId.get(email);
    if (!tId) return null;
    return {
      id: r.id,
      student_id: tId,
      day_of_week: r.day_of_week,
      bus_time_slot_id: r.bus_time_slot_id,
      bus_stop_id: r.bus_stop_id ?? null,
      estimated_time: r.estimated_time != null ? String(r.estimated_time) : null,
      note: r.note ?? null,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  }).filter(Boolean);
  await upsertBatch("student_bus_defaults", sbdRows, "id");

  // ── class_schedules ──
  log("── [쓰기] class_schedules ──");
  let csxSkipped = 0;
  const csxRows = class_schedules.map((r) => {
    if (!r.class_id) { csxSkipped++; return null; }
    let teacherId = null;
    if (r.teacher_profile_id) {
      const email = idToEmail.get(r.teacher_profile_id);
      if (email) teacherId = targetEmailToId.get(email) ?? null;
    }
    return {
      id: r.id,
      class_id: r.class_id,
      academy_period_id: r.academy_period_id,
      day_of_week: r.day_of_week,
      teacher_id: teacherId,
      label: r.label ?? null,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  }).filter(Boolean);
  if (csxSkipped > 0) {
    console.warn(`  [class_schedules] class_id NULL으로 스킵: ${csxSkipped}행`);
  }
  await upsertBatch("class_schedules", csxRows, "class_id,academy_period_id,day_of_week");

  // ── afterschool_enrollments ──
  log("── [쓰기] afterschool_enrollments ──");
  const aeRows = afterschool_enrollments.map((r) => {
    const email = idToEmail.get(r.student_profile_id);
    if (!email) return null;
    const tId = targetEmailToId.get(email);
    if (!tId) return null;
    return {
      id: r.id,
      class_id: r.class_id,
      student_id: tId,
      day_of_week: r.day_of_week,
      academy_period_id: null,
      created_at: r.created_at,
    };
  }).filter(Boolean);
  await upsertBatch("afterschool_enrollments", aeRows, "id");

  // ── attendance ──
  log("── [쓰기] attendance ──");
  const attRows = sourceAttendance.map((r) => {
    const email = idToEmail.get(r.student_profile_id);
    if (!email) return null;
    const tId = targetEmailToId.get(email);
    if (!tId) return null;
    const recordedById = r.recorded_by
      ? (cloudToTargetId.get(r.recorded_by) ?? null)
      : null;
    return {
      id: r.id,
      student_id: tId,
      class_id: null,
      attendance_date: r.attendance_date,
      status: r.status,
      note: r.note ?? null,
      recorded_by: recordedById,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  }).filter(Boolean);
  await upsertBatch("attendance", attRows, "id");

  // ── bus_change_requests ──
  log("── [쓰기] bus_change_requests ──");
  const bcrRows = (bus_change_requests ?? []).map((r) => {
    const email = idToEmail.get(r.student_profile_id);
    if (!email) return null;
    const tId = targetEmailToId.get(email);
    if (!tId) return null;
    const reviewedById = r.reviewed_by ? (cloudToTargetId.get(r.reviewed_by) ?? null) : null;
    return {
      id: r.id,
      student_id: tId,
      request_date: r.request_date,
      change_type: r.change_type,
      new_bus_time_slot_id: r.new_bus_time_slot_id ?? null,
      new_bus_number_id: r.new_bus_number_id ?? null,
      new_bus_stop_id: r.new_bus_stop_id ?? null,
      reason: r.reason ?? null,
      status: r.status,
      reviewed_by: reviewedById,
      reviewed_at: r.reviewed_at ?? null,
      review_note: r.review_note ?? null,
      requested_at: r.requested_at ?? r.created_at,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  }).filter(Boolean);
  await upsertBatch("bus_change_requests", bcrRows, "id");

  // ── bus_check_records ──
  log("── [쓰기] bus_check_records ──");
  const bckRows = (bus_check_records ?? []).map((r) => {
    const email = idToEmail.get(r.student_profile_id);
    if (!email) return null;
    const tId = targetEmailToId.get(email);
    if (!tId) return null;
    const checkedById = r.checked_by ? (cloudToTargetId.get(r.checked_by) ?? null) : null;
    return {
      id: r.id,
      student_id: tId,
      check_date: r.check_date,
      bus_time_slot_id: r.bus_time_slot_id ?? null,
      bus_number_id: r.bus_number_id ?? null,
      boarded_at: r.boarded_at ?? null,
      checked_at: r.checked_at ?? null,
      checked_by: checkedById,
      created_at: r.created_at,
    };
  }).filter(Boolean);
  await upsertBatch("bus_check_records", bckRows, "id");

  // ── report_cards ──
  log("── [쓰기] report_cards ──");
  const rcRows = (report_cards ?? []).map((r) => {
    const email = idToEmail.get(r.student_profile_id);
    if (!email) return null;
    const tId = targetEmailToId.get(email);
    if (!tId) return null;
    const authorId = r.author_id ? (cloudToTargetId.get(r.author_id) ?? null) : null;
    return {
      id: r.id,
      student_id: tId,
      year: r.year,
      month: r.month,
      author_id: authorId,
      content: r.content ?? null,
      content_ko: r.content_ko ?? null,
      reply: r.reply ?? null,
      reply_en: r.reply_en ?? null,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  }).filter(Boolean);
  await upsertBatch("report_cards", rcRows, "id");

  // ── weekly_sentences ──
  log("── [쓰기] weekly_sentences ──");
  const wsRows = (weekly_sentences ?? []).map((r) => ({
    id: r.id,
    week_number: r.week_number,
    level: r.level,
    english: r.english,
    korean: r.korean ?? "",
    example: r.example ?? null,
    answer: r.answer ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
  // 신 스키마 unique (week_number, level) — 같은 주차/레벨 조합은 cloud/seed 에 중복 존재 가능
  await upsertBatch("weekly_sentences", wsRows, "week_number,level");

  // ── weekly_sentence_config ──
  log("── [쓰기] weekly_sentence_config ──");
  const wscRows = (weekly_sentence_config ?? []).map((r) => ({
    id: r.id,
    mode: r.mode,
    manual_week: r.manual_week ?? null,
    auto_base_week: r.auto_base_week ?? 1,
    auto_base_sunday: r.auto_base_sunday ?? new Date().toISOString().slice(0, 10),
    updated_at: r.updated_at,
  }));
  await upsertBatch("weekly_sentence_config", wscRows, "id");

  // ── notices ──
  log("── [쓰기] notices ──");
  const ntcRows = (notices ?? []).map((r) => {
    const authorId = r.author_id ? (cloudToTargetId.get(r.author_id) ?? null) : null;
    return {
      id: r.id,
      title: r.title ?? "",
      content: r.content ?? null,
      excerpt: r.excerpt ?? null,
      author_id: authorId,
      is_published: r.is_published ?? false,
      is_pinned: r.is_pinned ?? false,
      published_at: r.published_at ?? new Date().toISOString(),
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  });
  await upsertBatch("notices", ntcRows, "id");

  log("  bus_staff: 신 스키마에서 제거됨 [스킵]");
}

// ── 메인 ─────────────────────────────────────────────
async function main() {
  log(`=== 마이그레이션 시작: ${MODE} 모드${DRY_RUN ? " [DRY_RUN]" : ""} ===`);
  if (source) log(`SOURCE: ${SOURCE_URL}`);
  if (target) log(`TARGET: ${TARGET_URL}`);
  if (KEEP_AUTH) log(`KEEP_AUTH: 활성 (auth.users 생성/수정 스킵)`);
  if (SNAPSHOT_OUT) log(`SNAPSHOT_OUT: ${SNAPSHOT_OUT}`);
  if (SNAPSHOT_IN) log(`SNAPSHOT_IN: ${SNAPSHOT_IN}`);

  if (MODE === "snapshot-out") {
    const data = await readSourceData();
    writeSnapshotFile(data, SNAPSHOT_OUT);
    log("=== SNAPSHOT_OUT 완료 (target에는 쓰지 않음) ===");
    return;
  }

  let snapshot;
  if (MODE === "snapshot-in") {
    snapshot = readSnapshotFile(SNAPSHOT_IN);
  } else {
    snapshot = await readSourceData();
  }

  await applyToTarget(snapshot);
  log("=== 마이그레이션 완료 ===");
  if (!DRY_RUN && TARGET_URL?.includes("127.0.0.1")) {
    log("검증: http://127.0.0.1:54323 (Supabase Studio)");
  }
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  if (e.stack) console.error(e.stack);
  process.exit(1);
});
