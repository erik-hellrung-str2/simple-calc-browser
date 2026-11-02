---
id: TASK-###
title: <imperative, short>
type: feature        # feature | enabler | spike | bug | refactor
increment: INC-#
status: todo         # todo | in_progress | review | done | blocked | on_hold | superseded
on_hold_by: null     # CR-### while a change request affects this task
change: null         # CR-### if the task was created by a change request
implements: []       # REQ-###-AC#, NFR-###, BUG-###
depends_on: []
parallel_safe: false
touches:             # files/directories this task may change
  - <path>
---
# TASK-###: <title>

## Objective
<What exists after this task that did not before. Spike: the question to answer and the time box.>

## Context pack
Read these and nothing else besides `AGENTS.md` §4:
- `docs/requirements/requirements.md` → REQ-###
- `docs/design/architecture.md` → <section>
- `docs/design/contracts/<file>`

## Instructions
- <where to put things, which existing pattern to follow, pitfalls>

## Acceptance

| Check | How | Expected |
|---|---|---|
| REQ-###-AC1 | test referencing the ID | passes |
| Definition of Done | `check_sequence` | all green |

## Done checklist
- [ ] Every implemented AC has a test referencing its ID that fails without the change
- [ ] `check_sequence` green (results below)
- [ ] Only `touches` changed, otherwise listed under deviations
- [ ] No untracked TODO/FIXME; affected docs/contracts updated

## Result
<!-- Filled in by the developer. -->
- Summary:
- Changed files:
- Check results: <command → pass/fail>
- Deviations: <each with class: none | refinement (documented as built: where) | baseline (CR-###)>
- Questions raised:
