---
status: approved
date: 2026-11-02
relates_to: [C00, C02, C04, C05, C08, C09, C11, F-01, F-02, F-03, F-04]
---
# Complexity assessment

## Scores

| Dim | Name | Score | Evidence (answer IDs + reason) |
|---|---|---|---|
| D1 | Functional scope | 2 | C00, F-02..F-04: multi-IFC load, configurable facet sets, cross-filtered AND facets with counts, model filter/colouring, element details, single-element table, grouping (2 levels, expandable), column choice/order, column filters, CSV + Excel export, JSON config save/load, offline HTML export that stays configurable → ~13 capabilities |
| D2 | Users and permissions | 1 | C02: no login; two usage modes (builder author vs. recipient of the exported file) with different capabilities |
| D3 | Data and persistence | 1 | C05, F-03, F-04: no database; one data model (property index + config schema) persisted as files (JSON, embedded in HTML) |
| D4 | Integrations | 1 | C10: web-ifc / That Open Fragments / three.js (CDN at build time), Excel file format |
| D5 | Topology / form factors | 1 | C04, F-03: static browser app plus a generated offline viewer artefact sharing one runtime; no backend |
| D6 | Quality pressure | 1 | not stated; screenshot model has ~19k elements → normal expectations, large-model behaviour asked in QLT-01 |
| D7 | Security and compliance | 0 | C05: no personal data, no login; offline files |
| D8 | Uncertainty / novelty | 1 | proven stack (C08) but unverified: storey/material/type-pset extraction, offline Excel export, export size of large models (modelviewer-analysis.md → risks) |
| D9 | Lifetime and ownership | 2 | C09: long-lived tool, one maintainer |
| D10 | Existing systems | 1 | C08: new app reusing code and style of the small `html-modelviewer` |
| | **Total** | **11/30** | |

## Result

- Tier by total: M
- Escalations applied: none (no dimension = 3, D10 < 2)
- **Tier: S → track: lean** (user override of proposed M)
- Override: proposed M (total 11); user chose S on 2026-11-02 ("Tier S (leichter)"). No escalation minimum applies (no dimension = 3, D10 < 2), so no risk confirmation is required. Accepted trade-off: one `docs/spec.md` instead of separate requirements/architecture/plan, one increment, verification once before testing; re-scoring at end of spec and on every capability-adding change (`calibration/complexity.md` §6).
- Modifiers: `ui` (graphical UI), `brownfield` (D10 = 1: as-is analysis of html-modelviewer at design start)
- Autonomy: autonomous (C11)

## Process plan

| Phase | Included | Human gate | Notes |
|---|---|---|---|
| intake | yes | yes | |
| spec | yes | agent | `docs/spec.md` incl. UI section (`ui`) and as-is notes (`brownfield`) |
| implementation | yes | agent | one increment |
| verification | yes | agent | once: spec–code sync + review |
| testing | yes | agent | 7 core test types at S depth |
| release | yes | yes | |

- Detail topics (tier S, levels XS+S; functional boosted to M by D1 = 2): functional (M), ui (S, part A), data (S), integrations (S), security (S, light), quality (S), operations (S), brownfield (S), stack (S) → target 8–12 questions; ceiling 18 (15 + 3 for the boosted topic)
- Increment estimate: 1
- Assumptions made during scoring: D6 normal expectations until QLT-01 is answered

## Re-assessments

| Date | Trigger | Changed scores | Tier before → after |
|---|---|---|---|
| 2026-11-02 | user override at tier confirmation | none | M (proposed) → S |

## Change history

| Date | Change | By |
|---|---|---|
| 2026-11-02 | approved at intake gate | human |
