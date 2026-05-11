-- 20260504020000_student_bus_defaults_redesign_step2.sql
--
-- student_bus_defaults 재설계 2단계 (final):
--   1) id (uuid PK) 컬럼 제거 → composite PK (student_id, direction, day_of_week)
--   2) estimated_time 컬럼 제거 (bus_stop_schedules 가 source of truth)
--   3) step1 에서 만든 unique index 는 PK 와 중복이라 정리

-- ── 1. 옛 PK 제거 + id 컬럼 제거 ────────────────────────────────────────────────

alter table public.student_bus_defaults
  drop constraint student_bus_defaults_pkey;

alter table public.student_bus_defaults
  drop column id;

-- ── 2. composite PK 신설 ─────────────────────────────────────────────────────

alter table public.student_bus_defaults
  add primary key (student_id, direction, day_of_week);

-- ── 3. step1 에서 신설한 unique index 제거 (PK 가 unique 보장) ───────────────

drop index if exists public.student_bus_defaults_student_direction_day_key;

-- ── 4. estimated_time 컬럼 제거 ──────────────────────────────────────────────

alter table public.student_bus_defaults
  drop column estimated_time;
