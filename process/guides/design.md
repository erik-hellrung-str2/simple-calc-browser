# Guide: design

Outcome and exit criteria: `kernel.md` §5. Role: architect. Defaults: `calibration/delivery.md`, modifiers in `calibration/complexity.md` §3.

## Approach that works

- **Existing code first** (brownfield): understand structure, commands, conventions, stable interfaces and risky areas before deciding anything (`docs/design/as-is.md`).
- **Retire high risks early** with time-boxed spikes when uncertainty is high; record results as ADRs.
- **Stack**: when delegated, prefer mainstream, well-documented, strongly typed technologies with fast tests and standard tooling — agents are most reliable there. Record as ADR.
- **Architecture**: context, components with single responsibilities and acyclic dependencies, data model, cross-cutting concerns, source layout, allocation of every REQ/NFR, a tactic for every NFR. Cross-check the NFRs and constraints against each other and against the chosen tactics (e.g. a password-hashing cost vs. a response-time target) — a conflict found here is a question for the user, not a CR later.
- **User interface** (if any): screen inventory, navigation, component library and design tokens, text wireframes for key screens.
- **Contracts** in machine-readable form for interfaces built independently, verified by contract tests; freeze them before parallel work. Prefer executable specifications everywhere: what is executable cannot drift silently.
- Keep the baseline at the level of decisions and interfaces; inner details of components are left to implementation and documented as built.
- **Threat model** and **operations design** when the tier or modifiers call for it.
- **Test strategy** (`docs/testing/test-strategy.md`): define the concrete form of all seven core test types for this project (`kernel.md` §5a) — even for a script — and decide the further types; tools, tagging, environments, test data, targets. Without performance NFRs, propose a baseline (e.g. runtime and memory on realistic and ≈ 10× input) so T6 has something to measure. Name the performance-critical code paths so later changes to them re-trigger T6.
- **Decisions taken without asking**: resolve every "Agent decides" item of the relevant topics and list them so the user can veto at the gate.
- Fill `AGENTS.md` §4 with intended commands; re-assess complexity with what design revealed.
