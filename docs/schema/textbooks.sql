-- =============================================================
-- Textbooks Domain Schema
-- 교재 및 학생 교재 진도
-- =============================================================

-- 교재
CREATE TABLE textbooks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  series      text,
  level       text,
  category    text NOT NULL DEFAULT 'general',
  total_units integer NOT NULL DEFAULT 1,
  cover_image text,
  description text,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,    -- soft delete 대용
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 학생 교재 진도
CREATE TABLE student_textbook_progress (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_profile_id uuid NOT NULL REFERENCES profiles(id),
  textbook_id        uuid NOT NULL REFERENCES textbooks(id),
  source_type        text NOT NULL,              -- 'class' | 'individual' 등
  source_class_id    uuid REFERENCES classes(id),
  status             text NOT NULL DEFAULT 'not_started',
  completed_units    integer NOT NULL DEFAULT 0,
  started_at         timestamptz,
  completed_at       timestamptz,
  assigned_at        timestamptz DEFAULT now(),
  note               text,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now(),
  UNIQUE (student_profile_id, textbook_id, source_class_id)
);

-- 학습 기록
CREATE TABLE learning_records (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_profile_id uuid NOT NULL REFERENCES profiles(id),
  record_date        date NOT NULL DEFAULT CURRENT_DATE,
  category           text NOT NULL,
  title              text NOT NULL,
  content            text,
  score              numeric,
  max_score          numeric,
  author_id          uuid REFERENCES profiles(id),
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);
