# /start [description]

**Achieves:** the intake outcome (`process/kernel.md` §5) — the user has described the project, confirmed the understanding and tier, the required information needs are covered, and `docs/state.yaml` exists.

- Already started (`docs/state.yaml` exists): do not restart; show the status and point to `/next` or `/change`. Restart only on explicit confirmation (question interface, `process/kernel.md` §2 → Asking the user): Continue (Recommended) / Restart and archive `docs/`.
- Interrupted interview (`docs/intake/answers.md` without state): resume where it stopped.
- No arguments: the first step is only the opening question "What would you like to build?", asked through the question interface (`process/kernel.md` §2 → Asking the user). Arguments or material count as that answer.
- Every later question of the interview goes through the question interface as well — never as a list in a text message.
- Guidance: `process/guides/intake.md`. When done, continue with `/next` unless the user wants to stop.
