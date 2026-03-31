# SC Wonderland 변경 내역 — 2026-03-25

## 개요

총 **14개 커밋**, **40+ 파일** 수정. 승하차 UI 전면 리디자인, 하원 전체 매트릭스 뷰 신규, 당일 변경사항 개선, 코드 리뷰 기반 전체 품질 개선.

---

## 1. 승하차 탭 UI 리디자인 (`28a7f10`)

**학생 관리 → 승하차 탭** 전면 재구성

| 항목 | 기존 | 변경 |
|------|------|------|
| 레이아웃 | 10행 세로 테이블 | 5열 카드 그리드 (월~금) |
| 탭 | 없음 | 종합 / 등원 / 하원 3개 서브탭 |
| 편집 | 한 행씩 개별 편집 + 별도 일괄 패널 | 통합 편집 패널 (멀티요일 체크) |
| 삭제 | 삭제 대기 + 되돌리기 | ConfirmDialog 즉시 삭제 |
| 방과후 표시 | 없음 | 1교시=보라, 1·2교시=남색 배지 |

- `getStudentAfterschoolDetail()` 신규 액션 (요일+2교시 여부)
- 505줄 → ~380줄 축소

---

## 2. 하원 전체 매트릭스 뷰 (`28a7f10`, `2aeb86c`)

**승하차 관리 → 배정 현황 → 전체 탭** 신규

- 시간대별 탭 → 호차×요일 매트릭스 → 정류장별 학생 그룹핑
- 등원/하원 토글
- 학생 검색 하이라이트 (매칭 학생 노란 링, 비매칭 흐리게)
- 호차별 배경색 (sky/amber/rose/teal/purple 순환)
- 요일별 배경색 (무채색 계열, 호차와 겹침 방지)
- 나이별 색상 (5세=핑크, 6세=하늘, 7세=에메랄드)
- 방과후 학생 보라색 링 표시
- 미배정 학생 노란 경고 박스
- **PNG 이미지 다운로드** (`html-to-image` 패키지)

---

## 3. 배정 현황 서브탭 통합 (`2aeb86c`)

- 기존 "배정 현황" → **"요일별"** 서브탭으로 이동
- 새 매트릭스 → **"전체"** 서브탭 (기본 선택)
- "하원 전체" 최상위 탭 제거 → 배정 현황 하위로 통합
- `getWeeklyDropoffExportData(direction)` — direction 파라미터 추가 (등원도 지원)

---

## 4. 당일 버스 변경사항 개선

### PC 기존→변경 일정 표시 (`d2ed998`)
- `BusChangeRequest` 타입에 `orig_*` 필드 추가
- `listAllChangeRequests`: 학생 기존 배정 조회 (student_bus_defaults + bus_stop_day_assignments 조인)
- PC에서: `08:30 아침 1호 정문앞 → 15:30 2차하원 2호` 형태
- 모바일: 기존처럼 간략 표시

### 픽업 표시 수정 (`f7cc032`, `730a2b1`)
- `change_type === "change"`일 때만 호차 표시 (픽업인데 호차 나오는 버그 수정)
- 기존 일정 취소선 제거 → 연한 텍스트로 변경

### 승하차 관리 페이지 추가 (`f6ae685`)
- `/admin/bus` 하단에 당일 변경사항 실시간 표시

---

## 5. 변경 요청 수정 개선 (`8f7bd50`, `81a112d`)

- 처리 완료 건 수정 시 **구분(정류장/픽업) 토글** 추가
- 픽업 선택 → 픽업 정류장만 필터, 호차 숨김
- `approveChangeRequest`에 `changeType` override 추가
- 수정 시 `change_type` DB 업데이트
- 호차 목록에서 "픽업" 라벨 호차 필터

---

## 6. 기타 기능

| 커밋 | 내용 |
|------|------|
| `ba6d9d5` | 학생 승하차 종합 탭에 정류장 표시 추가 |
| `9e05d16` | Links 페이지에 Google Drive 공유 링크 추가 |
| `d3a2eae` | Google Drive 링크명 → "Teaching Materials / 수업자료" |

---

## 7. 코드 리뷰 기반 전체 품질 개선 (`1fccc3b`)

6개 병렬 에이전트로 전체 모듈 리뷰 후 일괄 수정. **28개 파일, 360줄 추가**.

### 보안 (13개 함수 인증 추가)

| 파일 | 함수 | 추가된 인증 |
|------|------|-------------|
| `bus-actions.ts` | `listAllChangeRequests` | `verifyAdmin()` |
| `bus-actions.ts` | `getExistingBusChange` | `verifyAuthenticated()` |
| `bus-actions.ts` | `listBusNumbers` | `verifyAuthenticated()` |
| `bus-actions.ts` | `listBusTimeSlots` | `verifyAuthenticated()` |
| `bus-actions.ts` | `listBusStops` | `verifyAuthenticated()` |
| `afterschool-actions.ts` | `getOrCreateAfterschoolClass` | `verifyAdmin()` |
| `afterschool-actions.ts` | `getAfterschoolEnrollments` | `verifyAuthenticated()` |
| `afterschool-actions.ts` | `listAvailableStudents` | `verifyAdmin()` |
| `afterschool-actions.ts` | `getStudentAfterschoolDays` | `verifyAuthenticated()` |
| `afterschool-actions.ts` | `getStudentAfterschoolDetail` | `verifyAuthenticated()` |
| `afterschool-actions.ts` | `listAfterschoolStudentIdsByDay` | `verifyAuthenticated()` |
| `timetable-actions.ts` | `listAcademyPeriods` | `verifyAuthenticated()` |
| `textbook-actions.ts` | `listTextbooksNotAssignedToStudent` | `verifyAuthenticated()` |

### 버그 수정

| 이슈 | 수정 | 영향 범위 |
|------|------|-----------|
| `revalidatePath("/admin/users")` | → `revalidatePath("/admin", "layout")` | 8곳 (user-actions.ts) |
| UTC 날짜 (`toISOString`) | → 로컬 날짜 계산 | 14곳 (13 파일) |
| `DailyBusChanges` 전체 이력 로드 | → `listChangeRequestsByDate(date)` 서버사이드 필터 | 성능 개선 |
| `updateProgress` started_at 덮어씀 | → null일 때만 설정 | textbook-actions.ts |
| `getOrCreateAfterschoolClass` non-null assertion | → error 체크 추가 | afterschool-actions.ts |
| textbook-actions.ts 미사용 import | → `createClient` 제거 | textbook-actions.ts |

### UX 개선

| 이슈 | 수정 | 파일 |
|------|------|------|
| `window.confirm` | → `ConfirmDialog` | StudentGroupedList, BusTimeSlotsManager, BusStaffManager |
| `JSON.parse` 크래시 | → try-catch | ClassesManager (드래그&드롭 2곳) |
| `formatTime` 중복 정의 | → `lib/bus/utils` import | BusChangeRequestsPanel, BusDashboard |
| `URL.createObjectURL` 메모리 누수 | → `revokeObjectURL` + cleanup | NoticesManager, TextbooksManager |
| 삭제 결과 미확인 | → `toast.error` 추가 | NoticesManager, TextbooksManager |

### 남은 TODO (향후 개선)

- `homework-actions.ts`: 교사/관리자 역할 검증 필요 (현재 `verifyAuthenticated`만)
- `attendance-actions.ts`: `deleteAttendance` 소유권 검증 필요
- `learning-actions.ts`: 교사/관리자 역할 검증 필요
- `proxy.ts`: 라우트 보호 추가 검토
- `listUsers({ perPage: 1000 })`: 1000명 초과 시 페이지네이션 필요
- delete→insert 패턴: RPC 트랜잭션 래핑 (스케줄, 방과후)
- 순차 저장: batch action 변환 (버스탭, 스케줄)
- 모바일 loading.tsx 추가
- 접근성: aria-label, 키보드 드래그&드롭
