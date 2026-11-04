# Change register

Owner: orchestrator. One row per CR, updated on every status change.

| CR | Title | Category | Size | Risk | Status | Depends on | Source | Earliest phase | Approved by / date | Release | Introduced bugs |
|---|---|---|---|---|---|---|---|---|---|---|---|
| CR-001 | REQ-002: openings (`IfcOpeningElement`) and ports (`IfcDistributionPort`) are not rows | requirement clarification | small | low | applied | – | verification INC-1 SYNC F1 (CR-A) | spec | human, release gate 2026-11-03 | 1.0.0 | none |
| CR-002 | Filter, erweiterter Filter, Eigenschaften und 3D-Werkzeuge wie im HTML Model Viewer; Tabelle volle Breite, rechtes Details-Panel entfällt | normal | feature | high | approved | – | user, 2026-11-04 | intake (cycle 2) | human, 2026-11-04 | 1.1.0 (planned) | – |

## Active locks
<!-- mirrors docs/state.yaml → active_changes -->
| CR | Locked artifacts / files |
|---|---|
| CR-002 | `calc-viewer-builder.html`, `docs/spec.md` (REQ-003..010, UI, §4.4, DEC-15), tests of REQ-003..010 |

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
