/**
 * Migration Verification Script
 *
 * Compares cloud (old schema) vs target (new schema) after migration.
 *
 * Schema transformation context:
 *   Source (cloud):  students.profile_id, teachers.profile_id
 *                    class_students.student_profile_id, class_teachers.teacher_profile_id
 *                    profiles: first_name + last_name, role includes 'bus'
 *                    classes.group_label
 *   Target (new):    students.id = teachers.id = profiles.id (Shared PK)
 *                    class_students.student_id, class_teachers.teacher_id
 *                    profiles: username (= email prefix), role: admin/teacher/student only
 *                    classes.group_type (enum)
 *
 * Usage:
 *   SOURCE_URL=https://jxr....supabase.co \
 *   SOURCE_SERVICE_KEY=sb_secret_... \
 *   TARGET_URL=http://127.0.0.1:54321 \
 *   TARGET_SERVICE_KEY=eyJ... \
 *   node scripts/verify-migration.mjs [--json]
 *
 * Exit code: 0 = all PASS, 1 = any FAIL
 */

import { createClient } from "@supabase/supabase-js";

// ── CLI flags ─────────────────────────────────────────────────────────────────
const JSON_MODE = process.argv.includes("--json");

// ── Env validation (fail fast) ────────────────────────────────────────────────
const SOURCE_URL = process.env.SOURCE_URL;
const SOURCE_SERVICE_KEY = process.env.SOURCE_SERVICE_KEY;
const TARGET_URL = process.env.TARGET_URL;
const TARGET_SERVICE_KEY = process.env.TARGET_SERVICE_KEY;

const missingEnv = [
  !SOURCE_URL && "SOURCE_URL",
  !SOURCE_SERVICE_KEY && "SOURCE_SERVICE_KEY",
  !TARGET_URL && "TARGET_URL",
  !TARGET_SERVICE_KEY && "TARGET_SERVICE_KEY",
].filter(Boolean);

if (missingEnv.length > 0) {
  console.error(`Missing required env vars: ${missingEnv.join(", ")}`);
  process.exit(1);
}

// ── Clients ───────────────────────────────────────────────────────────────────
const src = createClient(SOURCE_URL, SOURCE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const tgt = createClient(TARGET_URL, TARGET_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Output helpers ────────────────────────────────────────────────────────────
const results = [];

function log(msg) {
  if (!JSON_MODE) console.log(msg);
}

function recordCheck(category, name, passed, detail = "", note = "") {
  results.push({ category, name, passed, detail, note });
  if (!JSON_MODE) {
    const icon = passed ? "✅ PASS" : "❌ FAIL";
    const noteStr = note ? ` [NOTE: ${note}]` : "";
    console.log(`  ${icon}  ${name}${noteStr}`);
    if (detail) console.log(`         ${detail}`);
  }
}

// ── Utility: count rows from a table ─────────────────────────────────────────
async function countRows(client, table) {
  const { count, error } = await client
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) {
    // Table may not exist yet in target
    return { count: null, error: error.message };
  }
  return { count, error: null };
}

// ── Utility: list auth users (paginated) ─────────────────────────────────────
async function listAuthUsers(client) {
  const users = [];
  let page = 1;
  while (true) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw new Error(`auth.admin.listUsers: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < 1000) break;
    page++;
  }
  return users;
}

// ── Category A: Row Count Comparison ─────────────────────────────────────────
async function checkRowCounts(busRoleCount) {
  log("\n── A. Row Count Comparison ──────────────────────────────────────────");

  // Tables where counts should match exactly (no schema-driven diff)
  const exactTables = [
    "students",
    "teachers",
    "classes",
    "class_students",
    "class_teachers",
    "academy_periods",
    "class_schedules",
    "afterschool_enrollments",
    "attendance",
    "bus_time_slots",
    "bus_numbers",
    "bus_stops",
    "bus_stop_day_assignments",
    "bus_stop_schedules",
    "student_bus_defaults",
    "bus_staff",
  ];

  for (const table of exactTables) {
    const [s, t] = await Promise.all([
      countRows(src, table),
      countRows(tgt, table),
    ]);

    if (s.error || t.error) {
      const errMsg = [s.error && `src: ${s.error}`, t.error && `tgt: ${t.error}`]
        .filter(Boolean)
        .join("; ");
      recordCheck("A", `${table} count`, false, errMsg);
      continue;
    }

    const diff = t.count - s.count;
    const passed = diff === 0;
    const detail =
      passed
        ? `src=${s.count} tgt=${t.count}`
        : `src=${s.count} tgt=${t.count} diff=${diff > 0 ? "+" : ""}${diff}`;
    recordCheck("A", `${table} count`, passed, detail);
  }

  // profiles: target should have (source - bus_role_count)
  {
    const [s, t] = await Promise.all([
      countRows(src, "profiles"),
      countRows(tgt, "profiles"),
    ]);
    if (s.error || t.error) {
      const errMsg = [s.error && `src: ${s.error}`, t.error && `tgt: ${t.error}`]
        .filter(Boolean)
        .join("; ");
      recordCheck("A", "profiles count", false, errMsg);
    } else {
      const expectedTarget = s.count - busRoleCount;
      const passed = t.count === expectedTarget;
      const detail = `src=${s.count} (bus_role=${busRoleCount} excluded) expected_tgt=${expectedTarget} actual_tgt=${t.count}`;
      recordCheck(
        "A",
        "profiles count (bus excluded)",
        passed,
        detail,
        busRoleCount > 0 ? `${busRoleCount} 'bus' role profiles excluded from target` : ""
      );
    }
  }
}

// ── Category B: Email Set Comparison ─────────────────────────────────────────
async function checkEmailSets() {
  log("\n── B. auth.users Email Set Comparison ───────────────────────────────");

  const [srcUsers, tgtUsers] = await Promise.all([
    listAuthUsers(src),
    listAuthUsers(tgt),
  ]);

  const srcEmails = new Set(srcUsers.map((u) => u.email?.toLowerCase()).filter(Boolean));
  const tgtEmails = new Set(tgtUsers.map((u) => u.email?.toLowerCase()).filter(Boolean));

  const missingInTarget = [...srcEmails].filter((e) => !tgtEmails.has(e));
  const extraInTarget = [...tgtEmails].filter((e) => !srcEmails.has(e));

  recordCheck(
    "B",
    "auth.users source count",
    true,
    `src=${srcEmails.size} users`,
    "informational"
  );
  recordCheck(
    "B",
    "auth.users target count",
    true,
    `tgt=${tgtEmails.size} users`,
    "informational"
  );

  const missingPassed = missingInTarget.length === 0;
  recordCheck(
    "B",
    "no emails missing in target",
    missingPassed,
    missingPassed
      ? "all source emails present in target"
      : `${missingInTarget.length} missing: ${missingInTarget.slice(0, 5).join(", ")}${missingInTarget.length > 5 ? "..." : ""}`
  );

  const extraPassed = extraInTarget.length === 0;
  recordCheck(
    "B",
    "no extra emails in target",
    extraPassed,
    extraPassed
      ? "no unexpected emails in target"
      : `${extraInTarget.length} extra: ${extraInTarget.slice(0, 5).join(", ")}${extraInTarget.length > 5 ? "..." : ""}`
  );

  return { srcUsers, tgtUsers, srcEmails, tgtEmails };
}

// ── Category C: Spot-check 5 random students ─────────────────────────────────
async function checkSpotSamples(srcUsers, tgtUsers) {
  log("\n── C. Spot-check 5 Random Students ─────────────────────────────────");

  // Fetch source students with profile_id
  const { data: srcStudents, error: ssErr } = await src
    .from("students")
    .select("id, profile_id, korean_name, english_name, age");
  if (ssErr) {
    recordCheck("C", "spot-check fetch", false, `src students error: ${ssErr.message}`);
    return;
  }

  if (!srcStudents || srcStudents.length === 0) {
    recordCheck("C", "spot-check fetch", false, "no students in source");
    return;
  }

  // Pick 5 random students
  const shuffled = [...srcStudents].sort(() => Math.random() - 0.5);
  const sample = shuffled.slice(0, 5);

  // Build email maps
  const srcIdToEmail = new Map(srcUsers.map((u) => [u.id, u.email?.toLowerCase()]));
  const tgtEmailToId = new Map(tgtUsers.map((u) => [u.email?.toLowerCase(), u.id]));

  for (const s of sample) {
    const email = srcIdToEmail.get(s.profile_id);
    if (!email) {
      recordCheck("C", `student ${s.korean_name}`, false, `no email for profile_id ${s.profile_id}`);
      continue;
    }

    const tgtId = tgtEmailToId.get(email);
    if (!tgtId) {
      recordCheck("C", `student ${s.korean_name}`, false, `email ${email} not found in target auth.users`);
      continue;
    }

    // Fetch target student by shared PK (id = profile id)
    const { data: tgtStudent, error: tsErr } = await tgt
      .from("students")
      .select("id, korean_name, english_name, age")
      .eq("id", tgtId)
      .maybeSingle();

    if (tsErr) {
      recordCheck("C", `student ${s.korean_name}`, false, `tgt query error: ${tsErr.message}`);
      continue;
    }

    if (!tgtStudent) {
      recordCheck("C", `student ${s.korean_name}`, false, `not found in target (email=${email}, tgt_id=${tgtId})`);
      continue;
    }

    // Verify name matches
    const nameMatch = tgtStudent.korean_name === s.korean_name;
    if (!nameMatch) {
      recordCheck(
        "C",
        `student ${s.korean_name}`,
        false,
        `korean_name mismatch: src="${s.korean_name}" tgt="${tgtStudent.korean_name}"`
      );
      continue;
    }

    // Verify class assignment
    const [srcCsRes, tgtCsRes] = await Promise.all([
      src.from("class_students").select("class_id").eq("student_profile_id", s.profile_id),
      tgt.from("class_students").select("class_id").eq("student_id", tgtId),
    ]);

    const srcClassIds = new Set((srcCsRes.data ?? []).map((r) => r.class_id));
    const tgtClassIds = new Set((tgtCsRes.data ?? []).map((r) => r.class_id));
    const classMatch =
      srcClassIds.size === tgtClassIds.size &&
      [...srcClassIds].every((id) => tgtClassIds.has(id));

    // Verify bus default
    const [srcBusRes, tgtBusRes] = await Promise.all([
      src.from("student_bus_defaults").select("bus_stop_id, time_slot_id").eq("student_id", s.id),
      tgt.from("student_bus_defaults").select("bus_stop_id, time_slot_id").eq("student_id", tgtId),
    ]);

    // Bus defaults: compare count (stop/slot IDs may differ if reference data changed)
    const busCountMatch = (srcBusRes.data?.length ?? 0) === (tgtBusRes.data?.length ?? 0);

    const allGood = nameMatch && classMatch && busCountMatch;
    const detail = [
      `email=${email}`,
      `classes: src=${srcClassIds.size} tgt=${tgtClassIds.size} ${classMatch ? "✓" : "✗"}`,
      `bus_defaults: src=${srcBusRes.data?.length ?? "?"} tgt=${tgtBusRes.data?.length ?? "?"} ${busCountMatch ? "✓" : "✗"}`,
    ].join(" | ");

    recordCheck("C", `student ${s.korean_name}`, allGood, detail);
  }
}

// ── Category D: FK Integrity in Target ───────────────────────────────────────
async function checkFkIntegrity() {
  log("\n── D. FK Integrity in Target ────────────────────────────────────────");

  // 1. class_students.student_id → students.id
  {
    // Fetch all student IDs from target
    const { data: studentIds, error: siErr } = await tgt
      .from("students")
      .select("id");
    const { data: csRows, error: csErr } = await tgt
      .from("class_students")
      .select("student_id");

    if (siErr || csErr) {
      recordCheck("D", "class_students.student_id FK", false,
        [siErr && siErr.message, csErr && csErr.message].filter(Boolean).join("; "));
    } else {
      const validIds = new Set((studentIds ?? []).map((r) => r.id));
      const orphans = (csRows ?? []).filter((r) => !validIds.has(r.student_id));
      recordCheck(
        "D",
        "class_students.student_id → students.id",
        orphans.length === 0,
        orphans.length === 0
          ? `all ${csRows.length} rows valid`
          : `${orphans.length} orphan(s): ${orphans.slice(0, 3).map((r) => r.student_id).join(", ")}`
      );
    }
  }

  // 2. class_teachers.teacher_id → teachers.id
  {
    const { data: teacherIds, error: tiErr } = await tgt
      .from("teachers")
      .select("id");
    const { data: ctRows, error: ctErr } = await tgt
      .from("class_teachers")
      .select("teacher_id");

    if (tiErr || ctErr) {
      recordCheck("D", "class_teachers.teacher_id FK", false,
        [tiErr && tiErr.message, ctErr && ctErr.message].filter(Boolean).join("; "));
    } else {
      const validIds = new Set((teacherIds ?? []).map((r) => r.id));
      const orphans = (ctRows ?? []).filter((r) => !validIds.has(r.teacher_id));
      recordCheck(
        "D",
        "class_teachers.teacher_id → teachers.id",
        orphans.length === 0,
        orphans.length === 0
          ? `all ${ctRows.length} rows valid`
          : `${orphans.length} orphan(s): ${orphans.slice(0, 3).map((r) => r.teacher_id).join(", ")}`
      );
    }
  }

  // 3. student_bus_defaults.student_id → students.id
  {
    const { data: studentIds, error: siErr } = await tgt
      .from("students")
      .select("id");
    const { data: sbdRows, error: sbdErr } = await tgt
      .from("student_bus_defaults")
      .select("student_id");

    if (siErr || sbdErr) {
      recordCheck("D", "student_bus_defaults.student_id FK", false,
        [siErr && siErr.message, sbdErr && sbdErr.message].filter(Boolean).join("; "));
    } else {
      const validIds = new Set((studentIds ?? []).map((r) => r.id));
      const orphans = (sbdRows ?? []).filter((r) => !validIds.has(r.student_id));
      recordCheck(
        "D",
        "student_bus_defaults.student_id → students.id",
        orphans.length === 0,
        orphans.length === 0
          ? `all ${sbdRows.length} rows valid`
          : `${orphans.length} orphan(s): ${orphans.slice(0, 3).map((r) => r.student_id).join(", ")}`
      );
    }
  }
}

// ── Summary table (human-readable) ───────────────────────────────────────────
function printSummary() {
  const pass = results.filter((r) => r.passed).length;
  const fail = results.filter((r) => !r.passed).length;
  const total = results.length;

  log("\n════════════════════════════════════════════════════════════════════");
  log("  SUMMARY");
  log("════════════════════════════════════════════════════════════════════");

  const cats = ["A", "B", "C", "D"];
  const catLabels = {
    A: "Row Counts",
    B: "Email Sets",
    C: "Spot Checks",
    D: "FK Integrity",
  };

  for (const cat of cats) {
    const catResults = results.filter((r) => r.category === cat);
    const catPass = catResults.filter((r) => r.passed).length;
    const catFail = catResults.filter((r) => !r.passed).length;
    const icon = catFail === 0 ? "✅" : "❌";
    log(`  ${icon} ${cat}. ${catLabels[cat]}: ${catPass}/${catResults.length} passed`);
    if (catFail > 0) {
      catResults
        .filter((r) => !r.passed)
        .forEach((r) => log(`       ✗ ${r.name}: ${r.detail}`));
    }
  }

  log("════════════════════════════════════════════════════════════════════");
  log(`  TOTAL: ${pass}/${total} passed, ${fail} failed`);
  log("════════════════════════════════════════════════════════════════════");
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  log("╔══════════════════════════════════════════════════════════════════╗");
  log("║  SC Wonderland — Migration Verification                         ║");
  log(`║  Source: ${SOURCE_URL.slice(0, 50).padEnd(50)} ║`);
  log(`║  Target: ${TARGET_URL.slice(0, 50).padEnd(50)} ║`);
  log("╚══════════════════════════════════════════════════════════════════╝");

  // Pre-fetch: count bus role users in source to compute expected profile diff
  let busRoleCount = 0;
  try {
    const { count, error } = await src
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "bus");
    if (!error) busRoleCount = count ?? 0;
    log(`\n  Source 'bus' role profiles: ${busRoleCount} (excluded from target)`);
  } catch (e) {
    log(`  [warn] Could not count bus role: ${e.message}`);
  }

  // Run all checks
  await checkRowCounts(busRoleCount);
  const { srcUsers, tgtUsers } = await checkEmailSets();
  await checkSpotSamples(srcUsers, tgtUsers);
  await checkFkIntegrity();

  // Output
  if (JSON_MODE) {
    const pass = results.filter((r) => r.passed).length;
    const fail = results.filter((r) => !r.passed).length;
    console.log(
      JSON.stringify(
        {
          summary: { total: results.length, pass, fail, allPassed: fail === 0 },
          busRoleExcluded: busRoleCount,
          checks: results,
        },
        null,
        2
      )
    );
  } else {
    printSummary();
  }

  const anyFail = results.some((r) => !r.passed);
  process.exit(anyFail ? 1 : 0);
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
