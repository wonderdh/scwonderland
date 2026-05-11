-- ============================================================
-- students.group_type 백필
--
-- 배경:
--   live 174 행 모두 NULL 인데 코드는 "유치부" / "오후반" 으로 필터.
--   class_students × classes.group_type 으로부터 추론해 백필.
--
-- 매핑:
--   classes.group_type='kindergarten' → '유치부'
--   classes.group_type='afternoon'    → '오후반'
--   afterschool 전용 학생 / 미배정    → null 유지
--
-- 검증 (live):
--   - kindergarten 학생: 51, afternoon: 117, afterschool: 40
--   - kindergarten ∩ afternoon: 0 (겹침 없음 — 단일 라벨 매핑 가능)
-- ============================================================

update public.students s
set group_type = sub.label
from (
  select cs.student_id,
         case c.group_type
           when 'kindergarten' then '유치부'
           when 'afternoon'    then '오후반'
         end as label
  from public.class_students cs
  join public.classes c on c.id = cs.class_id
  where cs.is_active = true
    and c.is_active  = true
    and c.group_type in ('kindergarten', 'afternoon')
  group by cs.student_id, c.group_type
) sub
where sub.student_id = s.id
  and s.group_type is null;
