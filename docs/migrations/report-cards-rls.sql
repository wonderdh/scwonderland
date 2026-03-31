-- =============================================================
-- report_cards 테이블 RLS 정책 추가
-- =============================================================

ALTER TABLE report_cards ENABLE ROW LEVEL SECURITY;

-- Admin: 전체 접근
CREATE POLICY report_cards_admin_all ON report_cards
  FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid() AND deleted_at IS NULL) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid() AND deleted_at IS NULL) = 'admin'
  );

-- Native 교사: 담당반 학생 SELECT
CREATE POLICY report_cards_teacher_select ON report_cards
  FOR SELECT
  TO authenticated
  USING (
    (SELECT p.role FROM profiles p WHERE p.id = auth.uid() AND p.deleted_at IS NULL) = 'teacher'
    AND (SELECT t.teacher_type FROM teachers t WHERE t.profile_id = auth.uid()) = 'native'
    AND EXISTS (
      SELECT 1 FROM class_teachers ct
      JOIN class_students cs ON cs.class_id = ct.class_id
      WHERE ct.teacher_profile_id = auth.uid()
      AND cs.student_profile_id = report_cards.student_profile_id
    )
  );

-- Native 교사: 담당반 학생 INSERT (author_id = 본인)
CREATE POLICY report_cards_teacher_insert ON report_cards
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT p.role FROM profiles p WHERE p.id = auth.uid() AND p.deleted_at IS NULL) = 'teacher'
    AND (SELECT t.teacher_type FROM teachers t WHERE t.profile_id = auth.uid()) = 'native'
    AND EXISTS (
      SELECT 1 FROM class_teachers ct
      JOIN class_students cs ON cs.class_id = ct.class_id
      WHERE ct.teacher_profile_id = auth.uid()
      AND cs.student_profile_id = report_cards.student_profile_id
    )
    AND report_cards.author_id = auth.uid()
  );

-- Native 교사: 담당반 학생 UPDATE
CREATE POLICY report_cards_teacher_update ON report_cards
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT p.role FROM profiles p WHERE p.id = auth.uid() AND p.deleted_at IS NULL) = 'teacher'
    AND (SELECT t.teacher_type FROM teachers t WHERE t.profile_id = auth.uid()) = 'native'
    AND EXISTS (
      SELECT 1 FROM class_teachers ct
      JOIN class_students cs ON cs.class_id = ct.class_id
      WHERE ct.teacher_profile_id = auth.uid()
      AND cs.student_profile_id = report_cards.student_profile_id
    )
  )
  WITH CHECK (
    (SELECT p.role FROM profiles p WHERE p.id = auth.uid() AND p.deleted_at IS NULL) = 'teacher'
    AND (SELECT t.teacher_type FROM teachers t WHERE t.profile_id = auth.uid()) = 'native'
    AND EXISTS (
      SELECT 1 FROM class_teachers ct
      JOIN class_students cs ON cs.class_id = ct.class_id
      WHERE ct.teacher_profile_id = auth.uid()
      AND cs.student_profile_id = report_cards.student_profile_id
    )
  );

-- 학생: 본인 SELECT
CREATE POLICY report_cards_student_select ON report_cards
  FOR SELECT
  TO authenticated
  USING (
    student_profile_id = auth.uid()
    AND (SELECT role FROM profiles WHERE id = auth.uid() AND deleted_at IS NULL) = 'student'
  );

-- 학생: 본인 UPDATE (reply 작성용)
CREATE POLICY report_cards_student_update ON report_cards
  FOR UPDATE
  TO authenticated
  USING (
    student_profile_id = auth.uid()
    AND (SELECT role FROM profiles WHERE id = auth.uid() AND deleted_at IS NULL) = 'student'
  )
  WITH CHECK (
    student_profile_id = auth.uid()
    AND (SELECT role FROM profiles WHERE id = auth.uid() AND deleted_at IS NULL) = 'student'
  );
