# Kernel

The binding core of the process. Everything here holds for every project, tier and model. Everything else in `process/` is calibration (defaults) or guidance (optional).

## 0. How to read `process/`

| Layer | Where | Status | Rule |
|---|---|---|---|
| **Kernel** | `kernel.md`, `AGENTS.md` | binding | Never deviate. Changed only by a human. |
| **Calibration** | `calibration/`, `questionnaire/` | defaults | Start from these values. Deviate when the project calls for it — record what, why, and the effect in `docs/process-log.md`. Deviations that change the tier, reduce human control (gates, approvals) or reduce verification below the tier's defaults need the user's confirmation. |
| **Guidance** | `guides/`, `roles/`, `templates/` | optional | Proven approaches. Use them when helpful; use a better method when you have one, as long as kernel outcomes and invariants are met. |

Judge by outcomes: a phase is done when its exit criteria (§5) are true and evidenced, not when a procedure was followed.

## 1. Invariants

1. **The repository is the memory.** Everything that matters is in files; `docs/state.yaml` always says where the process stands and what the next action is, precise enough for a fresh agent.
2. **No invented requirements.** Unknowns become `Q-###`; work that proceeds on an assumption records `ASM-###`. Blocking unknowns stop the work.
3. **Verified or not done.** Nothing is marked done without executed checks; results are reported truthfully, including what was not tested. A claim in a report names the test that measured it — never more than that test covers.
4. **Tests are never weakened** (skipped, deleted, loosened) to get green. Every bug gets a failing test before its fix.
5. **Approved means baselined.** The baseline (§2 → Baseline) changes only through a change request (§7). Working documents change freely, with a trace.
6. **Traceability.** Every requirement traces to its source, the work that implements it, and the tests that verify it — by ID.
7. **Documentation describes what was built.** Specification and code must not drift apart: deviations found during implementation are resolved (§5 verification), and executable specifications (acceptance tests, machine-readable contracts with contract tests) are preferred over prose wherever possible.
8. **Independent verification** where the tier requires it: the verifier is not the context that produced the work and works from the specification.
9. **Humans own the decisions that are theirs:** business rules, priorities, scope, money, legal, irreversible actions, production deployment, and the gates of §6.
10. **No silent changes** of tier, track, scope or calibration — proposed and recorded, never just applied.
11. **Least surprise for parallel work:** never work on files locked by an active change, never start an `on_hold` task, only the orchestrator writes `docs/state.yaml`.

## 2. Protocol

### Commands
`/start`, `/next`, `/status`, `/approve`, `/change`, `/rollback` — defined in `process/commands/`. They are entry points; what they must achieve is binding, how is not.

### Asking the user
Every question to the user goes through the tool's **structured question interface** whenever the tool has one (Claude Code: `AskUserQuestion`) — never as text, neither as a list nor as a single sentence. This covers the interview, follow-ups, confirmations, gate and change approvals, blocking questions, and every offer or choice left to the user ("if you'd rather …", "let me know …"), with or without a question mark. Text before the call gives context (summary, proposals, progress) and contains no questions. Everything else the user reads states facts: open questions and decisions by ID and topic (`Q-003 payment provider — open`), progress as what is being done ("Checking whether …"), UI strings and code literals in backticks; other ways to answer (typing `/approve`, `/change`) are mentioned only in a question's description.
- **Options carry the answer.** Each question offers concrete answers — where there is a recommendation, it comes first, marked "(Recommended)" — never pseudo-options that need a follow-up ("approve with a note", "adjust"). Notes, corrections and descriptions are typed into the free answer ("Other"); say so in the question. If an answer still lacks detail, the follow-up is another question call with concrete candidates, never a request in text.
- **Limits** (Claude Code): ≤ 4 questions per call, 2–4 options per question, header ≤ 12 characters (topic or need ID), option labels of 1–5 words with the rationale in the option's description; `multiSelect` only for ≤ 4 candidates — longer lists go into the text before the call and are confirmed as one question. More questions mean more calls.
- **The answer is processed at once.** The answer comes back within the same turn: record it where it belongs (answers, approval, `Q-###`), update the state, commit, and continue. "Ask and stop" in the process means: stop only if no answer came back or the user chose to stop.
- **Only the agent talking to the user asks.** Sub-agents and workers never ask the user; they return their questions to the orchestrator, which asks them.
- **Fallback** — numbered questions in text — only for tools that have no question interface at all. It never applies to Claude Code: if `AskUserQuestion` is not in the tool list, load it; if it truly cannot be used, report that and stop without writing the questions as text.

### State — `docs/state.yaml`
Required keys: `tier`, `track`, `autonomy`, `cycle`, `current_phase`, `current_increment`, `resume_after`, `phases` (id, status, gate, approval — of the current cycle; a new cycle resets them, earlier gates stay in `history`), `increments`, `blocking_questions`, `active_changes`, `next_action`, `history`. Status values: `todo | in_progress | awaiting_approval | done | skipped`. `current_phase` is a phase of §4 or `maintenance` (after a release, until the next change or cycle). Example: `process/templates/state.yaml`.

### IDs
| ID | Meaning |
|---|---|
| `C##`, `<TOPIC>-##` | intake information need (`process/questionnaire/`) |
| `Q-###`, `ASM-###` | open question, assumption (`docs/open-questions.md`) |
| `REQ-###`, `REQ-###-AC#`, `NFR-###`, `CON-###` | requirement, acceptance criterion, non-functional requirement, constraint |
| `ADR-###`, `CMP-<name>`, `RISK-###`, `THR-###` | decision record, component, risk, threat |
| `INC-#`, `TASK-###` | increment, task (incl. spikes and bug fixes) |
| `BUG-###`, `CR-###` | defect, change request |
| `T1`–`T14`, `R1`–`R9`, `STD-#`, `D1`–`D10` | test type, change risk factor, standard change type, complexity dimension (calibration) |

IDs are sequential per prefix and never reused. Only the orchestrator allocates new IDs; in parallel work an ID is reserved on the main line (register, plan or state) before it is used on a branch. Every allocated TASK appears in the plan, also tasks created by a CR. Tests reference the acceptance criterion or NFR they verify; where a language forbids hyphens in names, the ID is written with underscores (`REQ_012_AC2`) — so searches for IDs always use both forms (`REQ[-_]012`).

### Artifacts
Every artifact in `docs/` carries front matter with at least `status` (`draft | approved | superseded`) and the IDs it relates to, and ends with a change history once approved. Content structure is free; templates in `process/templates/` are examples.

| Location | Content |
|---|---|
| `docs/state.yaml`, `docs/process-log.md`, `docs/open-questions.md` | process state, process deviations, questions and assumptions |
| `docs/intake/` | answers (with coverage), assessment |
| `docs/spec.md` | Lean track: requirements + design + tasks + test results |
| `docs/requirements/`, `docs/design/`, `docs/planning/` | Standard/Full: requirements, architecture/ADRs/contracts, plan and tasks |
| `docs/testing/`, `docs/reviews/` | test strategy, traceability, bugs, reports; code reviews |
| `docs/release/`, `CHANGELOG.md` | release notes, runbook |
| `docs/changes/` | change register and change requests |

### Baseline and working documents

| Baseline — changes only via CR once approved | Working documents — change freely, logged in history/register |
|---|---|
| requirements: REQ, acceptance criteria, NFR, constraints, out of scope | plan, increments, tasks (split, merge, reorder, re-estimate) |
| UI / interface specification | reviews, test reports, traceability, bugs |
| architecture decisions: components and responsibilities, dependency rules, data model at entity level, ADRs | as-built details inside a component (internal structure, helpers, private functions) |
| interface contracts | state, process log, open questions, change register |
| test strategy: form and targets of the core test types, required further types | intake answers — a historic record, never updated after intake; later knowledge goes into requirements or CRs |

Lean `docs/spec.md`: goal, requirements, UI, out of scope and design (incl. testing) are baseline; tasks, testing results, open points and change history are working sections.
A **refinement** — detail inside a component that changes no requirement, decision, contract or test target — needs no CR; it is documented as built, also inside a baseline document (marked _as built_). Documenting a refinement is not a baseline change.

### Checks
The project's `check_sequence` (`AGENTS.md` §4) is runnable as **one fail-fast command** (`commands.check`) that names the step that failed; its exit code is the only evidence that checks passed. Never pipe or filter check output in a way that hides the exit code, and never commit after a failing check — the first task enables the pre-commit hook (`git config core.hooksPath .githooks`), which runs `commands.check` before every commit, so this does not rest on discipline alone.

### Git
Commit after each unit of work with the ID as prefix (`TASK-012: …`, `CR-003: …`). Parallel tasks on `task/TASK-###-<slug>`, changes on `change/CR-###-<slug>` with tag `pre-CR-###`. Never rewrite published history.

## 3. Tiers and tracks

The agent assesses complexity at intake, proposes a tier with reasons, and the user confirms. The tier scales every phase: depth of questions, documents, reviews, test intensity, change rigour. Defaults for all of this: `calibration/`.

| Tier | Typical project | Track |
|---|---|---|
| XS | script, small CLI tool | Lean |
| S | mini application | Lean |
| M | medium application with several modules | Standard |
| L | complex application: database, login, integrations, … | Full |

Lean combines requirements, design and planning into `docs/spec.md` with one gate. The tier is re-assessed when design or a change reveals more; going up is announced and the track migrated, going down only on user request.

## 4. Phases

`intake → requirements → design → planning → (implementation ⇄ verification per increment) → testing → release → maintenance`, plus `change` at any time. Lean: `intake → spec → implementation → verification → testing → release → maintenance`.

**Delivery cycles.** Cycle 1 starts with `/start` and ends with the first release. Later cycles start from a feature-size change (§7): a scoped intake for the new part, then requirements, design and planning for the delta with their gates, then implementation, verification, testing and release of the next version. IDs (REQ, INC, TASK, …) continue across cycles; `cycle` in the state counts up; each cycle has its own testing phase and release. Small changes do not open a cycle; they run through §7 and ship with the next release.

## 5. Phase outcomes and exit criteria

The binding definition of each phase. How to get there: `guides/<phase>.md` (optional).

| Phase | Outcome | Exit criteria (all evidenced) |
|---|---|---|
| **intake** | understanding of what to build; tier and track; information needs covered | user described the project and confirmed the summary and tier; every required information need of the tier covered (answered, confirmed, delegated with `ASM`, n/a with reason, or `Q`); state initialized |
| **requirements** | what the system must do | every capability traced to ≥ 1 REQ; every `must` REQ has testable acceptance criteria; every NFR measurable with a verification method; UI/interface described where one exists; no blocking questions |
| **design** | how it is built | every REQ/NFR allocated to a component; significant decisions recorded with alternatives; interfaces between independently built parts specified; test strategy defines the concrete form of every core test type (§5a) and decides the further types; decisions taken without asking listed for the user; project configuration in `AGENTS.md` §4 |
| **planning** | executable work | tasks small enough for one session, each with scope (files), context (what to read), executable acceptance checks, dependencies; acyclic; every `must` REQ and NFR covered; first task proves the toolchain; test infrastructure planned |
| **implementation** (per task) | working, tested change | acceptance checks and `check_sequence` pass; tests for the task's relevant part reference their IDs; task record updated |
| **verification** (per increment; Lean: once, before testing) | confidence in the increment; specification and code in sync | reviews done as the tier requires; increment's ACs pass; regression green; no open blocker/major bugs; traceability updated; every task deviation resolved (no effect / documented as refinement / change request) |
| **testing** | confidence in the whole system | every core test type (§5a) executed — scoped to the touched subjects for change-only releases — plus every further type the strategy requires (skips justified); all `must` ACs pass; NFR targets met or deviation accepted by the user; no open blocker/major bugs; report with release recommendation |
| **release** | delivered version | documentation checked against the built system (as-built); changelog and release notes; deployment and rollback steps; human approval; tag. Production deployment only on explicit user request |
| **change** | baseline changed safely | see §7 |

## 5a. Core test types

Seven test types are mandatory in **every** tier — from a script to a complex application. The tier scales their depth (`calibration/testing.md`), never their breadth.

| # | Type | Verifies |
|---|---|---|
| T1 | Unit test | single functions and components in isolation |
| T2 | Integration test | the interaction of several components, and of components with storage, file system, external tools and services |
| T3 | System test | the complete, built and installed system in a clean environment |
| T4 | End-to-end test | complete flows from the user's point of view, from input through all layers to the result |
| T5 | Acceptance test | that every defined requirement is fulfilled — every acceptance criterion, every NFR |
| T6 | Performance and load test | speed, stability and behaviour under load; without stated NFRs, against a baseline the agent proposes and the user sees at the design gate |
| T7 | Robustness test | behaviour on faulty, unexpected and extreme input and conditions |

Plus regression (all automated suites) after every change.

- The test strategy defines the meaningful form of each core type for the project, also for small ones (e.g. for a script: integration = interplay with files, OS and called tools; performance = runtime and memory on realistic and large input).
- A core type can be omitted only if it genuinely cannot apply, with a recorded reason **and** the user's explicit confirmation.
- Further types (regression, smoke, security, usability/accessibility, compatibility, migration/recovery, exploratory, …) are calibrated per tier.
- A **release that only contains changes** (no new cycle) runs a scoped testing phase: every core type whose subject the changes touch, plus full regression and smoke. A new cycle runs the full testing phase.

## 6. Gates and autonomy

The agent always verifies the exit criteria. Whether a human must also approve depends on `autonomy` (chosen at intake):

| Gate | guided | standard (default) | autonomous |
|---|---|---|---|
| intake | human | human | human |
| spec (Lean) / requirements / design | human | human | agent |
| planning | human | agent | agent |
| increment | human | agent (Full: human) | agent |
| testing | human | agent | agent |
| release | human | human | human |

Human approval: set `awaiting_approval`, present a short summary with the artifacts, then ask for the decision through the question interface (§2 → Asking the user) with options that carry the decision — gate: Approve (Recommended) / Not yet; change request: Approve / Reject / Defer; requested changes and notes go into "Other" (handled as a change request). The answer is processed like `/approve`. Always stop for blocking questions, unfixable gate failures, production deployment, destructive or irreversible actions, spending money.

## 7. Change control

Binding principles; categories, risk factors, thresholds and tier scaling are calibration (`calibration/change.md`).

1. Drafts, working documents and refinements are edited freely. Changes to the baseline, released behaviour, dependencies or infrastructure go through a change request (`CR-###`), recorded in `docs/changes/register.md`.
2. Impact is analysed from evidence (traced IDs, code and data dependencies, searches recorded), not from memory.
3. Approval follows risk. Always human: high risk, emergency, feature-size changes, and changes to released behaviour (except pre-approved standard changes). Approving a CR approves the resulting baseline delta; phase gates run again only if the CR reopens a phase (feature-size change, or a jump back to an earlier phase).
4. Size decides the vehicle: a change runs through this section; a feature-size change (calibration) opens a new delivery cycle (§4) with the CR as its umbrella.
5. Every change is isolated and reversible: own branch or commits, `pre-CR-###` tag, rollback plan; affected tasks on hold; overlapping changes never in progress at the same time. A CR records which earlier CRs it builds on; a rollback includes or first reverts every later CR that depends on it.
6. Tests follow the impact; full regression always.
7. Emergency: the smallest fix may be released as a hotfix after a reduced test scope (`calibration/change.md` §13) and human approval; the full CR record, the remaining tests and the post-implementation review follow immediately.
8. Changed items reference the CR; superseded items are marked, never deleted.
9. A post-implementation review compares predicted and actual impact; lessons improve the project's impact checklist.

## 8. Multi-agent

- The orchestrator owns state, gates, the change register and merges. Workers write only within their role's scope and report through files.
- Reviewers and testers get a fresh context and only artifacts, never the producer's reasoning.
- Parallel work only for tasks with disjoint file scopes and frozen interfaces.
- When the tool can start sub-agents or fresh sessions, reviews, change reviews and the testing phase use them: a self-review reliably misses what a fresh context finds. Only when independence cannot be achieved does the review record `independence: self`.
- Only the orchestrator talks to the user; workers return questions to it (§2 → Asking the user).
- Single agent: the same rules, executed sequentially.

## 9. Evolving the process

- Project-level adaptations go to `docs/process-log.md` (what, why, effect). Repeated deviations are a signal that a default is wrong.
- Lessons from post-implementation reviews and retrospectives may propose changes to `process/` itself; they are presented to the user and applied only with approval.
