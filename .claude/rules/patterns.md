# Important Patterns

## Routing (lib/menu-routes.ts)

모든 (site) 라우트 매핑이 중앙 관리됨:

```typescript
getMenuItemHref("about", "인사말")    // → "/about-wonderland/greeting"
getDefaultMenuItemHref("programs")    // → "/program/map"
getCategoryItemLabels("about")        // → ["인사말", "회사연혁", ...]
getMenuIdFromPathname("/program/map") // → "programs"
```

**새 페이지 추가 시:** 폴더 생성 → `itemSlugs` 업데이트 → 카테고리 layout 확인

## Email Normalization (lib/auth-utils.ts)

`@`가 없으면 자동으로 `@{NEXT_PUBLIC_EMAIL_DOMAIN}` 추가:
```typescript
normalizeEmail("student123")      // → "student123@scwonderland.com"
normalizeEmail("user@gmail.com")  // → "user@gmail.com"
```
`lib/auth-utils.ts`에 중앙화됨. `getAuthErrorMessage()`도 동일 파일에 위치.

## Authentication Flow

```
1. 로그인: LoginForm → supabase.auth.signInWithPassword()
2. 세션 유지: middleware.ts → 모든 요청에서 supabase.auth.getUser()로 세션 갱신
3. Admin 보호: admin/layout.tsx → 인증 확인 + profiles.role === "admin" 확인
4. Academy 보호: student/layout.tsx → 인증 확인 + profiles.role === "student" 확인
5. Dashboard 라우팅: 역할에 따라 자동 리다이렉트
```

## Form Handling Patterns

1. **useActionState (React 19)** — AddStudentForm, AddTeacherForm: `<form action={formAction}>`
2. **클라이언트 수정 폼** — UserRow: editing 토글 → FormData 수동 생성 → Server Action 호출
3. **모달 폼** — ClassesManager: useState + 직접 Server Action 호출 → onSuccess 콜백

## Server Action Return Convention

모든 Server Action은 `{ error?: string }` 또는 `{ error?: string; id?: string }` 반환.

## Type Import Convention

`"use server"` 파일에서는 `export type`이 불가능 (런타임에 제거됨). 공유 타입은 `lib/types/`에 정의하고, 컴포넌트에서 직접 `import type { ... } from "@/lib/types"` 사용.

## Notes

- 한국어 사용자 대상 (UI 텍스트, 에러 메시지 모두 한국어)
- 외부 이미지: Unsplash + Supabase Storage 허용 (`next.config.ts` remotePatterns)
- SideBar 외부 링크: Firebase 리포트카드, 레벨테스트, YouTube, Facebook
- Admin 삭제 시 cascade (DB 제약조건으로 관련 데이터 자동 삭제)
- 리포트카드: 원어민(native) 교사가 content 작성 → 학생이 reply 작성 (본인만)
- 교사 유형: `korean`(한국인) / `native`(원어민), teachers.teacher_type으로 구분
- 반당 담당 교사 최대 2명 (class_teachers 중간 테이블), 생성/수정 시 체크박스로 선택
- `router.refresh()`로 Server Component 데이터 갱신 (mutation 후)
- 교재 삭제는 soft delete (`is_active = false`) — 진도 데이터 보존, Storage 커버 이미지는 삭제
- 교재 반 배정 시 해당 반 학생들에게 자동으로 `student_textbook_progress` 생성
- 공지사항 삭제는 hard delete (진도 데이터 없음) — Storage 파일 먼저 삭제 → DB CASCADE 삭제
- 공지사항 이미지는 원본 크기로 표시 (`max-w-full`, 컨테이너보다 클 때만 축소)

## Planned Features (docs/storage-implementation-plan.md)

- **Phase 2:** 반별 공지 (교사+Admin 작성 → 학생 조회, 첨부파일/이미지)
- **Phase 3:** Academy 포털 공지사항 게시판 (Admin 관리, 내부 공지)
- **Phase 4:** 숙제 시스템 (AudioRecorder, 음성파일 제출, 교사 리뷰)
