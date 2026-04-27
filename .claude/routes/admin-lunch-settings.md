# Admin Lunch Settings

## Route URL
- `/admin/lunch/settings`

## Source Files
- `src/app/(admin)/admin/lunch/settings/page.tsx`
- `src/app/(admin)/admin/actions/lunch-actions.ts`

## Related Actions / Types / Components
- Lunch configuration actions
- `src/lib/lunch/rotation.ts`

## Required Reading
- `.claude/routes/admin-lunch.md`
- `.claude/rules/domain.md`
- `.claude/rules/docs-sync.md`

## Required Checks
- `npm run check:auth`
- `npm run lint`
- `npm run type-check`
- `npm run build` for page/action changes

## Manual Checks
- Settings changes affect admin lunch and lunch monitor consistently.
- Invalid settings do not create broken monitor output.

## Docs Sync Triggers
- Update this file when lunch settings schema, action names, or settings UI changes.
