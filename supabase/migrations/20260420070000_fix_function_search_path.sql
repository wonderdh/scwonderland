-- =============================================================================
-- Migration: fix_function_search_path
-- Purpose:   Pin SET search_path = public, pg_catalog on all 8 public schema
--            functions that were missing it.  Supabase security advisor
--            (function_search_path_mutable) flags this as a schema-injection
--            risk — if a malicious user/extension redefines search_path, a
--            SECURITY DEFINER function could resolve table names against an
--            attacker-controlled schema.
--
--            Even for non-SECURITY-DEFINER functions (triggers), pinning
--            search_path is Supabase's recommended hardening.
--
-- Functions fixed:
--   SECURITY DEFINER (high priority):
--     • get_class_report_status(int, int)
--     • handle_attendance_bus_sync() — trigger
--
--   Regular (trigger / util):
--     • generate_student_number()
--     • generate_teacher_number()
--     • set_classes_updated_at()
--     • set_report_cards_updated_at()
--     • set_student_number()
--     • set_teacher_number()
--
-- No behaviour change — only config added.  ALTER FUNCTION ... SET does NOT
-- recreate the function or invalidate plans; it just attaches the config.
--
-- Rollback:
--   ALTER FUNCTION public.<name>(...) RESET search_path;
--   (applied per function — see below for identity)
-- =============================================================================

ALTER FUNCTION public.get_class_report_status(integer, integer)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.handle_attendance_bus_sync()
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.generate_student_number()
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.generate_teacher_number()
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.set_classes_updated_at()
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.set_report_cards_updated_at()
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.set_student_number()
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.set_teacher_number()
  SET search_path = public, pg_catalog;
