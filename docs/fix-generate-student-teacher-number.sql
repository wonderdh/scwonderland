-- ============================================================
-- "function generate_student_number() does not exist" 해결용
-- Supabase SQL Editor에서 이 파일 내용을 붙여 넣고 실행하세요.
--
-- 함수는 있는데 에러가 나면: set_student_number/set_teacher_number가
-- 스키마 없이 호출해서일 수 있음. 아래 3번·4번으로 public. 붙여서 갱신.
-- ============================================================

-- 1. 학생 번호 생성 함수 (S_2026001 형식)
CREATE OR REPLACE FUNCTION public.generate_student_number()
RETURNS text AS $$
DECLARE
  current_year text;
  seq_name text;
  seq_num text;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::text;
  seq_name := 'student_number_seq_' || current_year;
  IF NOT EXISTS (
    SELECT 1 FROM pg_sequences
    WHERE schemaname = 'public' AND sequencename = seq_name
  ) THEN
    EXECUTE format('CREATE SEQUENCE public.%I START 1', seq_name);
  END IF;
  EXECUTE format('SELECT LPAD(nextval(%L)::text, 3, %L)', 'public.' || seq_name, '0') INTO seq_num;
  RETURN 'S_' || current_year || seq_num;
END;
$$ LANGUAGE plpgsql;

-- 2. 교사 번호 생성 함수 (T_2026001 형식)
CREATE OR REPLACE FUNCTION public.generate_teacher_number()
RETURNS text AS $$
DECLARE
  current_year text;
  seq_name text;
  seq_num text;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::text;
  seq_name := 'teacher_number_seq_' || current_year;
  IF NOT EXISTS (
    SELECT 1 FROM pg_sequences
    WHERE schemaname = 'public' AND sequencename = seq_name
  ) THEN
    EXECUTE format('CREATE SEQUENCE public.%I START 1', seq_name);
  END IF;
  EXECUTE format('SELECT LPAD(nextval(%L)::text, 3, %L)', 'public.' || seq_name, '0') INTO seq_num;
  RETURN 'T_' || current_year || seq_num;
END;
$$ LANGUAGE plpgsql;

-- 3. students INSERT 시 student_number 자동 채우는 트리거 (없으면 생성)
CREATE OR REPLACE FUNCTION public.set_student_number()
RETURNS trigger AS $$
BEGIN
  IF NEW.student_number IS NULL THEN
    NEW.student_number := public.generate_student_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_student_number ON public.students;
CREATE TRIGGER trigger_set_student_number
  BEFORE INSERT ON public.students
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_student_number();

-- 4. teachers INSERT 시 teacher_number 자동 채우는 트리거 (없으면 생성)
CREATE OR REPLACE FUNCTION public.set_teacher_number()
RETURNS trigger AS $$
BEGIN
  IF NEW.teacher_number IS NULL THEN
    NEW.teacher_number := public.generate_teacher_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_teacher_number ON public.teachers;
CREATE TRIGGER trigger_set_teacher_number
  BEFORE INSERT ON public.teachers
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_teacher_number();
