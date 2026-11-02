---
id: CR-###
title: <short>
category: normal         # standard (STD-x) | normal | emergency
size: change             # change | feature (opens delivery cycle — process/calibration/change.md §11)
depends_on: []           # earlier CR-### this change builds on
risk: low                # low | medium | high
risk_score: 0
status: submitted        # submitted | analysed | reviewed | awaiting_approval | approved | queued | deferred | rejected | in_progress | verified | closed | rolled_back
source: user             # user | bug | design-gap | assumption | dependency | agent
requested_by: <name / role>
date: <YYYY-MM-DD>
earliest_phase: <requirements | design | planning | implementation>
version_effect: <major | minor | patch>
baseline_tag: pre-CR-###
branch: change/CR-###-<slug>
related: []              # BUG-###, CR-###, ASM-###, Q-###
---
# CR-###: <title>

## 1. Request
> <verbatim>

Normalized: <what exactly should change and why (business or technical reason)>

## 2. Classification
- Category: <…> because <criteria matched; for standard: catalogue entry STD-x>
- Size: <change | feature> because <criteria of calibration §11>; feature → cycle <n>

## 3. Impact analysis

| Area | Affected items | Effect |
|---|---|---|
| Requirements / ACs | REQ-… | new / changed / superseded |
| NFRs | | |
| UI | screens / commands | |
| Design / ADRs / components | | |
| Contracts / external interfaces | | |
| Data | entities, schema, stored data | |
| Configuration / runtime | | |
| Tests | to change / to add | |
| Open tasks | TASK-… | on hold / re-plan |
| Done tasks / released behaviour | | |
| Other CRs | | overlap? |

Predicted changes (for PIR): <files / directories / components>

### Evidence
| Search / command | Result |
|---|---|
| `grep -rn "REQ-012" docs/ src/ tests/` | … |

## 4. Risk

| Factor | Score | Reason |
|---|---|---|
| R1 Baseline artifacts | | |
| R2 Blast radius | | |
| R3 Completed work | | |
| R4 Data | | |
| R5 Interfaces | | |
| R6 Security / compliance | | |
| R7 Reversibility | | |
| R8 Test safety net | | |
| R9 Defect history | | |
| **Total → level** | | |

## 5. Plan
1. Artifacts: …
2. Tasks: …
3. Increment / release: …

## 6. Test scope
| Test | Why |
|---|---|

## 7. Rollback plan
- Code/docs: revert merge of `change/CR-###-<slug>`
- Data: …
- Configuration: …
- External effects: …
- Rollback tested: <yes, how / not required (R7 = 0)>

## 8. Review and approval
- Change review: <not required | findings and resolution>
- Decision: <approved / rejected / deferred / queued> by <human | agent> on <date>. Note: …

## 9. Implementation record
| Date | Commit / task | Note |
|---|---|---|

Test results: <type → result>
Deviations from plan: …

## 10. Post-implementation review
- Goal achieved: <ACs pass?>
- Predicted vs. actual files: <unpredicted files and why>
- Side effects / bugs introduced: <BUG IDs or none>
- Lessons / process improvements: …
