# Change register

Owner: orchestrator. One row per CR, updated on every status change.

| CR | Title | Category | Size | Risk | Status | Depends on | Source | Earliest phase | Approved by / date | Release | Introduced bugs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| CR-001 | REQ-002: openings (`IfcOpeningElement`) and ports (`IfcDistributionPort`) are not rows | requirement clarification | small | low | applied | – | verification INC-1 SYNC F1 (CR-A) | spec | human, release gate 2026-11-03 | 1.0.0 | none |
| CR-002 | Filter, erweiterter Filter, Eigenschaften und 3D-Werkzeuge wie im HTML Model Viewer; Tabelle volle Breite, rechtes Details-Panel entfällt | normal | feature | high | applied | – | user, 2026-11-04 | intake (cycle 2) | human, 2026-11-04 (CR); release gate 1.1.0 human, 2026-11-07 | 1.1.0 | found in testing cycle 2 (`docs/testing/report-INC-2.md`): BUG-T5 (major), BUG-T6..BUG-T10 fixed and verified; BUG-T11 fixed by TASK-021 (user decision Q-005); BUG-T12, BUG-T13 known limitations (user decisions Q-006, Q-007); BUG-T14 flaky test fixed in the test. None open |
| CR-003 | Spec §4.4 names the test seam `CalcView.contextState()`; §4.2 and `AGENTS.md` source layout list `test/acceptance`, `test/support`; as-built wording of the synchronous display-text index build (§4.3, NFR-001) and of the property order (REQ-012, REQ-005) (text only) | documentation sync | small | low | applied | CR-002 | verification INC-2 SYNC-6 (CR-C); scope extended at the release gate by C.1 / C.3 (SYNC-1, SYNC-2 (a) wording) | spec | human, release gate 1.1.0, 2026-11-07 | 1.1.0 | none |

## Active locks
<!-- mirrors docs/state.yaml → active_changes -->
| CR | Locked artifacts / files |
|---|---|

## Project standard changes
<!-- additions to process/calibration/change.md §3 for this project -->
| ID | Change type | Extra condition |
|---|---|---|

## Impact checklist additions
<!-- searches added after a PIR found a missed dependency type -->
| Added by | Search to run in every impact analysis |
|---|---|

## Lessons
| CR | Lesson | Action taken |
|---|---|---|
