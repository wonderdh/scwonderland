# Notice (/notice/*)

## 라우트 경로
- URL: `/notice/news`, `/notice/news/[id]`
- 라우트 그룹: `(site)`
- 메뉴 ID: `features`

## 핵심 파일
- `app/(site)/notice/layout.tsx` — CategoryPageWrapper + CategoryLayout(menuId="features") 래핑
- `app/(site)/notice/news/page.tsx` — 공지사항 목록 (Server Component)
- `app/(site)/notice/news/[id]/page.tsx` — 공지사항 상세 (Server Component, 동적 라우트)

## 컴포넌트

| 파일 | 역할 |
|------|------|
| `app/(site)/notice/news/page.tsx` | 공지사항 목록. `listNotices(false)` 호출하여 게시된 공지만 표시. 고정 공지 배지, 이미지/첨부파일 개수 표시 |
| `app/(site)/notice/news/[id]/page.tsx` | 공지사항 상세. `getNoticeWithAttachments(id)` 호출. 이미지 갤러리 + 내용(whitespace-pre-wrap) + 첨부파일 다운로드 링크 + 목록 돌아가기. 비게시 공지 접근 시 `notFound()` |

## Server Actions
- `listNotices(includeUnpublished: boolean)` — `notice-actions.ts`, 테이블: `notices`, `notice_attachments`
- `getNoticeWithAttachments(noticeId: string)` — `notice-actions.ts`, 테이블: `notices`, `notice_attachments`

## 데이터 흐름
1. 목록 페이지: `listNotices(false)` -> 게시된 공지만 조회 (is_published=true), 고정순+날짜순 정렬
2. 상세 페이지: `getNoticeWithAttachments(id)` -> 공지 + 이미지/첨부파일 분리 조회
3. 비게시 공지 접근 시 404 처리 (`notFound()`)
4. `generateMetadata`로 동적 메타데이터 생성

## 의존성
- `app/(admin)/admin/actions/notice-actions.ts` — 공지사항 조회 액션 (공개 사이트에서 admin 액션 직접 import)
- `PageContent` — 목록/상세 공통 래퍼

## 주의사항
- 공개 사이트에서 admin 액션(`notice-actions.ts`)을 직접 import하여 사용
- `listNotices`와 `getNoticeWithAttachments`는 `verifyAuthenticated()` 검증 (로그인 필요할 수 있음)
- 상세 페이지에서 첨부파일 크기를 MB 단위로 표시
- 이미지는 `<img>` 태그 직접 사용 (public URL)
