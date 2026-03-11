-- =============================================================
-- Timetable Domain Schema
-- 시간표: 교시, 스케줄
-- =============================================================

-- 교시 정의
CREATE TABLE academy_periods (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  start_time  time NOT NULL,
  end_time    time NOT NULL,
  has_pickup   boolean NOT NULL DEFAULT false,
  has_dropoff  boolean NOT NULL DEFAULT false,
  is_active   boolean NOT NULL DEFAULT true,
  group_label text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- 반별 스케줄 (교시-요일-반-교사 매핑)
CREATE TABLE class_schedules (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id            uuid REFERENCES classes(id),
  academy_period_id   uuid NOT NULL REFERENCES academy_periods(id),
  day_of_week         integer NOT NULL,      -- 1=월 ~ 5=금
  teacher_profile_id  uuid REFERENCES profiles(id),
  student_profile_id  uuid REFERENCES profiles(id),
  label               text,
  textbook_id         uuid REFERENCES textbooks(id),
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);
