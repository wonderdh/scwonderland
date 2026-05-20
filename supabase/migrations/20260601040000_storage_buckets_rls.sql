-- Task A5 (REVIEW_DB §8.5, HIGH):
-- 마이그레이션에 RLS 정책이 없던 storage 버킷 4개 정책 추가.
-- 정책 누락 시 anon R/W 가능. textbook-covers 와 동일한 idempotent 패턴.
--
-- 버킷:
--   - notice-files       : 학원 공지 첨부 (admin 작성, authenticated read)
--   - class-notices      : 반별 공지 첨부 (admin/teacher 작성, authenticated read)
--   - academy-notices    : 학원 단위 공지 첨부 (admin 작성, authenticated read)
--   - homework-submissions : 학생 숙제 제출물 (학생 본인 INSERT, admin/teacher SELECT/UPDATE/DELETE)
--
-- 정책은 모두 storage.objects 에 부여. bucket_id = '<name>' 으로 분기.

-- =================================================================
-- 1) 버킷 등록 (idempotent)
-- =================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'notice-files',
  'notice-files',
  false,
  20971520, -- 20MB
  null
)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'class-notices',
  'class-notices',
  false,
  20971520,
  null
)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'academy-notices',
  'academy-notices',
  false,
  20971520,
  null
)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'homework-submissions',
  'homework-submissions',
  false,
  52428800, -- 50MB (audio submission 포함)
  null
)
on conflict (id) do nothing;

-- =================================================================
-- 2) notice-files (학원 공지 첨부) — authenticated read, admin write
-- =================================================================

drop policy if exists "notice_files_authenticated_read" on storage.objects;
create policy "notice_files_authenticated_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'notice-files');

drop policy if exists "notice_files_admin_insert" on storage.objects;
create policy "notice_files_admin_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'notice-files'
    and (select private.get_my_role()) = 'admin'::public.user_role
  );

drop policy if exists "notice_files_admin_update" on storage.objects;
create policy "notice_files_admin_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'notice-files'
    and (select private.get_my_role()) = 'admin'::public.user_role
  )
  with check (
    bucket_id = 'notice-files'
    and (select private.get_my_role()) = 'admin'::public.user_role
  );

drop policy if exists "notice_files_admin_delete" on storage.objects;
create policy "notice_files_admin_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'notice-files'
    and (select private.get_my_role()) = 'admin'::public.user_role
  );

-- =================================================================
-- 3) class-notices (반별 공지 첨부) — authenticated read, staff write
-- =================================================================

drop policy if exists "class_notices_authenticated_read" on storage.objects;
create policy "class_notices_authenticated_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'class-notices');

drop policy if exists "class_notices_staff_insert" on storage.objects;
create policy "class_notices_staff_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'class-notices'
    and (select private.get_my_role()) = any (
      array['admin'::public.user_role, 'teacher'::public.user_role]
    )
  );

drop policy if exists "class_notices_staff_update" on storage.objects;
create policy "class_notices_staff_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'class-notices'
    and (select private.get_my_role()) = any (
      array['admin'::public.user_role, 'teacher'::public.user_role]
    )
  )
  with check (
    bucket_id = 'class-notices'
    and (select private.get_my_role()) = any (
      array['admin'::public.user_role, 'teacher'::public.user_role]
    )
  );

drop policy if exists "class_notices_staff_delete" on storage.objects;
create policy "class_notices_staff_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'class-notices'
    and (select private.get_my_role()) = any (
      array['admin'::public.user_role, 'teacher'::public.user_role]
    )
  );

-- =================================================================
-- 4) academy-notices (학원 공지 첨부) — authenticated read, admin write
-- =================================================================

drop policy if exists "academy_notices_authenticated_read" on storage.objects;
create policy "academy_notices_authenticated_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'academy-notices');

drop policy if exists "academy_notices_admin_insert" on storage.objects;
create policy "academy_notices_admin_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'academy-notices'
    and (select private.get_my_role()) = 'admin'::public.user_role
  );

drop policy if exists "academy_notices_admin_update" on storage.objects;
create policy "academy_notices_admin_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'academy-notices'
    and (select private.get_my_role()) = 'admin'::public.user_role
  )
  with check (
    bucket_id = 'academy-notices'
    and (select private.get_my_role()) = 'admin'::public.user_role
  );

drop policy if exists "academy_notices_admin_delete" on storage.objects;
create policy "academy_notices_admin_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'academy-notices'
    and (select private.get_my_role()) = 'admin'::public.user_role
  );

-- =================================================================
-- 5) homework-submissions (학생 숙제 제출물)
--    - SELECT: 학생 본인의 폴더(첫 segment = auth.uid()::text) 또는 staff
--    - INSERT: 학생 본인의 폴더 또는 staff
--    - UPDATE/DELETE: staff only (학생은 한 번 제출하면 수정 불가, 신뢰성 보장)
--    경로 컨벤션 가정: '<student_id>/...'. 다른 컨벤션이면 storage.foldername()[1] 조정 필요.
-- =================================================================

drop policy if exists "homework_submissions_select" on storage.objects;
create policy "homework_submissions_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'homework-submissions'
    and (
      (select private.get_my_role()) = any (
        array['admin'::public.user_role, 'teacher'::public.user_role]
      )
      or (storage.foldername(name))[1] = (select auth.uid())::text
    )
  );

drop policy if exists "homework_submissions_insert" on storage.objects;
create policy "homework_submissions_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'homework-submissions'
    and (
      (select private.get_my_role()) = any (
        array['admin'::public.user_role, 'teacher'::public.user_role]
      )
      or (storage.foldername(name))[1] = (select auth.uid())::text
    )
  );

drop policy if exists "homework_submissions_staff_update" on storage.objects;
create policy "homework_submissions_staff_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'homework-submissions'
    and (select private.get_my_role()) = any (
      array['admin'::public.user_role, 'teacher'::public.user_role]
    )
  )
  with check (
    bucket_id = 'homework-submissions'
    and (select private.get_my_role()) = any (
      array['admin'::public.user_role, 'teacher'::public.user_role]
    )
  );

drop policy if exists "homework_submissions_staff_delete" on storage.objects;
create policy "homework_submissions_staff_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'homework-submissions'
    and (select private.get_my_role()) = any (
      array['admin'::public.user_role, 'teacher'::public.user_role]
    )
  );

-- ROLLBACK:
-- BEGIN;
-- DROP POLICY IF EXISTS "notice_files_authenticated_read" ON storage.objects;
-- DROP POLICY IF EXISTS "notice_files_admin_insert" ON storage.objects;
-- DROP POLICY IF EXISTS "notice_files_admin_update" ON storage.objects;
-- DROP POLICY IF EXISTS "notice_files_admin_delete" ON storage.objects;
-- DROP POLICY IF EXISTS "class_notices_authenticated_read" ON storage.objects;
-- DROP POLICY IF EXISTS "class_notices_staff_insert" ON storage.objects;
-- DROP POLICY IF EXISTS "class_notices_staff_update" ON storage.objects;
-- DROP POLICY IF EXISTS "class_notices_staff_delete" ON storage.objects;
-- DROP POLICY IF EXISTS "academy_notices_authenticated_read" ON storage.objects;
-- DROP POLICY IF EXISTS "academy_notices_admin_insert" ON storage.objects;
-- DROP POLICY IF EXISTS "academy_notices_admin_update" ON storage.objects;
-- DROP POLICY IF EXISTS "academy_notices_admin_delete" ON storage.objects;
-- DROP POLICY IF EXISTS "homework_submissions_select" ON storage.objects;
-- DROP POLICY IF EXISTS "homework_submissions_insert" ON storage.objects;
-- DROP POLICY IF EXISTS "homework_submissions_staff_update" ON storage.objects;
-- DROP POLICY IF EXISTS "homework_submissions_staff_delete" ON storage.objects;
-- -- 버킷 자체는 콘솔에서 수동 정리.
-- COMMIT;
