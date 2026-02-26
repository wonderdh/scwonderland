-- =============================================
-- 교재 배정 테이블 생성
-- class_textbooks: 반-교재 중간 테이블
-- student_textbook_progress: 학생별 교재 진도
-- =============================================

-- 1. class_textbooks 테이블
CREATE TABLE public.class_textbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  textbook_id UUID NOT NULL REFERENCES public.textbooks(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (class_id, textbook_id)
);

-- 2. student_textbook_progress 테이블
CREATE TABLE public.student_textbook_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  textbook_id UUID NOT NULL REFERENCES public.textbooks(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('class', 'individual')),
  source_class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  completed_units INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (student_profile_id, textbook_id, source_class_id)
);

-- 3. RLS 정책 (admin 전용)
ALTER TABLE public.class_textbooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "class_textbooks_admin_all" ON public.class_textbooks
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

ALTER TABLE public.student_textbook_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "student_textbook_progress_admin_all" ON public.student_textbook_progress
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- 4. 인덱스
CREATE INDEX idx_class_textbooks_class ON public.class_textbooks (class_id);
CREATE INDEX idx_class_textbooks_textbook ON public.class_textbooks (textbook_id);
CREATE INDEX idx_stp_student ON public.student_textbook_progress (student_profile_id);
CREATE INDEX idx_stp_textbook ON public.student_textbook_progress (textbook_id);
CREATE INDEX idx_stp_source_class ON public.student_textbook_progress (source_class_id);
