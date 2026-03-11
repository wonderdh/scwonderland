---
paths:
  - "lib/types/**/*"
  - "lib/supabase/**/*"
  - "app/(admin)/admin/actions/**/*"
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
    ├── academy_periods (name, start_time, end_time, group_label, has_pickup, has_dropoff, is_active)
    │
    ├── report_cards (student_profile_id FK, author_id FK, year, month, content, reply)
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
    ├── attendance (student_profile_id, class_id, date, status, note)
    │
    ├── bus_numbers (label, is_active)
    ├── student_bus_defaults (student_profile_id, day, direction, period_id, bus_number_id)
    └── bus_change_requests (student_profile_id, date, direction, change_type, status)
```

- 역할은 `user_metadata.role`에 저장 (생성 시 설정)
- student_number, teacher_number는 DB 함수로 자동 생성
- 프로필·학생·교사 레코드는 Auth 트리거로 자동 생성
- `class_schedules` CHECK 제약: `class_id IS NOT NULL XOR student_profile_id IS NOT NULL` — 반/개인 시간표 분리
- `teacher_type`은 TEXT → ENUM 마이그레이션 완료

## Supabase Clients

| 클라이언트 | 파일 | 용도 |
|-----------|------|------|
| **Browser** | `lib/supabase/client.ts` | Client Components (로그인 등) |
| **Server** | `lib/supabase/server.ts` | Server Components, Server Actions (RLS 적용, 인증 검증용) |
| **Admin** | `lib/supabase/admin.ts` | 사용자 생성/삭제 등 관리 작업 (RLS 우회, service role key) |

**인증 검증 패턴:** Server Action에서 `createClient()` → `getUser()` → 인증 확인 후 `createAdminClient()` 사용

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
- Storage 헬퍼: `lib/supabase/storage.ts` (STORAGE_BUCKETS, generateStoragePath, extractStoragePath, validateFile)

## 환경 변수

```
NEXT_PUBLIC_SUPABASE_URL          # Supabase 프로젝트 URL
NEXT_PUBLIC_SUPABASE_ANON_KEY     # Supabase 공개 키
SUPABASE_SERVICE_ROLE_KEY         # 서버 전용 관리 키 (절대 클라이언트 노출 금지)
NEXT_PUBLIC_EMAIL_DOMAIN          # 이메일 도메인 (기본값: "scwonderland.com")
```
