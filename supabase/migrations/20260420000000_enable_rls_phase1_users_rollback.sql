-- =============================================================================
-- Rollback: enable_rls_phase1_users
-- Reverts: 20260420000000_enable_rls_phase1_users.sql
-- Purpose: Remove Phase 1 policies and restore the original sparse set that
--          was in prod before the migration.  RLS remains ENABLED on all three
--          tables (it was already enabled before Phase 1).
--
-- Run order: execute this script, then verify app behaviour before declaring
--            the rollback complete.
-- =============================================================================

-------------------------------------------------------------------------------
-- profiles — drop Phase 1 policies and trigger
-------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS enforce_profile_immutable_columns_trigger ON public.profiles;
DROP FUNCTION IF EXISTS public.enforce_profile_immutable_columns();

DROP POLICY IF EXISTS "profiles_admin_all"       ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_select"     ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_update"     ON public.profiles;

-- Restore original prod policies
CREATE POLICY "Users can read own profile"
  ON public.profiles
  FOR SELECT
  TO public
  USING (auth.uid() = id);

CREATE POLICY "Admins can update any profile role"
  ON public.profiles
  FOR UPDATE
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'::user_role
    )
  );

-------------------------------------------------------------------------------
-- students — drop Phase 1 policies
-------------------------------------------------------------------------------
DROP POLICY IF EXISTS "students_admin_all"       ON public.students;
DROP POLICY IF EXISTS "students_self_select"     ON public.students;
DROP POLICY IF EXISTS "students_teacher_select"  ON public.students;

-- Restore original prod policies
CREATE POLICY "Admins can manage students"
  ON public.students
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'::user_role
    )
  );

CREATE POLICY "Students can view own info"
  ON public.students
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

-------------------------------------------------------------------------------
-- teachers — drop Phase 1 policies
-------------------------------------------------------------------------------
DROP POLICY IF EXISTS "teachers_admin_all"        ON public.teachers;
DROP POLICY IF EXISTS "teachers_self_select"      ON public.teachers;
DROP POLICY IF EXISTS "teachers_coworker_select"  ON public.teachers;

-- Restore original prod policies
CREATE POLICY "Admins can manage teachers"
  ON public.teachers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'::user_role
    )
  );

CREATE POLICY "Teachers can view own info"
  ON public.teachers
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());
