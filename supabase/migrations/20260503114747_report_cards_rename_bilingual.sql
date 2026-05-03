-- ============================================================
-- report_cards 양국어 컬럼 명명 통일
--
-- before:
--   content    text   -- 영어 본문 (suffix 없음 → 헷갈림)
--   content_ko text   -- 한국어 번역
--   reply      text   -- 한국어 답글 (suffix 없음 → 헷갈림)
--   reply_en   text   -- 영어 번역
--
-- after:
--   content_en text
--   content_ko text
--   reply_ko   text
--   reply_en   text
--
-- ⚠️ 코드 동시 수정 필요 (별도 commit). 본 마이그레이션은 컬럼만 rename.
-- ============================================================

alter table public.report_cards rename column content to content_en;
alter table public.report_cards rename column reply   to reply_ko;
