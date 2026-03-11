-- 방과후 프로그램 등록 테이블
-- 1 row = 학생 1명 × 방과후 반 1개 × 요일 1개
-- class_students는 유지 (출석/숙제 등 기존 시스템 호환)

CREATE TABLE afterschool_enrollments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(class_id, student_profile_id, day_of_week)
);

CREATE INDEX ix_afterschool_enrollments_student
  ON afterschool_enrollments(student_profile_id);
CREATE INDEX ix_afterschool_enrollments_class
  ON afterschool_enrollments(class_id);
