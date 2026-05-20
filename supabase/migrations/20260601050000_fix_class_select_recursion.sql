-- Fix A3 (20260601020000_narrow_class_select_policies.sql) 의 infinite recursion 버그:
--   class_students_select 정책이 EXISTS (... FROM class_students me ...) 로 자기 자신을 참조 → recursion
--   class_students_select ↔ class_teachers_select 가 서로 EXISTS → mutual recursion
--
-- 해결: SECURITY DEFINER 헬퍼 함수로 RLS 우회 후 set 비교.
--   private.get_my_role() 와 동일 패턴 (search_path='' + security definer + stable).

-- Helper 1: 현재 사용자가 학생으로 등록된 class_id 목록 (RLS 우회)
create or replace function private.my_student_class_ids()
returns setof uuid
language sql
security definer
stable
set search_path = ''
as $$
  select cs.class_id
  from public.class_students cs
  where cs.student_id = (select auth.uid());
$$;

-- Helper 2: 현재 사용자가 교사로 매핑된 class_id 목록 (RLS 우회)
create or replace function private.my_teacher_class_ids()
returns setof uuid
language sql
security definer
stable
set search_path = ''
as $$
  select ct.class_id
  from public.class_teachers ct
  where ct.teacher_id = (select auth.uid());
$$;

-- 권한: authenticated 만 실행 가능 (anon 차단)
revoke all on function private.my_student_class_ids() from public;
revoke all on function private.my_teacher_class_ids() from public;
grant execute on function private.my_student_class_ids() to authenticated;
grant execute on function private.my_teacher_class_ids() to authenticated;

-- 1) classes_select — 본인 반 또는 staff (헬퍼 사용)
drop policy if exists "classes_select" on public.classes;
create policy "classes_select" on public.classes
  for select to authenticated
  using (
    (select private.get_my_role()) = any (
      array['admin'::public.user_role, 'teacher'::public.user_role]
    )
    or classes.id in (select private.my_student_class_ids())
    or classes.id in (select private.my_teacher_class_ids())
  );

-- 2) class_students_select — 본인 row + 같은 반 학생 + 본인이 담당 교사인 반 + staff
drop policy if exists "class_students_select" on public.class_students;
create policy "class_students_select" on public.class_students
  for select to authenticated
  using (
    (select private.get_my_role()) = any (
      array['admin'::public.user_role, 'teacher'::public.user_role]
    )
    or class_students.student_id = (select auth.uid())
    or class_students.class_id in (select private.my_student_class_ids())
    or class_students.class_id in (select private.my_teacher_class_ids())
  );

-- 3) class_teachers_select — 본인 교사 row + 본인이 학생인 반의 교사 매핑 + staff
drop policy if exists "class_teachers_select" on public.class_teachers;
create policy "class_teachers_select" on public.class_teachers
  for select to authenticated
  using (
    (select private.get_my_role()) = any (
      array['admin'::public.user_role, 'teacher'::public.user_role]
    )
    or class_teachers.teacher_id = (select auth.uid())
    or class_teachers.class_id in (select private.my_student_class_ids())
  );

-- 4) class_schedules_select — 본인 반의 스케줄 + staff
drop policy if exists "class_schedules_select" on public.class_schedules;
create policy "class_schedules_select" on public.class_schedules
  for select to authenticated
  using (
    (select private.get_my_role()) = any (
      array['admin'::public.user_role, 'teacher'::public.user_role]
    )
    or class_schedules.class_id in (select private.my_student_class_ids())
    or class_schedules.class_id in (select private.my_teacher_class_ids())
  );

-- ROLLBACK:
-- BEGIN;
-- DROP POLICY IF EXISTS "classes_select" ON public.classes;
-- DROP POLICY IF EXISTS "class_students_select" ON public.class_students;
-- DROP POLICY IF EXISTS "class_teachers_select" ON public.class_teachers;
-- DROP POLICY IF EXISTS "class_schedules_select" ON public.class_schedules;
-- DROP FUNCTION IF EXISTS private.my_student_class_ids();
-- DROP FUNCTION IF EXISTS private.my_teacher_class_ids();
-- -- (그 다음 20260601020000 의 원본 정책 재실행하거나 USING(true) 복원)
-- COMMIT;
