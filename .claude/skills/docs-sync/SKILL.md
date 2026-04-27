---
name: docs-sync
description: Detect and update required markdown docs after structural code changes in SC Wonderland.
---

Use after code changes and before tester validation.

Steps:
1. Run or ask docs-auditor to run `npm run harness -- docs detect`.
2. Update all required docs listed in the output.
3. If no docs update is needed, record the reason in `Docs Sync Exception`.
4. Ask `docs-auditor` to approve the exception before finish.
