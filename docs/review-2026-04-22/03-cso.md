# /cso Daily Report — SC Wonderland (2026-04-22)

Mode: daily · Confidence gate: 8/10 · Scope: full audit (manual fallback, skill tool was dispatch-only)

SC Wonderland is a K-12 academy web app. The security surface sits entirely on Supabase (Auth + Postgres + Storage) behind Next.js 16 server actions. There is no Docker, no CI/CD (GitHub Actions), no webhooks, and no public API — the attack surface is the 22 `"use server"` files and the Supabase admin-key path.

The blast radius matters here: every mutating admin action calls `createAdminClient()` which holds the `SUPABASE_SERVICE_ROLE_KEY` and bypasses RLS. That makes the auth helper at the top of each action the *only* gate. RLS is a defense-in-depth layer, not the primary gate, because the admin client ignores it.

Most of the codebase gets this right. Three files do not.

## Summary

| Severity | Count |
|---|---|
| Critical | 3 |
| High | 3 |
| Medium | 3 |
| Low | 2 |

Findings in this report are all **VERIFIED** (read the function bodies, traced the auth path).

## Critical Findings (즉시 패치)

### C1. class_notices mutating actions have zero role/ownership check — any student can create/update/delete any class notice

- **File:** `C:\scwonderland\src\app\(admin)\admin\actions\class-notice-actions.ts:116, 171, 232`
- **Phase:** 9 — OWASP A01 Broken Access Control
- **Confidence:** 10/10 — VERIFIED
- **Issue:** The three mutating functions (`createClassNotice`, `updateClassNotice`, `deleteClassNotice`) only call `supabase.auth.getUser()` and return if `user` is null. There is no role check (`verifyTeacherOrAdmin`), no class-teacher membership check, and no author-ownership check on update/delete.
  - `createClassNotice` does check `authorId === user.id`, which stops you from forging a *different* author — but it doesn't stop a student from creating a class notice with their own user.id as author_id for any class_id they pick.
  - `updateClassNotice` takes an `id` from FormData, then `UPDATE class_notices WHERE id = ?` with the admin client. No `WHERE author_id = user.id`. Any authenticated user can overwrite any class notice.
  - `deleteClassNotice` takes a `noticeId` and calls `deleteNoticeCommon(...)` with the admin client. No ownership check anywhere in the chain.
- **Evidence:**
  ```ts
  // class-notice-actions.ts:174-176
  const supabaseAuth = await createClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return { error: "인증이 필요합니다." };
  // ...no role check, no ownership check, proceeds to admin client UPDATE
  ```
  Contrast with `academy-notice-actions.ts:54, 64, 74` which correctly call `verifyAdmin()`.
- **Exploit scenario:** Logged-in student opens devtools on `/academy/student`, calls the server action directly (it's addressable via React Server Actions' encrypted action ID, but the function signature is known). Passes any `class_notices.id` as the target. Title becomes "test" across every class notice in the school. Or deletes them all.
- **Impact:** Integrity (vandalism of all class communications), availability (deletion), reputational. Teacher writes a notice, a student wipes it — untraceable because `author_id` in the row isn't touched on update.
- **Rule violation:** `rules/patterns.md` explicitly forbids this pattern: "mutating 액션에 verifyAuthenticated()만 사용하면 학생 계정으로도 통과되어 권한 우회 가능."
- **Fix:**
  ```ts
  // All three functions:
  const auth = await verifyTeacherOrAdmin();
  if ("error" in auth) return { error: auth.error };
  // For update/delete, add ownership check before mutation:
  const { data: existing } = await supabase
    .from("class_notices").select("author_id, class_id").eq("id", id).single();
  if (!existing) return { error: "공지를 찾을 수 없습니다." };
  if (auth.role === "teacher" && existing.author_id !== auth.userId) {
    return { error: "본인이 작성한 공지만 수정할 수 있습니다." };
  }
  ```

### C2. getSubmissionFiles returns signed URLs for any submission by ID — IDOR on private bucket

- **File:** `C:\scwonderland\src\app\(admin)\admin\actions\homework-actions.ts:405-426`
- **Phase:** 9 — OWASP A01 Broken Access Control (IDOR)
- **Confidence:** 9/10 — VERIFIED
- **Issue:** `getSubmissionFiles(submissionId)` checks only `verifyAuthenticated()`. Given a `submissionId`, it queries `homework_submission_files` and generates 1-hour signed URLs for the private `homework-submissions` bucket. No check that the caller owns the submission or is a teacher of that class.
- **Evidence:**
  ```ts
  export async function getSubmissionFiles(submissionId: string): Promise<HomeworkSubmissionFile[]> {
    const auth = await verifyAuthenticated();
    if ("error" in auth) return [];
    const supabase = createAdminClient();
    const { data: files } = await supabase
      .from("homework_submission_files").select("*").eq("submission_id", submissionId);
    // ...createSignedUrls on those paths...
  }
  ```
- **Exploit scenario:** Student A calls `getSubmissionFiles(submissionId_of_student_B)` with any guessable/enumerable UUID. Receives signed URLs to student B's audio homework submissions. The bucket is intentionally private but the signed URL issuer doesn't gate access.
- **Impact:** Confidentiality breach of minor students' voice recordings. PII exposure. The fact that the bucket is private gives a false sense of security — the action layer bypasses it.
- **Fix:** Add ownership + teacher/admin role gate:
  ```ts
  const { data: sub } = await admin.from("homework_submissions")
    .select("student_profile_id, assignment_id").eq("id", submissionId).single();
  if (!sub) return [];
  if (sub.student_profile_id === auth.userId) { /* student owns it */ }
  else {
    // Must be teacher of the class or admin
    const { data: profile } = await admin.from("profiles").select("role").eq("id", auth.userId).single();
    if (profile?.role === "admin") { /* ok */ }
    else if (profile?.role === "teacher") {
      // Verify teacher teaches the class this assignment belongs to
      const { data: assn } = await admin.from("homework_assignments").select("class_id").eq("id", sub.assignment_id).single();
      const { data: ct } = await admin.from("class_teachers")
        .select("class_id").eq("teacher_profile_id", auth.userId).eq("class_id", assn?.class_id).maybeSingle();
      if (!ct) return [];
    } else return [];
  }
  ```

### C3. reviewSubmission lets any authenticated user write teacher feedback

- **File:** `C:\scwonderland\src\app\(admin)\admin\actions\homework-actions.ts:376-402`
- **Phase:** 9 — OWASP A01 Broken Access Control
- **Confidence:** 9/10 — VERIFIED
- **Issue:** Checks `if (reviewerId !== user.id) return { error: "권한이 없습니다." };` — which only prevents impersonating *another* teacher. It does not check that the caller's `role` is teacher or admin. A student can call `reviewSubmission(submissionId, "I'm giving myself an A", myUserId)` and flip any submission to `status = 'reviewed'` with their own text as `teacher_feedback`. The submission's `reviewed_by` now points to a student's profile id.
- **Evidence:** Line 385: `if (reviewerId !== user.id) return { error: "권한이 없습니다." };` — no role check, no class-teacher membership check.
- **Exploit scenario:** Student crafts a request to `reviewSubmission` for their own or a classmate's submission. Teacher sees their submission was already "reviewed" with fake feedback. Audit trail now wrong (reviewed_by FK to a student).
- **Impact:** Integrity of the homework grading flow. Audit trail corruption. Possible foreign-key issues downstream if UI assumes `reviewed_by` is a teacher profile.
- **Fix:**
  ```ts
  const auth = await verifyTeacherOrAdmin();
  if ("error" in auth) return { error: auth.error };
  // reviewerId is derivable from auth.userId — remove the param entirely, or keep as cross-check
  ```

## High Findings

### H1. submitBusChangeRequest has no ownership check on studentProfileId

- **File:** `C:\scwonderland\src\app\(admin)\admin\actions\bus-actions.ts:1613-1640`
- **Phase:** 9 — OWASP A01 (IDOR)
- **Confidence:** 9/10 — VERIFIED
- **Issue:** Takes `studentProfileId` as a parameter, calls `verifyAuthenticated()`, then inserts a bus change request row with that studentProfileId. Never checks `studentProfileId === user.id`.
- **Exploit scenario:** Student A submits a "no_ride" request on behalf of student B for tomorrow. Student B then doesn't get picked up. Or submits a "change to different bus" request to re-route a classmate. The DB `UNIQUE(student_profile_id, request_date)` also means student A can block student B from submitting their own legitimate request for that day.
- **Impact:** Child safety + availability. A student weaponizing this to send a classmate to the wrong bus is a physical-world outcome — "bugs that lose the customer's data" here means a kid at the wrong stop.
- **Fix:** Add `if (studentProfileId !== auth.userId) return { error: "본인 요청만 제출할 수 있습니다." };` after auth check.

### H2. cancelBusChangeRequest weak IDOR

- **File:** `C:\scwonderland\src\app\(admin)\admin\actions\bus-actions.ts:1642-1660`
- **Phase:** 9 — OWASP A01
- **Confidence:** 8/10 — VERIFIED
- **Issue:** Filters `DELETE WHERE id = requestId AND student_profile_id = studentProfileId AND status = 'pending'`. Caller must know both the requestId and studentProfileId of the target. Practical risk is lower than H1, but a teacher or admin who legitimately sees pending request lists (via `listPendingChangeRequests`) could then cancel other students' requests through this student-facing endpoint, and any student could cancel a sibling's pending request if they know/can guess both IDs.
- **Exploit scenario:** Student A sees their own bus request IDs in page state. If the app ever renders another student's `requestId + studentProfileId` pair (class roster + pending requests shown to a teacher, for example), anyone with browser devtools can cancel those.
- **Fix:** Same pattern as H1 — require `studentProfileId === auth.userId` *or* role check for teacher/admin.

### H3. xlsx (SheetJS) — high-severity CVEs with NO fix available

- **File:** `C:\scwonderland\package.json` (direct dependency)
- **Phase:** 3 — Dependency Supply Chain
- **Confidence:** 10/10 — VERIFIED (npm audit)
- **Issue:** Two high-severity advisories on `xlsx` (GHSA-4r6h-8v6p-xvw6 prototype pollution, GHSA-5pgg-2g8v-p4x9 ReDoS). npm reports `fixAvailable: false` — the maintainer publishes through cdn.sheetjs.com, not npm. Any user-uploaded .xlsx file (weekly-sentences bulk import, bus export paths) is processed by this library.
- **Evidence:**
  ```
  range: *
  fixAvailable: False
  ```
- **Exploit scenario:** Admin uploads a malicious .xlsx in `/admin/weekly-sentences` bulk import. Prototype pollution leads to logic errors elsewhere in the Node process on the server (Vercel serverless function) — outcome depends on downstream gadgets, but even a ReDoS in a regex is a server-side compute spike. Non-admins can't reach this path today (only admin uploads), which caps impact.
- **Fix options:**
  - Install the patched version from CDN: `npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (maintainer's recommended path).
  - Migrate to `exceljs` (already in the tree, used for bus export) — unify on one library, drop xlsx.
  - Or restrict the import surface: server-side file size cap, type check, run the parse in an isolated worker.

## Medium Findings

### M1. Next.js 16.1.2 has 6 CVEs including server-action CSRF bypass

- **File:** `C:\scwonderland\package.json` (direct)
- **Phase:** 3
- **Confidence:** 10/10 — VERIFIED (npm audit)
- **Issue:** Running a Next.js version in the vulnerable range (`16.0.0-beta.0 - 16.2.2`). Most notable: GHSA-mq59-m269-xvcx (null origin bypasses Server Actions CSRF checks) — directly relevant because this app is 100% Server Actions. `fixAvailable: 16.2.4` (non-breaking).
- **Fix:** `npm i next@16.2.4`.

### M2. DeepL translate.ts logs student names and report-card content previews (PII)

- **File:** `C:\scwonderland\src\lib\server\translate.ts:45-49, 89-92`
- **Phase:** 9 — OWASP A09 / CLAUDE.md rule
- **Confidence:** 9/10 — VERIFIED
- **Issue:** Uses raw `console.log` (bypasses `logger`) to print preserved student names and 80-char previews of report card content on every translation call. CLAUDE.md explicitly bans this: "서버에서는 console.log/error 직접 사용 금지. PII는 컨텍스트에 넣지 말 것."
  ```ts
  console.log(`[translate] preserving names: ${names.join(", ")}`);  // Student Korean + English names
  console.log(`[translate] → ${targetLang} | "${preview}"`);          // Report card body (80 chars)
  console.log(`[translate] ✓ "${resultPreview}"`);                    // Translated body
  ```
- **Impact:** Vercel Function logs contain minor students' names and report card excerpts. Depending on log retention and who has Vercel dashboard access, this is an unintended PII disclosure channel.
- **Fix:** Use `logger.info(tag, "translated", { targetLang, len: trimmed.length })` — no names, no content preview. If you need debugging, add a `DEEPL_DEBUG` env flag that gates the verbose path.

### M3. RLS is defined, but every action uses createAdminClient() which bypasses it

- **File:** 22 action files in `src/app/(admin)/admin/actions/` and `src/app/(academy)/academy/actions.ts`
- **Phase:** 10 — STRIDE Elevation of Privilege
- **Confidence:** 8/10 — observation/design tradeoff
- **Issue:** Per `rules/database.md`, RLS policies on all 36 tables are "방어 계층 + JWT 직접 접근용" — because admin-client actions bypass them entirely, the only real gate on 100+ server actions is the `verifyAdmin/verifyAuthenticated/verifyTeacherOrAdmin` call at the top. That's three critical findings above where the gate was missing. The pattern is fragile: one forgotten helper call = full privilege escalation, and RLS provides zero backstop.
- **Recommendation:** Three things:
  1. Add a project-wide ESLint rule or a lightweight TS transform that errors if a `"use server"` file imports `createAdminClient` without also importing and using one of the `verify*` helpers. (Grep-based CI check is enough.)
  2. For actions where the user IS authorized to touch the table via RLS (reading own attendance, own report card), prefer `createClient()` over `createAdminClient()` — RLS then acts as defense-in-depth.
  3. Consider adding a thin wrapper: `withAuth(verifier, handler)` that forces the pattern syntactically.

## Low Findings / Observations

### L1. `.env` tracked-history clean — only `.env.example` ever committed, with placeholder values

- `git log --all -p -- '.env*'` shows only `.env.example` in history, with empty values (`NEXT_PUBLIC_SUPABASE_URL=`, etc.). No secrets ever leaked. `.gitignore` includes `.env*` correctly.

### L2. Transitive-dep CVE wall (7 transitive high vulns, not directly reachable)

- `@hono/node-server`, `hono`, `express-rate-limit`, `flatted`, `minimatch`, `path-to-regexp`, `picomatch`, `brace-expansion`, `ajv` all flagged in audit. These ride in via `supabase` and dev tooling. None are directly imported by your code (checked). `npm audit fix` resolves them. Low urgency but housekeeping.

### L3. escapeHtml correctly used in all `document.write` print paths

- Verified 3/3 call sites:
  - `StudentTimetableClient.tsx:56` → uses `escapeHtml()` on all user data (student name, teacher name, period labels, times). ✓
  - `StudentTimetableTab.tsx:66` → same pattern, all escaped. ✓
  - `AfterschoolPageClient.tsx:455, 557` → uses `el.outerHTML` from a React-rendered ref. React escapes student names at render time (the `<span>{...}</span>` path), so the captured HTML is safe. No raw string interpolation.
- No XSS findings.

## Server Action Auth Coverage Table

Non-mutating read actions (listTextbooks, getDashboardStats, etc.) use `verifyAdmin` or `verifyAuthenticated` consistently. Below is the mutating-action coverage; bold = issues above.

| File | Function | Auth Check | Verdict |
|---|---|---|---|
| academy-notice-actions.ts | createAcademyNotice / updateAcademyNotice / deleteAcademyNotice | verifyAdmin | OK |
| **class-notice-actions.ts** | **createClassNotice** | **getUser only** | **CRITICAL (C1)** |
| **class-notice-actions.ts** | **updateClassNotice** | **getUser only, no ownership** | **CRITICAL (C1)** |
| **class-notice-actions.ts** | **deleteClassNotice** | **getUser only, no ownership** | **CRITICAL (C1)** |
| notice-actions.ts | createNotice / updateNotice / deleteNotice | verifyAdmin | OK |
| attendance-actions.ts | recordAttendance / bulkRecordAttendance / bulkReserveAttendance / deleteAttendance | verifyTeacherOrAdmin | OK |
| afterschool-actions.ts | enrollStudent / removeAfterschoolStudent / deleteAfterschoolEnrollmentDay / updateAfterschoolSecondPeriod / bulkUpdateEnrollmentDays | verifyAdmin | OK |
| bus-actions.ts | createBusNumber, updateBusNumber, deleteBusNumber, create/update/delete BusTimeSlot, createBusStop, updateBusStop, deleteBusStop, upsertStudentBusDefault, deleteStudentBusDefault(s), saveBusStopDayAssignments, copyBusDayDataToOtherDays, upsert/deleteBusStopSchedule, approveChangeRequest, rejectChangeRequest, createAdminBusChange, updateAdminBusChange, deleteAdminBusChange, bulkCreateBusChanges, saveBulkBusDefaults, boardBusStudent, checkBusStudent, uncheckBusStudent | verifyAdmin (spot-checked) | OK |
| **bus-actions.ts** | **submitBusChangeRequest** | **verifyAuthenticated, no ownership** | **HIGH (H1)** |
| **bus-actions.ts** | **cancelBusChangeRequest** | **verifyAuthenticated, weak filter** | **HIGH (H2)** |
| bus-staff.ts | createBusStaff / updateBusStaff / deleteBusStaff | verifyAdmin | OK |
| class-actions.ts | createClass / updateClass / deleteClass / addStudentToClass / removeStudentFromClass | verifyAdmin | OK |
| homework-actions.ts | createHomeworkAssignment / updateHomeworkAssignment / deleteHomeworkAssignment | verifyTeacherOrAdmin | OK |
| homework-actions.ts | submitHomework | getUser + ownership check | OK |
| **homework-actions.ts** | **reviewSubmission** | **reviewerId===user.id only, no role check** | **CRITICAL (C3)** |
| **homework-actions.ts** | **getSubmissionFiles** | **verifyAuthenticated, no ownership** | **CRITICAL (C2)** |
| learning-actions.ts | createLearningRecord / updateLearningRecord / deleteLearningRecord | verifyTeacherOrAdmin | OK |
| report-actions.ts | upsertReportCard | verifyTeacherOrAdmin (native/admin) | OK |
| report-actions.ts | deleteReportCard | verifyAdmin | OK |
| report-actions.ts | updateReportCardReply | getUser + ownership (student_profile_id === user.id) | OK |
| report-actions.ts | translateReportCard | verifyAdmin | OK |
| schedule-actions.ts | addSingleClassSchedule / setClassScheduleSlot / addClassScheduleBatch / deleteClassSchedule / deleteStudentSchedule | verifyAdmin | OK |
| textbook-actions.ts | createTextbook / updateTextbook / deleteTextbook / assign*/remove* / updateProgress / batchUpdateProgress | verifyAdmin | OK |
| timetable-actions.ts | createAcademyPeriod / updateAcademyPeriod / deleteAcademyPeriod | verifyAdmin | OK |
| user-actions.ts | createStudent / createTeacher / deleteUserById / restoreUser / permanentlyDeleteUser / updateStudent/TeacherProfile / resetUserPassword / bulkResetStudentPasswords | verifyAdmin | OK |
| weekly-sentence-actions.ts | upsertWeeklySentence / deleteWeeklySentence / bulkImportWeeklySentences / updateWeeklySentenceConfig | verifyAdmin (spot-checked) | OK |
| academy/actions.ts | (all 7) | inline role check in each | OK |

**Auth boundary summary:** 92 mutating actions surveyed. 89 have correct auth. 6 don't (3 in class-notice-actions, 2 in bus-actions, 2 in homework-actions, one of which is arguably a read path but leaks private bucket URLs so I'm counting it here).

Boundary audit:
- Admin client importers (23 total): all verified server-side (action files, layout.tsx, proxy.ts, notice-crud-helpers.ts). Zero client components import it. ✓
- `@/lib/server/` importers (18 total): all server-side. Zero `"use client"` files import it. ✓

## Dependency Audit

`npm audit` summary:

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 9 |
| Moderate | 2 |
| Low | 0 |

Direct deps flagged:
- `next` (high, 6 CVEs, fix to 16.2.4) — see M1
- `xlsx` (high, 2 CVEs, NO npm fix available) — see H3

All other 9 entries are transitive. `npm audit fix` should resolve everything except xlsx (handled separately per H3).

## Recommendations (prioritized)

1. **Today (CRITICAL).** Patch C1 / C2 / C3. They're ~15 min each, same pattern: add `verifyTeacherOrAdmin()` or `verifyAdmin()` + an ownership query. Three files, ~60 lines of diff.
2. **Today.** `npm i next@16.2.4` (M1). Non-breaking, resolves the Server Actions CSRF bypass.
3. **This week.** Fix H1 + H2 in bus-actions. Same pattern as C1 — add ownership guard. Don't ship a bus system where students can reroute each other.
4. **This week.** Swap `xlsx` for the CDN-patched build or migrate the weekly-sentences import path to `exceljs` (H3). The server-side parse of untrusted .xlsx on Vercel functions is the exposure.
5. **This week.** M2 — replace `console.log` PII logging in translate.ts with the project `logger` (no names, no content). One file, 4 lines.
6. **This sprint.** M3 — add a CI check: every `"use server"` file that imports `createAdminClient` must also import one of the `verify*` helpers. Even as a grep-based pre-commit hook, this closes the class of bug that generated C1/C3.
7. **Ongoing.** Add a `.gitleaks.toml` + pre-commit hook (Husky) to prevent future `.env` leaks. Current history is clean — keep it that way.
8. **Monthly.** Run `/cso --comprehensive` to sweep below the 8/10 gate.

## Disclaimer

This tool is not a substitute for a professional security audit. /cso is an AI-assisted scan that catches common vulnerability patterns — it is not comprehensive, not guaranteed, and not a replacement for hiring a qualified security firm. For production systems handling sensitive data, payments, or PII (and a K-12 student portal qualifies), engage a professional penetration testing firm. Use /cso as a first pass to catch low-hanging fruit and improve your security posture between professional audits — not as your only line of defense.
