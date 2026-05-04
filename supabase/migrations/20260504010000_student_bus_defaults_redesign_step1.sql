-- 20260504010000_student_bus_defaults_redesign_step1.sql
--
-- student_bus_defaults 재설계 1단계:
--   1) bus_direction enum 신규
--   2) direction 컬럼 추가 (default 'dropoff' 로 기존 행 backfill)
--   3) (student_id, direction, day_of_week) unique index 신설
--   4) 옛 unique 제약 잔재 정리
--
-- 옛 컬럼(id, estimated_time) 제거는 step2 마이그레이션에서 진행.

-- ── 1. enum 신규 ──────────────────────────────────────────────────────────────

create type public.bus_direction as enum ('pickup', 'dropoff');

-- ── 2. direction 컬럼 추가 + 기존 행 backfill ────────────────────────────────

alter table public.student_bus_defaults
  add column direction public.bus_direction not null default 'dropoff';

-- default 제거 (이후 INSERT는 direction 명시 필요)
alter table public.student_bus_defaults
  alter column direction drop default;

-- ── 3. composite unique index 신설 ────────────────────────────────────────────

create unique index if not exists student_bus_defaults_student_direction_day_key
  on public.student_bus_defaults (student_id, direction, day_of_week);

-- ── 4. 옛 unique 제약 잔재 정리 ───────────────────────────────────────────────

alter table public.student_bus_defaults
  drop constraint if exists student_bus_defaults_student_day_key;
