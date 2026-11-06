---
id: TASK-016
title: "Colouring panel: property list, modes, swatches, gradient, legend in the panel, `Einfärbung entfernen`, `Farbe nach Wert`, mark precedence; removes `Färben nach` and the legend under the model"
type: feature
status: implemented (awaiting orchestrator verification)
implements: [REQ-005-AC2, REQ-005-AC4, REQ-005-AC5, REQ-005-AC8, REQ-005-AC9, REQ-012-AC9, DEC-15 (UI)]
partly: [REQ-005-AC7 (all but its `Schnitt X` part, see Open points)]
relates_to: [CR-002, INC-2, REQ-005, REQ-007, REQ-012, DEC-15, DEC-19, DEC-21, TASK-012, TASK-013, TASK-014, TASK-015a, TASK-015b, TASK-017b, TASK-017c, TASK-018, TASK-019, TASK-020]
depends_on: [TASK-012, TASK-013, TASK-015b]
touches: [calc-viewer-builder.html (cv-css own section "TASK-016 colouring panel" and removal of the 1.0.0 colour button / legend rules, cv-ui-src createViewTools colouring panel + pill, createViewControls reduced to the interim `Schnitt`, layout without the legend strip, cv-app-src colouring state, mark mask, `Farbe nach Wert`), test/e2e/colouring.spec.mjs (new), test/support/view-3d.mjs, test/e2e/view-3d.spec.mjs, test/e2e/layout-followups.spec.mjs, test/e2e/config.spec.mjs, test/e2e/volume-robustness.spec.mjs, test/e2e/filter-area.spec.mjs (comment), test/unit/trace.test.mjs, docs/testing/traceability.md]
---
# TASK-016: Colouring panel `Färben`

Spec §5 acceptance: REQ-005-AC2/AC4/AC5/AC7/AC8/AC9 and REQ-012-AC9 green; the 1.0.0 `Färben nach` control and the legend under the model are removed and their tests moved into the panel.

## What was built

### cv-ui
- **Colouring panel** `#cv-colour-panel` (the empty TASK-015a panel, now filled) as the reference (ref L1509-1631, CSS L1824-1846; screenshots ref-08, ref-09):
  - head: kicker `Färben`, red link `Entfernen` (`#cv-colour-reset`) only while colouring is active;
  - **step 1, property list:** search `Parameter suchen`; one entry per catalogue property with its label (the header incl. unit, e.g. `BaseQuantities.NetVolume (m³)`) and below it the group in grey; the current property is tinted red (`aria-pressed`); no match: `Kein Parameter gefunden`. The list is virtualised (46 px rows, `createVirtualList`): catalogues reach thousands of properties (spec REQ-004 "render only the visible entries");
  - **step 2, legend view:** the chosen property (`#cv-colour-param`, red `Ändern` back to the list with the search focused); the segmented control `Unterschiedliche Farben` | `Farbskala` (`aria-pressed`); for `Farbskala` the swatches `Rot`, `Blau`, `Grün`, `Orange`, `Violett`, `Grau` (`title` / `aria-label`, `aria-pressed`) and `Eigene Farbe` (`input type=color`, applied on `change` as ref L1602), the gradient bar from the 12 % tint to the full colour labelled with the first and last value; the legend `#cv-legend` (one row per value of the shown elements: 14 px swatch, value, count; at most 200 rows, then `+<n> weitere Werte`; none: `Keine Werte vorhanden`); the note `Mehr als 120 Werte: Farben wiederholen sich.` in `Unterschiedliche Farben` with more than 120 values;
  - all texts from the model are set as text (`textContent`);
  - the panel renders only while it is open; the legend is computed then (a closure from cv-app), so a closed panel costs nothing per filter click (NFR-001).
- **Pill `Einfärbung entfernen`** `#cv-pill-colour` below `Filter entfernen` (palette icon, chevron `Färben anzeigen` that opens the panel at the legend), shown exactly while colouring is active; the pill stack height (`--cv-pills-h`) is updated.
- **`Färben` dot** (`cv-has-dot`) exactly while colouring is active.
- API: `ui.tools.setColouring(data)`, `ui.tools.showColourLegend()`; new handlers `colour(key)`, `colourMode(mode)`, `scaleColour(hex)`, `clearColour()`.
- **Removed** (CR-002, REQ-005): the 1.0.0 button `Färben nach` (`#cv-colour`) with `Färbung entfernen` and the catalogue dialog used for it, the legend under the model (`#cv-legend` strip, `.cv-legend-strip`) and their CSS. The model area is now the canvas box only (the canvas fills it). `createViewControls` keeps only the interim 1.0.0 `Schnitt` (X / Y / Z) until TASK-017c.

### cv-app
- Colouring state `colourKey`, `colourMode`, `scaleColourHex`: list pick → `setColouring(key)` in the last chosen mode and colour (DEC-15); mode and swatch → `setColourOptions` (kept for the next property); `Entfernen` / pill → `setColouring(null)`.
- `publishColouring()` (from `sync3d`): property list (catalogue order), current property, mode, colour, gradient (`colourScheme`), repeat flag, and the legend closure `legendRows(colourLegend(scheme, view.indices))`.
- **`Farbe nach Wert`** in the properties panel (`propsHandlers.colourByValue`): colours by the property (unless it already is) and opens the colouring panel at its legend (REQ-005-AC9).
- **`Markieren` in 3D** (REQ-012-AC9): `markMask()` = `markRows(store, mark rules whose property is loaded)` as a `Uint8Array` in the display plan (`marked`). cv-3d (TASK-014) paints only shown rows with `#f08a87`, precedence selection > mark > colour > ghost/hide (§4.4). The mark does not change legend, filter-set dots, table or counts (DEC-21: 3D only).
- A configuration's `colourBy` / `colourMode` / `scaleColour` show in the panel (a new colouring opens at its legend); no change to save/load (TASK-018).

## Tests

Expected values: DEC-15 colours from the spec (`#e4eef9`, swatches, `#6e6259`, `#c4c7ca`, `#f08a87`), the DEC-15 scale formula re-implemented in the test from the spec text (`dec15()`, checked against the spec example `#e4eef9`), element sets and counts from `reference-values.json` (Duplex 268 − 50 openings = 218 rows; FZK 4 `IfcSlab`, 13 walls, 21 elements without material; the two-material wall #4131 and its 80 multi-material elements), values from the extracted rows (`window.__calc.rows`) — never from the colouring code.

New `test/e2e/colouring.spec.mjs` (7 tests). All green on `file` and `http`.

| Test title (abridged) | Covers |
|---|---|
| `@e2e @acceptance @REQ-005-AC5 \`Farbskala\` by \`BaseQuantities.NetVolume (m³)\` …` | swatches hidden in `Unterschiedliche Farben`; swatch list `Rot`…`Grau` + `Eigene Farbe`; `Blau`: smallest value `#e4eef9`, largest `#1f6fd1`, every element at its scale position; gradient `rgb(228,238,249)` → `rgb(31,111,209)` labelled `de(min)` / `de(max)`; `Grün` → `#2e9b4f`; `Eigene Farbe` `#123456`; `Kategorie` in `Farbskala` by rank (mode and colour kept) with gradient labels first / last category |
| `@e2e the 3D toolbar holds exactly \`Fokus\`, \`Filter\`, \`Färben\` …` (REQ-005-AC7 without `Schnitt X`, see Open points) | exactly three toolbar buttons and the hint; no control `Ansicht einpassen`, `Elemente außerhalb des Filters`, `Färben nach`, no legend strip; `Filter` pressed, then `Färben` closes it and is pressed; `Filter` dot exactly with a rule or search, `Färben` dot exactly with colouring |
| `@e2e @acceptance @REQ-005-AC8 \`Unterschiedliche Farben\` by \`GlobalId\` on the Duplex model (218 values) …` | note shown; legend = first 200 GlobalIds in alphabetical order, count 1 each, `+18 weitere Werte`; value 121 = colour of value 1 (122 = 2), 120 distinct colours; `state().colours` per element = colour of value `i mod 120`; note hidden in `Farbskala` |
| `@e2e @acceptance @REQ-005-AC9 \`Farbe nach Wert\` on the \`Kategorie\` row of a selected wall …` | table-row selection; row tool on hover; panel opens at the legend of `Kategorie`; one colour per category, legend counts = rows per category; pill → `colours` empty, pill hidden, selection kept, panel back at the list |
| `@e2e @acceptance @REQ-012-AC9 \`Markieren\` over the colouring …` | opaque / ghost sets, status line and table GlobalIds unchanged; `marked` = the 4 slabs; slabs `#f08a87`, others keep their colouring colour; legend and filter-set dot unchanged; selecting the largest slab: `selected`, still `marked`, colour `#f08a87`, canvas differs (selection drawn over the mark); `Esc`: mark drawn again |
| `@e2e colouring panel steps (DEC-15, ref L1543-1631) …` | kicker; `Entfernen` only while active; label + group per entry; `Kein Parameter gefunden`; `Ändern` focuses the search and marks the current property; a new property keeps `Farbskala` + `Violett` (`__calc.view`); legend follows a filter (1 row, 13 walls); chevron `Färben anzeigen` opens the legend; `Entfernen` clears and returns to the list |
| `@e2e @robustness colouring by \`Name\` with HTML/script values …` | XSS fixture: HTML wall names listed literally in the legend, the HTML pset name as group text in the list; no `b` / `img` / `script` element, `window.__xss` unset |

### Changed expectations (each follows the approved CR-002 delta: REQ-005 "colouring panel … legend in the panel", "the 1.0.0 controls … `Färben nach` with the legend under the model … are removed")
- `test/e2e/view-3d.spec.mjs` **REQ-005-AC2** (changed CR-002): colour through the panel (`Färben` → `Kategorie` → `Unterschiedliche Farben` pressed) instead of the `Färben nach` dialog; legend read from the panel instead of the strip (`.cv-legend-title` dropped: the panel shows the property in `#cv-colour-param`); removal by the pill `Einfärbung entfernen` instead of `Färbung entfernen`. All other assertions unchanged.
- `test/e2e/view-3d.spec.mjs` **REQ-005-AC4** (changed CR-002): now in both modes, with the DEC-15 colours asserted, and extended by the `(leer)` part of the AC (FZK, 21 elements without material). Stronger than before.
- `test/e2e/layout-followups.spec.mjs` **L1 L2**: the legend is in the colouring panel inside the 3D view (was: a strip under the canvas); the canvas fills the model area (was: canvas + legend = model area) and keeps its height when the legend shrinks or the colouring is removed; L2 checks the panel legend values and counts at 13-14 px (was: title, labels, counts of the strip). **L3**: removal by the pill. **L4**: the colour is no longer in the 1.0.0 bar (was: the bar's `#cv-colour` named `Färben nach: …`); the pill `Einfärbung entfernen` is visible instead.
- `test/e2e/config.spec.mjs` **REQ-009-AC1**: after loading, the colouring is checked through the pill and the panel (`Material`) instead of `#cv-colour` named `Färben nach: Material`.
- `test/e2e/volume-robustness.spec.mjs`: colouring removed by the pill (was `Färbung entfernen` + the `Färben nach` name).
- `test/support/view-3d.mjs`: `colourBy` and `legendEntries` work through the panel; new `colourPanel`, `colourTool`, `openColourPanel`, `clearColouring`. Callers (perf, viewer, config, robustness) unchanged.
- `test/e2e/filter-area.spec.mjs` V1: comment only (`#cv-legend` is now the panel legend; the no-ligature rule still applies).

### Trace
- `INC2_PENDING`: removed REQ-005-AC5, AC8, AC9 and REQ-012-AC9. **REQ-005-AC7 stays listed** (see Open points). REQ-005-AC2 / AC4 were never pending (changed ACs); their tests are updated above.
- `docs/testing/traceability.md` regenerated (`node scripts/trace.mjs`).

## Results (2026-11-05, CV_TEST_PORT=4900)
- `node scripts/check.mjs`: green (format, lint, cdn-cache, test_fast: 180 unit tests incl. trace and ASCII / `</script>` checks, 29 integration tests on `http`).
- Playwright, both projects (`file` and `http`), all green: `test/e2e` colouring (new), view-3d, layout-followups, config, view-tools, filter-area, viewer, selection, rule-filter, element-tools-3d, smoke, system, table, grouping, export, properties-panel, filter-/grouping-/table-/viewer-/memory-robustness; `test/acceptance`; `test/integration` on `file` (on `http` via `check`). `volume-robustness` and the 3D perf specs run on `file` only (existing project skip); `system.spec` `http` is the existing conditional skip.
- Perf (`file`): `test/perf/view-3d.spec.mjs` green (coloured filter clicks: firstFrameMs 182, idle 219 ms at 10,459 rows), `test/perf/view-3d-volume.spec.mjs` green. Not run: the other perf suites (no measured path changed besides colouring; NFR-001 for INC-2 is TASK-020).

## Decisions (for the release gate / orchestrator)
1. **Property list order and text:** catalogue order (`Allgemein` first, then by group and label, as the `Eigenschaft` suggestions of TASK-015b); the entry shows the header with unit (`… (m³)`). The reference sorts by group then label and shows the label without unit. Search matches label or group (as ref L1545).
2. **Property list virtualised** (46 px rows): the reference renders every property as a button; with 6,859 properties that would cost a long frame on every open.
3. **Legend text 13 px for values and counts** (reference count 12 px): keeps UI-02 13–14 px and the 1.0.0 verification finding L2.
4. **Pill chevron `Färben anzeigen` opens the panel at the legend** (does not toggle), as the chevron `Filter anzeigen` of TASK-015a; the reference toggles.
5. **`Entfernen` and the pill leave the panel as it is**: an open panel shows the property list again (as ref `setColoring(null)`).
6. **A new colouring from outside the list** (`Farbe nach Wert`, a configuration) shows its legend when the panel opens; `Ändern` stays on the list until a property is picked.
7. **`Farbe nach Wert` on the property already coloured** keeps the colouring and only opens the legend.
8. **Gradient labels = first and last value over all rows** (the scheme is over all rows and stable, DEC-15); the legend lists only the shown elements (DEC-15 deviation already recorded).
9. **Marks are 3D only** (DEC-21): legend, filter-set dots, table and counts ignore them; a `Markieren` rule whose property is not loaded paints nothing (as it filters nothing, DEC-21).
10. **No legend strip any more:** the canvas fills the model area; the panel can be closed to see the whole model.
11. **Not adopted from the reference:** coloured IfcSpace at opacity 0.55 (ref L237): not in the spec; spaces are coloured like other elements.

## Open points / contracts for later tasks
- **REQ-005-AC7 `Schnitt X` (TASK-017c):** the AC requires that no control `Schnitt X` exists. The interim 1.0.0 axis section bar (`#cv-view-bar`, `Schnitt` X / Y / Z) is still the only way to create a section from the UI and is used by `view-3d.spec` (interim test), `layout-followups` L4, `config.spec` REQ-009-AC1, `viewer.spec` and `element-tools-3d.spec`; the spec assigns the section wiring to TASK-017c (and its view-3d.spec interim test says "until TASK-017c removes the 1.0.0 axis controls"). Everything else of AC7 is tested here without the AC ID in the title (T5); REQ-005-AC7 stays in `INC2_PENDING`. TASK-017c: remove `createViewControls` / `#cv-view-bar` and the interim `--cv-props-top` rule, add `Schnitt X` to the "no control" loop of the colouring.spec toolbar test and tag it `@REQ-005-AC7`.
- **TASK-019 (REQ-005-AC12 overlay layout):** with the properties panel open (e.g. after `Farbe nach Wert`) the colouring panel is not yet moved left of it; at 1280 × 800 the two can overlap (same as the filter panel today). Focus into the panel on open and back to the opener on close: keyboard pass.
- **TASK-018:** round trip of `display.colourMode` / `display.scaleColour` chosen in the panel (REQ-009-AC1 with `Farbskala` `Grün`); the panel already shows a loaded colouring.
- **TASK-020:** NFR-001 re-measure; the open colouring panel rebuilds ≤ 200 legend rows per refresh.

## Verification INC-2 (2026-11-05)
- **SYNC-2 (a), documented:** decision 1 (colouring property list in catalogue order with the unit in the label) is recorded together with TASK-015b decision 1 as a refinement in `docs/process-log.md` (2026-11-05). Release-gate item.

## Testing cycle 2 (2026-11-05)
- Follow-up fixes in this task's area (A-1 table width, X-1 panel head, X-2 legend, X-3 rule rows, A-4 gradient labels documented): see `docs/tasks/TASK-019.md` "Testing cycle 2" and `test/e2e/overlay-robustness.spec.mjs`.
