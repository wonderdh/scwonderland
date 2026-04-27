# Admin Mobile Bus Check

## Route URL
- `/m/bus-check`

## Source Files
- `src/app/(admin)/m/bus-check/page.tsx`
- `src/app/(admin)/admin/actions/bus/board-actions.ts`
- `src/app/(admin)/admin/actions/bus/manifest-actions.ts`

## Required Reading
- `.claude/routes/admin-bus.md`
- `.claude/routes/bus-staff.md`

## Required Checks
- `npm run check:auth`
- `npm run lint`
- `npm run type-check`
- `npm run build` for page/action changes

## Manual Checks
- Mobile boarding/checking actions update the same daily records as staff bus UI.
- Date/time slot filtering matches admin bus page.

## Docs Sync Triggers
- Update this file when mobile check flow, manifest, or board actions change.
