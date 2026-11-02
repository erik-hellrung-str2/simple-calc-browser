# AGENTS.md

This repository runs an AI-first software delivery process for one or more agents, independent of tool and stack.

## 1. Read this first

1. `process/kernel.md` — the binding core: invariants, protocol, tiers, phase outcomes, gates, change control. Read once per session.
2. `docs/state.yaml` — where the project stands. Missing → the project has not started; only `/start` is valid.
3. `docs/process-log.md` — project-specific deviations from the defaults (if present).

Everything else in `process/` is calibration (defaults you may adapt with a recorded reason) or guidance (optional). Read only what the current work needs.

## 2. Commands

A command may arrive as a slash command, as a plain message (`start`), or via a tool wrapper. Achieve what the command file defines.

| Command | File | Purpose |
|---|---|---|
| `/start [description]` | `process/commands/start.md` | "What would you like to build?" → understanding → tier → interview → initialized process |
| `/next` | `process/commands/next.md` | Move the process forward until a gate, a question, or a natural stop |
| `/status` | `process/commands/status.md` | Where the project stands, what waits on the user |
| `/approve [CR-###] [note]` | `process/commands/approve.md` | Record human approval of a gate or change request |
| `/change <text>` | `process/commands/change.md` | Submit a change: new idea, changed requirement, bug after release, … |
| `/rollback CR-###` | `process/commands/rollback.md` | Undo an applied change |

A message that changes scope, requirements or design is a `/change`. A message that answers pending questions is recorded where the questions came from, then work continues.

## 3. Working rules (summary of `process/kernel.md`)

- The repository is the only memory: update `docs/state.yaml` and commit after every unit of work.
- No invented requirements; unknowns become questions or recorded assumptions.
- Verified or not done; never weaken tests. Seven core test types (unit, integration, system, E2E, acceptance, performance/load, robustness) in every tier — the tier sets their depth, not their breadth.
- The approved baseline (requirements, UI spec, architecture decisions, contracts, core test strategy) changes only through a change request; plans, tasks and inner details change freely with a trace. Only the orchestrator allocates new IDs.
- The user decides business rules, priorities, scope, money, legal, irreversible actions, production deployment and the gates.
- Every question to the user goes through the tool's question interface (Claude Code: `AskUserQuestion`), never as text — also offers, choices and approvals (kernel §2 → Asking the user).
- Nothing about tier, scope or process changes silently.

## 4. Project configuration

<!-- Filled in by the design phase, verified by the first task. Keep current. -->

```yaml
project_name: TBD
stack: TBD                 # languages, frameworks, runtime versions
source_layout: TBD         # where code, tests, config live
commands:                  # exact shell commands, runnable from repo root
  install: TBD
  format: TBD
  lint: TBD
  typecheck: TBD           # or n/a
  build: TBD
  test_fast: TBD           # tests run per task
  test_all: TBD            # every automated suite (regression)
  test_single: TBD         # one test, with placeholder
  run: TBD
  check: TBD               # ONE fail-fast command running check_sequence, naming the failing step; its exit code is the evidence (run by .githooks/pre-commit)
tests: {}                  # one command per test type the test strategy requires, e.g. unit: …, e2e: …, perf: …
check_sequence: [format, lint, typecheck, build, test_fast]   # must pass before a task is done (run via `check`)
```
