---
name: stabilize-and-review
description: Use this skill when Codex should stabilize the current implementation, run checks, fix failures, review the diff, and reduce release risk for the Windows gantt desktop app.
---

# Goal
Tighten quality on the current branch with a bug-fix and review mindset.

# Workflow
1. Read `AGENTS.md` and `PROJECT_STATUS.md`.
2. Inspect failing tests, lint issues, build errors, and risky diffs.
3. Fix the highest-impact issues first.
4. Add regression tests for each real bug fixed.
5. Run the relevant checks again.
6. Summarize residual risks and update state files.

# Review priorities
1. Data loss risk
2. Scheduling logic errors
3. Excel round-trip regressions
4. WBS hierarchy corruption
5. Performance cliffs in portfolio/year views
6. UX regressions in quick capture and drag rescheduling

# Constraints
- Keep scope minimal unless a deeper root cause is clearly connected.
- Findings matter more than fluff.
- Do not rewrite unrelated areas.
