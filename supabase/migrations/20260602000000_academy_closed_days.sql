-- 학원 공통 쉬는날(휴원일) 도입.
-- 숙제 unit↔채점일 계산(getUnitSchedule)의 skipDates 에 합집합되어, 이 날짜는
-- 숙제 부여·채점에서 제외된다. 하루 = 한 row (기간 입력은 서버 액션에서 개별 날짜로 펼쳐 저장).

set search_path = public;

create table if not exists public.academy_closed_days (
  id          uuid primary key default gen_random_uuid(),
  closed_date date not null unique,
  label       text,
  -- actor 컬럼 (admin 이 지정) → profiles 참조 (supabase/AGENTS.md FK 컨벤션).
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

comment on table public.academy_closed_days is
  '학원 공통 쉬는날(휴원일). getUnitSchedule skipDates 에 합집합되어 숙제 부여·채점일에서 제외.';
comment on column public.academy_closed_days.closed_date is
  '쉬는 날짜 (KST YYYY-MM-DD). UNIQUE — 하루 한 row.';
comment on column public.academy_closed_days.label is
  '사유 (예: 설날, 개교기념일). 선택.';

alter table public.academy_closed_days enable row level security;

-- 읽기: 인증된 staff(admin/teacher). 학생용 채점일은 서버에서 계산되어 내려가므로 학생 직접 조회 불필요.
drop policy if exists "academy_closed_days_select" on public.academy_closed_days;
create policy "academy_closed_days_select" on public.academy_closed_days
  for select to authenticated
  using (
    (select private.get_my_role()) = any (
      array['admin'::public.user_role, 'teacher'::public.user_role]
    )
  );

-- 쓰기(insert/update/delete): admin 전용.
drop policy if exists "academy_closed_days_admin_write" on public.academy_closed_days;
create policy "academy_closed_days_admin_write" on public.academy_closed_days
  for all to authenticated
  using ((select private.get_my_role()) = 'admin'::public.user_role)
  with check ((select private.get_my_role()) = 'admin'::public.user_role);

-- ROLLBACK:
-- BEGIN;
-- DROP TABLE IF EXISTS public.academy_closed_days;
-- COMMIT;
