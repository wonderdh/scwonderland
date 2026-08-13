-- Raz 책 목록 + 학생별 읽음 체크
-- 설계: docs/superpowers/specs/2026-08-13-raz-reading-design.md

create table public.raz_books (
  id          int primary key,          -- raz 고유 id. 표지 URL(covers/{id}.webp) 조합에도 사용
  title       text not null,
  level       text not null,            -- aa~Z2 (29개)
  level_order int not null,             -- aa=0, A=1, ..., Z=26, Z1=27, Z2=28
  grade       text,
  lexile      text,                     -- 원문 "440L", "BR70L"
  lexile_num  int,                      -- "BR70L"→-70, "440L"→440
  genre       text,
  genre2      text,
  multilevel  boolean not null default false
);

comment on table public.raz_books is 'raz-plus.com 책 카탈로그 (정적 데이터, service role 스크립트로만 적재)';

create table public.raz_read_logs (
  student_id uuid not null references public.students(id) on delete cascade,
  book_id    int  not null references public.raz_books(id),
  read_at    timestamptz not null default now(),
  marked_by  uuid references public.profiles(id),  -- actor: 학생 본인·교사·admin
  primary key (student_id, book_id)
);

comment on table public.raz_read_logs is '읽음 = 행 존재. 체크 insert / 해제 delete (update 없음).';

create index raz_read_logs_book_id_idx on public.raz_read_logs (book_id);

alter table public.raz_books enable row level security;
alter table public.raz_read_logs enable row level security;

revoke all on public.raz_books from anon;
revoke all on public.raz_read_logs from anon;

-- books: authenticated 전체 select. 쓰기 정책 없음 (적재는 service role).
create policy "raz_books_authenticated_select" on public.raz_books
  for select to authenticated using (true);

-- read_logs: 본인 또는 teacher/admin. update 정책 없음.
create policy "raz_read_logs_select" on public.raz_read_logs
  for select to authenticated
  using (
    student_id = (select auth.uid())
    or (select private.get_my_role()) = any (
      array['admin'::public.user_role, 'teacher'::public.user_role]
    )
  );

create policy "raz_read_logs_insert" on public.raz_read_logs
  for insert to authenticated
  with check (
    (
      student_id = (select auth.uid())
      or (select private.get_my_role()) = any (
        array['admin'::public.user_role, 'teacher'::public.user_role]
      )
    )
    and marked_by = (select auth.uid())
  );

create policy "raz_read_logs_delete" on public.raz_read_logs
  for delete to authenticated
  using (
    student_id = (select auth.uid())
    or (select private.get_my_role()) = any (
      array['admin'::public.user_role, 'teacher'::public.user_role]
    )
  );

-- 표지 버킷: public read. 업로드는 service role 스크립트로만 — 쓰기 정책 없음.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('raz-covers', 'raz-covers', true, 5242880, array['image/webp'])
on conflict (id) do nothing;

-- ROLLBACK:
-- BEGIN;
-- DROP TABLE IF EXISTS public.raz_read_logs;
-- DROP TABLE IF EXISTS public.raz_books;
-- DROP POLICY 는 테이블 drop 으로 함께 제거. 버킷은 콘솔에서 수동 정리.
-- COMMIT;
