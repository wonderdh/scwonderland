-- ============================================
-- 공지사항 (notices) 테이블 + 첨부파일 테이블
-- Supabase SQL Editor에서 직접 실행
-- ============================================

-- 1. notices 테이블
CREATE TABLE public.notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT,
  excerpt TEXT,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_published BOOLEAN DEFAULT true,
  is_pinned BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notices_published ON public.notices (is_published, is_pinned DESC, published_at DESC);

-- 2. notice_attachments 테이블
CREATE TABLE public.notice_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id UUID NOT NULL REFERENCES public.notices(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('image', 'attachment')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notice_attachments_notice ON public.notice_attachments (notice_id, file_type, sort_order);

-- 3. RLS 정책
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notice_attachments ENABLE ROW LEVEL SECURITY;

-- notices: 공개 읽기 (게시된 것만), admin만 쓰기
CREATE POLICY "notices_public_read" ON public.notices
  FOR SELECT USING (is_published = true);

CREATE POLICY "notices_admin_all" ON public.notices
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role = 'admin'
    )
  );

-- notice_attachments: 공개 읽기, admin만 쓰기
CREATE POLICY "notice_attachments_public_read" ON public.notice_attachments
  FOR SELECT USING (
    notice_id IN (SELECT id FROM public.notices WHERE is_published = true)
  );

CREATE POLICY "notice_attachments_admin_all" ON public.notice_attachments
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role = 'admin'
    )
  );

-- ============================================
-- Storage 버킷 생성 (Supabase Dashboard에서 수동 생성 권장)
-- 버킷명: notice-files
-- 공개여부: Public
-- ============================================
