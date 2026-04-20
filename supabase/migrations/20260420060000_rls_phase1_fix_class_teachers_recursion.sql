-- =============================================================================
-- Migration: rls_phase1_fix_class_teachers_recursion
-- Purpose:   Second hotfix for RLS Phase 1. The class_teachers_coworker_select
--            policy uses EXISTS (SELECT FROM class_teachers ...) which causes
--            infinite recursion (Postgres 42P17) when any teacher JWT query
--            touches class_teachers — including the students_teacher_select and
--            teachers_coworker_select policies which join class_teachers.
--
--            Fix: introduce SECURITY DEFINER helper that returns the class_ids
--                 the current user teaches (bypasses RLS).  Rewrite the offending
--                 policies to use IN (helper) instead of self-referential EXISTS.
--
-- Rollback:
--   DROP POLICY "class_teachers_coworker_select" ON class_teachers;
--   DROP POLICY "teachers_coworker_select" ON teachers;
--   Recreate original EXISTS versions from 20260420050000_rls_phase1_fix_recursion.sql.
--   DROP FUNCTION public.current_user_teaching_class_ids();
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Helper: class IDs taught by current JWT user (SECURITY DEFINER bypasses RLS)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_teaching_class_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
STABLE
AS $$
  SELECT class_id FROM public.class_teachers WHERE teacher_profile_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.current_user_teaching_class_ids() TO authenticated;


-- ---------------------------------------------------------------------------
-- Fix class_teachers_coworker_select (self-reference on class_teachers)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "class_teachers_coworker_select" ON public.class_teachers;
CREATE POLICY "class_teachers_coworker_select"
  ON public.class_teachers
  FOR SELECT
  TO authenticated
  USING (class_id IN (SELECT public.current_user_teaching_class_ids()));


-- ---------------------------------------------------------------------------
-- Fix teachers_coworker_select (double self-join on class_teachers)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "teachers_coworker_select" ON public.teachers;
CREATE POLICY "teachers_coworker_select"
  ON public.teachers
  FOR SELECT
  TO authenticated
  USING (
    public.is_current_user_teacher()
    AND teachers.profile_id IN (
      SELECT ct.teacher_profile_id
      FROM public.class_teachers ct
      WHERE ct.class_id IN (SELECT public.current_user_teaching_class_ids())
    )
  );
