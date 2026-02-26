-- ============================================================
-- 마이그레이션: teacher_type 컬럼 TEXT → ENUM 변환
-- ============================================================
-- 전제: multi-teacher-and-teacher-type.sql이 이미 실행된 상태
-- (teacher_type TEXT NOT NULL DEFAULT 'korean' CHECK(...) 상태)

-- ── 1. ENUM 타입 생성 ──
CREATE TYPE public.teacher_type_enum AS ENUM ('korean', 'native');

-- ── 2. 기존 CHECK 제약조건 제거 ──
ALTER TABLE public.teachers
  DROP CONSTRAINT IF EXISTS teachers_teacher_type_check;

-- ── 3. 컬럼 타입 TEXT → ENUM 변환 ──
ALTER TABLE public.teachers
  ALTER COLUMN teacher_type DROP DEFAULT,
  ALTER COLUMN teacher_type TYPE public.teacher_type_enum USING teacher_type::public.teacher_type_enum,
  ALTER COLUMN teacher_type SET DEFAULT 'korean';

-- ── 완료 ──
-- 확인: SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = 'teachers' AND column_name = 'teacher_type';
-- 결과: udt_name = 'teacher_type_enum' 이면 성공