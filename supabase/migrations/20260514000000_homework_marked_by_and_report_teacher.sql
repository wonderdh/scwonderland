-- 1) homework_unit_progress.marked_by 제거 (audit 미사용)
-- 2) report_cards.author_id → teacher_id 로 rename + teachers(id) FK 로 교체
--    rename 전, 현재 teachers 행이 없는 author_id 값은 NULL 처리 (FK 에러 방지)

set search_path = public;

-- =================================================================
-- 1. homework_unit_progress.marked_by 제거
-- =================================================================

alter table public.homework_unit_progress
  drop column if exists marked_by;

-- =================================================================
-- 2. report_cards.author_id → teacher_id
-- =================================================================

-- 2-1. teachers 행이 없는 author_id 는 NULL (admin 이 작성한 경우 등)
update public.report_cards
  set author_id = null
  where author_id is not null
    and author_id not in (select id from public.teachers);

-- 2-2. 기존 FK 제거
alter table public.report_cards
  drop constraint if exists report_cards_author_id_fkey;

-- 2-3. 컬럼 rename
alter table public.report_cards
  rename column author_id to teacher_id;

-- 2-4. teachers(id) FK 추가
alter table public.report_cards
  add constraint report_cards_teacher_id_fkey
  foreign key (teacher_id) references public.teachers(id) on delete set null;
