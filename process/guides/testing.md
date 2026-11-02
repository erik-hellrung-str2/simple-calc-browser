# Guide: testing (whole system)

Outcome and exit criteria: `kernel.md` §5. Role: tester (fresh context), developer for fixes. Defaults: `calibration/testing.md` (types, applicability, intensity per tier).

## Approach that works

- Freeze features on a release candidate; only fixes from here on, change requests are deferred. Never change code while a release-candidate or performance run is in progress — results then describe no real version.
- Prepare the environment and test data the tier calls for: realistic, boundary, invalid, volume.
- All seven core test types run in every tier (`kernel.md` §5a); the tier sets the depth. A release that only contains changes runs a scoped testing phase: the core types whose subject the changes touch, plus full regression and smoke.
- Go from cheap to expensive and fail fast: smoke, regression, system, E2E (every flow, every role), acceptance (every AC and NFR), robustness (test design checklist on every input, interface and state), performance, security, usability/compatibility/recovery where required, exploratory sessions with charters.
- Every finding: bug with severity and failing test; fix, re-test, re-run smoke and regression and the affected types; new release candidate. When bugs keep appearing in one area, stop at the escalation threshold and report — it is likely a design problem.
- Report per test type: executed or skipped with reason, results, measurements, coverage, open bugs, residual risks, release recommendation.
