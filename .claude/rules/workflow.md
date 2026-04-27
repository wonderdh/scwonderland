# Workflow Rules

## Standard Flow

1. Start from `main`.
2. Create a task worktree with `npm run harness -- worktree start <task-slug>`.
3. Use the generated active plan in `.claude/plans/active/`.
4. Delegate implementation to `worker`.
5. Run docs sync and docs audit.
6. Delegate validation to `tester`.
7. Finish with `npm run harness -- finish <plan-file>`.
8. Commit with `npm run harness -- commit "<message>"`.
9. Merge into main with `npm run harness -- merge-main <branch>`.

## Main Branch

`main` is orchestration only. Protected file edits on `main` are blocked by hooks. Shell-based writes, direct git publish commands, and direct test/build commands are also blocked from the main agent.

Protected paths include source, Supabase, harness scripts, hooks, Claude rules/routes/skills/agents, package/config files, `HARNESS_MANIFEST.json`, `STRUCTURE.md`, `public/**`, and `.env*`.

## Plan Requirements

Every task must have exactly one active plan. The plan must include goal, success criteria, assumptions, scope, required reading, used skills, spawned agents, file ownership, scripts run, tester result, docs-auditor result, and completion checklist.

## Run Ledger

Task artifacts live under `.claude/runs/<run-id>/`.

Required agent result files:
- `.claude/runs/<run-id>/agents/tester-result.json`
- `.claude/runs/<run-id>/agents/docs-auditor-result.json`

Raw run artifacts are local-only and ignored by git. Completed plans keep the durable summary.

## Publish Flow

`finish` only moves the plan to completed after tester/docs-auditor pass, docs detect has no missing docs, manifest/structure are current, and result JSON fields match the run id, branch, worktree, commit head, and worktree hash.

After `finish`:
1. Run `npm run harness -- commit "<message>"` in the task worktree.
2. Run `npm run harness -- merge-main <branch>` from the task worktree or main worktree.
3. Confirm `C:\scwonderland` is on `main` and clean.

The commit command stages only harness-approved paths and refuses raw run logs, active plans, env files, and local Supabase dumps. The merge command refuses dirty task/main worktrees and validates main after merge.
