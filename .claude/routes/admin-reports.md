# Admin Reports

## Route URL
- `/admin/reports`

## Source Files
- `src/app/(admin)/admin/reports/page.tsx`
- `src/app/(admin)/admin/reports/components/`
- `src/app/(admin)/admin/actions/report-actions.ts`

## Related Actions / Types / Components
- `listAllClassesReportStatus`
- `listUntranslatedReports`
- `translateReportCard`
- `src/lib/server/translate.ts`

## Required Reading
- `.claude/rules/core.md`
- `.claude/rules/domain.md`
- `.claude/routes/shared-actions.md`

## Required Checks
- `npm run check:auth`
- `npm run lint`
- `npm run type-check`
- `npm run build` for page/action changes

## Manual Checks
- Admin can review class report status by year/month.
- Translation actions do not log PII.
- Native/Korean teacher permissions remain unchanged.

## Docs Sync Triggers
- Update this file when report workflow, translation, or permissions change.
