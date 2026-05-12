-- 부여 단위 예외일(휴일/스킵) 도입.
-- class_homework_books.skip_dates date[] — schedule 계산 시 이 날짜는 unit 미할당.

set search_path = public;

alter table public.class_homework_books
  add column if not exists skip_dates date[] not null default '{}';

comment on column public.class_homework_books.skip_dates is
  '이 부여의 예외(스킵) 날짜 (KST). homework_days 에 해당해도 이 날짜는 unit 분배에서 제외.';
