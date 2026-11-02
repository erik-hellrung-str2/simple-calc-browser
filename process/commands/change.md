# /change <description>

**Achieves:** the change is recorded, analysed, decided and — if approved — applied safely (`process/kernel.md` §7).

- No state yet → treat it as input for `/start`.
- Follow `process/guides/change.md` with the defaults of `process/calibration/change.md` for the project's tier.
- Report CR ID, category, size (change or feature cycle), risk, impact, decision or approval request, and what happens next. Where human approval is required, ask for it through the question interface (`process/kernel.md` §6: Approve / Reject / Defer) and process the answer as `/approve CR-###`; stop if none came back.
- Not every request needs a CR: working documents and refinements change directly (`process/kernel.md` §2 → Baseline).
- Agents raise change requests themselves for design gaps, rejected assumptions, dependency updates and similar findings.
