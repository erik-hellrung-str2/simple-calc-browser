---
status: draft
relates_to: [ASM-001, ASM-002, ASM-003, ASM-004, ASM-005, ASM-006, ASM-007, ASM-008]
---
# Open questions and assumptions

## Questions

| ID | Question | Raised by / in | Blocking | Status | Answer |
|---|---|---|---|---|---|
| Q-001 | Licence of the committed test fixture `Ifc2x3_Duplex_Architecture.ifc` (source repo youshengCode/IfcSampleFiles states none; origin buildingSMART/NIBS Common BIM Files) — keep, replace, or confirm | TASK-001a | no (before release) | answered | 2026-11-03: keep the fixture in the repository (test only, not in the product; user decision at release gate) |
| Q-002 | NFR-001 at 30k elements: is "interaction done" the last changed 3D frame drawn (met with the R-4 settle patch: 298-349 ms median in headless software WebGL) or pixels on screen (0.7-1.1 s in software WebGL; on a GPU estimated 150-300 ms, not measured)? | R-4 spike | no (before TASK-010) | answered | User 2026-11-02: last changed frame drawn counts; record a deviation for PCs without a GPU (software WebGL). |
| Q-003 | Group selection when the filter changes: only shrink and clear once empty (current), or follow the group's current members | TASK-006c | no (before release) | answered | User 2026-11-02: only shrink (current behaviour). |
| Q-004 | REQ-013-AC3 second half ("select a second wall in the table and `Isolieren` adds it") has no UI path: after isolating wall A no other element is in the table or clickable in 3D. Options: (a) correct AC3 via CR: two walls via a group row; (b) list removed rows greyed out; (c) DEC-18: `Isolieren` replaces the set | TASK-017a | yes (TASK-017a) | open | |

Status: `open` | `answered` | `obsolete`. Blocking questions are also listed in `docs/state.yaml` → `blocking_questions`.

## Assumptions

| ID | Assumption | Why needed | Affects | Validate by | Status |
|---|---|---|---|---|---|
| ASM-001 | Project name "Calc Viewer Builder" (from F-02); code lives in this repo `simple-calc-browser` | C01 not asked explicitly | spec, UI title | intake approval | confirmed (human, release gate 2026-11-03) |
| ASM-002 | Customizable title, date and logo in the exported file is part of release 1 with priority Should | C99 gave the wish, not its priority | spec, FUN-04 | spec (shown at release) | confirmed (human, release gate 2026-11-03) |
| ASM-003 | Acceptance examples (FUN-03) are derived by the agent in the spec; automated tests use public sample IFC files (e.g. buildingSMART samples); real project models may be supplied by the user for manual checks | user delegated details; no sample models provided | spec, tests | spec / testing | confirmed (human, release gate 2026-11-03) |
| ASM-004 | Excel export as a real .xlsx produced by a small own writer in plain JS (no external library, works offline, ASCII-safe like html-modelviewer) | STK-01 plain JS, no build step | spec, implementation | spike in implementation | confirmed (spike 2026-11-02: openpyxl + LibreOffice read the files; Excel itself untested → R-3) |
| ASM-005 | Storey, material and type-pset extraction is feasible with That Open Fragments 3.4.7 relations (`ContainedInStructure`, `HasAssociations`, `IsTypedBy`/`DefinesOccurrence`) | not yet used in html-modelviewer | DAT-01, FUN-01 | first implementation task (spike) | confirmed (spike 2026-11-02, re-checked: type via IsDefinedBy, storey via spatial tree, material via HasAssociations; IFC2X3 door/window styles need extra importer classes) |
| ASM-006 | Aggregates (IfcStair, IfcCurtainWall, IfcElementAssembly …) and their parts are both table rows; sums include both (spec DEC-3) | double counting rule not asked | REQ-002, REQ-006 | release gate | confirmed (human, release gate 2026-11-03) |
| ASM-007 | Supported browsers: current Chrome and Edge; Firefox best effort (spec DEC-8) | QLT-02 not asked at tier S | NFR-*, T12 | release gate | confirmed (human, release gate 2026-11-03) |
| ASM-008 | Grouping by a multi-valued property (e.g. `Material`) counts and sums an element in each of its groups; the total row counts it once (spec DEC-16) | affects quantity totals; not asked | REQ-006, REQ-008 | release gate | confirmed (human, release gate 2026-11-03) |

Status: `active` | `confirmed` | `rejected` (→ `/change`).
