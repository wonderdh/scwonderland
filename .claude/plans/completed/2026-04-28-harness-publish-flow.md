# Harness Publish Flow Plan

Run ID: 2026-04-28-harness-publish-flow
Branch: claude/harness-bootstrap
Worktree: C:\scwonderland-worktrees\harness-bootstrap

## Goal

Add commit and main merge steps to the harness workflow.

## Success Criteria

- Harness exposes commit and merge-main subcommands.
- Workflow docs and finish skill mention commit and merge.
- STRUCTURE includes publish flow.
- Tester and docs-auditor results are recorded.

## Assumptions

- Main worktree path defaults to `C:\scwonderland`.
- Commit should run from a task branch, not `main`.
- Merge should run against a clean main worktree.

## Scope

- `scripts/harness.mjs`
- `.claude/CLAUDE.md`
- `.claude/rules/workflow.md`
- `.claude/skills/finish-task/SKILL.md`
- `STRUCTURE.md`
- `HARNESS_MANIFEST.json` if regenerated

## Out Of Scope

- Pushing to remote or opening a PR.

## Required Reading

- `.claude/rules/workflow.md`
- `.claude/skills/finish-task/SKILL.md`

## Used Skills

- docs-sync
- finish-task

## Spawned Agents

- tester
- docs-auditor

## File Ownership

- Harness publish flow files only.

## Implementation Steps

- Add commit and merge-main subcommands.
- Update help text and generated STRUCTURE workflow.
- Update Claude docs and finish skill.
- Validate through tester and docs-auditor.

## Scripts Run

- `npm run harness -- manifest`
- `npm run harness -- structure`

## Tester Result

Pass: `.claude/runs/2026-04-28-harness-publish-flow/agents/tester-result.json`

## Docs-Auditor Result

Pass: `.claude/runs/2026-04-28-harness-publish-flow/agents/docs-auditor-result.json`

## Docs Sync Exception

없음.

## Completion Checklist

- [x] Active plan exists before code edits
- [x] Worker implementation complete
- [x] Docs sync complete
- [x] tester result recorded
- [x] docs-auditor result recorded
- [x] Required checks passed
