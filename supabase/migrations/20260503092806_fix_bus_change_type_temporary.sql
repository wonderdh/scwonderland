-- ============================================================
-- Fix: bus_change_type enum 에 'temporary_change' 추가
--
-- 배경:
--   src/lib/bus/state.ts 의 BUS_CHANGE_TYPES 가
--   ['change', 'no_ride', 'absent', 'temporary_change'] 4개를 정의하는데
--   직전 마이그레이션 (20260503091943) 의 enum 에는 라이브 데이터에 없는
--   'temporary_change' 가 누락됨. 코드 → DB insert 시 enum 충돌 발생.
-- ============================================================

alter type public.bus_change_type add value if not exists 'temporary_change';
