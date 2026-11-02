# Calibration

Defaults, not rules. Every number, matrix and threshold of the process lives here, so the kernel stays small and models can adapt the process to the project.

| File | Calibrates |
|---|---|
| `complexity.md` | complexity dimensions, tier thresholds, escalations, modifiers, information-need levels, question budget, tier upgrades |
| `delivery.md` | what each track produces, reviews, task sizing, escalation thresholds |
| `testing.md` | test types, applicability and intensity per tier, when tests run, test design checklist |
| `change.md` | when a CR is needed, categories, standard changes, risk factors, approval matrix, tier scaling, versioning |
| `../questionnaire/` | catalogue of information needs per topic and level |

## Using defaults

- Start from the defaults. They encode what usually works.
- Deviate when the project calls for it: a different threshold, an extra or omitted test type, a lighter or heavier artifact, a different weighting. Record each deviation in `docs/process-log.md` (template `process/templates/process-log.md`): what, why, expected effect.
- Deviations that change the tier, lower human control (gates, approvals) or reduce verification below the tier's defaults need the user's confirmation.
- Kernel invariants and exit criteria are never calibrated away.
