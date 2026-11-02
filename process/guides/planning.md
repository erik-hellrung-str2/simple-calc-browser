# Guide: planning

Outcome and exit criteria: `kernel.md` §5. Role: architect. Defaults: `calibration/delivery.md` → Work sizing.

## Approach that works

- Cut increments as vertical, demonstrable slices; the first task proves the toolchain (walking skeleton) and replaces the template README with a project README.
- Write each task so an agent that knows only `AGENTS.md` can do it: objective, files it may touch, context pack (exactly what to read), instructions, executable acceptance checks with the AC IDs, dependencies, whether it is safe to run in parallel.
- Plan test infrastructure for all seven core test types (unit and integration setup, clean system-test environment, E2E harness, performance measurement, robustness/fuzz tooling) plus the further types as early enabler tasks — the testing phase should not start by building tools.
- Verification plan per increment: which AC is verified by which test type.
- Check: acyclic dependencies, every `must` REQ and NFR covered, every task traced to a REQ/NFR or marked as enabler.
- Full track: group parallel-safe tasks into lanes for parallel agents.
- The plan is a working document: re-plan freely as you learn (split, merge, reorder tasks), noting it in the plan's history — no change request needed. New IDs come from the orchestrator.
