# Lunch Monitor

## Route URL
- `/lunch-monitor`

## Source Files
- `src/app/(monitor)/lunch-monitor/page.tsx`
- `src/app/(monitor)/lunch-monitor/loading.tsx`
- `src/app/(admin)/admin/actions/lunch-actions.ts`
- `src/lib/lunch/rotation.ts`

## Required Reading
- `docs/ssr-initial-fetch-pattern.md`
- `.claude/routes/admin-lunch.md`
- `.claude/rules/domain.md`

## Required Checks
- `npm run check:auth`
- `npm run lint`
- `npm run type-check`
- `npm run build` for page/action changes

## Manual Checks
- Monitor renders real schedule data from SSR initial fetch.
- Loading state dimensions do not cause visible layout shift.
- KST date behavior is correct.

## Docs Sync Triggers
- Update this file when monitor data flow, lunch actions, or SSR initial fetch behavior changes.
