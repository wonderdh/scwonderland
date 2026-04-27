# Admin Reservations

## Route URL
- `/admin/reservations`

## Source Files
- `src/app/(admin)/admin/reservations/page.tsx`
- `src/app/(admin)/admin/reservations/components/`
- `src/app/(admin)/admin/actions/reservation-actions.ts`
- `src/components/forms/MultiDatePicker.tsx`

## Related Actions / Types / Components
- `reservation-actions.ts` reservation aggregation actions
- `MultiDatePicker` for bulk date selection
- Attendance and bus reservation domain types from `src/lib/types`

## Required Reading
- `.claude/rules/domain.md`
- `.claude/routes/admin-attendance.md`
- `.claude/routes/admin-bus.md`

## Required Checks
- `npm run check:auth`
- `npm run lint`
- `npm run type-check`
- `npm run build` for page/action changes

## Manual Checks
- Upcoming attendance and bus reservations display together.
- Multi-date flows preserve weekday/weekend rules.
- Bus no-ride integration still works for absences.

## Docs Sync Triggers
- Update this file when reservation aggregation, date selection, or linked bus behavior changes.
