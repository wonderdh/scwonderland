-- =============================================================
-- Users Domain Schema
-- 사용자: 프로필, 학생, 교사
-- =============================================================

-- Custom enum types
CREATE TYPE user_role AS ENUM ('admin', 'teacher', 'student', 'bus');
CREATE TYPE teacher_type_enum AS ENUM ('korean', 'native');

-- 사용자 프로필 (Supabase Auth와 1:1)
CREATE TABLE profiles (
  id          uuid PRIMARY KEY,            -- auth.users.id 참조 (FK 없이 트리거로 연동)
  first_name  text,
  last_name   text,
  role        user_role,
  deleted_at  timestamptz                  -- soft delete
);

-- 학생 상세
CREATE TABLE students (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      uuid NOT NULL REFERENCES profiles(id) UNIQUE,
  korean_name     text NOT NULL,
  english_name    text,
  student_number  text UNIQUE,
  age             integer,
  group_type      text,                    -- 'kindergarten' | 'afternoon' 등
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- 교사 상세
CREATE TABLE teachers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      uuid NOT NULL REFERENCES profiles(id) UNIQUE,
  name            text NOT NULL,
  teacher_number  text UNIQUE,
  teacher_type    teacher_type_enum NOT NULL DEFAULT 'korean',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
