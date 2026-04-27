# Testing Rules

Main agent must not run validation commands directly. Validation is accepted only from `tester` subagent output bound to the current run id, branch, worktree, commit head, and worktree hash.

## Base Checks

- `npm run check:auth`
- `npm run lint`
- `npm run type-check`
- `npm run harness -- validate`
- `npm run harness -- self-test`
- `npm run harness -- docs detect`

## Add Build When

Run `npm run build` when any of these changed:
- route/page/layout files
- Server Actions
- Supabase migrations or generated types
- package scripts or dependencies
- harness scripts or hooks

## Result Contract

`tester` writes `.claude/runs/<run-id>/agents/tester-result.json`:

```json
{
  "status": "pass",
  "agent": "tester",
  "run_id": "",
  "branch": "",
  "worktree": "",
  "commit_head": "",
  "worktree_hash": "",
  "commands_run": [],
  "failures": [],
  "summary": ""
}
```

`docs-auditor` writes `.claude/runs/<run-id>/agents/docs-auditor-result.json` with the same run-bound fields plus `docs_exception_approved`.

## Harness Self-Test

`npm run harness -- self-test` verifies main edit blocking, repo-outside edit blocking, duplicate active plan blocking, Bash test/build/git/write bypass blocking, tester-context exceptions, docs requirement detection, and current harness validation.
