# Guide: implementation

Outcome and exit criteria: `kernel.md` §5. Role: developer. Test scope per task: `calibration/testing.md` §3 ("per task").

## Approach that works

- Pick the next ready task of the current increment (dependencies done, not on hold); mark it in progress; parallel work on its own branch.
- Load only the task's context pack and the code in and around its scope.
- Tests first where feasible, for the relevant part only: unit tests for new logic incl. invalid and boundary input; integration tests where the task touches an interface; acceptance tests for ACs the task completes. Tag tests with type and IDs; see them fail for the right reason.
- Implement the minimum that satisfies the task within the architecture and frozen contracts.
- Run the task's tests and `check_sequence`; leave full E2E, load and security suites to later phases.
- Self-review the diff — every intended edit is in it (edits that silently did not apply are a common agent failure) — record summary, changed files, check results and deviations in the task; classify each deviation: `none`, `refinement` (inner detail of a component — document it as built) or `baseline` (touches a requirement, decision, contract or test target — raise a change request). Commit with the task ID. Status: `review` where the tier requires a code review (`done` after it), else `done`.
- When the design does not fit, stop and raise a change request instead of improvising architecture. When stuck, stop at the escalation threshold with a diagnosis.
