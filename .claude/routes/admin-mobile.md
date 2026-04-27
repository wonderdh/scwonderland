# Admin Mobile

## Route URL
- `/m`

## Source Files
- `src/app/(admin)/m/page.tsx`

## Related Actions / Types / Components
- Mobile admin route shortcuts under `/m/*`
- Shared admin route group auth/layout behavior

## Required Reading
- `.claude/routes/admin-mobile-attendance.md`
- `.claude/routes/admin-mobile-bus-change.md`
- `.claude/routes/admin-mobile-bus-check.md`

## Required Checks
- `npm run lint`
- `npm run type-check`
- `npm run build` for page changes

## Manual Checks
- Mobile entry page links to the expected operation shortcuts.
- Admin-only access remains protected by admin route group behavior.

## Docs Sync Triggers
- Update this file when mobile operation shortcuts are added, removed, or renamed.
