-- 하원 버스 모니터에서 학생 배정 여부와 관계없이 정류장을 표시할지 여부 (시간대별 옵션).
-- 오후반(16:20, 17:45 등)처럼 수시로 정류장이 바뀌는 타임에서 모니터가 '오늘 비어 있는 정류장'도 보여줘야 할 때 사용.
ALTER TABLE public.bus_time_slots
  ADD COLUMN IF NOT EXISTS show_empty_stops BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.bus_time_slots.show_empty_stops IS
  '하원 버스 모니터에서 학생 없는 정류장도 이름을 노출할지 여부. 기본 false, 오후반 등 특정 시간대만 관리자에서 체크.';
