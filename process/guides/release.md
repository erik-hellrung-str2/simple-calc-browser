# Guide: release

Outcome and exit criteria: `kernel.md` §5. Role: release-manager.

## Approach that works

- Release only after the testing phase recommends it, with no open blocker/major bugs and a green regression on the release commit.
- **As-built check**: components, interfaces, data model, UI description and the commands in `AGENTS.md` §4 match the built system; fix documentation drift (refinements) or raise CRs before tagging.
- Version by SemVer; after the first release the highest version effect of the included changes decides (`calibration/change.md` §9).
- Changelog and release notes list features (REQ), fixes (BUG), changes (CR), known issues, open assumptions, upgrade notes, deployment and rollback steps.
- Full track or when operations require it: runbook, rollout strategy, rollback rehearsal before the first production deployment.
- Present the summary with the test report highlights; tag after approval; deploy only on explicit request — ask (question interface, `process/kernel.md` §2 → Asking the user): Not now (Recommended) / Deploy to production — then run smoke tests against the deployment. Run the post-implementation reviews of included changes.
- Afterwards `current_phase: maintenance`. Small changes collect for the next release (scoped testing phase, then release); a feature-size change opens the next delivery cycle (`kernel.md` §4).
