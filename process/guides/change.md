# Guide: change

Binding principles: `kernel.md` §7. Defaults (categories, risk factors, approval matrix, tier scaling, test scope): `calibration/change.md`. Roles: orchestrator, analyst, architect, reviewer, developer, tester.

Lifecycle: `submitted → analysed → (reviewed) → approved → in_progress → verified → closed`, or `rejected | deferred | queued | rolled_back`.

## Approach that works

- **Is it a CR at all?** Working documents (plan, tasks, reports) and refinements inside a component change without a CR (`kernel.md` §2 → Baseline).
- **Record** the request verbatim with its source in the form the tier calls for (XS change note, S short CR, M/L full CR) and in the register. Clarify ambiguity once (question interface, `process/kernel.md` §2 → Asking the user), one option per interpretation — never analyse a guess.
- **Classify** (standard / normal / emergency) and **analyse impact from evidence**: follow IDs from requirements to tasks, tests and code; search callers, interfaces, data and configuration; check open tasks and overlapping changes; note the earliest affected phase and predict which files will change; note earlier CRs this one builds on (`depends_on`). Record the searches.
- **Size it**: a feature-size change (`calibration/change.md` §11) opens a new delivery cycle — scoped intake for the new part, then requirements, design and planning for the delta with their gates, then implementation through release. The CR stays the umbrella and is approved by the user before the cycle starts.
- **Assess risk**, plan artifact updates, tasks, test scope, rollback and version effect.
- **Get it reviewed and approved** as calibrated: independent change review for higher risk, human approval where required. Present it compactly: request, category, size and risk, impact, plan, tests, rollback. The approval baselines the delta — no separate phase gate unless the CR reopens a phase.
- **Isolate**: tag `pre-CR-###`, own branch, affected tasks on hold, overlapping changes queued.
- **Apply** from the earliest affected phase forward; changed items get `History: CR-###`, superseded items are marked; implement through normal tasks, listed in the plan with `change: CR-###`.
- **Test** the impact-derived scope plus full regression; when the impact turns out larger than predicted, stop and re-decide.
- **Verify consistency**: no references to superseded items, no tests asserting old behaviour, traceability and register updated (every CR file has a register row and vice versa), tasks released.
- **Deliver** with the next release, or immediately as hotfix for emergencies (smallest fix from the released tag, failing test first, documentation and review completed right after).
- **Review afterwards**: goal met, predicted vs. actual diff, bugs introduced, lessons into the project's impact checklist.

## Rollback
First find later CRs that depend on this one (`depends_on` in the register); roll them back first, newest first, or re-base them explicitly — the user decides (question interface, `process/kernel.md` §2 → Asking the user). Then revert code and docs to `pre-CR-###`, run the data/configuration rollback steps, smoke and regression, hotfix release if already released, mark the CR `rolled_back` with the reason.
