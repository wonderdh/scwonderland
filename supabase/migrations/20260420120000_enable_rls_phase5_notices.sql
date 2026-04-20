-- =============================================================================
-- Migration: enable_rls_phase5_notices
-- Phase 5 (final): notices domain + textbooks
-- =============================================================================
-- Purpose:
--   Fill remaining policy gaps for 10 tables:
--     notices, notice_attachments,
--     class_notices, class_notice_attachments,
--     academy_notices, academy_notice_attachments,
--     textbooks, class_textbooks,
--     student_textbook_progress,
--     weekly_sentences, weekly_sentence_config
--
-- Dependencies:
--   - Helpers: is_current_user_admin(), is_current_user_teacher()
--   - Helpers: current_user_teaching_class_ids(), current_user_enrolled_class_ids()
--   - Helpers: current_user_student_ids_for_teacher()
--   - Phase 1-4 migrations applied
--
-- Baseline state (before this migration):
--   notices                     : 2 policies (public role) — admin_all, public_read
--   notice_attachments          : 2 policies (public role) — admin_all, public_read
--   class_notices               : 5 policies — admin, teacher CRUD, student select  [COMPLETE]
--   class_notice_attachments    : 4 policies — admin, teacher insert/delete, read    [COMPLETE]
--   academy_notices             : 2 policies — admin, authenticated read             [COMPLETE]
--   academy_notice_attachments  : 2 policies — admin, published-gated read           [COMPLETE]
--   textbooks                   : 0 policies (RLS enabled — advisor WARN)
--   class_textbooks             : 1 policy  — admin_all only (missing teacher/student SELECT)
--   student_textbook_progress   : 1 policy  — admin_all only (missing teacher/student policies)
--   weekly_sentences            : 1 policy  — public read only (missing admin write)
--   weekly_sentence_config      : 1 policy  — public read only (missing admin write)
--
-- This migration adds the missing policies for the 6 tables above.
--
-- Inline rollback SQL (run manually if needed):
-- -----------------------------------------------------------------------------
-- DROP POLICY IF EXISTS "notices_authenticated_read"       ON public.notices;
-- DROP POLICY IF EXISTS "notice_attachments_authenticated_read" ON public.notice_attachments;
-- DROP POLICY IF EXISTS "textbooks_admin_all"              ON public.textbooks;
-- DROP POLICY IF EXISTS "textbooks_authenticated_read"     ON public.textbooks;
-- DROP POLICY IF EXISTS "class_textbooks_teacher_select"   ON public.class_textbooks;
-- DROP POLICY IF EXISTS "class_textbooks_student_select"   ON public.class_textbooks;
-- DROP POLICY IF EXISTS "student_textbook_progress_teacher_select"  ON public.student_textbook_progress;
-- DROP POLICY IF EXISTS "student_textbook_progress_teacher_update"  ON public.student_textbook_progress;
-- DROP POLICY IF EXISTS "student_textbook_progress_student_select"  ON public.student_textbook_progress;
-- DROP POLICY IF EXISTS "weekly_sentences_admin_all"       ON public.weekly_sentences;
-- DROP POLICY IF EXISTS "weekly_sentence_config_admin_all" ON public.weekly_sentence_config;
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. notices — add authenticated SELECT (supplements existing public read)
--    The existing notices_public_read uses role={public}, which already covers
--    anon. We add an explicit authenticated policy so RLS matrix is clean.
--    (No duplicate conflict: different policy name, scoped to authenticated role)
-- ---------------------------------------------------------------------------
CREATE POLICY "notices_authenticated_read"
  ON public.notices
  FOR SELECT
  TO authenticated
  USING (is_published = true);

-- ---------------------------------------------------------------------------
-- 2. notice_attachments — authenticated SELECT gated on published parent
-- ---------------------------------------------------------------------------
CREATE POLICY "notice_attachments_authenticated_read"
  ON public.notice_attachments
  FOR SELECT
  TO authenticated
  USING (
    notice_id IN (
      SELECT id FROM public.notices WHERE is_published = true
    )
  );

-- ---------------------------------------------------------------------------
-- 3. textbooks — ALL for admin, SELECT for all authenticated
--    (교재 정보는 반·학생 배정 조회에서 필요 — everyone authenticated reads)
-- ---------------------------------------------------------------------------
CREATE POLICY "textbooks_admin_all"
  ON public.textbooks
  FOR ALL
  TO authenticated
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());

CREATE POLICY "textbooks_authenticated_read"
  ON public.textbooks
  FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- 4. class_textbooks — teacher SELECT (own classes), student SELECT (enrolled)
--    admin_all already exists; we add the two reader policies.
-- ---------------------------------------------------------------------------
CREATE POLICY "class_textbooks_teacher_select"
  ON public.class_textbooks
  FOR SELECT
  TO authenticated
  USING (
    class_id IN (SELECT current_user_teaching_class_ids())
  );

CREATE POLICY "class_textbooks_student_select"
  ON public.class_textbooks
  FOR SELECT
  TO authenticated
  USING (
    class_id IN (SELECT current_user_enrolled_class_ids())
  );

-- ---------------------------------------------------------------------------
-- 5. student_textbook_progress
--    admin_all already exists; add teacher and student policies.
-- ---------------------------------------------------------------------------

-- Teacher: SELECT + UPDATE for students in their classes
CREATE POLICY "student_textbook_progress_teacher_select"
  ON public.student_textbook_progress
  FOR SELECT
  TO authenticated
  USING (
    student_profile_id IN (SELECT current_user_student_ids_for_teacher())
  );

CREATE POLICY "student_textbook_progress_teacher_update"
  ON public.student_textbook_progress
  FOR UPDATE
  TO authenticated
  USING (
    student_profile_id IN (SELECT current_user_student_ids_for_teacher())
  )
  WITH CHECK (
    student_profile_id IN (SELECT current_user_student_ids_for_teacher())
  );

-- Student: SELECT own rows only
CREATE POLICY "student_textbook_progress_student_select"
  ON public.student_textbook_progress
  FOR SELECT
  TO authenticated
  USING (student_profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 6. weekly_sentences — add admin write (public SELECT already exists)
-- ---------------------------------------------------------------------------
CREATE POLICY "weekly_sentences_admin_all"
  ON public.weekly_sentences
  FOR ALL
  TO authenticated
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());

-- ---------------------------------------------------------------------------
-- 7. weekly_sentence_config — add admin write (public SELECT already exists)
-- ---------------------------------------------------------------------------
CREATE POLICY "weekly_sentence_config_admin_all"
  ON public.weekly_sentence_config
  FOR ALL
  TO authenticated
  USING (is_current_user_admin())
  WITH CHECK (is_current_user_admin());
