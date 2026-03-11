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

- `app/(admin)/admin/bus/` — 관리자 버스 관리 UI
- `app/(admin)/admin/actions/bus-actions.ts` — 버스 Server Actions
- `app/(academy)/academy/student/bus/` — 학생 버스 조회
- `app/(academy)/academy/teacher/bus/` — 교사 버스 모니터링
- `lib/types/database.ts` — bus 관련 타입 (bus_numbers, bus_stops, student_bus_defaults, daily_bus_overrides, bus_change_requests)

## 관련 DB 테이블

> 스키마 참조: `docs/schema/bus.sql`

- `bus_numbers` — 버스 노선 (morning/afternoon, sort_order)
- `bus_stops` — 정류장 (bus_number_id FK, sort_order)
- `student_bus_defaults` — 학생 기본 배정 (bus_number_id, bus_stop_id)
- `daily_bus_overrides` — 일별 변경
- `bus_change_requests` — 변경 요청 (학부모/교사 → 관리자 승인)

## 규칙

- 스키마 변경/마이그레이션은 `db-architect`에 위임
- 학생 이름 표시 시 `getAgeColor(age)` 나이별 색상 필수 적용
- drag-and-drop 배정 시 낙관적 업데이트 + 에러 롤백
- 버스 번호 삭제 시 관련 정류장·배정 데이터 정리 필요
- Server Action은 `verifyAdmin()` 또는 `verifyAuthenticated()` 인증 필수
