-- student_homework_progress 를 per-unit row 로 재구조.
--
-- 출발 상태 (20260517 array 마이그레이션 적용 후):
--   id uuid PK, student_homework_book_id uuid (1:1 UK), status text, unit_statuses smallint[]
--
-- 목표 상태:
--   PK (student_homework_book_id, unit_number),
--   status text check ('pending'|'completed'|'missed'),
--   surrogate id / unit_statuses / 1:1 UK 제거.
--
-- 추적 단위: 책 → unit. 시드 트리거 재선언으로 total_units 만큼 행 생성.

set search_path = public;

-- =================================================================
-- 1. 기존 1:1 progress row 정리 (스키마 incompatible)
-- =================================================================
truncate public.student_homework_progress cascade;

-- =================================================================
-- 2. 기존 제약 / 컬럼 제거
-- =================================================================
alter table public.student_homework_progress
  drop constraint if exists student_homework_progress_uk_book;

alter table public.student_homework_progress
  drop constraint if exists student_homework_progress_status_check;
alter table public.student_homework_progress
  drop constraint if exists student_textbook_progress_status_check;

alter table public.student_homework_progress
  drop constraint if exists student_homework_progress_pkey;
alter table public.student_homework_progress
  drop constraint if exists student_textbook_progress_pkey;

alter table public.student_homework_progress
  drop column if exists id cascade;

alter table public.student_homework_progress
  drop column if exists unit_statuses cascade;

-- =================================================================
-- 3. unit_number 추가 + status default/check 갱신
-- =================================================================
alter table public.student_homework_progress
  add column if not exists unit_number integer not null check (unit_number >= 1);

alter table public.student_homework_progress
  alter column status set default 'pending';

alter table public.student_homework_progress
  add constraint student_homework_progress_status_check
  check (status in ('pending','completed','missed'));

-- =================================================================
-- 4. 컴포지트 PK 설정
-- =================================================================
alter table public.student_homework_progress
  add constraint student_homework_progress_pkey
  primary key (student_homework_book_id, unit_number);

-- shp_book_idx 가 있다면 컴포지트 PK 의 leading column 으로 커버되어 중복
drop index if exists public.shp_book_idx;

create index if not exists shp_status_idx
  on public.student_homework_progress (status);

comment on table public.student_homework_progress is
  '학생-책-unit 단위 진도. (student_homework_book_id, unit_number) 컴포지트 PK.';
comment on column public.student_homework_progress.unit_number is
  '1-based unit 번호. 시드 시 textbook.total_units 만큼 생성됨.';

-- =================================================================
-- 5. 시드 트리거 재선언 — N row 생성
-- =================================================================
create or replace function public.tg_student_homework_book_seed_progress() returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $$
declare
  v_total integer;
begin
  select tb.total_units into v_total
  from public.class_homework_books chb
    join public.textbooks tb on tb.id = chb.textbook_id
  where chb.id = NEW.class_homework_book_id;

  if v_total is null or v_total <= 0 then
    return NEW;
  end if;

  insert into public.student_homework_progress (
    student_homework_book_id, unit_number, status
  )
  select NEW.id, gs.n, 'pending'
  from generate_series(1, v_total) as gs(n)
  on conflict (student_homework_book_id, unit_number) do nothing;
  return NEW;
end;
$$;

-- =================================================================
-- 6. 기존 student_homework_books 행에 대한 백필
-- =================================================================
insert into public.student_homework_progress (
  student_homework_book_id, unit_number, status
)
select shb.id, gs.n, 'pending'
from public.student_homework_books shb
  join public.class_homework_books chb on chb.id = shb.class_homework_book_id
  join public.textbooks tb on tb.id = chb.textbook_id
  cross join lateral generate_series(1, tb.total_units) as gs(n)
where tb.total_units > 0
on conflict (student_homework_book_id, unit_number) do nothing;
