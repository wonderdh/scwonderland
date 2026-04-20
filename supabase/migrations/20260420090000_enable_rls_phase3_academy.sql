-- =============================================================================
-- Migration: 20260420090000_enable_rls_phase3_academy.sql
-- Purpose  : RLS Phase 3 — academy domain (6 tables)
--            report_cards, homework_assignments, homework_submissions,
--            homework_submission_files, learning_records, attendance
-- Depends  : Phase 1/2 helpers already on prod:
--              is_current_user_admin()
--              is_current_user_teacher()
--              current_user_teaching_class_ids()
--              current_user_enrolled_class_ids()
-- Adds     : current_user_student_ids_for_teacher()  (new SECURITY DEFINER helper)
--            enforce_report_card_student_columns_fn() trigger function + trigger
-- =============================================================================
--
-- ROLLBACK (run this block to undo):
-- ----------------------------------------------------------------------------
-- BEGIN;
-- DROP TRIGGER IF EXISTS enforce_report_card_student_columns ON public.report_cards;
-- DROP FUNCTION IF EXISTS public.enforce_report_card_student_columns_fn();
-- DROP FUNCTION IF EXISTS public.current_user_student_ids_for_teacher();
--
-- DROP POLICY IF EXISTS rc_admin_all       ON public.report_cards;
-- DROP POLICY IF EXISTS rc_teacher_select  ON public.report_cards;
-- DROP POLICY IF EXISTS rc_teacher_insert  ON public.report_cards;
-- DROP POLICY IF EXISTS rc_teacher_update  ON public.report_cards;
-- DROP POLICY IF EXISTS rc_teacher_delete  ON public.report_cards;
-- DROP POLICY IF EXISTS rc_student_select  ON public.report_cards;
-- DROP POLICY IF EXISTS rc_student_update  ON public.report_cards;
--
-- DROP POLICY IF EXISTS ha_admin_all       ON public.homework_assignments;
-- DROP POLICY IF EXISTS ha_teacher_all     ON public.homework_assignments;
-- DROP POLICY IF EXISTS ha_student_select  ON public.homework_assignments;
--
-- DROP POLICY IF EXISTS hs_admin_all       ON public.homework_submissions;
-- DROP POLICY IF EXISTS hs_teacher_select  ON public.homework_submissions;
-- DROP POLICY IF EXISTS hs_teacher_update  ON public.homework_submissions;
-- DROP POLICY IF EXISTS hs_student_select  ON public.homework_submissions;
-- DROP POLICY IF EXISTS hs_student_insert  ON public.homework_submissions;
-- DROP POLICY IF EXISTS hs_student_update  ON public.homework_submissions;
--
-- DROP POLICY IF EXISTS hsf_admin_all      ON public.homework_submission_files;
-- DROP POLICY IF EXISTS hsf_teacher_select ON public.homework_submission_files;
-- DROP POLICY IF EXISTS hsf_student_select ON public.homework_submission_files;
-- DROP POLICY IF EXISTS hsf_student_insert ON public.homework_submission_files;
-- DROP POLICY IF EXISTS hsf_student_delete ON public.homework_submission_files;
--
-- DROP POLICY IF EXISTS lr_admin_all       ON public.learning_records;
-- DROP POLICY IF EXISTS lr_teacher_select  ON public.learning_records;
-- DROP POLICY IF EXISTS lr_teacher_insert  ON public.learning_records;
-- DROP POLICY IF EXISTS lr_teacher_update  ON public.learning_records;
-- DROP POLICY IF EXISTS lr_teacher_delete  ON public.learning_records;
-- DROP POLICY IF EXISTS lr_student_select  ON public.learning_records;
--
-- DROP POLICY IF EXISTS att_admin_all      ON public.attendance;
-- DROP POLICY IF EXISTS att_teacher_select ON public.attendance;
-- DROP POLICY IF EXISTS att_teacher_insert ON public.attendance;
-- DROP POLICY IF EXISTS att_teacher_update ON public.attendance;
-- DROP POLICY IF EXISTS att_teacher_delete ON public.attendance;
-- DROP POLICY IF EXISTS att_student_select ON public.attendance;
-- COMMIT;
-- ----------------------------------------------------------------------------

BEGIN;

-- =============================================================================
-- NEW HELPER: current_user_student_ids_for_teacher()
-- Returns UUIDs of students enrolled in any class the current user teaches.
-- SECURITY DEFINER prevents recursion in RLS quals.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.current_user_student_ids_for_teacher()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT DISTINCT cs.student_profile_id
  FROM public.class_students cs
  WHERE cs.class_id IN (SELECT public.current_user_teaching_class_ids());
$$;

-- =============================================================================
-- TRIGGER FUNCTION: enforce_report_card_student_columns_fn()
-- Students (JWT-scoped) may only update reply / reply_en.
-- Pattern mirrors enforce_profile_immutable_columns.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.enforce_report_card_student_columns_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- Only restrict JWT-based roles (authenticated/anon).
  -- service_role, postgres, supabase_admin bypass this check.
  IF current_user IN ('authenticated', 'anon') THEN
    IF NEW.student_profile_id IS DISTINCT FROM OLD.student_profile_id THEN
      RAISE EXCEPTION 'report_cards.student_profile_id is immutable for JWT-scoped callers';
    END IF;
    IF NEW.author_id IS DISTINCT FROM OLD.author_id THEN
      RAISE EXCEPTION 'report_cards.author_id is immutable for JWT-scoped callers';
    END IF;
    IF NEW.year IS DISTINCT FROM OLD.year THEN
      RAISE EXCEPTION 'report_cards.year is immutable for JWT-scoped callers';
    END IF;
    IF NEW.month IS DISTINCT FROM OLD.month THEN
      RAISE EXCEPTION 'report_cards.month is immutable for JWT-scoped callers';
    END IF;
    IF NEW.content IS DISTINCT FROM OLD.content THEN
      RAISE EXCEPTION 'report_cards.content may not be changed by JWT-scoped callers';
    END IF;
    IF NEW.content_ko IS DISTINCT FROM OLD.content_ko THEN
      RAISE EXCEPTION 'report_cards.content_ko may not be changed by JWT-scoped callers';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger (idempotent)
DROP TRIGGER IF EXISTS enforce_report_card_student_columns ON public.report_cards;
CREATE TRIGGER enforce_report_card_student_columns
  BEFORE UPDATE ON public.report_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_report_card_student_columns_fn();

-- =============================================================================
-- report_cards — drop ALL existing policies then rebuild with helpers
-- =============================================================================
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'report_cards'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.report_cards', pol.policyname);
  END LOOP;
END;
$$;

CREATE POLICY rc_admin_all ON public.report_cards
  FOR ALL
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

-- Teacher sees: own authored rows + students in their classes
CREATE POLICY rc_teacher_select ON public.report_cards
  FOR SELECT
  USING (
    public.is_current_user_teacher()
    AND (
      author_id = auth.uid()
      OR student_profile_id IN (SELECT public.current_user_student_ids_for_teacher())
    )
  );

CREATE POLICY rc_teacher_insert ON public.report_cards
  FOR INSERT
  WITH CHECK (
    public.is_current_user_teacher()
    AND author_id = auth.uid()
    AND student_profile_id IN (SELECT public.current_user_student_ids_for_teacher())
  );

CREATE POLICY rc_teacher_update ON public.report_cards
  FOR UPDATE
  USING (
    public.is_current_user_teacher()
    AND author_id = auth.uid()
    AND student_profile_id IN (SELECT public.current_user_student_ids_for_teacher())
  )
  WITH CHECK (
    public.is_current_user_teacher()
    AND author_id = auth.uid()
    AND student_profile_id IN (SELECT public.current_user_student_ids_for_teacher())
  );

CREATE POLICY rc_teacher_delete ON public.report_cards
  FOR DELETE
  USING (
    public.is_current_user_teacher()
    AND author_id = auth.uid()
  );

CREATE POLICY rc_student_select ON public.report_cards
  FOR SELECT
  USING (student_profile_id = auth.uid());

-- Trigger enforces column-level restrictions; policy only guards row ownership
CREATE POLICY rc_student_update ON public.report_cards
  FOR UPDATE
  USING (student_profile_id = auth.uid())
  WITH CHECK (student_profile_id = auth.uid());

-- =============================================================================
-- homework_assignments
-- =============================================================================
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'homework_assignments'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.homework_assignments', pol.policyname);
  END LOOP;
END;
$$;

CREATE POLICY ha_admin_all ON public.homework_assignments
  FOR ALL
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

CREATE POLICY ha_teacher_all ON public.homework_assignments
  FOR ALL
  USING (
    public.is_current_user_teacher()
    AND (
      teacher_id = auth.uid()
      OR class_id IN (SELECT public.current_user_teaching_class_ids())
    )
  )
  WITH CHECK (
    public.is_current_user_teacher()
    AND (
      teacher_id = auth.uid()
      OR class_id IN (SELECT public.current_user_teaching_class_ids())
    )
  );

CREATE POLICY ha_student_select ON public.homework_assignments
  FOR SELECT
  USING (class_id IN (SELECT public.current_user_enrolled_class_ids()));

-- =============================================================================
-- homework_submissions
-- =============================================================================
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'homework_submissions'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.homework_submissions', pol.policyname);
  END LOOP;
END;
$$;

CREATE POLICY hs_admin_all ON public.homework_submissions
  FOR ALL
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

CREATE POLICY hs_teacher_select ON public.homework_submissions
  FOR SELECT
  USING (
    public.is_current_user_teacher()
    AND assignment_id IN (
      SELECT id FROM public.homework_assignments
      WHERE class_id IN (SELECT public.current_user_teaching_class_ids())
    )
  );

CREATE POLICY hs_teacher_update ON public.homework_submissions
  FOR UPDATE
  USING (
    public.is_current_user_teacher()
    AND assignment_id IN (
      SELECT id FROM public.homework_assignments
      WHERE class_id IN (SELECT public.current_user_teaching_class_ids())
    )
  )
  WITH CHECK (
    public.is_current_user_teacher()
    AND assignment_id IN (
      SELECT id FROM public.homework_assignments
      WHERE class_id IN (SELECT public.current_user_teaching_class_ids())
    )
  );

CREATE POLICY hs_student_select ON public.homework_submissions
  FOR SELECT
  USING (student_profile_id = auth.uid());

CREATE POLICY hs_student_insert ON public.homework_submissions
  FOR INSERT
  WITH CHECK (student_profile_id = auth.uid());

CREATE POLICY hs_student_update ON public.homework_submissions
  FOR UPDATE
  USING (student_profile_id = auth.uid())
  WITH CHECK (student_profile_id = auth.uid());

-- =============================================================================
-- homework_submission_files
-- =============================================================================
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'homework_submission_files'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.homework_submission_files', pol.policyname);
  END LOOP;
END;
$$;

CREATE POLICY hsf_admin_all ON public.homework_submission_files
  FOR ALL
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

CREATE POLICY hsf_teacher_select ON public.homework_submission_files
  FOR SELECT
  USING (
    public.is_current_user_teacher()
    AND submission_id IN (
      SELECT hs.id FROM public.homework_submissions hs
      WHERE hs.assignment_id IN (
        SELECT id FROM public.homework_assignments
        WHERE class_id IN (SELECT public.current_user_teaching_class_ids())
      )
    )
  );

CREATE POLICY hsf_student_select ON public.homework_submission_files
  FOR SELECT
  USING (
    submission_id IN (
      SELECT id FROM public.homework_submissions
      WHERE student_profile_id = auth.uid()
    )
  );

CREATE POLICY hsf_student_insert ON public.homework_submission_files
  FOR INSERT
  WITH CHECK (
    submission_id IN (
      SELECT id FROM public.homework_submissions
      WHERE student_profile_id = auth.uid()
    )
  );

CREATE POLICY hsf_student_delete ON public.homework_submission_files
  FOR DELETE
  USING (
    submission_id IN (
      SELECT id FROM public.homework_submissions
      WHERE student_profile_id = auth.uid()
    )
  );

-- =============================================================================
-- learning_records
-- (previously only had admin policy — teacher/student policies were missing)
-- =============================================================================
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'learning_records'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.learning_records', pol.policyname);
  END LOOP;
END;
$$;

CREATE POLICY lr_admin_all ON public.learning_records
  FOR ALL
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

CREATE POLICY lr_teacher_select ON public.learning_records
  FOR SELECT
  USING (
    public.is_current_user_teacher()
    AND student_profile_id IN (SELECT public.current_user_student_ids_for_teacher())
  );

CREATE POLICY lr_teacher_insert ON public.learning_records
  FOR INSERT
  WITH CHECK (
    public.is_current_user_teacher()
    AND student_profile_id IN (SELECT public.current_user_student_ids_for_teacher())
  );

CREATE POLICY lr_teacher_update ON public.learning_records
  FOR UPDATE
  USING (
    public.is_current_user_teacher()
    AND student_profile_id IN (SELECT public.current_user_student_ids_for_teacher())
  )
  WITH CHECK (
    public.is_current_user_teacher()
    AND student_profile_id IN (SELECT public.current_user_student_ids_for_teacher())
  );

CREATE POLICY lr_teacher_delete ON public.learning_records
  FOR DELETE
  USING (
    public.is_current_user_teacher()
    AND student_profile_id IN (SELECT public.current_user_student_ids_for_teacher())
  );

CREATE POLICY lr_student_select ON public.learning_records
  FOR SELECT
  USING (student_profile_id = auth.uid());

-- =============================================================================
-- attendance
-- (replaces EXISTS JOIN subqueries with helper-based IN patterns)
-- =============================================================================
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'attendance'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.attendance', pol.policyname);
  END LOOP;
END;
$$;

CREATE POLICY att_admin_all ON public.attendance
  FOR ALL
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

CREATE POLICY att_teacher_select ON public.attendance
  FOR SELECT
  USING (
    public.is_current_user_teacher()
    AND student_profile_id IN (SELECT public.current_user_student_ids_for_teacher())
  );

CREATE POLICY att_teacher_insert ON public.attendance
  FOR INSERT
  WITH CHECK (
    public.is_current_user_teacher()
    AND student_profile_id IN (SELECT public.current_user_student_ids_for_teacher())
  );

CREATE POLICY att_teacher_update ON public.attendance
  FOR UPDATE
  USING (
    public.is_current_user_teacher()
    AND student_profile_id IN (SELECT public.current_user_student_ids_for_teacher())
  )
  WITH CHECK (
    public.is_current_user_teacher()
    AND student_profile_id IN (SELECT public.current_user_student_ids_for_teacher())
  );

CREATE POLICY att_teacher_delete ON public.attendance
  FOR DELETE
  USING (
    public.is_current_user_teacher()
    AND student_profile_id IN (SELECT public.current_user_student_ids_for_teacher())
  );

CREATE POLICY att_student_select ON public.attendance
  FOR SELECT
  USING (student_profile_id = auth.uid());

COMMIT;
