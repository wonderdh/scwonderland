-- "전체 (기본)" 시간대(bus_time_slot_id NULL) 제거. 시간대는 bus_time_slots 의 실제 시간대만 쓴다.
-- NULL 배정은 "그 정류장·요일에 해당 시간대 전용 배정이 없으면 대신 쓰는" fallback 이었다.
--   1) fallback 으로 실제 학생이 타고 있는 것만 그 시간대 전용 배정으로 옮긴다 (sort_order 유지).
--   2) 나머지 NULL 배정 / NULL 도착 시각은 삭제.
--   3) 다시 생기지 않게 NOT NULL.

-- 1. 학생이 쓰는 fallback 을 시간대 전용 배정으로
insert into public.bus_stop_day_assignments
  (bus_stop_id, bus_number_id, day_of_week, bus_time_slot_id, sort_order)
select n.bus_stop_id, n.bus_number_id, n.day_of_week, sl.id, n.sort_order
from public.bus_stop_day_assignments n
cross join public.bus_time_slots sl
where n.bus_time_slot_id is null
  and not exists (
    select 1 from public.bus_stop_day_assignments x
    where x.bus_stop_id = n.bus_stop_id and x.day_of_week = n.day_of_week
      and x.bus_time_slot_id = sl.id)
  and exists (
    select 1 from public.student_bus_defaults s
    where s.bus_stop_id = n.bus_stop_id and s.day_of_week = n.day_of_week
      and s.bus_time_slot_id = sl.id);

-- 2. NULL 시간대 행 삭제
delete from public.bus_stop_day_assignments where bus_time_slot_id is null;
delete from public.bus_stop_schedules where bus_time_slot_id is null;

-- 3. 시간대 필수
alter table public.bus_stop_day_assignments alter column bus_time_slot_id set not null;
alter table public.bus_stop_schedules alter column bus_time_slot_id set not null;
