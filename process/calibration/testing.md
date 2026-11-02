# Calibration: testing

> Calibration — defaults, not rules. The project's test strategy decides; deviations from these defaults are recorded with reason (`process/calibration/README.md`).

Which test types exist, which apply to which kind of project, and when they run. Tests run in three places with increasing breadth:

| When | Scope | Phase |
|---|---|---|
| **Per task** | only the relevant part: what the task changes | 4 Implementation |
| **Per increment** | acceptance of the increment's requirements + regression | 5 Verification |
| **Test phase** | everything, in all directions, on a release candidate | 6 Testing |

## 1. Test types

| # | Type | Tag | Purpose | Typical techniques |
|---|---|---|---|---|
| T1 | Unit test | `unit` | Single functions, classes, components in isolation | equivalence classes, boundary values, mocks/fakes for dependencies |
| T2 | Integration test | `integration` | Interaction of several components; component ↔ database / file system / external API; contract tests against `docs/design/contracts/` | real dependencies in containers or test doubles at the system boundary, contract verification |
| T3 | System test | `system` | The complete, deployed system against requirements, incl. configuration, startup, persistence | black-box, run the built artifact in a production-like environment |
| T4 | End-to-end test | `e2e` | Complete user flows from the user's point of view, through UI/CLI/API to storage and back | browser/app automation, CLI invocation, API call chains; one test per use-case flow and role |
| T5 | Acceptance test | `acceptance` | Every acceptance criterion `REQ-###-AC#` and every NFR is fulfilled | Given/When/Then executed literally; Full: plus human demo/UAT |
| T6 | Performance and load test | `perf` | Speed, stability and behaviour under load | load (expected), stress (beyond limits), spike, soak (long duration); measured against NFR targets |
| T7 | Robustness test | `robustness` | Behaviour on faulty, unexpected or extreme input and conditions | invalid/empty/huge/malformed input, special characters/encodings, fuzzing or property-based tests, fault injection (timeouts, unavailable dependencies, full disk), concurrency, interrupted operations |
| T8 | Regression test | `regression` | Nothing that worked before is broken | re-run all automated suites; every fixed bug gets a permanent test |
| T9 | Smoke test | `smoke` | The build starts and its most important function works at all | 3–10 fast checks after every build/deployment |
| T10 | Security test | `security` | Authentication, authorization, input handling, secrets, dependencies | access with wrong role/other user's data, injection (SQL, command, XSS), session handling, dependency vulnerability scan, static analysis (SAST); Full: DAST, threat-model-driven cases |
| T11 | Usability and accessibility test | `a11y` | UI is usable and meets the accessibility target | automated accessibility scan (e.g. axe), keyboard-only operation, heuristic review against UI requirements, text/translations complete |
| T12 | Compatibility test | `compat` | Works on the required browsers, OS, devices, runtime versions | test matrix from QLT-02 / UI-01 / STK-01 |
| T13 | Migration and recovery test | `recovery` | Data migration, backup/restore, rollback, failover work | migrate a copy of real-like data; restore from backup; deploy → rollback |
| T14 | Exploratory test | — | Find what scripted tests miss | time-boxed sessions with a charter ("try to break X as role Y"); findings become bugs and new scripted tests |

T1–T7 are the **core types, mandatory in every tier** (`process/kernel.md` §5a) — this file only calibrates their depth. T8–T14 complete them; regression (T8) and smoke (T9) are always required, the others are calibrated per tier.

## 2. Applicability by project type

`✓` required · `○` required if the condition holds · `–` not needed. Core types T1–T7 are always `✓`; the cells say what they cover at minimum. The design phase records the concrete form per type in `docs/testing/test-strategy.md`, including the reason for every `–`.

| Type | XS — script | S — mini app | M — medium app, several modules | L — complex app, DB, login, … |
|---|---|---|---|---|
| T1 Unit | ✓ | ✓ | ✓ | ✓ |
| T2 Integration | ✓ modules together; interplay with files, OS, called tools and APIs | ✓ components with storage and external services | ✓ incl. real database engine | ✓ incl. contract tests of every interface |
| T3 System | ✓ installed/packaged script in a clean environment with real configuration and files | ✓ clean install, configuration, startup, persistence | ✓ staging-like environment | ✓ production-like environment |
| T4 E2E | ✓ every user flow as invocation from input to output | ✓ every main flow | ✓ every key flow | ✓ every flow × role |
| T5 Acceptance | ✓ | ✓ | ✓ | ✓ + human demo / UAT |
| T6 Performance/Load | ✓ runtime and memory on realistic and large (≈ 10×) input against a baseline | ✓ response times of key operations, behaviour with large data sets | ✓ baseline + load test at expected peak | ✓ load, stress, spike, soak per NFR |
| T7 Robustness | ✓ inputs, files, arguments | ✓ | ✓ + fault injection on integrations | ✓ + fuzzing, concurrency, failover |
| T8 Regression | ✓ | ✓ | ✓ | ✓ |
| T9 Smoke | ✓ | ✓ | ✓ | ✓ + after every deployment |
| T10 Security | ○ secrets, untrusted input | ○ login or sensitive data | ✓ authN/Z, OWASP basics, dependency scan | ✓ + SAST, threat-model cases, DAST |
| T11 Usability/a11y | – | ○ GUI: heuristic review | ○ GUI: automated scan + review | ○ GUI: to target level UI-04 |
| T12 Compatibility | ○ several runtimes/OS | ○ specified | ✓ matrix from QLT-02 | ✓ full matrix |
| T13 Migration/recovery | – | – | ○ brownfield or data migration | ✓ backup/restore, migration, rollback |
| T14 Exploratory | ✓ short | ✓ | ✓ per module | ✓ per module and role |

Test pyramid: most tests are unit tests, fewer integration tests, few E2E tests. Do not cover with an E2E test what a unit test can verify.

## 2a. Intensity by project type

The same test types are tested with different depth and rigour.

| Aspect | XS — script | S — mini app | M — medium app | L — complex app |
|---|---|---|---|---|
| Per-task tests (phase 4) | relevant unit + robustness tests, integration tests of touched interfaces | same | same | same + contract tests |
| Increment tests (phase 5) | — (single increment) | — (single increment) | acceptance, new E2E flows, regression | same + human demo per increment |
| Test environment (phase 6) | local | local, clean install from scratch | staging-like: real database engine, services in containers | production-like: production configuration, realistic data volume |
| Tester independence | separate pass by the same agent, working only from the spec | fresh session preferred | separate context mandatory | separate context mandatory + human acceptance (UAT) |
| Coverage target (default, override in the test strategy) | every public function tested | ≥ 70 % of logic | ≥ 80 % of domain logic | ≥ 80 % of domain logic, ≥ 90 % branch coverage on critical paths (auth, payment, data integrity) |
| Robustness depth (T7) | invalid arguments, missing/corrupt files, empty and huge input | + every form and input field | + fault injection on every integration | + fuzzing / property-based tests, concurrency, failover |
| Performance (T6) | runtime/memory baseline on realistic and ≈ 10× input | key operations baseline + large data sets | baseline + load at expected peak | load, stress, spike and soak tests |
| Security (T10) | secrets, untrusted input | + login and access rules if present | authN/Z matrix, OWASP basics, dependency scan | + SAST, threat-model cases, DAST |
| Exploratory (T14) | 1 charter | 2–3 charters | 1 charter per module | 1 charter per module × role |
| Fix-loop escalation (phase 6) | after 2 rounds | after 3 rounds | after 3 rounds | after 3 rounds; user informed of every blocker immediately |
| Test report | `docs/spec.md` §6 | `docs/spec.md` §6 | `docs/testing/reports/` | `docs/testing/reports/` + UAT sign-off |

## 3. When each type runs

| Type | Per task (phase 4) | Per increment (phase 5) | Test phase (phase 6) | Release (phase 7) |
|---|---|---|---|---|
| T1 Unit | new/changed logic | full suite | full suite | — |
| T2 Integration | if the task touches an interface | full suite | full suite | — |
| T3 System | — | M/L: increment build installs and starts in a clean environment | ✓ | — |
| T4 E2E | — | new flows of the increment | all flows | — |
| T5 Acceptance | ACs the task completes (if executable at this level) | all ACs of the increment | all ACs and NFRs | — |
| T6 Perf/Load | only tasks targeting an NFR | quick benchmark of key operations against the baseline | ✓ | — |
| T7 Robustness | invalid/boundary input of new code (unit level) | increment's inputs and integrations | ✓ all directions | — |
| T8 Regression | fast suite (`test_fast`) | all automated suites | all automated suites, after every fix | final run on release commit |
| T9 Smoke | — | ✓ | ✓ first | ✓ after deployment |
| T10 Security | security-relevant code: unit-level cases | M/L: authZ cases of new endpoints | ✓ | dependency scan |
| T11 Usability/a11y | — | GUI: automated scan of new screens | ✓ | — |
| T12 Compatibility | — | — | ✓ | — |
| T13 Migration/recovery | — | — | ✓ | rollback rehearsal (L) |
| T14 Exploratory | — | short session on the increment | ✓ | — |

"Only the relevant part" per task means: the developer writes and runs tests for what the task changes, plus the fast suite. Full suites, E2E, performance, security scans and the like belong to phases 5 and 6.

## 4. Conventions

- **Tags.** Every test carries its type tag (§1) and, where it verifies a requirement, the ID (`REQ-012-AC2`, `NFR-003`). Suites must be runnable per tag. Mechanism (directories, markers, name prefixes) is chosen in design and recorded in the test strategy.
- **Commands.** `AGENTS.md` §4 → `tests:` lists one command per tag plus `test_fast` (unit + integration without slow dependencies) and `test_all`.
- **Independence.** Acceptance, system, E2E, robustness and exploratory tests are designed by the tester from the requirements, not derived from the implementation.
- **Test data.** Defined in the test strategy: realistic samples, boundary sets, invalid sets, volume sets for performance; no real personal data. Plan how tests reach time-dependent states (injected clock, pinned "today") and states the user interface can no longer produce (data from older versions, past dates) — usually by seeding the store directly.
- **Performance measurements** (T6): median of ≥ 3 runs on a quiet machine, environment recorded, with concurrent clients where the system serves several users. Every load step checks its response status, and load users hold the roles needed to reach every measured page — a fast error page is not a measurement. The load mix includes the pages whose cost grows with data (lists, overviews, reports). Report the margin to the target; a margin below ~10 % is a residual risk shown at the gate. The test strategy names the performance-critical code paths (hot loops, queries, list pages), so impact analyses can check them. No code changes while a performance or release-candidate run is in progress.
- **Determinism.** No sleeps, no dependence on test order, time or network unless the test type requires it. A flaky test is a bug: fix it or quarantine it with a `BUG-###`, never silently retry.
- **Coverage.** Line/branch coverage is a signal, not a goal. Default targets by project type: §2a (override in the test strategy). Always: every acceptance criterion and NFR covered by ≥ 1 acceptance-level test (T5, `process/kernel.md` §5a).
- **Bugs.** Every bug found gets a failing test first (regression protection), then the fix.
- **Assertions that cannot pass by accident.** A test of a refusal asserts the specific reason (message or code), so it cannot pass on a different rule; a new test is seen failing for the right reason before the fix. Tests do not assert the absence of features planned for later increments.

## 5. Test design checklist (apply in all directions)

For each requirement, input, interface and state, consider:
- **Valid:** typical values, every equivalence class, every role
- **Boundaries:** min, max, min−1, max+1, empty, one element, very large
- **Invalid:** wrong type, malformed format, missing required fields, injection strings, unexpected encoding/Unicode, negative numbers, past/future dates
- **State:** every state transition allowed and forbidden, repeated actions (double submit), interrupted operations
- **Environment:** dependency down/slow/returning errors, full disk, no network, clock changes/time zones, concurrent users on the same data
- **Permissions:** every role × action, access to other users'/tenants' data
- **Volume:** many records, large files, long-running sessions
