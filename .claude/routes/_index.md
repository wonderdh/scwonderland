# Route Docs Index

Use this index before changing pages, route layouts, route-specific components, or route-linked Server Actions.

## Harness Rule

- Route/page/layout changes require docs sync.
- Required docs: `STRUCTURE.md`, this index, and the mapped route md.
- Run `npm run harness -- context <url-or-path>` to locate candidate docs.

## Admin Routes

| File | URL | Notes |
|---|---|---|
| [admin-dashboard.md](admin-dashboard.md) | `/admin` | Dashboard stats and navigation cards |
| [admin-students.md](admin-students.md) | `/admin/students` | Student management tabs |
| [admin-student-classes.md](admin-student-classes.md) | `/admin/students/classes` | Student/class assignment helper route |
| [admin-teachers.md](admin-teachers.md) | `/admin/teachers` | Teacher management |
| [admin-classes.md](admin-classes.md) | `/admin/classes` | Class CRUD and assignments |
| [admin-afterschool.md](admin-afterschool.md) | `/admin/afterschool` | Afterschool enrollment |
| [admin-textbooks.md](admin-textbooks.md) | `/admin/textbooks` | Textbook CRUD and progress |
| [admin-timetable.md](admin-timetable.md) | `/admin/timetable` | Periods and timetable grids |
| [admin-weekly-sentences.md](admin-weekly-sentences.md) | `/admin/weekly-sentences` | Weekly sentence management |
| [admin-attendance.md](admin-attendance.md) | `/admin/attendance` | Attendance and reservations linkage |
| [admin-bus.md](admin-bus.md) | `/admin/bus` | Bus operations |
| [admin-reservations.md](admin-reservations.md) | `/admin/reservations` | Upcoming attendance/bus reservations |
| [admin-reports.md](admin-reports.md) | `/admin/reports` | Report status and translation |
| [admin-lunch.md](admin-lunch.md) | `/admin/lunch` | Lunch schedule admin |
| [admin-lunch-settings.md](admin-lunch-settings.md) | `/admin/lunch/settings` | Lunch settings |
| [admin-notices.md](admin-notices.md) | `/admin/notices` | Public notices |
| [admin-academy-notices.md](admin-academy-notices.md) | `/admin/academy-notices` | Portal notices |

## Admin Mobile Routes

| File | URL | Notes |
|---|---|---|
| [admin-mobile.md](admin-mobile.md) | `/m` | Mobile operation entry |
| [admin-mobile-attendance.md](admin-mobile-attendance.md) | `/m/attendance` | Mobile attendance |
| [admin-mobile-bus-change.md](admin-mobile-bus-change.md) | `/m/bus-change` | Mobile bus changes |
| [admin-mobile-bus-check.md](admin-mobile-bus-check.md) | `/m/bus-check` | Mobile bus checking |

## Academy Routes

| File | URL | Notes |
|---|---|---|
| [academy-login.md](academy-login.md) | `/academy/login`, `/academy/dashboard` | Login and role redirect |
| [academy-student.md](academy-student.md) | `/academy/student/*` | Student portal |
| [academy-teacher.md](academy-teacher.md) | `/academy/teacher/*` | Teacher portal |

## Bus And Monitor Routes

| File | URL | Notes |
|---|---|---|
| [bus-staff.md](bus-staff.md) | `/bus` | Staff boarding/checking UI |
| [bus-monitor.md](bus-monitor.md) | `/bus-monitor` | TV bus monitor |
| [lunch-monitor.md](lunch-monitor.md) | `/lunch-monitor` | TV lunch monitor |

## Site Routes

| File | URL | Notes |
|---|---|---|
| [site-home.md](site-home.md) | `/` | Public home |
| [site-about.md](site-about.md) | `/about-wonderland/*` | About pages |
| [site-program.md](site-program.md) | `/program/*` | Program pages |
| [site-notice.md](site-notice.md) | `/notice/*` | Public notice pages |
| [site-community.md](site-community.md) | `/community/*` | Community pages |
| [site-experience.md](site-experience.md) | `/experience/*` | Experience pages |

## Shared Docs

| File | Scope |
|---|---|
| [shared-actions.md](shared-actions.md) | Server Actions |
| [shared-components.md](shared-components.md) | `src/components/` |
| [shared-lib.md](shared-lib.md) | `src/lib/` |

## Task Type Guide

| Task | Read |
|---|---|
| Specific page | Mapped route md + `.claude/rules/workflow.md` |
| Server Action | `shared-actions.md` + `.claude/rules/domain.md` |
| Shared component | `shared-components.md` + affected route docs |
| Types or DB | `shared-lib.md` + `.claude/rules/domain.md` |
| Harness/scripts | `.claude/rules/workflow.md` + `.claude/rules/testing.md` |
