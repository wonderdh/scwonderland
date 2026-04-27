# Docs Sync Rules

Documentation is part of the code change. A task is not complete if structural code changed and related md files were not updated.

## Required Mapping

| Change | Required docs |
|---|---|
| `src/app/**/page.tsx`, `layout.tsx` | `STRUCTURE.md`, `.claude/routes/_index.md`, route md |
| `src/lib/navigation/admin-nav.ts` | `STRUCTURE.md`, admin route docs |
| `src/lib/navigation/menu-routes.ts` | `STRUCTURE.md`, site route docs |
| `src/app/(admin)/admin/actions/**` | `.claude/rules/domain.md`, `.claude/routes/shared-actions.md`, related route md |
| `src/lib/types/**`, `supabase/migrations/**` | `.claude/rules/domain.md`, `.claude/routes/shared-lib.md`, `STRUCTURE.md` |
| `src/components/**` | `.claude/rules/domain.md`, `.claude/routes/shared-components.md` |
| `scripts/**`, `.githooks/**`, `.claude/settings.json`, `package.json` | `STRUCTURE.md`, `.claude/rules/workflow.md`, `.claude/rules/testing.md` |

## Exceptions

Exceptions must be written in the active plan under `Docs Sync Exception` and approved by `docs-auditor`.
