---
task: TASK-###
verdict: approved    # approved | changes_requested
independence: fresh  # fresh | self
date: <YYYY-MM-DD>
---
# Review TASK-###

## Checks
- [ ] Acceptance criteria implemented and tested
- [ ] Tests meaningful (would fail without the change), none weakened
- [ ] Architecture conformance (boundaries, dependencies, contracts, conventions)
- [ ] Error handling, validation, security basics
- [ ] No dead code / untracked TODOs; docs updated
- [ ] `check_sequence` green

## Findings

| # | Severity | Location | Problem | Expected fix |
|---|---|---|---|---|
