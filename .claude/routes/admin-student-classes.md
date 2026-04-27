# Admin Student Classes

## Route URL
- `/admin/students/classes`

## Source Files
- `src/app/(admin)/admin/students/classes/page.tsx`
- `src/app/(admin)/admin/actions/class-actions.ts`
- `src/app/(admin)/admin/actions/user-actions.ts`

## Related Actions / Types / Components
- `class-actions.ts` class/student assignment actions
- `user-actions.ts` active student lookup actions
- Student/class domain types from `src/lib/types`

## Required Reading
- `.claude/routes/admin-students.md`
- `.claude/routes/admin-classes.md`
- `.claude/rules/domain.md`

## Required Checks
- `npm run check:auth`
- `npm run lint`
- `npm run type-check`
- `npm run build` for page/action changes

## Manual Checks
- Student/class assignments remain consistent with class management.
- Soft-deleted students are excluded.

## Docs Sync Triggers
- Update this file when student-class assignment flow changes.
