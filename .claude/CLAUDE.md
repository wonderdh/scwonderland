# SC Wonderland

원더랜드 영어학원 웹사이트. 학원 소개(공개), 관리자 대시보드, 학생/교사 포털의 3개 섹션으로 구성.

**기술 스택:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Supabase (Auth + PostgreSQL + Storage)

**대상 사용자:** 학부모/일반 방문자(공개 사이트), 관리자(학생·교사·반 관리), 학생(리포트카드·교재 조회), 교사(한국인: 반 관리·공지·교재 / 원어민: 리포트카드·교재, 영어 UI)

## Development Commands

```bash
npm run dev      # 개발 서버 (http://localhost:3000)
npm run build    # 프로덕션 빌드
npm start        # 프로덕션 서버
npm run lint     # ESLint 실행
```

## Key Principles

- 한국어 사용자 대상 (UI 텍스트, 에러 메시지 모두 한국어). 단, 원어민 교사 포털은 영어 UI (`lib/teacher-labels.ts`)
- Server Actions는 `app/(admin)/admin/actions/`에 도메인별 분할, barrel re-export via `actions.ts`
- 모든 Server Action은 `{ error?: string }` 반환
- 공유 타입은 `lib/types/`에 정의 (`"use server"` 파일에서 `export type` 불가)
- Supabase 클라이언트 3종: Browser(`lib/supabase/client.ts`), Server(`server.ts`), Admin(`admin.ts`)
- 교재 삭제는 soft delete, Admin 삭제는 cascade
- `router.refresh()`로 Server Component 데이터 갱신 (mutation 후)
