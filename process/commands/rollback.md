# /rollback CR-### [reason]

**Achieves:** an applied change is undone completely and verifiably.

- Only for CRs `in_progress`, `verified` or `closed`. Find later CRs that depend on it; they are rolled back first (newest first) or explicitly re-based — the user decides (question interface, `process/kernel.md` §2 → Asking the user): Roll back dependents first (Recommended) / Re-base them / Cancel. Show everything that will be reverted (CRs, code, docs, data, configuration, release) and get confirmation the same way unless the change is unmerged.
- Revert to `pre-CR-###`, execute the CR's rollback plan, run smoke and full regression, hotfix release if it was released.
- CR `rolled_back` with reason; register and state updated; a new CR is needed to try again.
