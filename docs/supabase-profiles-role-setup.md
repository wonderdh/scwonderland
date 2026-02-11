# Supabase Profiles 테이블에 유저 권한(Role) 추가 가이드

Supabase [User Management](https://supabase.com/docs/guides/auth/managing-user-data) 문서를 참고하여, `public.profiles` 테이블에서 유저 권한(Admin, Teacher, Student, Null)을 다룰 수 있도록 하는 방법을 정리합니다.

---

## 1. 참고 문서

- **User Management**: https://supabase.com/docs/guides/auth/managing-user-data  
- Auth 스키마는 API로 직접 노출되지 않으므로, `public` 스키마에 별도 테이블을 두고 `auth.users`를 참조합니다.

---

## 2. Profiles 테이블에 role 컬럼 추가

`public.profiles` 테이블을 만들 때(또는 기존 테이블 수정 시) **role** 컬럼을 추가합니다.

- **역할 값**: `'admin'`, `'teacher'`, `'student'`, `null` (미지정)
- **타입**: `text` 또는 `role_type` 같은 custom enum 권장

### 2.1 예시: text 컬럼 사용

```sql
create table public.profiles (
  id uuid not null references auth.users on delete cascade,
  first_name text,
  last_name text,
  role text check (role in ('admin', 'teacher', 'student')),
  primary key (id)
);

alter table public.profiles enable row level security;
```

- `null`은 check 제약에 넣지 않으면 기본적으로 허용됩니다.
- 필요하면 `default null`을 명시할 수 있습니다.

### 2.2 예시: enum 타입 사용 (선택)

```sql
create type public.user_role as enum ('admin', 'teacher', 'student');

create table public.profiles (
  id uuid not null references auth.users on delete cascade,
  first_name text,
  last_name text,
  role public.user_role default null,
  primary key (id)
);

alter table public.profiles enable row level security;
```

- `role` 미지정 시 `null`로 두려면 `default null` 또는 생략하면 됩니다.

---

## 3. 가입 시 profiles 행 생성 트리거 (role 포함)

문서의 `handle_new_user()` 트리거를 확장해, 가입 시 `public.profiles`에 행이 들어가도록 하고, **role**은 기본값 `null`로 두거나 `raw_user_meta_data`에서 읽을 수 있게 합니다.

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, first_name, last_name, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    (new.raw_user_meta_data ->> 'role')::text  -- 또는 enum인 경우 (new.raw_user_meta_data ->> 'role')::public.user_role
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

- `role`을 가입 시부터 넣고 싶으면 클라이언트에서 `signUp` 시 `options.data.role`에 `'admin'` / `'teacher'` / `'student'` 중 하나를 넣으면 됩니다.
- 넣지 않으면 `raw_user_meta_data ->> 'role'`이 null이므로 DB에 `null`로 저장됩니다.

---

## 4. 유저 메타데이터로 role 전달 (클라이언트 예시)

문서의 “Adding and retrieving user metadata”처럼, 가입 시 메타데이터에 role을 넣을 수 있습니다.

```javascript
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'example-password',
  options: {
    data: {
      first_name: 'John',
      last_name: 'Doe',
      role: 'student',  // 'admin' | 'teacher' | 'student' 또는 생략 시 null
    },
  },
});
```

- 이후 `user.user_metadata.role` 또는 `public.profiles.role`로 조회할 수 있습니다.

---

## 5. Role 선택/변경을 위한 RLS 정책 예시

- **역할 선택/변경**은 “누가 할 수 있는지”에 따라 정책을 나눕니다.
- 예: 본인은 자신의 `profiles`만 읽기, **Admin만** 모든 프로필의 `role` 수정 등.

예시 (요지만):

- `profiles` select: 본인 행만 또는 Admin/Teacher는 추가 범위.
- `profiles` update: 본인은 `role` 제외 필드만 수정, **role 수정은 admin만** 등으로 제한하는 정책을 추가합니다.

```sql
-- 예: 본인 프로필만 읽기
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- 예: Admin만 role 포함 전체 업데이트 (실제로는 role만 바꾸는 정책도 가능)
create policy "Admins can update any profile role"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
```

- Teacher/Student에게 필요한 정책은 앱 요구사항에 맞게 추가하면 됩니다.

---

## 6. 요약

| 항목 | 내용 |
|------|------|
| **역할 값** | Admin, Teacher, Student, Null (미지정) |
| **저장 위치** | `public.profiles.role` (또는 `auth.users.raw_user_meta_data`와 동기화) |
| **가입 시** | `handle_new_user()` 트리거에서 `role` 삽입 (메타데이터 또는 null) |
| **선택/변경** | RLS로 “Admin만 role 변경” 등 권한 제어 |
| **참고 문서** | [Supabase – User Management](https://supabase.com/docs/guides/auth/managing-user-data) |

이 가이드는 **실행하지 않고** 스키마/정책 설계와 SQL 예시를 문서로만 제공합니다. 실제 적용 시 Supabase 대시보드의 SQL Editor 또는 마이그레이션으로 실행하면 됩니다.

---

## 7. SQL Editor에 그대로 붙여넣기

Supabase 대시보드 → **SQL Editor**에서 아래 중 해당하는 블록을 **통째로 복사**해서 붙여넣고 **Run** 하면 됩니다.

### 7.1 처음 설정 (profiles 테이블이 아직 없을 때)

한 번에 **enum 타입** + 테이블 생성 + 트리거 + RLS까지 적용합니다. Table Editor에서 `role` 컬럼을 클릭하면 **드롭다운(admin, teacher, student, null)**으로 선택할 수 있습니다.

```sql
-- 1) 역할 enum (Table Editor에서 드롭다운으로 선택 가능)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('admin', 'teacher', 'student');
  end if;
end $$;

-- 2) profiles 테이블 (role: admin, teacher, student, null)
create table public.profiles (
  id uuid not null references auth.users on delete cascade,
  first_name text,
  last_name text,
  role public.user_role default null,
  primary key (id)
);

alter table public.profiles enable row level security;

-- 3) 가입 시 profiles 행 자동 생성
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, first_name, last_name, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    case
      when new.raw_user_meta_data ->> 'role' in ('admin','teacher','student')
      then (new.raw_user_meta_data ->> 'role')::public.user_role
      else null
    end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4) RLS 정책
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Admins can update any profile role" on public.profiles;
create policy "Admins can update any profile role"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
```

### 7.2 이미 profiles 테이블이 있을 때 (role 컬럼 + 트리거 + RLS만 추가)

기존 `public.profiles`가 이미 있다면 아래만 실행합니다. **role을 enum으로 두면 Table Editor에서 드롭다운(admin, teacher, student, null)으로 선택 가능**합니다.

```sql
-- 1) 역할 enum 생성 (이미 있으면 스킵)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('admin', 'teacher', 'student');
  end if;
end $$;

-- 2) role 컬럼 추가 (enum 타입 → 드롭다운 표시)
alter table public.profiles
  add column if not exists role public.user_role default null;

-- 3) 가입 시 profiles 행 생성 함수/트리거 (role 반영)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, first_name, last_name, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    case
      when new.raw_user_meta_data ->> 'role' in ('admin','teacher','student')
      then (new.raw_user_meta_data ->> 'role')::public.user_role
      else null
    end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4) RLS 정책 (이미 있으면 기존 정책 이름에 맞춰 수정 후 사용)
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Admins can update any profile role" on public.profiles;
create policy "Admins can update any profile role"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
```

### 7.3 참고: role이 이미 text 컬럼일 때 (enum 드롭다운으로 바꾸기)

예전에 `role text`로 만들어 둔 경우, 아래만 실행하면 Table Editor에서 드롭다운으로 선택할 수 있게 바뀝니다. (기존 값이 admin/teacher/student가 아니면 에러가 나므로, 필요 시 먼저 잘못된 값들을 null로 수정한 뒤 실행하세요.)

```sql
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('admin', 'teacher', 'student');
  end if;
end $$;

alter table public.profiles
  alter column role type public.user_role using role::public.user_role;
```
