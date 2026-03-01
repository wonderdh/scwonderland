-- ============================================
-- 수업 시간표 (class_schedules) 테이블
-- 반별 요일/교시/담당교사 매핑
-- ============================================

CREATE TABLE public.class_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  academy_period_id UUID NOT NULL REFERENCES public.academy_periods(id) ON DELETE RESTRICT,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),  -- 1=월 ~ 5=금
  teacher_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (class_id, academy_period_id, day_of_week)
);

CREATE INDEX idx_cs_class ON public.class_schedules (class_id);
CREATE INDEX idx_cs_period ON public.class_schedules (academy_period_id);
CREATE INDEX idx_cs_teacher ON public.class_schedules (teacher_profile_id);
CREATE INDEX idx_cs_day ON public.class_schedules (day_of_week);

-- RLS
ALTER TABLE public.class_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "class_schedules_auth_read" ON public.class_schedules
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "class_schedules_admin_all" ON public.class_schedules
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  );

-- 되돌리기
-- DROP TABLE IF EXISTS public.class_schedules CASCADE;
