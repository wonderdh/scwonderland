-- ============================================================
-- 마이그레이션: 반별 복수 교사 + 교사 유형(한국인/원어민) 추가
-- ============================================================
-- 이 파일의 모든 SQL을 순서대로 실행하세요.
-- 주의: 기존 classes.teacher_profile_id 데이터를 class_teachers로 마이그레이션합니다.

-- ── 1. ENUM 타입 생성 + teachers 테이블에 teacher_type 컬럼 추가 ──
CREATE TYPE public.teacher_type_enum AS ENUM ('korean', 'native');

ALTER TABLE public.teachers
  ADD COLUMN teacher_type public.teacher_type_enum NOT NULL DEFAULT 'korean';

COMMENT ON COLUMN public.teachers.teacher_type IS '한국인(korean) 또는 원어민(native) 교사';

-- ── 2. class_teachers 중간 테이블 생성 ──
CREATE TABLE public.class_teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_profile_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (class_id, teacher_profile_id)
);

CREATE INDEX idx_class_teachers_class ON public.class_teachers (class_id);
CREATE INDEX idx_class_teachers_teacher ON public.class_teachers (teacher_profile_id);

-- ── 3. 기존 데이터 마이그레이션 (classes.teacher_profile_id → class_teachers) ──
INSERT INTO public.class_teachers (class_id, teacher_profile_id)
SELECT id, teacher_profile_id
FROM public.classes
WHERE teacher_profile_id IS NOT NULL;

-- ── 4. classes 테이블에서 teacher_profile_id 컬럼 제거 ──
ALTER TABLE public.classes DROP COLUMN teacher_profile_id;

-- ── 완료 ──
-- 확인: SELECT * FROM class_teachers;
-- 확인: SELECT * FROM teachers WHERE teacher_type IS NOT NULL;
