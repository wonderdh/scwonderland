# SC Wonderland 코드 리뷰 통합 백로그 (2026-04-22)

## 개요

gstack 4개 진단 스킬(`/health`, `/retro`, `/cso` daily, `/qa-only` read-only) 결과 통합.

**이미 패치 완료 (이 리뷰 세션 중):**
- ✅ **C1** `class-notice-actions.ts` — `createClassNotice` / `updateClassNotice` / `deleteClassNotice` 에 `verifyTeacherOrAdmin()` + 교사는 본인 글만 ownership 체크 추가
- ✅ **C2** `homework-actions.ts#getSubmissionFiles` — 본인/담당 교사/admin 아니면 빈 배열 반환 (IDOR 차단)
- ✅ **C3** `homework-actions.ts#reviewSubmission` — `verifyTeacherOrAdmin()` + reviewerId 검증
- ✅ **H1** `bus-actions.ts#submitBusChangeRequest` — `studentProfileId === auth.userId` 강제

## 점수 요약

| 스킬 | 결과 |
|---|---|
| /health | 5.7/10 (Type 10·Lint 2·Dead 2·Build 10·Tests skip) |
| /retro | 3개월 201 commits. Bus 도메인 churn 1위 · re-work 1위. |
| /cso daily | C3 H3 M3 L2 (C 3건은 이 세션에서 해결, H1 해결) |
| /qa-only | 37개 라우트 · console error 0 · medium 3 · low 2 |

---

## Critical (즉시) — 없음

세션 중 4건 모두 패치됨 ✅

---

## High (이번 주)

### H-01. [cso H2] cancelBusChangeRequest ownership 누락
**File:** `src/app/(admin)/admin/actions/bus-actions.ts:1642`
**내용:** 학생이 `(requestId, studentProfileId)` 조합만 맞추면 다른 학생 요청 취소 가능
**Fix:** H1과 동일 패턴 — `if (studentProfileId !== auth.userId && !isAdminOrTeacher) return error`
**예상 공수:** 15분

### H-02. [cso H3] xlsx 패키지 CVE 2건 (fix unavailable)
**File:** `package.json`
**내용:** GHSA-4r6h-8v6p-xvw6 (prototype pollution) + GHSA-5pgg-2g8v-p4x9 (ReDoS). 관리자 전용 주간문장 bulk import에서 untrusted .xlsx 파싱.
**Fix 옵션:**
- (a) CDN 패치 버전 설치: `npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`
- (b) 이미 의존성에 있는 `exceljs` 로 weekly-sentence import 마이그레이션 후 xlsx 제거
**예상 공수:** (a) 10분 / (b) 1시간

---

## Medium (이번 달)

### M-01. [cso M1] Next.js 16.1.6 → 16.2.4 업그레이드 (Server Action CSRF bypass 패치)
**File:** `package.json`
**내용:** 6개 CVE 중 GHSA-mq59-m269-xvcx 가 서버 액션 CSRF 체크 우회. 이 앱은 100% Server Actions라 직접 해당.
**Fix:** `npm i next@latest` (non-breaking). 현재 `/health` 에서 hook 에러가 React 19/Next 16 관련이니 업그레이드 후 다시 lint 권장.
**예상 공수:** 20분 + 리그레션 확인

### M-02. [cso M2] translate.ts 에서 학생명·리포트 콘텐츠 PII 로깅
**File:** `src/lib/server/translate.ts:45-49, 89-92`
**내용:** `console.log` 직접 사용 + 학생 한글/영문명 + 리포트 80자 프리뷰를 Vercel 로그에 기록. CLAUDE.md 규칙 "PII 로깅 금지" 위반.
**Fix:** `logger.info(tag, "translated", { targetLang, len })` 형태로 교체. 필요시 `DEEPL_DEBUG` env flag로 gate.
**예상 공수:** 15분

### M-03. [cso M3] RLS defense-in-depth 전략 수립
**File:** 22개 action 파일 전체
**내용:** 모든 mutating action이 `createAdminClient()` 로 RLS 우회 → `verify*` 헬퍼 누락 시 backstop 0. C1/C3 발생 이유.
**Fix 방향:**
- (a) **Grep 기반 pre-commit 훅:** `"use server"` 파일이 `createAdminClient` import 하면 `verify` 헬퍼도 반드시 import. 5줄짜리 husky 훅으로 해결.
- (b) `withAuth(verifier, handler)` 래퍼 도입으로 구조적 강제
- (c) 개인 read 경로 일부는 `createClient()` + RLS로 전환 (본인 출결/리포트 등)
**예상 공수:** (a) 30분 / (b) 반나절 / (c) 스프린트

### M-04. [qa Q-M1] 비 admin 사용자가 /admin 방문 시 mixed state
**File:** `src/app/(admin)/admin/layout.tsx`
**내용:** teacher/student 가 `/admin` 접근 → `/academy/login?error=admin_only` 로 redirect. 세션은 유지되지만 헤더는 인증 상태, 본문은 로그인 폼 → 혼란.
**Fix:** role 체크 분기에서 비 admin은 본인 대시보드(`/academy/teacher` or `/academy/student`)로 redirect + 토스트.
**예상 공수:** 30분

### M-05. [qa Q-M2] /admin/textbooks 커버 이미지 LCP + aspect ratio
**File:** `src/app/(admin)/admin/textbooks/` 컴포넌트
**내용:** 첫 카드 커버가 LCP 대상인데 `loading="eager"` 없음. 한 쪽 치수만 조정되어 비율 경고.
**Fix:** 첫 카드에 `priority`, CSS에 `style={{ width: "auto" }}`.
**예상 공수:** 15분

### M-06. [qa Q-M3] 학생 대시보드 "월 출석률 33%" 계산 검증
**File:** `src/app/(academy)/academy/student/page.tsx` 또는 `attendance-actions.ts#getAttendanceStats`
**내용:** "출석 0 · 지각 0 · 결석 2"에서 33%는 직관과 불일치. 공식이 맞아도 UX로 전달 안 됨.
**Fix:** 공식 확인 → 툴팁/분모 표시 또는 "N/M (%)" 포맷.
**예상 공수:** 30분

### M-07. [health] 39개 React 19 hook 에러
**File:** 클라이언트 컴포넌트 전반 (`academy/components/PortalNav.tsx:28` 등, `lib/hooks/use-bus-realtime.ts:18`)
**내용:** `react-hooks/set-state-in-effect` 30건 + `react-hooks/refs` 9건. Next.js 16/React 19 업그레이드 aftershock — 기계적 수정.
**Fix:** 대부분 useEffect 내 set-state를 이벤트 핸들러/useMemo/useCallback으로 이동. 파일별 30분씩.
**예상 공수:** 반나절 (M-01 업그레이드 후 작업)

### M-08. [health] 16개 미사용 파일 (knip)
**내용:** `TeacherAttendanceClient.tsx`, `TeacherBusClient.tsx`, `BusAssignmentManager.tsx`, `BusManagePanel.tsx`, `BusMonitoringDashboard.tsx`, shadcn `avatar/popover/tooltip`, `components/navigation/QueryTabNav.tsx` 등.
**주의:** `QueryTabNav.tsx` 는 `CLAUDE.md` 에 공유 컴포넌트로 명시되어 있음 — knip false positive일 가능성 → grep 확인 후 실제 미사용만 삭제.
**Fix:** grep으로 사용처 확인 → 실제 dead code 삭제 → CLAUDE.md 갱신.
**예상 공수:** 1시간

### M-09. [retro] Bus 도메인 리팩토링
**내용:** `bus-actions.ts` (40+ 함수 · churn 41회 · fix 6회) + `BusMonitorClient.tsx` (25회) + 기타 bus 파일들이 churn TOP 10에 4개 · re-work TOP 8에 7개. 설계 약점 신호.
**Fix 방향:**
- Server Actions → 도메인별 파일 분할 (admin ops / staff ops / student ops / realtime / assignments)
- 회귀 테스트 추가 (최소 스모크)
- 타입 정리 (database.ts 33회 수정은 타입 분리 기회)
**예상 공수:** 2~3일. 큰 리팩토링이라 별도 플랜으로.

---

## Low (언젠가)

### L-01. [qa Q-L1] 로고 이미지 aspect ratio 경고 (전역)
**File:** (site) Navigation 컴포넌트 1곳
**Fix:** `style={{ width: "auto" }}` 또는 `height: "auto"` 추가.
**예상 공수:** 5분

### L-02. [qa Q-L2] `<html data-scroll-behavior="smooth">` 추가
**File:** `src/app/layout.tsx`
**Fix:** Next.js 16 권장대로 attribute 추가.
**예상 공수:** 2분

### L-03. [cso L2] Transitive CVE 9건 housekeeping
**Fix:** `npm audit fix` (직접 영향 없음, 라이브러리 정리 목적)
**예상 공수:** 5분 + 테스트

### L-04. [health] 10개 `next/no-img-element` 에러
**내용:** `<img>` 대신 `<Image>` 사용 권장.
**Fix:** 파일별 교체.
**예상 공수:** 30분

### L-05. [cso pre-commit] gitleaks 훅 추가
**내용:** 현재 .env 히스토리 clean. 앞으로 계속 clean 유지 목적.
**Fix:** husky + `gitleaks protect --staged`.
**예상 공수:** 30분

### L-06. [retro] 커밋 메시지 prefix 표준화
**내용:** 38% 히스토리에 conventional prefix 없음 (초기 throwaway 라벨). 3/16 이후 좋아짐 — 이대로 유지만 해도 됨.

### L-07. 테스트 러너 도입
**내용:** 현재 테스트 없음. 최소 스모크 스위트라도 있으면 리팩토링 · 업그레이드 · CRUD QA 안전망.
**Fix:** Vitest + Playwright 조합이 이 스택에 자연스러움. 우선순위 낮지만 M-09 bus 리팩토링 전에는 깔아두는 게 좋음.
**예상 공수:** 반나절 초기 세팅

---

## Quick Wins (각 1시간 이하)

아래만 해치워도 리뷰 임팩트의 70% 해결:

| 순서 | 항목 | 공수 |
|---|---|---|
| 1 | **L-02** `data-scroll-behavior="smooth"` | 2분 |
| 2 | **L-01** 로고 aspect ratio | 5분 |
| 3 | **L-03** `npm audit fix` | 5분 |
| 4 | **M-01** Next.js 16.2.4 업그레이드 | 20분 (+ 리그레션) |
| 5 | **H-01** cancelBusChangeRequest 보안 | 15분 |
| 6 | **H-02a** xlsx CDN 패치 | 10분 |
| 7 | **M-02** translate.ts PII 로깅 제거 | 15분 |
| 8 | **M-05** textbooks 이미지 성능 | 15분 |

**합계 ≈ 1.5시간** 으로 High 전부 + Low 3건 + Medium 2건 정리.

---

## 별도 라운드 필요

- **CRUD mutation QA** — 프로덕션 DB 쓸 수 없어서 이번 QA에서 스킵. 2번째 무료 Supabase 프로젝트 세팅해서 추후 진행.
- **M-09 Bus 도메인 리팩토링** — 2~3일짜리 플랜. `/plan-eng-review` 로 설계 검토 권장.
- **포괄 보안 감사** — `/cso --comprehensive` 월간. 현재는 daily(8/10 신뢰도) 결과.

---

## 문서 동기화 체크

리팩토링/삭제 작업 시 CLAUDE.md의 `.claude/rules/` · `routes/` 업데이트 필요. 특히:
- M-08 dead file 삭제 시 `rules/components.md` 갱신
- M-09 bus 분할 시 `rules/server-actions.md` 재작성
- H-01 패치는 이번 세션에서 이미 코드만 수정 — server-actions.md의 보안 가이드에 패턴 추가 권장
