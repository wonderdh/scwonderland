# Task Plan

Run ID: 2026-04-28-harness-hardening
Branch: claude/harness-hardening
Worktree: C:\scwonderland-worktrees\harness-hardening

## Goal

Harden the Claude harness so project rules are enforced by scripts and hooks, not only described in markdown.

## Success Criteria

- `npm run harness -- validate` passes on main and task worktrees.
- Project subagents are tracked under `.claude/agents/*.md`.
- Main protected edits, shell mutation, direct git publish commands, and direct test/build commands are blocked by self-test.
- Manifest includes all App Router Server Actions, including academy/admin/bus root actions.
- Docs sync detects route, action, shared lib, component, Supabase, and harness changes.
- `finish`, `commit`, and `merge-main` require run-bound tester/docs-auditor results.
- Plans use only `.claude/plans/active` and `.claude/plans/completed`.

## Assumptions

- Standard main worktree is `C:\scwonderland`.
- Task worktrees live under `C:\scwonderland-worktrees`.
- Raw `.claude/runs/**` artifacts are local-only; summaries remain in completed plans.

## Scope

- Harness scripts, hooks, project agents, skills/rules docs, manifest, structure, package scripts, and gitignore.

## Out Of Scope

- Product route behavior changes.
- Supabase schema changes.

## Required Reading

- `.claude/CLAUDE.md`
- `.claude/rules/workflow.md`
- `.claude/rules/testing.md`
- `.claude/rules/docs-sync.md`
- `HARNESS_MANIFEST.json`
- `STRUCTURE.md`

## Used Skills

- start-task
- docs-sync
- finish-task

## Spawned Agents

- tester: run final validation without source edits.
- docs-auditor: verify docs/manifest/structure drift and result contract.

## File Ownership

- Harness implementation: `scripts/harness.mjs`, `scripts/harness-self-test.mjs`, `.claude/hooks/harness-hook.ps1`.
- Claude assets: `.claude/agents/*.md`, `.claude/settings.json`, `.claude/skills/**`, `.claude/rules/**`.
- Project docs: `HARNESS_MANIFEST.json`, `STRUCTURE.md`, `.claude/routes/**`.
- Git/package integration: `.gitignore`, `.githooks/pre-commit`, `package.json`.

## Implementation Steps

- [x] Restore tracked project subagents and ignore raw run artifacts.
- [x] Harden hook path resolution, edit protection, Bash blocking, and subagent result validation.
- [x] Expand manifest/action scanning and docs sync coverage.
- [x] Add deterministic manifest/structure validation and self-test.
- [x] Strengthen finish/commit/merge gates.
- [x] Update rules, skills, structure, and manifest.
- [x] Delegate tester/docs-auditor validation and record result summaries.

## Scripts Run

- npm run harness -- run-info
- npm run harness -- validate
- npm run harness -- self-test
- npm run harness -- docs detect
- npm run check:auth
- npm run lint
- npm run type-check
- npm run build

## Tester Result

- pass — `.claude/runs/2026-04-28-harness-hardening/agents/tester-result.json`. validate, self-test (23 passed), docs detect (missingDocs=[]), check:auth, lint, type-check, build all OK.

## Docs-Auditor Result

- pass — `.claude/runs/2026-04-28-harness-hardening/agents/docs-auditor-result.json`. STRUCTURE.md/HARNESS_MANIFEST.json deterministic regen consistent, route docs no drift, docs detect missingDocs=[]. No exception.

## Docs Sync Exception

없음.

## Completion Checklist

- [x] Active plan exists before code edits
- [x] Worker implementation complete
- [x] Docs sync complete
- [x] tester result recorded
- [x] docs-auditor result recorded
- [x] Required checks passed
