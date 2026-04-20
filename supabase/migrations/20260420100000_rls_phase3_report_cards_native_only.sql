-- =============================================================================
-- Migration: rls_phase3_report_cards_native_only
-- Purpose:   Business-rule correction for Phase 3. Report cards are written by
--            native teachers only (Korean teachers are read-only on reports).
--            Pre-Phase-3 policy (20260331045622) already enforced this — Phase 3
--            accidentally widened access to all teachers. This reverts the write
--            privilege back to native teachers.
--
-- Adds helper is_current_user_native_teacher() — STABLE SECURITY DEFINER that
-- joins teachers+profiles to check teacher_type='native'.
--
-- SELECT remains open to all teachers (Korean teachers read to review).
--
-- Rollback:
--   DROP POLICY IF EXISTS "rc_teacher_insert" ON public.report_cards;
--   DROP POLICY IF EXISTS "rc_teacher_update" ON public.report_cards;
--   DROP POLICY IF EXISTS "rc_teacher_delete" ON public.report_cards;
--   (re-run policies from 20260420090000 with public.is_current_user_teacher())
--   DROP FUNCTION public.is_current_user_native_teacher();
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_current_user_native_teacher()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER
SET search_path = public, pg_catalog STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teachers t
    JOIN public.profiles p ON p.id = t.profile_id
    WHERE t.profile_id = auth.uid()
      AND t.teacher_type = 'native'::teacher_type_enum
      AND p.deleted_at IS NULL
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_current_user_native_teacher() TO authenticated;


DROP POLICY IF EXISTS "rc_teacher_insert" ON public.report_cards;
CREATE POLICY "rc_teacher_insert" ON public.report_cards
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_current_user_native_teacher()
    AND author_id = auth.uid()
    AND student_profile_id IN (SELECT public.current_user_student_ids_for_teacher())
  );

DROP POLICY IF EXISTS "rc_teacher_update" ON public.report_cards;
CREATE POLICY "rc_teacher_update" ON public.report_cards
  FOR UPDATE TO authenticated
  USING (
    public.is_current_user_native_teacher()
    AND author_id = auth.uid()
  )
  WITH CHECK (
    public.is_current_user_native_teacher()
    AND author_id = auth.uid()
  );

DROP POLICY IF EXISTS "rc_teacher_delete" ON public.report_cards;
CREATE POLICY "rc_teacher_delete" ON public.report_cards
  FOR DELETE TO authenticated
  USING (
    public.is_current_user_native_teacher()
    AND author_id = auth.uid()
  );
