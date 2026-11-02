-- reviewed-by: wonderdh 2026-11-02 (세션 리뷰 후 운영 DB 적용 완료)
-- 2026-11-02
-- class_students 를 "버리는 카드" 에서 "보관하는 이력" 으로 전환 (soft leave).
--
-- 배경: report_cards 가 class_students(id) 를 가리키는데 앱은 반 구성 변경 시 행을 hard delete 해
--       성적표가 함께 사라졌다 (docs/2026-11-02/00-종합보고서 §1-3). 20261102000000 이 FK 를 RESTRICT 로
--       막아 데이터는 지켰지만 반 이동 자체가 막힘. 근본 해결은 삭제 대신 is_active=false 표시.
--
-- 코드 측 변경(같은 커밋): 삭제 경로 5곳 → update is_active=false, 추가 경로 3곳 → upsert is_active=true,
--       명단 조회 전부 is_active=true 필터. 스키마 변경 없음 — 컬럼 is_active 는 baseline 부터 존재.

-- 1) 재합류(is_active false → true) 시에도 반 교재를 학생에게 시드.
--    기존 트리거는 after insert 만 걸려 있어 재활성화된 학생은 그 사이 추가된 책을 못 받음.
--    함수 본문은 NEW.is_active 가 아니면 즉시 return 하므로 비활성화 UPDATE 에는 영향 없음.
drop trigger if exists tg_class_student_seed_homework_books on public.class_students;
create trigger tg_class_student_seed_homework_books
  after insert or update of is_active on public.class_students
  for each row execute function public.tg_class_student_seed_homework_books();

-- 2) RLS 헬퍼: 학생이 "소속된 반" 은 활성 소속만. 나간 반의 명단·시간표는 더 이상 보이지 않음.
create or replace function private.my_student_class_ids()
returns setof uuid
language sql
security definer
stable
set search_path = ''
as $$
  select cs.class_id
  from public.class_students cs
  where cs.student_id = (select auth.uid())
    and cs.is_active = true;
$$;

-- ROLLBACK:
--   drop trigger … ; create trigger … after insert on public.class_students … ;
--   my_student_class_ids 를 20261102000000 의 본문(is_active 조건 없음) 으로 재정의.
