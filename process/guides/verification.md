# Guide: verification (per increment)

Outcome and exit criteria: `kernel.md` §5. Roles: reviewer, tester. Scope: the increment; broad testing happens in the testing phase.

## Approach that works

- **Code review** (Standard/Full) in a fresh context with the task, the diff and the relevant design only. Look for: ACs implemented and tested by tests that would fail without the change; no weakened tests; architecture and contract conformance; error handling, validation, security basics; no dead code or untracked TODOs. Findings with severity and expected fix in `docs/reviews/TASK-###.md`.
- **Increment tests** from the requirements, not from the code: acceptance tests for the increment's ACs, E2E for its new flows, robustness for its new inputs, full regression and smoke; for M/L a quick benchmark, authorization cases, accessibility scan and a short exploratory session where relevant.
- Bugs get an ID, severity, reproduction steps and a fix task that starts with a failing test.
- **Spec–code sync**: resolve every deviation recorded in the increment's tasks — refinements documented as built, baseline deviations turned into CRs; check that architecture and contracts still describe the code and contract tests are green.
- Update traceability and write the increment report.
- Lean: after the last task, do the spec–code sync and the self-review once (deviations resolved, `docs/spec.md` design describes the code); the increment tests themselves are covered by the testing phase.
