# Profile 생성 + role별 students/teachers 자동 추가

## 설명

- **auth.users**에 새 사용자가 INSERT되면 트리거가 다음을 수행합니다.
  1. **profiles**에 한 행 추가 (기존과 동일: id, first_name, last_name, role)
  2. **role이 `student`** → `insert_student_from_profile()` 호출 → **students** 테이블에 한 행 추가
  3. **role이 `teacher`** → `insert_teacher_from_profile()` 호출 → **teachers** 테이블에 한 행 추가
- students/teachers에 넣는 **구체적인 값(컬럼)** 은 추후 확장할 수 있도록, 지금은 메타데이터에서 꺼낼 수 있는 최소 필드만 사용합니다.
- **students** 테이블: `profile_id`, `korean_name`, `english_name` (student_number는 기존 트리거로 자동 생성)
- **teachers** 테이블: `profile_id`, `name` (teacher_number는 기존 트리거로 자동 생성)

---

## 계정 삭제 시 연쇄 삭제 (profiles → students/teachers)

Auth에서 유저를 삭제하면 **profiles**와 **students** / **teachers**에서도 같이 삭제되게 하려면, `auth.users` **DELETE** 시 동작하는 트리거를 하나 둡니다.

- **auth.users**에서 행이 DELETE되면 → `handle_deleted_user()` 트리거가 **public.profiles**에서 `id = old.id`인 행을 삭제합니다.
- **profiles** 행이 삭제되면, **students** / **teachers**는 `profile_id REFERENCES profiles(id) ON DELETE CASCADE`이므로 자동으로 해당 행들이 삭제됩니다.

설정용 SQL은 **`docs/auth-user-delete-cascade.sql`** 에 있습니다. Supabase SQL Editor에서 해당 파일 내용을 한 번 실행하면 됩니다.

---

## "Database error creating new user"가 날 때

이 메시지는 **Auth 쪽이 아니라**, `auth.users`에 INSERT된 뒤 돌아가는 **트리거(handle_new_user)** 안에서 에러가 났을 때 Supabase가 내려주는 메시지입니다.

**할 일:**

1. **Supabase 대시보드 → Logs** (또는 Database → Logs)에서 최근 에러 로그를 확인해, PostgreSQL이 찍은 실제 에러 메시지를 확인하세요.
2. 아래가 모두 있는지 확인하세요.
   - `public.user_role` enum (`'admin','teacher','student'`)
   - `public.profiles` 테이블 (id, first_name, last_name, role)
   - `public.students` 테이블 + `generate_student_number()` 함수 + `trigger_set_student_number` 트리거
   - `public.teachers` 테이블 + `generate_teacher_number()` 함수 + `trigger_set_teacher_number` 트리거
   - `public.insert_student_from_profile`, `public.insert_teacher_from_profile`, `public.handle_new_user` 함수
   - `on_auth_user_created` 트리거 (auth.users AFTER INSERT)
3. 아래 **진단용 SQL**을 SQL Editor에서 실행해 보세요. 없거나 타입이 다른 항목이 있으면 그걸 먼저 만든 뒤 다시 유저 생성을 시도하세요.

```sql
-- 진단: 필요한 객체 존재 여부
SELECT 'user_role enum' AS obj, EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) AS ok
UNION ALL
SELECT 'profiles', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles')
UNION ALL
SELECT 'students', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'students')
UNION ALL
SELECT 'teachers', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'teachers')
UNION ALL
SELECT 'insert_student_from_profile', EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'insert_student_from_profile')
UNION ALL
SELECT 'insert_teacher_from_profile', EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'insert_teacher_from_profile')
UNION ALL
SELECT 'handle_new_user', EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'handle_new_user')
UNION ALL
SELECT 'generate_student_number', EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'generate_student_number')
UNION ALL
SELECT 'generate_teacher_number', EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'generate_teacher_number');
```

4. 문서 아래쪽 **한 번에 실행할 SQL**을 다시 실행해 트리거를 **예외 처리 포함 버전**으로 갱신해 두면, students/teachers 삽입이 실패해도 **유저와 프로필은 생성**되고, Supabase 로그에 `insert_student_from_profile failed for ...` 같은 WARNING이 찍힙니다. 그 메시지로 원인을 좁힐 수 있습니다.

---

## 1. students 테이블에 넣는 함수

- **역할**: `profile_id`와 메타데이터(`raw_user_meta_data`)를 받아서 **students**에 한 행 삽입.
- **값 매핑 (추후 수정 가능)**  
  - `korean_name`: `korean_name` → 없으면 `first_name` → 없으면 `'이름 미정'`  
  - `english_name`: `english_name` → 없으면 `last_name` (NULL 허용)

```sql
-- students 테이블에 profile 기반으로 한 행 추가
CREATE OR REPLACE FUNCTION public.insert_student_from_profile(
  p_profile_id uuid,
  p_meta jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.students (profile_id, korean_name, english_name)
  VALUES (
    p_profile_id,
    coalesce(
      nullif(trim(p_meta ->> 'korean_name'), ''),
      nullif(trim(p_meta ->> 'first_name'), ''),
      '이름 미정'
    ),
    nullif(trim(p_meta ->> 'english_name'), '')
  );
END;
$$;
```

---

## 2. teachers 테이블에 넣는 함수

- **역할**: `profile_id`와 메타데이터를 받아서 **teachers**에 한 행 삽입.
- **값 매핑 (추후 수정 가능)**  
  - `name`: `name` → 없으면 `korean_name` → 없으면 `first_name || ' ' || last_name` → 없으면 `'이름 미정'`

```sql
-- teachers 테이블에 profile 기반으로 한 행 추가
CREATE OR REPLACE FUNCTION public.insert_teacher_from_profile(
  p_profile_id uuid,
  p_meta jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.teachers (profile_id, name)
  VALUES (
    p_profile_id,
    coalesce(
      nullif(trim(p_meta ->> 'name'), ''),
      nullif(trim(p_meta ->> 'korean_name'), ''),
      nullif(trim(
        coalesce(p_meta ->> 'first_name', '') || ' ' || coalesce(p_meta ->> 'last_name', '')
      ), ''),
      '이름 미정'
    )
  );
END;
$$;
```

---

## 3. handle_new_user() 수정 (profiles 추가 + role별 students/teachers 호출)

- **profiles**에는 기존처럼 무조건 한 행 추가.
- 그 다음 **role**이 `student`면 `insert_student_from_profile`, `teacher`면 `insert_teacher_from_profile` 호출.

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role text;
BEGIN
  -- 1) profiles에는 항상 추가 (기존과 동일)
  INSERT INTO public.profiles (id, first_name, last_name, role)
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    CASE
      WHEN new.raw_user_meta_data ->> 'role' IN ('admin', 'teacher', 'student')
      THEN (new.raw_user_meta_data ->> 'role')::public.user_role
      ELSE NULL
    END
  );

  v_role := new.raw_user_meta_data ->> 'role';

  -- 2) role이 student면 students 테이블에 추가 (실패해도 유저·프로필은 유지)
  IF v_role = 'student' THEN
    BEGIN
      PERFORM public.insert_student_from_profile(new.id, new.raw_user_meta_data);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'insert_student_from_profile failed for %: %', new.id, SQLERRM;
    END;
  END IF;

  -- 3) role이 teacher면 teachers 테이블에 추가
  IF v_role = 'teacher' THEN
    BEGIN
      PERFORM public.insert_teacher_from_profile(new.id, new.raw_user_meta_data);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'insert_teacher_from_profile failed for %: %', new.id, SQLERRM;
    END;
  END IF;

  RETURN new;
END;
$$;
```

- 트리거는 기존 그대로 사용 (이미 있다면 재생성 불필요):

```sql
-- 트리거가 없을 때만 생성
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();
```

---

## 4. 한 번에 복사해서 실행할 SQL

아래 블록을 Supabase SQL Editor에 붙여 넣고 한 번에 실행하면 됩니다.

```sql
-- ========== 1. students 추가 함수 ==========
CREATE OR REPLACE FUNCTION public.insert_student_from_profile(
  p_profile_id uuid,
  p_meta jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.students (profile_id, korean_name, english_name)
  VALUES (
    p_profile_id,
    coalesce(
      nullif(trim(p_meta ->> 'korean_name'), ''),
      nullif(trim(p_meta ->> 'first_name'), ''),
      '이름 미정'
    ),
    nullif(trim(p_meta ->> 'english_name'), '')
  );
END;
$$;

-- ========== 2. teachers 추가 함수 ==========
CREATE OR REPLACE FUNCTION public.insert_teacher_from_profile(
  p_profile_id uuid,
  p_meta jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.teachers (profile_id, name)
  VALUES (
    p_profile_id,
    coalesce(
      nullif(trim(p_meta ->> 'name'), ''),
      nullif(trim(p_meta ->> 'korean_name'), ''),
      nullif(trim(
        coalesce(p_meta ->> 'first_name', '') || ' ' || coalesce(p_meta ->> 'last_name', '')
      ), ''),
      '이름 미정'
    )
  );
END;
$$;

-- ========== 3. handle_new_user (profiles + role별 students/teachers) ==========
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role text;
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, role)
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    CASE
      WHEN new.raw_user_meta_data ->> 'role' IN ('admin', 'teacher', 'student')
      THEN (new.raw_user_meta_data ->> 'role')::public.user_role
      ELSE NULL
    END
  );

  v_role := new.raw_user_meta_data ->> 'role';

  -- students/teachers 삽입 실패해도 유저·프로필은 유지 (실패 시 로그만 남기고 계속)
  IF v_role = 'student' THEN
    BEGIN
      PERFORM public.insert_student_from_profile(new.id, new.raw_user_meta_data);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'insert_student_from_profile failed for %: %', new.id, SQLERRM;
    END;
  END IF;

  IF v_role = 'teacher' THEN
    BEGIN
      PERFORM public.insert_teacher_from_profile(new.id, new.raw_user_meta_data);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'insert_teacher_from_profile failed for %: %', new.id, SQLERRM;
    END;
  END IF;

  RETURN new;
END;
$$;

-- ========== 4. 트리거 (이미 있으면 에러 나므로 필요 시 DROP 후 실행) ==========
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();
```

이미 `on_auth_user_created` 트리거가 있으면 4번에서 에러가 날 수 있습니다. 그때는 4번 블록 맨 위의 `DROP TRIGGER IF EXISTS ...` 주석을 해제한 뒤 다시 실행하면 됩니다.
