-- 변경사항:
--   1. homework_unit_progress 테이블 + 관련 트리거/함수 모두 삭제 (unit-level 추적 폐기)
--   2. student_homework_books: textbook_id 제거, note 제거, class_homework_book_id FK 추가
--   3. student_textbook_progress → student_homework_progress 로 rename
--      · student_id / textbook_id / completed_units / started_at / completed_at / note 제거
--      · student_homework_book_id FK 로 단일화 (1:1)
--   4. RLS / 인덱스 재생성
--   5. 새 auto-seed 트리거:
--      · class_homework_books INSERT → 그 반의 active 학생마다 student_homework_books 생성
--      · student_homework_books INSERT → student_homework_progress 생성 (status='not_started')
--      · class_students INSERT(active) → 그 반의 모든 class_homework_books 에 대해 student_homework_books 생성
--
-- 주의: dev 환경. 기존 데이터는 truncate.

set search_path = public;

-- =================================================================
-- 1. homework_unit_progress 및 관련 트리거 일괄 삭제
-- =================================================================
drop trigger if exists tg_class_textbook_seed_units on public.class_homework_books;
drop trigger if exists tg_student_textbook_seed_units on public.student_homework_books;
drop trigger if exists tg_class_student_seed_units on public.class_students;
drop function if exists public.tg_class_textbook_seed_units();
drop function if exists public.tg_student_textbook_seed_units();
drop function if exists public.tg_class_student_seed_units();
drop table if exists public.homework_unit_progress cascade;

-- =================================================================
-- 2. 기존 progress seed 트리거 제거 (schema 가 바뀌므로)
-- =================================================================
drop trigger if exists tg_class_textbook_seed_progress on public.class_homework_books;
drop trigger if exists tg_student_textbook_seed_progress on public.student_homework_books;
drop trigger if exists tg_class_student_seed_progress on public.class_students;
drop function if exists public.tg_class_textbook_seed_progress();
drop function if exists public.tg_student_textbook_seed_progress();
drop function if exists public.tg_class_student_seed_progress();

-- =================================================================
-- 3. 기존 데이터 정리 (schema 호환 불가)
-- =================================================================
truncate public.student_textbook_progress cascade;
truncate public.student_homework_books cascade;

-- =================================================================
-- 4. student_homework_books 재구조
--    textbook_id → class_homework_book_id, note 제거
-- =================================================================
alter table public.student_homework_books
  drop column if exists textbook_id cascade,
  drop column if exists note cascade;

alter table public.student_homework_books
  add column if not exists class_homework_book_id uuid not null
    references public.class_homework_books(id) on delete cascade;

create index if not exists shb_class_homework_book_idx
  on public.student_homework_books (class_homework_book_id);

alter table public.student_homework_books
  add constraint student_homework_books_uk_student_class_book
  unique (student_id, class_homework_book_id);

comment on table public.student_homework_books is
  '학생별 책 부여 — class_homework_books 의 row 를 가리키는 instance. 학생 한 명이 한 반 책에 1 row.';

-- =================================================================
-- 5. student_textbook_progress → student_homework_progress + restructure
-- =================================================================
alter table public.student_textbook_progress rename to student_homework_progress;

drop policy if exists "stp_select" on public.student_homework_progress;
drop policy if exists "stp_staff_insert" on public.student_homework_progress;
drop policy if exists "stp_staff_update" on public.student_homework_progress;
drop policy if exists "stp_staff_delete" on public.student_homework_progress;

alter table public.student_homework_progress
  drop column if exists student_id cascade,
  drop column if exists textbook_id cascade,
  drop column if exists completed_units cascade,
  drop column if exists started_at cascade,
  drop column if exists completed_at cascade,
  drop column if exists note cascade;

alter table public.student_homework_progress
  add column if not exists student_homework_book_id uuid not null
    references public.student_homework_books(id) on delete cascade;

alter table public.student_homework_progress
  add constraint student_homework_progress_uk_book
  unique (student_homework_book_id);

create index if not exists shp_book_idx
  on public.student_homework_progress (student_homework_book_id);

comment on table public.student_homework_progress is
  'student_homework_books 별 단일 진도 row. status 만 보관 (per-unit 폐기).';

-- =================================================================
-- 6. RLS — student_homework_progress
--    학생 본인 (소속 book 의 student_id 매칭) + admin/teacher SELECT
--    mutation 은 admin / korean teacher
-- =================================================================
create policy "shp_select" on public.student_homework_progress
  for select to authenticated
  using (
    (select private.get_my_role()) = any (array['admin'::public.user_role, 'teacher'::public.user_role])
    or exists (
      select 1 from public.student_homework_books shb
      where shb.id = student_homework_progress.student_homework_book_id
        and shb.student_id = auth.uid()
    )
  );

create policy "shp_staff_insert" on public.student_homework_progress
  for insert to authenticated
  with check (
    (select private.get_my_role()) = 'admin'::public.user_role
    or private.is_korean_teacher()
  );

create policy "shp_staff_update" on public.student_homework_progress
  for update to authenticated
  using (
    (select private.get_my_role()) = 'admin'::public.user_role
    or private.is_korean_teacher()
  )
  with check (
    (select private.get_my_role()) = 'admin'::public.user_role
    or private.is_korean_teacher()
  );

create policy "shp_staff_delete" on public.student_homework_progress
  for delete to authenticated
  using (
    (select private.get_my_role()) = 'admin'::public.user_role
    or private.is_korean_teacher()
  );

grant select, insert, update, delete on public.student_homework_progress to authenticated;

-- =================================================================
-- 7. 새 auto-seed 트리거
-- =================================================================

-- 7-1. class_homework_books INSERT → 그 반의 active 학생마다 student_homework_books
create or replace function public.tg_class_homework_book_seed_students() returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  insert into public.student_homework_books (student_id, class_homework_book_id)
  select cs.student_id, NEW.id
  from public.class_students cs
  where cs.class_id = NEW.class_id
    and cs.is_active = true
  on conflict (student_id, class_homework_book_id) do nothing;
  return NEW;
end;
$$;

alter function public.tg_class_homework_book_seed_students() owner to postgres;

drop trigger if exists tg_class_homework_book_seed_students on public.class_homework_books;
create trigger tg_class_homework_book_seed_students
  after insert on public.class_homework_books
  for each row execute function public.tg_class_homework_book_seed_students();

-- 7-2. student_homework_books INSERT → student_homework_progress 행 생성
create or replace function public.tg_student_homework_book_seed_progress() returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  insert into public.student_homework_progress (student_homework_book_id, status)
  values (NEW.id, 'not_started')
  on conflict (student_homework_book_id) do nothing;
  return NEW;
end;
$$;

alter function public.tg_student_homework_book_seed_progress() owner to postgres;

drop trigger if exists tg_student_homework_book_seed_progress on public.student_homework_books;
create trigger tg_student_homework_book_seed_progress
  after insert on public.student_homework_books
  for each row execute function public.tg_student_homework_book_seed_progress();

-- 7-3. class_students INSERT(active) → 그 반의 모든 class_homework_books 에 student_homework_books
create or replace function public.tg_class_student_seed_homework_books() returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  if NEW.is_active is not true then
    return NEW;
  end if;
  insert into public.student_homework_books (student_id, class_homework_book_id)
  select NEW.student_id, chb.id
  from public.class_homework_books chb
  where chb.class_id = NEW.class_id
  on conflict (student_id, class_homework_book_id) do nothing;
  return NEW;
end;
$$;

alter function public.tg_class_student_seed_homework_books() owner to postgres;

drop trigger if exists tg_class_student_seed_homework_books on public.class_students;
create trigger tg_class_student_seed_homework_books
  after insert on public.class_students
  for each row execute function public.tg_class_student_seed_homework_books();
