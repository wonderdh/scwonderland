---
name: route-change
description: Load the correct docs and checks for SC Wonderland route or page changes.
---

When changing a page or route:
1. Read `.claude/routes/_index.md`.
2. Read the route md mapped by `HARNESS_MANIFEST.json`.
3. Read `.claude/rules/core.md`, `.claude/rules/workflow.md`, `.claude/rules/docs-sync.md`, and `.claude/rules/testing.md`.
4. Add route-specific manual checks to the active plan.
5. Update the route md if source files, actions, components, data flow, or manual checks changed.
