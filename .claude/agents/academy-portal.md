---
name: academy-portal
description: 학생/교사 포털 UI — 대시보드, 교재, 출결, 숙제, 리포트카드
model: sonnet
tools:
  - Read
  - Edit
  - Write
  - Grep
  - Glob
  - Bash
---

# Academy Portal

학생과 교사가 사용하는 Academy 포털을 담당한다.

## 담당 파일

- `app/(academy)/academy/layout.tsx` — 포털 레이아웃 (원어민 감지)
- `app/(academy)/academy/login/` — 로그인
- `app/(academy)/academy/dashboard/` — 대시보드
- `app/(academy)/academy/actions.ts` — 포털 Actions (7개: getCurrentStudentProfile, getCurrentStudentClasses, getCurrentTeacherProfile, getTeacherClasses, getClassReportStatus, getClassTextbooks, getCurrentStudentTextbooks)
- `lib/teacher-labels.ts` — 원어민 교사 영어 라벨 (9개 세트)

### 학생 포털
- `app/(academy)/academy/student/page.tsx` — 학생 대시보드
- `app/(academy)/academy/student/components/` — StudentNav
- `app/(academy)/academy/student/reports/` — 리포트카드
- `app/(academy)/academy/student/textbooks/` — 교재
- `app/(academy)/academy/student/notices/` — 공지
- `app/(academy)/academy/student/homework/` — 숙제
- `app/(academy)/academy/student/timetable/` — 시간표
- `app/(academy)/academy/student/bus/` — 승하차

### 교사 포털
- `app/(academy)/academy/teacher/page.tsx` — 교사 대시보드
- `app/(academy)/academy/teacher/components/` — TeacherNav, TeacherReportClient, TeacherTextbookClient
- `app/(academy)/academy/teacher/classes/` — 반 관리
- `app/(academy)/academy/teacher/reports/` — 리포트카드
- `app/(academy)/academy/teacher/textbooks/` — 교재
- `app/(academy)/academy/teacher/notices/` — 공지
- `app/(academy)/academy/teacher/homework/` — 숙제
- `app/(academy)/academy/teacher/attendance/` — 출결
- `app/(academy)/academy/teacher/bus/` — 승하차
- `app/(academy)/academy/teacher/timetable/` — 시간표

## 규칙

- 원어민 교사(is_native): 영어 UI 적용 (`teacher-labels.ts` 라벨 세트)
- 한국인 교사: 반 관리, 공지, 교재, 출결, 숙제, 승하차, 시간표 접근
- 원어민 교사: 리포트카드, 교재, 출결, 숙제 접근 (반 관리·승하차 제외)
- 학생: 리포트카드, 교재, 공지, 숙제, 시간표, 승하차 조회
- 인증: `verifyAuthenticated()` 사용
- 학생 나이별 색상 적용
