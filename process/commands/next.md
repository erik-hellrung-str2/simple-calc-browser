# /next

**Achieves:** the process moves forward by as much work as is sensible before a stop condition.

1. No `docs/state.yaml` → point to `/start`. `current_phase: maintenance` → report what waits for the next release (verified CRs), offer the decision (question interface, `process/kernel.md` §2 → Asking the user): Wait for more changes (Recommended while < 3 verified CRs) / Release now; process the answer, otherwise stop unless a change is in progress.
2. Something awaits human approval (phase gate or change request) → show it and ask for the decision through the question interface (`process/kernel.md` §6 options); process the answer as `/approve`; stop if none came back.
3. Blocking questions → ask them through the question interface (proposals as options), record the answers and continue; stop if none came back.
4. New user input since the last step → record it first (answers, questions, or as a change request).
5. Otherwise do the next valuable unit of work toward the current phase's exit criteria (`process/kernel.md` §5): an intake block, a document, a task, a review, a test pass, a change step. Active approved changes take precedence in their locked area. Multi-agent: dispatch (`process/roles/orchestrator.md`).
6. When the phase's exit criteria hold: approval needed per §6 → present a gate summary (artifacts, key decisions and counts, assumptions, open points), ask for the decision through the question interface (§6 options) and process the answer as `/approve`; otherwise advance the phase (after the last increment's verification comes testing, then release, then maintenance; a feature-size change starts the next cycle with a scoped intake).
7. After each unit: update `docs/state.yaml` (a `next_action` a fresh agent can execute) and commit.

Continue until a stop condition or until the session context grows large — stop at a clean boundary with everything committed. Guidance per phase: `process/guides/<phase>.md`; the Lean phase `spec` uses the requirements, design and planning guides in one pass into `docs/spec.md`.
