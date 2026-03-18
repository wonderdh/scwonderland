-- =============================================================
-- Academy Domain Schema
-- 출결, 숙제, 리포트카드
-- =============================================================

-- 출결
CREATE TABLE attendance (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_profile_id uuid NOT NULL REFERENCES profiles(id),
  attendance_date    date NOT NULL DEFAULT CURRENT_DATE,
  status             text NOT NULL DEFAULT 'present',  -- 'present' | 'absent' | 'late' | 'excused'
  note               text,
  recorded_by        uuid REFERENCES profiles(id),
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now(),
  UNIQUE (student_profile_id, attendance_date)
);

-- RLS 정책 (teacher: class_students → class_teachers 조인으로 담당 학생 여부 확인)
-- CREATE POLICY attendance_admin_all ...        (admin 전체 접근)
-- CREATE POLICY attendance_teacher_select ...   (담당반 학생 SELECT)
-- CREATE POLICY attendance_teacher_insert ...   (담당반 학생 INSERT)
-- CREATE POLICY attendance_teacher_update ...   (담당반 학생 UPDATE)
-- CREATE POLICY attendance_teacher_delete ...   (담당반 학생 DELETE)

-- 숙제 과제
CREATE TABLE homework_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    uuid NOT NULL REFERENCES classes(id),
  teacher_id  uuid NOT NULL REFERENCES profiles(id),
  title       text NOT NULL,
  description text,
  due_date    date,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- 숙제 제출
CREATE TABLE homework_submissions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id      uuid NOT NULL REFERENCES homework_assignments(id),
  student_profile_id uuid NOT NULL REFERENCES profiles(id),
  status             text NOT NULL DEFAULT 'pending',  -- 'pending' | 'submitted' | 'reviewed'
  text_content       text,
  submitted_at       timestamptz,
  teacher_feedback   text,
  reviewed_at        timestamptz,
  reviewed_by        uuid REFERENCES profiles(id),
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now(),
  UNIQUE (assignment_id, student_profile_id)
);

-- 숙제 제출 파일
CREATE TABLE homework_submission_files (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id     uuid NOT NULL REFERENCES homework_submissions(id),
  storage_path      text NOT NULL,
  original_filename text NOT NULL,
  mime_type         text NOT NULL,
  file_size         bigint NOT NULL,
  created_at        timestamptz DEFAULT now()
);

-- 리포트카드
CREATE TABLE report_cards (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_profile_id uuid NOT NULL REFERENCES profiles(id),
  year               smallint NOT NULL,
  month              smallint NOT NULL,
  author_id          uuid REFERENCES profiles(id),
  content            text,
  reply              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_profile_id, year, month)
);
