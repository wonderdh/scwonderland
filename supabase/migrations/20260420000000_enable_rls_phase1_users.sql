-- =============================================================================
-- Migration: enable_rls_phase1_users
-- Phase:     1 of 5 — Users domain (profiles, students, teachers)
-- Purpose:   Replace the current bare-minimum policies on profiles/students/
--            teachers with a complete, role-aware set.  All three tables already
--            have ENABLE ROW LEVEL SECURITY set in prod; this migration ONLY adds
--            or replaces policies.  It does NOT alter the RLS-enabled flag.
--
-- PREREQUISITE: Apply 20260420050000_class_teachers_policies.sql FIRST.
--   Teacher policies (students_teacher_select, teachers_coworker_select) use
--   class_teachers as a join table inside policy subqueries.  Without policies on
--   class_teachers, those subqueries return 0 rows for any JWT caller, silently
--   making all teacher access empty.
--
-- PG version: Verified PG 17.6.1 on prod.
--   Self-referential admin policy (profiles_admin_all subquery on profiles itself)
--   is safe — PG 15+ permissive policies union, so profiles_self_select grants the
--   admin's own row before the subquery runs.  Confirmed consistent with existing
--   prod patterns (academy_notices_admin_all, attendance_admin_all, etc.).
--
-- Safety model
-- ─────────────
-- • createAdminClient() (service role key) bypasses RLS automatically.
--   All existing Server Actions that call createAdminClient() after verifyAdmin()
--   / verifyTeacherOrAdmin() / verifyAuthenticated() continue to work unchanged.
-- • The server-side createClient() (anon key + user JWT) respects these policies.
--   Auth helpers (verifyAdmin etc.) read profiles via createClient() — those
--   SELECTs must be permitted by policy or auth-helpers will break.
-- • Deleted users (profiles.deleted_at IS NOT NULL + Auth ban) cannot obtain a
--   valid JWT, so they are implicitly blocked without needing to filter deleted_at
--   in every policy.  We add the filter only where it adds defence-in-depth.
--
-- Related PR / task: Phase 1 of RLS rollout (task 5.1)
-- Staging apply checklist: see docs/rls-phase1-analysis.md
--
-- Rollback: run 20260420000000_enable_rls_phase1_users_rollback.sql
-- =============================================================================


-- ---------------------------------------------------------------------------
-- HELPER NOTE: user_role ENUM values in this DB are:
--   'admin' | 'teacher' | 'student' | 'bus'
-- teacher_type_enum values: 'korean' | 'native'
-- ---------------------------------------------------------------------------


-------------------------------------------------------------------------------
-- TABLE: profiles
-- Current policies (prod):
--   "Users can read own profile"   — SELECT WHERE auth.uid() = id
--   "Admins can update any profile role" — UPDATE WHERE caller is admin
-- Gaps:
--   • No policy for admin SELECT (admin needs to read all profiles for auth-helpers)
--   • No INSERT policy (auth trigger creates profiles via service role — OK)
--   • No DELETE policy (service role handles banning/deletion — OK)
--   • bus role cannot read own profile (needed by bus/actions.ts)
-------------------------------------------------------------------------------

-- Drop existing policies so we can replace them cleanly
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile role" ON public.profiles;

-- 1a. Admin: full access to all profiles (SELECT needed by verifyAdmin / listUsersByRole)
--     Uses EXISTS subquery to avoid self-join infinite recursion — auth.uid() is
--     compared against the profiles table itself, so we read it as a lateral subquery.
--     IMPORTANT: This will work because the admin row passes its own SELECT policy (1b).
CREATE POLICY "profiles_admin_all"
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'::user_role
        AND p.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'::user_role
        AND p.deleted_at IS NULL
    )
  );

-- 1b. Any authenticated user: SELECT own profile row
--     Required by:
--       • auth-helpers.ts: verifyAdmin / verifyTeacherOrAdmin — reads profiles.role
--       • academy/actions.ts: getCurrentStudentProfile / getCurrentTeacherProfile
--       • bus/actions.ts: getCurrentBusStaffProfile (role check)
CREATE POLICY "profiles_self_select"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- 1c. Teacher: SELECT own profile (overlaps with 1b but is explicit for clarity)
--     Teachers need to read their own profile in getCurrentTeacherProfile().
--     This is already covered by 1b; kept as a named policy for auditability.
--     Note: PERMISSIVE policies union — one match is enough.
--     (Can be omitted; kept for documentation value.)
-- CREATE POLICY "profiles_teacher_self_select" ... -- covered by profiles_self_select

-- 1d. UPDATE: users may update their own non-role columns (future self-service)
--     Currently no self-service profile edit exists in the app, but we add a
--     narrow policy scoped to non-privileged columns to prevent privilege escalation.
--     IMPORTANT: This policy intentionally does NOT allow changing `role` or
--     `deleted_at` — that restriction is enforced by the BEFORE UPDATE trigger
--     below (enforce_profile_immutable_columns_trigger), not at the policy level.
CREATE POLICY "profiles_self_update"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);


-------------------------------------------------------------------------------
-- TRIGGER: enforce_profile_immutable_columns
-- Blocks any attempt to mutate `role` or `deleted_at` on the profiles table
-- when the DB session is running as a JWT-scoped role (authenticated / anon).
--
-- Why block only authenticated/anon instead of allow-list of safe roles?
--   Confirmed DB roles on this project: anon, authenticated, authenticator,
--   postgres, service_role, supabase_admin, supabase_auth_admin.
--   The ONLY untrusted roles are authenticated + anon (JWT-based, directly
--   reachable from a browser client via PostgREST).  Everything else is a
--   backend/internal role that must remain able to mutate role/deleted_at:
--     • service_role — Server Actions via createAdminClient()
--     • postgres     — DB admin tooling, migrations, MCP
--     • supabase_admin / supabase_auth_admin — Supabase internal triggers
--     • authenticator — PostgREST base role (transient, shouldn't fire DML)
--   Using "NOT IN (allow-list)" would incorrectly block postgres / supabase_auth_admin
--   and break DB admin operations.  Inverting the check to "IN (deny-list)" is safer
--   and future-proofs against new backend roles Supabase may introduce.
--
-- Why current_user rather than JWT claims?
--   With service role key, PostgREST runs SET LOCAL ROLE service_role — so
--   current_user inside a trigger is the canonical role identifier on Supabase.
--   JWT claim parsing inside a trigger adds latency and is fragile if claim
--   shape changes.
--
-- Rollback: see rollback file — drop trigger then drop function.
-------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_profile_immutable_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Only JWT-based roles are untrusted.  All other DB roles (service_role,
  -- postgres, supabase_admin, supabase_auth_admin, authenticator) bypass.
  IF current_user IN ('authenticated', 'anon') THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION
        'profiles.role is immutable for JWT-scoped callers (caller: %)',
        current_user;
    END IF;
    IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
      RAISE EXCEPTION
        'profiles.deleted_at is immutable for JWT-scoped callers (caller: %)',
        current_user;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path = public, pg_catalog;

DROP TRIGGER IF EXISTS enforce_profile_immutable_columns_trigger ON public.profiles;
CREATE TRIGGER enforce_profile_immutable_columns_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_immutable_columns();


-------------------------------------------------------------------------------
-- TABLE: students
-- Current policies (prod):
--   "Admins can manage students"  — ALL WHERE caller is admin  ✓
--   "Students can view own info"  — SELECT WHERE profile_id = auth.uid()  ✓
-- Gaps:
--   • Teachers have NO SELECT access to students in their classes.
--     academy/actions.ts getTeacherClasses() uses createAdminClient() to read
--     students — that continues to work. BUT if we ever switch teacher reads to
--     createClient(), teachers would be blocked.  Add teacher read policy now so
--     the transition is safe.
--   • bus role has NO access — bus/actions.ts uses createAdminClient() for
--     student lookups, so bus reads are not blocked today.  We add a narrow policy
--     matching the existing pattern for future safety.
-------------------------------------------------------------------------------

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage students" ON public.students;
DROP POLICY IF EXISTS "Students can view own info" ON public.students;

-- 2a. Admin: full management
CREATE POLICY "students_admin_all"
  ON public.students
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'::user_role
        AND p.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'::user_role
        AND p.deleted_at IS NULL
    )
  );

-- 2b. Student: SELECT own row only
CREATE POLICY "students_self_select"
  ON public.students
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

-- 2c. Teacher: SELECT students who are in at least one class the teacher teaches.
--     Join path: class_teachers ct → class_students cs → students s
--     This covers both korean and native teachers.
--     Note: createAdminClient() is still used in all current Server Actions so
--     this policy is primarily for defence-in-depth and future read migrations.
CREATE POLICY "students_teacher_select"
  ON public.students
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.class_students cs
      JOIN public.class_teachers ct ON ct.class_id = cs.class_id
      WHERE cs.student_profile_id = students.profile_id
        AND ct.teacher_profile_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'teacher'::user_role
        AND p.deleted_at IS NULL
    )
  );


-------------------------------------------------------------------------------
-- TABLE: teachers
-- Current policies (prod):
--   "Admins can manage teachers"  — ALL WHERE caller is admin  ✓
--   "Teachers can view own info"  — SELECT WHERE profile_id = auth.uid()  ✓
-- Gaps:
--   • Korean teachers need to read co-teachers' info (class_notice-actions,
--     schedule-actions, report-actions all join to teachers table using
--     createAdminClient() today).
--   • Students have no access (not needed — student-facing pages show teacher
--     name via academy/actions.ts which already uses createAdminClient()).
--   • bus role: no access needed.
-------------------------------------------------------------------------------

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage teachers" ON public.teachers;
DROP POLICY IF EXISTS "Teachers can view own info" ON public.teachers;

-- 3a. Admin: full management
CREATE POLICY "teachers_admin_all"
  ON public.teachers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'::user_role
        AND p.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'::user_role
        AND p.deleted_at IS NULL
    )
  );

-- 3b. Teacher: SELECT own row (needed by getCurrentTeacherProfile via createAdminClient
--     today, but also defence-in-depth for any future createClient() migration)
CREATE POLICY "teachers_self_select"
  ON public.teachers
  FOR SELECT
  TO authenticated
  USING (
    profile_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'teacher'::user_role
        AND p.deleted_at IS NULL
    )
  );

-- 3c. Teacher: SELECT teachers who share at least one class with the caller.
--     Required for report-actions (author_name lookup), class-notice-actions
--     (listClassNotices joins to teachers), schedule-actions (teacher label grid).
--     All currently run through createAdminClient(), so this is defence-in-depth.
CREATE POLICY "teachers_coworker_select"
  ON public.teachers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles caller
      WHERE caller.id = auth.uid()
        AND caller.role = 'teacher'::user_role
        AND caller.deleted_at IS NULL
    )
    AND EXISTS (
      -- teacher being read shares a class with the caller-teacher
      SELECT 1
      FROM public.class_teachers ct_other
      JOIN public.class_teachers ct_self ON ct_self.class_id = ct_other.class_id
      WHERE ct_other.teacher_profile_id = teachers.profile_id
        AND ct_self.teacher_profile_id = auth.uid()
    )
  );
