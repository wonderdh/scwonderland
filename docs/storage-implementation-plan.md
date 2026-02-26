# Supabase Storage 미디어 파일 업로드 구현 계획

## 개요

SC Wonderland 프로젝트에 Supabase Storage 기반 미디어 파일 업로드 기능을 추가한다.

**요구사항:**
- 파일 유형: 이미지, 동영상, PDF 문서, 오디오(숙제용)
- 권한: 학생 = 숙제 음성파일만 / 교사·관리자 = 전체 가능
- 사용처: 숙제 제출, 공개 사이트 콘텐츠, 반별 공지, Academy 공지사항

**제외 항목:** 리포트카드 첨부파일
**제약:** Supabase MCP 쿼리 실행 금지 — SQL은 마이그레이션 파일로만 작성, 추후 적용

---

## Phase 1: Storage 인프라 구축 (Foundation)

모든 후속 기능이 의존하는 핵심 인프라.

### 1-1. Supabase Storage 버킷 설계

3개 버킷 + RLS 정책을 SQL 마이그레이션 파일로 작성:

| 버킷 | 공개여부 | 용도 | 쓰기 권한 |
|------|---------|------|----------|
| `public-content` | Public | 사이트 이미지, 공지 첨부 | admin, teacher |
| `homework` | Private | 학생 숙제 음성파일 | student(본인 폴더만) |
| `attachments` | Private | 반별 공지 첨부, 학습자료 | admin, teacher |

**RLS 정책 요약:**
- `public-content`: 누구나 읽기 / admin, teacher만 쓰기·수정 / admin만 삭제
- `homework`: 학생은 본인 폴더만 읽기·쓰기 / 교사는 담당 반 학생 파일 읽기 / admin 전체 접근
- `attachments`: admin, teacher 읽기·쓰기 / 학생은 본인 관련 파일만 읽기

**생성 파일:** `docs/migrations/storage-buckets.sql`

### 1-2. `file_metadata` 테이블

Storage에 저장된 파일의 메타데이터를 DB로 관리 (엔티티별 조회용):

```sql
CREATE TABLE public.file_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id TEXT NOT NULL,                  -- 'public-content' | 'homework' | 'attachments'
  storage_path TEXT NOT NULL,               -- Storage 내 전체 경로
  original_filename TEXT NOT NULL,          -- 사용자 원본 파일명
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,               -- 바이트 단위
  uploader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT,                         -- 'homework' | 'class_notice' | 'academy_notice' | 'site_content'
  entity_id TEXT,                           -- 연결된 엔티티 ID
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (bucket_id, storage_path)
);

CREATE INDEX idx_file_metadata_entity ON public.file_metadata (entity_type, entity_id);
CREATE INDEX idx_file_metadata_uploader ON public.file_metadata (uploader_id);
```

**RLS 정책:**
- Admin: 전체 접근
- Teacher: 읽기 전체 / 본인 업로드 파일 쓰기
- Student: 본인 업로드 파일 + 관련 엔티티 파일 읽기 / homework 타입만 쓰기

**생성 파일:** `docs/migrations/file-metadata.sql`

### 1-3. Storage 유틸리티 모듈

**생성 파일:** `lib/supabase/storage.ts`

```typescript
// 주요 내용:

export const STORAGE_BUCKETS = {
  PUBLIC_CONTENT: "public-content",
  HOMEWORK: "homework",
  ATTACHMENTS: "attachments",
} as const;

export type FileCategory = "image" | "video" | "document" | "audio";

// 파일 유형별 설정
export const FILE_CATEGORIES: Record<FileCategory, {
  mimeTypes: string[];
  extensions: string[];
  maxSizeMB: number;
  label: string;  // 한국어
}> = {
  image: { mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"], extensions: [".jpg", ".jpeg", ".png", ".webp", ".gif"], maxSizeMB: 10, label: "이미지" },
  video: { mimeTypes: ["video/mp4", "video/webm"], extensions: [".mp4", ".webm"], maxSizeMB: 100, label: "동영상" },
  document: { mimeTypes: ["application/pdf"], extensions: [".pdf"], maxSizeMB: 20, label: "문서" },
  audio: { mimeTypes: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/webm", "audio/mp4"], extensions: [".mp3", ".wav", ".ogg", ".webm", ".m4a"], maxSizeMB: 25, label: "오디오" },
};

// 역할별 허용 파일 유형
export const ROLE_ALLOWED_CATEGORIES: Record<string, FileCategory[]> = {
  admin: ["image", "video", "document", "audio"],
  teacher: ["image", "video", "document", "audio"],
  student: ["audio"],
};

// 함수들:
export function validateFile(file: File, allowedCategories: FileCategory[]): { valid: true } | { valid: false; error: string };
export function generateStoragePath(bucket: BucketId, segments: string[], originalFilename: string): string;
export function getPublicUrl(bucket: BucketId, path: string): string;
export function formatFileSize(bytes: number): string;
```

### 1-4. Storage 타입 정의

**생성 파일:** `lib/types/storage.ts`

```typescript
export type FileMetadata = {
  id: string;
  bucket_id: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  uploader_id: string;
  entity_type: "homework" | "class_notice" | "academy_notice" | "site_content" | null;
  entity_id: string | null;
  created_at: string;
};
```

**수정:** `lib/types/index.ts` — re-export 추가

### 1-5. Storage Server Actions

**생성 파일:** `app/(admin)/admin/actions/storage-actions.ts`

```typescript
"use server";

// uploadFile(formData: FormData) → { error?: string; fileMetadata?: FileMetadata }
//   - 로그인 확인 → 역할 조회 → 파일 검증 → Storage 업로드 → metadata DB 저장
//   - 실패 시 Storage 파일 롤백 (cleanup)
//   - FormData 필드: file, bucket, entity_type, entity_id, path_prefix

// deleteFile(fileMetadataId: string) → { error?: string }
//   - 권한 확인 (admin 전체 / 업로더 본인) → Storage 삭제 → metadata 삭제

// listFilesByEntity(entityType: string, entityId: string) → FileMetadata[]
//   - 엔티티별 파일 목록 조회

// getSignedUrl(fileMetadataId: string, expiresIn?: number) → { error?: string; url?: string }
//   - Private 버킷 파일용 서명 URL 생성 (기본 1시간)
```

**수정:** `app/(admin)/admin/actions.ts` — barrel export 추가

### 1-6. 재사용 UI 컴포넌트

**생성 파일:** `components/FileUpload.tsx`
```
"use client" 컴포넌트
Props:
  - bucket: BucketId
  - entityType: string
  - entityId: string
  - allowedCategories: FileCategory[]
  - maxFiles?: number (기본 1)
  - onUploadComplete: (files: FileMetadata[]) => void
  - onError?: (error: string) => void

기능:
  - <input type="file"> 기반 (모바일 친화적, 드래그앤드롭은 추후)
  - 클라이언트 사전 검증 (validateFile)
  - 업로드 상태: "업로드 중..." 텍스트 + disabled
  - 에러 표시: 빨간 배경 rounded-lg (기존 패턴)
  - 다중 파일 선택 (maxFiles > 1)
```

**생성 파일:** `components/FileList.tsx`
```
"use client" 컴포넌트
Props:
  - files: FileMetadata[]
  - canDelete: boolean
  - onDelete?: (fileId: string) => void
  - isPublicBucket: boolean

기능:
  - 파일별: 아이콘 + 원본 파일명 + 크기 + 날짜
  - Public: 직접 URL 링크 / Private: signed URL (서버 액션 호출)
  - 오디오: 인라인 <audio> 플레이어
  - 이미지: 썸네일 미리보기 (next/image)
  - 삭제 버튼 (canDelete일 때, 확인 후 삭제)
```

### 1-7. next.config.ts 수정

`remotePatterns`에 Supabase Storage 도메인 추가:

```typescript
// 기존 Unsplash에 추가
{
  protocol: "https",
  hostname: "{supabase-project-id}.supabase.co",
  pathname: "/storage/v1/object/public/**",
}
```

---

## Phase 2: 반별 공지 시스템

교사가 담당 반에 공지를 작성하고, 학생이 조회하는 시스템.
작성: 교사 포털 + Admin / 조회: 학생 포털

### 2-1. `class_notices` 테이블

```sql
CREATE TABLE public.class_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id),
  title TEXT NOT NULL,
  content TEXT,
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_class_notices_class ON public.class_notices (class_id, created_at DESC);
```

첨부파일: `file_metadata`로 연결 (`entity_type='class_notice'`, `entity_id=class_notice.id`)

**생성 파일:** `docs/migrations/class-notices.sql`

### 2-2. Server Actions

**생성 파일:** `app/(admin)/admin/actions/class-notice-actions.ts`
- `createClassNotice(formData)` — 공지 생성 (교사: 담당 반만 / admin: 모든 반)
- `updateClassNotice(formData)` — 공지 수정 (작성자 또는 admin)
- `deleteClassNotice(noticeId)` — 공지 삭제 (작성자 또는 admin)
- `listClassNotices(classId)` — 반별 공지 목록
- `getClassNotice(noticeId)` — 공지 상세 + 첨부파일

**수정:** `app/(admin)/admin/actions.ts` — barrel export 추가
**수정:** `app/(academy)/academy/actions.ts` — 학생/교사용 조회 액션 추가
  - `getMyClassNotices()` — 학생: 내 반 공지 / 교사: 담당 반 공지
  - `getClassNoticeDetail(noticeId)` — 공지 상세

### 2-3. 교사 포털 UI

**생성 파일들:**
- `app/(academy)/academy/teacher/notices/page.tsx` — 반별 공지 목록 (반 선택 + 공지 리스트)
- `app/(academy)/academy/teacher/notices/components/ClassNoticeForm.tsx` — 공지 작성/수정 폼 + FileUpload
- `app/(academy)/academy/teacher/notices/components/ClassNoticeList.tsx` — 공지 목록 표시

**수정:** `app/(academy)/academy/teacher/components/TeacherNav.tsx` — 공지 탭 추가

### 2-4. 학생 포털 UI

**생성 파일들:**
- `app/(academy)/academy/student/notices/page.tsx` — 내 반 공지 목록
- `app/(academy)/academy/student/notices/components/NoticeDetail.tsx` — 공지 상세 + FileList(첨부파일)

**수정:** `app/(academy)/academy/student/components/StudentNav.tsx` — 공지 탭 추가

### 2-5. Admin UI

Admin에서 반별 공지를 관리할 수 있는 UI:
- 기존 반 관리 페이지(`/admin/classes`)에 공지 탭 추가, 또는
- 별도 페이지 `/admin/class-notices` 생성

**수정:** AdminSidebar — 필요 시 링크 추가

---

## Phase 3: Academy 포털 공지사항 게시판

로그인한 사용자(학생/교사) 전용 내부 공지게시판. Admin이 작성·관리.

### 3-1. `academy_notices` 테이블

```sql
CREATE TABLE public.academy_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT,
  excerpt TEXT,
  author_id UUID REFERENCES public.profiles(id),
  is_published BOOLEAN DEFAULT true,
  is_pinned BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

첨부파일: `file_metadata`로 연결 (`entity_type='academy_notice'`)

**생성 파일:** `docs/migrations/academy-notices.sql`

### 3-2. Server Actions

**생성 파일:** `app/(admin)/admin/actions/academy-notice-actions.ts`
- `createAcademyNotice(formData)` — 공지 생성 (admin)
- `updateAcademyNotice(formData)` — 공지 수정
- `deleteAcademyNotice(noticeId)` — 공지 삭제
- `listAcademyNotices()` — 공지 목록 (published만)
- `listAllAcademyNotices()` — 전체 목록 (admin용, draft 포함)
- `getAcademyNotice(noticeId)` — 공지 상세

**수정:** `app/(admin)/admin/actions.ts` — barrel export 추가
**수정:** `app/(academy)/academy/actions.ts` — 조회 액션 추가

### 3-3. Academy 포털 공지 페이지

**생성 파일들:**
- `app/(academy)/academy/notices/page.tsx` — 공지 목록 (학생/교사 공통)
- `app/(academy)/academy/notices/[id]/page.tsx` — 공지 상세 + FileList

Academy 레이아웃에서 접근 가능하도록 네비게이션 추가 필요.

### 3-4. Admin 공지 관리

**생성 파일들:**
- `app/(admin)/admin/notices/page.tsx` — Academy 공지 관리 목록
- `app/(admin)/admin/notices/components/NoticeEditor.tsx` — 공지 작성/수정 + FileUpload

**수정:** `app/(admin)/admin/components/AdminSidebar.tsx` — 공지 관리 링크 추가

---

## Phase 4: 숙제 시스템

숙제 출제→음성녹음 제출→리뷰 전체 워크플로우.

### 4-1. DB 테이블

```sql
CREATE TABLE public.homework_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.homework_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.homework_assignments(id) ON DELETE CASCADE,
  student_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'reviewed')),
  submitted_at TIMESTAMPTZ,
  teacher_feedback TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (assignment_id, student_profile_id)
);
```

음성 파일: `file_metadata`로 연결 (`entity_type='homework'`, `entity_id=submission.id`)

**생성 파일:** `docs/migrations/homework.sql`

### 4-2. Server Actions

**생성 파일:** `app/(admin)/admin/actions/homework-actions.ts`
- `createHomeworkAssignment(formData)` — 숙제 출제 (교사/admin)
- `updateHomeworkAssignment(formData)` — 숙제 수정
- `deleteHomeworkAssignment(assignmentId)` — 숙제 삭제
- `listHomeworkAssignments(classId?)` — 숙제 목록
- `getHomeworkSubmissions(assignmentId)` — 제출 현황
- `reviewHomeworkSubmission(submissionId, feedback)` — 교사 피드백

**수정:** `app/(academy)/academy/actions.ts` — 학생/교사용
- `getCurrentStudentHomework()` — 학생 숙제 목록 + 제출 상태
- `getAssignmentDetail(assignmentId)` — 숙제 상세 + 제출 파일
- `submitHomework(assignmentId, formData)` — 숙제 제출 (음성파일 포함)

### 4-3. AudioRecorder 컴포넌트

**생성 파일:** `app/(academy)/academy/student/homework/components/AudioRecorder.tsx`

```
"use client" 컴포넌트
기능:
  - MediaRecorder API 기반 (추가 라이브러리 없음)
  - 녹음 버튼 (마이크 아이콘) → 녹음 중 표시 (빨간 점 애니메이션)
  - 정지 버튼
  - 녹음된 오디오 재생 (<audio> 태그)
  - 다시 녹음 버튼
  - 마이크 권한 요청 처리 + 에러 메시지 (한국어)
  - 출력: File 객체 (webm 포맷) → 부모 컴포넌트로 전달

Props:
  - onRecordingComplete: (file: File) => void
  - maxDurationSeconds?: number (기본 300 = 5분)
```

### 4-4. 학생 숙제 페이지

**수정:** `app/(academy)/academy/student/homework/page.tsx` — placeholder 교체

**생성 파일들:**
- `app/(academy)/academy/student/homework/components/HomeworkList.tsx` — 숙제 목록 (제출 상태 표시)
- `app/(academy)/academy/student/homework/components/HomeworkDetail.tsx` — 숙제 상세 + AudioRecorder + FileUpload로 제출

### 4-5. 교사 숙제 관리

**생성 파일들:**
- `app/(academy)/academy/teacher/homework/page.tsx` — 반별 숙제 목록
- `app/(academy)/academy/teacher/homework/components/AssignmentForm.tsx` — 숙제 출제 폼
- `app/(academy)/academy/teacher/homework/components/SubmissionReview.tsx` — 제출물 확인 + 오디오 재생 + 피드백

**수정:** `app/(academy)/academy/teacher/components/TeacherNav.tsx` — 숙제 탭 추가

### 4-6. Admin 숙제 개요

**생성 파일:** `app/(admin)/admin/homework/page.tsx` — 전체 숙제 현황
**수정:** `app/(admin)/admin/components/AdminSidebar.tsx` — 숙제 링크 추가

---

## 참고: `/notice/news` 페이지

현재 FAKE_NEWS로 하드코딩된 이벤트/행사 페이지는 **그대로 유지**한다. DB 전환은 별도 작업으로 진행.

---

## 검증 방법

### Phase 1 완료 후:
1. SQL 마이그레이션 파일 작성 완료 확인
2. `lib/supabase/storage.ts` 유틸리티 함수 확인
3. FileUpload/FileList 컴포넌트 렌더링 확인
4. `npm run build` 통과

### Phase 2 완료 후:
1. 교사 포털: 반별 공지 작성 UI + 첨부파일 업로드 UI
2. 학생 포털: 반별 공지 목록/상세 UI + 첨부파일 표시
3. Admin: 반별 공지 관리 UI

### Phase 3 완료 후:
1. Academy 포털: 공지사항 목록/상세 UI
2. Admin: 공지 생성/수정/삭제 + 첨부파일 관리 UI

### Phase 4 완료 후:
1. 교사 → 숙제 출제 UI
2. 학생 → AudioRecorder + 제출 UI
3. 교사 → 제출물 확인 + 오디오 재생 + 피드백 UI
4. `npm run build` 전체 통과

---

## 핵심 파일 참조

| 역할 | 파일 |
|------|------|
| Admin 클라이언트 패턴 | `lib/supabase/admin.ts` |
| Server Action 패턴 | `app/(admin)/admin/actions/textbook-actions.ts` |
| 타입 정의 패턴 | `lib/types/database.ts` |
| Barrel export | `app/(admin)/admin/actions.ts` |
| 이미지 설정 | `next.config.ts` |
| 타입 barrel | `lib/types/index.ts` |
| 교사 Nav | `app/(academy)/academy/teacher/components/TeacherNav.tsx` |
| 학생 Nav | `app/(academy)/academy/student/components/StudentNav.tsx` |
| Admin Sidebar | `app/(admin)/admin/components/AdminSidebar.tsx` |
