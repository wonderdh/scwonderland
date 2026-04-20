# Admin Notices (공개 공지사항 관리)

## 라우트 경로
- URL: `/admin/notices`
- 라우트 그룹: `(admin)`

## 핵심 파일
- page.tsx: `src/app/(admin)/admin/notices/page.tsx`

## 컴포넌트
| 파일 | 역할 |
|------|------|
| `notices/components/NoticesManager.tsx` | 공지사항 CRUD 관리 클라이언트 (목록, 생성, 수정, 삭제, 이미지/파일 첨부) |

## Server Actions

### notice-actions.ts
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `listNotices` | includeUnpublished: boolean | `notices`, `notice_attachments` |
| `getNoticeWithAttachments` | noticeId | `notices`, `notice_attachments` |
| `createNotice` | FormData(title, content, excerpt, is_published, is_pinned, images[], attachments[]) | `notices`, `notice_attachments`, Storage: `notice-files` |
| `updateNotice` | FormData(id, title, content, excerpt, is_published, is_pinned, new_images[], new_attachments[], remove_attachment_ids) | `notices`, `notice_attachments`, Storage: `notice-files` |
| `deleteNotice` | noticeId | `notices`, `notice_attachments` (CASCADE), Storage: `notice-files` |

## 타입
- `Notice` from `src/lib/types`
- `NoticeAttachment` from `src/lib/types`

## 데이터 흐름
1. `page.tsx`: `listNotices(true)` → 미게시 포함 전체 공지 목록 로드
2. 목록에 `image_count`, `attachment_count` 포함
3. `NoticesManager`에서 CRUD + 파일 업로드/삭제 처리

## 의존성
- Actions: `listNotices` from `notice-actions.ts` (직접 import)
- Storage: `notice-files` 버킷 (`images/`, `files/` 폴더)

## 주의사항
- 공개 공지사항: 사이트 `/notices`에서 학부모/일반 방문자가 볼 수 있는 공지
- 이미지: JPG/PNG/WebP, 최대 10MB
- 첨부파일: PDF/ZIP/DOCX/XLSX, 최대 20MB
- `is_published`: 게시 여부, `is_pinned`: 상단 고정
- 파일 업로드 실패 시 롤백 로직 포함 (이미 업로드된 파일 삭제)
- `remove_attachment_ids`: JSON.parse로 파싱 (try-catch 적용)
- 공지 삭제 시 Storage 파일도 함께 삭제
- 공지 삭제는 하드 삭제 (CASCADE로 notice_attachments도 삭제)
