# Admin Attendance

## Route URL
- `/admin/attendance`

## Source Files
- `src/app/(admin)/admin/attendance/page.tsx`
- `src/app/(admin)/admin/attendance/components/`
- `src/app/(admin)/admin/attendance/hooks/`
- `src/app/(admin)/admin/actions/attendance-actions.ts`

## Related Actions / Types / Components
- `recordAttendance`, `bulkRecordAttendance`, `bulkReserveAttendance`
- `src/lib/constants/attendance.ts`
- `src/components/forms/MultiDatePicker.tsx`

## Required Reading
- `.claude/rules/core.md`
- `.claude/rules/domain.md`
- `.claude/rules/docs-sync.md`
- `.claude/routes/shared-actions.md`

## Required Checks
- `npm run check:auth`
- `npm run lint`
- `npm run type-check`
- `npm run build` for page/action changes

## Manual Checks
- Admin can record and bulk update attendance.
- Attendance statuses use shared constants.
- Reservation flow handles multiple dates and bus no-ride linkage.

## Docs Sync Triggers
- Update this file when attendance tabs, statuses, actions, or reservation behavior changes.
