# Calibration: change

> Calibration — defaults, not rules. Binding principles: `process/kernel.md` §7. Deviations recorded with reason (`process/calibration/README.md`).

Defaults for classifying, assessing and approving changes. Approach: `process/guides/change.md`.
Principle: every change to a baseline is recorded, analysed from evidence (not guessed), approved according to its risk, isolated so it can be undone, tested in proportion to its impact, and reviewed afterwards.
**All defaults scale with the project tier — see §10.** Where §10 is lighter or stricter for the tier, §10 wins.

## 1. When a change request (CR) is needed

| Situation | Handling |
|---|---|
| Artifact still `draft` (not yet approved) | Edit directly. No CR. |
| Working document: plan, increments, tasks (split, merge, reorder), reports, traceability, Lean working sections (`process/kernel.md` §2 → Baseline) | Edit directly, note it in the document's history or `docs/process-log.md`. No CR. |
| Refinement inside a component: changes no requirement, decision, contract or test target | Implement and document as built. No CR. |
| Additive change to an **internal** contract (new method or optional field, existing callers unaffected) | Refinement: add it to the contract, marked _as built_. No CR. A breaking change, or any change to an external or public contract, needs a CR. |
| Answer to an open question, no baseline effect | Record the answer. No CR. |
| Behaviour violates an existing, approved REQ/AC (bug) in **not yet released** behaviour | `BUG-###` + fix task. No CR. |
| Any change to the baseline: requirements, UI specification, architecture decisions, ADR, contract, core test strategy | CR |
| New capability, removed capability, changed priority | CR |
| Rejected assumption (`ASM-###` → rejected) | CR |
| Design gap found during implementation or testing | CR (raised by the agent) |
| Dependency or runtime upgrade, infrastructure or configuration change | CR (often category `standard`) |
| Bug in **released** behaviour | CR with linked `BUG-###` (category by §2) |

Rule of thumb: what binds others (requirements, decisions, interfaces, test targets) changes only through a CR; how the work is organised and the inner details of a component change freely, with a trace.

## 2. Categories

Apply the first matching row. Check the standard catalogue (§3) before settling on `normal` — a post-release bug fix that restores specified behaviour is usually STD-1. Classifying it as `normal, low` is not cheaper: a `normal` CR that changes released behaviour needs a human (§5).

| Category | Criteria (all must hold) | Approval | Record |
|---|---|---|---|
| `emergency` | released system is down or unusable for a core flow, **or** a security vulnerability is exploitable in a released version, **or** data is being lost/corrupted | human, immediately (minimal analysis first) | full CR, completed after the fix; PIR mandatory |
| `standard` | matches an entry of the standard catalogue (§3) **and** risk level `low` (§4) | agent (automated gates) | short CR (header, request, impact list, tests, rollback) + register entry |
| `normal` | everything else | per approval matrix (§5) | full CR |

### 3. Standard catalogue (pre-approved change types)

| ID | Change type | Extra condition |
|---|---|---|
| STD-1 | Fix of a post-release bug that restores the specified behaviour | one component, no REQ/contract/data-schema change |
| STD-2 | Text, label, translation or documentation correction | no change in meaning of a REQ/AC |
| STD-3 | Dependency update: patch version, or minor version without breaking changes in its changelog | full regression green |
| STD-4 | Additional tests, test fixes that do not weaken assertions | — |
| STD-5 | Refactoring without behaviour change | inside one component, public interfaces unchanged, regression green |
| STD-6 | Configuration value change within documented ranges | not security-relevant |

The catalogue may be extended per project; record additions in `docs/changes/register.md` → "Project standard changes".

## 4. Risk assessment

Score each factor from evidence gathered in the impact analysis.

| # | Factor | 0 | 1 | 2 |
|---|---|---|---|---|
| R1 | Baseline artifacts | none | REQs added | REQ/NFR changed or removed; ADR or UI structure changed |
| R2 | Blast radius (components) | 1 | 2–3 | > 3, or cross-cutting (auth, logging, data access, config) |
| R3 | Completed work affected | none | open tasks change | done tasks / released behaviour change |
| R4 | Data | no schema/data change | additive schema change | destructive change, data migration, or format change of stored data |
| R5 | Interfaces | none | internal interface, or backwards-compatible addition to a public interface (new optional flag, field, endpoint) | breaking change of an external or public contract (API, CLI, file format, events) |
| R6 | Security / compliance | not relevant | touches authN/Z, personal data, secrets, or audit | changes a security mechanism or compliance-relevant behaviour |
| R7 | Reversibility | `git revert` is enough | needs a down-migration or config rollback | irreversible (data loss, sent messages, external side effects) |
| R8 | Test safety net in affected area | strong (unit + integration + acceptance) | partial | weak or none |
| R9 | Defect history | no bugs in affected area | 1–2 bugs | ≥ 3 bugs, or a previous CR here caused a bug |

| Total | Risk level |
|---|---|
| 0–3 | `low` |
| 4–8 | `medium` |
| ≥ 9 | `high` |

Override to `high` regardless of total when any of these is 2: R4, R5, R7. Never downgrade a computed level.

## 5. Approval matrix

| | guided | standard (default) | autonomous |
|---|---|---|---|
| `standard` | agent | agent | agent |
| `normal`, low | human | agent (user is informed) | agent (user is informed) |
| `normal`, medium | human | human | agent (user is informed) |
| `normal`, high | human | human | human |
| `emergency` | human | human | human |
| any CR changing released behaviour (except `standard`) | human | human | human |
| feature-size CR (§11) | human | human | human |

Before a human approval for risk `medium`/`high`, a **change review** runs: the reviewer role, in a fresh context, checks the impact analysis for completeness against the evidence (§6) and lists anything missed. The human sees both.

"User is informed" means: the CR summary is shown as a fact and work proceeds; the user can stop or change it with `/change` (mentioned only in a question's description, never as an invitation in text).

Approving a CR approves the resulting baseline delta — the changed artifacts are baselined with the CR's approval. Phase gates are not repeated, except when the CR reopens a phase (feature-size change, §11, or a jump back to an earlier phase): then the reopened phases end with their regular gates for the delta. Feature-size CRs always need human approval.

## 6. Impact analysis — evidence, not estimates

The impact analysis must be reproducible. Record every search used in the CR's "Evidence" section.

1. **Trace links.** Search all `docs/` for every directly affected ID (REQ, NFR, ADR, CMP, contract, UI screen) and follow the links: REQ → AC → tasks → tests (`docs/testing/traceability.md`) → code.
2. **Code dependencies.** For every code unit expected to change: find its callers and callees (search for symbol references, imports, routes, event names, config keys, DB tables/columns). Repeat one level further for public interfaces.
3. **Runtime and data.** Configuration, environment variables, scheduled jobs, queues, external APIs, stored data and its consumers (exports, reports, other systems). Data created under the old rule: does any later step re-validate it, and what should happen to it? (Ask, don't assume.)
4. **Tests.** Tests that verify affected ACs (search IDs as `REQ[-_]###`) and tests that exercise affected code; new tests needed. List every test whose **expected values** change, with file and new expectation — run the suites against a prototype of the change if unsure. For each core test type (`process/kernel.md` §5a): is its subject touched? Explicitly check the performance-critical paths named in the test strategy — any change inside them triggers T6. Tests the strategy names for an affected area must exist; a missing one is written, not assumed.
5. **Open work.** Tasks `todo`/`in_progress`/`review` that touch affected artifacts or files; other active CRs that touch the same requirement block, change-history table, contract or file → locks, `depends_on` or merge order, and a full regression after integrating them.
6. **Phase.** Earliest affected phase (requirements, design, planning, implementation).
7. **Prediction.** List the files and components expected to change — compared with the actual diff in the post-implementation review.
8. **Project checklist.** Run every search listed in `docs/changes/register.md` → "Impact checklist additions".
9. **Earlier changes.** Which earlier CRs last changed the same files, requirements or contracts → `depends_on` (§12).
10. **Size.** Change or feature-size (§11).

## 7. Phase-dependent rules

| Current phase | Rule |
|---|---|
| intake – planning | Draft artifacts are edited directly; only approved ones need a CR. |
| implementation / verification | Affected tasks go `on_hold` (by CR) until the CR is approved and applied. Unaffected tasks continue. |
| testing (feature freeze) | Only bug fixes. Normal CRs are `deferred` to after the release unless the user explicitly decides otherwise; then the testing phase restarts for the affected scope. |
| release | No CRs except `emergency`; others are deferred. |
| maintenance (after release) | Approved CRs are bundled into the next increment(s), go through testing and a new release. |

## 8. Concurrency

- A CR "locks" the artifacts and files in its impact analysis while `approved`/`in_progress` (`docs/state.yaml` → `active_changes`).
- Two CRs with overlapping impact are never in progress at the same time: the later one waits (`queued`) and is re-analysed when the earlier one is done, because its impact may have changed.
- Each CR is implemented on its own branch `change/CR-###-<slug>`; merged only after its tests pass.

## 9. Versioning

| Change effect | Version bump (SemVer) |
|---|---|
| breaking change of an external interface or stored data format | major |
| new or changed functionality, backwards compatible | minor |
| bug fix, standard change | patch |
| emergency fix | patch (hotfix release) |

## 10. Scaling by project tier

A one-line fix in a script must not need the paperwork of a change in a complex application — and a change in a complex application must not get away with the rigour of a script.

| Aspect | XS — script | S — mini app | M — medium app | L — complex app |
|---|---|---|---|---|
| Record | **change note**: row in `docs/spec.md` → "Change history" (request, affected IDs, tests, result) + register row; no CR file | **short CR**: CR file with header and sections 1, 3 (table only), 6, 7, 10 (one line each) | full CR | full CR |
| Categories | `standard`, `normal` (`emergency` only if others run released versions) | all | all | all |
| Impact analysis (§6) | steps 1, 4, 9, 10: trace IDs in `docs/spec.md`, search changed functions and their tests, earlier CRs, size | steps 1, 2 (direct callers), 4, 5, 9, 10 | steps 1–10 | steps 1–10; public interfaces traced two levels deep; data consumers outside the system |
| Risk (§4) | no score; check R4, R5, R7 only — any ≥ 1 → handle the CR as tier S | R1–R9 | R1–R9 | R1–R9 with stricter levels: `medium` from 3, `high` from 7 |
| Change review (independent) | — | — (self-check against the §6 list) | risk `medium`/`high` | every `normal` and `emergency` CR |
| Approval | matrix §5 | matrix §5 | matrix §5 | matrix §5, plus human for every CR with R4, R5 or R6 ≥ 1 |
| Isolation | commit prefix + tag `pre-CR-###` | branch + tag | branch + tag + locks (§8) | branch + tag + locks; feature flag for risky behaviour changes |
| Tests | see "Tests after a change" | | | |
| Delivery | new version right after the tests | release after a short test pass | next increment → scoped testing phase → release | bundled into an increment → scoped testing phase → staged rollout (OPS-02) |
| Rollback | `git revert` | `git revert` + data steps if any | rollback plan; tested if R7 ≥ 1 | rollback plan always tested; rehearsal in test environment for risk `high` |
| Post-implementation review | one line in the change note | short: goal met, unexpected files | full | full; lessons into the impact checklist mandatory |

### Tests after a change

| XS — script | S — mini app | M — medium app | L — complex app |
|---|---|---|---|
| affected unit tests, robustness cases for changed inputs, acceptance tests of changed ACs, full suite, one end-to-end run | XS + E2E of affected flows + smoke | minimum scope table below + scoped testing phase with the test types triggered by the risk factors | minimum scope table + scoped testing phase with every test type the test strategy requires for the affected areas, full regression of all suites, T6 if an NFR-relevant component is touched, T10 if R6 ≥ 1, T12 if UI or runtime changed |

### Minimum test scope (M, L)

Derived from the impact analysis, never smaller than:

| Always | Additionally if … |
|---|---|
| unit + integration tests of every affected component | R5 ≥ 1: contract/integration tests of the interface and its consumers |
| acceptance tests of every new/changed AC | R4 ≥ 1: migration test incl. rollback on a copy of realistic data (T13) |
| full regression (`test_all`) | R6 ≥ 1: security tests (T10) of the affected mechanism |
| smoke | NFR affected: performance test (T6) of the affected operations |
| robustness cases for new/changed inputs | UI changed: E2E of affected flows, accessibility scan (T11) |
| | risk `high`: rehearse the rollback in a test environment |

In every tier, each core test type (`process/kernel.md` §5a) whose subject the change touches is re-run — e.g. T2 when an interface changes, T6 when performance-relevant code changes, T4 when a user flow changes. Intensity of each test type follows `process/calibration/testing.md` §2a for the tier.

### When a change makes the project bigger

If the complexity re-score of a CR raises the tier (e.g. a script gets a GUI and a database), the CR includes the **track migration** (`process/calibration/complexity.md` §6). From the moment the CR is approved, all rules of the new tier apply — including to this CR's own tests.

## 11. Change or feature cycle?

Determine the size during impact analysis. A CR is **feature-size** when any of these holds:

- a new capability that needs its own interview — new use cases, screens or rule sets that cannot be settled in one short clarification round
- a new component, role, external integration or data class
- more than ~5 new or changed requirements, or growth of more than ~25 % of the existing requirements
- the complexity re-score changes the tier

A feature-size CR opens a new **delivery cycle** (`process/kernel.md` §4) with the CR as umbrella:

1. scoped intake for the new part — only the information needs it raises, at the tier's depth
2. requirements, design and planning for the delta, each with its regular gate
3. implementation and verification in new increments, testing phase, release of the next version

Everything else is a **change**: it runs through the change procedure and ships with the next release. Several small CRs on the same new topic are a feature in disguise — bundle them into one cycle.

## 12. Dependencies between changes

- A CR records the earlier CRs it builds on (`depends_on`), found during impact analysis (the same files, requirements or contracts were last changed by them).
- Rolling back a CR first requires rolling back — or explicitly re-basing — every later CR that depends on it, newest first. The rollback proposal lists them.

## 13. Emergency hotfix

| Default | Value |
|---|---|
| Starting point | released tag, branch `change/CR-###-hotfix` |
| Minimum tests before the hotfix release | the new failing-then-passing test reproducing the problem, unit + integration of the affected component, smoke, full regression if it finishes in reasonable time |
| Afterwards, in the same session | complete CR record (impact, risk, rollback), remaining tests of the scope above, merge back into the main line, post-implementation review |

