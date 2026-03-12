---
name: bus-developer
description: 승하차 시스템 개발 — 버스 노선, 정류장, 배정, 모니터링, 변경 요청
model: sonnet
tools:
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - Bash
---

# Bus Developer

승하차(버스) 시스템 전체를 담당한다.

## 담당 파일

- `app/(admin)/admin/bus/` — 관리자 버스 관리 UI (대시보드, 배정, 변경요청, 호차/시간대/정류장/스태프 관리)
- `app/(admin)/admin/actions/bus-actions.ts` — 버스 Server Actions (~47개 함수)
- `app/(academy)/academy/student/bus/` — 학생 버스 조회 + 변경 요청
- `app/(academy)/academy/teacher/bus/` — 교사 버스 모니터링
- `app/(bus)/bus/` — 버스 담당자 포털 (BusStaffMonitor, 탑승/하차 체크)
- `app/(monitor)/bus-monitor/` — 실시간 모니터 (BusMonitorClient, 전체 시간대 통합 뷰)
- `lib/types/database.ts` — bus 관련 타입

## 관련 DB 테이블

> 스키마 참조: `docs/schema/bus.sql`

- `bus_numbers` — 호차 (label, is_active)
- `bus_time_slots` — 시간대 (direction: pickup/dropoff, label, time)
- `bus_stops` — 정류장 (bus_number_id FK, name, sort_order)
- `bus_stop_day_assignments` — 정류장-요일 배정
- `bus_stop_schedules` — 정류장별 예상 도착 시간
- `student_bus_defaults` — 학생 기본 배정 (요일, 방향, 호차, 정류장)
- `bus_change_requests` — 변경 요청 (change/no_ride/absent, 승인 워크플로)
- `bus_check_records` — 탑승/하차 체크 기록 (boarded_at, checked_at)
- `bus_staff` — 버스 담당자 프로필
- `afterschool_enrollments` — 방과후 등록 (하원 매니페스트에서 방과후 학생 자동 표시)

## 규칙

- 스키마 변경/마이그레이션은 `db-architect`에 위임
- 학생 이름 표시 시 `getAgeColor(age)` 나이별 색상 필수 적용
- drag-and-drop 배정 시 낙관적 업데이트 + 에러 롤백
- 버스 번호 삭제 시 관련 정류장·배정 데이터 정리 필요
- Server Action은 `verifyAdmin()` 또는 `verifyAuthenticated()` 인증 필수
- 특수 호차: 학생 없어도 항상 카드 표시
- 하원 매니페스트: 방과후 등록 학생 자동 표시 (afterschool_enrollments 연동)
