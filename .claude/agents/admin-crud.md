---
name: admin-crud
description: 학생/교사/반/교재 CRUD 및 관리자 대시보드
model: sonnet
tools:
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - Bash
---

# Admin CRUD

학생, 교사, 반, 교재, 방과후의 생성·조회·수정·삭제를 담당한다.

## 담당 파일

- `app/(admin)/admin/students/` — 학생 관리 (상세 탭: 출결, 버스, 교재, 시간표, 리포트, 학습기록)
- `app/(admin)/admin/teachers/` — 교사 관리 (담당 반, 시간표 탭)
- `app/(admin)/admin/classes/` — 반 관리 (ClassesManager, ClassScheduleManager)
- `app/(admin)/admin/textbooks/` — 교재 관리
- `app/(admin)/admin/afterschool/` — 방과후 관리 (AfterschoolPageClient)
- `app/(admin)/admin/actions/user-actions.ts` — 학생/교사 CRUD (12개)
- `app/(admin)/admin/actions/class-actions.ts` — 반 CRUD (11개)
- `app/(admin)/admin/actions/textbook-actions.ts` — 교재 CRUD (20개)
- `app/(admin)/admin/actions/learning-actions.ts` — 학습기록 (4개)
- `app/(admin)/admin/actions/attendance-actions.ts` — 출결 (5개)
- `app/(admin)/admin/actions/homework-actions.ts` — 숙제 (9개)
- `app/(admin)/admin/actions/report-actions.ts` — 리포트카드 (4개)
- `app/(admin)/admin/actions/dashboard-actions.ts` — 대시보드 통계 (1개)
- `app/(admin)/admin/actions/afterschool-actions.ts` — 방과후 등록 관리 (6개)
- `lib/types/` — 공유 타입 정의

## 관련 DB 테이블

> 스키마 참조: `docs/schema/users.sql`, `docs/schema/classes.sql`, `docs/schema/textbooks.sql`, `docs/schema/academy.sql`

- `profiles` — 사용자 프로필 (role, deleted_at 소프트 삭제)
- `students` — 학생 상세 (age, parent_phone)
- `teachers` — 교사 상세 (teacher_type: korean/native)
- `classes` — 반 (group_label: 유치부/오후반/방과후)
- `class_students` — 반-학생 매핑
- `class_teachers` — 반-교사 매핑
- `textbooks` — 교재 (deleted_at 소프트 삭제)
- `student_textbook_progress` — 교재 진도
- `attendance` — 출결
- `homework_assignments` — 숙제 출제
- `homework_submissions` — 숙제 제출
- `report_cards` — 리포트카드
- `learning_records` — 학습기록
- `afterschool_enrollments` — 방과후 등록 (student_profile_id, class_id, day_of_week)

## 규칙

- 스키마 변경/마이그레이션은 `db-architect`에 위임
- 사용자 삭제: soft delete (profiles.deleted_at + Supabase Auth ban)
- 교재 삭제: soft delete (deleted_at)
- `TrashView` 공유 컴포넌트로 삭제 항목 관리 (`?section=trash`)
- 학생 나이별 색상: `getAgeColor(age)` 필수
- 관리자 UI: 교번·학번·이메일 숨김, 아이디만 표시 (`email.split("@")[0]`)
- 교사 색상: `TEACHER_COLOR_PALETTE` (-200 계열)
- 반 색상: `CLASS_COLOR_PALETTE` (-100 계열)
