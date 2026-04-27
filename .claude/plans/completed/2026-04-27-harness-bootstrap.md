# Harness Bootstrap Plan

Run ID: 2026-04-27-harness-bootstrap
Branch: claude/harness-bootstrap
Worktree: C:\scwonderland-worktrees\harness-bootstrap

## Goal

Implement the SC Wonderland Claude harness v6.

## Success Criteria

- Harness command exists at `scripts/harness.mjs`.
- `HARNESS_MANIFEST.json` and `STRUCTURE.md` exist.
- Claude hooks, agents, skills, and rules exist.
- Missing route docs are added.
- Docs sync detects required docs for structural changes.
- tester and docs-auditor results are recorded before finish.

## Assumptions

- Claude Code executes hook commands from the project root.
- The harness should avoid new runtime dependencies.
- Tester validation is recorded through subagent result JSON.

## Scope

- Harness docs, scripts, hooks, agents, skills, route docs, manifest, structure, package script, pre-commit hook.

## Out Of Scope

- Jest/Playwright installation.
- Product feature changes.
- Supabase schema changes.

## Required Reading

- `.claude/CLAUDE.md`
- `.claude/rules/workflow.md`
- `.claude/rules/docs-sync.md`
- `.claude/rules/testing.md`
- `.claude/routes/_index.md`

## Used Skills

- start-task
- docs-sync
- finish-task

## Spawned Agents

- tester
- docs-auditor

## File Ownership

- Harness bootstrap owns `.claude/**`, `scripts/harness.mjs`, `HARNESS_MANIFEST.json`, `STRUCTURE.md`, `package.json`, `.githooks/pre-commit`.

## Implementation Steps

- Create harness worktree.
- Add single harness script.
- Add Claude settings, agents, skills, plan template, and rules.
- Add missing route docs.
- Generate manifest and structure.
- Run harness validation through tester and docs audit.

## Scripts Run

- `git worktree add -b claude/harness-bootstrap C:\scwonderland-worktrees\harness-bootstrap main`
- `npm run harness -- manifest`
- `npm run harness -- structure`
- `node --check scripts\harness.mjs`
- `npm run harness -- validate`
- `npm run harness -- docs detect`

## Tester Result

Pass: `.claude/runs/2026-04-27-harness-bootstrap/agents/tester-result.json`

## Docs-Auditor Result

Pass: `.claude/runs/2026-04-27-harness-bootstrap/agents/docs-auditor-result.json`

## Docs Sync Exception

없음.

## Completion Checklist

- [x] Active plan exists before code edits
- [x] Worker implementation complete
- [x] Docs sync complete
- [x] tester result recorded
- [x] docs-auditor result recorded
- [x] Required checks passed
