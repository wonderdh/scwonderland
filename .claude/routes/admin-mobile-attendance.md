# Admin Mobile Attendance

## Route URL
- `/m/attendance`

## Source Files
- `src/app/(admin)/m/attendance/page.tsx`
- `src/app/(admin)/m/attendance/components/`
- `src/app/(admin)/admin/actions/attendance-actions.ts`

## Required Reading
- `.claude/routes/admin-attendance.md`
- `.claude/rules/domain.md`

## Required Checks
- `npm run check:auth`
- `npm run lint`
- `npm run type-check`
- `npm run build` for page/action changes

## Manual Checks
- Mobile attendance flow works on narrow viewport.
- Shared attendance statuses and KST date helpers are used.

## Docs Sync Triggers
- Update this file when mobile attendance UX or action behavior changes.
