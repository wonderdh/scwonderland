-- ============================================================
-- 9개 테이블 RLS 활성화 + 기본 정책
-- (cutover 직후 잔존 이슈, qa-report-2026-04-30.md 참고)
-- ============================================================
--
-- 정책 패턴:
--   - profiles/students/teachers: self-read OR admin/teacher all-read, admin write
--   - classes/class_students/class_teachers/academy_periods: 모든 authenticated read, admin write
--   - afterschool_enrollments: self/admin/teacher read, admin/teacher write
--   - class_schedules: 모든 authenticated read, admin/teacher write
--
-- 비고: get_my_role() 은 SECURITY DEFINER 함수로 무한 RLS 재귀 방지
-- ============================================================

-- ── profiles ────────────────────────────────────────────────
alter table public.profiles enable row level security;

drop policy if exists "profiles_self_or_staff_select" on public.profiles;
drop policy if exists "profiles_admin_write" on public.profiles;

create policy "profiles_self_or_staff_select" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.get_my_role() in ('admin', 'teacher'));

create policy "profiles_admin_write" on public.profiles
  for all to authenticated
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

-- ── students ────────────────────────────────────────────────
alter table public.students enable row level security;

drop policy if exists "students_self_or_staff_select" on public.students;
drop policy if exists "students_admin_write" on public.students;

create policy "students_self_or_staff_select" on public.students
  for select to authenticated
  using (id = auth.uid() or public.get_my_role() in ('admin', 'teacher'));

create policy "students_admin_write" on public.students
  for all to authenticated
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

-- ── teachers ────────────────────────────────────────────────
alter table public.teachers enable row level security;

drop policy if exists "teachers_self_or_staff_select" on public.teachers;
drop policy if exists "teachers_admin_write" on public.teachers;

create policy "teachers_self_or_staff_select" on public.teachers
  for select to authenticated
  using (id = auth.uid() or public.get_my_role() in ('admin', 'teacher'));

create policy "teachers_admin_write" on public.teachers
  for all to authenticated
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

-- ── classes ─────────────────────────────────────────────────
alter table public.classes enable row level security;

drop policy if exists "classes_authenticated_select" on public.classes;
drop policy if exists "classes_admin_write" on public.classes;

create policy "classes_authenticated_select" on public.classes
  for select to authenticated using (true);

create policy "classes_admin_write" on public.classes
  for all to authenticated
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

-- ── class_students ──────────────────────────────────────────
alter table public.class_students enable row level security;

drop policy if exists "class_students_authenticated_select" on public.class_students;
drop policy if exists "class_students_admin_write" on public.class_students;

create policy "class_students_authenticated_select" on public.class_students
  for select to authenticated using (true);

create policy "class_students_admin_write" on public.class_students
  for all to authenticated
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

-- ── class_teachers ──────────────────────────────────────────
alter table public.class_teachers enable row level security;

drop policy if exists "class_teachers_authenticated_select" on public.class_teachers;
drop policy if exists "class_teachers_admin_write" on public.class_teachers;

create policy "class_teachers_authenticated_select" on public.class_teachers
  for select to authenticated using (true);

create policy "class_teachers_admin_write" on public.class_teachers
  for all to authenticated
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

-- ── academy_periods ─────────────────────────────────────────
alter table public.academy_periods enable row level security;

drop policy if exists "academy_periods_authenticated_select" on public.academy_periods;
drop policy if exists "academy_periods_admin_write" on public.academy_periods;

create policy "academy_periods_authenticated_select" on public.academy_periods
  for select to authenticated using (true);

create policy "academy_periods_admin_write" on public.academy_periods
  for all to authenticated
  using (public.get_my_role() = 'admin')
  with check (public.get_my_role() = 'admin');

-- ── afterschool_enrollments ─────────────────────────────────
alter table public.afterschool_enrollments enable row level security;

drop policy if exists "afterschool_enrollments_self_or_staff_select" on public.afterschool_enrollments;
drop policy if exists "afterschool_enrollments_staff_write" on public.afterschool_enrollments;

create policy "afterschool_enrollments_self_or_staff_select" on public.afterschool_enrollments
  for select to authenticated
  using (student_id = auth.uid() or public.get_my_role() in ('admin', 'teacher'));

create policy "afterschool_enrollments_staff_write" on public.afterschool_enrollments
  for all to authenticated
  using (public.get_my_role() in ('admin', 'teacher'))
  with check (public.get_my_role() in ('admin', 'teacher'));

-- ── class_schedules ─────────────────────────────────────────
alter table public.class_schedules enable row level security;

drop policy if exists "class_schedules_authenticated_select" on public.class_schedules;
drop policy if exists "class_schedules_staff_write" on public.class_schedules;

create policy "class_schedules_authenticated_select" on public.class_schedules
  for select to authenticated using (true);

create policy "class_schedules_staff_write" on public.class_schedules
  for all to authenticated
  using (public.get_my_role() in ('admin', 'teacher'))
  with check (public.get_my_role() in ('admin', 'teacher'));
