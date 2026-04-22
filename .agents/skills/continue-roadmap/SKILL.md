---
name: continue-roadmap
description: Use this skill when Codex should inspect repo state and continue the highest-priority unfinished roadmap work with minimal user supervision.
---

# Goal
Resume implementation from the current repository state without asking the user to restate context.

# Inputs
- Current codebase
- `PROJECT_STATUS.md`
- `docs/backlog.yaml`
- `docs/08-implementation-plan.md`
- `docs/09-acceptance-tests.md`

# Execution rules
1. Determine the highest-priority unfinished task that is realistically completable in the current session.
2. Verify related acceptance tests and spec sections.
3. Implement the slice.
4. Test it.
5. Update status and backlog markers if appropriate.
6. Leave the repo in a re-runnable state.

# Stop conditions
- Hard blocker requiring credentials, external approval, or conflicting specs
- Current repo is broken in a way that must be repaired first

# Output requirements
- Completed slice
- Validation results
- Updated `PROJECT_STATUS.md`
- Clear next slice
