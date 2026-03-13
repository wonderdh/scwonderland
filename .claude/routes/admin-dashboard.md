# Admin Dashboard

## 라우트 경로
- URL: `/admin`
- 라우트 그룹: `(admin)`

## 핵심 파일
- page.tsx: `app/(admin)/admin/page.tsx`
- layout.tsx: `app/(admin)/admin/layout.tsx`

## 컴포넌트
| 파일 | 역할 |
|------|------|
| `app/(admin)/admin/components/AdminLayoutClient.tsx` | 관리자 레이아웃 클라이언트 래퍼 (사이드바 + 메인 영역) |
| `app/(admin)/admin/components/AdminSidebar.tsx` | 좌측 네비게이션 사이드바 (10개 메뉴, 로그아웃, 사이트 이동 링크) |

## Server Actions
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `getDashboardStats` | (없음) | `profiles`, `classes`, `report_cards`, `notices` |

## 타입
- `DashboardStats` from `lib/types`

## 데이터 흐름
1. `layout.tsx`: `createClient()` → `getUser()` 인증 검증 → `profiles` 테이블에서 role 확인 (admin 아니면 리다이렉트)
2. `layout.tsx` → `AdminLayoutClient` (adminId 전달) → `AdminSidebar` 렌더링
3. `page.tsx`: `getDashboardStats()` 호출 → 5개 통계 카드(학생, 교사, 반, 리포트카드, 공지사항) + 5개 네비게이션 카드 렌더링

## 의존성
- Shared: `AdminLayoutClient`, `AdminSidebar`, `Card`, `Badge` (shadcn/ui)
- Actions: `getDashboardStats` from `actions.ts` barrel export
- Auth: `createClient`, `getUser`, `profiles` 테이블 role 검증

## 주의사항
- layout.tsx에서 admin role 체크 → 전체 `/admin/*` 라우트에 적용
- `AdminSidebar`의 navItems 배열에 10개 메뉴 하드코딩 (대시보드, 학생, 선생, 반, 방과후, 교재, 공지사항, Academy 공지, 시간표, 승하차)
- `getDashboardStats`는 `verifyAdmin()` 사용, 5개 count 쿼리를 `Promise.all`로 병렬 실행
- adminId는 `user.email.split("@")[0]`으로 추출 (이메일 숨김 규칙)
