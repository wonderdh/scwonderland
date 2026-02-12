# Students & Teachers 테이블 구축 가이드 (단순화 버전)

> 이 문서는 students와 teachers 테이블을 간단하게 구축하는 방법을 설명합니다.

---

## 1. Students 테이블 생성

### 1.1 테이블 구조

**students**
- `id` (uuid, PK) - 자동 생성
- `profile_id` (uuid, FK → profiles.id, UNIQUE) - auth.users와 연결
- `korean_name` (text, **필수**) - 한글 이름
- `english_name` (text, nullable) - 영어 이름 (선택)
- `student_number` (text, unique, **자동 생성**) - 학생 번호 (S_2026001 형식)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### 1.2 학생 번호 자동 생성 함수

학생 번호는 `S_YYYY001` 형식으로 자동 생성됩니다. (예: S_2026001, S_2026002, S_2027001...)

```sql
-- 1. 학생 번호 생성 함수
CREATE OR REPLACE FUNCTION generate_student_number()
RETURNS text AS $$
DECLARE
  current_year text;
  seq_name text;
  seq_num text;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::text;
  seq_name := 'student_number_seq_' || current_year;
  
  -- 해당 연도의 시퀀스가 없으면 생성
  IF NOT EXISTS (
    SELECT 1 FROM pg_sequences 
    WHERE schemaname = 'public' AND sequencename = seq_name
  ) THEN
    EXECUTE format('CREATE SEQUENCE %I START 1', seq_name);
  END IF;
  
  -- 다음 번호 가져오기 (3자리 숫자로 패딩)
  EXECUTE format('SELECT LPAD(nextval(%L)::text, 3, %L)', seq_name, '0') INTO seq_num;
  
  RETURN 'S_' || current_year || seq_num;
END;
$$ LANGUAGE plpgsql;
```

### 1.3 Students 테이블 생성

```sql
-- students 테이블
CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  korean_name text NOT NULL,
  english_name text,
  student_number text UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- RLS 활성화
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- 인덱스 생성
CREATE INDEX idx_students_profile_id ON students(profile_id);
CREATE INDEX idx_students_number ON students(student_number);
```

### 1.4 학생 번호 자동 할당 트리거

```sql
-- 트리거 함수
CREATE OR REPLACE FUNCTION set_student_number()
RETURNS trigger AS $$
BEGIN
  IF NEW.student_number IS NULL THEN
    NEW.student_number := generate_student_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
CREATE TRIGGER trigger_set_student_number
  BEFORE INSERT ON students
  FOR EACH ROW
  EXECUTE FUNCTION set_student_number();
```

### 1.5 Students RLS 정책

```sql
-- Admin만 students 관리 가능
CREATE POLICY "Admins can manage students"
ON students FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Students는 자신의 정보만 조회 가능
CREATE POLICY "Students can view own info"
ON students FOR SELECT
TO authenticated
USING (profile_id = auth.uid());
```

### 1.6 테스트

```sql
-- Step 1: profiles 테이블에 student 추가 (이미 auth 계정이 있다고 가정)
-- 예: admin이 student@test.com 계정을 만들었음

-- Step 2: role을 'student'로 설정
UPDATE profiles 
SET role = 'student' 
WHERE email = 'student@test.com';

-- Step 3: students 테이블에 데이터 추가 (student_number는 자동 생성)
INSERT INTO students (profile_id, korean_name, english_name)
VALUES (
  (SELECT id FROM profiles WHERE email = 'student@test.com'),
  '홍길동',
  'John Hong'
);

-- Step 4: 학생 번호 확인
SELECT student_number, korean_name, english_name 
FROM students 
WHERE korean_name = '홍길동';
-- 결과 예: S_2026001
```

---

## 2. Teachers 테이블 생성

### 2.1 테이블 구조

**teachers**
- `id` (uuid, PK) - 자동 생성
- `profile_id` (uuid, FK → profiles.id, UNIQUE) - auth.users와 연결
- `name` (text, **필수**) - 교사 이름
- `teacher_number` (text, unique, **자동 생성**) - 교사 번호 (T_2026001 형식)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### 2.2 교사 번호 자동 생성 함수

교사 번호는 `T_YYYY001` 형식으로 자동 생성됩니다. (예: T_2026001, T_2026002, T_2027001...)

```sql
-- 1. 교사 번호 생성 함수
CREATE OR REPLACE FUNCTION generate_teacher_number()
RETURNS text AS $$
DECLARE
  current_year text;
  seq_name text;
  seq_num text;
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::text;
  seq_name := 'teacher_number_seq_' || current_year;
  
  -- 해당 연도의 시퀀스가 없으면 생성
  IF NOT EXISTS (
    SELECT 1 FROM pg_sequences 
    WHERE schemaname = 'public' AND sequencename = seq_name
  ) THEN
    EXECUTE format('CREATE SEQUENCE %I START 1', seq_name);
  END IF;
  
  -- 다음 번호 가져오기 (3자리 숫자로 패딩)
  EXECUTE format('SELECT LPAD(nextval(%L)::text, 3, %L)', seq_name, '0') INTO seq_num;
  
  RETURN 'T_' || current_year || seq_num;
END;
$$ LANGUAGE plpgsql;
```

### 2.3 Teachers 테이블 생성

```sql
-- teachers 테이블
CREATE TABLE public.teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  teacher_number text UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- RLS 활성화
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

-- 인덱스 생성
CREATE INDEX idx_teachers_profile_id ON teachers(profile_id);
CREATE INDEX idx_teachers_number ON teachers(teacher_number);
```

### 2.4 교사 번호 자동 할당 트리거

```sql
-- 트리거 함수
CREATE OR REPLACE FUNCTION set_teacher_number()
RETURNS trigger AS $$
BEGIN
  IF NEW.teacher_number IS NULL THEN
    NEW.teacher_number := generate_teacher_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
CREATE TRIGGER trigger_set_teacher_number
  BEFORE INSERT ON teachers
  FOR EACH ROW
  EXECUTE FUNCTION set_teacher_number();
```

### 2.5 Teachers RLS 정책

```sql
-- Admin만 teachers 관리 가능
CREATE POLICY "Admins can manage teachers"
ON teachers FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Teachers는 자신의 정보만 조회 가능
CREATE POLICY "Teachers can view own info"
ON teachers FOR SELECT
TO authenticated
USING (profile_id = auth.uid());
```

### 2.6 테스트

```sql
-- Step 1: profiles 테이블에 teacher 추가 (이미 auth 계정이 있다고 가정)
-- 예: admin이 teacher@test.com 계정을 만들었음

-- Step 2: role을 'teacher'로 설정
UPDATE profiles 
SET role = 'teacher' 
WHERE email = 'teacher@test.com';

-- Step 3: teachers 테이블에 데이터 추가 (teacher_number는 자동 생성)
INSERT INTO teachers (profile_id, name)
VALUES (
  (SELECT id FROM profiles WHERE email = 'teacher@test.com'),
  '김선생'
);

-- Step 4: 교사 번호 확인
SELECT teacher_number, name 
FROM teachers 
WHERE name = '김선생';
-- 결과 예: T_2026001
```

---

## 3. 통합 테스트

### 3.1 여러 학생 추가

```sql
-- 학생 1
INSERT INTO students (profile_id, korean_name, english_name)
VALUES (
  (SELECT id FROM profiles WHERE email = 'student1@test.com'),
  '홍길동',
  'John Hong'
);
-- → S_2026001

-- 학생 2
INSERT INTO students (profile_id, korean_name)
VALUES (
  (SELECT id FROM profiles WHERE email = 'student2@test.com'),
  '김영희'
);
-- → S_2026002

-- 학생 3
INSERT INTO students (profile_id, korean_name, english_name)
VALUES (
  (SELECT id FROM profiles WHERE email = 'student3@test.com'),
  '박철수',
  'Peter Park'
);
-- → S_2026003
```

### 3.2 여러 교사 추가

```sql
-- 교사 1
INSERT INTO teachers (profile_id, name)
VALUES (
  (SELECT id FROM profiles WHERE email = 'teacher1@test.com'),
  '김선생'
);
-- → T_2026001

-- 교사 2
INSERT INTO teachers (profile_id, name)
VALUES (
  (SELECT id FROM profiles WHERE email = 'teacher2@test.com'),
  '이선생'
);
-- → T_2026002
```

### 3.3 번호 자동 생성 확인

```sql
-- 모든 학생 조회
SELECT student_number, korean_name, english_name, created_at
FROM students
ORDER BY created_at;

-- 모든 교사 조회
SELECT teacher_number, name, created_at
FROM teachers
ORDER BY created_at;
```

---

## 4. 계정 생성 전체 프로세스

### 4.1 Admin이 Student 계정 생성하는 과정

**Step 1: Auth 계정 생성 (Supabase Dashboard 또는 코드)**

Supabase Dashboard → Authentication → Users → "Add User":
- Email: `student@test.com`
- Password: `temp-password-123`
- Email Confirm: ✓

또는 코드로:
```typescript
const { data: authData, error } = await supabase.auth.admin.createUser({
  email: 'student@test.com',
  password: 'temp-password-123',
  email_confirm: true
});
```

**Step 2: profiles 테이블 확인 (트리거로 자동 생성됨)**

```sql
SELECT * FROM profiles WHERE email = 'student@test.com';
```

**Step 3: role을 'student'로 설정**

```sql
UPDATE profiles 
SET role = 'student' 
WHERE email = 'student@test.com';
```

**Step 4: students 테이블에 상세 정보 추가**

```sql
INSERT INTO students (profile_id, korean_name, english_name)
VALUES (
  (SELECT id FROM profiles WHERE email = 'student@test.com'),
  '홍길동',
  'John Hong'
);
```

**Step 5: 결과 확인**

```sql
SELECT 
  p.email,
  p.role,
  s.student_number,
  s.korean_name,
  s.english_name
FROM profiles p
JOIN students s ON p.id = s.profile_id
WHERE p.email = 'student@test.com';
```

### 4.2 Admin이 Teacher 계정 생성하는 과정

**Step 1: Auth 계정 생성**

```typescript
const { data: authData, error } = await supabase.auth.admin.createUser({
  email: 'teacher@test.com',
  password: 'temp-password-123',
  email_confirm: true
});
```

**Step 2: role을 'teacher'로 설정**

```sql
UPDATE profiles 
SET role = 'teacher' 
WHERE email = 'teacher@test.com';
```

**Step 3: teachers 테이블에 상세 정보 추가**

```sql
INSERT INTO teachers (profile_id, name)
VALUES (
  (SELECT id FROM profiles WHERE email = 'teacher@test.com'),
  '김선생'
);
```

**Step 4: 결과 확인**

```sql
SELECT 
  p.email,
  p.role,
  t.teacher_number,
  t.name
FROM profiles p
JOIN teachers t ON p.id = t.profile_id
WHERE p.email = 'teacher@test.com';
```

---

## 5. 자주 사용하는 쿼리

### 5.1 현재 로그인한 학생 정보 조회

```sql
SELECT 
  s.*,
  p.email,
  p.phone
FROM students s
JOIN profiles p ON s.profile_id = p.id
WHERE s.profile_id = auth.uid();
```

### 5.2 현재 로그인한 교사 정보 조회

```sql
SELECT 
  t.*,
  p.email,
  p.phone
FROM teachers t
JOIN profiles p ON t.profile_id = p.id
WHERE t.profile_id = auth.uid();
```

### 5.3 모든 학생 목록 (Admin용)

```sql
SELECT 
  s.student_number,
  s.korean_name,
  s.english_name,
  p.email,
  s.created_at
FROM students s
JOIN profiles p ON s.profile_id = p.id
ORDER BY s.created_at DESC;
```

### 5.4 모든 교사 목록 (Admin용)

```sql
SELECT 
  t.teacher_number,
  t.name,
  p.email,
  t.created_at
FROM teachers t
JOIN profiles p ON t.profile_id = p.id
ORDER BY t.created_at DESC;
```

---

## 6. 다음 단계

이제 기본 테이블이 완성되었습니다. 다음으로 구현할 것들:

1. ✅ **Admin 페이지** - Students/Teachers 관리 UI
2. **Classes 테이블** - 반 생성 및 관리
3. **class_students, class_teachers** - 학생/교사를 반에 배정
4. **Report Cards** - 성적표 작성
5. **Homework** - 숙제 출제 및 제출
6. 기타 등등...

---

## 7. 체크리스트

- [ ] `generate_student_number()` 함수 생성
- [ ] `generate_teacher_number()` 함수 생성
- [ ] `students` 테이블 생성
- [ ] `teachers` 테이블 생성
- [ ] 학생 번호 자동 할당 트리거 생성
- [ ] 교사 번호 자동 할당 트리거 생성
- [ ] RLS 정책 생성 (students)
- [ ] RLS 정책 생성 (teachers)
- [ ] 테스트 학생 계정 3개 생성
- [ ] 테스트 교사 계정 2개 생성
- [ ] 번호 자동 생성 확인 (S_2026001, T_2026001 형식)
- [ ] RLS 정책 테스트 (student/teacher로 로그인해서 본인 정보만 보이는지)

완료!
