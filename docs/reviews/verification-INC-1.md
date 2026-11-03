---
status: draft
relates_to: [INC-1, TASK-002, TASK-004, TASK-005, TASK-006a, TASK-006b, TASK-006c, TASK-007, TASK-009, TASK-010]
---
# Verification INC-1: resolution of the three reviews

Date: 2026-11-03. Reviews: **SYNC** (spec-code sync and traceability), **CODE** (correctness and security), **UX** (usability against the intake). Every finding is either fixed with a regression test, documented as a refinement or known limitation (task record / `docs/process-log.md`), or marked "change request needed" for the orchestrator. No baseline section of `docs/spec.md` was changed.

## Findings and resolutions

| # | Finding | Lens | Severity | Resolution | Evidence |
|---|---|---|---|---|---|
| SYNC F1 | `IfcOpeningElement` / `IfcDistributionPort` are not rows; not recorded | SYNC | major | **Change request needed** (baseline REQ-002 text) + **Decision to confirm** at the release gate. Behaviour kept (conservative: voids and ports would distort counts and sums, DEC-13 argument). | `docs/tasks/TASK-002.md` "Verification INC-1"; `docs/process-log.md` row 2026-11-03 "Business rule, REQ-002 rows"; CR-A below |
| SYNC F2 | Below 1280 px the side panels disappear for good | SYNC | minor | Fixed (same as UX M1) | `@e2e @UI below 1280 px the side panels collapse to drawers ...` (`test/e2e/filter-area.spec.mjs`); TASK-004 record; process-log refinement row |
| SYNC F3 | Numeric filter values / group labels with up to 6 decimals (spec: up to 3) | SYNC | minor | Fixed: 3 decimals (`valueLabel`, configuration notice); exact value in the tooltip (`valueTitle`) | `@e2e @REQ-004 numeric filter values show at most 3 decimals (spec 3.2), the tooltip the exact value` |
| SYNC F4 | Header title and legend use ligatures (`2x3` as `2×3`) | SYNC | minor | Fixed: `.cv-title`, `.cv-legend`, `.cv-group-pick-text` added to the no-`calt`/`liga` rule | `@e2e @UI data text keeps its characters (no calt/liga) ...` (extended to `#cv-title`, `#cv-legend`, `.cv-group-pick-text`) |
| SYNC F5 | Trace generator credits a string literal in `trace.test.mjs` as a test of REQ-004-AC2 | SYNC | minor | Fixed: the fixture source is assembled from parts; regression test; `docs/testing/traceability.md` regenerated (REQ-004-AC2 keeps 3 real tests) | `[unit] trace: no test file is credited with an ID it names only inside a string (SYNC F5)`; `node scripts/trace.mjs --check` |
| SYNC F6 | REQ-001-AC1 "both models shown in 3D" not asserted | SYNC | minor | Fixed: `CalcView.state()` asserted — every row with geometry of each model opaque, none ghost/hidden, row counts per model from the reference data | `@e2e @acceptance @REQ-001-AC1 two models: ...` (`test/e2e/filter-area.spec.mjs`) |
| SYNC F7 | Spec §4.2 module list out of date (config/HTML export in cv-app, `viewerHtmlParts` in cv-core, `cv-viewer-guard`, `tovLinkModules`) | SYNC | minor | Documented as design detail (module placement is an inner detail; no CR required). Optional lightweight CR-B for the orchestrator. | `docs/process-log.md` row "Design detail, spec §4.2 module layout" |
| SYNC F8 | Spec working sections §5 (TASK-010 `todo`), §6 (no results), §7 (R-2/R-4 text) out of date | SYNC | minor | **Orchestrator action** (working sections; this pass does not edit `docs/spec.md`). Proposed: §5 TASK-010 done; §6 link to `docs/testing/traceability.md`, the TASK-010 NFR table and this file; §7 R-2 resolved (NFR-002 32.8 / 40.9 s per 100 MB), R-4 resolved (complete frame <= 500 ms median; software-WebGL deviation in process-log). | this table; `docs/tasks/TASK-010.md` "Formal NFR measurements" |
| SYNC F9 | Decision records contradict answered Q-002 / Q-003; NFR-001 software-WebGL deviation only in TASK-010 | SYNC | minor | Documented: TASK-010 and TASK-006c mark Q-002 / Q-003 as confirmed (2026-11-02); process-log row for the NFR-001 deviation (release gate reads it) | `docs/tasks/TASK-010.md` "Decision to confirm"; `docs/tasks/TASK-006c.md` "Decisions to confirm"; `docs/process-log.md` row "Deviation, NFR-001 on PCs without GPU" |
| CODE F1 | Removed Fragments models never freed (`signatures`, `refreshCount` Maps) | CODE | minor | Fixed: both `WeakMap`, entries deleted in `removeModel`; seam `CalcView.liveModels()` | `@robustness @REQ-001 repeated load and remove of a model frees every removed model (no heap growth per cycle)` (`test/e2e/memory-robustness.spec.mjs`; fails before the fix: 1 retained) |
| CODE F2 | Configuration with many missing property keys freezes the tab (quadratic `includes`) | CODE | minor | Fixed: `Set`s for missing keys, invalid names, applied filter sets and column filters; TASK-007.md:48 claim corrected | `@e2e @robustness tolerant load: 100,000 missing property keys in filter sets, columns and column filters apply in linear time` (300,000 keys < 5 s) |
| CODE F3 | Dropped configuration does not wait for the IFC files of the same drop while a load runs | CODE | minor | Fixed: every configuration load waits for `whenFree()` (no action running, no queued file); TASK-007 "Edge" open point closed | `@e2e @robustness @REQ-009 a configuration dropped during a load waits for every model of the load and of its own drop` |
| UX M1 | Below 1280 px filter area and details unreachable; Tab reaches invisible controls | UX | major | Fixed: header toggles `Filter` / `Details` open drawers; collapsed panels `visibility: hidden` (Tab skips them); refinement recorded. Recheck FAIL: messages stayed invisible below 1280 px (testing BUG-T1) — fixed by the orchestrator: a new message below 1280 px opens the filter drawer | `@e2e @UI below 1280 px the side panels collapse to drawers: hidden from Tab, opened with Filter / Details`; `@e2e @robustness @UI below 1280 px a load error or configuration message opens the filter drawer and is visible` (fails before the fix); process-log refinement row |
| UX M2 | Table rows cannot be selected with the keyboard | UX | major | Fixed: row cursor (arrows, Page, Home, End; `aria-activedescendant`), Enter / Space select like a click, Right / Left expand / collapse groups | `@e2e @robustness @REQ-007 keyboard: arrows move the row cursor, Enter / Space select a row or group like a click, Right / Left expand / collapse` (`test/e2e/selection.spec.mjs`) |
| UX M3 | At 1280 x 800 quantity headers truncated, group labels scroll away | UX | major | Fixed in part: `Gruppe` / `Anzahl` pinned at the left in the grouping view (head, rows, total). Header text kept (spec form `<Pset>.<Property> (<unit>)`, tooltip and resize available) — refinement | `@e2e @UI grouping view at 1280 x 800: Gruppe and Anzahl stay pinned ...` (`test/e2e/grouping.spec.mjs`); `docs/tasks/TASK-006b.md` "Verification INC-1" |
| UX minor 1 | Messages stay after their cause; no success feedback | UX | minor | Fixed: each configuration load replaces the previous one's messages; `Konfiguration <Datei> geladen.`; "zuerst ein IFC-Modell laden" goes with the first model. `#cv-messages` already has `role="alert"` (the aria-live remark did not hold) | `@e2e @REQ-009 configuration messages: a success notice; outdated messages go with the next load or the first model` |
| UX minor 2 | Category colours can be nearly the same | UX | minor | Known limitation documented: colours stay stable across filter changes (DEC-15 as the reference app); changing the rule needs a CR | `docs/tasks/TASK-006a.md` "Verification INC-1"; existing `[unit] REQ-005 legend ... colours stay stable` |
| UX minor 3 | Viewer start screen shows app name, empty panels, `.ifc` file name | UX | minor | Fixed: exported header from the first paint, panels hidden until the payload is applied, progress names the model | `@e2e @REQ-010 @REQ-011 while the viewer starts it shows the exported title, no empty filter sets or model list, no .ifc file name` |
| UX minor 4 | Checked filter values below the fold when the viewer opens | UX | minor | Refinement documented (badge shows the count; pinning checked values would contradict REQ-004 sort order) | `docs/tasks/TASK-004.md` "Verification INC-1" |
| UX minor 5 | `+ Filtersatz` accessible name includes the plus | UX | minor | Fixed: accessible name `Filtersatz hinzufügen`, visible text unchanged | `@e2e @UI screen layout: header, filter area ~280 px, ...` (`test/e2e/filter-area.spec.mjs`; button name `Filtersatz hinzufügen`) |
| UX minor 6 | Catalogue lists entries with 0 elements | UX | minor | Refinement documented: the spec's special keys (§4.3) are always listed | `docs/tasks/TASK-004.md` "Verification INC-1" |
| UX minor 7 | Ghost vs. opaque hard to tell for white elements | UX | minor | Known limitation documented (`Ausblenden` is the alternative) | `docs/tasks/TASK-006a.md` "Verification INC-1" |
| UX minor 8 | Group expand/collapse buttons icon-only | UX | minor | Left as is (cosmetic): buttons have `aria-label`s; Right / Left on a group row now also expand / collapse (UX M2) | `@e2e @robustness @REQ-007 keyboard: ...` |

## Change requests needed (for the orchestrator)

**CR-A (from SYNC F1) — REQ-002 rows: name the excluded IFC classes.** Proposed text, appended to the REQ-002 sentence "Elements are listed by IFC class (not only those with geometry); spatial structure elements (project, site, building, storey) and type objects are not rows":
> "Openings (`IfcOpeningElement`) and distribution ports (`IfcDistributionPort`) are not rows either: they are voids and connection points, not elements to quantify, and would distort counts and sums (as DEC-13 for IfcSpace). The element classes are those of the Fragments importer (§4.3)."

Impact: none on code or tests (current behaviour); traceability unchanged. Needs the user's decision at the release gate (business rule); if the user wants openings or ports as rows instead, that is a product change (rows, counts, catalogue, reference values).

**CR-B (optional, from SYNC F7) — spec §4.2 module list.** Proposed: `cv-app` "filter state, table and grouping state, selection, configuration save/load, HTML export flow"; `cv-core` adds "viewer HTML parts (`viewerHtmlParts`)"; new block `cv-viewer-guard` "start timeout of the viewer file (embedded in the viewer)"; `cv-builder` "library linking (`tovLinkModules`), IFC conversion and extraction orchestration". Not required (inner detail, recorded in `docs/process-log.md`).

**Orchestrator action (SYNC F8):** update the working sections §5, §6, §7 of `docs/spec.md` as proposed in the table.

## Decisions to confirm at the release gate (all task records)

| Task | Decision to confirm |
|---|---|
| TASK-002 | `IfcOpeningElement` / `IfcDistributionPort` (classes outside the importer's element classes) are not rows (SYNC F1; CR-A) |
| TASK-007 | Logo size limit 1 MB (PNG / JPG / SVG by content) |
| TASK-007 | `Konfiguration laden` needs a loaded model (refused with no model and none loading; since CODE F3 a configuration dropped during a load waits for it) |
| TASK-007 | A part missing from a (hand-written) configuration keeps the current state |
| TASK-007 | Fourth configuration error class `too-large` (> 20 MB, not read) |
| TASK-007 | Not in the configuration: IfcSpace option, splitter position, collapsed details panel |
| TASK-008 | Export buttons need a loaded model |
| TASK-008 | Texts over 32,767 characters are cut in the `.xlsx` (Excel cell limit); CSV keeps the full text |
| TASK-008 | Formula-injection prefix for exactly `= + - @` (DEC-6 as written; not TAB / CR) |
| TASK-008 | Control characters in Excel texts written as `_xHHHH_` |
| TASK-008 | Esc in a filter search field never clears the element selection |
| TASK-008 | C1 covers only a range filter on a text column; a `values` filter on a numeric column is applied by equality |
| TASK-009 | The viewer shows the header date of the export |
| TASK-009 | The IfcSpace setting travels with the viewer file (no switch in the viewer) |
| TASK-009 | Expanded groups, selection and panel layout are not exported |
| TASK-009 | Files dropped on the viewer are ignored |
| TASK-009 | NFR-003 size target applied to viewer files from >= 100 MB of IFC only |
| TASK-009 | `HTML exportieren` needs a loaded model |
| TASK-010 | Viewer start timeout 120 s, conversion stall timeout 180 s |
| TASK-010 | Viewer start draws once after all models, configuration and streamed tiles (cap 8 s) |
| TASK-010 | `SETTLE_BUSY_MS` = 1,000 ms (single runs may exceed 500 ms; NFR-001 is a median) |
| TASK-010 | V3: URLs kept inside the bundled libraries (never requested) |
| TASK-010 | NFR-001 selection measured to the engine calls when no drawn tile changes |
| TASK-010 | "Most runs" = more than half of the runs per action |

Confirmed already (no longer open): Q-002 (NFR-001 = last changed 3D frame drawn; software-WebGL deviation shown at the gate, `docs/process-log.md`), Q-003 (group selection only shrinks). Deviation to show at the gate: NFR-001 pixels on screen 0.85-1.27 s on PCs without GPU.

## Commands run (all green)
- `node scripts/check.mjs` (format, lint, cdn-cache, unit tests with coverage, `@integration` on `http`): all steps green.
- `node scripts/trace.mjs --check`: current.
- Playwright, both projects (`file`, `http`): `test/e2e` (all 17 specs, incl. the new `memory-robustness.spec.mjs`), `test/acceptance`; `test/integration` on `file` (on `http` via check).
- Playwright perf (`file`): `test/perf/table.spec.mjs`, `grouping.spec.mjs`, `selection.spec.mjs` (table render, grouping and selection after the pinned-column and keyboard changes): passed.
- Embedded blocks: all 8 ASCII-only, no `</script>`.
