# Calibration: delivery

Defaults for what each track produces and how work is cut. Deviate with reason (`README.md`).

## Track contents

| | Lean (XS, S) | Standard (M) | Full (L) |
|---|---|---|---|
| Requirements | `docs/spec.md` | `docs/requirements/requirements.md` | + measurable NFRs, glossary |
| Design | `docs/spec.md` (one page) | architecture, ADRs, data model, interface contracts, test strategy | + spikes for high risks, threat model, contracts-first, operations design |
| Planning | task checklist in `docs/spec.md` | plan with increments, task files | + parallel lanes, increment demos |
| Code review | self-review | independent review per task | independent review per task |
| Increment verification | — (single increment) | increment tests | increment tests + human demo |
| Release | changelog + tag | release notes + deployment guide | + runbook, rollout/rollback plan, monitoring |
| Changes | XS: change note; S: short CR | full CR | full CR, stricter risk levels |

Modifiers (`complexity.md` §3) add steps independent of the track.

## Work sizing

| Default | Value |
|---|---|
| Task size | one objective, ideally one component; ≤ ~400 changed lines, ≤ ~10 files |
| First task | walking skeleton: scaffold, build, lint, test runner, at least one real test in every suite of `test_fast`, one end-to-end check, the fail-fast `check` command, entered in `AGENTS.md` §4 and enforced by the shipped pre-commit hook (`git config core.hooksPath .githooks`); replaces the template README |
| Increment | vertical, demonstrable slice; order: risk first, then `must`, then dependencies |
| Increments per tier | XS 1 · S 1 · M 2–4 · L 4+ |

## Cycles and maintenance

| Default | Value |
|---|---|
| After a release | `current_phase: maintenance`; small changes collect for the next release |
| Next release without a feature cycle | when the user asks, or when ≥ 1 verified CR waits and the user agrees; runs a testing phase scoped to the changes (`change.md` §10) and a release |
| New cycle | from a feature-size CR (`change.md` §11); `cycle` + 1, increments and IDs continue |

## Spec–code sync

| When | Check |
|---|---|
| Per task | deviations recorded with a class: `none`, `refinement` (documented as built), `baseline` (needs a CR) |
| Per increment (Lean: once, after the last task, before testing) | every deviation of the increment resolved; architecture and contracts still describe the code; contract tests green |
| Before release | as-built check: components, interfaces, data model, commands in `AGENTS.md` §4 and UI description match the built system |

## Escalation thresholds

| Situation | Default |
|---|---|
| Same check keeps failing in a task | stop after 3 attempts, record diagnosis, task `blocked` |
| New blocker/major bugs in one area during testing | XS after 2 fix rounds, S–L after 3 → ask the user how to proceed through the question interface (likely design problem: e.g. Design change via CR (Recommended) / Accept as known issue / Keep fixing) |
| Scoring evidence missing at intake | ≤ 3 follow-up questions, then score conservatively with an assumption |
| Context getting large in a session | stop at the next task/step boundary, state and commit first |
