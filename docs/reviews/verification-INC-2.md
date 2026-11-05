---
status: final
relates_to: [INC-2, CR-002, TASK-005, TASK-007, TASK-014, TASK-015a, TASK-015b, TASK-016, TASK-017c, TASK-018, TASK-020]
---
# Verification INC-2: resolution of the three reviews

Date: 2026-11-05. Reviews: **SYNC** (spec-code sync and traceability), **CODE** (correctness and security), **UX** (look and usability against the reference app and the user answers of CR-002). Twelve findings were confirmed by an independent confirmation pass. Every one is fixed with a regression test that fails before the fix, documented as a refinement or known limitation (task record and `docs/process-log.md`), or marked "change request needed" for the orchestrator. No baseline section of `docs/spec.md` (§2-§4) was changed; the working sections §6 and §7 were brought up to date (SYNC-3).

## Findings and resolutions

| # | Finding | Lens | Severity | Resolution | Evidence |
|---|---|---|---|---|---|
| UX-1 | The hint pill CSS (`.cv-hint`) also styled every 1.0.0 help and empty-state text: header-dialog hints stacked as one pill over the table, `Keine Treffer.` covered `Absteigend` in the column filter | UX | major | **Fixed:** the pill rules apply to `#cv-hint` (the 3D navigation hint) only; all other `.cv-hint` texts are inline grey text again | `@e2e @UI help and empty-state texts stay inline in their dialog, popup or list; only the 3D hint is a pill (INC-2 UX-1)` (`test/e2e/overlay-layout.spec.mjs`; fails before the fix: `position: absolute`); `docs/tasks/TASK-015a.md` "Verification INC-2" |
| UX-6 | 3D background flat grey instead of the reference radial gradient (user answer Q4 `Genauso`) | UX | minor | **Fixed:** `#cv-canvas-box` has the reference gradient (ref L1723-1727) behind the transparent canvas; `--cv-bg-3d` stays `#eceef0`. The canvas pixel checks of `smoke.spec.mjs` / `viewer.spec.mjs` now compare each pixel with a screenshot of the same box with the canvas hidden (`canvasShots`, `test/support/viewer.mjs`), thresholds unchanged (empty view 0.000, FZK 0.096) | `@e2e @UI the 3D background is the reference radial gradient … (INC-2 UX-6)` (`test/e2e/overlay-layout.spec.mjs`; fails before the fix: `none`); `docs/tasks/TASK-014.md` "Verification INC-2" |
| CODE-1 | Filter panel status stays `Eigenschaften werden gelesen ... 100 %` when the row set changes while the panel builds the index | CODE | minor | **Fixed:** `indexing` holds the store being indexed; `refresh()` writes `X von Y Objekten sichtbar` for any other store at once, and an older build never clears a newer build's flag | `@e2e @robustness @REQ-012 a model removed while the filter panel builds the display-text index: the panel status shows the remaining row set (INC-2 CODE-1)` (`test/e2e/rule-filter.spec.mjs`; the build is held open in the test; fails before the fix with exactly the reported text) |
| CODE-3 | `sectionPlane` normal with an overflowing length (`Math.hypot` = Infinity) passes validation, becomes `[0, 0, 0]` and drops the section without a notice | CODE | minor | **Fixed:** `normaliseSectionPlane` scales such a normal by its largest component first, so its direction is kept (DEC-20 "normal normalised", as any non-unit normal); new DEC-20 case `sectionPlane-overflowing-normal` | `[unit] DEC-20 sectionPlane …` (three overflowing normals) and `[unit] DEC-20 field table …` (`test/unit/config-cr002.test.mjs`); `@e2e @acceptance @REQ-009-AC8 @robustness DEC-20 invalid case sectionPlane-overflowing-normal …` (`test/e2e/config-compat.spec.mjs`); all fail before the fix (`Received: null`) |
| CODE-2 | Many filter rules in a configuration slow every later interaction (no rule limit; all rule rows rebuilt on every refresh) | CODE | minor | **Fixed in part + known limitation:** rule rows are kept while the rule list is unchanged (20,000 rules on FZK: refresh 635 ms before, 78 ms after). The evaluation stays linear in the rule count (about 4 µs per rule); a rule cap would be a new business rule for a hand-made file only, so it is recorded as a known limitation | `@e2e @robustness @REQ-012 a configuration with 20,000 filter rules: all applied and listed; an interaction does not rebuild the unchanged rule rows (INC-2 CODE-2)` (fails before the fix); `docs/process-log.md` 2026-11-05 "Known limitation, filter rules from a configuration"; `docs/tasks/TASK-015b.md` |
| SYNC-1 | Display-text index rebuilt synchronously without the progress overlay on row-set change, configuration load and viewer start; not recorded | SYNC | minor | **Documented as refinement** of §4.3 / NFR-001 with the TASK-020 measurements (495-549 ms incl. rebuild at 30,931 rows; viewer with a text source usable in 7.9 s). Release-gate item | `docs/process-log.md` 2026-11-05 "Refinement, spec §4.3 display-text index / NFR-001"; `docs/tasks/TASK-015a.md`, `TASK-018.md`, `TASK-020.md` "Verification INC-2" |
| SYNC-2 | Decisions deviating from spec wording only in task records: (a) `Eigenschaft` suggestions and colouring list in catalogue order; (d) index built on the first panel opening | SYNC | minor | **Documented as refinements** (two process-log rows). Release-gate items; the spec wording may be aligned by the orchestrator | `docs/process-log.md` 2026-11-05 rows "REQ-012 `Eigenschaft` suggestions …" and "spec §4.3 built lazily on first use"; `docs/tasks/TASK-015a.md`, `TASK-015b.md`, `TASK-016.md` |
| SYNC-3 | Spec working sections §6, §7 and the change history stale after INC-2 | SYNC | minor | **Fixed (working sections):** §6 now 100/100 ACs, 5/5 NFRs with the TASK-020 results and a row for this file; §7 closes R-5, R-6, R-7, the T11 bullet, BUG-T2 and the trace bullet with evidence. **Orchestrator action:** the change history (CR-002 row "spec gate (agent) pending" → approved 2026-11-04 as in `docs/state.yaml`; a row for the 2026-11-05 Q-004 correction of REQ-013-AC3) is left to the orchestrator, who owns the change records | `docs/spec.md` §6, §7 (diff) |
| SYNC-4 | Partial or unit tests name changed ACs in their titles (spec T5), so the trace over-credits them | SYNC | minor | **Fixed:** five titles retagged, AC IDs moved into comments: `config-roundtrip.spec` (→ `@REQ-009`), `config.test` round trip (→ `REQ-009`), `filter-engine.test` reset (→ `REQ-004`), `colouring.test` Kategorie (→ `REQ-005`), `selection.spec` group-row test (`@REQ-007-AC2` removed). Every AC keeps its whole-AC test; traceability regenerated (100 of 100) | `docs/testing/traceability.md`; `node scripts/trace.mjs --check` current; `docs/tasks/TASK-018.md`, `TASK-020.md` |
| SYNC-5 | Three spec T7 CR-002 robustness items without a test | SYNC | minor | **(3) Tested:** search typed and `Freie Textsuche` applied while the index builds → the latest text and the rule apply (passes; no product change). **(1)** `Schneiden` / `Fokus` while a display plan is queued and **(2)** 1 mm minimum step on a flat extent: **open for the testing phase with a reason** (need a hook that holds the engine's plan queue, resp. a model flat along the normal; both hold by construction). The orchestrator assigns or accepts | `@e2e @robustness @REQ-012 search typed and \`Freie Textsuche\` applied while the display-text index builds … (INC-2 SYNC-5)` (`test/e2e/rule-filter.spec.mjs`); `docs/tasks/TASK-014.md`, `TASK-015b.md`, `TASK-017c.md` |
| SYNC-6 | Spec §4.4 test seam lacks `CalcView.contextState()`; §4.2 and `AGENTS.md` `source_layout` lack `test/acceptance`, `test/support` | SYNC | minor | **Change request needed** (CR-C below; §4 baseline and project configuration, text only). Recorded as design detail in the process log | `docs/process-log.md` 2026-11-05 "Design detail, spec §4.4 test seam …" |
| SYNC-7 | Obsolete 1.0.0 notes named in spec §7 not updated as built (TASK-005 L1 legend; TASK-007 collapsed details panel) | SYNC | minor | **Fixed:** as-built notes in both records; "collapsed details panel" leaves the 1.1.0 release-gate list; §7 bullet points to them | `docs/tasks/TASK-005.md`, `docs/tasks/TASK-007.md` "Verification INC-2" |

## Refuted or narrowed findings (by the confirmation pass)

- **SYNC:** SYNC-1 lowered from major to minor (no AC, user answer or NFR target broken). SYNC-2 (b) refuted (a label typed in another letter case extends the spec; REQ-012-AC11 holds). SYNC-2 (c) refuted (the load-fit padding is an inner detail; `Ansicht einpassen` is gone, `Fokus` follows the reference).
- **CODE:** none refuted; all three stayed minor.
- **UX:** UX-2 (3D view height at 1280 × 800: baseline §2 layout), UX-3 (`Ausgeblendete verbergen/anzeigen` labels: REQ-005-AC1, DEC-18), UX-4 (`Filter entfernen` also resets hide/isolate: Q3, Q9, DEC-21), UX-5 (icon-only pills: REQ-005-AC12), UX-7 (property group order: spec L153), UX-8 (`BaseQuantities.Length` label: REQ-012-AC2), UX-9 (`Färben` strings: REQ-005-AC9), UX-10 (legend counts: DEC-15), UX-11 (column widths: no requirement), UX-12 (row cursor outline: INC-1 UX M2, listbox behaviour), UX-13 (click menu at the point: REQ-013-AC1).

## What each lens did not check

- **SYNC:** about 60 cycle-2 AC tests only by title and location; pixel and layout values beyond the test assertions; NFR numbers re-run (taken from TASK-020); look parity with the reference (UX lens); README and CHANGELOG.
- **CODE:** 3D engine internals carried over from 1.0.0 beyond the display plan and section code; performance on the large fetched models (CODE-1 natural timing and CODE-2 on 30k rows are estimates); keyboard focus traps beyond reading the code; the XLSX writer; the full suites. Observed but not filed: a search or `Freie Textsuche` loaded from a configuration builds the index synchronously (now SYNC-1 refinement).
- **UX:** widths below 1280 px and touch; screen-reader output beyond accessible names; arrow keys on the section handle; the `Eigene Farbe` picker; numeric rule values beyond one attempt; large models; loading an old 1.0.0 configuration; the exported viewer beyond its first screen (same CSS, so UX-1 and UX-6 apply there too and are fixed with it); a 1920 px side-by-side against the reference.

## Change requests needed (for the orchestrator)

**CR-C (from SYNC-6) — test seam and test layout, text only.** Proposed: spec §4.4 adds "`CalcView.contextState()` → { items, visible, paints } of the context geometry (e.g. IfcSite terrain), used by REQ-013-AC3" next to `CalcView.state()`; spec §4.2 and `AGENTS.md` §4 `source_layout` list `test/{unit,integration,e2e,acceptance,perf,fixtures,support}`. Impact: none on code or tests (current state); traceability unchanged.

**Orchestrator action (SYNC-3, change history):** CR-002 row: "spec gate (agent) pending" → approved by the agent on 2026-11-04 (`docs/state.yaml`); new row 2026-11-05 for the Q-004 correction of REQ-013-AC3 (`contextState().visible = 0`). Optional: align the spec wording of §4.3 / NFR-001 (SYNC-1) and REQ-012 suggestion order / §4.3 "first use" (SYNC-2) if the user keeps the built behaviour at the release gate.

**Orchestrator action (SYNC-5):** assign T7 items (1) `Schneiden` / `Fokus` while a display plan is queued and (2) the 1 mm minimum step on a flat extent to the INC-2 testing phase, or accept the recorded reason.

## Items for the 1.1.0 release gate (added by this verification)

| Source | Item |
|---|---|
| SYNC-1 | Index rebuilt synchronously without the progress text on row-set change, configuration load and viewer start (measured within the NFR-001 index target and NFR-003) |
| SYNC-2 (a) | `Eigenschaft` suggestions and colouring property list in catalogue order (`Allgemein` first), colouring list with unit |
| SYNC-2 (d) | Index built when the filter panel first opens |
| CODE-2 | Known limitation: filter evaluation linear in the number of rules (only hand-made configurations with thousands of rules notice it) |
| SYNC-7 | TASK-007 "not saved: collapsed details panel" is obsolete (the panel is gone); IfcSpace option and splitter position stay unsaved |

QUESTION FOR USER: none.

## Commands run (all green)
- `CV_TEST_PORT=5240 node scripts/check.mjs` (format, lint, cdn-cache, unit tests with coverage, `@integration` on `http`): all steps green (82.6 s).
- `node scripts/trace.mjs` regenerated; `node scripts/trace.mjs --check`: current (100 of 100 ACs, 5 of 5 NFRs).
- Playwright, both projects (`file`, `http`), in chunks under 10 minutes: `test/e2e` colouring + config-compat + config (70 passed); element-tools-3d + element-tools + export + filter-area (68); filter-robustness + grouping-robustness + grouping + hide-isolate + keyboard (54); layout-followups + memory-robustness + overlay-layout + panel-actions + properties-panel (36); rule-filter + selection + smoke + system (51 passed, 1 skipped by design); table-robustness + table + view-3d + view-tools (54); viewer-offline + viewer-robustness + viewer (26); volume-robustness (1 passed, 1 skipped by design); `test/integration` + `test/acceptance` (70).
- Each new regression test was run against the pre-fix builder and failed (UX-1, UX-6, CODE-1, CODE-2, CODE-3), and passes after the fix on both projects.
- Perf suites not re-run: the product changes touch CSS, the panel status text, the rule-row rendering (now less work) and the section normal validation, none of the NFR paths' evaluation.
- Embedded `<script type="text/plain">` blocks (6): ASCII-only, no `</script>`.

## Orchestrator resolution (2026-11-05)

- CR-C raised as **CR-003** (proposed, small, text only); decided at the 1.1.0 release gate.
- Spec change-history rows added: spec-gate approval of the cycle-2 delta, Q-004 correction of REQ-013-AC3, this verification.
- SYNC-5 items (1) `Schneiden` / `Fokus` while a display plan is queued and (2) 1 mm minimum section step: assigned to the testing phase (cycle 2).
- Independent recheck: VERDICT PASS.
