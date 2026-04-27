---
name: server-action-change
description: Apply SC Wonderland Server Action safety rules for auth, IDOR, RLS, return shape, and docs sync.
---

When changing Server Actions:
1. Read `.claude/rules/core.md`, `.claude/rules/domain.md`, and `.claude/routes/shared-actions.md`.
2. Mutating actions must call `verifyAdmin`, `verifyTeacherOrAdmin`, or `verifyAuthenticated` as appropriate.
3. Personal data reads must verify ownership or admin/teacher authorization.
4. Return shape must remain `{ error?: string }` unless existing call sites require a richer shape.
5. Add `npm run check:auth`, `npm run type-check`, and `npm run build` to tester checks.
6. Update `routes/shared-actions.md`, related route md, and `rules/domain.md`.
