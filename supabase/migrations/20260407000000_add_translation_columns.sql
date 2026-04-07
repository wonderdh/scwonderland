-- 리포트카드 자동 번역 컬럼 추가
-- content_ko: 원어민 교사 영어 원문의 한국어 번역본
-- reply_en:   학부모 한국어 답글의 영어 번역본 (선택)

ALTER TABLE report_cards
  ADD COLUMN IF NOT EXISTS content_ko text,
  ADD COLUMN IF NOT EXISTS reply_en   text;
