---
name: start-task
description: Start a SC Wonderland task with a dedicated worktree, active plan, required docs, and run ledger.
disable-model-invocation: true
---

Use this skill before implementation work.

Steps:
1. Confirm current branch is `main` and clean.
2. Run `npm run harness -- worktree start <task-slug>`.
3. Move into `C:\scwonderland-worktrees\<task-slug>`.
4. Confirm the generated active plan has Run ID, Branch, and Worktree filled in.
5. Fill goal, success criteria, assumptions, file ownership, used skills, spawned agents, and checks.
6. Run `npm run harness -- context <prompt-or-path>` to list relevant route docs and rules.
7. Keep exactly one active plan. Duplicate active plans block protected edits.
8. Assign implementation to `worker` subagent.
