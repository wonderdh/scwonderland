---
name: finish-task
description: Finish a SC Wonderland task by collecting tester/docs-auditor results and moving the plan to completed.
disable-model-invocation: true
---

Use this skill only after implementation and docs sync.

Steps:
1. Ensure tester wrote `.claude/runs/<run-id>/agents/tester-result.json`.
2. Ensure docs-auditor wrote `.claude/runs/<run-id>/agents/docs-auditor-result.json`.
3. Ensure the active plan checklist is complete.
4. Run `npm run harness -- finish <active-plan-file>`.
5. Run `npm run harness -- commit "<message>"` in the task worktree.
6. Run `npm run harness -- merge-main <branch>`.
7. Return to the main worktree at `C:\scwonderland`.
