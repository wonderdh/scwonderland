-- homework 관련 테이블에서 actor / 타임스탬프 메타 컬럼 제거.
-- 누가 언제 부여/수정했는지 추적 안 함 (audit 미사용).
--
-- 대상:
--   class_textbooks: assigned_by, assigned_at
--   student_textbooks: assigned_by, assigned_at
--   student_textbook_progress: updated_by

set search_path = public;

alter table public.class_textbooks
  drop column if exists assigned_by,
  drop column if exists assigned_at;

alter table public.student_textbooks
  drop column if exists assigned_by,
  drop column if exists assigned_at;

alter table public.student_textbook_progress
  drop column if exists updated_by;
