---
status: draft        # draft | approved
date: <YYYY-MM-DD>
---
# Test strategy — <project>

Project type: <XS script | S mini app | M medium app | L complex app>. Catalogue and defaults: `process/calibration/testing.md`.

## Test types

### Core types — mandatory in every tier (`process/kernel.md` §5a)

Define the meaningful form for this project. Omitting one requires a reason and the user's explicit confirmation.

| Type | Concrete form for this project | Tool / framework | Command (`AGENTS.md` §4) |
|---|---|---|---|
| T1 Unit | | | |
| T2 Integration | interfaces: | | |
| T3 System | environment: | | |
| T4 E2E | flows: | | |
| T5 Acceptance | all REQ ACs, all NFRs | | |
| T6 Performance/Load | targets (NFR or proposed baseline); load mix incl. pages that grow with data; concurrent clients and their roles; performance-critical paths: | | |
| T7 Robustness | inputs, interfaces, states: | | |

### Further types (calibrated per tier)

| Type | Required | Reason if not | Scope / focus | Tool / framework | Command |
|---|---|---|---|---|---|
| T8 Regression | yes | | | | `test_all` |
| T9 Smoke | yes | | checks: | | |
| T10 Security | | | | | |
| T11 Usability/a11y | | | target: | | |
| T12 Compatibility | | | matrix: | | |
| T13 Migration/recovery | | | | | |
| T14 Exploratory | yes | | charters: | — | — |

## Tagging
<how tests are tagged by type and requirement ID, e.g. directory per type + ID in test name>

## Environments
| Environment | Used for | How to start |
|---|---|---|

## Test data
| Set | Content | Location / generator |
|---|---|---|
| realistic | | |
| boundary | | |
| invalid | | |
| volume | | |
| time-dependent / unreachable states | pinned clock, directly seeded data | |

## Targets
- Coverage: <e.g. ≥ 80 % domain logic>
- Performance: <NFR IDs and thresholds>
- Exit criteria testing phase: as in `process/kernel.md` §5 (testing), plus: <project-specific>

## Change history

| Date | CR | Change |
|---|---|---|
