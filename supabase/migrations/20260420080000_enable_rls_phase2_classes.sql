-- =============================================================================
-- Migration: enable_rls_phase2_classes
-- Purpose  : RLS Phase 2 — classes domain
--            Tables: classes, class_students, class_schedules
-- Depends  : Phase 1 helpers (is_current_user_admin, is_current_user_teacher,
--            current_user_teaching_class_ids) from prior migrations
-- Applied  : 2026-04-20
-- =============================================================================
--
-- ROLLBACK BLOCK (apply this if simulation fails post-apply):
-- ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
-- -- Drop new helper
-- DROP FUNCTION IF EXISTS public.current_user_enrolled_class_ids();
--
-- -- Drop new policies
-- DROP POLICY IF EXISTS "classes_admin_all"           ON public.classes;
-- DROP POLICY IF EXISTS "classes_teacher_select"      ON public.classes;
-- DROP POLICY IF EXISTS "classes_student_select"      ON public.classes;
-- DROP POLICY IF EXISTS "class_students_admin_all"    ON public.class_students;
-- DROP POLICY IF EXISTS "class_students_teacher_select" ON public.class_students;
-- DROP POLICY IF EXISTS "class_students_student_select" ON public.class_students;
-- DROP POLICY IF EXISTS "class_schedules_admin_all"       ON public.class_schedules;
-- DROP POLICY IF EXISTS "class_schedules_teacher_select"  ON public.class_schedules;
-- DROP POLICY IF EXISTS "class_schedules_student_select"  ON public.class_schedules;
--
-- -- Restore original policies
-- CREATE POLICY "classes_admin_all" ON public.classes FOR ALL TO authenticated
--   USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'::user_role))
--   WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'::user_role));
--
-- CREATE POLICY "class_students_admin_all" ON public.class_students FOR ALL TO authenticated
--   USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'::user_role))
--   WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'::user_role));
--
-- CREATE POLICY "class_schedules_admin_all" ON public.class_schedules FOR ALL TO public
--   USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'::user_role));
--
-- CREATE POLICY "class_schedules_auth_read" ON public.class_schedules FOR SELECT TO public
--   USING (auth.uid() IS NOT NULL);
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Helper: current_user_enrolled_class_ids
--    SECURITY DEFINER — bypasses RLS on class_students to avoid recursion.
--    Returns class_ids the current authenticated student is enrolled in.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_enrolled_class_ids()
RETURNS SETOF UUID LANGUAGE sql SECURITY DEFINER
SET search_path = public, pg_catalog STABLE
AS $$
  SELECT class_id FROM public.class_students WHERE student_profile_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.current_user_enrolled_class_ids() TO authenticated;

-- -----------------------------------------------------------------------------
-- 1. classes
--    DROP existing policies (old pattern uses EXISTS on profiles — unsafe)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "classes_admin_all"      ON public.classes;
DROP POLICY IF EXISTS "classes_teacher_select" ON public.classes;
DROP POLICY IF EXISTS "classes_student_select" ON public.classes;

-- Admin: full access
CREATE POLICY "classes_admin_all"
  ON public.classes
  FOR ALL
  TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

-- Teacher: SELECT classes they teach
CREATE POLICY "classes_teacher_select"
  ON public.classes
  FOR SELECT
  TO authenticated
  USING (
    public.is_current_user_teacher()
    AND id IN (SELECT public.current_user_teaching_class_ids())
  );

-- Student: SELECT classes they're enrolled in
CREATE POLICY "classes_student_select"
  ON public.classes
  FOR SELECT
  TO authenticated
  USING (id IN (SELECT public.current_user_enrolled_class_ids()));

-- -----------------------------------------------------------------------------
-- 2. class_students
--    DROP existing policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "class_students_admin_all"      ON public.class_students;
DROP POLICY IF EXISTS "class_students_teacher_select" ON public.class_students;
DROP POLICY IF EXISTS "class_students_student_select" ON public.class_students;

-- Admin: full access
CREATE POLICY "class_students_admin_all"
  ON public.class_students
  FOR ALL
  TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

-- Teacher: SELECT students in classes they teach
CREATE POLICY "class_students_teacher_select"
  ON public.class_students
  FOR SELECT
  TO authenticated
  USING (
    public.is_current_user_teacher()
    AND class_id IN (SELECT public.current_user_teaching_class_ids())
  );

-- Student: SELECT their own enrollment row only
CREATE POLICY "class_students_student_select"
  ON public.class_students
  FOR SELECT
  TO authenticated
  USING (student_profile_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 3. class_schedules
--    DROP existing policies (including the overly-broad auth_read)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "class_schedules_admin_all"      ON public.class_schedules;
DROP POLICY IF EXISTS "class_schedules_auth_read"      ON public.class_schedules;
DROP POLICY IF EXISTS "class_schedules_teacher_select" ON public.class_schedules;
DROP POLICY IF EXISTS "class_schedules_student_select" ON public.class_schedules;

-- Admin: full access
CREATE POLICY "class_schedules_admin_all"
  ON public.class_schedules
  FOR ALL
  TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

-- Teacher: SELECT schedules where they are assigned OR in classes they teach
CREATE POLICY "class_schedules_teacher_select"
  ON public.class_schedules
  FOR SELECT
  TO authenticated
  USING (
    public.is_current_user_teacher()
    AND (
      teacher_profile_id = auth.uid()
      OR class_id IN (SELECT public.current_user_teaching_class_ids())
    )
  );

-- Student: SELECT schedules for their classes OR personal schedules assigned to them
CREATE POLICY "class_schedules_student_select"
  ON public.class_schedules
  FOR SELECT
  TO authenticated
  USING (
    student_profile_id = auth.uid()
    OR class_id IN (SELECT public.current_user_enrolled_class_ids())
  );
