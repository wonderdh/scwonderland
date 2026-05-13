-- ============================================================
-- classes / academy_periods / class_schedules / report_cards 리팩토링
-- ============================================================
-- DB 변경 요약:
--   1) classes: english_name, group_label 컬럼 제거 (미사용 + group_type 으로 통일)
--   2) academy_periods: group_label, is_active, has_dropoff 제거 + afterschool 행 삭제
--   3) class_schedules: teacher_id → class_teacher_id rename (FK teachers(id) 유지)
--   4) report_cards: student_id → class_student_id, teacher_id → class_teacher_id rename
--      + FK 재정의 (class_students CASCADE / class_teachers SET NULL)
--      + UNIQUE 재정의 (class_student_id, year, month)
--      + RLS 정책(report_cards_select/update) class_student_id 기반으로 재작성
--
-- 본 마이그레이션은 이미 로컬 환경에 수동 적용됨. 다른 환경 동기화용 record.
-- 적용 전 백업 권장.
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────
-- 1) classes 미사용 컬럼 제거
-- ────────────────────────────────────────────────
ALTER TABLE public.classes
  DROP COLUMN IF EXISTS english_name,
  DROP COLUMN IF EXISTS group_label;

-- ────────────────────────────────────────────────
-- 2) academy_periods 정리
-- ────────────────────────────────────────────────
DELETE FROM public.academy_periods WHERE group_type = 'afterschool';

ALTER TABLE public.academy_periods
  DROP COLUMN IF EXISTS group_label,
  DROP COLUMN IF EXISTS is_active,
  DROP COLUMN IF EXISTS has_dropoff;

-- ────────────────────────────────────────────────
-- 3) class_schedules.teacher_id → class_teacher_id
--    FK = teachers(id) ON DELETE SET NULL 유지
-- ────────────────────────────────────────────────
ALTER TABLE public.class_schedules
  RENAME COLUMN teacher_id TO class_teacher_id;

ALTER INDEX IF EXISTS public.idx_class_schedules_teacher_id
  RENAME TO idx_class_schedules_class_teacher_id;
ALTER INDEX IF EXISTS public.idx_class_schedules_teacher_day
  RENAME TO idx_class_schedules_class_teacher_day;

ALTER TABLE public.class_schedules
  RENAME CONSTRAINT class_schedules_teacher_id_fkey
  TO class_schedules_class_teacher_id_fkey;

-- ────────────────────────────────────────────────
-- 4) report_cards 컬럼 rename + FK 재정의 + RLS 재작성
-- ────────────────────────────────────────────────

-- 4-1. 기존 RLS 정책 (student_id 의존) 제거
DROP POLICY IF EXISTS report_cards_select ON public.report_cards;
DROP POLICY IF EXISTS report_cards_update ON public.report_cards;

-- 4-2. 기존 제약 제거
ALTER TABLE public.report_cards
  DROP CONSTRAINT IF EXISTS report_cards_student_id_year_month_key,
  DROP CONSTRAINT IF EXISTS report_cards_student_id_fkey,
  DROP CONSTRAINT IF EXISTS report_cards_teacher_id_fkey,
  DROP CONSTRAINT IF EXISTS report_cards_author_id_fkey;

DROP INDEX IF EXISTS public.idx_report_cards_author;

-- 4-3. 컬럼 rename
ALTER TABLE public.report_cards
  RENAME COLUMN student_id TO class_student_id;
ALTER TABLE public.report_cards
  RENAME COLUMN teacher_id TO class_teacher_id;

-- 4-4. backfill — 기존 데이터의 컬럼 값을 새 FK 대상에 맞춰 변환
--   (다른 환경 신규 적용 시: 학생당 class_students 1행 가정. 매칭 안 되는 행은 NULL.)
UPDATE public.report_cards rc
   SET class_student_id = cs.id
  FROM (
    SELECT DISTINCT ON (student_id) id, student_id
      FROM public.class_students
     ORDER BY student_id, is_active DESC, joined_at DESC
  ) cs
 WHERE cs.student_id = rc.class_student_id;

UPDATE public.report_cards rc
   SET class_teacher_id = ct.id
  FROM public.class_students cs
  JOIN public.class_teachers ct ON ct.class_id = cs.class_id
 WHERE cs.id = rc.class_student_id
   AND ct.teacher_id = rc.class_teacher_id
   AND rc.class_teacher_id IS NOT NULL;

-- 4-5. 매핑 실패한 orphan 행 제거 (NOT NULL 강제 위해)
DELETE FROM public.report_cards WHERE class_student_id IS NULL;

-- 4-6. NOT NULL + FK + UNIQUE 재정의
ALTER TABLE public.report_cards
  ALTER COLUMN class_student_id SET NOT NULL;

ALTER TABLE public.report_cards
  ADD CONSTRAINT report_cards_class_student_id_fkey
  FOREIGN KEY (class_student_id) REFERENCES public.class_students(id) ON DELETE CASCADE;

ALTER TABLE public.report_cards
  ADD CONSTRAINT report_cards_class_teacher_id_fkey
  FOREIGN KEY (class_teacher_id) REFERENCES public.class_teachers(id) ON DELETE SET NULL;

ALTER TABLE public.report_cards
  ADD CONSTRAINT report_cards_class_student_id_year_month_key
  UNIQUE (class_student_id, year, month);

-- 4-7. 인덱스
CREATE INDEX IF NOT EXISTS idx_report_cards_class_student
  ON public.report_cards (class_student_id);
CREATE INDEX IF NOT EXISTS idx_report_cards_class_teacher
  ON public.report_cards (class_teacher_id);

-- 4-8. RLS 정책 재생성 (class_student_id 기반)
CREATE POLICY report_cards_select ON public.report_cards
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.class_students cs
       WHERE cs.id = report_cards.class_student_id
         AND cs.student_id = (SELECT auth.uid())
    )
    OR (SELECT private.get_my_role())
       = ANY (ARRAY['admin'::public.user_role, 'teacher'::public.user_role])
  );

CREATE POLICY report_cards_update ON public.report_cards
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.class_students cs
       WHERE cs.id = report_cards.class_student_id
         AND cs.student_id = (SELECT auth.uid())
    )
    OR (SELECT private.get_my_role())
       = ANY (ARRAY['admin'::public.user_role, 'teacher'::public.user_role])
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.class_students cs
       WHERE cs.id = report_cards.class_student_id
         AND cs.student_id = (SELECT auth.uid())
    )
    OR (SELECT private.get_my_role())
       = ANY (ARRAY['admin'::public.user_role, 'teacher'::public.user_role])
  );

COMMIT;
