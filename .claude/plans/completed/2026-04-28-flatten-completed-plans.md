# Flatten Completed Plans Plan

Run ID: 2026-04-28-flatten-completed-plans
Branch: claude/harness-bootstrap
Worktree: C:\scwonderland-worktrees\harness-bootstrap

## Goal

Use only `.claude/plans/active/` and `.claude/plans/completed/` without date subfolders.

## Success Criteria

- `finish` moves plans directly into `.claude/plans/completed/`.
- Existing completed plans are moved out of date folders.
- Empty date folders are removed.
- Tester and docs-auditor results are recorded.

## Assumptions

- Plan filenames already include dates.

## Scope

- `scripts/harness.mjs`
- `.claude/plans/completed/**`

## Out Of Scope

- Changing plan filename convention.

## Required Reading

- `.claude/rules/workflow.md`

## Used Skills

- finish-task

## Spawned Agents

- tester
- docs-auditor

## File Ownership

- Harness plan lifecycle files.

## Implementation Steps

- Remove completed date subfolder logic.
- Move existing completed plans to completed root.
- Validate.

## Scripts Run

- `node --check scripts\harness.mjs`
- `npm run harness -- validate`
- `npm run harness -- docs detect`
- `npm run lint`
- `npm run type-check`

## Tester Result

Pass: `.claude/runs/2026-04-28-flatten-completed-plans/agents/tester-result.json`

## Docs-Auditor Result

Pass: `.claude/runs/2026-04-28-flatten-completed-plans/agents/docs-auditor-result.json`

## Docs Sync Exception

없음.

## Completion Checklist

- [x] Active plan exists before code edits
- [x] Worker implementation complete
- [x] Docs sync complete
- [x] tester result recorded
- [x] docs-auditor result recorded
- [x] Required checks passed
