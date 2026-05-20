-- Task A4 (REVIEW_DB §8.4, HIGH, XS):
-- student_bus_defaults 의 PK = (student_id, direction, day_of_week) 와
-- 모순되는 UNIQUE (student_id, day_of_week) 제거.
-- → pickup + dropoff 동시 등록 가능해짐.

alter table public.student_bus_defaults
  drop constraint if exists student_bus_defaults_student_id_day_of_week_key;

-- ROLLBACK:
-- BEGIN;
-- ALTER TABLE public.student_bus_defaults
--   ADD CONSTRAINT student_bus_defaults_student_id_day_of_week_key
--   UNIQUE (student_id, day_of_week);
-- COMMIT;
