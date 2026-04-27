---
name: finish-task
description: Finish a SC Wonderland task by collecting tester/docs-auditor results and moving the plan to completed.
disable-model-invocation: true
---

Use this skill only after implementation and docs sync.

Steps:
1. Run `npm run harness -- run-info`.
2. Ensure tester wrote `.claude/runs/<run-id>/agents/tester-result.json` with the current run id, branch, worktree, commit head, and worktree hash.
3. Ensure docs-auditor wrote `.claude/runs/<run-id>/agents/docs-auditor-result.json` with the same run-bound fields.
4. Ensure docs exceptions are either none or approved by docs-auditor.
5. Ensure the active plan checklist is complete.
6. Run `npm run harness -- finish <active-plan-file>`.
7. Run `npm run harness -- commit "<message>"` in the task worktree.
8. Run `npm run harness -- merge-main <branch>`.
9. Return to the main worktree at `C:\scwonderland`.
