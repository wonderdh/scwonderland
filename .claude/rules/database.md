# Database & Supabase

## Database Schema

```
Supabase Auth Users
    │
    ├── profiles (id, role: "admin"|"student"|"teacher", first_name, last_name, deleted_at TIMESTAMPTZ)
    │   ├── students (profile_id FK, korean_name, english_name, student_number [auto])
    │   └── teachers (profile_id FK, name, teacher_number [auto], teacher_type: "korean"|"native")
    │
    ├── classes (id, name, group_label: "유치부"|"오후반"|"방과후")
    │   ├── class_teachers (class_id FK, teacher_profile_id FK) [junction, 최대 2명]
    │   ├── class_students (class_id FK, student_profile_id FK) [junction]
    │   └── class_schedules (class_id FK, teacher_profile_id FK, period_id FK,
    │       day, label, textbook_id FK→textbooks ON DELETE SET NULL)
    │
    ├── report_cards (student_profile_id FK, author_id FK, year, month, content, reply)
    │   └── UNIQUE (student_profile_id, year, month)
    │
    ├── textbooks (id, title, series, level, category, total_units, cover_image, is_active)
    │   ├── class_textbooks (class_id FK, textbook_id FK) [junction]
    │   └── student_textbook_progress (student_profile_id FK, textbook_id FK,
    │       source_type, source_class_id, status, completed_units)
    │
    └── notices (id, title, content, excerpt, author_id, is_published, is_pinned, published_at)
        └── notice_attachments (notice_id FK, storage_path, public_url, original_filename,
            mime_type, file_size, file_type: "image"|"attachment", sort_order)
```

- 역할은 `user_metadata.role`에 저장 (생성 시 설정)
- student_number, teacher_number는 DB 함수로 자동 생성
- 프로필·학생·교사 레코드는 Auth 트리거로 자동 생성

## Supabase Clients

| 클라이언트 | 파일 | 용도 |
|-----------|------|------|
| **Browser** | `lib/supabase/client.ts` | Client Components (로그인 등) |
| **Server** | `lib/supabase/server.ts` | Server Components, Server Actions (RLS 적용) |
| **Admin** | `lib/supabase/admin.ts` | 사용자 생성/삭제 등 관리 작업 (RLS 우회, service role key) |

## Supabase Storage

| 버킷 | 공개여부 | 용도 |
|------|---------|------|
| `textbook-covers` | Public | 교재 커버 이미지 (JPG, PNG, WebP / 10MB 이하) |
| `notice-files` | Public | 공지사항 이미지(images/) + 첨부파일(files/) |

- 서버에서 Admin Client(service role)로 업로드/삭제 → RLS 우회
- `next.config.ts`에 Supabase Storage 도메인이 `remotePatterns`에 등록됨 (next/image 최적화)
- 파일명 규칙: `{timestamp}_{random6자}{확장자}` (충돌 방지)
- 교재 생성/수정 시 FormData에 `cover_image` 파일 포함, 삭제 시 Storage 이미지도 함께 삭제

## 환경 변수

```
NEXT_PUBLIC_SUPABASE_URL          # Supabase 프로젝트 URL
NEXT_PUBLIC_SUPABASE_ANON_KEY     # Supabase 공개 키
SUPABASE_SERVICE_ROLE_KEY         # 서버 전용 관리 키 (절대 클라이언트 노출 금지)
NEXT_PUBLIC_EMAIL_DOMAIN          # 이메일 도메인 (기본값: "scwonderland.com")
```
