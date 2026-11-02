# AI Software Delivery Template

A tool-neutral, stack-neutral GitHub template that runs a software delivery process with one or more AI coding agents, covering requirements, design, planning, implementation, verification and release. The depth of the process adapts to how complex the project is.

**AI-first by design:** a small binding kernel defines *what* must be true; *how* to get there is left to the agent. All numbers and matrices are calibratable defaults, all procedures optional guidance — so the process gets better with better models instead of holding them back.

## Quick start

1. Create a repository from this template (**Use this template**).
2. Open it in an AI coding agent: Claude Code, GitHub Copilot, Codex, Cursor, Gemini CLI, or any agent that reads `AGENTS.md`.
3. Run `/start`. The agent asks what you want to build. Describe it in your own words.
4. The agent mirrors back its understanding, fills gaps, and assesses the complexity.
5. Answer the detail questions, which work like a requirements analysis: functions, UI, data, integrations, security, quality, operations, technology. The questionnaire is a framework, not a script: it defines *what* must be known per tier, and the agent formulates the best questions for your project, including domain-specific ones, within a question budget. It asks only what only you can answer and proposes answers you can simply confirm. Technical details are decided by the agent and shown to you at the design approval. Say "enough" at any time and the agent fills the rest with visible assumptions. Partial answers, "unknown" and "you decide" are fine.
6. Keep going with `/next`. Approvals arrive as a question too; picking "Approve" equals typing `/approve`.

**Every question comes as a question dialog, never as text** (Claude Code: `AskUserQuestion`): pick an option — the agent's recommendation comes first — or type your own answer, a note or "enough" into **Other**. Files, sketches and links you can send in a normal message whenever the agent stops. Tools without a question dialog fall back to numbered questions in text.

## Commands

| Command | What happens |
|---|---|
| `/start [description]` | "What do you want to build?" → understanding + gap questions → complexity tier XS/S/M/L → detail questions at matching depth |
| `/next` | Executes the next step(s) until a gate, a question, or a natural stop |
| `/status` | Shows phase, progress, what is waiting on you |
| `/approve [CR-###] [note]` | Approves the pending gate (requirements, design, release, …) or change request — the same as picking "Approve" in the question dialog |
| `/change <text>` | Change request: new idea, changed requirement, bug after release, with impact and risk analysis |
| `/rollback CR-###` | Undo an applied change request |

If your tool has no slash commands, type the command as a plain message (e.g. `start`). `AGENTS.md` tells the agent what to do with it.

## How complexity drives the process

After your description, the agent fills the gaps in 11 core questions and scores ten dimensions (scope, roles, data, integrations, topology, quality pressure, security, uncertainty, lifetime, existing systems). The result picks a track and the depth of the detail questions. Every relevant topic is always covered (functional, UI, data, integrations, security, quality, operations, existing systems, technology); the tier decides how deep:

| Tier | Typical project | Track | Detail questions | Before coding | Artifacts |
|---|---|---|---|---|---|
| XS (0–3) | script, small CLI tool | Lean | ~4–6 | one approval | one `docs/spec.md` |
| S (0–8) | mini application | Lean | ~8–12, mostly confirmations | one approval | one `docs/spec.md` |
| M (9–17) | medium application, several modules | Standard | ~18–25 | approvals for requirements and design | requirements, architecture + ADRs, plan with task files |
| L (18–30) | complex application: database, login, integrations | Full | ~28–36 | + spikes, threat model, contracts first | everything + runbook, increment demos, parallel agents |

Escalation rules push risky projects up a tier, e.g. regulated data or legacy migration. Modifiers add specific steps such as spikes for uncertainty or as-is analysis for existing code. Details: `process/calibration/complexity.md`.

## Testing

**Seven core test types are mandatory in every tier** (`process/kernel.md` §5a) — from a script to a complex application:

| # | Type | Verifies |
|---|---|---|
| T1 | Unit | single functions and components |
| T2 | Integration | interaction of components, storage, files, external tools and services |
| T3 | System | the complete installed system in a clean environment |
| T4 | End-to-end | complete flows from the user's point of view |
| T5 | Acceptance | every acceptance criterion and NFR |
| T6 | Performance and load | speed, stability, behaviour under load (against NFRs or a proposed baseline) |
| T7 | Robustness | faulty, unexpected and extreme input and conditions |

The tier scales their **depth**, never their breadth: a script measures runtime on realistic and 10× input, a complex application runs load, stress, spike and soak tests. Regression always runs after changes. Further types — smoke, security, usability/accessibility, compatibility, migration/recovery, exploratory — are calibrated per tier (`process/calibration/testing.md`). Tests run at three levels:

| When | What |
|---|---|
| Per task | only the relevant part: unit tests, integration tests for touched interfaces, invalid/boundary input |
| Per increment | acceptance tests of the increment, new E2E flows, full regression |
| Testing phase | everything that applies, in all directions, on a release candidate, with a fix loop until the exit criteria hold |

## Changes

Changes are expected and handled like in an ITIL-style change management, adapted for agents (`process/kernel.md` §7, `process/calibration/change.md`, `process/guides/change.md`):

- **Baseline vs. working documents:** only what binds others — requirements, UI specification, architecture decisions, contracts, core test strategy — changes through a change request (`CR-###`). Plans, tasks, reports and inner details of a component change freely, with a trace.
- **Change or feature cycle:** small changes ship with the next release; a feature-size change (new capability, component, role, integration, or many requirements) opens a new delivery cycle with a scoped intake, requirements, design and planning gates for the delta, testing and release.
- **One approval:** approving a CR approves its baseline delta; phase gates repeat only when the CR reopens a phase.
- **Categories:** `standard` (pre-approved catalogue, low risk), `normal`, `emergency` (hotfix path, review afterwards).
- **Impact analysis from evidence:** the agent traces IDs (requirement → tasks → tests → code) and searches code dependencies, data and interfaces. It records every search and predicts which files will change.
- **Risk score** from nine factors (data, interfaces, reversibility, test safety net, …) → low/medium/high → approval matrix. Medium/high risk also gets an independent change review before you decide.
- **No collisions:** affected tasks go on hold, overlapping CRs queue, each CR runs on its own branch with a `pre-CR-###` tag, and nothing changes during the testing feature freeze.
- **Tests follow impact:** affected components, changed acceptance criteria, full regression, plus migration, security or performance tests when the risk factors call for them.
- **Traceable:** CR register with dependencies between CRs, `History: CR-###` on every changed requirement, change-history tables, CR IDs in commits and release notes. `/rollback` also handles later CRs that build on the one being undone.
- **Post-implementation review:** predicted vs. actual diff, bugs introduced by the change, lessons fed back into the impact checklist.

## Scaling by project tier

The tier decided at `/start` runs through the whole process. Questions, documents, reviews, test intensity and change rigour all scale with it:

| | XS script | S mini app | M medium app | L complex app |
|---|---|---|---|---|
| Detail questions | ~4–6 | ~8–12 | ~18–25 | ~28–36 |
| Documents | `spec.md` | `spec.md` | requirements, architecture, plan, test strategy | + threat model, runbook, contracts |
| Review | self | self | independent per task | independent + human demos |
| Testing phase | all 7 core types: local, runtime/memory baseline, 1 exploratory charter | all 7: clean install, ≥ 70 % coverage, key-operation baseline | all 7: staging-like, load at expected peak | all 7: production-like, load/stress/spike/soak, UAT |
| Changes | change note in `spec.md` | short CR | full CR, change review for medium/high risk | full CR, review always, stricter risk levels, tested rollback |

When a change makes the project bigger (a script gets a GUI and a database), the tier goes up and the documents are migrated to the next track (`process/calibration/complexity.md` §6).

## Three layers

| Layer | Files | Status |
|---|---|---|
| **Kernel** | `AGENTS.md`, `process/kernel.md` | Binding: invariants (repo is memory, no invented requirements, verified or not done, never weaken tests, approved = baselined, traceability, human decisions), protocol (state, IDs, artifact metadata, git), tiers, phase outcomes and exit criteria, gates and autonomy, change-control principles. |
| **Calibration** | `process/calibration/`, `process/questionnaire/` | Defaults: complexity scoring, question budgets, track contents, task sizing, test matrix and intensity, change categories, risk factors, approval matrix. The agent may deviate with a recorded reason (`docs/process-log.md`); deviations that reduce your control or verification need your confirmation. |
| **Guidance** | `process/guides/`, `process/roles/`, `process/templates/` | Optional: proven approaches, role boundaries, example templates. A capable model may use better methods as long as the kernel's outcomes and invariants hold. |

Lessons from projects may propose improvements to the process itself; they are applied only with your approval.

## Designed for agents

- **The repository is the memory.** `docs/state.yaml` always says where the process stands and what the next action is, so any fresh agent session can continue.
- **Everything has an ID** (`REQ-012-AC2`, `ADR-003`, `TASK-017`) and is linked, from questionnaire answer to requirement to task to test. IDs are allocated centrally, so parallel agents never collide.
- **Specification and code stay in sync:** every implementation deviation is classified (none / refinement / needs a CR) and resolved per increment; executable specifications (acceptance tests, contracts with contract tests) are preferred; an as-built check runs before every release.
- **Tasks are self-contained:** each one lists the files it may touch, a context pack of exactly the docs to read, and executable acceptance checks.
- **Red checks cannot be committed:** `.githooks/pre-commit` runs the project's `check` command from `AGENTS.md` §4; the first task enables it with `git config core.hooksPath .githooks`.
- **Independent verification:** reviewers and testers work from the spec in a fresh context, not from the developer's reasoning.
- **Explicit gates and autonomy:** you choose `guided`, `standard` or `autonomous`. Production deployment always needs your approval.
- **Single or multi-agent:** one agent switches roles; with sub-agents, an orchestrator dispatches parallel-safe tasks on separate branches.

## Repository layout

```
AGENTS.md                 entry point: what to read, commands, working rules, project config
process/
  kernel.md               binding core: invariants, protocol, tiers, phase outcomes, gates, change control
  calibration/            defaults: complexity, delivery, testing, change
  questionnaire/          information needs for the intake (core + topics), question quality
  guides/                 optional approaches per phase: intake … release, change
  commands/               what /start /next /status /approve /change /rollback achieve
  roles/                  responsibilities and boundaries
  templates/              example artifacts
docs/                     project artifacts (filled by the process)
.githooks/pre-commit      runs the project's check command before every commit (enabled by the first task)
.claude/settings.json, .claude/hooks/   Claude Code: Stop hook that keeps questions out of plain text
CLAUDE.md, .claude/commands/, .github/copilot-instructions.md, .github/prompts/   thin tool adapters
```

## Tool adapters

The process lives in plain Markdown. Adapters only point to it:

- **Claude Code:** `CLAUDE.md` imports `AGENTS.md` and adds the rule that every question goes through `AskUserQuestion`; `.claude/commands/*.md` provide the slash commands. `.claude/settings.json` registers a Stop hook (`.claude/hooks/ask-via-tool.py`) that sends a turn back — at most twice per turn — if text shown to you contains questions or requests for input that were not asked through the dialog. It needs `python3` on the PATH (without it, and on any error, it does nothing), runs once you trust the folder, and can be switched off by removing the `Stop` entry from `.claude/settings.json`.
- **GitHub Copilot (VS Code):** `.github/copilot-instructions.md`; `.github/prompts/*.prompt.md` provide the slash commands.
- **Codex, Cursor, others:** read `AGENTS.md` natively; type commands as messages.
- **Another tool:** add a command wrapper that says *"Achieve what `process/commands/<name>.md` defines, following `AGENTS.md` and `process/kernel.md`"*; if the tool has a question dialog, name it there as the way to ask every question.

## Customizing

- Per project: the agent adapts calibration and records it in `docs/process-log.md`.
- For all projects from this template: edit `process/calibration/` (numbers, matrices), `process/questionnaire/` (information needs), `process/guides/` (approaches). Change `process/kernel.md` only for genuine changes of principle (gates, invariants).

To make this repository a template on GitHub, enable **Settings → General → Template repository**.
