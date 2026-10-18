-- 정류장을 여러 호차가 공유할 수 있게 한다.
--   1) bus_stop_day_assignments: (정류장, 요일, 시간대) 유니크 → (정류장, 요일, 시간대, 호차)
--   2) student_bus_defaults.bus_number_id: 학생 호차를 정류장에서 역추적하지 않고 직접 저장
--   3) bus_stop_schedules.bus_number_id: 도착 예정 시각을 호차별로
-- 2·3 의 backfill 은 기존 앱 로직(_helpers.buildStopToBusMaps)의 해석 순서를 그대로 따른다:
--   같은 시간대 배정 → 기본(시간대 null) 배정.

-- 1. 정류장 배정 중복 허용
drop index if exists public.bus_stop_day_assignments_unique_idx;
create unique index bus_stop_day_assignments_unique_idx
  on public.bus_stop_day_assignments (bus_stop_id, day_of_week, bus_time_slot_id, bus_number_id)
  nulls not distinct;

-- 2. 학생 기본 배정에 호차
alter table public.student_bus_defaults
  add column if not exists bus_number_id uuid references public.bus_numbers(id) on delete set null;
create index if not exists idx_student_bus_defaults_bus_number
  on public.student_bus_defaults (bus_number_id);

update public.student_bus_defaults s
set bus_number_id = coalesce(
  (select a.bus_number_id from public.bus_stop_day_assignments a
    where a.bus_stop_id = s.bus_stop_id and a.day_of_week = s.day_of_week
      and a.bus_time_slot_id = s.bus_time_slot_id),
  (select a.bus_number_id from public.bus_stop_day_assignments a
    where a.bus_stop_id = s.bus_stop_id and a.day_of_week = s.day_of_week
      and a.bus_time_slot_id is null)
)
where s.bus_stop_id is not null and s.bus_number_id is null;

-- 3. 도착 예정 시각을 호차별로
alter table public.bus_stop_schedules
  add column if not exists bus_number_id uuid references public.bus_numbers(id) on delete cascade;
create index if not exists idx_bus_stop_schedules_bus_number
  on public.bus_stop_schedules (bus_number_id);

update public.bus_stop_schedules sc
set bus_number_id = coalesce(
  (select a.bus_number_id from public.bus_stop_day_assignments a
    where a.bus_stop_id = sc.bus_stop_id and a.day_of_week = sc.day_of_week
      and a.bus_time_slot_id is not distinct from sc.bus_time_slot_id),
  (select a.bus_number_id from public.bus_stop_day_assignments a
    where a.bus_stop_id = sc.bus_stop_id and a.day_of_week = sc.day_of_week
      and a.bus_time_slot_id is null)
)
where sc.bus_number_id is null;

drop index if exists public.bus_stop_schedules_unique_idx;
create unique index bus_stop_schedules_unique_idx
  on public.bus_stop_schedules (bus_stop_id, day_of_week, bus_time_slot_id, bus_number_id)
  nulls not distinct;
