-- =============================================================================
-- Migration: 20260423060000_lunch_anchors.sql
-- Purpose  : 점심지도 "유지되는 변경" 설계 변경.
--            기존 lunch_leader_overrides(하루만 적용)를 anchor 방식으로 재해석:
--            변경한 날짜부터 영구 적용, 이후 날짜는 anchor 기준으로 자동 회전.
--            반 순서 anchor도 별도 테이블로 추가.
-- =============================================================================
--
-- ROLLBACK:
-- BEGIN;
-- DROP TABLE IF EXISTS public.lunch_class_order_anchors;
-- ALTER TABLE public.lunch_leader_anchors RENAME TO lunch_leader_overrides;
-- ALTER TABLE public.lunch_leader_overrides RENAME COLUMN effective_from TO override_date;
-- COMMIT;
-- =============================================================================

BEGIN;

-- 1) lunch_leader_overrides → lunch_leader_anchors (의미 재정의 + 이름 정정)
ALTER TABLE IF EXISTS public.lunch_leader_overrides RENAME TO lunch_leader_anchors;
ALTER TABLE IF EXISTS public.lunch_leader_anchors RENAME COLUMN override_date TO effective_from;
ALTER TABLE IF EXISTS public.lunch_leader_anchors
  RENAME CONSTRAINT lunch_leader_overrides_unique TO lunch_leader_anchors_unique;
ALTER INDEX IF EXISTS lunch_overrides_date_idx RENAME TO lunch_leader_anchors_date_idx;
ALTER POLICY "llo_admin_all" ON public.lunch_leader_anchors RENAME TO "lla_admin_all";

-- 2) 반 순서 anchor 테이블
CREATE TABLE IF NOT EXISTS public.lunch_class_order_anchors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  effective_from DATE NOT NULL,
  lunch_group TEXT NOT NULL CHECK (lunch_group IN ('7세', '6세')),
  first_class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lunch_class_order_anchors_unique UNIQUE (effective_from, lunch_group)
);

CREATE INDEX IF NOT EXISTS lunch_class_order_anchors_date_idx
  ON public.lunch_class_order_anchors (effective_from);

ALTER TABLE public.lunch_class_order_anchors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lcoa_admin_all" ON public.lunch_class_order_anchors;
CREATE POLICY "lcoa_admin_all" ON public.lunch_class_order_anchors
  FOR ALL TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

COMMIT;
