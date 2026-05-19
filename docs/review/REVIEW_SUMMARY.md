# SC Wonderland 프로젝트 전체 리뷰 — 종합본

> 리뷰 일자: 2026-05-19
> 리뷰 범위: 전체 코드베이스 (348 파일 / 4 도메인 영역 병렬 분석)
> 모드: 읽기 전용. 코드/마이그레이션/스키마 수정 없음.

## 파트별 상세 문서

| 영역 | 파일 | 분량 |
|---|---|---|
| DB / 스키마 / RLS / 마이그레이션 | [REVIEW_DB.md](REVIEW_DB.md) | 40 KB |
| UI / UX / 디자인 시스템 / 접근성 | [REVIEW_UI.md](REVIEW_UI.md) | 36 KB |
| 아키텍처 / 라우트 / 서버 액션 / Next.js 16 활용 | [REVIEW_ARCHITECTURE.md](REVIEW_ARCHITECTURE.md) | 39 KB |
| 재사용성 / 단순화 / dead code | [REVIEW_REUSABILITY.md](REVIEW_REUSABILITY.md) | 30 KB |

---

## 1. 한 줄 평가

> **"의도 있는 단순함"이 잘 작동하는 학원 SaaS — 보안 RLS · 인증 boundary · 폴더 컨벤션이 일관적이지만, 테스트 부재 + `ActionResult<T>` 정체 + 디자인 토큰 분열 + 보안 정책 5건 (CRITICAL 1 · HIGH 4) 이 발목.**

- 종합 점수: **B+ (80/100)**
  - 아키텍처/일관성: A−
  - DB 모델링: B+ (homework 리네임 누적 흔적 -)
  - 보안 (앱 레벨): A− / 보안 (DB RLS): B− (특정 정책에 누수)
  - UI/UX 일관성: B
  - 재사용성 / 단순성: B− (boilerplate 누적)
  - 테스트 / QA: F (테스트 0건)

---

## 2. 4개 영역 핵심 발견 매트릭스

### 2.1 DB (스키마 · RLS · 마이그레이션)

| 영역 | 상태 |
|---|---|
| FK 컨벤션 (학생→students, 교사→teachers, actor→profiles) | ✅ 준수, 최근 lunch 시리즈는 처음부터 옳음 |
| 표준 4-policy RLS quartet | ✅ 일관 |
| `private.get_my_role()` + `(select …)` 래핑 — Postgres 16/17 RLS 캐시 최적화 | ✅ 모범 |
| Security definer trigger 위임 계약 코멘트 | ✅ 모범 |
| **CRITICAL · `bus_change_requests_update` 가 학생 본인이 status='approved' 셀프 승인 가능** | ❌ 즉시 |
| **HIGH · `attendance`/`bus_*`/`report_cards`/`notices` 등에 `GRANT ALL TO anon`** | ❌ 즉시 |
| **HIGH · `class_students_select` 등 `USING(true)` — 학생끼리 다른 반 명부 노출** | ❌ 즉시 |
| **HIGH · `student_bus_defaults` PK vs UNIQUE 모순 — pickup+dropoff 동시 등록 불가** | ❌ 즉시 |
| **HIGH · `notice-files` / `class-notices` / `academy-notices` / `homework-submissions` 스토리지 RLS 부재** | ❌ 즉시 확인 |
| Homework 도메인 1개월 12 마이그레이션 (rename×2, drop cascade×5, truncate×2) | ⚠️ 진화 흔적 |
| `class_homework_books.textbook_id` 컬럼명/테이블명 불일치 | ⚠️ 백로그 |
| 요일 인덱싱 (0..6 vs 1..5) 혼재 | ⚠️ 백로그 |
| `series.total_units=0` 일 때 progress silent skip — UI 빈 그리드 | ⚠️ 1주 |

### 2.2 UI / UX (디자인 시스템 · 접근성)

| 영역 | 상태 |
|---|---|
| oklch 기반 CSS 변수 + Geist 폰트 + a11y 인프라 (`focus-visible`, `role="status"`, `prefers-reduced-motion`) | ✅ 모범 |
| 모바일 관리자 `/m/*` 경로 분리 + 44px 터치 타겟 | ✅ 좋음 |
| Realtime 기반 버스 모니터 | ✅ 좋음 |
| **컬러 시스템 분열** — `--brand-orange(#ff7700)` vs `orange-500(#f97316)` vs sidebar `orange-50/700` 병존 | ❌ 즉시 |
| **Admin Sidebar active 스타일 오류** — `bg-orange-50` (밝은) 위에 `bg-sidebar oklch(0.21)` (어두운) | ❌ 즉시 |
| **모달 래퍼 17 파일 중복** — `fixed inset-0 z-50 ... bg-black/40` 복붙. FocusTrap/Escape 부재 | ❌ 즉시 |
| **ConfirmDialog 접근성 결함** — FocusTrap 없음, Escape 닫기 없음, 취소 버튼 기본 포커스 없음 | ❌ 즉시 |
| **PublisherPicker / SeriesPicker 완전 중복** — 제네릭 `EntityPicker<T>` 후보 | ⚠️ 1주 |
| AI slop 패턴 — 대시보드 5종 그라데이션 아이콘, `💡` `🔄` 이모지 힌트, 1줄 footer | ⚠️ 백로그 |
| Native `<select>` vs shadcn Select 혼용 | ⚠️ 백로그 |
| ErrorScreen 이 raw `<button>` + slate-800 — 브랜드 무관 | ⚠️ 백로그 |
| `text-[10px]`, `text-[11px]`, `text-[17px]` 등 임의 수치 | ⚠️ 백로그 |

### 2.3 아키텍처 / 기능

| 영역 | 상태 |
|---|---|
| 인증 boundary 3종 (`verifyAdmin/verifyTeacherOrAdmin/verifyAuthenticated`) + `React cache()` | ✅ 모범 |
| 도메인-파일 1:1 정책 (`bus/` 폴더 분리 + re-export 보존) | ✅ 모범 |
| 197회 `verifyAdmin` 호출 / `@auth-skip` 5회 (정당한 사용) | ✅ |
| Realtime 패턴 + StrictMode workaround 주석 | ✅ 모범 |
| `lib/lunch/rotation.ts` anchor 회전 알고리즘 | ✅ 모범 |
| **테스트 0건** — vitest/jest/`test` script 부재 | ❌ 가장 큰 단일 위험 |
| **`ActionResult<T>` 도입율 ~7%** — 표준 정의는 했으나 정체 | ❌ 즉시 |
| **`report-actions.ts` TODO 4건 미해결** + `@auth-skip` 3건 (한 파일에 몰림) | ❌ 즉시 |
| **`bus/change-actions.ts` 765 LOC** — 분리 1순위 | ⚠️ 1주 |
| `class-actions.ts` 712 LOC — 분리 2순위 | ⚠️ 백로그 |
| Next.js 16 `use cache` / PPR / `cacheLife` / `cacheTag` 활용 0 | ⚠️ 기회 |
| `try/catch` 5회뿐 — `auth.getUser()` throw 시 silent fail | ⚠️ 1주 |
| `(admin)/m/layout.tsx` 인증 검증이 `verifyAdmin` 헬퍼 미사용 | ⚠️ 1주 |
| `notice-actions.ts:38` attachments 하드코딩 빈 배열 (첨부 미구현) | ⚠️ 백로그 |
| `docs/` 가 사실상 `HARNESS.md` 1개뿐 (ARCHITECTURE.md 의 약속 위반) | ⚠️ 백로그 |
| info-level audit log 부재 (비번 리셋 등 민감 mutation) | ⚠️ 백로그 |

### 2.4 재사용성 / 단순화

| 영역 | 상태 |
|---|---|
| `domain-helpers.ts` (ensureStudentRecord 등 24곳에서 import) | ✅ 모범 |
| `lib/lunch/rotation.ts`, `lib/bus/realtime-utils.ts` 순수 함수 분리 | ✅ 모범 |
| `lib/utils/date-kst.ts`, `cn`, `sort` 잘 추출됨 | ✅ |
| **mutation boilerplate ~150회 반복** in 23 파일 — `withAdminAction` wrapper 후보 | ❌ ROI 최상 |
| **`Array.isArray(x) ? x[0] : x`** Supabase relation unwrap 53회 / 21 파일 | ⚠️ 1주 |
| **`GROUP_LABEL_TO_TYPE` / `GROUP_TYPE_TO_LABEL` 이중 정의** (`constants/class.ts` ↔ `server/domain-helpers.ts`) | ⚠️ 즉시 |
| **`formData.get("foo") as string)?.trim()`** 패턴 56회 / 7 파일 | ⚠️ 1주 |
| **`new Date().toISOString()` updated_at 직접 작성 197회** — DB trigger 있는데 안 씀 | ⚠️ 백로그 |
| **`error.code === "23505"` 분기 4회 중복** | ⚠️ XS |
| **월/연도 → startDate/endDate 계산 동일 로직 다회** — `date-kst.ts` 로 이동 | ⚠️ XS |
| Dead: `ConfirmDialog.danger` prop (25 callsite 사용 0) | ⚠️ XS |
| Dead: `getNoticeWithAttachments` 의 `images: []`, `attachments: []` | ⚠️ XS |
| Dead: `getClassLinkedCounts.homeworkCount: 0, noticeCount: 0` 하드코딩 | ⚠️ XS |
| Dead: `AdminStudentClassItem.student_number: null` 항상 null | ⚠️ XS |
| Dead: `formatStudentName` 유틸 있는데 17회 `english_name ??` chain 중복 | ⚠️ XS |
| `attendance-actions.ts`: recordAttendance / bulkRecord / bulkReserve 3중 upsert | ⚠️ 1주 |
| `class-actions.ts`: createClass vs updateClass days/period 정규화 + teacher sync 중복 | ⚠️ 1주 |
| `series-actions.ts` / `publisher-actions.ts` create/update FormData 파싱 ~35줄씩 중복 | ⚠️ 1주 |

**보존 주의 (단순화 금지)**:
- `domain-helpers.ts:ensureStudentRecord` — orphan profile 자동 복구 로직
- `realtime-utils.ts` — CDC 변환 알고리즘
- `lunch/rotation.ts` — anchor 회전 핵심
- `use-bus-realtime.ts:30` `Math.random` suffix — StrictMode 회피 (deep-debug 흔적)

---

## 3. 통합 우선순위 — 즉시 / 1주 / 백로그

### 즉시 (이번 스프린트 — 보안 + UX 결함)

| # | 항목 | 영역 | Effort | 출처 |
|---|---|---|---|---|
| 1 | `bus_change_requests_update` RLS 에 status 변경 staff-only 강제 (셀프 승인 차단) | DB | M | DB §8.1 |
| 2 | anon GRANT ALL 정리 (attendance/bus_*/report_cards/notices/student_bus_defaults) → 필요한 grant 만 | DB | S | DB §8.2 |
| 3 | `class_students_select`/`classes_select`/`class_teachers_select` USING(true) 좁히기 | DB | M | DB §8.3 |
| 4 | `student_bus_defaults` UNIQUE (student_id, day_of_week) 제거 — PK 와 모순 | DB | XS | DB §8.4 |
| 5 | `notice-files`/`class-notices`/`academy-notices`/`homework-submissions` 스토리지 RLS 정책 작성 | DB | S | DB §8.5 |
| 6 | Admin Sidebar active 스타일 오류 (`bg-orange-50` → `bg-sidebar-accent`) | UI | XS | UI §4 |
| 7 | ConfirmDialog 에 FocusTrap + Escape 닫기 + 취소 버튼 기본 포커스 | UI | S | UI §3 |
| 8 | 모달 래퍼 공용 컴포넌트 추출 (17 파일 중복 제거) | UI | M | UI §3 |
| 9 | `GROUP_LABEL_TO_TYPE`/`GROUP_TYPE_TO_LABEL` 중복 제거 — 한쪽으로 통합 | Reuse | XS | Reuse §6 |
| 10 | `report-actions.ts` TODO 4건 (`class_teacher_id` 의미 변경) 해결 | Arch | M | Arch §11 |

### 1주 (다음 스프린트 — 구조 정리)

| # | 항목 | 영역 | Effort |
|---|---|---|---|
| 11 | `withAdminAction` wrapper 도입 + 신규 액션부터 적용 | Reuse | M |
| 12 | `unwrapRelation(x)` 헬퍼 — `Array.isArray ? x[0] : x` 53회 통합 | Reuse | S |
| 13 | `parseFormString` 헬퍼 — FormData 파싱 56회 통합 | Reuse | S |
| 14 | `isPgUniqueViolation(error)` 헬퍼 | Reuse | XS |
| 15 | `vitest` 도입 + `lib/lunch/rotation.ts`, `lib/bus/realtime-utils.ts` 순수 함수 단위 테스트 | Arch | M |
| 16 | `bus/change-actions.ts` 765 LOC → 3 파일 분리 (read/mutation/approval) | Arch | M |
| 17 | `PublisherPicker` / `SeriesPicker` → 제네릭 `EntityPicker<T>` | UI | M |
| 18 | `attendance-actions.ts` 3중 upsert 로직 내부 헬퍼 추출 | Reuse | S |
| 19 | `verifyNativeTeacherForStudent` / `verifyReportOwnership` 헬퍼 → `@auth-skip` 3건 흡수 | Arch | S |
| 20 | `series.total_units=0` silent skip 경고 또는 NOT NULL 강제 | DB | S |
| 21 | `class_homework_books.skip_dates` GIN 인덱스 재추가 | DB | XS |
| 22 | `lunch_leader_anchors`/`lunch_class_order_anchors` `tg_set_updated_at` trigger 부착 | DB | XS |
| 23 | Dead code 5건 제거 (ConfirmDialog.danger, getNoticeWithAttachments 빈 배열, getClassLinkedCounts 0, student_number: null, english_name chain) | Reuse | S |
| 24 | `(admin)/m/layout.tsx` 인증을 `verifyAdmin` 헬퍼로 통일 | Arch | XS |
| 25 | `auth.getUser()` throw 방어 in `verifyAdmin` (try/catch wrap) | Arch | XS |

### 백로그 (필요할 때)

| # | 항목 | 영역 |
|---|---|---|
| 26 | `ActionResult<T>` 마이그레이션 가속 (도입율 7% → 50%+) | Arch |
| 27 | `class-actions.ts` 712 LOC 분리 검토 (read/picker/mutation) | Arch |
| 28 | Next.js 16 `use cache` + `cacheTag` 도입 (catalog reads — series/publishers/textbooks) | Arch |
| 29 | PPR on `(site)` 마케팅 페이지 | Arch |
| 30 | `useOptimistic` for 출석 토글 / 숙제 status 토글 | UI |
| 31 | 마케팅 사이트 Footer 강화 (1줄 → 회사 정보 + 링크) | UI |
| 32 | AI slop 청소 (대시보드 5종 그라데이션, `💡`/`🔄` 이모지, 임의 폰트 수치) | UI |
| 33 | `homework_status` / `lunch_group` text+CHECK → enum 승격 | DB |
| 34 | `class_homework_books.textbook_id` → `homework_book_id` rename | DB |
| 35 | `class_schedules.class_teacher_id` 의 FK 를 `class_teachers(id)` 로 통일 | DB |
| 36 | 요일 인덱싱 (0..6 vs 1..5) 일관성 정리 + 변환 헬퍼 단일화 | DB |
| 37 | `profiles.deleted_at IS NULL` 을 RLS 정책에 반영 또는 soft-delete 패턴 통일 | DB |
| 38 | 중복 인덱스 정리 (attendance/bus_change_requests/bus_check_records `*_student_id_date_key`) | DB |
| 39 | `next/no-restricted-imports` lint — `client.ts` 파일에서 `admin.ts` import 차단 | Arch |
| 40 | logger 외부 sink (Sentry/Datadog) wrapping + info-level audit log | Arch |
| 41 | 공지 attachments 와이어링 — Storage 버킷은 있는데 코드 미연결 | Arch |
| 42 | 마이그레이션 `truncate` dev-only 파일명 컨벤션 (`_dev_only` 접미사) | DB |
| 43 | 인덱스 이름 컨벤션 (`idx_<table>_<col>` vs `<table>_<col>_idx`) 통일 | DB |
| 44 | 학부모 상담 예약 anti-spam (rate limit/honeypot) — 비인증 제출이라면 | Arch |
| 45 | `bus/staff-actions.ts` 비활성 stub 의 번들 영향 측정 | Arch |

---

## 4. 가장 값진 5개 액션 (시간 대비 효과)

이 코드베이스에 손을 댄다면 이 순서로:

1. **DB 보안 5건 일괄 패치 (즉시 #1~5)** — 마이그레이션 1~2개로 모두 처리 가능. 학원 SaaS 의 신뢰 비용.
2. **`vitest` + `lib/` 순수 함수 단위 테스트 도입 (1주 #15)** — 1~2일 작업. 376개 서버 액션의 회귀 안전망의 시작점. rotation/realtime/date-kst 로 30~50 테스트 확보.
3. **`withAdminAction` wrapper + boilerplate 정리 (1주 #11~14)** — 23 파일 평균 30% 축소. 새 액션 작성 비용 절감 + revalidate 누락 방지.
4. **모달 / ConfirmDialog 접근성 + 모달 공용 컴포넌트 추출 (즉시 #6~8)** — 17 파일 중복 제거. FocusTrap/Escape 부재는 키보드 사용자에게 차단.
5. **`report-actions.ts` TODO + `@auth-skip` 헬퍼화 (즉시 #10 + 1주 #19)** — 가장 권한 복잡한 도메인의 보안 흔적 정리. 단위 테스트 가능해짐.

---

## 5. 칭찬할 만한 곳 (유지)

이 코드베이스가 잘 하고 있는 부분 — **건드리지 말고 패턴 확장만**.

- `auth-helpers.ts:14` 의 `verifyAdmin` + `React cache()` — 명시적 + 캐싱 정확
- `bus-actions.ts → bus/` 폴더 점진 분리 + re-export 보존 — 호출 사이트 안정 + 인지 부담 분산
- `lib/lunch/rotation.ts` anchor + businessDaysBetween — 학원 도메인 요구를 순수 함수로 추상
- `lib/bus/realtime-utils.ts` + `use-bus-realtime.ts:30` 의 StrictMode 주석 — 도메인 전문성 + 운영 흔적
- `private.get_my_role()` SECURITY DEFINER + `(select …)` 래핑 — Postgres RLS 캐시 최적화
- Security definer trigger 4개의 RLS 위임 계약 코멘트 (`20260509010000_homework_unit_progress_followups.sql`)
- partial unique `series_name_active_uidx where is_active = true` — soft-delete + 이름 재사용
- `20260530100000_classes_period_id.sql` 의 이름 파싱 정규식 + 깨지면 skip 패턴
- `proxy.ts:43` 의 try/catch wrap — 다른 액션에도 표준화 가치
- ROLLBACK 주석 (`lunch_supervision.sql`) — 새 마이그레이션 PR 템플릿화 후보
- `domain-helpers.ts` — 24곳 import 의 DRY 효과
- `STORAGE_BUCKETS` + WebP 변환 헬퍼 with SSR 가드 — 도메인 단일 책임

---

## 6. 메모: 본 리뷰의 한계

- **런타임 실측 없음** — 빌드/타입체크/실제 페이지 로드 검증은 안 함. 정적 분석 + 코드 읽기만.
- **운영 DB 상태 미확인** — `truncate`/`DELETE` 마이그레이션이 실제 운영에 적용됐는지 (= 데이터 손실이 일어났는지) 는 별도 확인 필요.
- **브라우저 a11y 실측 없음** — axe-core 등 자동 도구 결과 아님. 코드에서 보이는 패턴 기반.
- **스토리지 버킷 RLS 정책 부재** — 마이그레이션에 없다는 것이지, Supabase 콘솔에서 수동 추가됐을 가능성 별도 확인.
- **`code-review-graph` MCP 활용** — 일부 분석은 graph 데이터 (1379 nodes / 12974 edges / 348 files) 기반.
- 본 종합본은 4개 영역 리뷰의 통합 인덱스 — 상세 근거는 각 파트 MD 참조.
