# Community (/community/*)

## 라우트 경로
- URL: `/community/parent-consultation`, `/community/franchise-inquiry`, `/community/campus`
- 라우트 그룹: `(site)`
- 메뉴 ID: `gallery`

## 핵심 파일
- `app/(site)/community/layout.tsx` — CategoryPageWrapper + CategoryLayout(menuId="gallery") 래핑

## 컴포넌트

| 파일 | 역할 |
|------|------|
| `app/(site)/community/parent-consultation/page.tsx` | 학부모상담 페이지. `PageContent` 래퍼 사용, 콘텐츠 미완성 (플레이스홀더) |
| `app/(site)/community/franchise-inquiry/page.tsx` | 가맹문의 페이지. `PageContent` 래퍼 사용, 콘텐츠 미완성 (플레이스홀더) |
| `app/(site)/community/campus/page.tsx` | 캠퍼스 페이지. `PageContent` 래퍼 사용, 콘텐츠 미완성 (플레이스홀더) |

## Server Actions
- 없음

## 데이터 흐름
1. `layout.tsx` -> `CategoryPageWrapper` -> `CategoryLayout(menuId="gallery")`
2. SubNav에 학부모상담, 가맹문의, 캠퍼스 탭 표시
3. 각 page.tsx가 `PageContent`로 래핑된 플레이스홀더 콘텐츠 렌더링

## 의존성
- `PageContent` — 모든 하위 페이지에서 사용

## 주의사항
- 3개 하위 페이지 모두 콘텐츠 미완성 상태 (플레이스홀더 텍스트만 존재)
- 홈페이지 Hero 섹션의 "상담 신청하기" 버튼이 `/community/parent-consultation`으로 연결
- 각 페이지별 Metadata 설정 완료
