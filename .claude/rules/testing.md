# Testing Rules

Main agent must not run validation commands directly. Validation is accepted only from `tester` subagent output.

## Base Checks

- `npm run check:auth`
- `npm run lint`
- `npm run type-check`

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
  "commands_run": [],
  "failures": [],
  "summary": ""
}
```
