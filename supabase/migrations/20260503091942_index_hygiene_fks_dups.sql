-- ============================================================
-- Index hygiene
--
-- 목적:
--   1) 미인덱싱 FK 13개에 인덱스 추가 (cascade 삭제 + 조인 성능)
--   2) 중복 인덱스 3개 드롭 (advisor 0009)
--   3) 잉여 단일 인덱스 1개 드롭 (composite 가 leftmost 커버)
--
-- 안전성:
--   - CREATE INDEX IF NOT EXISTS 로 idempotent
--   - DROP INDEX IF EXISTS
--   - CONCURRENTLY 미사용 (DDL 트랜잭션 내라 lock 짧음, 데이터 양 작음)
-- ============================================================

-- ── 1. 미인덱싱 FK 인덱스 추가 ──────────────────────────────

-- afterschool_enrollments(academy_period_id) — period 별 등록 조회/삭제
create index if not exists idx_afterschool_enrollments_period
  on public.afterschool_enrollments (academy_period_id);

-- attendance(class_id) — 반별 출결 조회
create index if not exists idx_attendance_class
  on public.attendance (class_id);

-- attendance(recorded_by) — profiles 삭제 cascade
create index if not exists idx_attendance_recorded_by
  on public.attendance (recorded_by);

-- bus_change_requests
create index if not exists idx_bcr_new_bus_number
  on public.bus_change_requests (new_bus_number_id);
create index if not exists idx_bcr_new_bus_stop
  on public.bus_change_requests (new_bus_stop_id);
create index if not exists idx_bcr_new_bus_time_slot
  on public.bus_change_requests (new_bus_time_slot_id);
create index if not exists idx_bcr_reviewed_by
  on public.bus_change_requests (reviewed_by);

-- bus_check_records
create index if not exists idx_bus_check_records_bus_number
  on public.bus_check_records (bus_number_id);
create index if not exists idx_bus_check_records_bus_time_slot
  on public.bus_check_records (bus_time_slot_id);
create index if not exists idx_bus_check_records_checked_by
  on public.bus_check_records (checked_by);

-- bus_stop_day_assignments
create index if not exists idx_bus_stop_day_assignments_bus_number
  on public.bus_stop_day_assignments (bus_number_id);
create index if not exists idx_bus_stop_day_assignments_bus_time_slot
  on public.bus_stop_day_assignments (bus_time_slot_id);

-- bus_stop_schedules
create index if not exists idx_bus_stop_schedules_bus_time_slot
  on public.bus_stop_schedules (bus_time_slot_id);

-- bus_stops(bus_number_id) — 차량별 정류장 리스트
create index if not exists idx_bus_stops_bus_number
  on public.bus_stops (bus_number_id);

-- class_schedules(academy_period_id) — period 별 시간표 조회
create index if not exists idx_class_schedules_period
  on public.class_schedules (academy_period_id);

-- notices(author_id)
create index if not exists idx_notices_author
  on public.notices (author_id);

-- report_cards(author_id)
create index if not exists idx_report_cards_author
  on public.report_cards (author_id);

-- student_bus_defaults
create index if not exists idx_student_bus_defaults_bus_stop
  on public.student_bus_defaults (bus_stop_id);
create index if not exists idx_student_bus_defaults_bus_time_slot
  on public.student_bus_defaults (bus_time_slot_id);

-- ── 2. 중복 인덱스 드롭 (advisor 0009) ─────────────────────

-- afterschool_enrollments: idx_afterschool_enrollments_student_day == idx_afterschool_student_day
drop index if exists public.idx_afterschool_student_day;

-- afterschool_enrollments: 단일 student_id 는 (student_id, day_of_week) 의 leftmost 로 커버
drop index if exists public.idx_afterschool_enrollments_student_id;

-- class_teachers: idx_class_teachers_teacher == idx_class_teachers_teacher_id
drop index if exists public.idx_class_teachers_teacher_id;
