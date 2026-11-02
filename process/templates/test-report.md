---
scope: INC-#        # INC-# | system (testing phase)
build: <commit / version / rc>
date: <YYYY-MM-DD>
result: pass         # pass | fail
recommendation: <release | release with known issues | do not release>   # system scope only
---
# Test report — <scope>

## Summary
<3–5 bullets: what was tested, main findings, recommendation>

## By test type

| Type | Executed | Passed | Failed | Skipped (reason) | Notes |
|---|---|---|---|---|---|
| T1 Unit | | | | | |
| T2 Integration | | | | | |
| T3 System | | | | | |
| T4 E2E | | | | | |
| T5 Acceptance | | | | | |
| T6 Performance/Load | | | | | |
| T7 Robustness | | | | | |
| T8 Regression | | | | | |
| T9 Smoke | | | | | |
| T10 Security | | | | | |
| T11 Usability/a11y | | | | | |
| T12 Compatibility | | | | | |
| T13 Migration/recovery | | | | | |
| T14 Exploratory | | | | | |

## Acceptance criteria and NFRs
See `docs/testing/traceability.md`. Failing or untested: <IDs or none>

## Measurements

| NFR | Target | Measured | Environment | Result |
|---|---|---|---|---|

## Coverage
<line/branch per area vs. target>

## Exploratory sessions

| Charter | Duration | Findings |
|---|---|---|

## Defects

| BUG | Severity | Status |
|---|---|---|

## Residual risks and untested areas
- …
