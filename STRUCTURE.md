# SC Wonderland Structure

This file is generated from `HARNESS_MANIFEST.json`. Run `npm run harness -- manifest` and `npm run harness -- structure` after structural changes.

## Stack
- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Supabase.

## Route Groups
### site
- `/` -> `src/app/(site)/page.tsx` (site-home.md)
- `/about-wonderland/certification` -> `src/app/(site)/about-wonderland/certification/page.tsx` (site-about.md)
- `/about-wonderland/company-history` -> `src/app/(site)/about-wonderland/company-history/page.tsx` (site-about.md)
- `/about-wonderland/greeting` -> `src/app/(site)/about-wonderland/greeting/page.tsx` (site-about.md)
- `/about-wonderland/wonderland` -> `src/app/(site)/about-wonderland/wonderland/page.tsx` (site-about.md)
- `/community/campus` -> `src/app/(site)/community/campus/page.tsx` (site-community.md)
- `/community/franchise-inquiry` -> `src/app/(site)/community/franchise-inquiry/page.tsx` (site-community.md)
- `/community/parent-consultation` -> `src/app/(site)/community/parent-consultation/page.tsx` (site-community.md)
- `/experience/e-school` -> `src/app/(site)/experience/e-school/page.tsx` (site-experience.md)
- `/experience/library` -> `src/app/(site)/experience/library/page.tsx` (site-experience.md)
- `/experience/links` -> `src/app/(site)/experience/links/page.tsx` (site-experience.md)
- `/experience/special-day` -> `src/app/(site)/experience/special-day/page.tsx` (site-experience.md)
- `/notice/news` -> `src/app/(site)/notice/news/page.tsx` (site-notice.md)
- `/notice/news/[id]` -> `src/app/(site)/notice/news/[id]/page.tsx` (site-notice.md)
- `/program/map` -> `src/app/(site)/program/map/page.tsx` (site-program.md)
- `/program/primo-school` -> `src/app/(site)/program/primo-school/page.tsx` (site-program.md)
- `/program/quest-academy` -> `src/app/(site)/program/quest-academy/page.tsx` (site-program.md)
- `/program/wonder-k` -> `src/app/(site)/program/wonder-k/page.tsx` (site-program.md)
- `/program/wonderland` -> `src/app/(site)/program/wonderland/page.tsx` (site-program.md)

### academy
- `/academy/dashboard` -> `src/app/(academy)/academy/dashboard/page.tsx` (academy-login.md)
- `/academy/login` -> `src/app/(academy)/academy/login/page.tsx` (academy-login.md)
- `/academy/student` -> `src/app/(academy)/academy/student/page.tsx` (academy-student.md)
- `/academy/student/bus` -> `src/app/(academy)/academy/student/bus/page.tsx` (academy-student.md)
- `/academy/student/homework` -> `src/app/(academy)/academy/student/homework/page.tsx` (academy-student.md)
- `/academy/student/notices` -> `src/app/(academy)/academy/student/notices/page.tsx` (academy-student.md)
- `/academy/student/reports` -> `src/app/(academy)/academy/student/reports/page.tsx` (academy-student.md)
- `/academy/student/textbooks` -> `src/app/(academy)/academy/student/textbooks/page.tsx` (academy-student.md)
- `/academy/student/timetable` -> `src/app/(academy)/academy/student/timetable/page.tsx` (academy-student.md)
- `/academy/teacher` -> `src/app/(academy)/academy/teacher/page.tsx` (academy-teacher.md)
- `/academy/teacher/attendance` -> `src/app/(academy)/academy/teacher/attendance/page.tsx` (academy-teacher.md)
- `/academy/teacher/bus` -> `src/app/(academy)/academy/teacher/bus/page.tsx` (academy-teacher.md)
- `/academy/teacher/classes` -> `src/app/(academy)/academy/teacher/classes/page.tsx` (academy-teacher.md)
- `/academy/teacher/homework` -> `src/app/(academy)/academy/teacher/homework/page.tsx` (academy-teacher.md)
- `/academy/teacher/notices` -> `src/app/(academy)/academy/teacher/notices/page.tsx` (academy-teacher.md)
- `/academy/teacher/reports` -> `src/app/(academy)/academy/teacher/reports/page.tsx` (academy-teacher.md)
- `/academy/teacher/textbooks` -> `src/app/(academy)/academy/teacher/textbooks/page.tsx` (academy-teacher.md)
- `/academy/teacher/timetable` -> `src/app/(academy)/academy/teacher/timetable/page.tsx` (academy-teacher.md)

### admin
- `/admin` -> `src/app/(admin)/admin/page.tsx` (admin-dashboard.md)
- `/admin/academy-notices` -> `src/app/(admin)/admin/academy-notices/page.tsx` (admin-academy-notices.md)
- `/admin/afterschool` -> `src/app/(admin)/admin/afterschool/page.tsx` (admin-afterschool.md)
- `/admin/attendance` -> `src/app/(admin)/admin/attendance/page.tsx` (admin-attendance.md)
- `/admin/bus` -> `src/app/(admin)/admin/bus/page.tsx` (admin-bus.md)
- `/admin/classes` -> `src/app/(admin)/admin/classes/page.tsx` (admin-classes.md)
- `/admin/lunch` -> `src/app/(admin)/admin/lunch/page.tsx` (admin-lunch.md)
- `/admin/lunch/settings` -> `src/app/(admin)/admin/lunch/settings/page.tsx` (admin-lunch-settings.md)
- `/admin/notices` -> `src/app/(admin)/admin/notices/page.tsx` (admin-notices.md)
- `/admin/reports` -> `src/app/(admin)/admin/reports/page.tsx` (admin-reports.md)
- `/admin/reservations` -> `src/app/(admin)/admin/reservations/page.tsx` (admin-reservations.md)
- `/admin/students` -> `src/app/(admin)/admin/students/page.tsx` (admin-students.md)
- `/admin/students/classes` -> `src/app/(admin)/admin/students/classes/page.tsx` (admin-student-classes.md)
- `/admin/teachers` -> `src/app/(admin)/admin/teachers/page.tsx` (admin-teachers.md)
- `/admin/textbooks` -> `src/app/(admin)/admin/textbooks/page.tsx` (admin-textbooks.md)
- `/admin/timetable` -> `src/app/(admin)/admin/timetable/page.tsx` (admin-timetable.md)
- `/admin/weekly-sentences` -> `src/app/(admin)/admin/weekly-sentences/page.tsx` (admin-weekly-sentences.md)
- `/m` -> `src/app/(admin)/m/page.tsx` (admin-mobile.md)
- `/m/attendance` -> `src/app/(admin)/m/attendance/page.tsx` (admin-mobile-attendance.md)
- `/m/bus-change` -> `src/app/(admin)/m/bus-change/page.tsx` (admin-mobile-bus-change.md)
- `/m/bus-check` -> `src/app/(admin)/m/bus-check/page.tsx` (admin-mobile-bus-check.md)

### bus
- `/bus` -> `src/app/(bus)/bus/page.tsx` (bus-staff.md)

### monitor
- `/bus-monitor` -> `src/app/(monitor)/bus-monitor/page.tsx` (bus-monitor.md)
- `/lunch-monitor` -> `src/app/(monitor)/lunch-monitor/page.tsx` (lunch-monitor.md)

## Server Actions
- `src/app/(admin)/admin/actions/academy-notice-actions.ts` (academy-notice-actions)
- `src/app/(admin)/admin/actions/afterschool-actions.ts` (afterschool-actions)
- `src/app/(admin)/admin/actions/attendance-actions.ts` (attendance-actions)
- `src/app/(admin)/admin/actions/auth-helpers.ts` (auth-helpers)
- `src/app/(admin)/admin/actions/bus-actions.ts` (bus-actions)
- `src/app/(admin)/admin/actions/bus-staff.ts` (bus-staff)
- `src/app/(admin)/admin/actions/bus/_helpers.ts` (_helpers)
- `src/app/(admin)/admin/actions/bus/assignment-actions.ts` (assignment-actions)
- `src/app/(admin)/admin/actions/bus/board-actions.ts` (board-actions)
- `src/app/(admin)/admin/actions/bus/change-actions.ts` (change-actions)
- `src/app/(admin)/admin/actions/bus/manifest-actions.ts` (manifest-actions)
- `src/app/(admin)/admin/actions/bus/master-actions.ts` (master-actions)
- `src/app/(admin)/admin/actions/bus/staff-actions.ts` (staff-actions)
- `src/app/(admin)/admin/actions/class-actions.ts` (class-actions)
- `src/app/(admin)/admin/actions/class-notice-actions.ts` (class-notice-actions)
- `src/app/(admin)/admin/actions/dashboard-actions.ts` (dashboard-actions)
- `src/app/(admin)/admin/actions/homework-actions.ts` (homework-actions)
- `src/app/(admin)/admin/actions/learning-actions.ts` (learning-actions)
- `src/app/(admin)/admin/actions/lunch-actions.ts` (lunch-actions)
- `src/app/(admin)/admin/actions/notice-actions.ts` (notice-actions)
- `src/app/(admin)/admin/actions/report-actions.ts` (report-actions)
- `src/app/(admin)/admin/actions/reservation-actions.ts` (reservation-actions)
- `src/app/(admin)/admin/actions/schedule-actions.ts` (schedule-actions)
- `src/app/(admin)/admin/actions/textbook-actions.ts` (textbook-actions)
- `src/app/(admin)/admin/actions/textbook-constants.ts` (textbook-constants)
- `src/app/(admin)/admin/actions/timetable-actions.ts` (timetable-actions)
- `src/app/(admin)/admin/actions/user-actions.ts` (user-actions)
- `src/app/(admin)/admin/actions/weekly-sentence-actions.ts` (weekly-sentence-actions)

## Shared Components
### badges
- `src/components/badges/StatusBadge.tsx`
- `src/components/badges/TeacherBadges.tsx`

### bus
- `src/components/bus/DailyBusChanges.tsx`
- `src/components/bus/MonitorBusCard.tsx`

### feedback
- `src/components/feedback/EmptyState.tsx`
- `src/components/feedback/ErrorScreen.tsx`
- `src/components/feedback/LoadingState.tsx`
- `src/components/feedback/NavigationProgress.tsx`
- `src/components/feedback/Spinner.tsx`

### forms
- `src/components/forms/AudioRecorder.tsx`
- `src/components/forms/FileList.tsx`
- `src/components/forms/FileUpload.tsx`
- `src/components/forms/FormGroup.tsx`
- `src/components/forms/MultiDatePicker.tsx`

### navigation
- `src/components/navigation/Breadcrumb.tsx`
- `src/components/navigation/LogoutButton.tsx`
- `src/components/navigation/PageHeader.tsx`
- `src/components/navigation/QueryTabNav.tsx`

### overlays
- `src/components/overlays/ConfirmDialog.tsx`

### skeletons
- `src/components/skeletons/AdminDashboardSkeleton.tsx`
- `src/components/skeletons/AdminListPageSkeleton.tsx`
- `src/components/skeletons/SkeletonBone.tsx`
- `src/components/skeletons/SkeletonList.tsx`
- `src/components/skeletons/SkeletonTable.tsx`

### ui
- `src/components/ui/avatar.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/calendar.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/label.tsx`
- `src/components/ui/popover.tsx`
- `src/components/ui/separator.tsx`
- `src/components/ui/tabs.tsx`
- `src/components/ui/textarea.tsx`
- `src/components/ui/tooltip.tsx`

## Harness Workflow
1. Start on `main` and run `npm run harness -- worktree start <task-slug>`.
2. Work only in the created `claude/<task-slug>` worktree.
3. Create an active plan in `.claude/plans/active/` before code edits.
4. Use worker subagents for implementation, tester for checks, docs-auditor for docs drift.
5. Finish with `npm run harness -- finish <plan-file>`.
6. Commit with `npm run harness -- commit "<message>"`.
7. Merge into main with `npm run harness -- merge-main [branch]`, then return to `C:\scwonderland`.

## Required Checks
- Base: `npm run check:auth`, `npm run lint`, `npm run type-check`.
- Add `npm run build` for route/page/layout/server action/supabase/package changes.
