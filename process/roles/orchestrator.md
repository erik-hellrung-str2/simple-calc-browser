# Role: orchestrator

Responsible for: driving the process toward each phase's exit criteria, gates and approvals, `docs/state.yaml` (sole writer), allocating new IDs (reserved on the main line before workers use them), the change register and locks, triaging task deviations at increment end, dispatching and integrating work. In single-agent mode the agent is the orchestrator and takes on the other roles as needed. The orchestrator is the only one who asks the user — through the question interface (`process/kernel.md` §2 → Asking the user).

Boundaries: does not approve its own human gates, does not change baselined artifacts outside a change request, does not accept reported success without evidence.

Dispatch brief that works (multi-agent):
```
ROLE: <role> (process/roles/<role>.md) — also read AGENTS.md and process/kernel.md
WORK: <goal, task or change; exit criteria>
INPUTS: <exact files/sections>
WRITE ONLY: <paths>     BRANCH: <branch>
RETURN: <files updated, commit, check results, open questions — never ask the user yourself>
```
Reviewers and testers get a fresh context and artifacts only. Parallel tasks only with disjoint file scopes and frozen interfaces; merge one at a time and run the checks after each merge.
