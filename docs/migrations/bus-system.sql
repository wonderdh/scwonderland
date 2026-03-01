-- ============================================
-- 승하차(버스) 시스템 테이블 v2
-- academy_periods 기반 재설계
-- ============================================

-- 1. bus_numbers (호차)
CREATE TABLE public.bus_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX uq_bus_numbers_label ON public.bus_numbers (label) WHERE is_active = true;

-- 2. academy_periods (수업 시간대)
CREATE TABLE public.academy_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,              -- "1교시", "2교시"
  start_time TIME NOT NULL,        -- 수업 시작 시간
  end_time TIME NOT NULL,          -- 수업 종료 시간
  has_pickup BOOLEAN NOT NULL DEFAULT false,   -- 등원 버스 운행 여부
  has_dropoff BOOLEAN NOT NULL DEFAULT false,  -- 하원 버스 운행 여부
  group_label TEXT CHECK (group_label IN ('유치부', '방과후', '오후반')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. student_bus_defaults (학생별 주간 기본 배정)
CREATE TABLE public.student_bus_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),  -- 1=월 ~ 5=금 (ISO 8601)
  direction TEXT NOT NULL CHECK (direction IN ('pickup', 'dropoff')),
  academy_period_id UUID NOT NULL REFERENCES public.academy_periods(id) ON DELETE RESTRICT,
  bus_number_id UUID NOT NULL REFERENCES public.bus_numbers(id) ON DELETE RESTRICT,
  estimated_time TIME,             -- 학생 실제 버스 탑승/하차 예상시간
  note TEXT,                        -- 승하차 위치 메모 (예: "아파트 정문 앞")
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (student_profile_id, day_of_week, direction)
);
CREATE INDEX idx_sbd_student ON public.student_bus_defaults (student_profile_id);
CREATE INDEX idx_sbd_day_direction ON public.student_bus_defaults (day_of_week, direction);

-- 4. bus_change_requests (날짜별 변경 요청)
CREATE TABLE public.bus_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_date DATE NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('pickup', 'dropoff')),
  change_type TEXT NOT NULL CHECK (change_type IN ('change', 'no_ride')),
  new_academy_period_id UUID REFERENCES public.academy_periods(id) ON DELETE RESTRICT,
  new_bus_number_id UUID REFERENCES public.bus_numbers(id) ON DELETE RESTRICT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  requested_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_change_refs CHECK (
    change_type = 'no_ride' OR (new_academy_period_id IS NOT NULL AND new_bus_number_id IS NOT NULL)
  ),
  UNIQUE (student_profile_id, request_date, direction)
);
CREATE INDEX idx_bcr_date_direction ON public.bus_change_requests (request_date, direction);
CREATE INDEX idx_bcr_pending ON public.bus_change_requests (status) WHERE status = 'pending';
CREATE INDEX idx_bcr_student ON public.bus_change_requests (student_profile_id);

-- 5. RLS 정책
ALTER TABLE public.bus_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_bus_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bus_change_requests ENABLE ROW LEVEL SECURITY;

-- bus_numbers: 인증 사용자 읽기, admin 전체
CREATE POLICY "bus_numbers_auth_read" ON public.bus_numbers
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "bus_numbers_admin_all" ON public.bus_numbers
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  );

-- academy_periods: 인증 사용자 읽기, admin 전체
CREATE POLICY "academy_periods_auth_read" ON public.academy_periods
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "academy_periods_admin_all" ON public.academy_periods
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  );

-- student_bus_defaults: 본인 읽기, admin 전체, 교사 읽기
CREATE POLICY "sbd_self_read" ON public.student_bus_defaults
  FOR SELECT USING (auth.uid() = student_profile_id);
CREATE POLICY "sbd_admin_all" ON public.student_bus_defaults
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  );
CREATE POLICY "sbd_teacher_read" ON public.student_bus_defaults
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'teacher')
  );

-- bus_change_requests: 본인 읽기/생성, admin 전체, 교사 읽기/수정
CREATE POLICY "bcr_self_read" ON public.bus_change_requests
  FOR SELECT USING (auth.uid() = student_profile_id);
CREATE POLICY "bcr_self_insert" ON public.bus_change_requests
  FOR INSERT WITH CHECK (auth.uid() = student_profile_id);
CREATE POLICY "bcr_admin_all" ON public.bus_change_requests
  FOR ALL USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  );
CREATE POLICY "bcr_teacher_read" ON public.bus_change_requests
  FOR SELECT USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'teacher')
  );
CREATE POLICY "bcr_teacher_update" ON public.bus_change_requests
  FOR UPDATE USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'teacher')
  );

-- ============================================
-- 되돌리기 (rollback)
-- ============================================
-- DROP TABLE IF EXISTS public.bus_change_requests CASCADE;
-- DROP TABLE IF EXISTS public.student_bus_defaults CASCADE;
-- DROP TABLE IF EXISTS public.academy_periods CASCADE;
-- DROP TABLE IF EXISTS public.bus_numbers CASCADE;
