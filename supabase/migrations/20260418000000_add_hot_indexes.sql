-- Add hot-column indexes for frequently filtered/sorted queries.
-- Source: docs/project-analysis-2026-04-09.md → humble-whistling-pebble plan (2026-04-18) Task 2.2.
-- Target: Prevent seq scan on student 500+ 누적 시 핫 쿼리.
--
-- Redundancy notes (일부는 이미 UNIQUE 제약으로 index 생성되어 있음):
--   * attendance(student_profile_id, attendance_date) — UNIQUE already covers prefix. IF NOT EXISTS로 no-op 가능.
--   * student_bus_defaults(student_profile_id, day_of_week) — UNIQUE(..., direction)이 prefix로 커버.
--   * report_cards(student_profile_id, year, month) — UNIQUE already covers.
-- 위 3건은 이중 인덱스가 되지 않도록 생성하지 않음. 나머지 5건만 생성.
--
-- Rollback: DROP INDEX IF EXISTS 각 인덱스;

CREATE INDEX IF NOT EXISTS idx_class_students_student
  ON class_students(student_profile_id, class_id);
  -- 역방향 조회 (학생 → 소속 반). UNIQUE(class_id, student_profile_id)는 (class → students) 방향만 커버.

CREATE INDEX IF NOT EXISTS idx_class_schedules_grid
  ON class_schedules(class_id, academy_period_id, day_of_week);
  -- 시간표 그리드 조회(getGroupTimetableGrid) 핫 경로.

CREATE INDEX IF NOT EXISTS idx_class_schedules_student
  ON class_schedules(student_profile_id)
  WHERE student_profile_id IS NOT NULL;
  -- 개인 시간표 조회용 partial index.

CREATE INDEX IF NOT EXISTS idx_homework_submissions_student
  ON homework_submissions(student_profile_id, assignment_id);
  -- 학생 본인 숙제 목록 조회. UNIQUE(assignment_id, student_profile_id)는 반대 방향.

CREATE INDEX IF NOT EXISTS idx_learning_records_student_date
  ON learning_records(student_profile_id, record_date DESC);
  -- 학생별 최신 학습기록 조회(chronological). UNIQUE 없음.
