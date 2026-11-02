---
status: draft
relates_to: [ASM-001, ASM-002, ASM-003, ASM-004]
---
# Open questions and assumptions

## Questions

| ID | Question | Raised by / in | Blocking | Status | Answer |
|---|---|---|---|---|---|

Status: `open` | `answered` | `obsolete`. Blocking questions are also listed in `docs/state.yaml` → `blocking_questions`.

## Assumptions

| ID | Assumption | Why needed | Affects | Validate by | Status |
|---|---|---|---|---|---|
| ASM-001 | Project name "Calc Viewer Builder" (from F-02); code lives in this repo `simple-calc-browser` | C01 not asked explicitly | spec, UI title | intake approval | active |
| ASM-002 | Customizable title, date and logo in the exported file is part of release 1 with priority Should | C99 gave the wish, not its priority | spec, FUN-04 | spec (shown at release) | active |
| ASM-003 | Acceptance examples (FUN-03) are derived by the agent in the spec; automated tests use public sample IFC files (e.g. buildingSMART samples); real project models may be supplied by the user for manual checks | user delegated details; no sample models provided | spec, tests | spec / testing | active |
| ASM-004 | Excel export as a real .xlsx produced by a small own writer in plain JS (no external library, works offline, ASCII-safe like html-modelviewer) | STK-01 plain JS, no build step | spec, implementation | spike in implementation | active |
| ASM-005 | Storey, material and type-pset extraction is feasible with That Open Fragments 3.4.7 relations (`ContainedInStructure`, `HasAssociations`, `IsTypedBy`/`DefinesOccurrence`) | not yet used in html-modelviewer | DAT-01, FUN-01 | first implementation task (spike) | active |

Status: `active` | `confirmed` | `rejected` (→ `/change`).
