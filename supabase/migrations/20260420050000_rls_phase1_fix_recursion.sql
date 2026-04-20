-- =============================================================================
-- Migration: rls_phase1_fix_recursion
-- Purpose:   HOTFIX for RLS Phase 1. The admin/teacher role-check EXISTS subqueries
--            on public.profiles caused infinite recursion (Postgres error 42P17)
--            because profiles_admin_all itself queries profiles — when any policy
--            on ANY table includes EXISTS (SELECT FROM profiles ...) Postgres
--            re-evaluates profiles policies, which re-evaluates profiles_admin_all,
--            which re-queries profiles → infinite loop.
--
--            Fix: replace EXISTS-on-profiles subqueries with SECURITY DEFINER
--                 helper functions that bypass RLS internally.
--
--            This is the Supabase-recommended pattern for cross-table role checks.
--
-- Applies to: profiles, students, teachers, class_teachers (all _admin_all policies
--             + students_teacher_select, teachers_self_select, teachers_coworker_select)
--
-- Rollback:
--   Re-apply 20260420000000_enable_rls_phase1_users.sql and
--            20260420050000_class_teachers_policies.sql (original versions).
--   Then: DROP FUNCTION public.is_current_user_admin();
--         DROP FUNCTION public.is_current_user_teacher();
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. SECURITY DEFINER helper functions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'::user_role
      AND deleted_at IS NULL
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;


CREATE OR REPLACE FUNCTION public.is_current_user_teacher()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'teacher'::user_role
      AND deleted_at IS NULL
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_current_user_teacher() TO authenticated;


-- ---------------------------------------------------------------------------
-- 2. Replace profiles_admin_all (the recursion trigger)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
CREATE POLICY "profiles_admin_all"
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());


-- ---------------------------------------------------------------------------
-- 3. Replace students_admin_all + students_teacher_select
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "students_admin_all" ON public.students;
CREATE POLICY "students_admin_all"
  ON public.students
  FOR ALL
  TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "students_teacher_select" ON public.students;
CREATE POLICY "students_teacher_select"
  ON public.students
  FOR SELECT
  TO authenticated
  USING (
    public.is_current_user_teacher()
    AND EXISTS (
      SELECT 1
      FROM public.class_students cs
      JOIN public.class_teachers ct ON ct.class_id = cs.class_id
      WHERE cs.student_profile_id = students.profile_id
        AND ct.teacher_profile_id = auth.uid()
    )
  );


-- ---------------------------------------------------------------------------
-- 4. Replace teachers_admin_all + teachers_self_select + teachers_coworker_select
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "teachers_admin_all" ON public.teachers;
CREATE POLICY "teachers_admin_all"
  ON public.teachers
  FOR ALL
  TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS "teachers_self_select" ON public.teachers;
CREATE POLICY "teachers_self_select"
  ON public.teachers
  FOR SELECT
  TO authenticated
  USING (
    profile_id = auth.uid()
    AND public.is_current_user_teacher()
  );

DROP POLICY IF EXISTS "teachers_coworker_select" ON public.teachers;
CREATE POLICY "teachers_coworker_select"
  ON public.teachers
  FOR SELECT
  TO authenticated
  USING (
    public.is_current_user_teacher()
    AND EXISTS (
      SELECT 1
      FROM public.class_teachers ct_other
      JOIN public.class_teachers ct_self ON ct_self.class_id = ct_other.class_id
      WHERE ct_other.teacher_profile_id = teachers.profile_id
        AND ct_self.teacher_profile_id = auth.uid()
    )
  );


-- ---------------------------------------------------------------------------
-- 5. Replace class_teachers_admin_all
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "class_teachers_admin_all" ON public.class_teachers;
CREATE POLICY "class_teachers_admin_all"
  ON public.class_teachers
  FOR ALL
  TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());
