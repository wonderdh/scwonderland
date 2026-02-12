# 영어학원 관리 시스템 구현 체크리스트

> 이 체크리스트는 데이터베이스와 기능을 단계별로 구현하기 위한 가이드입니다.
> 각 항목을 완료하면 `[ ]`를 `[x]`로 변경하세요.

---

## Phase 0: 환경 설정

### 0.1 Supabase 프로젝트 설정
- [ ] Supabase 프로젝트 생성 (https://supabase.com)
- [ ] `.env.local` 파일 확인 및 환경 변수 설정
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Supabase MCP 설정 (`.cursor/cursor-mcp.json`)
- [ ] MCP 연결 테스트

### 0.2 Storage Buckets 생성
Supabase Dashboard → Storage에서 생성:
- [ ] `homework-audio` bucket 생성 (public)
- [ ] `profile-images` bucket 생성 (public)
- [ ] `book-covers` bucket 생성 (public)

---

## Phase 1: 기본 인증 및 Profiles 테이블

### 1.1 Profiles 테이블 생성
```sql
-- profiles 테이블
CREATE TABLE public.profiles (
  id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text CHECK (role IN ('student', 'teacher', 'admin')),
  email text,
  phone text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
```

- [ ] profiles 테이블 생성 완료
- [ ] RLS 활성화 확인

### 1.2 Profiles 자동 생성 트리거
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    (NEW.raw_user_meta_data->>'role')::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

- [ ] 트리거 함수 생성 완료
- [ ] 트리거 생성 완료

### 1.3 첫 번째 Admin 계정 생성
Supabase Dashboard → Authentication → Users:
- [ ] Admin 이메일/비밀번호로 계정 생성
- [ ] `profiles` 테이블에서 해당 계정 role을 'admin'으로 수정

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'admin@scwonderland.com';
```

### 1.4 Profiles RLS 정책
```sql
-- 본인 프로필 조회
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
TO authenticated
USING (id = auth.uid() OR 
       EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Admin만 프로필 수정
CREATE POLICY "Only admins can update profiles"
ON profiles FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
```

- [ ] RLS 정책 생성 완료
- [ ] 정책 테스트 (admin으로 로그인해서 다른 프로필 조회 가능한지)

---

## Phase 2: Teachers 테이블 구현

### 2.1 Teachers 테이블 생성
```sql
CREATE TABLE public.teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  employee_number text UNIQUE,
  hire_date date,
  specialization text,
  bio text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_leave')),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_teachers_profile_id ON teachers(profile_id);
```

- [ ] teachers 테이블 생성 완료
- [ ] 인덱스 생성 완료

### 2.2 Teachers RLS 정책
```sql
-- Admin만 teachers 관리 가능
CREATE POLICY "Admins can manage teachers"
ON teachers FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Teachers는 자신의 정보만 조회 가능
CREATE POLICY "Teachers can view own info"
ON teachers FOR SELECT
TO authenticated
USING (profile_id = auth.uid());
```

- [ ] RLS 정책 생성 완료

### 2.3 Teacher 계정 생성 테스트

**필요한 입력 정보:**
- ✅ 이메일 (필수)
- ✅ 비밀번호 (필수)
- ✅ 교사 이름 (필수)
- ⚪ 사번 (선택)
- ⚪ 입사일 (선택)
- ⚪ 전문 분야 (선택)
- ⚪ 전화번호 (선택)

**테스트 순서:**
1. Supabase Dashboard에서 Auth 계정 생성 (teacher@test.com)
2. profiles 테이블에 레코드 자동 생성 확인
3. profiles의 role을 'teacher'로 수정
4. teachers 테이블에 상세 정보 INSERT

```sql
-- Step 1: Auth 계정은 Dashboard에서 생성

-- Step 2: profiles 확인
SELECT * FROM profiles WHERE email = 'teacher@test.com';

-- Step 3: role 변경
UPDATE profiles SET role = 'teacher' WHERE email = 'teacher@test.com';

-- Step 4: teachers 테이블에 정보 추가
INSERT INTO teachers (profile_id, name, hire_date, specialization, status)
VALUES (
  (SELECT id FROM profiles WHERE email = 'teacher@test.com'),
  '김선생',
  '2026-01-01',
  '초급 영어',
  'active'
);
```

- [ ] Teacher 계정 생성 성공
- [ ] profiles 테이블 연동 확인
- [ ] teachers 테이블 데이터 입력 확인

---

## Phase 3: Students 테이블 구현

### 3.1 학생 번호 자동 생성 함수
```sql
-- 시퀀스 및 함수 생성
CREATE OR REPLACE FUNCTION generate_student_number_yearly()
RETURNS text AS $$
DECLARE
  current_year text;
  seq_name text;
  seq_num text;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::text;
  seq_name := 'student_number_seq_' || current_year;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_sequences 
    WHERE schemaname = 'public' AND sequencename = seq_name
  ) THEN
    EXECUTE format('CREATE SEQUENCE %I START 1', seq_name);
  END IF;
  
  EXECUTE format('SELECT LPAD(nextval(%L)::text, 3, %L)', seq_name, '0') INTO seq_num;
  
  RETURN current_year || seq_num;
END;
$$ LANGUAGE plpgsql;
```

- [ ] 학생 번호 생성 함수 완료

### 3.2 Students 테이블 생성
```sql
CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  korean_name text NOT NULL,
  english_name text,
  birth_date date,
  grade_level text,
  enrollment_date date,
  student_number text UNIQUE,
  current_class_id uuid REFERENCES classes(id),
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'graduated')),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_students_profile_id ON students(profile_id);
CREATE INDEX idx_students_current_class ON students(current_class_id);
```

- [ ] students 테이블 생성 완료
- [ ] 인덱스 생성 완료

### 3.3 학생 번호 자동 할당 트리거
```sql
CREATE OR REPLACE FUNCTION set_student_number()
RETURNS trigger AS $$
BEGIN
  IF NEW.student_number IS NULL THEN
    NEW.student_number := generate_student_number_yearly();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_student_number
  BEFORE INSERT ON students
  FOR EACH ROW
  EXECUTE FUNCTION set_student_number();
```

- [ ] 트리거 생성 완료

### 3.4 Students RLS 정책
```sql
-- Admin만 students 관리 가능
CREATE POLICY "Admins can manage students"
ON students FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Students는 자신의 정보만 조회 가능
CREATE POLICY "Students can view own info"
ON students FOR SELECT
TO authenticated
USING (profile_id = auth.uid());
```

- [ ] RLS 정책 생성 완료

### 3.5 Student 계정 생성 테스트

**필요한 입력 정보:**
- ✅ 이메일 (필수)
- ✅ 비밀번호 (필수)
- ✅ 한글 이름 (필수)
- ⚪ 영어 이름 (선택)
- ⚪ 생년월일 (선택)
- ⚪ 학년 (선택)
- ⚪ 등록일 (선택)
- ⚪ 전화번호 (선택)

**테스트 순서:**
```sql
-- Step 1: Auth 계정은 Dashboard에서 생성 (student@test.com)

-- Step 2: role 변경
UPDATE profiles SET role = 'student' WHERE email = 'student@test.com';

-- Step 3: students 테이블에 정보 추가 (student_number는 자동 생성)
INSERT INTO students (profile_id, korean_name, english_name, birth_date, grade_level, status)
VALUES (
  (SELECT id FROM profiles WHERE email = 'student@test.com'),
  '홍길동',
  'John Hong',
  '2015-03-15',
  '초등 4학년',
  'active'
);

-- Step 4: 학생 번호 자동 생성 확인
SELECT student_number FROM students WHERE korean_name = '홍길동';
-- 결과: 2026001 (또는 2026002, 2026003...)
```

- [ ] Student 계정 생성 성공
- [ ] 학생 번호 자동 생성 확인 (2026001 형식)
- [ ] students 테이블 데이터 입력 확인

---

## Phase 4: 간단한 Admin 페이지 생성

### 4.1 Admin 대시보드 라우트 생성
- [ ] `app/(dashboard)/admin/page.tsx` 생성
- [ ] 기본 레이아웃 및 네비게이션
- [ ] 통계 카드 (총 학생 수, 총 교사 수, 총 반 수)

### 4.2 Teacher 관리 페이지
- [ ] `app/(dashboard)/admin/teachers/page.tsx` 생성
- [ ] Teachers 목록 조회 (Table 형식)
- [ ] Teacher 추가 버튼 및 폼
- [ ] Teacher 수정/삭제 기능

**테스트:**
- [ ] Admin으로 로그인하여 teachers 목록 확인
- [ ] 새 Teacher 추가 테스트
- [ ] Teacher 정보 수정 테스트

### 4.3 Student 관리 페이지
- [ ] `app/(dashboard)/admin/students/page.tsx` 생성
- [ ] Students 목록 조회 (Table 형식)
- [ ] Student 추가 버튼 및 폼
- [ ] Student 수정/삭제 기능
- [ ] 학생 번호 표시 확인

**테스트:**
- [ ] Admin으로 로그인하여 students 목록 확인
- [ ] 새 Student 추가 테스트 (학생 번호 자동 생성 확인)
- [ ] Student 정보 수정 테스트

---

## Phase 5: Books (교재) 테이블 구현

### 5.1 Books 테이블 생성
```sql
CREATE TABLE public.books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  publisher text,
  author text,
  isbn text UNIQUE,
  level text,
  category text,
  total_units integer,
  total_pages integer,
  description text,
  cover_image_url text,
  target_age text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued')),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_books_title ON books(title);
CREATE INDEX idx_books_level ON books(level);
CREATE INDEX idx_books_status ON books(status);
```

- [ ] books 테이블 생성 완료

### 5.2 Books RLS 정책
```sql
-- Admin만 books 관리 가능
CREATE POLICY "Admins can manage books"
ON books FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Students/Teachers는 활성 books 조회만 가능
CREATE POLICY "Users can view active books"
ON books FOR SELECT
TO authenticated
USING (status = 'active');
```

- [ ] RLS 정책 생성 완료

### 5.3 샘플 교재 데이터 추가
```sql
INSERT INTO books (title, publisher, level, category, total_units, total_pages, status)
VALUES 
  ('Let''s Go 1', 'Oxford', 'Beginner', 'Textbook', 8, 80, 'active'),
  ('Let''s Go 2', 'Oxford', 'Elementary', 'Textbook', 8, 80, 'active'),
  ('Let''s Go 3', 'Oxford', 'Elementary', 'Textbook', 8, 80, 'active'),
  ('Grammar in Use', 'Cambridge', 'Intermediate', 'Grammar', 12, 120, 'active');
```

- [ ] 샘플 교재 데이터 추가 완료

### 5.4 Books 관리 페이지
- [ ] `app/(dashboard)/admin/books/page.tsx` 생성
- [ ] Books 목록 조회
- [ ] Book 추가/수정/삭제 기능

**테스트:**
- [ ] Books 목록 확인
- [ ] 새 Book 추가 테스트

---

## Phase 6: Classes (반) 테이블 구현

### 6.1 Classes 테이블 생성
```sql
CREATE TABLE public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  level text,
  description text,
  schedule jsonb,
  room text,
  capacity integer,
  current_book_id uuid REFERENCES books(id),
  start_date date,
  end_date date,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed')),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
```

- [ ] classes 테이블 생성 완료

### 6.2 Class-Teacher 관계 테이블
```sql
CREATE TABLE public.class_teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  role text DEFAULT 'primary' CHECK (role IN ('primary', 'assistant')),
  assigned_at timestamp with time zone DEFAULT now(),
  UNIQUE(class_id, teacher_id)
);

ALTER TABLE public.class_teachers ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_class_teachers_class ON class_teachers(class_id);
CREATE INDEX idx_class_teachers_teacher ON class_teachers(teacher_id);
```

- [ ] class_teachers 테이블 생성 완료

### 6.3 Class-Student 관계 테이블
```sql
CREATE TABLE public.class_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  enrolled_at timestamp with time zone DEFAULT now(),
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'dropped')),
  completion_date date
);

ALTER TABLE public.class_students ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_class_students_class ON class_students(class_id);
CREATE INDEX idx_class_students_student ON class_students(student_id);
CREATE INDEX idx_class_students_active ON class_students(class_id, student_id, status) 
  WHERE status = 'active';
```

- [ ] class_students 테이블 생성 완료

### 6.4 Student current_class_id 자동 업데이트 트리거
```sql
CREATE OR REPLACE FUNCTION update_student_current_class()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'active' THEN
    UPDATE students 
    SET current_class_id = NEW.class_id 
    WHERE id = NEW.student_id;
  ELSIF OLD.status = 'active' AND NEW.status != 'active' THEN
    UPDATE students 
    SET current_class_id = NULL 
    WHERE id = NEW.student_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_student_current_class
  AFTER INSERT OR UPDATE ON class_students
  FOR EACH ROW
  EXECUTE FUNCTION update_student_current_class();
```

- [ ] current_class_id 자동 업데이트 트리거 생성

### 6.5 Classes RLS 정책
```sql
-- Admin만 classes 관리 가능
CREATE POLICY "Admins can manage classes"
ON classes FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Teachers는 자신이 담당하는 classes 조회 가능
CREATE POLICY "Teachers can view their classes"
ON classes FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT ct.class_id FROM teachers t
    JOIN class_teachers ct ON t.id = ct.teacher_id
    WHERE t.profile_id = auth.uid()
  )
);

-- Students는 자신이 속한 classes 조회 가능
CREATE POLICY "Students can view their classes"
ON classes FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT cs.class_id FROM students s
    JOIN class_students cs ON s.id = cs.student_id
    WHERE s.profile_id = auth.uid() AND cs.status = 'active'
  )
);
```

- [ ] classes RLS 정책 생성 완료

### 6.6 샘플 반 데이터 추가
```sql
-- 반 생성
INSERT INTO classes (name, level, room, capacity, current_book_id, start_date, status)
VALUES 
  ('Elementary Level 1', 'Beginner', '201호', 15, 
   (SELECT id FROM books WHERE title = 'Let''s Go 1'), 
   '2026-03-01', 'active'),
  ('Elementary Level 2', 'Elementary', '202호', 15,
   (SELECT id FROM books WHERE title = 'Let''s Go 2'),
   '2026-03-01', 'active');
```

- [ ] 샘플 반 데이터 추가 완료

### 6.7 교사-반 배정 테스트
```sql
-- 교사를 반에 배정
INSERT INTO class_teachers (class_id, teacher_id, role)
VALUES (
  (SELECT id FROM classes WHERE name = 'Elementary Level 1'),
  (SELECT id FROM teachers WHERE name = '김선생'),
  'primary'
);
```

- [ ] 교사-반 배정 테스트 완료

### 6.8 학생-반 배정 테스트
```sql
-- 학생을 반에 배정
INSERT INTO class_students (class_id, student_id, status)
VALUES (
  (SELECT id FROM classes WHERE name = 'Elementary Level 1'),
  (SELECT id FROM students WHERE korean_name = '홍길동'),
  'active'
);

-- students 테이블의 current_class_id 자동 업데이트 확인
SELECT korean_name, current_class_id FROM students WHERE korean_name = '홍길동';
```

- [ ] 학생-반 배정 테스트 완료
- [ ] current_class_id 자동 업데이트 확인

### 6.9 Classes 관리 페이지
- [ ] `app/(dashboard)/admin/classes/page.tsx` 생성
- [ ] Classes 목록 조회
- [ ] Class 추가/수정/삭제
- [ ] 교사-반 배정 UI
- [ ] 학생-반 배정 UI

**테스트:**
- [ ] Classes 목록 확인
- [ ] 새 Class 추가
- [ ] 교사 배정 기능 테스트
- [ ] 학생 배정 기능 테스트

---

## Phase 7: Report Cards (성적표) 구현

### 7.1 Report Cards 테이블 생성
```sql
CREATE TABLE public.report_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  term text,
  title text,
  content text,
  strengths text,
  areas_for_improvement text,
  teacher_comments text,
  student_reply text,
  student_replied_at timestamp with time zone,
  is_published boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.report_cards ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_report_cards_student ON report_cards(student_id);
CREATE INDEX idx_report_cards_class ON report_cards(class_id);
CREATE INDEX idx_report_cards_published ON report_cards(student_id, is_published, created_at) 
  WHERE is_published = true;
```

- [ ] report_cards 테이블 생성 완료

### 7.2 Report Cards RLS 정책
```sql
-- Admin만 모든 report_cards 관리 가능
CREATE POLICY "Admins can manage all report cards"
ON report_cards FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Teachers는 자신의 report_cards 관리 가능
CREATE POLICY "Teachers can manage their report cards"
ON report_cards FOR ALL
TO authenticated
USING (
  teacher_id IN (SELECT id FROM teachers WHERE profile_id = auth.uid())
);

-- Students는 자신의 공개된 report_cards 조회 및 답장 가능
CREATE POLICY "Students can view and reply to their published report cards"
ON report_cards FOR SELECT
TO authenticated
USING (
  student_id IN (SELECT id FROM students WHERE profile_id = auth.uid())
  AND is_published = true
);

CREATE POLICY "Students can reply to their report cards"
ON report_cards FOR UPDATE
TO authenticated
USING (
  student_id IN (SELECT id FROM students WHERE profile_id = auth.uid())
  AND is_published = true
)
WITH CHECK (
  student_id IN (SELECT id FROM students WHERE profile_id = auth.uid())
);
```

- [ ] report_cards RLS 정책 생성 완료

### 7.3 샘플 Report Card 데이터 추가
```sql
INSERT INTO report_cards (
  student_id, 
  class_id, 
  teacher_id, 
  term, 
  title, 
  content,
  strengths,
  areas_for_improvement,
  teacher_comments,
  is_published
)
VALUES (
  (SELECT id FROM students WHERE korean_name = '홍길동'),
  (SELECT id FROM classes WHERE name = 'Elementary Level 1'),
  (SELECT id FROM teachers WHERE name = '김선생'),
  '2026-Spring',
  'Week 1 Progress Report',
  '이번 주 학습 내용을 잘 따라왔습니다.',
  '발음이 정확하고 수업 참여도가 높습니다.',
  '문법 부분을 조금 더 연습하면 좋겠습니다.',
  '전반적으로 성실하게 수업에 참여하고 있습니다.',
  true
);
```

- [ ] 샘플 Report Card 추가 완료

### 7.4 Teacher - Report Card 작성 페이지
- [ ] `app/(dashboard)/teacher/reports/page.tsx` 생성
- [ ] 담당 학생 목록 조회
- [ ] Report Card 작성 폼
- [ ] Report Card 수정/삭제
- [ ] 공개/비공개 토글

**테스트:**
- [ ] Teacher로 로그인
- [ ] 담당 학생 확인
- [ ] Report Card 작성 테스트
- [ ] 공개/비공개 전환 테스트

### 7.5 Student - Report Card 조회 페이지
- [ ] `app/(dashboard)/student/reports/page.tsx` 생성
- [ ] 자신의 Report Cards 목록 조회
- [ ] Report Card 상세 보기
- [ ] 답장 기능

**테스트:**
- [ ] Student로 로그인
- [ ] Report Cards 목록 확인
- [ ] 답장 작성 테스트

---

## Phase 8: Homework (숙제) 구현

### 8.1 Homework 테이블 생성
```sql
CREATE TABLE public.homework (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  homework_type text CHECK (homework_type IN ('voice_recording', 'written', 'reading', 'video', 'other')),
  due_date timestamp with time zone,
  max_score integer,
  instructions text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.homework ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_homework_class ON homework(class_id);
CREATE INDEX idx_homework_due_date ON homework(due_date DESC);
```

- [ ] homework 테이블 생성 완료

### 8.2 Homework Submissions 테이블 생성
```sql
CREATE TABLE public.homework_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id uuid NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  submission_type text CHECK (submission_type IN ('voice_recording', 'text', 'file')),
  audio_file_url text,
  audio_duration_seconds integer,
  text_content text,
  file_url text,
  submitted_at timestamp with time zone DEFAULT now(),
  score integer,
  teacher_feedback text,
  graded_at timestamp with time zone,
  graded_by uuid REFERENCES teachers(id),
  status text DEFAULT 'submitted' CHECK (status IN ('submitted', 'graded', 'needs_revision')),
  UNIQUE(homework_id, student_id)
);

ALTER TABLE public.homework_submissions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_homework_submissions_homework ON homework_submissions(homework_id);
CREATE INDEX idx_homework_submissions_student ON homework_submissions(student_id);
```

- [ ] homework_submissions 테이블 생성 완료

### 8.3 Homework RLS 정책
```sql
-- Admin/Teachers는 homework 관리 가능
CREATE POLICY "Teachers can manage homework for their classes"
ON homework FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  OR teacher_id IN (SELECT id FROM teachers WHERE profile_id = auth.uid())
);

-- Students는 자신의 반 homework 조회 가능
CREATE POLICY "Students can view their class homework"
ON homework FOR SELECT
TO authenticated
USING (
  class_id IN (
    SELECT cs.class_id FROM students s
    JOIN class_students cs ON s.id = cs.student_id
    WHERE s.profile_id = auth.uid() AND cs.status = 'active'
  )
);

-- Students는 자신의 숙제 제출 가능
CREATE POLICY "Students can manage their submissions"
ON homework_submissions FOR ALL
TO authenticated
USING (
  student_id IN (SELECT id FROM students WHERE profile_id = auth.uid())
);

-- Teachers는 담당 반 학생의 제출물 관리 가능
CREATE POLICY "Teachers can manage submissions for their students"
ON homework_submissions FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  OR homework_id IN (
    SELECT h.id FROM homework h
    JOIN class_teachers ct ON h.class_id = ct.class_id
    JOIN teachers t ON ct.teacher_id = t.id
    WHERE t.profile_id = auth.uid()
  )
);
```

- [ ] homework RLS 정책 생성 완료
- [ ] homework_submissions RLS 정책 생성 완료

### 8.4 샘플 Homework 데이터 추가
```sql
INSERT INTO homework (
  class_id,
  teacher_id,
  title,
  description,
  homework_type,
  due_date,
  max_score,
  instructions
)
VALUES (
  (SELECT id FROM classes WHERE name = 'Elementary Level 1'),
  (SELECT id FROM teachers WHERE name = '김선생'),
  'Unit 3 Speaking Practice',
  '배운 문장을 사용하여 자기소개 녹음',
  'voice_recording',
  now() + interval '7 days',
  100,
  '1-2분 분량으로 녹음해주세요.'
);
```

- [ ] 샘플 Homework 추가 완료

### 8.5 Teacher - Homework 관리 페이지
- [ ] `app/(dashboard)/teacher/homework/page.tsx` 생성
- [ ] Homework 출제 폼
- [ ] Homework 목록 조회
- [ ] 제출 현황 확인
- [ ] 채점 기능

**테스트:**
- [ ] Homework 출제 테스트
- [ ] 제출 현황 조회

### 8.6 Student - Homework 제출 페이지
- [ ] `app/(dashboard)/student/homework/page.tsx` 생성
- [ ] Homework 목록 조회
- [ ] 음성 녹음 기능 (Web Audio API)
- [ ] 파일 업로드 (Supabase Storage)
- [ ] 제출 완료 표시

**테스트:**
- [ ] Homework 목록 확인
- [ ] 음성 녹음 및 제출 테스트
- [ ] 제출 완료 후 상태 확인

---

## Phase 9: Book Progress (책 진행도) 구현

### 9.1 Book Progress 테이블 생성
```sql
CREATE TABLE public.book_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  current_unit integer,
  current_page integer,
  completion_percentage integer,
  status text DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'paused')),
  last_updated_by uuid REFERENCES profiles(id),
  notes text,
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.book_progress ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_book_progress_student ON book_progress(student_id);
CREATE INDEX idx_book_progress_book ON book_progress(book_id);
```

- [ ] book_progress 테이블 생성 완료

### 9.2 Book Progress RLS 정책
```sql
-- Admin/Teachers는 book_progress 관리 가능
CREATE POLICY "Teachers can manage book progress"
ON book_progress FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  OR class_id IN (
    SELECT ct.class_id FROM teachers t
    JOIN class_teachers ct ON t.id = ct.teacher_id
    WHERE t.profile_id = auth.uid()
  )
);

-- Students는 자신의 book_progress 조회 가능
CREATE POLICY "Students can view their book progress"
ON book_progress FOR SELECT
TO authenticated
USING (
  student_id IN (SELECT id FROM students WHERE profile_id = auth.uid())
);
```

- [ ] book_progress RLS 정책 생성 완료

### 9.3 샘플 Book Progress 데이터 추가
```sql
INSERT INTO book_progress (
  student_id,
  class_id,
  book_id,
  current_unit,
  current_page,
  completion_percentage,
  status,
  last_updated_by
)
VALUES (
  (SELECT id FROM students WHERE korean_name = '홍길동'),
  (SELECT id FROM classes WHERE name = 'Elementary Level 1'),
  (SELECT id FROM books WHERE title = 'Let''s Go 1'),
  3,
  30,
  38,
  'in_progress',
  (SELECT profile_id FROM teachers WHERE name = '김선생')
);
```

- [ ] 샘플 Book Progress 추가 완료

### 9.4 Teacher - Book Progress 관리 페이지
- [ ] `app/(dashboard)/teacher/progress/page.tsx` 생성
- [ ] 학생별 Book Progress 조회
- [ ] 진행도 업데이트 기능
- [ ] 진행률 시각화 (Progress Bar)

**테스트:**
- [ ] Book Progress 조회
- [ ] 진행도 업데이트 테스트

### 9.5 Student - Book Progress 조회 페이지
- [ ] `app/(dashboard)/student/books/page.tsx` 생성
- [ ] 자신의 Book Progress 조회
- [ ] 진행률 시각화

**테스트:**
- [ ] Book Progress 확인
- [ ] 진행률 표시 확인

---

## Phase 10: Assessments (평가/시험) 구현

### 10.1 Assessments 테이블 생성
```sql
CREATE TABLE public.assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assessment_type text,
  max_score integer,
  assessment_date date,
  created_by uuid NOT NULL REFERENCES teachers(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_assessments_class ON assessments(class_id);
CREATE INDEX idx_assessments_date ON assessments(assessment_date DESC);
```

- [ ] assessments 테이블 생성 완료

### 10.2 Assessment Results 테이블 생성
```sql
CREATE TABLE public.assessment_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  score decimal,
  percentage decimal,
  grade text,
  notes text,
  recorded_by uuid NOT NULL REFERENCES teachers(id),
  recorded_at timestamp with time zone DEFAULT now(),
  UNIQUE(assessment_id, student_id)
);

ALTER TABLE public.assessment_results ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_assessment_results_assessment ON assessment_results(assessment_id);
CREATE INDEX idx_assessment_results_student ON assessment_results(student_id);
```

- [ ] assessment_results 테이블 생성 완료

### 10.3 Assessments RLS 정책
```sql
-- Teachers는 담당 반의 assessments 관리 가능
CREATE POLICY "Teachers can manage assessments"
ON assessments FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  OR class_id IN (
    SELECT ct.class_id FROM teachers t
    JOIN class_teachers ct ON t.id = ct.teacher_id
    WHERE t.profile_id = auth.uid()
  )
);

-- Teachers는 assessment_results 관리 가능
CREATE POLICY "Teachers can manage assessment results"
ON assessment_results FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  OR assessment_id IN (
    SELECT a.id FROM assessments a
    JOIN class_teachers ct ON a.class_id = ct.class_id
    JOIN teachers t ON ct.teacher_id = t.id
    WHERE t.profile_id = auth.uid()
  )
);

-- Students는 자신의 assessment_results 조회 가능
CREATE POLICY "Students can view their assessment results"
ON assessment_results FOR SELECT
TO authenticated
USING (
  student_id IN (SELECT id FROM students WHERE profile_id = auth.uid())
);
```

- [ ] assessments RLS 정책 생성 완료
- [ ] assessment_results RLS 정책 생성 완료

### 10.4 샘플 Assessment 데이터 추가
```sql
-- 시험 생성
INSERT INTO assessments (
  class_id,
  title,
  description,
  assessment_type,
  max_score,
  assessment_date,
  created_by
)
VALUES (
  (SELECT id FROM classes WHERE name = 'Elementary Level 1'),
  '중간고사',
  'Unit 1-4 범위',
  'midterm',
  100,
  CURRENT_DATE + 14,
  (SELECT id FROM teachers WHERE name = '김선생')
);

-- 시험 결과 입력
INSERT INTO assessment_results (
  assessment_id,
  student_id,
  score,
  percentage,
  grade,
  notes,
  recorded_by
)
VALUES (
  (SELECT id FROM assessments WHERE title = '중간고사'),
  (SELECT id FROM students WHERE korean_name = '홍길동'),
  87,
  87.0,
  'B+',
  '리스닝 부분이 우수함',
  (SELECT id FROM teachers WHERE name = '김선생')
);
```

- [ ] 샘플 Assessment 추가 완료
- [ ] 샘플 Assessment Result 추가 완료

### 10.5 Teacher - Assessment 관리 페이지
- [ ] `app/(dashboard)/teacher/assessments/page.tsx` 생성
- [ ] Assessment 생성 폼
- [ ] Assessment 목록 조회
- [ ] 결과 입력 기능

**테스트:**
- [ ] Assessment 생성 테스트
- [ ] 결과 입력 테스트

### 10.6 Student - Assessment Results 조회 페이지
- [ ] `app/(dashboard)/student/grades/page.tsx` 생성
- [ ] 자신의 시험 결과 조회
- [ ] 성적 그래프/차트 표시

**테스트:**
- [ ] 시험 결과 조회
- [ ] 성적 시각화 확인

---

## Phase 11: Class Announcements (공지사항) 구현

### 11.1 Class Announcements 테이블 생성
```sql
CREATE TABLE public.class_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  priority text DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'urgent')),
  is_pinned boolean DEFAULT false,
  published_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.class_announcements ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_class_announcements_class ON class_announcements(class_id);
```

- [ ] class_announcements 테이블 생성 완료

### 11.2 Class Announcements RLS 정책
```sql
-- Teachers는 담당 반의 공지사항 관리 가능
CREATE POLICY "Teachers can manage announcements"
ON class_announcements FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  OR teacher_id IN (SELECT id FROM teachers WHERE profile_id = auth.uid())
);

-- Students는 자신의 반 공지사항 조회 가능
CREATE POLICY "Students can view their class announcements"
ON class_announcements FOR SELECT
TO authenticated
USING (
  class_id IN (
    SELECT cs.class_id FROM students s
    JOIN class_students cs ON s.id = cs.student_id
    WHERE s.profile_id = auth.uid() AND cs.status = 'active'
  )
);
```

- [ ] class_announcements RLS 정책 생성 완료

### 11.3 샘플 Announcement 데이터 추가
```sql
INSERT INTO class_announcements (
  class_id,
  teacher_id,
  title,
  content,
  priority,
  is_pinned,
  published_at
)
VALUES (
  (SELECT id FROM classes WHERE name = 'Elementary Level 1'),
  (SELECT id FROM teachers WHERE name = '김선생'),
  '다음 주 수업 일정 변경 안내',
  '수요일 수업이 목요일로 변경됩니다.',
  'important',
  true,
  now()
);
```

- [ ] 샘플 Announcement 추가 완료

### 11.4 Teacher - Announcements 관리 페이지
- [ ] `app/(dashboard)/teacher/announcements/page.tsx` 생성
- [ ] Announcement 작성 폼
- [ ] Announcement 목록 조회
- [ ] 중요도/고정 설정

**테스트:**
- [ ] Announcement 작성 테스트
- [ ] 중요도 설정 테스트

### 11.5 Student - Announcements 조회 페이지
- [ ] `app/(dashboard)/student/announcements/page.tsx` 생성
- [ ] 자신의 반 공지사항 조회
- [ ] 중요 공지 강조 표시

**테스트:**
- [ ] 공지사항 조회
- [ ] 우선순위 표시 확인

---

## Phase 12: 최종 테스트 및 마무리

### 12.1 전체 데이터 연동 테스트
- [ ] Admin으로 로그인하여 모든 데이터 확인
- [ ] Teacher로 로그인하여 담당 반/학생 확인
- [ ] Student로 로그인하여 본인 데이터 확인

### 12.2 권한 테스트
- [ ] Teacher가 다른 반 데이터 접근 불가 확인
- [ ] Student가 다른 학생 데이터 접근 불가 확인
- [ ] 각 역할별 RLS 정책 작동 확인

### 12.3 성능 최적화
- [ ] 모든 필요한 인덱스 생성 확인
- [ ] 느린 쿼리 확인 및 최적화
- [ ] N+1 쿼리 문제 해결

### 12.4 UI/UX 개선
- [ ] 로딩 상태 표시
- [ ] 에러 처리
- [ ] Toast 알림
- [ ] 반응형 디자인 확인

### 12.5 문서화
- [ ] API 문서 작성
- [ ] 데이터베이스 스키마 다이어그램 업데이트
- [ ] README 업데이트

---

## 완료! 🎉

모든 체크리스트 완료 후:
- [ ] 프로덕션 배포 준비
- [ ] 백업 설정
- [ ] 모니터링 설정

---

## 참고 자료

- [Supabase 공식 문서](https://supabase.com/docs)
- [Next.js 공식 문서](https://nextjs.org/docs)
- [PostgreSQL 문서](https://www.postgresql.org/docs/)
- 프로젝트 계획서: `docs/영어학원_관리_시스템_b30121c3.plan.md`
