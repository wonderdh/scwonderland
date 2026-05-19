# 아키텍처 / 기능 리뷰

> SC Wonderland — Next.js 16 App Router + React 19 + Supabase (학원 관리 SaaS)
> 리뷰 일자: 2026-05-19 / 리뷰 범위: 코드 베이스 전반 (READ-ONLY)
> 핵심 메트릭: 서버 액션 ~375개 (admin/actions 21 파일 + bus/ 7 파일), `verifyAdmin` 계열 호출 197회, `@auth-skip` 5회, `createAdminClient` import 38 파일, `revalidatePath/Tag` 96회, `try/catch` 5회, `logger.*` 197회, `"use client"` 92회.

---

## 1. 요약

### 전체 평가 (B+, "기능적으로 견고, 구조적으로 일관, 테스트 0")

- **강점**: 인증 boundary 가 `verifyAdmin / verifyTeacherOrAdmin / verifyAuthenticated` 3 종으로 명확하게 정리되어 있고 `React cache()` 로 요청당 1회 DB 호출로 최적화됨 (`src/app/(admin)/admin/actions/auth-helpers.ts:14`). 서버 액션 파일은 도메인 단위로 깔끔하게 분할되어 있고 (`AGENTS.md` 의 "파일 1개 = 도메인 1개" 규칙이 실제로 지켜지고 있음), `bus/` 처럼 도메인이 비대해지면 폴더로 재분할하는 정책도 실행됨.
- **약점**: (1) **테스트 0건** — `package.json:scripts` 에 `test` 가 없음. 376개 서버 액션의 어떤 회귀도 자동 감지 불가. (2) **`try/catch` 5회뿐** — Supabase error 객체 분기에 의존하지만 *throw* 하는 경로 (예: `auth.getUser()` 자체 예외, `supabase.rpc` 등) 는 무방비. (3) **`ActionResult<T>` discriminated union 은 정의만 되어 있고 실제 액션 376개 중 ~26 곳만 사용** — 반환 타입이 4종 혼재 (`{ error?: string }`, `{ error?: string; id?: string }`, `Promise<T | null>`, `ActionResult<T>`). (4) **`createAdminClient` 가 38 파일에 산재** — RLS 우회가 일상이라 RLS 정책 자체가 사실상 fallback 보조 도구로 전락.

### Top 위험 (Severity × Effort)

| # | 위험 | Severity | Effort |
|---|---|---|---|
| R1 | 테스트 부재 — 회귀 감지 불가 | High | High |
| R2 | RLS 우회 (`createAdminClient`) 가 38 파일 일상화 → 서버 액션 권한 분기에 모든 보안 부담 집중 | High | Medium |
| R3 | `report-actions.ts` 의 `@auth-skip` 3건 (수동 검증) — class_teacher_id 의미 변경 TODO 4건 미해결 | Medium-High | Medium |
| R4 | 서버 액션 반환 타입 4종 혼재 — 호출처 클라이언트가 잘못 처리할 가능성 | Medium | High |
| R5 | `bus/change-actions.ts` 765줄 — 단일 파일 인지 부담 + 변경 충돌 위험 | Medium | Medium |

### Top 기회

1. **`ActionResult<T>` 점진 마이그레이션 가속화** — 정의는 한 것 같지만 도입율 ~7% 에 머문 채 정체.
2. **Next.js 16 PPR / Cache Components 미활용** — `use cache`, `cacheLife`, `cacheTag` 사용 0건. 학원 운영 데이터 (수업 시간표, 점심 회전) 같은 정적 ~ 반정적 데이터에 적용 가능.
3. **테스트 베이스라인** — `lib/lunch/rotation.ts` 같은 순수 함수부터 단위 테스트 도입. 영업일 계산, anchor resolve 등 도메인 로직이 잘 격리되어 있음.

---

## 2. 라우트 & 레이아웃 구조

### 라우트 그룹

| 그룹 | 목적 | layout 책임 | 인증 모델 |
|---|---|---|---|
| `(site)` | 공개 마케팅 (about / program / experience / community / notice) | 마케팅 chrome (Navigation, SubNav, Footer) | 없음 (anonymous) |
| `academy/` | 학생/교사 포털 (그룹화되지 않은 폴더라우트) | `AcademyShell` + role-aware nav | `getUser()` + role lookup; entry `page.tsx:6` 에서 role 별 redirect |
| `(admin)/admin/` | 관리자 대시보드 | `AdminLayoutClient` (전체 shell + sidebar) | `verifyAdmin` 강제 in `layout.tsx:22` |
| `(admin)/m/` | 관리자 모바일 | 최소 shell (`MobileAdminLayout`) | `profile.role === "admin"` 검증 in `layout.tsx:24` |
| `(monitor)/` | TV 디스플레이 (bus / lunch) | metadata + PWA manifest. **비인증 라우트** | 없음 — `getLunchSchedule`, `getDailyBusManifest` 가 `@auth-skip` |
| `bus/` | 버스 기사용 (현재 비활성) | 단독 layout | 비활성 stub |

### 평가

**라우트 그룹은 깔끔히 분리됨.** `(admin)` 과 `(monitor)` 가 같은 그룹이 아니란 점이 좋다 — `(monitor)` 는 TV 큰 화면 + 비인증 + PWA 라는 완전히 다른 chrome 을 가지고 있음 (`bus-monitor/layout.tsx:23`).

**우려 1: `(admin)/m/` 와 `(admin)/admin/` 의 layout 분리 비대칭.**
- `(admin)/admin/layout.tsx:22` 는 `verifyAdmin` 후 `AdminLayoutClient` 로 wrap.
- `(admin)/m/layout.tsx:24` 는 `profile.role !== "admin"` 만 보고 redirect — `getUserRoles` helper 를 안 쓰고 직접 쿼리. 같은 검증 로직이 두 형태로 존재.
- **의의**: 두 layout 이 같은 보호 모델이라면 `(admin)/layout.tsx` 를 공통 부모로 만들거나 `verifyAdmin` 으로 통일해야 한다. 현재는 `m/page.tsx` 가 어떤 모바일 메뉴를 보여줄지 결정하지만 인증 helper 가 다르므로 향후 정책 변경 시 한 곳 빠뜨릴 위험.

**우려 2: 모바일 (`/m`) 과 데스크톱 (`/admin`) 이 같은 라우트 그룹.**
- 같은 `(admin)` group share layout 패턴을 활용하면 `(admin)/layout.tsx` 한 곳에서 공통 인증 + 두 자식이 chrome 만 다르게 처리 가능. 현재는 두 layout 이 sibling 으로 분리되어 있어 그룹화 이점이 거의 없음. `(admin)` 그룹화의 유일한 효과는 URL 에서 `/admin` 이 안 보이지 않는 점 (관리자라서 보여도 무방).
- **트레이드오프**: 합치면 코드 중복 감소하나 `AdminLayoutClient` (sidebar + 데스크톱 nav) 와 모바일 layout 의 chrome 이 완전히 다른 만큼 무리한 통합은 오히려 분기를 만든다. 현재 구조도 합리적.
- **모바일 라우팅 결정**: `src/proxy.ts:12` 가 `/admin` 진입 시 mobile UA detect → `/m` redirect. 단순하고 명확. 다만 `/admin/students` 같은 deep link 는 mobile 에서 그냥 desktop UI 로 표시됨 (모바일 메뉴는 `/m/` 의 3 페이지만: attendance / bus-change / bus-check / homework). **이건 의도된 축소 — `m/` 는 풀 admin 의 모바일 미러가 아니라 "현장 운영" 화면**. 이 의도가 문서화되어 있지 않으면 미래 협업자가 혼동할 수 있음.

**우려 3: `academy/` 는 라우트 그룹이 아닌 일반 폴더.**
- `(site)`, `(admin)`, `(monitor)` 와 동급 의미인데 괄호가 없어 URL 에 `/academy` prefix 가 노출됨. 이는 의도된 것 (`/academy/student`, `/academy/teacher` 라는 의미 있는 URL) 으로 보임. 단, "그룹화는 의미적 boundary, 폴더는 URL prefix" 라는 컨벤션이 ARCHITECTURE.md 에 명시되어 있지 않아 향후 결정에 흔들림 여지.

---

## 3. 서버 액션 허브 분석

### 파일별 책임 + 라인 수 매트릭스

| 파일 | LOC | 주 책임 | 인증 가드 | 외부 노출 |
|---|---|---|---|---|
| `class-actions.ts` | **712** | 반 CRUD, 학생/교사 매핑, 시간표 picker | `verifyAdmin (16) + verifyAuthenticated` | admin only |
| `bus/change-actions.ts` | **765** | 변경요청 CRUD + 승인 워크플로우 | `verifyAdmin (13) + verifyAuthenticated` | admin + student |
| `bus/master-actions.ts` | **639** | 노선/시간슬롯/정류장 마스터 | `verifyAdmin (16)` | admin only |
| `user-actions.ts` | **592** | 학생/교사/관리자 user CRUD, 비번 리셋 | `verifyAdmin (16)` | admin only |
| `homework-unit-actions.ts` | **565** | 숙제 unit 진도 (hot path, 36x 호출) | `verifyAuthenticated + verifyTeacherOrAdmin (6)` | teacher + student + admin |
| `schedule-actions.ts` | **546** | 수업 시간표 schedule | `verifyAdmin (10)` | admin only |
| `report-actions.ts` | **493** | 리포트카드 — 가장 권한 복잡 | `verifyAdmin (5)` + `@auth-skip × 3` | teacher + student + admin |
| `bus/manifest-actions.ts` | **472** | 일일 매니페스트 계산 | `verifyAdmin (2)` | admin + monitor |
| `class-textbook-actions.ts` | **411** | 반-교재 매핑 | `verifyAdmin (8)` | admin only |
| `bus/assignment-actions.ts` | **398** | 학생-버스 할당 | `verifyAdmin (8)` | admin only |
| `attendance-actions.ts` | **392** | 출결 기록 | `verifyAdmin (10)` + `verifyTeacherOrAdmin` | teacher + admin |
| `afterschool-actions.ts` | **402** | 방과후 신청 | `verifyAdmin (12)` | admin only |
| `series-actions.ts` | **331** | 시리즈 카탈로그 | `verifyAdmin (9)` | admin only |
| `lunch-actions.ts` | **330** | 점심지도 anchor + 조회 | `verifyAdmin (8)` + `@auth-skip × 1` | admin + monitor |
| `bus/board-actions.ts` | **286** | 승하차 체크 | `verifyAdmin (6)` | admin |
| `bus/staff-actions.ts` | **250** | 버스 스태프 | `verifyAdmin (5)` | admin |
| `weekly-sentence-actions.ts` | **245** | 주간 문장 | `verifyAdmin (7)` | admin + site |
| `textbook-actions.ts` | **188** | 교재 master | `verifyAdmin (6)` | admin |
| `publisher-actions.ts` | **185** | 출판사 | `verifyAdmin (7)` | admin |
| `notice-actions.ts` | **141** | 공지 (현재 attachment 없는 스텁) | `verifyAdmin (7) + verifyAuthenticated` | admin + site |
| `reservation-actions.ts` | **124** | 학부모 상담 예약 | `verifyAdmin (2)` | admin |
| `timetable-actions.ts` | **111** | 시간표 조회 helper | `verifyAdmin (5)` | admin |
| `dashboard-actions.ts` | **65** | 통계 카드 | `verifyAdmin (3)` | admin |
| `bus-actions.ts` | **12** | re-export | n/a | n/a |
| `bus-staff.ts` | **6** | re-export | n/a | n/a |
| `bus/_helpers.ts` | **73** | bus 내부 헬퍼 | n/a | internal |
| `auth-helpers.ts` | **103** | verifyAdmin 등 | n/a | internal |
| `academy/actions.ts` (학생/교사) | **286** | 학생/교사 본인 정보 + 담당반 | `getUser` 직접 | student + teacher |
| `bus/actions.ts` | **9** | 비활성 stub | n/a | n/a |

### 분포 평가

**좋은 점:**
1. **도메인-파일 1:1 정책이 살아있다.** 비대해진 `bus-actions.ts` 가 `bus/` 폴더로 재분할되면서 원본 파일은 `export *` re-export 12줄로 축소됐고 (`bus-actions.ts:7`), 호출 사이트의 import path 안정성도 유지됨. 모범적인 점진 리팩토.
2. **인증 가드 호출 197회 in 25 파일** — 거의 모든 mutation 함수에 가드가 들어가 있다는 의미. 빠진 곳은 의도된 (`@auth-skip` 5회 — lunch monitor 의 read-only + report 의 수동 검증).
3. **`bus-staff.ts` 의 stub-and-roadmap 패턴** — 도메인 재도입 결정 전까지 명시적 비활성화. dead code 가 아니라 "유보 중" 임을 코드와 주석으로 표시 (`bus-staff.ts:5`, `bus/staff-actions.ts:17`).

**hot path 분석:**

- **`class-actions.ts` (712 LOC, 50x 호출 추정)** — `listClassesForHomeworkPicker`, `listClassesWithDetails`, `getClassWithStudents` 등 18개 export. **권장: 다음 분리 후보**. 712줄은 한 도메인 안에서도 (read / mutation / picker / batch) 4종 함수가 섞여있다. `class/` 폴더로 4 파일 분리 검토. 단, `bus/` 와 달리 도메인 자체는 작은 편 (반은 ~30개 / 학생 ~수백)이라 분리 효용은 토론거리.
- **`homework-unit-actions.ts` (565 LOC, 36x 호출 추정)** — unit 진도 hot path. 학생/교사/관리자 3 role 다 들어옴. **권장: 분리 안 함.** 단일 도메인 (per-unit progress) 이고 함수들이 강하게 결합 (status 분기, expectedDate 계산 등). 565줄은 단일 파일로도 인지 가능 범위.
- **`bus/change-actions.ts` (765 LOC)** — 가장 길다. `change_type` 4종 (`change | no_ride | absent | temporary_change`) 의 workflow + admin 승인 + realtime broadcast 가 한 파일에 응축. **위험**: 변경 충돌, 신규 change_type 추가 시 회귀. **권장**: 적어도 (read / mutation / admin-approval) 세 파일로 분리. `bus/master-actions.ts` (639 LOC) 도 비슷.

**작은 파일들 (~12 ~ ~125 LOC):**
- `bus-actions.ts:7`, `bus-staff.ts:6` — pure re-export. 컨벤션상 OK.
- `dashboard-actions.ts:1` (65 LOC, 2 함수) — 작은 게 정상. 통계 카드 전용.
- `reservation-actions.ts` (124 LOC) — 그럴듯하나 학부모 상담 예약 같은 신규 기능이 들어오면 빠르게 커질 영역.

### 권한 모드 분포 (가드 호출 거리)

- `verifyAdmin`: 평균 9.3회/파일 (highest: bus/master-actions:16, user-actions:16, class-actions:16)
- `verifyTeacherOrAdmin`: 6회만 (`homework-unit-actions:6`) — teacher 가 mutation 하는 액션은 거의 숙제 진도뿐.
- `verifyAuthenticated`: 8회만 — read-only 조회 보호용. 의도된 분포로 보임.

---

## 4. 인증 / 권한

### 가드 3종 패턴 (`auth-utils.ts` + `auth-helpers.ts`)

| Helper | 역할 | 캐싱 | 사용처 |
|---|---|---|---|
| `verifyAdmin()` | role=admin 검증 | `React cache()` per-request | 197회 중 다수 |
| `verifyTeacherOrAdmin()` | role ∈ {admin, teacher} | `React cache()` | mutations of teacher 도메인 |
| `verifyAuthenticated()` | 로그인만 확인 | `React cache()` | shared read actions |

**잘 된 점:**
- **`React cache()` 적용**: 같은 요청에서 `verifyAdmin` 을 여러 액션에서 호출해도 `auth.getUser()` + profiles 쿼리 1회 (`auth-helpers.ts:14`). 명시적이고 올바른 사용.
- **fail-soft 반환**: `{ userId }` or `{ error }` discriminated. 호출처가 `"error" in auth` 로 분기 — `class-actions.ts:97`. 일관됨.
- **logger.warn 기록**: 권한 실패 시 `userId` + `roles` 로 감사 흔적 (`auth-helpers.ts:28`).

### `@auth-skip` 사용 빈도: 5건 (전체 mutation 의 ~1.3%)

1. **`lunch-actions.ts:87` — `getLunchSchedule`**: TV 비인증 모니터 공유. 학생 이름 수준의 민감도라 정당. mutation 인 anchor 쓰기는 여전히 `verifyAdmin`.
2. **`report-actions.ts:92` — `upsertReportCard`**: 수동 검증 (getUser + role + teacher_type=native + 담당반 membership). 합리적이지만 위험 표면 큼.
3. **`report-actions.ts:189` — `deleteReportCard`**: native 본인 + admin. 수동.
4. **`report-actions.ts:241` — `updateReportCardReply`**: 학생 본인 verify (row.student_profile_id === user.id).

**평가**: 5건 모두 정당한 사용 (helper 로 표현 불가능한 도메인 로직). 다만 `report-actions.ts` 의 3건이 한 파일에 몰려있어 **`verifyReportCardActor(reportCardId, role, action)` 같은 도메인 가드 helper 추출 후보**. 추출하면 `@auth-skip` 0으로 줄고 단위 테스트도 한 함수에 집중 가능. 트레이드오프: helper 가 reportCardId 1회 추가 fetch 를 강제하므로 latency +1 query.

### verifyAdmin 누락 위험 분석

- **`academy/actions.ts`**: `verifyAdmin` 등 helper 를 안 쓰고 `getUser()` + `hasUserRole()` 직접 호출 (`academy/actions.ts:11~30`). 이건 read-only 본인 정보 조회이므로 정당하다 (`getCurrentStudentProfile` 은 본인 외 정보 노출 X). 다만 helper 미사용은 코드 일관성 측면 -1.
- **`bus/manifest-actions.ts` (2회만 verifyAdmin)**: 매니페스트 조회는 비인증 TV 와 공유. 의도된 적은 가드. read-only 면 OK 지만 *write* 가 있다면 위험. `getDailyBusManifest` 가 read-only 임은 함수명상 명확.
- **`reservation-actions.ts` (2회만 verifyAdmin)**: 124 LOC 인데 mutation 보호가 2회뿐. 학부모 상담 예약은 학부모도 제출 가능? 확인 필요한 영역. 만약 학부모 제출이 비인증으로 가능하면 anti-spam / rate limit 필요.

### 우려: RLS 의 역할

- `createAdminClient` import 가 **38 파일** — 거의 모든 mutation 이 RLS 우회. 즉 **권한 boundary 는 100% 서버 액션 가드에 위임**됨.
- 장점: 명시적, 디버깅 쉬움.
- 단점: 가드가 빠지면 즉시 권한 우회. RLS 가 backup 못함. 따라서 PR 리뷰 / grep 으로 가드 누락 검증 필요 (이미 AGENTS.md 에 명시).

---

## 5. Supabase 통합 & 데이터 액세스

### 3-client 패턴

| 클라이언트 | LOC | RLS | 사용 위치 | 위반 케이스 |
|---|---|---|---|---|
| `client.ts` (`createBrowserClient`) | 10 | 적용 | "use client" 컴포넌트 only | 없음 (확인된 한) |
| `server.ts` (`createServerClient` + cookies) | 29 | 적용 | RSC / Server Action 의 user 검증 부 | 없음 |
| `admin.ts` (`SUPABASE_SERVICE_ROLE_KEY`) | 24 | **우회** | server only | 없음 (확인된 한) |

**`createAdminClient` 사용처 모두 검증 OK:**
- 38 파일 모두 `src/lib/server/`, `src/app/.../actions/`, `src/app/(admin)/admin/.../route.ts`, `src/app/academy/layout.tsx` (server component) 안. **`"use client"` 파일 안에는 import 없음** — 정적 분석으로 못 막지만 grep 결과 0건.

**잘 된 패턴:**
- **인증 검증은 `server.ts` (RLS 적용 client) 로, mutation 은 `admin.ts` 로 명확히 분리** — `report-actions.ts:38` 에서 `await createClient()` 로 user 컨텍스트 가져온 뒤 `createAdminClient()` 로 우회 mutation. 의도가 명확.
- `auth.persistSession: false, autoRefreshToken: false, detectSessionInUrl: false` — admin client 가 세션을 가지지 않게 (`admin.ts:17`). 보안적으로 옳음.

**우려:**
- **38 파일에 import 가 산재** — single helper 가 아니라 매 파일에서 `createAdminClient()` 호출. 트레이드오프: 명시성 vs 일관성. ARCHITECTURE.md 의 "정적 분석으로 못 막으니 PR 리뷰 때 grep" 정책은 합리적이나, lint rule (예: `no-restricted-imports` 로 `client.ts` 파일에서 `admin.ts` import 차단) 추가로 강화 가능.

### `storage.ts` (164 LOC)

- 5 buckets 정의 (`STORAGE_BUCKETS`), 3 file category 검증 (image/document/audio), WebP 변환.
- 모범적인 단일 책임. 클라이언트 변환 (`convertImageToWebP`) 이 SSR 컨텍스트에서 호출되면 throw 한다는 가드 (line 130 주석) 있음.

### `domain-helpers.ts` (148~ LOC)

- `ensureStudentRecord`, `getStudentsByIds`, `getTeacherRecordByProfileId`, `getUserIdsByRole`, `toGroupType` — admin client 위에서 도메인 변환을 제공. **잘 추출됨.** 24 곳에서 import — DRY 효과 확실히 발휘.

---

## 6. 도메인별 기능 완성도

| 도메인 | 코드 위치 | 상태 | 비고 |
|---|---|---|---|
| **인증 / role 분기** | `auth-utils.ts`, `user-roles.ts`, `proxy.ts` | **완성** | 3 role + 한글→영문 키보드 매핑 자동 변환 |
| **출석 (attendance)** | `attendance-actions.ts` (392), `m/attendance/`, `admin/attendance/` | **완성** | 학생/일자/상태 upsert. 결석/조퇴/지각 enum. lunch rotation 과 연동 |
| **시간표 (timetable / schedule)** | `timetable-actions.ts` (111), `schedule-actions.ts` (546), `academy_periods` FK 시리즈 | **완성** | 최근 `classes_period_id` 추가 (2026-05). period FK 도입 |
| **반/학급 (classes)** | `class-actions.ts` (712), `class-textbook-actions.ts` (411) | **완성** | group_type 3종 (kindergarten/afternoon/afterschool). lunch_group 추가됨 |
| **숙제 (homework)** | `homework-unit-actions.ts` (565), `textbook-actions.ts` (188), `series-actions.ts` (331), `publisher-actions.ts` (185), `class-textbook-actions.ts` (411) | **완성 (활발히 진화)** | 시리즈/cover/total_units 재정비 진행 (2026-05). 최근 5개 마이그레이션 |
| **버스 (bus)** | `bus/` 폴더 (7 파일, 2883 LOC) + realtime | **완성** | 가장 큰 도메인. realtime broadcast 적용. 기사용 (`/bus`) 만 stub |
| **급식 (lunch)** | `lunch-actions.ts` (330) + `lib/lunch/rotation.ts` (270) + `/lunch-monitor` | **완성 (신규)** | Anchor 방식 회전 (2026-05 재도입). 순수 함수 분리 잘 됨 |
| **공지 (notices)** | `notice-actions.ts` (141) | **부분 완성** | `getNoticeWithAttachments` 가 `images: []`, `attachments: []` 하드코딩 — 첨부 미구현 (line 38) |
| **리포트 (report)** | `report-actions.ts` (493) | **완성, 권한 복잡** | `class_teacher_id` 의미 변경 TODO 4건 미해결 (line 56, 165, 213, 456) |
| **유저관리 (user)** | `user-actions.ts` (592) | **완성** | 학생/교사/관리자 CRUD + 비번 리셋 |
| **시리얼/방과후 (afterschool)** | `afterschool-actions.ts` (402) | **완성** | 신청 관리 |
| **예약 (reservation)** | `reservation-actions.ts` (124) | **완성 (간단)** | 학부모 상담 예약 |
| **주간 문장 (weekly-sentence)** | `weekly-sentence-actions.ts` (245) | **완성** | 사이트 hero 영역에 표시 |
| **버스 기사 (bus driver)** | `bus/actions.ts` (9), `bus-staff.ts` (6), `bus/staff-actions.ts` stub | **비활성 stub** | "재도입 결정 시 복원" 명시 (`bus-staff.ts:7`) |
| **공개 사이트 ((site))** | 6 페이지 (about/program/experience/community/notice) | **완성** | 정적 콘텐츠 + 일부 server-fetched (`notice/news/[id]`) |

### 완성도 핵심 인사이트

1. **숙제 도메인이 가장 활발히 진화 중**: 최근 30 마이그레이션 중 ~25 개가 homework 관련 (`20260507~20260529`). 스키마가 자주 바뀌므로 회귀 위험 가장 큼. 테스트 0건 환경에서 가장 위험한 영역.
2. **버스 도메인이 가장 복잡**: 7 파일 / 2883 LOC + realtime + 4종 change_type + admin 승인 워크플로우. 가장 두꺼운 도메인이지만 폴더 분리로 인지 부담 분산.
3. **`/bus` 와 `bus-staff` 는 정직한 stub**: 삭제 대신 "재도입 결정 대기" 로 보존. dead code 와 차이는 주석/문서가 명시적이라는 점. 단, 컴파일에는 포함되니 번들 사이즈 영향 약간 있음 (BusStaffMonitor 컴포넌트 등).
4. **공지 첨부 미구현**: `notice-actions.ts:38` 가 `images: [], attachments: []` 하드코딩 — Storage 버킷은 정의되어 있으나 (`storage.ts:STORAGE_BUCKETS.NOTICE_FILES`) 와이어링 미완. 향후 작업 항목.

---

## 7. 캐싱 / 성능 / 관찰성

### Next.js 16 Cache 활용

- **`use cache` directive 사용: 0건.**
- **`unstable_cache`: 0건.**
- **`React cache()`: 6건** — 모두 auth helper 또는 `listPublishers`, `listSeries` 같은 reference data list. 단일 요청 내 deduplication 만.
- **`revalidatePath`/`revalidateTag`: 96건 across 16 파일** — mutation 후 명시적 invalidation. 표준 패턴.
- **`generateMetadata`: 1건만** (`notice/news/[id]/page.tsx:9`).
- **`dynamic` / `revalidate` route segment config: 0건.**

### 평가

**현재는 dynamic-first 전략.** 거의 모든 admin/academy 페이지가 `await createClient()` + `getUser()` 를 layout 에서 호출하므로 자동으로 dynamic. 단점 없음 (admin 페이지는 본질적으로 dynamic).

**기회 (Next.js 16):**
- **`use cache` + `cacheTag`**: 예 — `listSeries`, `listPublishers`, `listTextbooks` 같은 카탈로그 데이터를 `'use cache'` + `cacheTag('catalog')` 로 캐싱. mutation 시 `revalidateTag('catalog')`. 현재 매 페이지 로드마다 fetch 함. 비록 admin only 라 트래픽 적지만 schedule picker 등 hot path 에서 효과 있음.
- **PPR (Partial Prerendering)**: Next.js 16 의 PPR 활용 0. admin page header / sidebar (정적) + content (동적) 분리에 적합. `(site)` 마케팅 페이지는 PPR 효과 더 큼.
- **`cacheLife`**: `weekly-sentence` 가 주간 문장이라 1주일 TTL 캐시에 최적합 — 현재 매 (site) 페이지 로드마다 fetch.

### 관찰성 (logger)

- **`logger.*`: 197건 across 24 파일.** 광범위.
- 패턴: `logger.error("[tag]", message, ctx)` 형식. 구조화된 JSON output.
- **장점**: Supabase error 가 발생할 때마다 컨텍스트와 함께 기록 — `attendance-actions.ts:43`, `report-actions.ts:50` 등.
- **약점**:
  - `console.log/warn/error` 만 사용 (`logger.ts:15`). 운영 환경에서 외부 sink (Sentry, Datadog 등) 로 보내려면 wrapping 필요.
  - **info-level 로깅은 없음** — 성공 케이스 추적 불가. 예: "admin X 가 student Y 비번 리셋" 같은 audit log 가 없음. 학원 SaaS 컴플라이언스 측면에서 추가 검토 가치.

### Realtime

- **5 파일에서 사용**: `use-bus-realtime`, `BusDashboard`, `BusStaffMonitor`, `BusMonitorClient`, `DailyBusChanges`.
- `bus_check_records` + `bus_change_requests` 두 테이블의 `postgres_changes` 구독.
- **모범적 패턴** in `use-bus-realtime.ts:30` — StrictMode double-effect 회피용 `uid` suffix. 같은 topic channel 재사용으로 인한 `.on()` 실패 사례가 주석에 기록됨. 이건 매우 잘 된 deep-debug 흔적.
- `realtime-utils.ts:34` 의 `applyCheckRecord`, `applyChangeRequest` 는 순수 함수로 분리 — **테스트 가능성 최상**. 그런데 테스트 0건.
- **lunch 도메인은 realtime 미사용** — lunch monitor 는 단순 SSR + 클라이언트 refetch (확인은 LunchMonitorClient 안 봤지만 페이지가 server component 라서 추정). anchor 변경이 빈번하지 않으므로 정당.

---

## 8. 타입 안전성 & 에러 핸들링

### TypeScript

- **`database.generated.ts` 활용**: `Database` import 가 service 전반에 들어가 있음. 타입 자동 생성 (`npm run db:types`) 워크플로우 정착.
- **`any` / `as` 사용량**: 248회 across 38 파일.
  - 대부분 `as const`, `as <TypeName>` (지정형 cast). `as any` 또는 raw `any` 는 grep 으로 추가 검증 필요.
  - hotspot: `homework-unit-actions.ts:28`, `class-actions.ts:18`, `series-actions.ts:17`, `user-actions.ts:23` — 도메인 매핑 결과를 cast 하는 패턴. Supabase 타입이 nested join 에서 잘 못 추론할 때 흔히 발생. 정당한 사용 가능성 높음.

### 서버 액션 반환 타입 일관성

| 패턴 | 사용량 (대략) | 평가 |
|---|---|---|
| `Promise<{ error?: string }>` | 다수 (375회 중 ~180회 `return { error }`) | 가장 흔한 레거시 패턴 |
| `Promise<{ error?: string; id?: string }>` | 일부 | id 반환용 |
| `Promise<T \| null>` | read-only 액션 다수 | failure case 가 null |
| `Promise<T[]>` 또는 `Promise<T>` (empty default) | 일부 | error 시 `[]` / 0 등 fallback |
| `Promise<ActionResult<T>>` (`ok`/`fail`) | **26회만** (`server-action.ts` 정의에서 "188개 액션 중 점진 마이그레이션" 명시) | 표준이지만 도입율 ~7% |

**핵심 문제**: 정의된 표준 (`ActionResult<T>` discriminated union) 이 있는데 ~93% 액션이 레거시 패턴 사용. 호출 사이트의 클라이언트가 매번 분기 로직을 다르게 작성하게 됨.

**예시 비교:**
```ts
// 레거시 (대부분)
const result = await createNotice(formData);
if (result.error) { toastError(result.error); return; }
const id = result.id;  // 타입상 string | undefined

// 표준 (소수)
const result = await createClass(...);
if (!result.ok) { toastError(result.error); return; }
const id = result.data.id;  // 타입상 string (narrowing)
```

### Error Handling

- **`try/catch` block: 5회 across 3 파일** (전체 admin/actions/ 에서). 거의 없음.
- 대신 Supabase 의 `{ data, error }` 분기에 100% 의존. `error.message` 만 보고 logger.error + return.
- **약점**:
  - `auth.getUser()` 자체가 throw 하면 (네트워크 에러, 토큰 파싱 에러) 어디서도 catch 안 됨. Next.js 의 error boundary (`error.tsx`) 가 잡지만 그러면 서버 액션이 500 으로 끝나 클라이언트는 `result.error` 가 아닌 throw 를 받음. 클라이언트가 `try/catch` 없이 `await action()` 만 하고 있으면 silent unhandled rejection.
  - `proxy.ts:43` 에 단 한 곳 `try/catch` 가 있음 — Supabase 422 에서 페이지 정상 응답 보장. 이건 모범 사례. 다른 액션에는 이 패턴이 없음.

### 권장

1. **반환 타입 통일 가속화** — 새 액션은 모두 `ActionResult<T>`. 기존 액션도 한 도메인씩 마이그레이션. 점진성을 위해 양 패턴 ESLint rule 추가 검토.
2. **`auth.getUser()` 의 throw case 를 helper 안에서 catch** — `verifyAdmin` 등이 항상 `{ userId } | { error }` 반환을 보장하도록.
3. **클라이언트 사이트의 `try/catch` 부재** — 별개 검토 필요. server action throw 가 클라이언트에서 어떻게 처리되는지 검증.

---

## 9. 테스트 & 품질 보증

### 현재 상태

- **테스트 0건.** `package.json` 에 `test` script 없음. `vitest`/`jest`/`@testing-library` deps 없음.
- **타입 체크 + lint 만**: `npm run type-check`, `npm run lint`.
- **ESLint config**: `eslint-config-next` + `eslint-config-next/typescript` + `_` prefix unused 허용. 표준.
- **마이그레이션 검증**: `npm run db:types`/`db:types:local` 로 타입 재생성하는 워크플로우만.

### 위험도 순 테스트 우선순위

| 영역 | 위험도 | 테스트 난이도 | 권장 우선순위 |
|---|---|---|---|
| `lib/lunch/rotation.ts` | High (사람 줄세우기, 정답 명확) | **Low** (순수 함수) | **★1순위** |
| `lib/bus/realtime-utils.ts` (`applyCheckRecord`, `applyChangeRequest`) | High (realtime 상태 머신) | **Low** (순수 함수) | **★1순위** |
| `lib/lunch/rotation.ts: businessDaysBetween, rotateLeader, rotateClassPair` | High | **Low** | **★1순위** |
| `auth-helpers.ts` (verifyAdmin 등) | High | Medium (Supabase mock 필요) | **★2순위** |
| `homework-unit-actions.ts` 의 status 계산 | High (학생 진도 hot path) | Medium | ★2순위 |
| `report-actions.ts` 의 수동 권한 검증 | High (보안) | Medium | ★2순위 |
| `bus/change-actions.ts` 의 change_type 분기 | Medium | High | ★3순위 |
| Server actions integration (실 DB) | High | Very High | ★4순위 |
| E2E | Medium | Highest | ★5순위 (RoI 낮음) |

### 권장 셋업

1. **`vitest` + 순수 함수 단위 테스트 부터** — `lib/` 안의 utility (lunch rotation, bus realtime apply, date-kst, homework-schedule). 30분 셋업, 100 테스트 가능. 코드 변경 없음.
2. **Supabase local + 마이그레이션 기반 통합 테스트** — `db:types:local` 인프라가 이미 있음. Server action 을 실 DB 에 실행. Effort 큼 but RoI 도 큼.
3. **Playwright E2E** — admin login → reservation 흐름. 우선순위 낮음 (수동 회귀 + 운영 중 발견 가능).

### 가장 위험한 영역

**숙제 도메인** — 최근 30 마이그레이션 중 ~25개. 스키마 변동 시 회귀 발견은 100% 사람이 함. 이 도메인부터 단위 테스트 부터 깔아야 한다.

---

## 10. Next.js 16 / React 19 활용도

### 활용 중

- **Server Components 기본**: `(admin)/admin/layout.tsx:6`, `academy/layout.tsx:6` 모두 async server component. 가장 자연스러운 활용.
- **`React cache()`**: per-request memoization for auth (6회). 명시적이고 옳음.
- **`next/cookies` async**: `server.ts:6` 에서 `await cookies()` — Next.js 16 의 async cookies API 적용.
- **`searchParams` Promise**: `lunch-monitor/page.tsx:8` 에서 `searchParams: Promise<{date?: string}>`, `await searchParams` — Next.js 15+ 패턴 따름.
- **`use server` directive**: 30 파일에서 명시적 선언.
- **Route handler `(admin)/admin/bus/export/route.ts`**: 1건. 엑셀 export 용 GET handler.
- **Image optimization**: `next.config.ts:25` 의 `remotePatterns` — Unsplash + Supabase Storage 도메인. 표준.

### 미활용 (기회)

| 기능 | 활용도 | 적용 후보 |
|---|---|---|
| **PPR (Partial Prerendering)** | 0 | `(site)/` 마케팅 페이지 + admin 페이지의 chrome/content 분리 |
| **`use cache` directive** | 0 | catalog data (series, publishers, textbooks), weekly-sentence |
| **`cacheLife` / `cacheTag`** | 0 | mutation 후 tag-based invalidation — `revalidatePath` 96회를 tag 로 단순화 가능 |
| **`unstable_cache`** | 0 | 짧은 TTL 가능 영역 (dashboard stats 등) |
| **React 19 `use()` hook** | 0 | 클라이언트에서 promise 직접 unwrap. 일부 client component 에서 유용 |
| **React 19 `useActionState` / `useFormStatus`** | grep 으로 확인 필요 | form action 사용처 |
| **React 19 transitions / `useOptimistic`** | 일부 | 출결 토글, 숙제 status toggle 같은 micro-interaction |
| **Server Action progressive enhancement (form action)** | 일부 | `<form action={createNotice}>` 형식 — 일부 사용 중인 듯 (`notice-actions.ts:54` 가 FormData 받음) |

### `"use client"` 분포: 92 파일

- 거의 모든 interactive UI 가 `"use client"` 컴포넌트. 표준적. 분리 boundary 가 잘 그어져 있는 편 — layout / page 는 server, `_components/` 안의 interactive 는 client.

### 권장 우선순위

1. **`'use cache'` 도입** (Next.js 16): `listSeries`, `listPublishers` 같은 카탈로그를 캐싱. `revalidateTag('series')` 로 invalidation. 효과: hot path latency 감소.
2. **PPR on `(site)`**: 마케팅 페이지는 거의 정적이지만 weekly-sentence popup 같은 동적 콘텐츠가 한 컴포넌트. PPR 로 정적 shell + dynamic island 분리 가능.
3. **`useOptimistic`**: 출석 토글, 숙제 status toggle, bus check 같은 빠른 피드백이 필요한 곳.

---

## 11. 위험 & 개선 백로그

### Severity × Effort 매트릭스

| # | 항목 | Severity | Effort | RoI |
|---|---|---|---|---|
| 1 | **테스트 베이스라인**: `lib/lunch/rotation.ts`, `lib/bus/realtime-utils.ts` 순수 함수부터 vitest 도입 | High | Low | **★★★★★** |
| 2 | **`ActionResult<T>` 도입율 7% → 50%+**: 새 액션 + 자주 수정하는 도메인부터 마이그레이션 | Medium | Medium | ★★★★ |
| 3 | **`report-actions.ts` 의 `@auth-skip 3건` 을 `verifyReportCardActor` helper 로 추상화** | High | Medium | ★★★★ |
| 4 | **`bus/change-actions.ts` (765 LOC) 분리** — read / mutation / approval 3 파일 | Medium | Medium | ★★★ |
| 5 | **공지 attachments 와이어링** (`notice-actions.ts:38`) | Low | Medium | ★★★ |
| 6 | **`report-actions.ts` TODO 4건** — `class_teacher_id` 의미 검증 (line 56, 165, 213, 456) | High | Medium | ★★★ |
| 7 | **Admin client import lint rule** — `client.ts` 파일에서 `admin.ts` import 차단 | Low | Low | ★★★ |
| 8 | **logger info-level audit log** — 비번 리셋, 권한 변경 등 민감 mutation 의 성공 로그 | Medium | Low | ★★★ |
| 9 | **`use cache` + `cacheTag`** 도입 in catalog reads | Low | Medium | ★★ |
| 10 | **PPR on `(site)`** 마케팅 페이지 | Low | Medium | ★★ |
| 11 | **`useOptimistic`** for attendance toggle / homework status toggle | Low | Medium | ★★ |
| 12 | **`class-actions.ts` (712 LOC) 분리** 검토 — read/picker/mutation 분리 | Low | Medium | ★★ |
| 13 | **`m/layout.tsx` 와 `admin/layout.tsx` 의 인증 분기 통합** — 같은 `verifyAdmin` helper 사용 | Low | Low | ★★ |
| 14 | **`auth.getUser()` throw 방어 in `verifyAdmin`** — try/catch wrap | Low | Low | ★★ |
| 15 | **외부 logger sink** (Sentry/Datadog) wrapping | Low | Medium | ★★ |
| 16 | **`bus/` 폴더 stub 분량 검토** — `bus/staff-actions.ts` 의 비활성 분량이 작아 OK 지만 번들 영향 측정 가치 | Low | Low | ★ |

### 추가 관찰 (낮은 우선순위)

- **`reservation-actions.ts` (124 LOC, verifyAdmin 2회)** — 학부모 상담 예약이 비인증 제출 가능한지, anti-spam 정책 있는지 별 plan 검증 필요. 만약 학부모가 비인증 제출이면 rate limit, captcha, 또는 simple honeypot 필요.
- **`homework-unit-actions.ts:67` `REVALIDATE_PATHS` 배열** — 4 경로 hardcoded. 패턴은 좋음. 다른 도메인에서도 동일 패턴 표준화 가능 (현재 도메인별로 ad-hoc 호출).
- **`docs/` 가 `HARNESS.md` 1개뿐** — ARCHITECTURE.md 에서 "docs/ — 캐시·SSR·관찰성 패턴 가이드" 라고 명시되어 있으나 실제로 캐시 / SSR / 관찰성 가이드 파일은 없음. `package.json`/`AGENTS.md` 보면 활발히 관리하고 있으나 docs 파일 자체는 부재. CLAUDE.md 의 "캐시/SSR/관찰성 등 패턴 가이드 (있는 것들)" 라는 표현이 정확 — 실제로는 "없음".
- **`scripts/sync-full.sh`, `scripts/sync-no-auth.sh`, `scripts/reset-local-passwords.mjs`** (`package.json:scripts`) — 로컬-원격 DB sync 자동화. 잘 갖춰져 있음.

---

## 부록: 핵심 파일 레퍼런스

| 파일 | 라인 | 발견 |
|---|---|---|
| `src/app/(admin)/admin/actions/auth-helpers.ts` | :14, :46, :68 | 3 verify helpers + React cache. 모범적 |
| `src/lib/supabase/admin.ts` | :8 | service role + persistSession false. 옳음 |
| `src/lib/supabase/AGENTS.md` | 전체 | 3 client 패턴 + admin import 금지 정책 |
| `src/app/(admin)/admin/actions/AGENTS.md` | 전체 | mutation 가드 + `@auth-skip` 컨벤션 |
| `src/lib/types/server-action.ts` | :25 | `ActionResult<T>` 표준 정의. 도입율 ~7% |
| `src/app/(admin)/admin/actions/bus/change-actions.ts` | 765 LOC | 분리 1순위 후보 |
| `src/app/(admin)/admin/actions/class-actions.ts` | 712 LOC | 분리 2순위 후보 |
| `src/app/(admin)/admin/actions/report-actions.ts` | :56, :92, :189, :241 | `@auth-skip` 3건 + TODO 4건 |
| `src/lib/lunch/rotation.ts` | :54, :70, :75 | 순수 함수 — 테스트 1순위 |
| `src/lib/bus/realtime-utils.ts` | :34, :52 | applyCheckRecord/applyChangeRequest — 테스트 1순위 |
| `src/lib/hooks/use-bus-realtime.ts` | :30 | StrictMode workaround. 좋은 deep-debug 흔적 |
| `src/proxy.ts` | :12, :40 | 모바일 UA redirect + try/catch wrap |
| `src/app/(admin)/admin/actions/notice-actions.ts` | :38 | attachments 하드코딩 빈 배열 |
| `src/app/(admin)/admin/actions/lunch-actions.ts` | :87 | `@auth-skip` for TV monitor 공유 |
| `src/app/academy/actions.ts` | :7~285 | academy actions 단일 파일 (286 LOC). 잘 응집 |
| `package.json` | :5~16 | `test` script 부재 |
| `next.config.ts` | :24 | LAN dev origin 자동 등록 — 좋은 dev DX |

---

## 종합 의견 (architect's note)

이 코드베이스는 **"의도 있는 단순함"** 의 좋은 예다. 무거운 자동화 / 추상화를 거부하고 (`HARNESS.md:38` 이 의도적으로 이전 하네스를 통째로 제거한 기록), 도메인 1개 = 파일 1개라는 단순 규칙을 일관되게 적용한다. 인증 boundary 3 종은 명확하고, `createAdminClient` 의 산재는 정책 (PR 리뷰 + grep) 으로 관리한다. 점진적 마이그레이션 (`bus-actions.ts` → `bus/` 폴더, `ActionResult<T>` 정의 후 신규 액션부터 도입) 도 실행 중이다.

**가장 큰 단일 위험은 테스트 부재.** 학원 운영 SaaS 라는 도메인 특성 — 출결/숙제/버스/리포트는 한번 만들어지면 수년간 유지되며 학원 운영자가 매일 의존. 1주일 운영 데이터 손상은 비즈니스 영향이 크다. 376개 서버 액션을 사람이 매번 회귀 테스트하는 것은 지속 불가능. **`vitest` + `lib/` 순수 함수 단위 테스트는 1-2 일 작업이고 즉시 가치**.

**두 번째 위험은 `ActionResult<T>` 마이그레이션 정체**. 표준이 정의된 채로 ~93% 액션이 레거시 패턴이면 표준이 의미를 잃는다. 신규 액션에만 적용해도 ~1년이면 자연 마이그레이션되지만, 호출 사이트 클라이언트의 분기 로직 일관성이 그때까지 흔들린다.

**칭찬할 만한 곳:**
- `verifyAdmin` 의 `React cache()` 사용 — 명시적이고 옳다.
- `bus/` 도메인 폴더 분리 + 원본 파일을 re-export 로 유지 — 호출 사이트 안정성 + 인지 부담 분산 둘 다 달성.
- `lib/bus/realtime-utils.ts` 의 순수 함수 분리 + `use-bus-realtime.ts:30` 의 StrictMode workaround 주석 — 도메인 전문성 + 운영 흔적이 코드에 남아있다.
- `lib/lunch/rotation.ts` 의 anchor 방식 — 영업일 기반 회전 + 임의 시점 override 라는 학원 운영의 실제 요구를 순수 함수로 추상화. 가장 잘 설계된 모듈 중 하나.
