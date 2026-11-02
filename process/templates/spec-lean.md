---
status: draft        # draft | approved
date: <YYYY-MM-DD>
---
# Specification — <project>

Lean track: requirements, design and tasks in one file. Keep each section short.
**Baseline sections** (change via CR once approved): 1–4. **Working sections** (change freely): 5–7 and the change history.

## 1. Goal
<C01/C02 in 2–3 sentences. Success criterion (C09).>

## 2. Requirements

### REQ-001: <title>
- Priority: must | should | could · Source: <C03 …>
- The system shall …
- REQ-001-AC1: Given … When … Then …
- REQ-001-AC2: …

### NFR-001: <title>
- Target: <measurable> · Verify by: <test/measurement>

### User interface
- Screens / commands: <list with purpose>
- Look and feel, devices: …
- Feedback and error behaviour: …

### Constraints
- CON-001: …

## 3. Out of scope
- …

## 4. Design
- Stack: <language, framework, storage> (rationale in one line; ADR only if contested)
- Structure: <directory tree with component responsibilities>
- Data: <entities and fields>
- Interfaces: <CLI args / endpoints / public API>
- UI: <screen structure / text wireframes for key screens, component library, styling>
- Error handling and configuration: <one line each>
- Decisions taken without asking: <"Agent decides" items: decision + reason>
- Commands: see `AGENTS.md` §4

### Testing
| Type | Concrete form for this project |
|---|---|
| T1 Unit | |
| T2 Integration | <modules together; files, OS, called tools, APIs> |
| T3 System | <installed in a clean environment with real config/files> |
| T4 E2E | <every user flow, input → output> |
| T5 Acceptance | all ACs and NFRs |
| T6 Performance/Load | <runtime/memory on realistic and ≈ 10× input; baseline; performance-critical paths: …> |
| T7 Robustness | <invalid/missing/huge input, broken files, failing dependencies> |
| T8 Regression, T9 Smoke | always |
| T10–T14 | <per `process/calibration/testing.md` §2, reason if not> |

## 5. Tasks  _(working section)_

| ID | Title | Implements | Depends on | Touches | Status |
|---|---|---|---|---|---|
| TASK-001 | Walking skeleton | enabler | – | | todo |

Task details (only where the table is not enough):
- TASK-002: <instructions, acceptance checks>

## 6. Testing results  _(working section)_

| AC / NFR | Test(s) | Type | Status |
|---|---|---|---|
| REQ-001-AC1 | | | |

Test types executed: <type → pass/fail> · Performance margin: <measured vs. target> · Bugs: <IDs, details in `docs/testing/bugs.md`> · Recommendation: <release / not>

## 7. Open points  _(working section)_
- See `docs/open-questions.md`: <IDs>

## Change history

XS: this table is the change record (change note). S: one row per CR, details in `docs/changes/`.

| Date | CR | Request | Category | Affected IDs | Risk check (R4/R5/R7) | Tests run | Result / PIR |
|---|---|---|---|---|---|---|---|
