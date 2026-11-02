# supabase/

마이그레이션 + 로컬 CLI 설정.

## 마이그레이션 흐름

1. 새 SQL 파일을 `migrations/` 에 추가. 파일명 timestamp 규칙은 Supabase CLI 에 위임.
2. `pnpm db:types:local` (로컬) 또는 `pnpm db:types` (원격) 으로 `src/lib/types/database.ts` 갱신.
3. 타입 변경 PR 에 같이 commit.

## FK 컨벤션 (중요)

`students.id = teachers.id = profiles.id` (shared PK) 라서 동작은 같아도 **참조하는 테이블은 컬럼의 의미에 맞춰야** 한다. DB 가 "진짜 학생/교사 인지" 강제하도록.

- 학생을 가리키는 컬럼 (`student_id` 등) → **`public.students(id)`**
- 교사를 가리키는 컬럼 (`teacher_id` 등) → **`public.teachers(id)`**
- actor / 작성자 컬럼이 admin 도 될 수 있으면 (`assigned_by`, `recorded_by`, `marked_by`, `updated_by`, `author_id`, `reviewed_by` 등) → **`public.profiles(id)`** 유지. admin 은 students/teachers 행이 없기 때문.
- actor 가 **교사 전용**이라고 RLS 로 보장되면 → `teachers(id)`. 학생 전용이면 → `students(id)`.

❌ 안티패턴: `student_id uuid references public.profiles(id)` — 동작은 하지만 admin id 가 들어가도 막지 못함.
✅ 정답: `student_id uuid references public.students(id)`

기존 위반 사례는 `20260512000000_role_specific_fks.sql` 에서 일괄 교체.

## 주의

- RLS 정책 변경은 마이그레이션으로만. 수동 SQL 패치 금지.
- `class_students` 는 **삭제하지 않는다** (soft leave: `is_active=false`). `report_cards` 가 이 행을 FK(RESTRICT) 로 가리킴. 명단 조회는 `is_active = true` 필터 필수, 재배정은 `upsert … is_active: true` 로 기존 행 복구. (`20261102010000`)
- `config.toml` 은 로컬 CLI 용. 시크릿 들어가면 안 됨.
- `snippets/`, `.branches/` 는 CLI 가 관리. 직접 편집 X.
