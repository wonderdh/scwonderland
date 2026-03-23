-- 반별 시간표 슬롯의 복수 교사 배정 지원
-- 기존 partial unique index 제거 (class_id + period + day_of_week 조합의 단일 행 제약 해제)
-- ux_student_schedule_slot 은 유지 (학생 개인 배정은 여전히 슬롯당 1행)
DROP INDEX IF EXISTS ux_class_schedule_slot;
