-- ============================================================
-- classes, class_students 테이블
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================
-- 반: 이름 + 담당 선생 0명 또는 1명 (teacher_profile_id nullable).
-- 반–학생: class_students 로 N:N 연결.
-- 이 테이블들 건드리기(조회·추가·수정·삭제)는 admin 계정만 가능.
-- ============================================================

-- 1. classes (반)
CREATE TABLE public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  teacher_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.classes IS '반. 담당 선생은 0명 또는 1명.';
COMMENT ON COLUMN public.classes.teacher_profile_id IS '담당 선생(선생의 profile id). 없으면 NULL.';

CREATE INDEX idx_classes_teacher_profile_id ON public.classes(teacher_profile_id);

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION public.set_classes_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_classes_updated_at
  BEFORE UPDATE ON public.classes
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_classes_updated_at();

-- RLS: admin만
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "classes_admin_all"
ON public.classes FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 2. class_students (반–학생 N:N)
CREATE TABLE public.class_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, student_profile_id)
);

COMMENT ON TABLE public.class_students IS '반에 소속된 학생. 한 학생이 여러 반 소속 가능.';

CREATE INDEX idx_class_students_class_id ON public.class_students(class_id);
CREATE INDEX idx_class_students_student_profile_id ON public.class_students(student_profile_id);

-- RLS: admin만
ALTER TABLE public.class_students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "class_students_admin_all"
ON public.class_students FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);
