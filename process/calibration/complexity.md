# Calibration: complexity

> Calibration — defaults, not rules. Deviate with reason (`process/calibration/README.md`). The tier itself is a judgement: the agent proposes it with reasons, the user confirms.

Determines the tier (XS/S/M/L), the track, the detail-question topics and their depth, and the process modifiers from the intake answers.

## 1. Score the dimensions

Score each dimension 0–3. Cite the answer IDs used as evidence in `docs/intake/assessment.md`.

| # | Dimension | Evidence | 0 | 1 | 2 | 3 |
|---|---|---|---|---|---|---|
| D1 | Functional scope | C03 | ≤ 3 capabilities | 4–10 | 11–25 | > 25 or open-ended platform |
| D2 | Users and permissions | C02 | single user / no auth | 2 roles | 3–5 roles or ownership rules | multi-tenant or fine-grained permissions |
| D3 | Data and persistence | C05 | none / files | one store, simple model | rich domain model, migrations, history | several stores, sync, offline, large volume |
| D4 | Integrations | C06 | none | 1–2 well-documented APIs | 3–5, or poorly documented, or webhooks | > 5, real-time, bidirectional, legacy protocols |
| D5 | Topology / form factors | C04 | single process, CLI, library, static site | frontend + backend | several services, workers, queues, or 2 client platforms | distributed system, multi-region, or web + mobile + backend |
| D6 | Quality pressure (NFR) | C07 | none stated | normal expectations | explicit SLAs / latency / load targets | high availability, high load, real-time |
| D7 | Security and compliance | C05, C07 | none | standard auth | personal data (e.g. GDPR) | regulated domain (health, finance, safety), audits, certifications |
| D8 | Uncertainty / novelty | C10, C02 | well-known pattern | some unknowns | new domain or unproven tech | research-like, requirements unclear |
| D9 | Lifetime and ownership | C09 | throwaway / demo | prototype / MVP, one maintainer | long-lived product | multi-team, long-term platform |
| D10 | Existing systems | C08 | greenfield | extend small existing code | integrate with or extend legacy system | migrate / replace a large system |

**Unknown evidence:** ask a follow-up (max one round, ≤ 3 questions total — `delivery.md`). If still unknown, score **2** and record an `ASM-###`.
**"You decide" answers:** score by what a sensible default implies and record an `ASM-###`.

## 2. Compute the tier

| Total (0–30) | Tier | Typical project | Track |
|---|---|---|---|
| 0–3, no dimension ≥ 2, no GUI, no login, no database | XS | script / small CLI tool / single-purpose library | lean |
| 0–8 (otherwise) | S | mini application | lean |
| 9–17 | M | medium application with several modules | standard |
| 18–30 | L | complex application: database, login, integrations, … | full |

Escalation rules (applied after the total, only upwards):

| Rule | Condition | Effect |
|---|---|---|
| E1 | any dimension = 3 | tier ≥ M |
| E2 | two or more dimensions = 3 | tier = L |
| E3 | D7 = 3 | tier ≥ M; modifier `threat_model`; topic `security` at depth L |
| E4 | D10 ≥ 2 | tier ≥ M; modifier `brownfield` |

Downgrade: only by explicit user override. If the override goes below an escalation minimum, state the risk explicitly and record the user's confirmation in the assessment.

## 3. Modifiers

Modifiers add steps independent of tier.

| Modifier | Condition | Adds |
|---|---|---|
| `spikes` | D8 ≥ 2 | design phase: time-boxed spike tasks for each high risk before the architecture is fixed |
| `contracts_first` | D4 ≥ 2 or D5 ≥ 2 | design phase: interface contracts finalized and frozen before planning |
| `brownfield` | D10 ≥ 1 | design phase starts with an as-is analysis (`docs/design/as-is.md`) |
| `threat_model` | D7 ≥ 2 and tier ≥ M, or E3 | design phase: `docs/design/threat-model.md`; verification: security review |
| `ui` | C04 includes a graphical user interface | UI requirements section, UI design step, UI tests in verification |
| `parallel` | tier L and planning yields ≥ 2 independent lanes | parallel developer agents allowed |

## 4. Select detail topics and depth

Detail questions are a requirements analysis: every relevant topic is covered in every tier. The tier decides how deep.

### Topic relevance

Ask the topics in this order (files in `process/questionnaire/topics/`):

| # | Topic | Relevant when | Linked dimension |
|---|---|---|---|
| 1 | `functional` | always | D1 |
| 2 | `ui` | always — part A if there is a graphical UI, part B if CLI/API/library | D5 |
| 3 | `data` | D3 ≥ 1 | D3 |
| 4 | `integrations` | D4 ≥ 1 | D4 |
| 5 | `security` | D2 ≥ 1 or D7 ≥ 1 or tier L | D7 |
| 6 | `quality` | always | D6 |
| 7 | `operations` | always | D5 |
| 8 | `brownfield` | D10 ≥ 1 | D10 |
| 9 | `stack` | always (last: technology follows requirements) | — |
| – | closing `C99` | always | — |

### Depth

Every information need has a level matching the tiers: `XS`, `S`, `M` or `L`. A tier must cover the needs of its own level and all levels below it. How the agent asks is up to it (`process/questionnaire/README.md`).

| Tier | Required levels | Character |
|---|---|---|
| XS | XS | only the essentials: what goes in, what comes out, rules, error cases, examples, where it runs |
| S | XS, S | + look and feel, priorities, access rules, technical basics |
| M | XS, S, M | + full functional detail, UI behaviour, data lifecycle, operations basics |
| L | XS, S, M, L | + automation, scalability, observability, compliance, rollout |

Depth boost: if a topic's linked dimension scores ≥ 2, cover that topic one level deeper than the tier (XS → S → M → L, max L). E3 sets `security` to L.
Needs already answered by the description or earlier answers count as covered — ask for confirmation (as an option in a question round) only if it adds value.

### Question budget

| Tier | Required needs (catalogue) | Target | Ceiling | Detail rounds at target (≤ 4 per call) | Character |
|---|---|---|---|---|---|
| XS | up to 11 | 4–6 | 8 | 1–2 | a few confirmations; straight into the spec |
| S | up to 16 | 8–12 | 15 | 2–3 | mostly confirming proposals; quickly into the spec |
| M | up to 28 | 18–25 | 30 | 5–7 | full requirements interview, technical details proposed by the agent |
| L | up to 36 | 28–36 | 45 | 7–9 | full interview incl. compliance, operations and quality targets |

- Counted: detail questions incl. follow-ups and domain-specific questions. Not counted: C00, core gap questions (C01–C11), C99.
- A question that covers several needs counts once; a confirmation of several proposals in one question ("use cases as listed?") counts once.
- **Target** is where a good interview usually lands. **Ceiling** may only be exceeded with the user's consent (`process/questionnaire/README.md` → Framework). Depth boosts raise the ceiling by 3 per boosted topic.

## 5. Report the plan

The assessment lists the phases of the track, the gates requiring human approval (per autonomy), the topics with depth and number of questions, and an increment estimate:

| Tier | Increments (estimate) | Tasks per increment |
|---|---|---|
| XS | 1 | 1–4 |
| S | 1 | 3–10 |
| M | 2–4 | 5–15 |
| L | 4+ | 5–20 per lane |

## 6. Tier changes during the project

Re-score at the end of design and in every CR that adds capabilities, roles, integrations, data classes or form factors.

- **Up:** inform the user, record the re-assessment, migrate the track as part of the triggering CR (or as its own CR):

  | From → to | Migration |
  |---|---|
  | XS → S | `docs/spec.md` stays; add the S-level detail questions of newly relevant topics; switch change records from change notes to short CRs |
  | XS/S → M | split `docs/spec.md` into `requirements.md`, `architecture.md` (+ ADRs for decisions already made), `plan.md` + task files, `test-strategy.md`; ask the missing M-level detail questions for affected topics only; enable increment testing and independent reviews; user approves the new baseline |
  | M → L | add L-level questions for affected topics; threat model, operations design, contracts-first where now required; extend the test strategy to the L intensity; user approves |

- **Down:** only on explicit user request; documents are not merged back, only the lighter rules apply from then on.

