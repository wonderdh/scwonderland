-- 나기창 시리즈 total_units 교정: 15 → 20.
-- 등록 당시 실수로 15 로 입력됐는데 실제는 20 unit.
--
-- 안전성:
--   - homework_books.total_units 의 CHECK 는 (> 0) 뿐 → 20 통과
--   - student_homework_progress 는 (student_homework_book_id, unit_number) 기준이라
--     기존 unit 1~15 진도는 그대로 보존. unit 16~20 은 새 row 로 추가 가능해짐
--   - 멱등성: total_units = 15 조건으로 이미 20 인 row 는 건드리지 않음

UPDATE public.homework_books
SET
  total_units = 20,
  updated_at = now()
WHERE title = '나기창'
  AND series = '나기창'
  AND total_units = 15;

-- 정합성 체크: 진도가 새 total_units 초과하지 않는지 (있을 리 없지만 가드)
DO $$
DECLARE
  bad_count integer;
BEGIN
  SELECT COUNT(*) INTO bad_count
  FROM public.student_homework_progress shp
  JOIN public.student_homework_books shb ON shb.id = shp.student_homework_book_id
  JOIN public.class_homework_books chb ON chb.id = shb.class_homework_book_id
  JOIN public.homework_books hb ON hb.id = chb.textbook_id
  WHERE hb.title = '나기창' AND shp.unit_number > hb.total_units;

  IF bad_count > 0 THEN
    RAISE EXCEPTION 'progress unit_number > total_units 인 row 가 % 개 있습니다', bad_count;
  END IF;
END $$;
