-- Migration: add_get_class_report_status_rpc
-- 반별 리포트카드 작성 현황을 단일 쿼리로 반환하는 RPC 함수.
-- listAllClassesReportStatus 에서 N+1 (51쿼리 → 1쿼리) 제거.

CREATE OR REPLACE FUNCTION get_class_report_status(p_year INT, p_month INT)
RETURNS TABLE (
  class_id UUID,
  class_name TEXT,
  total_students BIGINT,
  written_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    c.id AS class_id,
    c.name AS class_name,
    COUNT(DISTINCT cs.student_profile_id) AS total_students,
    COUNT(DISTINCT rc.student_profile_id) FILTER (
      WHERE rc.year = p_year
        AND rc.month = p_month
        AND rc.content IS NOT NULL
        AND rc.content != ''
    ) AS written_count
  FROM classes c
  LEFT JOIN class_students cs ON cs.class_id = c.id
  LEFT JOIN report_cards rc ON rc.student_profile_id = cs.student_profile_id
  GROUP BY c.id, c.name
  ORDER BY c.name;
$$;
