---
name: start-task
description: Start a SC Wonderland task with a dedicated worktree, active plan, required docs, and run ledger.
disable-model-invocation: true
---

Use this skill before implementation work.

Steps:
1. Confirm current branch is `main`.
2. Run `npm run harness -- worktree start <task-slug>`.
3. In the created worktree, copy `.claude/plans/templates/PLAN_TEMPLATE.md` to `.claude/plans/active/<YYYY-MM-DD>-<task-slug>.md`.
4. Fill goal, success criteria, assumptions, file ownership, used skills, spawned agents, and checks.
5. Run `npm run harness -- context <prompt-or-path>` to list relevant route docs and rules.
6. Assign implementation to `worker` subagent.
