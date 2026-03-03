-- student_profile_id 컬럼 추가 + class_id nullable + 제약조건 변경
-- 학생 개인 시간표 지원을 위한 마이그레이션

-- 1. student_profile_id 컬럼 추가
ALTER TABLE class_schedules
  ADD COLUMN student_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- 2. class_id를 nullable로 변경
ALTER TABLE class_schedules
  ALTER COLUMN class_id DROP NOT NULL;

-- 3. CHECK: class_id 또는 student_profile_id 중 정확히 하나만 non-null
ALTER TABLE class_schedules
  ADD CONSTRAINT chk_class_or_student CHECK (
    (class_id IS NOT NULL AND student_profile_id IS NULL) OR
    (class_id IS NULL AND student_profile_id IS NOT NULL)
  );

-- 4. 기존 UNIQUE 제약 삭제
ALTER TABLE class_schedules
  DROP CONSTRAINT IF EXISTS class_schedules_class_id_academy_period_id_day_of_week_key;

-- 5. 부분 유니크 인덱스 (반 배정용 / 학생 개인 배정용)
CREATE UNIQUE INDEX ux_class_schedule_slot
  ON class_schedules (class_id, academy_period_id, day_of_week)
  WHERE student_profile_id IS NULL;

CREATE UNIQUE INDEX ux_student_schedule_slot
  ON class_schedules (student_profile_id, academy_period_id, day_of_week)
  WHERE class_id IS NULL;

-- 6. 학생 스케줄 조회 인덱스
CREATE INDEX ix_class_schedules_student
  ON class_schedules (student_profile_id)
  WHERE student_profile_id IS NOT NULL;
