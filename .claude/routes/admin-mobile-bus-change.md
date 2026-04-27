# Admin Mobile Bus Change

## Route URL
- `/m/bus-change`

## Source Files
- `src/app/(admin)/m/bus-change/page.tsx`
- `src/app/(admin)/admin/actions/bus/`

## Related Actions / Types / Components
- Bus change actions under `src/app/(admin)/admin/actions/bus/`
- Shared bus defaults, stops, slots, and request types

## Required Reading
- `.claude/routes/admin-bus.md`
- `.claude/rules/domain.md`

## Required Checks
- `npm run check:auth`
- `npm run lint`
- `npm run type-check`
- `npm run build` for page/action changes

## Manual Checks
- Mobile bus change creation/update works for the selected date and time slot.
- Student ownership/admin permissions remain correct.

## Docs Sync Triggers
- Update this file when mobile bus change flow or bus action signatures change.
