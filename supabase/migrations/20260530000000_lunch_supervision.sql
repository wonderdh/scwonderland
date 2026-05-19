-- =============================================================================
-- Migration: 20260530000000_lunch_supervision.sql
-- Purpose  : 점심지도 (/admin/lunch + /lunch-monitor) 백엔드 재구성.
--            (1) classes.lunch_group 컬럼 추가 — 7세·6세 지정
--            (2) lunch_leader_anchors — 특정 날짜 특정 반 리더 anchor
--            (3) lunch_class_order_anchors — 특정 날짜 반 순서 anchor
--            (4) RLS — admin 전용 all-access
-- 설계     : anchor 방식 (변경한 날부터 영구 적용, 이후는 anchor 기준 회전).
-- FK 컨벤션 (supabase/AGENTS.md):
--   leader_student_id → students(id),  first_class_id → classes(id),
--   created_by        → profiles(id)   (admin actor 컬럼).
-- =============================================================================
--
-- ROLLBACK:
-- BEGIN;
-- DROP TABLE IF EXISTS public.lunch_class_order_anchors;
-- DROP TABLE IF EXISTS public.lunch_leader_anchors;
-- ALTER TABLE public.classes DROP COLUMN IF EXISTS lunch_group;
-- COMMIT;
-- =============================================================================

BEGIN;

-- 1) classes.lunch_group 컬럼 — 점심지도 대상 반 지정
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS lunch_group TEXT
  CHECK (lunch_group IS NULL OR lunch_group IN ('7세', '6세'));

-- 2) lunch_leader_anchors — 리더 anchor
CREATE TABLE IF NOT EXISTS public.lunch_leader_anchors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  effective_from DATE NOT NULL,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  leader_student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lunch_leader_anchors_unique UNIQUE (effective_from, class_id)
);

CREATE INDEX IF NOT EXISTS lunch_leader_anchors_date_idx
  ON public.lunch_leader_anchors (effective_from);

ALTER TABLE public.lunch_leader_anchors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lla_admin_all" ON public.lunch_leader_anchors;
CREATE POLICY "lla_admin_all" ON public.lunch_leader_anchors
  FOR ALL TO authenticated
  USING ((SELECT private.get_my_role()) = 'admin'::public.user_role)
  WITH CHECK ((SELECT private.get_my_role()) = 'admin'::public.user_role);

-- 3) lunch_class_order_anchors — 반 순서 anchor
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
  USING ((SELECT private.get_my_role()) = 'admin'::public.user_role)
  WITH CHECK ((SELECT private.get_my_role()) = 'admin'::public.user_role);

COMMIT;
