-- role-specific FK 정책: 학생 컬럼은 students(id), 교사 컬럼은 teachers(id).
-- profiles(id) 는 actor(admin·teacher 혼합) 컬럼에서만 사용.
-- 참고: supabase/AGENTS.md "FK 컨벤션".
--
-- 대상: 최근 homework 마이그레이션 3개에서 student_id 가 profiles(id) 를 가리키던 것을
--      students(id) 로 교체. assigned_by / updated_by / marked_by / recorded_by 는
--      admin 도 actor 가 될 수 있어 profiles(id) 유지.
--
-- 무결성: shared PK (students.id = profiles.id) 라서 기존 데이터는 그대로 통과해야 함.
--        통과 못 하는 row 는 admin id 등이 student_id 에 잘못 들어간 케이스 — 마이그레이션 실패로 드러내고 수동 정리.

set search_path = public;

-- =================================================================
-- 1. student_textbooks.student_id → students(id)
-- =================================================================

alter table public.student_textbooks
  drop constraint if exists student_textbooks_student_id_fkey;

alter table public.student_textbooks
  add constraint student_textbooks_student_id_fkey
  foreign key (student_id) references public.students(id) on delete cascade;

-- =================================================================
-- 2. student_textbook_progress.student_id → students(id)
-- =================================================================

alter table public.student_textbook_progress
  drop constraint if exists student_textbook_progress_student_id_fkey;

alter table public.student_textbook_progress
  add constraint student_textbook_progress_student_id_fkey
  foreign key (student_id) references public.students(id) on delete cascade;

-- =================================================================
-- 3. homework_unit_progress.student_id → students(id)
-- =================================================================

alter table public.homework_unit_progress
  drop constraint if exists homework_unit_progress_student_id_fkey;

alter table public.homework_unit_progress
  add constraint homework_unit_progress_student_id_fkey
  foreign key (student_id) references public.students(id) on delete cascade;
