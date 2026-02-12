-- ============================================================
-- report_cards 테이블 (학생별 월간 리포트카드)
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================
-- 학생 FK: student_profile_id (profiles.id) 사용.
--   - 앱에서 학생 선택 시 이미 profile_id를 쓰고 있어서 조회가 단순함.
--   - 대안: student_id uuid REFERENCES students(id) 로 두면
--     정규화는 좋지만, 조회할 때마다 students JOIN 필요.
-- 작성: 선생/admin만. 학생은 자신의 리포트카드에 답글(reply)만 가능.
-- ============================================================

-- 테이블 생성
CREATE TABLE public.report_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year smallint NOT NULL CHECK (year >= 2000 AND year <= 2100),
  month smallint NOT NULL CHECK (month >= 1 AND month <= 12),
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  content text,
  reply text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_profile_id, year, month)
);

COMMENT ON COLUMN public.report_cards.student_profile_id IS '학생의 profile id (선택 시 사용하는 id와 동일)';
COMMENT ON COLUMN public.report_cards.author_id IS '리포트 작성자 (선생 또는 admin)';
COMMENT ON COLUMN public.report_cards.content IS '리포트 본문';
COMMENT ON COLUMN public.report_cards.reply IS '학생이 다는 답글';

-- 인덱스
CREATE INDEX idx_report_cards_student_profile_id ON public.report_cards(student_profile_id);
CREATE INDEX idx_report_cards_year_month ON public.report_cards(year, month);

-- updated_at 자동 갱신 (선택)
CREATE OR REPLACE FUNCTION public.set_report_cards_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_report_cards_updated_at
  BEFORE UPDATE ON public.report_cards
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_report_cards_updated_at();

-- RLS 활성화
ALTER TABLE public.report_cards ENABLE ROW LEVEL SECURITY;

-- SELECT: admin/선생 전부 조회 가능, 학생은 자신 것만
CREATE POLICY "report_cards_select"
ON public.report_cards FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'teacher')
  )
  OR student_profile_id = auth.uid()
);

-- INSERT: 선생 또는 admin만
CREATE POLICY "report_cards_insert"
ON public.report_cards FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'teacher')
  )
);

-- UPDATE: 선생/admin은 전부 수정 가능, 학생은 자신의 행만 수정 가능
-- (학생이 수정할 때는 앱에서 reply 컬럼만 보내도록 제한할 것)
CREATE POLICY "report_cards_update"
ON public.report_cards FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'teacher')
  )
  OR student_profile_id = auth.uid()
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'teacher')
  )
  OR student_profile_id = auth.uid()
);

-- DELETE: 선생 또는 admin만
CREATE POLICY "report_cards_delete"
ON public.report_cards FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'teacher')
  )
);
