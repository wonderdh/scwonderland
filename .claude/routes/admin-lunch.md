# Admin Lunch

## Route URL
- `/admin/lunch`

## Source Files
- `src/app/(admin)/admin/lunch/page.tsx`
- `src/app/(admin)/admin/lunch/loading.tsx`
- `src/app/(admin)/admin/actions/lunch-actions.ts`
- `src/lib/lunch/rotation.ts`

## Related Actions / Types / Components
- Lunch schedule actions from `lunch-actions.ts`
- Lunch rotation helpers from `src/lib/lunch/rotation.ts`

## Required Reading
- `.claude/rules/core.md`
- `.claude/rules/domain.md`
- `.claude/routes/lunch-monitor.md`

## Required Checks
- `npm run check:auth`
- `npm run lint`
- `npm run type-check`
- `npm run build` for page/action changes

## Manual Checks
- Admin lunch schedule renders for the selected date.
- Monitor-facing data remains compatible with `/lunch-monitor`.

## Docs Sync Triggers
- Update this file when lunch schedule data flow or admin UI changes.
