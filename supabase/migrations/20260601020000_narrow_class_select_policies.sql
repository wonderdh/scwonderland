-- Task A3 (REVIEW_DB §8.3, HIGH):
-- USING(true) 로 인증 사용자 전체에 노출되던 반/명부 SELECT 정책을 좁힘.
-- 학생: 본인이 등록된 반의 행만 (학생끼리 다른 반 명부 못 봄)
-- 교사: 본인이 담당하는 반의 행만 (teachers.id = auth.uid())
-- admin/teacher (role): 전체 (관리/대시보드 용)
--
-- 참고:
--   - 서버 액션에서 `admin client` (service_role) 를 쓰는 경로(academy/actions.ts 등) 는 RLS 우회 — 영향 없음.
--   - 클라이언트 SDK 로 RLS-enforced 직접 조회하는 경로는 admin / teacher role 이면 전체, 학생이면 본인 소속만 보이도록 좁힘.

-- 1) classes_select — 본인이 학생으로 등록된 반 또는 본인이 교사로 매핑된 반 또는 staff
drop policy if exists "classes_select" on public.classes;
create policy "classes_select" on public.classes
  for select to authenticated
  using (
    (select private.get_my_role()) = any (
      array['admin'::public.user_role, 'teacher'::public.user_role]
    )
    or exists (
      select 1
      from public.class_students cs
      where cs.class_id = classes.id
        and cs.student_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.class_teachers ct
      where ct.class_id = classes.id
        and ct.teacher_id = (select auth.uid())
    )
  );

-- 2) class_students_select — 본인 row + 같은 반 학생 (학생 본인이 등록된 반의 명부) + staff
--    학생끼리 같은 반 학생은 보이도록 (출석/짝궁 화면). 다른 반 학생은 안 보임.
drop policy if exists "class_students_select" on public.class_students;
create policy "class_students_select" on public.class_students
  for select to authenticated
  using (
    (select private.get_my_role()) = any (
      array['admin'::public.user_role, 'teacher'::public.user_role]
    )
    or class_students.student_id = (select auth.uid())
    or exists (
      select 1
      from public.class_students me
      where me.class_id = class_students.class_id
        and me.student_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.class_teachers ct
      where ct.class_id = class_students.class_id
        and ct.teacher_id = (select auth.uid())
    )
  );

-- 3) class_teachers_select — 본인 row (교사 본인) + 본인이 학생으로 등록된 반의 교사 매핑 + staff
drop policy if exists "class_teachers_select" on public.class_teachers;
create policy "class_teachers_select" on public.class_teachers
  for select to authenticated
  using (
    (select private.get_my_role()) = any (
      array['admin'::public.user_role, 'teacher'::public.user_role]
    )
    or class_teachers.teacher_id = (select auth.uid())
    or exists (
      select 1
      from public.class_students cs
      where cs.class_id = class_teachers.class_id
        and cs.student_id = (select auth.uid())
    )
  );

-- 4) class_schedules_select — 본인 반의 스케줄만 (학생: 등록된 반, 교사: 담당 반) + staff
drop policy if exists "class_schedules_select" on public.class_schedules;
create policy "class_schedules_select" on public.class_schedules
  for select to authenticated
  using (
    (select private.get_my_role()) = any (
      array['admin'::public.user_role, 'teacher'::public.user_role]
    )
    or exists (
      select 1
      from public.class_students cs
      where cs.class_id = class_schedules.class_id
        and cs.student_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.class_teachers ct
      where ct.class_id = class_schedules.class_id
        and ct.teacher_id = (select auth.uid())
    )
  );

-- ROLLBACK:
-- BEGIN;
-- DROP POLICY IF EXISTS "classes_select" ON public.classes;
-- CREATE POLICY "classes_select" ON public.classes FOR SELECT TO authenticated USING (true);
-- DROP POLICY IF EXISTS "class_students_select" ON public.class_students;
-- CREATE POLICY "class_students_select" ON public.class_students FOR SELECT TO authenticated USING (true);
-- DROP POLICY IF EXISTS "class_teachers_select" ON public.class_teachers;
-- CREATE POLICY "class_teachers_select" ON public.class_teachers FOR SELECT TO authenticated USING (true);
-- DROP POLICY IF EXISTS "class_schedules_select" ON public.class_schedules;
-- CREATE POLICY "class_schedules_select" ON public.class_schedules FOR SELECT TO authenticated USING (true);
-- COMMIT;
