---
name: implement-slice
description: Use this skill when Codex should implement one clearly bounded feature slice end-to-end for the Windows gantt desktop app without unnecessary user questions.
---

# Goal
Implement one bounded slice from the documented roadmap, including code, tests, and state updates.

# Read first
1. `AGENTS.md`
2. `PROJECT_STATUS.md`
3. Relevant files under `docs/`
4. `docs/backlog.yaml`
5. `docs/decisions.yaml`

# Workflow
1. Identify the exact backlog task or acceptance test closest to the user's request.
2. Read only the minimum relevant code and spec.
3. Implement the slice end-to-end.
4. Add or update tests.
5. Run the narrowest sufficient validation commands.
6. Self-review the diff for regressions.
7. Update `PROJECT_STATUS.md` and any touched spec docs.
8. End with: what changed, what passed, what remains.

# Autonomy rules
- Do not ask the user for minor implementation choices.
- Use defaults from `docs/10-agent-autonomy-policy.md`.
- Prefer shipping a working slice over discussing options.
- If blocked, document the blocker precisely and propose the next smallest move.

# Quality bar
- No silent failures
- No broad catch-and-ignore
- No unnecessary abstractions
- No leaving docs behind
