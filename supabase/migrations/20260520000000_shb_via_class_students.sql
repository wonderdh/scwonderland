-- student_homework_books.student_id (→ students 직접) 를 class_students 경유 FK 로 교체.
--
-- 변경:
--   student_homework_books.student_id (FK students) 제거
--   → class_student_id (FK class_students.id) 추가
--   학생 정보는 join 으로 class_students.student_id 에서 가져옴.
--
-- 부수 효과:
--   · class_students(class_id, student_id) UK 추가 (중복 가입 방지 + FK 무결성).
--   · UK (student_id, class_homework_book_id) → (class_student_id, class_homework_book_id) 로 교체.
--   · RLS 정책 재선언 (student_homework_books, student_homework_progress).
--   · 시드 트리거 2개 재선언.

set search_path = public;

-- =================================================================
-- 1. class_students(class_id, student_id) UK 보장
-- =================================================================
alter table public.class_students
  drop constraint if exists class_students_class_id_student_id_key;

alter table public.class_students
  add constraint class_students_class_id_student_id_key
  unique (class_id, student_id);

-- =================================================================
-- 2. class_student_id 추가 + 백필
-- =================================================================
alter table public.student_homework_books
  add column if not exists class_student_id uuid;

update public.student_homework_books shb
  set class_student_id = cs.id
  from public.class_students cs,
       public.class_homework_books chb
  where chb.id = shb.class_homework_book_id
    and cs.class_id = chb.class_id
    and cs.student_id = shb.student_id
    and shb.class_student_id is null;

-- 백필 실패 row (그 학생이 그 반에 enrolled 아님) 은 정리
delete from public.student_homework_books
  where class_student_id is null;

alter table public.student_homework_books
  alter column class_student_id set not null;

alter table public.student_homework_books
  add constraint student_homework_books_class_student_id_fkey
  foreign key (class_student_id) references public.class_students(id) on delete cascade;

create index if not exists shb_class_student_idx
  on public.student_homework_books (class_student_id);

-- =================================================================
-- 3. 기존 RLS 정책 drop (student_id 참조하던 것들)
-- =================================================================
drop policy if exists "student_textbooks_select" on public.student_homework_books;
drop policy if exists "student_textbooks_staff_insert" on public.student_homework_books;
drop policy if exists "student_textbooks_staff_update" on public.student_homework_books;
drop policy if exists "student_textbooks_staff_delete" on public.student_homework_books;
drop policy if exists "shp_select" on public.student_homework_progress;

-- =================================================================
-- 4. student_id 컬럼 / 옛 UK 제거
-- =================================================================
alter table public.student_homework_books
  drop constraint if exists student_homework_books_uk_student_class_book;

alter table public.student_homework_books
  drop column if exists student_id cascade;

-- =================================================================
-- 5. 새 UK
-- =================================================================
alter table public.student_homework_books
  add constraint student_homework_books_uk_class_student_class_book
  unique (class_student_id, class_homework_book_id);

-- =================================================================
-- 6. RLS 정책 재선언
-- =================================================================
create policy "student_homework_books_select" on public.student_homework_books
  for select to authenticated
  using (
    (select private.get_my_role()) = any (array['admin'::public.user_role, 'teacher'::public.user_role])
    or exists (
      select 1 from public.class_students cs
      where cs.id = student_homework_books.class_student_id
        and cs.student_id = auth.uid()
    )
  );

create policy "student_homework_books_staff_insert" on public.student_homework_books
  for insert to authenticated
  with check (
    (select private.get_my_role()) = 'admin'::public.user_role
    or private.is_korean_teacher()
  );

create policy "student_homework_books_staff_update" on public.student_homework_books
  for update to authenticated
  using (
    (select private.get_my_role()) = 'admin'::public.user_role
    or private.is_korean_teacher()
  )
  with check (
    (select private.get_my_role()) = 'admin'::public.user_role
    or private.is_korean_teacher()
  );

create policy "student_homework_books_staff_delete" on public.student_homework_books
  for delete to authenticated
  using (
    (select private.get_my_role()) = 'admin'::public.user_role
    or private.is_korean_teacher()
  );

-- student_homework_progress 의 select 정책: class_students 한 단계 더 join
create policy "shp_select" on public.student_homework_progress
  for select to authenticated
  using (
    (select private.get_my_role()) = any (array['admin'::public.user_role, 'teacher'::public.user_role])
    or exists (
      select 1
      from public.student_homework_books shb
        join public.class_students cs on cs.id = shb.class_student_id
      where shb.id = student_homework_progress.student_homework_book_id
        and cs.student_id = auth.uid()
    )
  );

-- =================================================================
-- 7. 시드 트리거 재선언 — class_student_id 로 insert
-- =================================================================

create or replace function public.tg_class_homework_book_seed_students() returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  insert into public.student_homework_books (class_student_id, class_homework_book_id)
  select cs.id, NEW.id
  from public.class_students cs
  where cs.class_id = NEW.class_id
    and cs.is_active = true
  on conflict (class_student_id, class_homework_book_id) do nothing;
  return NEW;
end;
$$;

create or replace function public.tg_class_student_seed_homework_books() returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $$
begin
  if NEW.is_active is not true then
    return NEW;
  end if;
  insert into public.student_homework_books (class_student_id, class_homework_book_id)
  select NEW.id, chb.id
  from public.class_homework_books chb
  where chb.class_id = NEW.class_id
  on conflict (class_student_id, class_homework_book_id) do nothing;
  return NEW;
end;
$$;
