# Admin Academy Notices (학원 내부 공지 관리)

## 라우트 경로
- URL: `/admin/academy-notices`
- 라우트 그룹: `(admin)`

## 핵심 파일
- page.tsx: `src/app/(admin)/admin/academy-notices/page.tsx`

## 컴포넌트
| 파일 | 역할 |
|------|------|
| `academy-notices/components/AcademyNoticesManager.tsx` | 학원 내부 공지 CRUD 관리 클라이언트 |

## Server Actions

### academy-notice-actions.ts
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `listAcademyNotices` | includeUnpublished: boolean | `academy_notices`, `academy_notice_attachments` |
| `getAcademyNoticeWithAttachments` | noticeId | `academy_notices`, `academy_notice_attachments` |
| `createAcademyNotice` | FormData(title, content, excerpt, is_published, is_pinned, images[], attachments[]) | `academy_notices`, `academy_notice_attachments`, Storage: `academy-notices` |
| `updateAcademyNotice` | FormData(id, title, content, excerpt, is_published, is_pinned, new_images[], new_attachments[], remove_attachment_ids) | `academy_notices`, `academy_notice_attachments`, Storage: `academy-notices` |
| `deleteAcademyNotice` | noticeId | `academy_notices`, `academy_notice_attachments`, Storage: `academy-notices` |

## 타입
- `AcademyNotice` from `src/lib/types`
- `AcademyNoticeAttachment` from `src/lib/types`

## 데이터 흐름
1. `page.tsx`: 동기 렌더링 (Server Component이지만 데이터 로딩은 클라이언트에서 수행)
2. `AcademyNoticesManager`가 자체적으로 데이터 로드

## 의존성
- Actions: from `academy-notice-actions.ts`
- Storage: `academy-notices` 버킷 (STORAGE_BUCKETS 상수 사용)
- 유틸: `src/lib/supabase/storage.ts`의 `validateFile`, `generateStoragePath`, `extractStoragePath`

## 주의사항
- 학원 내부 공지: 교사/학생 포털 (`/academy`)에서만 보이는 공지 (공개 사이트와 분리)
- `notices` 테이블과 별도의 `academy_notices` / `academy_notice_attachments` 테이블 사용
- Storage 헬퍼가 `src/lib/supabase/storage.ts`의 공유 유틸 사용 (notice-actions.ts와 다른 패턴)
- 구조는 공개 공지와 동일 (title, content, excerpt, is_published, is_pinned, 이미지/첨부파일)
- page.tsx에서 서버 데이터 프리로딩 없이 클라이언트 컴포넌트에 위임
