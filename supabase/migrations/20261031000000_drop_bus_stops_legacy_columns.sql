-- bus_stops 레거시 컬럼 제거.
--   bus_number_id: 20261015120000 에서 정류장이 여러 호차를 공유하게 되면서 배정은
--                  bus_stop_day_assignments.bus_number_id 가 정본. 앱 코드 어디서도 읽거나 쓰지 않음.
--   sort_order:    실제 운행 순서는 bus_stop_day_assignments.sort_order. 정류장 목록은 이름순으로 충분.
-- 컬럼 drop 시 idx_bus_stops_bus_number 인덱스와 bus_stops_bus_number_id_fkey FK 도 같이 제거된다.

alter table public.bus_stops
  drop column if exists bus_number_id,
  drop column if exists sort_order;
