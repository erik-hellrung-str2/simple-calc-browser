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
project_name: Calc Viewer Builder
stack: plain JavaScript in one hand-written HTML file (no build step); @thatopen/fragments 3.4.7 + three 0.185.1 + web-ifc 0.0.77 from jsDelivr; dev tooling Node 22, Playwright 1.63 (Chromium), Python 3 + openpyxl 3.1.5 (tests only)
source_layout: calc-viewer-builder.html (product); scripts/ (vendor, fixtures, serve, check); test/{unit,integration,e2e,acceptance,perf,fixtures,support}; docs/ (process)
commands:                  # exact shell commands, runnable from repo root (established by TASK-001a)
  install: npm ci && python3 -m pip install openpyxl==3.1.5 && node scripts/vendor-cdn.mjs && node scripts/fetch-fixtures.mjs
  format: npx prettier --write .
  lint: npx eslint --max-warnings 0 .
  typecheck: n/a
  build: n/a
  test_fast: npx c8 --include='.cache/**' --check-coverage --lines 70 node --test 'test/unit/**/*.test.mjs' && npx playwright test --grep @integration --project=http
  test_all: node scripts/check.mjs --all
  test_single: node --test --test-name-pattern='<name>' 'test/unit/**/*.test.mjs'   # or: npx playwright test -g '<name>'
  run: node scripts/serve.mjs   # then open http://localhost:8080/calc-viewer-builder.html, or double-click calc-viewer-builder.html
  check: node scripts/check.mjs
tests:
  unit: node --test --test-name-pattern='\[unit\]' 'test/unit/**/*.test.mjs'
  integration: npx playwright test --grep @integration
  system: npx playwright test --grep @system
  e2e: npx playwright test --grep @e2e
  acceptance: npx playwright test --grep @acceptance
  perf: npx playwright test --grep @perf && node --test --test-name-pattern='\[perf\]' 'test/perf/**/*.test.mjs'
  robustness: npx playwright test --grep @robustness
  smoke: npx playwright test --grep @smoke
check_sequence: [format, lint, typecheck, build, test_fast]   # must pass before a task is done (run via `check`)
```
