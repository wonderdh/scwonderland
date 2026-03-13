# Admin Bus (승하차 관리)

## 라우트 경로
- URL: `/admin/bus`
- 라우트 그룹: `(admin)`
- 탭 기반: `?tab=overview|dashboard|requests|student-assign|stop-assign|bus-manage|timeslots|staff`

## 핵심 파일
- page.tsx: `app/(admin)/admin/bus/page.tsx`

## 컴포넌트
| 파일 | 역할 |
|------|------|
| `bus/components/BusTabNav.tsx` | 8개 탭 네비게이션 (전체현황, 대시보드, 변경요청, 학생배정, 정류장배정, 호차관리, 시간대, 직원) |
| `bus/components/BusOverviewPanel.tsx` | 전체 현황 패널 (호차별 학생 배정 요약) |
| `bus/components/BusDashboard.tsx` | 실시간 대시보드 (당일 승하차 매니페스트, 탑승/확인 체크) |
| `bus/components/BusChangeRequestsPanel.tsx` | 학생/학부모 변경 요청 승인/거절 관리 |
| `bus/components/BusStudentAssignmentManager.tsx` | 학생별 버스 기본 배정 관리 (요일별 호차/정류장/시간대) |
| `bus/components/BusStopAssignmentManager.tsx` | 정류장 → 호차 배정 관리 (요일/방향/시간대별) |
| `bus/components/BusManagePanel.tsx` | 호차 CRUD + 정류장 CRUD |
| `bus/components/BusTimeSlotsManager.tsx` | 버스 시간대 CRUD (등원/하원별) |
| `bus/components/BusStaffManager.tsx` | 버스 직원 관리 (기사, 보조교사 계정 생성/관리) |
| `bus/components/BusNumbersManager.tsx` | 호차 번호 CRUD (BusManagePanel 하위) |
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
| `createBusTimeSlot` | direction, label, time | `bus_time_slots` |
| `updateBusTimeSlot` | id, label, time | `bus_time_slots` |
| `deleteBusTimeSlot` | id | `bus_time_slots` (soft delete: is_active=false) |

#### 학생 기본 배정
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `getStudentBusDefaults` | studentProfileId | `student_bus_defaults`, `bus_time_slots`, `bus_stops`, `bus_stop_day_assignments` |
| `upsertStudentBusDefault` | studentProfileId, day, direction, timeSlotId, stopId? | `student_bus_defaults` |
| `deleteStudentBusDefault` | id | `student_bus_defaults` |
| `deleteStudentBusDefaults` | ids[] | `student_bus_defaults` |
| `saveBulkBusDefaults` | updates[{studentProfileId, day, direction, timeSlotId, stopId?}] | `student_bus_defaults`, `bus_stop_day_assignments` |
| `getBulkBusDefaults` | (없음) | `student_bus_defaults`, `students`, `bus_time_slots`, `bus_stops`, `bus_stop_day_assignments` |

#### 당일 매니페스트
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `getDailyBusManifest` | date, direction, busTimeSlotId? | `student_bus_defaults`, `bus_change_requests`, `students`, `bus_stops`, `bus_stop_day_assignments`, `bus_daily_records` |
| `boardBusStudent` | manifestEntryId(studentProfileId), date, direction, busNumberId, timeSlotId? | `bus_daily_records` |
| `unboardBusStudent` | studentProfileId, date, direction, timeSlotId? | `bus_daily_records` |
| `checkBusStudent` | studentProfileId, date, direction, timeSlotId? | `bus_daily_records` |
| `uncheckBusStudent` | studentProfileId, date, direction, timeSlotId? | `bus_daily_records` |

#### 변경 요청
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `listAllChangeRequests` | (없음) | `bus_change_requests`, `students`, `bus_numbers`, `bus_time_slots`, `bus_stops` |
| `listPendingChangeRequests` | (없음) | `bus_change_requests` (pending only) |
| `approveChangeRequest` | requestId, adminId | `bus_change_requests`, `student_bus_defaults` |
| `rejectChangeRequest` | requestId, adminId, reason? | `bus_change_requests` |
| `getStudentChangeRequests` | studentProfileId | `bus_change_requests`, `bus_numbers`, `bus_time_slots`, `bus_stops` |
| `submitBusChangeRequest` | studentProfileId, day, direction, timeSlotId, stopId?, reason? | `bus_change_requests` |
| `cancelBusChangeRequest` | requestId | `bus_change_requests` |
| `createAdminBusChange` | studentProfileId, day, direction, timeSlotId, stopId?, reason? | `bus_change_requests`, `student_bus_defaults` |
| `updateAdminBusChange` | requestId, day?, direction?, timeSlotId?, stopId?, reason? | `bus_change_requests` |
| `getExistingBusChange` | studentProfileId, date, direction, timeSlotId? | `bus_change_requests` |
| `deleteAdminBusChange` | requestId | `bus_change_requests` |

#### 정류장 관리
| 함수 | 파라미터 | DB 테이블 |
|------|---------|----------|
| `listBusStops` | (없음) | `bus_stops` |
| `createBusStop` | name, busNumberId | `bus_stops` |
| `updateBusStop` | id, name | `bus_stops` |
| `deleteBusStop` | id | `bus_stops` (soft delete: is_active=false) |
| `listBusStopDayAssignments` | busStopId | `bus_stop_day_assignments` |
| `saveBusStopDayAssignments` | busStopId, assignments[{day, direction, busNumberId, timeSlotId?}] | `bus_stop_day_assignments` |
| `listBusStopSchedulesBulk` | (없음) | `bus_stop_schedules` |
| `listBusStopSchedules` | busStopId | `bus_stop_schedules` |
| `upsertBusStopSchedule` | busStopId, direction, time | `bus_stop_schedules` |
| `deleteBusStopSchedule` | id | `bus_stop_schedules` |

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
- `BusNumber`, `BusTimeSlot`, `BusStaffProfile`, `BusStop` from `lib/types`
- `BusStopDayAssignment`, `BusStopSchedule` from `lib/types`
- `BusDefaultAssignment`, `StudentBusDefault` from `lib/types`
- `BusChangeRequest` from `lib/types`
- `BusManifestGroup`, `BusManifestEntry` from `lib/types`
- `NoRideEntry`, `AfterSchoolBusEntry` from `lib/types`
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
- 가장 복잡한 라우트 (8개 탭, 12개 컴포넌트, ~1800줄 액션 파일)
- 호차/시간대/정류장 삭제는 모두 soft delete (`is_active = false`)
- 학생 버스 배정 구조: 학생 → 요일별(1~5) → 방향(pickup/dropoff) → 시간대 + 정류장
- 정류장 → 호차 매핑: `bus_stop_day_assignments` (요일+방향+시간대별로 다를 수 있음)
- 호차는 정류장에서 파생됨 (`deriveBusFromStopsBulk` 헬퍼)
- 당일 매니페스트: 기본 배정 + 변경 요청(승인/거절) 반영하여 당일 탑승 목록 생성
- `bus_daily_records`: 실제 탑승/확인 기록 (boarded_at, checked_at)
- 변경 요청 워크플로: 학생 제출 → 관리자 승인/거절 → 승인 시 `student_bus_defaults` 자동 업데이트
- `createAdminBusChange`: 관리자가 직접 변경 (승인 절차 없이 즉시 적용)
- 버스 직원: `bus_staff` 역할 (driver/assistant), 별도 Auth 계정 생성
- 학생 이름 표시 시 `getAgeColor(age)` 나이별 색상 적용 필수
