# Admin Weekly Sentences

## Route URL
- `/admin/weekly-sentences`

## Source Files
- `src/app/(admin)/admin/weekly-sentences/page.tsx`
- `src/app/(admin)/admin/weekly-sentences/components/`
- `src/app/(admin)/admin/actions/weekly-sentence-actions.ts`
- `src/lib/constants/weekly-sentence.ts`
- `src/lib/utils/weekly-sentence-week.ts`

## Related Actions / Types / Components
- `weekly-sentence-actions.ts` weekly sentence CRUD/import actions
- Weekly sentence constants from `src/lib/constants/weekly-sentence.ts`
- Week calculation helpers from `src/lib/utils/weekly-sentence-week.ts`

## Required Reading
- `.claude/rules/domain.md`
- `.claude/routes/shared-actions.md`

## Required Checks
- `npm run check:auth`
- `npm run lint`
- `npm run type-check`
- `npm run build` for page/action/package changes

## Manual Checks
- 48-week table loads.
- Basic/intermediate/advanced levels remain distinct.
- Excel import uses safe parsing and admin-only actions.

## Docs Sync Triggers
- Update this file when weekly sentence levels, import, week mode, or actions change.
