-- Drop duplicate indexes detected after 20260420022122_add_hot_indexes.
-- Source: Supabase performance advisor (duplicate_index warning).
--
-- Removing older names to keep idx_ naming convention uniform.
-- Retained equivalents:
--   * class_schedules: idx_class_schedules_student (identical definition)
--   * learning_records: idx_learning_records_student_date (identical definition)
--
-- No functional change — query planner was already ignoring one of each pair.
-- Rollback:
--   CREATE INDEX IF NOT EXISTS ix_class_schedules_student
--     ON class_schedules(student_profile_id)
--     WHERE student_profile_id IS NOT NULL;
--   CREATE INDEX IF NOT EXISTS idx_learning_records_student
--     ON learning_records(student_profile_id, record_date DESC);

DROP INDEX IF EXISTS public.ix_class_schedules_student;
DROP INDEX IF EXISTS public.idx_learning_records_student;
