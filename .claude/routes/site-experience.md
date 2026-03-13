# Experience (/experience/*)

## 라우트 경로
- URL: `/experience/special-day`, `/experience/e-school`, `/experience/library`, `/experience/links`
- 라우트 그룹: `(site)`
- 메뉴 ID: `contact`

## 핵심 파일
- `app/(site)/experience/layout.tsx` — CategoryPageWrapper + CategoryLayout(menuId="contact") 래핑

## 컴포넌트

| 파일 | 역할 |
|------|------|
| `app/(site)/experience/special-day/page.tsx` | Special Day 페이지. `PageContent` 래퍼 사용, 콘텐츠 미완성 (플레이스홀더) |
| `app/(site)/experience/e-school/page.tsx` | Wonderland E-School 페이지. `PageContent` 래퍼 사용, 콘텐츠 미완성 (플레이스홀더) |
| `app/(site)/experience/library/page.tsx` | Library 페이지. `PageContent` 래퍼 사용, 콘텐츠 미완성 (플레이스홀더) |
| `app/(site)/experience/links/page.tsx` | Links 페이지. 외부 링크 카드 모음 (Children's Music, Miss Jolie Music, Creativity, Circle Time, CMS Kids) |

## Server Actions
- 없음

## 데이터 흐름
1. `layout.tsx` -> `CategoryPageWrapper` -> `CategoryLayout(menuId="contact")`
2. SubNav에 Special Day, Wonderland E-School, Library, Links 탭 표시
3. 각 page.tsx가 `PageContent`로 래핑된 플레이스홀더 콘텐츠 렌더링

## 의존성
- `PageContent` — 모든 하위 페이지에서 사용

## 주의사항
- 3개 하위 페이지(special-day, e-school, library) 콘텐츠 미완성 상태 (플레이스홀더 텍스트만 존재)
- Links 페이지는 완성 상태 (외부 링크 카드 5개)
- 각 페이지별 Metadata 설정 완료
