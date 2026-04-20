# Admin Bus (승하차 관리)

## 라우트 경로
- URL: `/admin/bus`
- 라우트 그룹: `(admin)`
- 탭 기반: `?tab=today|requests|assignment|master` (4개 탭, legacy tab IDs backwards-compatible)

## 핵심 파일
- page.tsx: `src/app/(admin)/admin/bus/page.tsx`

## 컴포넌트
| 파일 | 역할 |
|------|------|
| `bus/components/BusTabNav.tsx` | 4개 탭 네비게이션 (오늘운행/변경요청/배정관리/마스터) — 내부적으로 오늘운행=overview+dashboard, 배정관리=학생+정류장, 마스터=호차+시간대+직원 접힘 카드 |
| `bus/components/BusOverviewPanel.tsx` | 전체 현황 패널 (호차별 학생 배정 요약) |
| `bus/components/BusDashboard.tsx` | 실시간 대시보드 (당일 승하차 매니페스트, 탑승/확인 체크) |
| `bus/components/BusChangeRequestsPanel.tsx` | 학생/학부모 변경 요청 승인/거절 관리 |
| `bus/components/BusStudentAssignmentManager.tsx` | 학생별 버스 기본 배정 관리 (요일별 호차/정류장/시간대) |
| `bus/components/BusStopAssignmentManager.tsx` | 정류장 → 호차 배정 관리 (요일/시간대별) |
| `bus/components/BusManagePanel.tsx` | 호차 CRUD + 정류장 CRUD |
| `bus/components/BusTimeSlotsManager.tsx` | 버스 시간대 CRUD (하원). **학생 없어도 정류장 표시** 체크박스(`show_empty_stops`)로 해당 시간대에서 모니터가 배정 학생이 없는 정류장·호차 카드도 노출하도록 설정 — 오후반(16:20, 17:45 등)용 |
| `bus/components/BusStaffManager.tsx` | 버스 직원 관리 (기사, 보조교사 계정 생성/관리) |
| `bus/components/BusNumbersManager.tsx` | 마스터 탭 호차/정류장 관리 — 요일·시간대별 호차↔정류장 드래그 배정, 정류장별 도착시간 입력, **다른 요일에 복사** 모달(요일×시간대 단위 일괄 덮어쓰기, `copyBusDayDataToOtherDays` 사용) |
| `bus/components/BusAssignmentManager.tsx` | (레거시 또는 하위 컴포넌트) |
| `bus/components/BusMonitoringDashboard.tsx` | (실시간 모니터링 대시보드, 하위 컴포넌트) |

## Server Actions

### bus-actions.ts (가장 큰 액션 파일, ~1800줄)

#### 호차 CRUD
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `listBusNumbers` | (없음) | `bus_numbers` |
| `createBusNumber` | label | `bus_numbers` |
| `updateBusNumber` | id, label | `bus_numbers` |
| `deleteBusNumber` | id | `bus_numbers` (soft delete: is_active=false) |

#### 버스 시간대 CRUD
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `listBusTimeSlots` | (없음) | `bus_time_slots` |
| `createBusTimeSlot` | label, time, showEmptyStops? | `bus_time_slots` |
| `updateBusTimeSlot` | id, label, time, showEmptyStops? | `bus_time_slots` |
| `deleteBusTimeSlot` | id | `bus_time_slots` (soft delete: is_active=false) |

#### 학생 기본 배정
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `getStudentBusDefaults` | studentProfileId | `student_bus_defaults`, `bus_time_slots`, `bus_stops`, `bus_stop_day_assignments` |
| `upsertStudentBusDefault` | studentProfileId, day, timeSlotId, stopId? | `student_bus_defaults` |
| `deleteStudentBusDefault` | id | `student_bus_defaults` |
| `deleteStudentBusDefaults` | ids[] | `student_bus_defaults` |
| `saveBulkBusDefaults` | updates[{studentProfileId, day, timeSlotId, stopId?}] | `student_bus_defaults`, `bus_stop_day_assignments` |
| `getBulkBusDefaults` | (없음) | `student_bus_defaults`, `students`, `bus_time_slots`, `bus_stops`, `bus_stop_day_assignments` |

#### 당일 매니페스트
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `getDailyBusManifest` | date, busTimeSlotId? | `student_bus_defaults`, `bus_change_requests`, `students`, `bus_stops`, `bus_stop_day_assignments`, `bus_daily_records` |
| `boardBusStudent` | manifestEntryId(studentProfileId), date, busNumberId, timeSlotId? | `bus_daily_records` |
| `unboardBusStudent` | studentProfileId, date, timeSlotId? | `bus_daily_records` |
| `checkBusStudent` | studentProfileId, date, timeSlotId? | `bus_daily_records` |
| `uncheckBusStudent` | studentProfileId, date, timeSlotId? | `bus_daily_records` |

#### 변경 요청
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `listAllChangeRequests` | (없음) | `bus_change_requests`, `students`, `bus_numbers`, `bus_time_slots`, `bus_stops` |
| `listPendingChangeRequests` | (없음) | `bus_change_requests` (pending only) |
| `approveChangeRequest` | requestId, adminId | `bus_change_requests`, `student_bus_defaults` |
| `rejectChangeRequest` | requestId, adminId, reason? | `bus_change_requests` |
| `getStudentChangeRequests` | studentProfileId | `bus_change_requests`, `bus_numbers`, `bus_time_slots`, `bus_stops` |
| `submitBusChangeRequest` | studentProfileId, day, timeSlotId, stopId?, reason? | `bus_change_requests` |
| `cancelBusChangeRequest` | requestId | `bus_change_requests` |
| `createAdminBusChange` | studentProfileId, day, timeSlotId, stopId?, reason? | `bus_change_requests`, `student_bus_defaults` |
| `updateAdminBusChange` | requestId, day?, timeSlotId?, stopId?, reason? | `bus_change_requests` |
| `getExistingBusChange` | studentProfileId, date, timeSlotId? | `bus_change_requests` |
| `deleteAdminBusChange` | requestId | `bus_change_requests` |

#### 정류장 관리
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `listBusStops` | (없음) | `bus_stops` |
| `createBusStop` | name, busNumberId | `bus_stops` |
| `updateBusStop` | id, name | `bus_stops` |
| `deleteBusStop` | id | `bus_stops` (soft delete: is_active=false) |
| `listBusStopDayAssignments` | busStopId | `bus_stop_day_assignments` |
| `saveBusStopDayAssignments` | busStopId, assignments[{day, busNumberId, timeSlotId?}] | `bus_stop_day_assignments` |
| `listBusStopSchedulesBulk` | (없음) | `bus_stop_schedules` |
| `listBusStopSchedules` | busStopId | `bus_stop_schedules` |
| `upsertBusStopSchedule` | busStopId, time | `bus_stop_schedules` |
| `deleteBusStopSchedule` | id | `bus_stop_schedules` |
| `copyBusDayDataToOtherDays` | sourceDay, targetDays[], slotId? | `bus_stop_day_assignments` + `bus_stop_schedules` (대상 요일 기존 데이터 삭제 후 원본 복사) |
| `getBusDayDataCounts` | slotId? | (read) 월~금 요일별 기존 행 수 — 복사 모달 충돌 미리보기 |

#### 직원 관리
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `createBusStaff` | FormData(email, password, name, role, bus_number_id?) | `auth.users`, `profiles`, `bus_staff` |
| `listBusStaff` | (없음) | `bus_staff`, `profiles`, `bus_numbers`, `auth.users` |
| `updateBusStaff` | FormData(id, name, role, bus_number_id?) | `bus_staff` |

#### 학생 조회
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `listAllActiveStudentNames` | (없음) | `students`, `profiles`, `class_students`, `classes` |

## 타입
- `BusNumber`, `BusTimeSlot`, `BusStaffProfile`, `BusStop` from `src/lib/types`
- `BusStopDayAssignment`, `BusStopSchedule` from `src/lib/types`
- `BusDefaultAssignment`, `StudentBusDefault` from `src/lib/types`
- `BusChangeRequest` from `src/lib/types`
- `BusManifestGroup`, `BusManifestEntry`, `BusManifestExtraStop` from `src/lib/types`
- `NoRideEntry`, `AfterSchoolBusEntry` from `src/lib/types`
- `BusTabId` = "overview" | "dashboard" | "requests" | "student-assign" | "stop-assign" | "bus-manage" | "timeslots" | "staff"

## 데이터 흐름
1. `page.tsx`: 인증 확인 후 탭에 따라 조건부 데이터 로드
   - 공통: `listBusNumbers()`, `listBusTimeSlots()`
   - `staff` 탭: `listBusStaff()`
   - `stop-assign`/`student-assign`/`bus-manage` 탭: `listBusStops()`
   - `student-assign` 탭: `listAllActiveStudentNames()`
2. 탭별 컴포넌트에 필요한 데이터 전달

## 의존성
- Actions: from `actions.ts` barrel export
- Auth: page.tsx에서 자체 인증 체크

## 주의사항
- 가장 복잡한 라우트 (4개 탭, 12+ 컴포넌트, ~2500줄 액션 파일) — 8→4탭 통합으로 시니어 친화 개편
- 호차/시간대/정류장 삭제는 모두 soft delete (`is_active = false`)
- 학생 버스 배정 구조: 학생 → 요일별(1~5) → 시간대 + 정류장 (하원)
- 정류장 → 호차 매핑: `bus_stop_day_assignments` (요일+시간대별로 다를 수 있음)
- 호차는 정류장에서 파생됨 (`deriveBusFromStopsBulk` 헬퍼)
- 당일 매니페스트: 기본 배정 + 변경 요청(승인/거절) 반영하여 당일 탑승 목록 생성
- `bus_daily_records`: 실제 탑승/확인 기록 (boarded_at, checked_at)
- 변경 요청 워크플로: 학생 제출 → 관리자 승인/거절 → 승인 시 `student_bus_defaults` 자동 업데이트
- `createAdminBusChange`: 관리자가 직접 변경 (승인 절차 없이 즉시 적용)
- 버스 직원: `bus_staff` 역할 (driver/assistant), 별도 Auth 계정 생성
- 학생 이름 표시 시 `getAgeColor(age)` 나이별 색상 적용 필수
- `bus_time_slots.show_empty_stops`: 켜진 시간대는 `getDailyBusManifest`가 `bus_stop_day_assignments` 보강 쿼리로 학생 0명인 호차·정류장까지 `extra_stops`에 포함시켜 반환 → 모니터 카드가 "배정 학생 없음" 플레이스홀더로 렌더. 기본 false → 기존 동작 유지, 오후반(16:20/17:45) 같은 시간대만 관리자 UI에서 체크
