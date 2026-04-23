-- =============================================================================
-- Migration: 20260423000000_lunch_supervision.sql
-- Purpose  : 점심지도 페이지 (/admin/lunch) 백엔드 구성.
--            (1) classes 테이블에 lunch_group 컬럼 추가 — 7세·6세 지정
--            (2) lunch_leader_overrides 테이블 신설 — 특정 날짜 특정 반의
--                리더를 수동으로 override하는 수단
--            (3) RLS 정책 — admin 전용 all-access
-- Design   : docs/review-2026-04-22/ 의 /office-hours 세션 결과물
-- =============================================================================
--
-- ROLLBACK (되돌리기):
-- ----------------------------------------------------------------------------
-- BEGIN;
-- DROP TABLE IF EXISTS public.lunch_leader_overrides;
-- ALTER TABLE public.classes DROP COLUMN IF EXISTS lunch_group;
-- COMMIT;
-- =============================================================================

BEGIN;

-- 1) classes.lunch_group 컬럼 — 점심지도 대상 반 지정
--    null = 해당 없음, "7세" = 7세반, "6세" = 6세반
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS lunch_group TEXT
  CHECK (lunch_group IS NULL OR lunch_group IN ('7세', '6세'));

-- 2) lunch_leader_overrides 테이블
CREATE TABLE IF NOT EXISTS public.lunch_leader_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  override_date DATE NOT NULL,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  leader_student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lunch_leader_overrides_unique UNIQUE (override_date, class_id)
);

CREATE INDEX IF NOT EXISTS lunch_overrides_date_idx
  ON public.lunch_leader_overrides (override_date);

-- 3) RLS 활성화 + admin 전용 정책
ALTER TABLE public.lunch_leader_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "llo_admin_all" ON public.lunch_leader_overrides;
CREATE POLICY "llo_admin_all" ON public.lunch_leader_overrides
  FOR ALL TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

COMMIT;
