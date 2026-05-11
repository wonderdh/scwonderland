-- 숙제 일별 체크 (homework_completion) — attendance 패턴 차용
-- · 학생-일자 단위 (UNIQUE: student_id + completion_date)
-- · status: completed | partial | missed (NOT NULL CHECK)
-- · skipped_textbook_ids uuid[] : 부분 완료 시 빠진 책 ID
-- · RLS: 학생 본인 SELECT, admin OR 한국 교사 ALL
-- 참고: .omc/plans/homework-daily-completion.md

set search_path = public;

-- =================================================================
-- 1. homework_completion 테이블
-- =================================================================

create table if not exists public.homework_completion (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  completion_date date not null,
  status text not null check (status in ('completed','partial','missed')),
  skipped_textbook_ids uuid[] not null default '{}'::uuid[],
  note text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, completion_date)
);

alter table public.homework_completion owner to postgres;

comment on table public.homework_completion is '학생별 숙제 일자별 체크. attendance 와 별도 도메인 (출석은 했지만 숙제 안 한 케이스 분리).';
comment on column public.homework_completion.skipped_textbook_ids is '부분 완료 시 빠뜨린 책 ID 들. status=partial 일 때만 의미. completed/missed 일 때는 빈 배열.';

create index if not exists hc_student_idx on public.homework_completion (student_id);
create index if not exists hc_date_idx on public.homework_completion (completion_date);
create index if not exists hc_student_date_idx on public.homework_completion (student_id, completion_date);

-- =================================================================
-- 2. updated_at 트리거
-- =================================================================

drop trigger if exists tg_homework_completion_set_updated_at on public.homework_completion;
create trigger tg_homework_completion_set_updated_at
  before update on public.homework_completion
  for each row execute function public.tg_set_updated_at();

-- =================================================================
-- 3. RLS
-- =================================================================

alter table public.homework_completion enable row level security;

drop policy if exists "homework_completion_select" on public.homework_completion;
create policy "homework_completion_select" on public.homework_completion
  for select to authenticated
  using (
    student_id = auth.uid()
    or (select private.get_my_role()) = any (array['admin'::public.user_role, 'teacher'::public.user_role])
  );

drop policy if exists "homework_completion_staff_insert" on public.homework_completion;
create policy "homework_completion_staff_insert" on public.homework_completion
  for insert to authenticated
  with check (
    (select private.get_my_role()) = 'admin'::public.user_role
    or private.is_korean_teacher()
  );

drop policy if exists "homework_completion_staff_update" on public.homework_completion;
create policy "homework_completion_staff_update" on public.homework_completion
  for update to authenticated
  using (
    (select private.get_my_role()) = 'admin'::public.user_role
    or private.is_korean_teacher()
  )
  with check (
    (select private.get_my_role()) = 'admin'::public.user_role
    or private.is_korean_teacher()
  );

drop policy if exists "homework_completion_staff_delete" on public.homework_completion;
create policy "homework_completion_staff_delete" on public.homework_completion
  for delete to authenticated
  using (
    (select private.get_my_role()) = 'admin'::public.user_role
    or private.is_korean_teacher()
  );

grant select, insert, update, delete on public.homework_completion to authenticated;
