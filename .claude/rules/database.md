---
paths:
  - "src/lib/types/**/*"
  - "src/lib/supabase/**/*"
  - "src/app/(admin)/admin/actions/**/*"
  - "docs/**/*.sql"
---

# Database & Supabase

## Database Schema

```
Supabase Auth Users
    │
    ├── profiles (id, role: "admin"|"student"|"teacher", first_name, last_name, deleted_at TIMESTAMPTZ)
    │   ├── students (profile_id FK, korean_name, english_name, student_number [auto])
    │   └── teachers (profile_id FK, name, teacher_number [auto], teacher_type ENUM: "korean"|"native")
    │
    ├── classes (id, name, group_label: "유치부"|"오후반"|"방과후")
    │   ├── class_teachers (class_id FK, teacher_profile_id FK) [junction, 최대 2명]
    │   ├── class_students (class_id FK, student_profile_id FK) [junction]
    │   └── class_schedules (class_id XOR student_profile_id, period_id FK,
    │       day, teacher_profile_id FK, label, textbook_id FK→textbooks ON DELETE SET NULL)
    │
    ├── academy_periods (name, start_time, end_time, group_label, has_dropoff, is_active)
    │
    ├── report_cards (student_profile_id FK, author_id FK, year, month, content, content_ko, reply, reply_en)
    │   └── UNIQUE (student_profile_id, year, month)
    │
    ├── textbooks (id, title, series, level, category, total_units, cover_image, is_active)
    │   ├── class_textbooks (class_id FK, textbook_id FK) [junction]
    │   └── student_textbook_progress (student_profile_id FK, textbook_id FK,
    │       source_type, source_class_id, status, completed_units)
    │
    ├── notices + notice_attachments (공개 공지)
    ├── class_notices + class_notice_attachments (반별 공지)
    ├── academy_notices + academy_notice_attachments (포털 공지)
    │
    ├── homework_assignments (class_id, teacher_id, title, description, due_date)
    │   └── homework_submissions (assignment_id, student_profile_id, status, text_content, teacher_feedback)
    │       └── homework_submission_files (submission_id, storage_path, original_filename, mime_type)
    │
    ├── learning_records (student_profile_id, category, title, content, score, max_score, record_date)
    ├── attendance (student_profile_id, attendance_date, status: present|absent|late|early_leave, note, recorded_by)
    │   └── UNIQUE (student_profile_id, attendance_date)  -- DB 트리거: after_attendance_bus_sync
    │
    ├── bus_numbers (label, is_active)
    ├── bus_time_slots (label, time, is_active, show_empty_stops)  -- show_empty_stops: 모니터에서 배정 학생 없는 정류장·호차 카드도 노출 (오후반용, 기본 false)
    ├── bus_stop_day_assignments (bus_stop_id FK, day_of_week, bus_number_id FK)
    ├── bus_stop_schedules (bus_stop_id FK, day_of_week, slot_id FK, estimated_time)
    │   └── UNIQUE (bus_stop_id, day_of_week, bus_time_slot_id)
    ├── bus_staff (profile_id FK, bus_number_id FK)
    ├── bus_check_records (student_profile_id, check_date, slot_id, bus_number_id, boarded_at, checked_at)
    │   └── UNIQUE (student_profile_id, check_date)
    ├── student_bus_defaults (student_profile_id FK, day_of_week, bus_time_slot_id FK, bus_number_id FK, bus_stop_id FK)
    │   └── UNIQUE (student_profile_id, day_of_week)
    ├── bus_change_requests (student_profile_id, request_date, change_type, new_bus_time_slot_id, new_bus_number_id, new_bus_stop_id, reason, status, reviewed_by, reviewed_at)
    │   └── UNIQUE (student_profile_id, request_date)
    └── afterschool_enrollments (class_id FK, student_profile_id FK, day_of_week, second_period BOOLEAN)
        └── UNIQUE (class_id, student_profile_id, day_of_week)
    │
    ├── weekly_sentences (week_number 1~48, level 1~3 (1=기초/2=중급/3=상급), english, korean, example, answer (기초 Q&A))
    │   └── UNIQUE (week_number, level) — 48주×3레벨=144행 (기초는 Q&A answer 컬럼). RLS: 공개 SELECT
    └── weekly_sentence_config (싱글톤 id=1, mode: auto|manual, manual_week)
        └── RLS: 공개 SELECT. 랜딩 팝업에서 현재 주차 결정용
```

- 역할은 `user_metadata.role`에 저장 (생성 시 설정)
- student_number, teacher_number는 DB 함수로 자동 생성
- 프로필·학생·교사 레코드는 Auth 트리거로 자동 생성
- `class_schedules` CHECK 제약: `class_id IS NOT NULL XOR student_profile_id IS NOT NULL` — 반/개인 시간표 분리
- `teacher_type`은 TEXT → ENUM 마이그레이션 완료

## Supabase Clients

| 클라이언트 | 파일 | 용도 |
|-----------|------|------|
| **Browser** | `src/lib/supabase/client.ts` | Client Components (로그인 등) |
| **Server** | `src/lib/supabase/server.ts` | Server Components, Server Actions (RLS 적용, 인증 검증용) |
| **Admin** | `src/lib/supabase/admin.ts` | 사용자 생성/삭제 등 관리 작업 (RLS 우회, service role key) |

**인증 검증 패턴:** Server Action에서 `createClient()` → `getUser()` → 인증 확인 후 `createAdminClient()` 사용

## Row Level Security (RLS)

2026-04-20 기준 36개 테이블 전부 RLS 활성 + 정책 세트 적용됨 (Phase 1~5 완료). 대부분의 Server Action은 `createAdminClient()`(service role)로 RLS 우회하므로 정책은 **방어 계층 + JWT 직접 접근(`createClient()`) 경로용**. 새 정책 작성 시 아래 규칙 준수.

### SECURITY DEFINER 헬퍼 함수 (재귀 회피)

자기참조·순환 서브쿼리로 인한 `42P17 infinite recursion` 방지를 위해 role·권한 체크는 **반드시 헬퍼 함수**를 통해 수행. `EXISTS (SELECT ... FROM profiles/class_teachers/class_students ...)` 형태의 서브쿼리를 정책 qual에 직접 쓰지 말 것.

| 함수 | 반환 | 용도 |
|------|------|------|
| `public.is_current_user_admin()` | BOOL | admin role 체크 |
| `public.is_current_user_teacher()` | BOOL | teacher role 체크 |
| `public.is_current_user_native_teacher()` | BOOL | 원어민 교사 체크 (리포트카드 write용) |
| `public.is_current_user_bus_staff()` | BOOL | 버스 담당자 체크 |
| `public.current_user_teaching_class_ids()` | SETOF UUID | 현재 교사가 담당하는 class_id 목록 |
| `public.current_user_enrolled_class_ids()` | SETOF UUID | 현재 학생이 소속된 class_id 목록 |
| `public.current_user_student_ids_for_teacher()` | SETOF UUID | 현재 교사 담당 반의 학생 profile_id 목록 |
| `public.current_user_bus_number_ids()` | SETOF UUID | 현재 버스 담당자가 맡은 bus_number_id 목록 |

모두 `LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_catalog STABLE` + `GRANT EXECUTE ... TO authenticated`.

### 정책 네이밍 컨벤션

`{table_short}_{role}_{action}` 형식:
- `profiles_admin_all`, `profiles_self_select`, `profiles_self_update`
- `students_teacher_select`, `bcr_bus_staff_all`, `rc_teacher_insert`
- 접두어(`bn_`, `bts_`, `bcr_`, `sbd_`, `bcreq_`, `ae_`, `bss_`, `bsda_`, `bstaff_`, `bstops_`, `rc_`, `ha_`, `hs_`, `hsf_`, `lr_`, `att_`)는 테이블별 단축형 사용.

### 정책 작성 패턴

```sql
-- ✅ 권장: 헬퍼로 role 체크 + IN (helper()) 로 소속 확인
CREATE POLICY "students_teacher_select" ON public.students
  FOR SELECT TO authenticated
  USING (
    public.is_current_user_teacher()
    AND profile_id IN (SELECT public.current_user_student_ids_for_teacher())
  );

-- ❌ 금지: profiles/class_teachers 자기참조 서브쿼리 → 42P17
CREATE POLICY "..." ON public.profiles ...
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
```

### 컬럼 불변 트리거

RLS 정책은 컬럼 단위 제어가 불가능 (row 단위). 특정 컬럼 변경 차단이 필요하면 `BEFORE UPDATE` 트리거 사용:
- `enforce_profile_immutable_columns_trigger` — `profiles.role`, `deleted_at` JWT 변경 차단
- `enforce_report_card_student_columns_trigger` — `report_cards`의 학생 자가 수정 컬럼 제한 (reply/reply_en만 허용)

트리거 내부에서 `IF current_user IN ('authenticated', 'anon') THEN ... RAISE EXCEPTION` 패턴. service_role·postgres·supabase_admin은 bypass.

### Phase 구성

| Phase | 도메인 | 테이블 | 마이그레이션 |
|-------|--------|--------|--------------|
| 1 | users | profiles, students, teachers, class_teachers | `20260420000000_*`, `20260420050000_*` |
| 2 | classes | classes, class_students, class_schedules | `20260420080000_*` |
| 3 | academy | report_cards, homework_*, learning_records, attendance | `20260420090000_*`, `20260420100000_*` |
| 4 | bus | bus_*, student_bus_defaults, afterschool_enrollments | `20260420110000_*` |
| 5 | notices + textbooks | notices, class_notices, academy_notices, textbooks, weekly_sentences | `20260420120000_*` |

## Supabase Storage (5개 버킷)

| 버킷 | 공개여부 | 용도 |
|------|---------|------|
| `textbook-covers` | Public | 교재 커버 이미지 (JPG, PNG, WebP / 10MB 이하) |
| `notice-files` | Public | 공개 공지 이미지(images/) + 첨부파일(files/) |
| `class-notices` | Public | 반별 공지 첨부파일 |
| `academy-notices` | Public | Academy 포털 공지 첨부파일 |
| `homework-submissions` | **Private** | 숙제 제출 파일 (signed URL 1시간) |

- 서버에서 Admin Client(service role)로 업로드/삭제 → RLS 우회
- `next.config.ts`에 Supabase Storage 도메인이 `remotePatterns`에 등록됨 (next/image 최적화)
- 파일명 규칙: `{timestamp}_{random6자}{확장자}` (충돌 방지)
- Storage 헬퍼: `src/lib/supabase/storage.ts` (STORAGE_BUCKETS, generateStoragePath, extractStoragePath, validateFile)

## 환경 변수

```
NEXT_PUBLIC_SUPABASE_URL          # Supabase 프로젝트 URL
NEXT_PUBLIC_SUPABASE_ANON_KEY     # Supabase 공개 키
SUPABASE_SERVICE_ROLE_KEY         # 서버 전용 관리 키 (절대 클라이언트 노출 금지)
NEXT_PUBLIC_EMAIL_DOMAIN          # 이메일 도메인 (기본값: "scwonderland.com")
```
