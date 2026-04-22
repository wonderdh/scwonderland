# Bus 도메인 리팩토링 로드맵

> 2026-04-22 코드 리뷰 후속. retro churn hotspot 1위(`bus-actions.ts` 2,679 LoC · 41회 수정 · 6회 fix)의 근본 원인 진단과 2단계 리팩토링 계획.

## 현재 구조 요약

**총 규모:** 10,911 LoC (22 files). 라인 수 기준 `bus-actions.ts` 2,679줄 단일 파일이 전체의 25%.

**파일·모듈 지도:**

| 관심사 | 위치 | LoC |
|---|---|---|
| **Server Actions (단일)** | `src/app/(admin)/admin/actions/bus-actions.ts` | 2,679 |
| **관리자 UI — 오늘 운행** | `admin/bus/components/BusDashboard.tsx` (+ `BusOverviewPanel`, `DropoffOverviewPanel`, `BusMonitoringDashboard`) | 655 + 271 + 370 + 195 |
| **관리자 UI — 변경요청** | `admin/bus/components/BusChangeRequestsPanel.tsx` + `AdminBusChangeDnD.tsx` | 502 + 579 |
| **관리자 UI — 배정관리** | `BusStudentAssignmentManager.tsx` + `BusStopAssignmentManager.tsx` + `BusNumbersManager.tsx` | 738 + 812 + 855 |
| **관리자 UI — 마스터** | `BusManagePanel.tsx` + `BusTimeSlotsManager.tsx` + `BusStaffManager.tsx` + `BusAssignmentManager.tsx` | 368 + 229 + 262 + 448 |
| **기사 앱** | `src/app/(bus)/bus/components/BusStaffMonitor.tsx` (+ `actions.ts`) | 721 |
| **모니터 화면** | `src/app/(monitor)/bus-monitor/BusMonitorClient.tsx` | 337 |
| **학생/교사 UI** | `academy/student/bus/StudentBusClient.tsx` + `academy/teacher/bus/.../TeacherBusClient.tsx` | 364 + 133 |
| **공유 컴포넌트** | `src/components/bus/MonitorBusCard.tsx` + `DailyBusChanges.tsx` | 402 + 128 |
| **도메인 유틸** | `src/lib/bus/utils.ts` + `realtime-utils.ts` + `afterschool-sync.ts` | 68 + 101 + 26 |
| **타입** | `src/lib/types/database.ts` (Row), `api.ts` (조인), `constants/bus.ts` (UI config) | — |
| **Realtime hook** | `src/lib/hooks/use-bus-realtime.ts` | 67 |

**Server Action이 섞여 있는 관심사 (bus-actions.ts 단일 파일 내부):** ① 호차 CRUD · ② 시간대 CRUD · ③ 정류장 CRUD · ④ 정류장-호차 요일·시간대 매핑 · ⑤ 정류장 스케줄 · ⑥ 학생 기본 배정 · ⑦ 당일 매니페스트 조회 (480줄 짜리 단일 함수) · ⑧ 탑승/하차 체크 (개별/배치) · ⑨ 변경요청 CRUD (학생·관리자) · ⑩ 승인·거절 워크플로 · ⑪ 직원 관리 · ⑫ 학생 조회 · ⑬ Excel export · ⑭ 다중 날짜 bulk 변경.

**페이지-액션 연결:** 5개 페이지(`/admin/bus`, `/bus`, `/bus-monitor`, `/academy/student/bus`, `/academy/teacher/bus`) + `reservations`·`students/.../StudentBusTab`이 모두 `admin/actions.ts` 배럴을 통해 `bus-actions.ts`의 50여 함수에 교차 의존. 변경요청 한 건을 수정하면 최소 4개 화면이 리렌더되어야 함.

---

## 진단 — 재작업이 잦은 근본 원인 TOP 3

### 1. `bus-actions.ts` 2,679줄 단일 파일이 경계 없는 도메인 전체를 담고 있음

retro에서 41회 수정·6회 fix로 1위. 원인은 명확:

- **함수 50개 · 14개 관심사가 섞여있어** 호차 라벨 하나 추가할 때 방과후 매니페스트 로직도 같은 파일에서 충돌.
- **`getDailyBusManifest`가 419→899까지 480줄.** Phase 1 (4병렬) → Phase 2 (7병렬) → change 적용 → extra_stops 보강 → sort → group — 한 함수에 전부. 읽기 액션인데도 fix 다수.
- **`bus-change-actions.ts` 같은 분할 파일은 존재하지 않음** — 문서(`routes/admin-bus.md`)는 "bus-actions vs bus-change-actions 분리 기준"을 언급하지만 실제 코드엔 없음. 즉 의도한 분리가 실현되지 않은 상태.
- **배럴 `admin/actions.ts` 136~219행까지 bus 관련 80개 이상 재수출** — bus 단일 도메인이 배럴 슬롯의 40% 이상 점유.

### 2. 상태 머신(승하차·변경요청)이 타입 수준 union 리터럴로 흩뿌려져 있음

`"change" | "no_ride" | "absent"` 리터럴이 **10개 이상 파일에 인라인 중복**:
- `bus-actions.ts` 1502, 1616(학생은 "change"|"no_ride"만!), 1675, 1735, 1804, 1820, 2628
- `AdminBusChangeDnD.tsx:237`, `BusChangeRequestsPanel.tsx:103`, `StudentBusClient.tsx:50,266`, `api.ts:331`, `constants/bus.ts:15`, `ReservationDashboard.tsx:402`
- `DailyBusChanges.tsx:9-13` — `BUS_CHANGE_TYPE_CONFIG`와 **별개의** `CHANGE_TYPE_CONFIG`를 재정의 (label이 "픽업" vs 정본 "미탑승"으로 불일치)
- `StudentBusClient.tsx:24-29` — `STATUS_LABEL`, `STATUS_COLOR` 로컬 재정의, `BUS_REQUEST_STATUS_CONFIG`(`constants/bus.ts`)와 포맷 불일치

상태 머신 자체도 암묵적 — `BusManifestEntry`의 `is_changed: boolean` · `is_absent?: boolean` · `boarded_at` · `checked_at`의 조합으로 "미탑승·탑승대기·탑승·하차대기·하차·결석·픽업변경" 7개 상태를 표현. 상태 전이 규칙은 `BusStaffMonitor.tsx#toggleBoard/Check/Uncheck` (91줄)와 `realtime-utils.ts#applyCheckRecord/applyChangeRequest`에 이원화. `MonitorBusCard`·`StudentBusClient`·`TeacherBusClient`는 각자 다른 부분집합만 읽어서 렌더.

→ **fix: 6건이 정확히 이 상태 해석 불일치에서 나옴** (absent를 noRide로 오분류, is_absent 플래그 누락 등).

### 3. Client 훅 패턴 5군데 복붙 + 인증 계층 이중화 혼란

**동일 패턴 5회 복붙 (`date` + `useBusRealtime` + `getDailyBusManifest` + filter):**
- `BusStaffMonitor.tsx:349-533` (pending changes + batch save)
- `BusDashboard.tsx:60-104` (debounced refetch)
- `BusMonitoringDashboard.tsx:22-56` (versionRef race-guard)
- `BusMonitorClient.tsx:48-138` (loadIdRef race-guard, DOM 구조 다름)
- `TeacherBusClient.tsx:17-35` (realtime 미사용, 단순 refetch)

각자 다른 race-guard 패턴(`loadIdRef` vs `loadVersionRef` vs `debouncedLoad`), 다른 KST 변환 (5군데 모두 `new Date().getFullYear()...` 인라인, `todayKst()` 미사용 — `rules/patterns.md` 규칙 위반). `realtime` 콜백 정책도 파일마다 다름 (BusDashboard는 전체 refetch, BusStaffMonitor는 pendingChanges 있으면 무시, Monitoring은 `applyChangeRequest` 낙관 적용).

**인증 계층 이중화 + 누락:**
- `bus-actions.ts:286 getStudentBusDefaults` — **auth 없음** (학생 profile_id만 알면 조회 가능)
- `bus-actions.ts:1572 getStudentChangeRequests` — **auth 없음**
- `bus-actions.ts:419 getDailyBusManifest` — **auth 없음** (단, `/bus-monitor`가 비인증 화면이라 의도적)
- `submitBusChangeRequest`·`cancelBusChangeRequest`는 2026-04-22 세션에서 `studentProfileId === auth.userId` 패치됨 (H1 해결)
- RLS Phase 4가 2026-04-20에 들어갔으나 모든 mutating 함수가 `createAdminClient()`로 RLS 우회 → RLS는 JWT 직접 접근 경로용 백업일 뿐 → `verify*` 누락 시 0 층 방어. 이게 retro `fix:` 6건 중 최소 1건(H1)의 직접 원인.

---

## Phase 1 (1~2일) — 타입·상태 머신 통합 (zero UI churn)

목표: 파일 이동·삭제·UI 변경 없음. 타입/상수/경계만 손봐서 이후 Phase 2가 안전하게 돌아갈 레일을 깔기.

### 1-A. 상태 머신 단일 소스화 (4시간)

**새 파일:** `src/lib/bus/state.ts` (신규 생성 · 약 80줄)

- `BUS_CHANGE_TYPES = ["change", "no_ride", "absent"] as const` + `export type BusChangeType = (typeof BUS_CHANGE_TYPES)[number]`
- `STUDENT_SUBMITTABLE_CHANGE_TYPES = ["change", "no_ride"] as const` — 학생이 직접 제출 가능한 타입 (absent 제외)
- `BUS_REQUEST_STATUSES = ["pending", "approved", "rejected"] as const` + 타입
- `type BusBoardingState = "not_boarded" | "boarded" | "checked" | "absent" | "no_ride"` — 좌석 상태 파생 함수 `deriveBoardingState(entry: BusManifestEntry): BusBoardingState` 1개로 응집. 7개 분기가 한 곳에.

**수정 작업:**
- `src/lib/types/api.ts:331, 336` — 리터럴을 `BusChangeType`·`BusRequestStatus`로 교체
- `src/lib/constants/bus.ts:4, 15` — `Record<"change"|"no_ride"|"absent", ...>` → `Record<BusChangeType, ...>`
- `bus-actions.ts` 내 7곳 인라인 union (1502, 1616, 1675, 1735, 1804, 1820, 2628) → `BusChangeType` import. 1616 `submitBusChangeRequest`는 `(typeof STUDENT_SUBMITTABLE_CHANGE_TYPES)[number]`로 좁혀서 "학생은 absent 제출 불가"를 타입으로 강제
- `AdminBusChangeDnD.tsx:237`·`BusChangeRequestsPanel.tsx:103`·`StudentBusClient.tsx:50, 266` — 동일 교체
- `DailyBusChanges.tsx:9-13` — 로컬 `CHANGE_TYPE_CONFIG` 삭제, `BUS_CHANGE_TYPE_CONFIG` import. "픽업" 라벨 불일치 버그 자연 해결
- `StudentBusClient.tsx:24-29` — 로컬 `STATUS_LABEL`·`STATUS_COLOR` 삭제, `BUS_REQUEST_STATUS_CONFIG` import

### 1-B. `bus-actions.ts`를 5개 파일로 분할 (4시간, pure refactor)

**새 폴더:** `src/app/(admin)/admin/actions/bus/` (배럴 `admin/actions.ts`는 수정 없이 내부 import 경로만 바뀜)

| 새 파일 | 옮겨갈 함수 (현재 bus-actions.ts 라인) |
|---|---|
| `bus/master-actions.ts` | `listBusNumbers` (28) · `createBusNumber` (44) · `updateBusNumber` (66) · `deleteBusNumber` (88) · `listBusTimeSlots` (105) · `createBusTimeSlot` (213) · `updateBusTimeSlot` (237) · `deleteBusTimeSlot` (269) · `listBusStops` (1843) · `createBusStop` (1860) · `updateBusStop` (1996) · `deleteBusStop` (2018) · `listBusStopDayAssignments` (1892) · `saveBusStopDayAssignments` (1914) · `listBusStopSchedulesBulk` (1961) · `listBusStopSchedules` (2201) · `upsertBusStopSchedule` (2222) · `deleteBusStopSchedule` (2252) · `copyBusDayDataToOtherDays` (2280) · `getBusDayDataCounts` (2390) |
| `bus/assignment-actions.ts` | `getStudentBusDefaults` (286) · `upsertStudentBusDefault` (356) · `deleteStudentBusDefault` (386) · `deleteStudentBusDefaults` (401) · `saveBulkBusDefaults` (2067) · `getBulkBusDefaults` (2136) · `listAllActiveStudentNames` (119) |
| `bus/manifest-actions.ts` | `getDailyBusManifest` (419, 480줄) + 내부 헬퍼 `buildStopToBusMaps` 함께 |
| `bus/board-actions.ts` | `boardBusStudent` (899) · `unboardBusStudent` (926) · `checkBusStudent` (971) · `uncheckBusStudent` (1000) · `batchBusCheckRecord` (1044) |
| `bus/change-actions.ts` | `listAllChangeRequests` (1163) · `listChangeRequestsByDate` (1335) · `listPendingChangeRequests` (1493) · `approveChangeRequest` (1498) · `rejectChangeRequest` (1546) · `getStudentChangeRequests` (1572) · `submitBusChangeRequest` (1613) · `cancelBusChangeRequest` (1646) · `createAdminBusChange` (1672) · `updateAdminBusChange` (1733) · `getExistingBusChange` (1799) · `deleteAdminBusChange` (1823) · `bulkCreateBusChanges` (2625) |
| `bus/staff-actions.ts` | `createBusStaff` · `listBusStaff` · `updateBusStaff` + `getWeeklyDropoffExportData` (2438, assignment로 이동해도 OK) |

**실행 방법:** `bus-actions.ts`를 순수 barrel (`export * from "./bus/master-actions"` 등)로 전환 → 기존 `admin/actions.ts:181 from "./actions/bus-actions"` 경로가 깨지지 않음. 각 새 파일은 자기 도메인 타입만 import → `import * as Bus from "@/lib/types"` 난립 제거.

### 1-C. Auth 구멍 메우기 (30분)

- `bus/assignment-actions.ts#getStudentBusDefaults` — `verifyAuthenticated()` + `(studentProfileId === auth.userId || await isAdminOrTeacher(auth.userId))` 분기 추가
- `bus/change-actions.ts#getStudentChangeRequests` — 동일 패턴
- `bus/manifest-actions.ts#getDailyBusManifest` — 의도적으로 public 유지 (`/bus-monitor` 전체 화면 TV용). 단, JSDoc에 "public by design" 명시 + `logger.debug` 로 호출 횟수 카운팅

### 1-D. KST 헬퍼 강제화 (30분)

- 5개 파일(`BusStaffMonitor.tsx:19`, `BusDashboard.tsx:62`, `BusMonitoringDashboard.tsx:23`, `AdminBusChangeDnD.tsx:50`, `TeacherBusClient.tsx:19`, `DailyBusChanges.tsx:26-29`)에서 인라인 `new Date().getFullYear()...` 패턴 → `todayKst()`로 교체
- `BusMonitorClient.tsx`의 `getDateForIsoDay`·`getTodayIsoDay`는 logic이 달라서 유지하되 `src/lib/bus/date.ts`로 추출 (50줄) — Phase 2에서 hook이 재사용

### 1-E. 한 번 돌릴 자동 체크

- `tsc --noEmit` 통과 확인 (타입 narrowing 누락 잡기)
- `ESLint no-restricted-syntax` 룰 추가로 `"change" | "no_ride"` 리터럴 사용을 프로젝트 전체에서 금지 (state.ts 내부만 allow)

**Phase 1 산출물:** 코드 이동만, 런타임 동작 변화 0. retro churn 1위 파일이 사라지고 500줄×5 파일로 바뀜. 상태 머신 소스 1개. auth 구멍 3개 막힘.

---

## Phase 2 (2~3일) — Hook·UI 추출

목표: 5군데 복붙된 클라이언트 데이터 로드/실시간 패턴을 1~2개 훅으로 응집하고, MonitorBusCard 계열 분기를 컴포넌트 경계에서 깔끔하게 정리.

### 2-A. `useBusManifest` 훅 통합 (6시간)

**새 파일:** `src/lib/hooks/use-bus-manifest.ts`

```
useBusManifest({
  date: string,
  filter?: { busNumberId?: string; slotId?: string },
  mode: "poll" | "realtime-refetch" | "realtime-patch",
  onConflict?: () => boolean,  // pendingChanges 있으면 true 반환해서 patch 스킵
})
→ { groups, noRides, afterschoolStudents, loading, reload }
```

내부에 race-guard(`versionRef`), realtime 구독(`useBusRealtime`), debounce(500ms), `applyCheckRecord`/`applyChangeRequest` 분기 다 들어감. 3가지 `mode`로 현재 5개 호출부의 차이를 포괄:

- `BusStaffMonitor.tsx:358-533` → `mode: "realtime-patch"`, `onConflict: () => pendingChanges.size > 0`. 185줄 로직이 ~30줄로 축소
- `BusDashboard.tsx:80-103` → `mode: "realtime-refetch"`. `debouncedLoad` 제거
- `BusMonitoringDashboard.tsx:28-56` → `mode: "realtime-patch"`. `loadVersionRef` 제거
- `BusMonitorClient.tsx:64-138` → `mode: "realtime-patch"` + 다중 slot 필터는 컴포넌트 레벨에서 처리
- `TeacherBusClient.tsx:25-35` → `mode: "poll"` (realtime 구독 안 함)

**테스트:** Phase 2 시작 전 Vitest 세팅. 훅 단위테스트로 race condition 재현 → 4월 3개 fix 회귀 방지.

### 2-B. 공용 StudentRow/StopGroup 추출 (4시간)

현재:
- `BusStaffMonitor.tsx#StudentRow` (72-219, 탑승/하차 버튼 포함)
- `BusStaffMonitor.tsx#groupStudentsByStop` (40-70, `note` 기준 — 버그! 정류장 변경이 반영 안 됨)
- `bus/utils.ts#groupStudentsByStop` (15-57, `bus_stop_sort_order` 기준 — 정식)
- `MonitorBusCard.tsx#mergeStopGroups` (8-41, extra_stops 병합)

**수정:**
- `BusStaffMonitor.tsx:40-70` 로컬 `groupStudentsByStop` **삭제**, `lib/bus/utils.ts`의 것 사용. 기사 앱의 정류장 그룹핑 미스매치 버그 해결 (retro fix 3건 중 1건 원인)
- `BusStaffMonitor.tsx#StudentRow` (72-219) → `src/components/bus/BusStaffStudentRow.tsx`로 이동. `deriveBoardingState` (1-A 산출물) 사용 → 7가지 UI 분기가 switch 1개로 정리
- `MonitorBusCard.tsx`는 유지하되 `deriveBoardingState` 공유

### 2-C. AdminBusChangeDnD / BusChangeRequestsPanel 폼 상태 추출 (4시간)

두 컴포넌트가 거의 같은 폼 상태(`editSlotId`, `editBusId`, `editStopId`, `editNote`, `stopMode`) 중복. 579줄 + 502줄 중 200줄이 중복 패턴.

**새 파일:** `src/app/(admin)/admin/bus/components/_shared/useBusChangeForm.ts` (hook)
- 폼 상태 + validation + `createAdminBusChange`/`updateAdminBusChange`/`approveChangeRequest` 호출 분기 응집
- 두 컴포넌트가 consume. 각 100~150줄 축소 예상

### 2-D. 문서 동기화 (1시간)

- `.claude/routes/admin-bus.md:27-107` — 함수 목록의 "bus-actions.ts (가장 큰 액션 파일, ~1800줄)" 섹션을 5개 파일별 테이블로 교체
- `.claude/rules/server-actions.md:153-179` — bus-actions.ts 섹션을 bus/ 서브폴더 5파일로 재작성
- `.claude/routes/bus-staff.md:21-33` — `BusStaffMonitor.tsx` 크기 변경 반영
- `docs/review-2026-04-22/05-summary.md` M-09 항목 → "완료" 표시

### 2-E. 리그레션 스모크 테스트 세트 (2시간)

1. `__tests__/bus/manifest.integration.test.ts` — `getDailyBusManifest` 해피패스 + change/absent/no_ride 반영 + extra_stops + 방과후
2. `__tests__/bus/state.test.ts` — `deriveBoardingState` 모든 분기, `applyCheckRecord` INSERT/UPDATE/DELETE, `applyChangeRequest` absent/no_ride/change
3. `__tests__/bus/auth.test.ts` — `submitBusChangeRequest`·`cancelBusChangeRequest`·`getStudentBusDefaults`·`getStudentChangeRequests` 각각 본인/타인/비인증 3가지 케이스

---

## 위험요소

1. **기사 앱 다운타임 = 학원 운영 중단.** `BusStaffMonitor.tsx` 수정은 하원 시간(15~18시) 피해서 릴리즈. Vercel preview URL로 stage 검증 필수. 로컬 에뮬로는 안 됨 (Realtime은 live Supabase 필요)

2. **`getDailyBusManifest` 480줄 함수는 만지면 거의 모든 화면이 깨짐.** Phase 1에서는 **파일 이동만** (같은 모듈로), 로직 변경은 Phase 2+ 별도 PR. 이 함수는 `is_active`·`show_empty_stops`·`extra_stops` 분기가 암묵적 spec이라 유닛 테스트 선행 후 리팩

3. **배럴 재수출 순서 깨짐.** `admin/actions.ts`는 `bus-actions.ts`에서 80개 이상 re-export. 파일 분할 후 `export * from "./bus/..."` 방식으로 이전할 때 **동명이인 export 충돌** 가능. Phase 1-B 시작 전에 `grep -rn "from.*admin/actions\""`로 소비자 맵 먼저 확보

4. **RLS Phase 4가 2026-04-20에 들어간 직후라 RLS ↔ `verify*` 누락 조합의 side-effect 미검증.** 1-C에서 `getStudentBusDefaults`에 auth 추가하면 `createClient()` (JWT) 경로로 호출하던 기존 코드가 RLS에 걸려 빈 배열 받을 수 있음. 모든 호출부 검사:
   - `StudentBusClient.tsx:59` — server action 경유, `createAdminClient` 사용 → OK
   - `admin/students/.../StudentBusTab.tsx` — 동일
   - 외부 경로 없음 확인 (grep "getStudentBusDefaults" 5 hits 모두 내부)

5. **Realtime 채널 이름 충돌.** `useBusRealtime`가 `bus-checks-${date}` 채널을 쓰는데, 한 페이지에서 5개 컴포넌트가 동일 `date`로 구독하면 이미 동시 구독 중(BusDashboard + DailyBusChanges가 `/admin/bus` 탭에 공존). Phase 2-A 훅 통합 시 **부모에서 한 번만 구독 + context로 내려주기** 고려. 현재는 각자 구독 중이라 Supabase 연결 수가 페이지당 5개

6. **`getDateForIsoDay` vs `todayKst` 의미 차이.** `BusMonitorClient`는 이번 주 요일별 날짜를 계산(`getDateForIsoDay`) — 주말에 월요일 매니페스트를 미리보기 위함. Phase 1-D에서 무지성으로 `todayKst`로 바꾸면 월요일 프리뷰 기능이 깨짐. 이 파일은 유지 + `lib/bus/date.ts`로 추출만

7. **상태 전이 테스트 부재 상태에서 7개 상태 switch 도입.** `deriveBoardingState` 작성 시 기존 UI(`StudentRow`·`MonitorBusCard`)의 분기 테이블을 먼저 주석으로 뽑아 1:1 대응 확인 후 구현

---

## 검증 계획

### 코드 레벨

- `npm run build` 통과 (Phase 1 후, Phase 2 후)
- `tsc --noEmit` 통과
- ESLint `no-restricted-syntax` 룰로 `"change"|"no_ride"` 인라인 union 사용 0건 확인
- `grep -rn "new Date().getFullYear" src/` → 0 (KST 헬퍼 강제화 확인)
- `grep -rn "from.*bus-actions" src/` → 0 (배럴 경유 확인)
- Vitest — Phase 2-E의 3개 테스트 파일 pass

### E2E 시나리오 (수동, stage 배포 후)

각 Phase 후 아래 6개 플로우를 KST 15:00에 실행:

1. **학생 변경 제출 → 관리자 승인 → 기사 앱 갱신.** 학생 포털 `/academy/student/bus`에서 금요일 "change" 요청 제출 → 관리자 `/admin/bus?tab=requests`에서 승인 → 기사 앱 `/bus`에서 변경 학생이 is_changed 배지로 표시
2. **결석 연동.** 관리자가 `/admin/reservations`에서 attendance 결석 예약 → `bus_change_requests.change_type='absent'` 자동 생성 → `/bus-monitor`에 주황 ✕ 배지 표시
3. **일괄 탑승.** 기사 앱에서 15명 체크 → "확인" → 낙관적 UI 즉시 → batchBusCheckRecord 성공 → 모니터 화면이 500ms 내 동기화
4. **빈 정류장(`show_empty_stops`) 오후반 16:20 슬롯.** 학생 0명인 정류장이 모니터에 "배정 학생 없음" 플레이스홀더로 표시
5. **IDOR 가드.** 브라우저 DevTools에서 다른 학생 profile_id로 server action 직접 호출 → "본인 요청만..." 에러 반환 확인
6. **요일별 정류장 배정 복사.** `copyBusDayDataToOtherDays` → 주중 전체 학생 매니페스트 일관성 확인

### 퍼포먼스 게이트

- `/bus-monitor` 초기 로드 TTI < 2s (리팩토링 전 베이스라인 기록 후 비교)
- `getDailyBusManifest` 쿼리 수 — Phase 2-A 훅 통합 후 같은 페이지에서 5 → 1 (중복 구독 제거 시)

### Rollback 지점

- **Phase 1-B 이후** 2일 관찰. 문제 발생 시 `bus-actions.ts`를 git revert 1개 커밋으로 원복 가능
- **Phase 2-A 이후** 기사 앱·모니터 화면 각각 1주 관찰 후 다음 단계
- 각 Phase 독립 PR로 land

---

### Critical Files for Implementation

- `src/app/(admin)/admin/actions/bus-actions.ts` (분할 대상, 2679 LoC)
- `src/lib/bus/state.ts` (신규, 상태 머신 단일 소스)
- `src/lib/hooks/use-bus-manifest.ts` (신규, Phase 2 핵심 훅)
- `src/app/(bus)/bus/components/BusStaffMonitor.tsx` (721 LoC, 훅 통합 최대 수혜자)
- `src/lib/types/api.ts` (타입 정의 + 유니온 리터럴 단일화 지점)
