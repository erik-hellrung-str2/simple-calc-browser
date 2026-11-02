---
id: TASK-006a
title: Table single-element view (virtualised rows, column chooser / move / resize / remove, sort, column filters, full filter coupling table + 3D); TASK-003 D2; follow-ups F1, L1-L4
type: feature
status: done (verification pending)
implements: [REQ-006-AC1, REQ-006-AC4, REQ-006-AC5, REQ-006-AC6, REQ-006-AC9, REQ-004-AC1 (table + 3D + filter sets), REQ-004-AC4 (full), REQ-001-AC3 (full), REQ-001-AC4 (full), DEC-17]
relates_to: [NFR-001, UI-01, UI-02, DEC-14, TASK-003 D2, TASK-004 F1, TASK-005 L1-L4, TASK-006b, TASK-006c, TASK-007]
depends_on: [TASK-004, TASK-005]
touches: [calc-viewer-builder.html (cv-css, cv-core-src, cv-ui-src, cv-3d-src, cv-app-src), scripts/make-unit-fixtures.mjs, scripts/ref/derive-reference.mjs, test/fixtures/fzk-range.ifc, test/fixtures/manifest.json, test/fixtures/reference-values.json, test/unit/table.test.mjs, test/support/table.mjs, test/support/long-fixture.mjs, test/support/perf-lock.mjs, test/e2e/table.spec.mjs, test/e2e/table-robustness.spec.mjs, test/e2e/layout-followups.spec.mjs, test/acceptance/table-fetched.spec.mjs, test/perf/table.spec.mjs, test/perf/view-3d.spec.mjs (import only), test/perf/load-100mb.spec.mjs (import only), docs/process-log.md]
---
# TASK-006a: Table, single-element view

## What was built

### cv-core (pure, unit-tested)
- `DEFAULT_COLUMNS` = `Modell`, `Kategorie`, `Name`, `Geschoss` (REQ-006). `COLUMN_WIDTH` (min 60, max 800; text 160, number 150, `Name` 240 px), `defaultColumnWidth`, `clampColumnWidth`.
- `normaliseColumns(list, catalog)`: the column list of the configuration, `[{ key, width }]` in display order. Duplicate or empty keys are dropped and widths clamped.
- `moveItem(list, from, to)`: the column move.
- `formatCell(value)`: cell text. Numbers use German format (thousands `.`, decimal `,`, up to 3 decimals), multi-values are joined with `, `, and empty values give an empty cell.
- `parseNumberInput(text)` (TASK-003 D2): parses a range bound typed by the user.
  - Accepted: a German decimal comma (`2,5`, `-0,75`, `1.234,5` with thousands dots) or a decimal point (`2.5`). Without a comma, a point is the decimal separator.
  - Empty or blank text means no bound.
  - Anything else is `{ valid: false }`.
- `pruneSelection(store, key, values)` (REQ-001-AC3): keeps the selected values that still occur in the row set. `(leer)` stays while some row is empty.
- `numberRange(store, key, bits)`: min and max of a numeric column among the rows passing the other filters. It is the hint shown under the range inputs.

### cv-ui: the table (`#cv-table`)
- **Toolbar.**
  - `Tabelle`.
  - `Einzelelemente | Gruppiert`. `Gruppiert` stays disabled until TASK-006b; its tooltip reads "Die gruppierte Ansicht folgt.".
  - `Spalten`.
  - `Export CSV` / `Export Excel`, disabled until TASK-008.
- **`createTable`.**
  - One scroll box (`#cv-tbl-scroll`, `role=grid`) with a sticky header row and a virtualised body.
  - **Rows.** Only the rows near the visible window exist: a pool, 8 rows overscan, row height 28 px.
  - **Cells.** Within a row, only the cells of the columns near the visible width exist (240 px overscan on each side), so 200 columns stay cheap.
  - **Reuse.** Rows and cells are reused while scrolling; text is set only when it changed.
  - **Alignment.** Numbers are right-aligned with `tabular-nums`. Long values are cut with an ellipsis and their full text is the tooltip (`title`).
  - Every value from the model is set as text (`textContent` or an attribute).
- **Header cell (`.cv-th[data-key]`).**
  - **Label button.** A click cycles the sort: ascending → descending → unsorted. The button's accessible name is `Sortieren nach <Titel>`, and `aria-sort` reflects the state.
  - **Sort arrow.**
  - **Filter button.** `Spaltenfilter: <Titel>`; it is pressed (accent) while a filter is set.
  - **Resize handle.** `role=separator`; pointer drag or ArrowLeft/ArrowRight (±16 px).
  - **Move.** The cell itself is draggable (HTML5 drag and drop). Dropping on the left half of another header places the column before it, the right half after it.
  - **Rebuilds.** Header cells are rebuilt only when keys or titles change; widths, sort and filter state are updated in place, so a resize drag keeps its pointer capture.
- **Column filter popup (`#cv-colfilter`, `role=dialog`, `Spaltenfilter: <Titel>`).**
  - Top: `Aufsteigend` / `Absteigend` sort buttons. A second click on the active direction turns sorting off.
  - Bottom: `Filter zurücksetzen` and `Spalte entfernen`.
  - **Text columns:** search field and a virtualised checklist with counts (OR within the column).
  - **Numeric columns** (catalogue kind `number`): `von` / `bis` text fields (`inputmode=decimal`). Both bounds are inclusive and an empty field means no bound (DEC-17). The hint reads `Werte: <min> – <max>. Grenzen inklusive, leeres Feld = keine Grenze.`
  - **Invalid input (D2).** The field is marked `aria-invalid`, and the status hint reads `Ungültige Zahl in „bis“ – die Eingabe wird ignoriert. Beispiel: 2,5`. The applied bound of that field stays unchanged.
  - Escape (marked `defaultPrevented`, so the 3D selection is kept), a click outside, the close button or the same filter button closes it. The popup flips above the header when there is no room below.
- **Column chooser `Spalten`.**
  - This is the TASK-004 catalogue dialog with a new option `extra`: `keepOpen`, a top section and its own label for used entries.
  - Top section `Angezeigte Spalten`: each column with `Spalte nach links/rechts: <Titel>` and `Spalte entfernen: <Titel>`.
  - Below it, `Spalte hinzufügen`: search and the grouped catalogue. Shown columns are marked `angezeigt`. The dialog stays open, so several columns can be added in a row.

### cv-app: state and coupling
- **Table state.** `columns` `[{ key, width }]`, `sort` (`{ key, dir }` or null) and column filters by key.
  - Text filter: `{ type: 'values', values }`. Range filter: `{ type: 'range', min, max }`.
  - Filter id `col:<key>` (TASK-003).
- **One filter evaluation.** `coreFilters()` = filter sets + column filters (AND). `refresh()` evaluates them once, and its result drives:
  - filter sets (facets),
  - the status line,
  - 3D (`sync3d`),
  - the table (`updateTable`: `sortRows` on the filter result, then render),
  - the open popup (its checklist counts under all other filters, or the range hint).
- **Changes that call `refresh()`.** A column filter change or `Alle Filter zurücksetzen` (it now also clears the column filters, REQ-004-AC4) runs `refresh()`, so filter sets, table, status line and 3D all follow. A sort change only re-sorts the table.
- **`store.retain`** keeps the columns of filter sets, colouring, column filters and the sort key.
- **Removing a column** also removes its column filter and its sort.
- **Row-set change** (`publish`: load, remove, IfcSpace option; REQ-001-AC3/AC4): checked values of filter sets and text column filters that no element has any more are dropped (`pruneSelection`). A column filter left without values is removed. Range filters stay.
- **Configuration part (REQ-006-AC6, for TASK-007).**
  - `start().tableState()` / `window.CalcTable.state()` return `{ columns [{ key, width }], sort, columnFilters [{ key, type, values | min, max }] }`.
  - `setTableState(state)` / `CalcTable.setState` apply one. Keys that are not columns are skipped for filters and sort.
  - `CalcTable.stats()` returns the render statistics.
  - `window.__calc.table` = `{ columns, sort, filters, count, keys (display order, built when read), updates, lastMs }`.
- **Hook for TASK-006c.** A row click calls `tableHandlers.rowClick(key)`, which calls the listeners registered with `start().onRowClick(listener)`. Rows carry `data-key`. No selection is made yet.

### Follow-ups fixed
| Item | Fix |
|---|---|
| D2 (TASK-003) | `parseNumberInput` in the range inputs: decimal comma and point; invalid input shows the German hint and is ignored. |
| F1 (TASK-004) | `.cv-fa-sets` gets one track `minmax(0, 1fr)`, `.cv-fs` gets `min-width: 0`, and the filter panel gets `overflow-x: hidden`. **Cause:** with a classic scrollbar the panel's content box is 15 px narrower, and grid items grew to their min-content width (the search input's intrinsic width), so sets stuck out by 10 px. Playwright's headless default hides scrollbars, which is why earlier tests did not see it. |
| L1 (TASK-005) | The model area is now a column: `#cv-canvas-box` (canvas, toolbar, overlay) above a legend strip with the legend (`#cv-legend`). The engine container is the canvas box, so `Ansicht einpassen` uses the free area only. The legend never covers geometry. |
| L2 | Legend text is 13 px (title, labels, counts). |
| L3 | cv-3d `CONTEXT_COLOR` `#e3e5e7` (neutral light grey) for context geometry, e.g. the IfcSite terrain, while `Färben nach` is active without a filter. With a filter, context geometry stays ghost or hidden as before. It is not a legend colour: `(leer)` is `#c4c7ca`, the scale is blue, and the distinct colours are saturated. New test seam `CalcView.contextState()`. |
| L4 | The 3D toolbar is `nowrap` and stays one row at 1280 px. Changes: <br>• the mode label `Elemente außerhalb des Filters:` is set on two short lines (11 px); <br>• while colouring is active, the button shows a small `Färben nach` above the property, ellipsised at 110 px (the accessible name is still `Färben nach: <Eigenschaft>`); <br>• slider, flip and remove of an active section are in a panel `#cv-section-panel` under the `Schnitt` group; <br>• `Ansicht einpassen` is icon-only (its accessible name and tooltip stay). Measured at 1280×800 with `Färben nach: BaseQuantities.NetVolume (m³)` and `Schnitt Z`: the bar runs x 293–950 inside the canvas box (x 280–960), one row. |

**NFR-001 regression found and fixed.** With the legend under the model, a filter click that shortened the legend changed the canvas height. That resize redraws the whole 3D view, about 280 ms in software WebGL.
- **Measured.** The 3D perf test (coloured case) measured `state()` applied at 549 ms instead of about 35 ms.
- **Fix.** During one colouring the legend keeps the largest height it had (`min-height`). The height resets when the colouring changes or is removed.
- **After the fix.** The coloured case measured applied 33.6 ms, complete frame 399 ms. The L1 test now asserts that the canvas height does not change on such a filter click.

## Tests

| AC / item | Test | Type | Result (file + http) |
|---|---|---|---|
| REQ-006 (default columns, rows) | `test/e2e/table.spec.mjs` `@REQ-006 the table shows the default columns ...`: header = defaults; all 99 rows collected by scrolling; the 7 reference elements show their STEP-text Modell/Kategorie/Name/Geschoss; < 40 row nodes | e2e, acceptance | pass |
| REQ-006-AC1 | `test/acceptance/table-fetched.spec.mjs` `@REQ-006-AC1`: Revit MEP, reference filter (4 Kategorie values) → status `2.000 von <Y> Elementen`. `aria-rowcount` 2001; < 60 row nodes. Scrolling reaches indices 0..1999 exactly once; Kategorie counts = `perKategorie`; keys = `__calc.filter.keys`; the last row (index 2001) is inside the box when scrolled to the end. | acceptance | pass |
| REQ-006-AC4 | `@REQ-006-AC4`: Name column filter with the reference name. Checked: table = `expectedGlobalIds`, status `1 von 99`, filter button pressed; `state().opaque` = expected, `ghost` = the rest; Kategorie and Geschoss set counts = `byKategorie` / `byGeschoss`. The checklist keeps the other names (own selection excluded); unchecking restores everything. | e2e, acceptance | pass |
| REQ-006-AC5 | `@REQ-006-AC5`: NetVolume column. Ascending, then descending: the first 18 cells equal the reference values sorted and formatted (`de-DE`, ≤ 3 decimals, formatted by the test) and the GlobalIds carry those values. The remaining 81 cells are empty (empty last), right-aligned. The third click unsorts (`aria-sort none`). Name descending via the popup: German collation, empty names last. | e2e, acceptance | pass |
| REQ-006-AC6 | `@REQ-006-AC6`: add via `Spalten`; drag the header before `Modell` and after `Name` (body cells follow); chooser left/right; pointer resize +70 px (state, header and cell width), keyboard −16 px; remove via the popup (also drops its filter and sort) and via the chooser. `CalcTable.state()` checked after each step. | e2e, acceptance | pass |
| REQ-006-AC9 + D2 | `@REQ-006-AC9` on `fzk-range.ifc`: `von` 2 `bis` 5 → the reference rows, with values exactly `2`, `2,5`, `3,5`, `5`; 1.9, 5.1 and empty cells are out. Table, status and 3D are checked. `von` `2,5` (comma) → reference set. `bis` `fünf` → German hint, `aria-invalid`, filter unchanged. `5.0` (point) accepted. The reopened popup shows `2,5` / `5`. `Filter zurücksetzen` clears it. | e2e, acceptance | pass |
| REQ-004-AC1/AC4 (table + 3D + sets) | `@REQ-004-AC1 @REQ-004-AC4`: filter set wall/slab → table and `opaque` = reference. Adding the Geschoss column filter = ground floor → table and `opaque` = REQ-004-AC2 reference, Kategorie set counts = `kategorieCountsOnGroundFloor`. Reset: table 99, column filters empty, set values unchecked, all opaque, button disabled. A column filter alone enables the reset. | e2e, acceptance | pass |
| REQ-001-AC3 (full) | `@REQ-001-AC3`: FZK + Duplex; Kategorie wall + furniture (Duplex only); Modell column filter on both. After removing Duplex: table = 13 FZK walls; IfcFurnishingElement is gone from the set, IfcWallStandardCase is still checked; Modell set = FZK only; the column filter keeps FZK; no `m2` key in `state()`; `opaque` = FZK walls. | e2e, acceptance | pass |
| REQ-001-AC4 (full) | `@REQ-001-AC4`: option off → no IfcSpace in the table (99 rows) or the Kategorie set. On → 99 + 7 rows (reference `spaces.count`). The IfcSpace column filter shows exactly the 7 reference GlobalIds, opaque in 3D. Off → gone from table and 3D, and the column filter on the vanished value is dropped. | e2e, acceptance | pass |
| Popup behaviour | `@REQ-006 the column filter popup closes with Escape ...`: Escape keeps the 3D selection, the filter button toggles, an outside click closes, a row click causes no error. | e2e | pass |
| T7 empty result | `test/e2e/table-robustness.spec.mjs`. **Before loading:** `Keine Elemente.`, header shown, sort and popup harmless. **Filter result 0:** `Keine Elemente im Filter.`, no rows, `opaque` empty, sort works, the checked value is kept with count 0 (DEC-14), reset restores. | robustness | pass |
| T7 very long values | **Fixture.** `test/support/long-fixture.mjs` gives a 3,200-character wall name and a 4,000-character pset text. **Checks.** Each long value stays on one 28 px row, ellipsised, with the full text as tooltip. Column width and page width are unchanged. The checklist label is ellipsised in the 300 px popup. Checking it leaves 1 row, and 3D shows that element. | robustness | pass |
| T7 200 columns | 200 catalogue keys via `CalcTable.setState`. **Rendering.** 200 headers; < 25 cells per row. **Scrolling.** 67 horizontal steps: render median 0.4 ms, max 1.0–1.1 ms. **Last column.** It is rendered, and its cells are non-empty exactly where the row has a value. Sorting by it works; the chooser lists 200 columns. | robustness | pass |
| F1 | `test/e2e/layout-followups.spec.mjs` (classic scrollbars: `ignoreDefaultArgs: ["--hide-scrollbars"]`). **Checks.** Panel `scrollWidth ≤ clientWidth`; no set, head, body, search or value row sticks out; the search field is fully visible; the long value is ellipsised with tooltip. **Detects the defect.** With the old CSS the test fails: 274 > 264. | e2e | pass |
| L1, L2 | The legend is under the canvas; canvas + legend = model area. After `Ansicht einpassen`, the union of all elements' projected boxes is inside the canvas, above the legend. Legend font 13–14 px. A filter that shortens the legend does not resize the canvas. Removing the colouring gives the full height back. | e2e | pass |
| L3 | `CalcView.contextState()`: as loaded → no paint. Coloured by Kategorie and by NetVolume → `#e3e5e7` (grey: channel spread ≤ 6), not in the legend or `state().colours`. With a filter → ghost; hide mode → hidden; reset → as loaded. | e2e | pass |
| L4 | At 1280×800 with `Färben nach: BaseQuantities.NetVolume (m³)` and `Schnitt Z`: all bar groups on one row, bar ≤ 34 px high, inside the canvas box, no overlap. The section panel is under the bar, with slider and flip visible. The mode label is visible; the accessible names of the colour and fit buttons are kept. | e2e | pass |
| Unit | `test/unit/table.test.mjs` (9 `[unit]`): defaults, widths, normalisation; `moveItem`; `formatCell`; D2 parsing (accepted and rejected inputs); range filter with parsed bounds; AC9 against the reference; `pruneSelection`; `numberRange`; AC5 FZK NetVolume order against the reference | unit | pass |
| NFR-001 / perf | `test/perf/table.spec.mjs` `@perf` (file project; numbers below) | perf | pass |

### Performance (volume set, `test/perf/table.spec.mjs`)
- **Volume set (spec Testing → Test data).** Four copies of the fetched Revit MEP model (`Ifc4_Revit_MEP`, `… (2)`, `… (3)`, `… (4)`) plus SampleCastle: **30,931 rows**, 5 models.
- **Environment.** Load 54 s. Chromium headless, software WebGL, Intel Xeon @ 2.10 GHz container. JS heap 86 MB after the run.

| Measurement | Result |
|---|---|
| Scroll jumps (60 positions over the whole table): render per jump | median 0.5 ms, max 1.8 ms |
| Smooth scroll (200 frames, 120 px per frame): render | median 0.3 ms, p95 0.5 ms |
| Smooth scroll: frame interval | median 16.7 ms, p95 16.8 ms (no dropped frames) |
| Row / cell nodes | 27 / 108 |
| Sort `Name` (text): click → table rendered + next frame | cold ascending 42 ms; ascending median 29 ms; descending 12 ms; off 12 ms |
| Sort numeric (`Pset_MemberCommon.Span`, the numeric property with most values) | cold 27 ms; ascending median 29 ms; descending 13 ms; off 12 ms |
| Kategorie column filter click → table updated / next frame | updated median 25 ms; next frame median 28 ms (table part 3–10 ms) |

All are far below NFR-001's 500 ms. The test asserts:
- scroll render < 16 ms;
- frame p95 < 50 ms;
- every sort click → next frame < 500 ms;
- every column-filter click → table updated < 500 ms.

The frame after a column-filter click is recorded, not asserted: it can include the 3D redraw of 30,000 elements in software WebGL, which is the end-to-end NFR-001 measurement of TASK-010. One parallel run measured 1,591 ms for it.

The 3D frame after a column filter click is the TASK-005 path, measured by `test/perf/view-3d.spec.mjs`; after this task: complete frame 228–399 ms.

### Perf specs never overlap (`test/support/perf-lock.mjs`)
- **Problem.** In a full `file` run with the default 2 workers, the TASK-005 3D perf test failed: uncheck complete frame 531 ms. It ran while the new table perf test loaded its 165 MB volume set on the other worker. Run alone it passed.
- **Fix.** All three perf specs (`load-100mb`, `view-3d`, `table`) now import `test` from `test/support/perf-lock.mjs`. An automatic fixture holds an exclusive lock file `.cache/perf.lock` for the whole test in the `file` project. The lock is created with `O_EXCL`, and a lock whose process is gone is taken over. The fixture timeout is 900 s.
- **Effect.** Perf specs no longer measure each other. Other tests still run in parallel, as before (TASK-005 passed that way). Thresholds and measurements are unchanged.
- **Check.** The full `file` project with default workers passed: 60/60.

### Test measurement fix (long values)
Under parallel load, `scrollWidth` of the 4,000-character single-word cell was sometimes reported as the box width (160). A text Range over it was sometimes 0. This happened while the cell sat partly right of the visible scroll width.
- **Fix in the test.** It scrolls the cell fully into view and measures the text width with a Range. The F1 test uses the same Range measurement.
- **Result.** 16/16 repeated runs with 4 workers passed.

## Reference data and fixtures (no value typed by hand)
- `scripts/make-unit-fixtures.mjs` writes the new committed fixture `fzk-range.ifc`.
  - It is FZK plus `CalcTest_Range.Wert` (IfcReal) on six walls: 1.9, 2, 2.5, 3.5, 5, 5.1.
  - Its manifest entry has the sha256. The existing fixtures are byte-identical.
  - The existing unit test checks that it is reproducible.
- `scripts/ref/derive-reference.mjs` adds, derived from the STEP text:
  - `AC20-FZK-Haus.filters["REQ-006-AC4"]`: the name of element #21966 and every element with that name, by Kategorie and Geschoss.
  - `AC20-FZK-Haus.columnValues["BaseQuantities.NetVolume"]`: 18 carriers by GlobalId.
  - `AC20-FZK-Haus.spaces`: the 7 IfcSpace GlobalIds.
  - Section `REQ-006-AC9`: values by GlobalId, the expected sets for `von 2 bis 5` and `von 2,5`, and the elements without a value.
- `node scripts/ref/derive-reference.mjs --check`: up to date.

## Commands run and results
- `node scripts/check.mjs`: all steps green.
  - format, lint, cdn-cache.
  - test_fast: 78 `[unit]` tests pass; c8 cv-core 100 % lines / 93.68 % branches; 17 `@integration` pass on http.
- `npx playwright test --project=http` (default 2 workers): 57 passed, 3 skipped (the perf specs run in `file` only).
- `npx playwright test --project=file` (default 2 workers): 60 passed, including the 100 MB smoke, the 3D perf test and the table perf test.
  - 3D perf in that run: complete frame check 399 / uncheck 365 / hide 314 / coloured 219 ms (medians).
- Also run: the `file` project without `@perf` (57 passed), then `@perf` alone with 1 worker (3 passed).
- `node scripts/ref/derive-reference.mjs --check`: up to date.
- **Screenshots for the verifier.** The directory is `/tmp/claude-0/-home-user/b4080e59-f4c4-52f1-9269-192eeef60a44/scratchpad/task006a-shots/`.
  - They are taken at 1280×800 and 1920×1080, with real scrollbars.
  - 01 loaded table
  - 02 column chooser
  - 03 sorted descending + range filter with the D2 hint
  - 04 text checklist filter
  - 05 colouring with the legend under the model and the section toolbar
  - 06 scrolled filter panel with a long value

## Deviations / interpretations
- **Pruning on a row-set change (REQ-001-AC3).** After a model is removed, or the IfcSpace option changes, checked values that no element has any more are dropped from filter sets and text column filters. Filters on remaining values stay active.
  - This replaces TASK-004's interim behaviour, where such values stayed checked with count 0.
  - DEC-14 still applies to values that have 0 hits only because of other filters.
  - Recorded in `docs/process-log.md`.
- **Sort by header click** cycles ascending → descending → unsorted. "Unsorted" is the row order, which is model load order, then extraction order. The spec names only ascending and descending; the third state lets the user go back.
- **Removing a column** also removes its column filter and its sort. A filter on an invisible column could not be seen or changed.
- **The legend height is kept during one colouring** (NFR-001, see above). A filter that shortens the legend leaves empty space under it until the colouring changes.
- **Toolbar (L4).** The section slider, flip and remove sit in a panel under the `Schnitt` group, not in the bar itself. The fit button is icon-only, and its accessible name and tooltip `Ansicht einpassen` are kept. The mode label is on two lines.
- **Context geometry while colouring (L3)** is `#e3e5e7`. That is light grey, with an equal hue to the `(leer)` grey `#c4c7ca` but lighter. Under lighting the terrain's sides render darker.
- **Planned controls.** The `Gruppiert` toggle and `Export CSV` / `Export Excel` are shown disabled until TASK-006b and TASK-008. This matches the builder buttons of TASK-004.
- **Column filter checklists** count under all other filters, with the column's own selection excluded, like filter sets (REQ-004 rule applied to column filters).

## Open points
- **TASK-006b.** Grouping view on the same column set and sort (`sortByValue` for group sums). The `Gruppiert` toggle is in place.
- **TASK-006c.** Wire `start().onRowClick` to `select(key)`, and highlight and scroll to the row for a 3D pick. Rows carry `data-key`.
- **TASK-007.** Save and load `start().tableState()` / `setTableState()`: columns with widths, sort and column filters.
- **TASK-008.** Export the rows in `__calc.table.keys` order. The CSV must use full precision, not `formatCell`.
- **TASK-010.** NFR-001 end to end at 30k with the 3D frame. The table part measured here is ≤ 43 ms.

## Orchestrator verification
- Independent verification in fresh context: VERDICT PASS (all listed ACs, F1, L1-L4, D2, visual review at 1280x800 and 1920x1080, check and both Playwright projects green).
- Accepted interpretations (inner details, no baseline change): third header click returns to unsorted; removing a column removes its filter and sort; pruning of checked values that no element has after a row-set change (process-log entry).
- Follow-ups: D-a hidden stale cells after column removal (TASK-006c); D-b hard-coded cell texts at `test/e2e/table.spec.mjs` AC9 test -> derive from `REF["REQ-006-AC9"]` (TASK-006c); D-c complete 3D frame at 30,931 rows 1.1-1.7 s (R-4, NFR-001) -> performance spike started, fix in TASK-010 at the latest.
- TASK-006a done.
