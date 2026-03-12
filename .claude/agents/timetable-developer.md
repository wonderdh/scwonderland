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

- `app/(admin)/admin/timetable/` — 시간표 관리 UI (TimetableManager, GroupTimetableGrid, TimetablePageClient)
- `app/(admin)/admin/actions/timetable-actions.ts` — 교시(academy_periods) CRUD Actions (4개)
- `app/(admin)/admin/actions/schedule-actions.ts` — 수업 스케줄 Actions (8개, GroupTimetableData 타입 정의 포함)
- `app/(admin)/admin/students/components/StudentTimetableTab.tsx` — 관리자용 학생 시간표 탭
- `app/(academy)/academy/student/timetable/` — 학생 포털 시간표 페이지
- `lib/types/` — AcademyPeriod, ClassSchedule, ClassScheduleWithDetails, StudentTimetableCell, StudentTimetableRow

## 관련 DB 테이블

> 스키마 참조: `docs/schema/timetable.sql`

- `academy_periods` — 교시 정의 (name, start_time, end_time, group_label, is_active)
- `class_schedules` — 수업 배정 (class_id, academy_period_id, day_of_week, teacher_profile_id, label, textbook_id, student_profile_id)

## 규칙

- 스키마 변경/마이그레이션은 `db-architect`에 위임
- `GroupTimetableData` 타입은 `schedule-actions.ts`에서 직접 import (크로스 라우트 그룹)
- 시간 충돌 검증: 같은 교사가 같은 교시+요일에 중복 배정 불가
- 교시 시간 유효성: startTime < endTime 필수 (서버 + 클라이언트 검증)
- 유치부(6반)와 오후반(19개) 시간표 별도 관리 (group_label)
