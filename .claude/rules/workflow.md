# Workflow Rules

## Standard Flow

1. Start from `main`.
2. Create a task worktree with `npm run harness -- worktree start <task-slug>`.
3. Create an active plan before code edits.
4. Delegate implementation to `worker`.
5. Run docs sync and docs audit.
6. Delegate validation to `tester`.
7. Finish with `npm run harness -- finish <plan-file>`.

## Main Branch

`main` is orchestration only. Protected file edits on `main` are blocked by hooks.

## Plan Requirements

Every active plan must include goal, success criteria, assumptions, scope, required reading, used skills, spawned agents, file ownership, scripts run, tester result, docs-auditor result, and completion checklist.

## Run Ledger

Task artifacts live under `.claude/runs/<run-id>/`.

Required agent result files:
- `.claude/runs/<run-id>/agents/tester-result.json`
- `.claude/runs/<run-id>/agents/docs-auditor-result.json`
