-- =============================================================================
-- Migration: enable_rls_phase4_bus
-- Phase:     4 of 5 — Bus domain (10 tables) + afterschool_enrollments
-- Purpose:   Complete RLS policy coverage for all bus operations.
--            Resolves advisor rls_enabled_no_policy on bus_stop_day_assignments
--            and afterschool_enrollments.  Closes 2 major holes:
--              • bus_check_records had "SELECT true" — anyone authenticated
--                could read all 43 check-in records.
--              • bus_staff had "SELECT true" — same broad leak.
--
-- Dependencies: Phase 1-3 helpers (is_current_user_admin/teacher,
--               current_user_teaching_class_ids, current_user_student_ids_for_teacher)
--
-- New helpers: is_current_user_bus_staff(), current_user_bus_number_ids()
--
-- Rollback (undo this migration):
--   DROP POLICY IF EXISTS "bn_admin_all"            ON public.bus_numbers;
--   DROP POLICY IF EXISTS "bn_auth_read"            ON public.bus_numbers;
--   DROP POLICY IF EXISTS "bts_admin_all"           ON public.bus_time_slots;
--   DROP POLICY IF EXISTS "bts_auth_read"           ON public.bus_time_slots;
--   DROP POLICY IF EXISTS "bstops_admin_all"        ON public.bus_stops;
--   DROP POLICY IF EXISTS "bstops_auth_read"        ON public.bus_stops;
--   DROP POLICY IF EXISTS "bsda_admin_all"          ON public.bus_stop_day_assignments;
--   DROP POLICY IF EXISTS "bsda_bus_staff_read"     ON public.bus_stop_day_assignments;
--   DROP POLICY IF EXISTS "bsda_teacher_read"       ON public.bus_stop_day_assignments;
--   DROP POLICY IF EXISTS "bsda_student_read"       ON public.bus_stop_day_assignments;
--   DROP POLICY IF EXISTS "bss_admin_all"           ON public.bus_stop_schedules;
--   DROP POLICY IF EXISTS "bss_bus_staff_read"      ON public.bus_stop_schedules;
--   DROP POLICY IF EXISTS "bss_teacher_read"        ON public.bus_stop_schedules;
--   DROP POLICY IF EXISTS "bss_student_read"        ON public.bus_stop_schedules;
--   DROP POLICY IF EXISTS "bstaff_admin_all"        ON public.bus_staff;
--   DROP POLICY IF EXISTS "bstaff_self_read"        ON public.bus_staff;
--   DROP POLICY IF EXISTS "bcr_admin_all"           ON public.bus_check_records;
--   DROP POLICY IF EXISTS "bcr_bus_staff_all"       ON public.bus_check_records;
--   DROP POLICY IF EXISTS "bcr_teacher_read"        ON public.bus_check_records;
--   DROP POLICY IF EXISTS "bcr_student_read"        ON public.bus_check_records;
--   DROP POLICY IF EXISTS "sbd_admin_all"           ON public.student_bus_defaults;
--   DROP POLICY IF EXISTS "sbd_teacher_read"        ON public.student_bus_defaults;
--   DROP POLICY IF EXISTS "sbd_self_read"           ON public.student_bus_defaults;
--   DROP POLICY IF EXISTS "bcreq_admin_all"         ON public.bus_change_requests;
--   DROP POLICY IF EXISTS "bcreq_self_read"         ON public.bus_change_requests;
--   DROP POLICY IF EXISTS "bcreq_self_insert"       ON public.bus_change_requests;
--   DROP POLICY IF EXISTS "bcreq_student_update_pending" ON public.bus_change_requests;
--   DROP POLICY IF EXISTS "bcreq_student_delete"    ON public.bus_change_requests;
--   DROP POLICY IF EXISTS "bcreq_teacher_read"      ON public.bus_change_requests;
--   DROP POLICY IF EXISTS "ae_admin_all"            ON public.afterschool_enrollments;
--   DROP POLICY IF EXISTS "ae_teacher_read"         ON public.afterschool_enrollments;
--   DROP POLICY IF EXISTS "ae_student_read"         ON public.afterschool_enrollments;
--   DROP FUNCTION IF EXISTS public.is_current_user_bus_staff();
--   DROP FUNCTION IF EXISTS public.current_user_bus_number_ids();
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_current_user_bus_staff()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER
SET search_path = public, pg_catalog STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.bus_staff WHERE profile_id = auth.uid());
$$;
GRANT EXECUTE ON FUNCTION public.is_current_user_bus_staff() TO authenticated;

CREATE OR REPLACE FUNCTION public.current_user_bus_number_ids()
RETURNS SETOF UUID LANGUAGE sql SECURITY DEFINER
SET search_path = public, pg_catalog STABLE
AS $$
  SELECT bus_number_id FROM public.bus_staff WHERE profile_id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.current_user_bus_number_ids() TO authenticated;


-- ---------------------------------------------------------------------------
-- bus_numbers (master)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "bn_admin_all" ON public.bus_numbers;
DROP POLICY IF EXISTS "bn_auth_read" ON public.bus_numbers;
CREATE POLICY "bn_admin_all" ON public.bus_numbers FOR ALL TO authenticated
  USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());
CREATE POLICY "bn_auth_read" ON public.bus_numbers FOR SELECT TO authenticated
  USING (true);


-- ---------------------------------------------------------------------------
-- bus_time_slots (master)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "bts_admin_all" ON public.bus_time_slots;
DROP POLICY IF EXISTS "bts_auth_read" ON public.bus_time_slots;
CREATE POLICY "bts_admin_all" ON public.bus_time_slots FOR ALL TO authenticated
  USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());
CREATE POLICY "bts_auth_read" ON public.bus_time_slots FOR SELECT TO authenticated
  USING (true);


-- ---------------------------------------------------------------------------
-- bus_stops (master)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "bstops_admin_all" ON public.bus_stops;
DROP POLICY IF EXISTS "bstops_auth_read" ON public.bus_stops;
CREATE POLICY "bstops_admin_all" ON public.bus_stops FOR ALL TO authenticated
  USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());
CREATE POLICY "bstops_auth_read" ON public.bus_stops FOR SELECT TO authenticated
  USING (true);


-- ---------------------------------------------------------------------------
-- bus_stop_day_assignments (previously zero policies)
-- ---------------------------------------------------------------------------
CREATE POLICY "bsda_admin_all" ON public.bus_stop_day_assignments FOR ALL TO authenticated
  USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());
CREATE POLICY "bsda_bus_staff_read" ON public.bus_stop_day_assignments FOR SELECT TO authenticated
  USING (bus_number_id IN (SELECT public.current_user_bus_number_ids()));
CREATE POLICY "bsda_teacher_read" ON public.bus_stop_day_assignments FOR SELECT TO authenticated
  USING (public.is_current_user_teacher());
CREATE POLICY "bsda_student_read" ON public.bus_stop_day_assignments FOR SELECT TO authenticated
  USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'student'::user_role));


-- ---------------------------------------------------------------------------
-- bus_stop_schedules
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "bss_admin_all" ON public.bus_stop_schedules;
DROP POLICY IF EXISTS "bss_bus_staff_read" ON public.bus_stop_schedules;
DROP POLICY IF EXISTS "bss_teacher_read" ON public.bus_stop_schedules;
DROP POLICY IF EXISTS "bss_student_read" ON public.bus_stop_schedules;
CREATE POLICY "bss_admin_all" ON public.bus_stop_schedules FOR ALL TO authenticated
  USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());
CREATE POLICY "bss_bus_staff_read" ON public.bus_stop_schedules FOR SELECT TO authenticated
  USING (bus_stop_id IN (
    SELECT DISTINCT bsda.bus_stop_id FROM public.bus_stop_day_assignments bsda
    WHERE bsda.bus_number_id IN (SELECT public.current_user_bus_number_ids())
  ));
CREATE POLICY "bss_teacher_read" ON public.bus_stop_schedules FOR SELECT TO authenticated
  USING (public.is_current_user_teacher());
CREATE POLICY "bss_student_read" ON public.bus_stop_schedules FOR SELECT TO authenticated
  USING (auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'student'::user_role));


-- ---------------------------------------------------------------------------
-- bus_staff (was SELECT true)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "bstaff_admin_all" ON public.bus_staff;
DROP POLICY IF EXISTS "bstaff_self_read" ON public.bus_staff;
CREATE POLICY "bstaff_admin_all" ON public.bus_staff FOR ALL TO authenticated
  USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());
CREATE POLICY "bstaff_self_read" ON public.bus_staff FOR SELECT TO authenticated
  USING (profile_id = auth.uid());


-- ---------------------------------------------------------------------------
-- bus_check_records (was SELECT true — major leak)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "bcr_admin_all" ON public.bus_check_records;
DROP POLICY IF EXISTS "bcr_bus_staff_all" ON public.bus_check_records;
DROP POLICY IF EXISTS "bcr_teacher_read" ON public.bus_check_records;
DROP POLICY IF EXISTS "bcr_student_read" ON public.bus_check_records;
CREATE POLICY "bcr_admin_all" ON public.bus_check_records FOR ALL TO authenticated
  USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());
CREATE POLICY "bcr_bus_staff_all" ON public.bus_check_records FOR ALL TO authenticated
  USING (bus_number_id IN (SELECT public.current_user_bus_number_ids()))
  WITH CHECK (bus_number_id IN (SELECT public.current_user_bus_number_ids()));
CREATE POLICY "bcr_teacher_read" ON public.bus_check_records FOR SELECT TO authenticated
  USING (student_profile_id IN (SELECT public.current_user_student_ids_for_teacher()));
CREATE POLICY "bcr_student_read" ON public.bus_check_records FOR SELECT TO authenticated
  USING (student_profile_id = auth.uid());


-- ---------------------------------------------------------------------------
-- student_bus_defaults
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "sbd_admin_all" ON public.student_bus_defaults;
DROP POLICY IF EXISTS "sbd_teacher_read" ON public.student_bus_defaults;
DROP POLICY IF EXISTS "sbd_self_read" ON public.student_bus_defaults;
CREATE POLICY "sbd_admin_all" ON public.student_bus_defaults FOR ALL TO authenticated
  USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());
CREATE POLICY "sbd_teacher_read" ON public.student_bus_defaults FOR SELECT TO authenticated
  USING (student_profile_id IN (SELECT public.current_user_student_ids_for_teacher()));
CREATE POLICY "sbd_self_read" ON public.student_bus_defaults FOR SELECT TO authenticated
  USING (student_profile_id = auth.uid());


-- ---------------------------------------------------------------------------
-- bus_change_requests (narrowed — teacher update removed, student pending-only)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "bcreq_admin_all" ON public.bus_change_requests;
DROP POLICY IF EXISTS "bcreq_self_read" ON public.bus_change_requests;
DROP POLICY IF EXISTS "bcreq_self_insert" ON public.bus_change_requests;
DROP POLICY IF EXISTS "bcreq_student_update_pending" ON public.bus_change_requests;
DROP POLICY IF EXISTS "bcreq_student_delete" ON public.bus_change_requests;
DROP POLICY IF EXISTS "bcreq_teacher_read" ON public.bus_change_requests;
CREATE POLICY "bcreq_admin_all" ON public.bus_change_requests FOR ALL TO authenticated
  USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());
CREATE POLICY "bcreq_self_read" ON public.bus_change_requests FOR SELECT TO authenticated
  USING (student_profile_id = auth.uid());
CREATE POLICY "bcreq_self_insert" ON public.bus_change_requests FOR INSERT TO authenticated
  WITH CHECK (student_profile_id = auth.uid());
CREATE POLICY "bcreq_student_update_pending" ON public.bus_change_requests FOR UPDATE TO authenticated
  USING (student_profile_id = auth.uid() AND status = 'pending'::text)
  WITH CHECK (student_profile_id = auth.uid());
CREATE POLICY "bcreq_student_delete" ON public.bus_change_requests FOR DELETE TO authenticated
  USING (student_profile_id = auth.uid());
CREATE POLICY "bcreq_teacher_read" ON public.bus_change_requests FOR SELECT TO authenticated
  USING (public.is_current_user_teacher());


-- ---------------------------------------------------------------------------
-- afterschool_enrollments (previously zero policies)
-- ---------------------------------------------------------------------------
CREATE POLICY "ae_admin_all" ON public.afterschool_enrollments FOR ALL TO authenticated
  USING (public.is_current_user_admin()) WITH CHECK (public.is_current_user_admin());
CREATE POLICY "ae_teacher_read" ON public.afterschool_enrollments FOR SELECT TO authenticated
  USING (class_id IN (SELECT public.current_user_teaching_class_ids()));
CREATE POLICY "ae_student_read" ON public.afterschool_enrollments FOR SELECT TO authenticated
  USING (student_profile_id = auth.uid());
