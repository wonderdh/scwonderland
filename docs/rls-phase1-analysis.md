# RLS Phase 1 Analysis — Users Domain (profiles, students, teachers)

**Date:** 2026-04-20  
**Phase:** 1 of 5 (Users)  
**Status:** DRAFT — NOT applied to prod

---

## 1. Current RLS State Summary

### RLS Enabled / Disabled

All 35 tables in `public` schema have `rowsecurity = true`.  
No table is unprotected at the RLS-flag level.

### Existing Policies Count

| Table       | Policy count | Policy names (prod) |
|-------------|-------------|---------------------|
| `profiles`  | 2           | "Users can read own profile" (SELECT self), "Admins can update any profile role" (UPDATE) |
| `students`  | 2           | "Admins can manage students" (ALL admin), "Students can view own info" (SELECT self) |
| `teachers`  | 2           | "Admins can manage teachers" (ALL admin), "Teachers can view own info" (SELECT self) |

Total Phase 1 target table policies in prod: **6 policies**.

Most other tables (attendance, homework_*, report_cards, class_notices, bus_*) already have well-formed multi-role policy sets, including teacher-scoped policies using the `class_teachers → class_students` join pattern.

### Tables with RLS Enabled but Zero Policies (Security Advisor Findings)

| Table | Risk |
|-------|------|
| `afterschool_enrollments` | All rows blocked for non-service-role reads (only admin client touches this → currently safe, but brittle) |
| `bus_stop_day_assignments` | Same pattern |
| `class_teachers` | Critical junction table — no policy means student/teacher JWT cannot read it. All current reads go through `createAdminClient()` so no current regression, but any accidental `createClient()` call would silently return empty. |
| `textbooks` | Only admin client reads textbooks today |

These four are **not in Phase 1 scope** but should be addressed in Phases 2–4.

---

## 2. Security Advisor Findings

### INFO — rls_enabled_no_policy (4 tables)
- `afterschool_enrollments`, `bus_stop_day_assignments`, `class_teachers`, `textbooks`
- Action: Address in Phases 2–4

### WARN — function_search_path_mutable (7 functions)
- `set_classes_updated_at`, `get_class_report_status`, `handle_attendance_bus_sync`, `generate_student_number`, `generate_teacher_number`, `set_student_number`, `set_teacher_number`
- Risk: Malicious schema injection if `search_path` is manipulated.  
- Remediation: Add `SET search_path = public, pg_catalog` to each function.  
- Action: Out of Phase 1 scope; recommend a separate migration.

### WARN — public_bucket_allows_listing (2 buckets)
- `academy-notices`, `class-notices` — broad SELECT policy allows file enumeration.  
- Action: Narrow storage policies to specific path prefixes. Out of scope.

### WARN — auth_leaked_password_protection disabled
- Enable HaveIBeenPwned check in Supabase Auth settings dashboard.  
- Action: No SQL needed; toggle in Auth settings.

---

## 3. Access Pattern Summary

### profiles table

| Caller | Client used | Operation | Where |
|--------|------------|-----------|-------|
| Admin auth-helpers | `createClient()` (server, user JWT) | SELECT role WHERE id = auth.uid() | `auth-helpers.ts` verifyAdmin, verifyTeacherOrAdmin |
| Academy student actions | `createClient()` | SELECT role WHERE id = user.id | `academy/actions.ts` getCurrentStudentProfile, getCurrentStudentClasses, getCurrentTeacherProfile, getTeacherClasses, getClassReportStatus, getCurrentStudentTextbooks |
| Bus actions | `createAdminClient()` | SELECT role WHERE id = user.id | `bus/actions.ts` getCurrentBusStaffProfile |
| Admin user-actions | `createAdminClient()` | SELECT/UPDATE/INSERT/DELETE | user-actions.ts CRUD |
| Admin dashboard | `createAdminClient()` | SELECT count WHERE role = X | dashboard-actions.ts |
| Admin bus-staff | `createAdminClient()` | SELECT/JOIN profiles | bus-staff.ts |
| Admin report-actions | `createAdminClient()` | SELECT first_name/last_name | report-actions.ts |

**Critical finding:** `auth-helpers.ts` uses `createClient()` (user JWT, respects RLS) to read `profiles.role`. The existing `"Users can read own profile"` policy already covers this. Phase 1 replaces it with the identically-scoped `profiles_self_select`.

### students table

| Caller | Client | Operation |
|--------|--------|-----------|
| `academy/actions.ts` getCurrentStudentProfile | `createClient()` | SELECT own row |
| `academy/actions.ts` getTeacherClasses | `createAdminClient()` | SELECT students in teacher's classes |
| All admin actions | `createAdminClient()` | Full CRUD |
| Bus actions | `createAdminClient()` | SELECT for manifest |

Only `getCurrentStudentProfile` in `academy/actions.ts` reads `students` via `createClient()`. The policy `students_self_select` (profile_id = auth.uid()) covers this.

### teachers table

| Caller | Client | Operation |
|--------|--------|-----------|
| `academy/actions.ts` getCurrentTeacherProfile | `createAdminClient()` | SELECT own row |
| `academy/actions.ts` getTeacherClasses | `createAdminClient()` | SELECT teacher names |
| All admin actions | `createAdminClient()` | Full CRUD |
| Report, schedule, class-notice actions | `createAdminClient()` | SELECT name/type for joins |

No `teachers` reads currently use `createClient()` directly — all go through `createAdminClient()`. Phase 1 adds policies for defence-in-depth and future migration safety.

---

## 4. Phase 1 Policy Design Rationale

### profiles

| Policy | Role | CMD | Rationale |
|--------|------|-----|-----------|
| `profiles_admin_all` | authenticated (admin role) | ALL | Admin needs unrestricted access for user management |
| `profiles_self_select` | authenticated | SELECT | Any logged-in user reads own profile — required by auth-helpers |
| `profiles_self_update` | authenticated | UPDATE | Allows future self-service profile edit; does not allow role/deleted_at escalation at policy level |

**No INSERT policy** — profiles are created by the Auth trigger running under service role, which bypasses RLS. No client-side INSERT path exists.  
**No DELETE policy** — deletion is handled by service role (`createAdminClient()` + Auth ban). No client-side DELETE path exists.

### students

| Policy | Role | CMD | Rationale |
|--------|------|-----|-----------|
| `students_admin_all` | admin | ALL | Full management |
| `students_self_select` | student (self) | SELECT | `getCurrentStudentProfile()` reads own students row via createClient() |
| `students_teacher_select` | teacher | SELECT | Defence-in-depth; join via class_teachers→class_students |

### teachers

| Policy | Role | CMD | Rationale |
|--------|------|-----|-----------|
| `teachers_admin_all` | admin | ALL | Full management |
| `teachers_self_select` | teacher (self) | SELECT | Own row access |
| `teachers_coworker_select` | teacher | SELECT | Co-teacher lookup via shared class; needed when join reads use createClient() |

---

## 5. Risks and Edge Cases

### 5.1 Self-referential policy on profiles (profiles_admin_all)

The admin SELECT/UPDATE policy uses a subquery `SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'`. This is a **self-join on the same table under RLS** — Postgres evaluates the inner SELECT before applying the outer policy, which can cause infinite recursion in some versions.

**Mitigation already applied:** The `profiles_self_select` policy (SELECT WHERE id = auth.uid()) is evaluated first for the inner subquery because it matches the admin's own row. In Postgres 15+ (Supabase runs PG 15+), permissive policies union — the self-select policy grants the row, so the subquery succeeds. This is the same pattern used by `academy_notices_admin_all`, `attendance_admin_all`, and many other tables already in prod without issues.

**Staging test:** Run `SET ROLE authenticated; SET request.jwt.claims = '{"sub":"<admin-uuid>"}'; SELECT * FROM profiles LIMIT 1;` via SQL editor and verify it returns rows without timeout.

### 5.2 Teacher access to students they don't directly teach

`students_teacher_select` allows a teacher to see any student in ANY of their assigned classes. If a teacher is assigned to multiple classes and those classes share a student, the student appears once (correct). But a teacher cannot see students of classes they are NOT assigned to. This is the intended behaviour.

### 5.3 profiles_self_update does not enforce column-level restrictions

The UPDATE policy allows a logged-in user to update their own profile row, including `role` and `deleted_at` columns, **if the Server Action permits it**. No Server Action currently exposes role-change to students or teachers (only `verifyAdmin()` gated actions do). However, a raw PostgREST PATCH call from the browser client (`createClient()`) with the anon key could attempt to self-escalate role.

**Recommended fix before production apply:** Add a CHECK constraint or a `BEFORE UPDATE` trigger that rejects changes to `role` or `deleted_at` if the caller is not the service role. Alternatively, narrow `profiles_self_update` to a `SECURITY DEFINER` RPC. This is flagged as a **required decision** — see Section 7.

### 5.4 bus role and profiles

The `bus` role profile is read via `createAdminClient()` in `bus/actions.ts`. No `createClient()` path exists for bus users currently. The `profiles_self_select` policy (self-join) covers the bus role if it ever needs its own profile via createClient().

### 5.5 class_teachers has RLS but no policies

`class_teachers` is used heavily as the join table in `students_teacher_select` and `teachers_coworker_select`. Because those are **subqueries inside policy quals**, Postgres evaluates them with the calling user's RLS context. Since `class_teachers` has RLS enabled but **zero policies**, the subquery returns no rows for any non-service-role caller — which would silently break both new teacher policies.

**This is a blocker for staging testing of teacher policies.** Either:
1. Add a minimal read-all-authenticated policy to `class_teachers` before Phase 1 staging test, OR
2. Include `class_teachers` policy in Phase 1 scope.

The migration draft includes a note but does not add the `class_teachers` policy (it belongs to Phase 2 — classes domain). Recommend adding it to Phase 1 or as a prerequisite patch.

---

## 6. Staging Rollout Checklist

- [ ] Create a Supabase branch (`supabase branches create phase1-rls-test`)
- [ ] Apply `20260420000000_enable_rls_phase1_users.sql` to the branch
- [ ] Add a temporary `class_teachers` read policy (prerequisite — see Risk 5.5)
- [ ] Run smoke tests with each role:
  - [ ] Admin login → admin/students page loads, user list renders
  - [ ] Student login → /academy/student profile shows own name & student_number
  - [ ] Korean teacher login → /academy/teacher → class list renders
  - [ ] Native teacher login → /academy/teacher/reports → student list renders
  - [ ] Bus staff login → /bus → manifest loads
- [ ] Run Supabase Security Advisor after apply — verify no new rls_enabled_no_policy on profiles/students/teachers
- [ ] Run `EXPLAIN` on hot queries to verify no new Seq Scans introduced by policy subqueries
- [ ] Verify auth-helpers.ts: verifyAdmin() still returns { userId } for admin (not { error })
- [ ] Verify rollback: apply rollback SQL → re-run smoke tests → confirm original behaviour

---

## 7. Unresolved Questions ~~Requiring User Decision Before Staging Apply~~

All four questions have been resolved (see Section 8 below).

1. **profiles_self_update column-level risk (Risk 5.3):** RESOLVED — see Decision 1 in Section 8.

2. **class_teachers prerequisite (Risk 5.5):** RESOLVED — see Decision 2 in Section 8.

3. **profiles_admin_all self-reference PG version:** RESOLVED — see Decision 3 in Section 8.

4. **bus role:** RESOLVED — see Decision 4 in Section 8.

---

## 8. Resolution Summary

### Decision 1: profiles_self_update — BEFORE UPDATE trigger (Approach B)

The `profiles_self_update` policy is kept as-is (allowing self UPDATE).  A `BEFORE UPDATE` trigger enforces column-level immutability:

- **Function:** `public.enforce_profile_immutable_columns()`
- **Trigger:** `enforce_profile_immutable_columns_trigger` BEFORE UPDATE ON profiles FOR EACH ROW
- **Logic:** If `current_user NOT IN ('service_role', 'supabase_admin')`, any attempt to change `role` or `deleted_at` raises an exception with caller identity in the message.
- **Rationale for `current_user` check:** Supabase service-role requests connect as the `service_role` DB user. This is the canonical check inside Postgres triggers — simpler and more reliable than parsing JWT claims, consistent with Supabase's own trigger patterns.
- **SECURITY DEFINER + `SET search_path = public, pg_catalog`** added to the function to prevent search_path injection (addresses Security Advisor WARN 2.2).

### Decision 2: class_teachers prerequisite — separate patch file

Created `supabase/migrations/20260420050000_class_teachers_policies.sql` as a separate prerequisite migration. **Must be applied before Phase 1.** Adds 4 policies:

| Policy | Grantee | Notes |
|--------|---------|-------|
| `class_teachers_self_select` | Teacher (own rows) | `teacher_profile_id = auth.uid()` |
| `class_teachers_student_select` | Student | EXISTS via class_students join |
| `class_teachers_coworker_select` | Co-teacher | Self-referential; safe on PG 15+ (see file header) |
| `class_teachers_admin_all` | Admin | ALL with WITH CHECK |

Phase 1 staging checklist updated: apply `20260420050000` first.

### Decision 3: PG version — confirmed 17.6.1

Postgres version confirmed as **17.6.1** on prod. Self-referential `profiles_admin_all` policy is safe. Note added to Phase 1 migration header comment.

### Decision 4: bus role — deferred

No `students_bus_select` policy added. Bus actions exclusively use `createAdminClient()` — no `createClient()` path exists today. Deferring until Phase 4 (bus domain) if the pattern changes. `profiles_self_select` already covers bus users reading their own profile row.
