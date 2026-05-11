-- 교재 부여 권한 재배치
-- · 부여(INSERT) / 해제(DELETE): admin only
-- · 요일·메모 수정(UPDATE): admin OR 한국 교사 (선생님이 숙제 요일 결정)
-- 진도(student_textbook_progress)는 변경 없음 (admin + korean teacher).

set search_path = public;

-- =================================================================
-- class_textbooks: INSERT/DELETE → admin only, UPDATE → admin or korean
-- =================================================================

drop policy if exists "class_textbooks_staff_insert" on public.class_textbooks;
create policy "class_textbooks_admin_insert" on public.class_textbooks
  for insert to authenticated
  with check ((select private.get_my_role()) = 'admin'::public.user_role);

drop policy if exists "class_textbooks_staff_update" on public.class_textbooks;
create policy "class_textbooks_staff_update" on public.class_textbooks
  for update to authenticated
  using (
    (select private.get_my_role()) = 'admin'::public.user_role
    or private.is_korean_teacher()
  )
  with check (
    (select private.get_my_role()) = 'admin'::public.user_role
    or private.is_korean_teacher()
  );

drop policy if exists "class_textbooks_staff_delete" on public.class_textbooks;
create policy "class_textbooks_admin_delete" on public.class_textbooks
  for delete to authenticated
  using ((select private.get_my_role()) = 'admin'::public.user_role);

-- =================================================================
-- student_textbooks: INSERT/DELETE → admin only, UPDATE → admin or korean
-- =================================================================

drop policy if exists "student_textbooks_staff_insert" on public.student_textbooks;
create policy "student_textbooks_admin_insert" on public.student_textbooks
  for insert to authenticated
  with check ((select private.get_my_role()) = 'admin'::public.user_role);

drop policy if exists "student_textbooks_staff_update" on public.student_textbooks;
create policy "student_textbooks_staff_update" on public.student_textbooks
  for update to authenticated
  using (
    (select private.get_my_role()) = 'admin'::public.user_role
    or private.is_korean_teacher()
  )
  with check (
    (select private.get_my_role()) = 'admin'::public.user_role
    or private.is_korean_teacher()
  );

drop policy if exists "student_textbooks_staff_delete" on public.student_textbooks;
create policy "student_textbooks_admin_delete" on public.student_textbooks
  for delete to authenticated
  using ((select private.get_my_role()) = 'admin'::public.user_role);
