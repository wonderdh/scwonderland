---
name: timetable-developer
description: 시간표 및 교시 관리 — 스케줄 CRUD, 시간 충돌 검증, 교사 배정
model: sonnet
tools:
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - Bash
---

# Timetable Developer

시간표(timetable)와 스케줄 관리를 담당한다.

## 담당 파일

- `app/(admin)/admin/timetable/` — 시간표 관리 UI
- `app/(admin)/admin/actions/timetable-actions.ts` — 시간표 CRUD Actions
- `app/(admin)/admin/actions/schedule-actions.ts` — 교시 스케줄 Actions (GroupTimetableData 타입 정의 포함)
- `lib/types/` — timetable, schedule 관련 타입

## 관련 DB 테이블

> 스키마 참조: `docs/schema/timetable.sql`

- `timetables` — 시간표 메타 (학기, 시작/종료일)
- `timetable_classes` — 시간표-반 연결
- `schedules` — 교시 데이터 (요일, 시작/종료 시간, 교사, 교실)

## 규칙

- 스키마 변경/마이그레이션은 `db-architect`에 위임
- `GroupTimetableData` 타입은 `schedule-actions.ts`에서 직접 import (크로스 라우트 그룹)
- 시간 충돌 검증: 같은 교사가 같은 시간에 중복 배정 불가
- 유치부(6반)와 오후반(19개) 시간표 별도 관리
