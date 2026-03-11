-- =============================================================
-- Classes Domain Schema
-- 반 관리: 반, 반-학생, 반-교사, 반-교재 매핑
-- =============================================================

-- 반
CREATE TABLE classes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  group_label text,                        -- 그룹 라벨 (유치부/오후반 등)
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 반-학생 매핑
CREATE TABLE class_students (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id           uuid NOT NULL REFERENCES classes(id),
  student_profile_id uuid NOT NULL REFERENCES profiles(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, student_profile_id)
);

-- 반-교사 매핑
CREATE TABLE class_teachers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id            uuid NOT NULL REFERENCES classes(id),
  teacher_profile_id  uuid NOT NULL REFERENCES profiles(id),
  created_at          timestamptz DEFAULT now(),
  UNIQUE (class_id, teacher_profile_id)
);

-- 반-교재 매핑
CREATE TABLE class_textbooks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    uuid NOT NULL REFERENCES classes(id),
  textbook_id uuid NOT NULL REFERENCES textbooks(id),
  assigned_at timestamptz DEFAULT now(),
  UNIQUE (class_id, textbook_id)
);
