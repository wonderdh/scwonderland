# 라우트별 MD 파일 생성 완료 보고서

## 생성 일자
2026-03-13

## 생성 현황

### 총 25개 파일 생성

| 구분 | 파일 수 | 파일 목록 |
|------|---------|-----------|
| Admin 라우트 | 10 | admin-dashboard, admin-students, admin-teachers, admin-classes, admin-textbooks, admin-notices, admin-academy-notices, admin-timetable, admin-afterschool, admin-bus |
| Academy 라우트 | 3 | academy-login, academy-student, academy-teacher |
| Bus 라우트 | 2 | bus-staff, bus-monitor |
| Site 라우트 | 6 | site-home, site-about, site-program, site-notice, site-community, site-experience |
| 공유 모듈 | 3 | shared-components, shared-lib, shared-actions |
| 인덱스 | 1 | _index.md |

### 커버리지 검증

**page.tsx 매핑 완료:**
- `app/(admin)/admin/page.tsx` → admin-dashboard.md
- `app/(admin)/admin/students/page.tsx` → admin-students.md
- `app/(admin)/admin/students/classes/page.tsx` → admin-students.md (서브라우트)
- `app/(admin)/admin/teachers/page.tsx` → admin-teachers.md
- `app/(admin)/admin/classes/page.tsx` → admin-classes.md
- `app/(admin)/admin/textbooks/page.tsx` → admin-textbooks.md
- `app/(admin)/admin/notices/page.tsx` → admin-notices.md
- `app/(admin)/admin/academy-notices/page.tsx` → admin-academy-notices.md
- `app/(admin)/admin/timetable/page.tsx` → admin-timetable.md
- `app/(admin)/admin/afterschool/page.tsx` → admin-afterschool.md
- `app/(admin)/admin/bus/page.tsx` → admin-bus.md
- `app/(academy)/academy/login/page.tsx` → academy-login.md
- `app/(academy)/academy/dashboard/page.tsx` → academy-login.md
- `app/(academy)/academy/student/page.tsx` + 6 서브페이지 → academy-student.md
- `app/(academy)/academy/teacher/page.tsx` + 8 서브페이지 → academy-teacher.md
- `app/(bus)/bus/page.tsx` → bus-staff.md
- `app/(monitor)/bus-monitor/page.tsx` → bus-monitor.md
- `app/(site)/page.tsx` → site-home.md
- `app/(site)/about-wonderland/*/page.tsx` (4개) → site-about.md
- `app/(site)/program/*/page.tsx` (5개) → site-program.md
- `app/(site)/notice/news/page.tsx` + `[id]/page.tsx` → site-notice.md
- `app/(site)/community/*/page.tsx` (3개) → site-community.md
- `app/(site)/experience/*/page.tsx` (3개) → site-experience.md

**모든 page.tsx가 최소 하나의 MD 파일에 매핑됨** ✓

## 사용 가이드

1. 특정 페이지 작업 시: `_index.md`에서 해당 라우트 MD 찾기
2. Server Action 추가/수정 시: `shared-actions.md` 참조
3. 타입/유틸리티 수정 시: `shared-lib.md` 참조
4. 공용 컴포넌트 수정 시: `shared-components.md` + 사용처 라우트 MD 참조

## 수정된 기존 파일
- `.claude/CLAUDE.md` — `routes/` 참조 섹션 추가
