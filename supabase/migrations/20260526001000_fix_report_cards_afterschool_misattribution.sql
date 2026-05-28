-- ============================================================
-- report_cards: 방과후 등록에 잘못 귀속된 리포트카드를 정규반으로 재귀속
-- ============================================================
-- 배경:
--   20260525000000 마이그레이션의 backfill 이 학생당 class_students 행을 하나만
--   골랐는데 (DISTINCT ON (student_id) ORDER BY is_active DESC, joined_at DESC),
--   정규반 + 방과후에 둘 다 active 로 소속된 학생은 방과후 등록이 선택되어
--   리포트카드가 방과후 class_student_id 에 묶였다.
--   → 방과후(group_type='afterschool')를 제외하는 관리자 현황 페이지·정규반
--     대시보드에서 해당 리포트가 사라지는 문제 발생 (예: 2026-03·04 각 40건).
--
--   이 마이그레이션은 그런 리포트를 학생의 정규반(비-afterschool) 등록으로 옮긴다.
--   멱등(idempotent): 이미 정상화된 환경에서는 대상이 0건이라 no-op 이다.
--   (원격 prod 는 동일 UPDATE 가 수동 적용 완료된 상태 → 여기서는 변화 없음.)
-- ============================================================

BEGIN;

WITH misattributed AS (
  -- 방과후 등록에 붙어 있으면서, 같은 학생이 정규반 등록도 가진 리포트
  SELECT rc.id AS report_id, rc.year, rc.month, cs.student_id
  FROM public.report_cards rc
  JOIN public.class_students cs ON cs.id = rc.class_student_id
  JOIN public.classes c ON c.id = cs.class_id
  WHERE c.group_type = 'afterschool'
    AND EXISTS (
      SELECT 1 FROM public.class_students cs2
      JOIN public.classes c2 ON c2.id = cs2.class_id
      WHERE cs2.student_id = cs.student_id AND c2.group_type <> 'afterschool'
    )
),
target AS (
  -- 학생별 재귀속 대상: 정규반 중 active → 최근 합류 순으로 1건
  SELECT cs.student_id,
         (array_agg(cs.id ORDER BY cs.is_active DESC, cs.joined_at DESC))[1] AS target_cs_id
  FROM public.class_students cs
  JOIN public.classes c ON c.id = cs.class_id
  WHERE c.group_type <> 'afterschool'
  GROUP BY cs.student_id
)
UPDATE public.report_cards rc
   SET class_student_id = t.target_cs_id,
       updated_at = now()
  FROM misattributed m
  JOIN target t ON t.student_id = m.student_id
 WHERE rc.id = m.report_id
   -- UNIQUE (class_student_id, year, month) 충돌 방지:
   -- 정규반에 이미 같은 년·월 리포트가 있으면 옮기지 않고 둔다.
   AND NOT EXISTS (
     SELECT 1 FROM public.report_cards x
      WHERE x.class_student_id = t.target_cs_id
        AND x.year = m.year
        AND x.month = m.month
   );

COMMIT;
