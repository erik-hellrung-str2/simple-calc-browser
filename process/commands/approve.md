# /approve [CR-###] [note]

**Achieves:** a pending human approval (phase gate or change request) is recorded and the process continues. The user's answer to a gate or approval question (`process/kernel.md` §6) is handled exactly like this command.

- Nothing pending → say so. Several pending and none named → ask which (question interface, one option per pending item).
- The message also contains changes → handle those as change requests first and re-present; do not approve.
- Phase gate: phase `done` with approver, date and note; the phase's baseline artifacts get `status: approved` (working documents stay editable, `process/kernel.md` §2 → Baseline); advance the phase.
- Change request: status `approved` with approver, date and note in the CR and register. This approves the resulting baseline delta; changed artifacts become `approved` when the change is applied — no extra phase gate unless the CR reopens a phase. Continue the change (or, for a feature-size CR, start the next cycle).
- Rejection or deferral is recorded the same way with a reason.
- Update state, commit, continue with `/next` unless the user wants to stop.
