-- 교재 부여 row 의 "쉬는 날" 추가
-- · class_textbooks.skip_dates date[] 추가 (DEFAULT '{}', NOT NULL)
-- · student_textbooks.skip_dates date[] 추가 (대칭성)
-- · GIN index for array containment queries
-- 권한: admin OR 한국 교사가 academy/teacher 에서 수정 (기존 update 정책 그대로 적용)

set search_path = public;

alter table public.class_textbooks
  add column if not exists skip_dates date[] not null default '{}'::date[];

alter table public.student_textbooks
  add column if not exists skip_dates date[] not null default '{}'::date[];

comment on column public.class_textbooks.skip_dates is '숙제 안 내는 날짜 목록. homework_days 패턴의 일자별 예외.';
comment on column public.student_textbooks.skip_dates is '숙제 안 내는 날짜 목록. homework_days 패턴의 일자별 예외.';

create index if not exists class_textbooks_skip_dates_gin on public.class_textbooks using gin (skip_dates);
create index if not exists student_textbooks_skip_dates_gin on public.student_textbooks using gin (skip_dates);
