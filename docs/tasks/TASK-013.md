---
id: TASK-013
title: "Layout without details column, table to the right edge, drawer only `Filter`, floating properties panel (header, model chip, groups, row-tool slots, close), BUG-T2"
type: feature
status: implemented (awaiting orchestrator verification)
implements: [REQ-006-AC12, REQ-007-AC1, REQ-007-AC3, REQ-007-AC6, REQ-007-AC4 (panel part), "§2 User interface (layout, devices)"]
relates_to: [CR-002, INC-2, REQ-006, REQ-007, REQ-013, BUG-T2, TASK-005, TASK-006c, TASK-014, TASK-015a, TASK-016, TASK-017b, TASK-017c, TASK-019]
depends_on: [TASK-011a]
touches: [calc-viewer-builder.html (cv-css, cv-ui-src, cv-app-src selection host only), test/e2e/properties-panel.spec.mjs (new), test/e2e/filter-area.spec.mjs, test/e2e/selection.spec.mjs, test/e2e/view-3d.spec.mjs, test/e2e/smoke.spec.mjs, test/e2e/grouping.spec.mjs, test/e2e/viewer.spec.mjs, test/support/selection.mjs, test/support/view-3d.mjs, test/unit/trace.test.mjs, docs/testing/traceability.md, docs/process-log.md]
---
# TASK-013: Layout without details column and floating properties panel

Spec §5 acceptance: REQ-007-AC1/AC3/AC6, REQ-006-AC12 and the panel part of REQ-007-AC4 green; `smoke.spec.mjs`, `selection.spec.mjs`, `filter-area.spec.mjs` layout tests updated; buttons `Ausblenden` / `Isolieren` and row tools present but may be inert until TASK-016/017b.

## What was built

### Layout (cv-css, cv-ui `renderLayout`)
- `.cv-main` has two columns: the filter area (280 px, full height) and the centre (3D view over the table), which reaches the right edge. The element `#cv-details` (column `Element-Details`), its collapse button `Details einklappen` / `Details ausklappen` and `layout.detailsCollapsed` are removed.
- Below 1280 px only the filter area is a drawer. The header button `Filter` stays; the `Details` button and drawer are gone. `setDrawer` is unchanged apart from that, so a new message still opens the filter drawer (BUG-T1/T3).
- The hook `window.__calc.layout` is now `{ split }`.

### Properties panel (cv-ui `createDetails`, cv-css "TASK-013 properties panel")
- `#cv-props` (`section`, `role="region"`, labelled by the title) sits inside `#cv-canvas-box`, at the top right. It is hidden while nothing is selected. The 1.0.0 placeholder text `Klick auf ein Element zeigt seine Eigenschaften.` is gone, because the panel opens only on a click.
- Look taken from the reference (ref L884-939, CSS L1755-1791):
  - glass `rgba(255,255,255,.86)` with 14 px blur, radius 14 px, `--cv-shadow`;
  - `right: 16px`, width `min(360px, 100% - 32px)`;
  - `max-height: calc(100% - top - max(96px, var(--cv-pills-h) + 32px))`, the reference formula with `--cv-pills-h` on `#cv-canvas-box` (default 0);
  - the body scrolls (`overflow-y: auto`, `overflow-x: hidden`).
- Header:
  - kicker = `Kategorie` (11 px / 700, `.08em`, upper case, `#D72622`); title = `Name` (15 px / 600);
  - close button `Schließen` (`#cv-props-close`);
  - a grey chip with the `Modell` value;
  - buttons `Ausblenden` / `Isolieren` (`#cv-props-hide` / `#cv-props-isolate`, with the reference icons `hide` / `isolate` added to `ICON_PATHS`).
- Body:
  - groups as the property catalogue, built as before: `Allgemein`, then psets, then `Typ: <pset>`; values as before (German numbers, unit). The groups are restyled as the reference: tinted rounded boxes, chevron red when open.
  - Each property is a row `div.cv-prop-row[data-key]` inside the `dl`, holding `dt.cv-det-name` and `dd.cv-det-value`. The `dd` holds the text `span.cv-prop-text` and the row tools `Nach Wert filtern` / `Farbe nach Wert` (`.cv-row-tool`).
  - The row tools are drawn at opacity 0 and become visible on row hover or `:focus-within`. They stay focusable, which the reference's `visibility: hidden` is not. On `hover: none` devices they are always visible.
  - The name column is 44 % wide (as the reference). Text wraps with `overflow-wrap: anywhere` (BUG-T2).
- Group selection: header kicker `Gruppe: …`, title = group path, the same buttons, no chip, `<n> Elemente ausgewählt` and `Davon ohne 3D-Geometrie: <n>`. The texts are unchanged from 1.0.0.
- API unchanged for cv-app: `show`, `showGroup`, `clear` (+ `element`). `createDetails(panel, handlers)` takes `{ clear, hide, isolate, filterByValue(key, value), colourByValue(key) }`. Only `clear` is required.
- **Interim:** while the 1.0.0 view bar `#cv-view-bar` exists, the panel starts 52 px from the top instead of 16 px (`--cv-props-top`, set through `:has(> .cv-view-bar:not([hidden]))`), so it does not cover the bar. TASK-015a/016 remove the bar, and with it the offset. The 1.0.0 section slider panel under the bar can still overlap the props panel's top edge when both are open (the bar has the higher z-index, so its controls stay usable). The panel goes away with the axis section (TASK-014).

### cv-app (selection host only)
- `renderLayout` gets `propsHandlers: { clear: () => select(null) }`. `Ausblenden`, `Isolieren`, `Nach Wert filtern` and `Farbe nach Wert` are **inert** (no handler) until TASK-017b (buttons, `Nach Wert filtern`) and TASK-016 (`Farbe nach Wert`), as §5 allows.
- Selection, deselection (filter, Esc, empty-space click) and `select` / `selectGroup` are unchanged.

## Tests

Expected values come from `test/fixtures/reference-values.json` (`REQ-007-selection`, `AC20-FZK-Haus` elements, `conditionalElements`) and from the spec text (sizes, colours, texts). The element with the longest value is *chosen* from the extracted rows; the assertions on it are geometric.

New `test/e2e/properties-panel.spec.mjs` (http + file):
- `@e2e @acceptance @REQ-007-AC6 the element with the longest property value: no horizontal scrollbar, every value incl. GlobalId wraps in the panel, the panel ends above the pills, its body scrolls`
  - Window 1280 × 800. The longest value is FZK `ObjectType`, 41 characters.
  - Panel and body have no horizontal overflow, and every name, value, title and chip stays inside the body's content box.
  - The longest value spans more than one line. The GlobalId is shown whole within the panel, in at most two lines.
  - The panel bottom is at least 96 px above the bottom of the 3D view, and above the topmost pill of `#cv-pills` if one exists.
  - With `--cv-pills-h: 150px` the bottom is at least 182 px above the bottom of the view.
  - The body's content is higher than the body, and the body scrolls.
- `@e2e @REQ-007 properties panel header: kicker, title, model chip, Ausblenden / Isolieren, Schließen; row tools on every property row`
  - Checks the kicker colour and upper case, the 14 px radius, the glass colour and the 360 px width.
  - Clicks on the panel do not reach the 3D view. Every row has both row tools, which are hidden until hover or focus.
  - `Schließen` clears the selection. At 1024 × 700 the panel stays inside the 3D view.

`test/e2e/filter-area.spec.mjs`:
- New `@e2e @acceptance @REQ-006-AC12 no column right of the 3D view: 3D view and table reach the right edge, the filter area is as high as both; at 1100 px only the Filter drawer`
  - At 1280 × 800 the main grid has exactly `cv-filters` and `cv-center` (2 tracks), and `#cv-details` is absent.
  - The 3D view's right edge and the table's right edge are within 1 px of 1280. No rendered element lies beyond the window.
  - The filter area's top and bottom equal the 3D view's top and the table's bottom (±1 px).
  - At 1100 px the header has `Filter` and no `Details` button.
- `@e2e @UI screen layout …` (changed): the details width and collapse steps are replaced by "`#cv-details` absent, centre width = window − 280". All other checks are unchanged.
- `@e2e @UI below 1280 px the filter area collapses to a drawer …` (changed, was "the side panels collapse to drawers … `Filter` / `Details`"):
  - The `Details` button is checked to be absent at both widths, and the centre's full width is also checked without the drawer.
  - The filter drawer checks are unchanged (hidden from Tab, 280 px at x 0, filtering works, the centre keeps the full width) and now also close it again.
- `@e2e @UI data text keeps its characters …`: the selector `#cv-details .cv-details-body` becomes `#cv-props`.
- The screenshot test's step `Details einklappen` / `07-details-collapsed` becomes `07-properties-panel`.

`test/e2e/view-3d.spec.mjs`:
- `@e2e @acceptance @REQ-007-AC1 @REQ-007-AC5 clicking a wall selects it and shows its properties panel in the 3D view (no details column); …`
  - The panel is checked to be visible inside `#cv-canvas-box`, in its top-right quadrant, with `#cv-details` absent and the model chip `AC20-FZK-Haus`.
  - The kicker, title, GlobalId, BaseQuantities, group order and collapse checks are kept.
  - Where the placeholder text was asserted after an empty-space click and after Esc, the test now asserts the panel is hidden.
- The former `@e2e @acceptance @REQ-007-AC4 … selected via the API …` is now `@e2e @REQ-007 an element without geometry, clicked in the table, shows its properties panel with the no-geometry hint`.
  - It now clicks the table row (AC4 says "When its table row is clicked").
  - It checks the `Ausblenden` / `Isolieren` buttons are present, and that Esc closes the panel.
  - The AC ID is in a comment, not the title: see Decision 1.

`test/e2e/selection.spec.mjs`:
- `@e2e @acceptance @REQ-007-AC3 @REQ-007-AC5 a table row click … shows its properties panel without a click menu …` (title lost `@REQ-007-AC4`; Decision 1). The test now also checks:
  - the panel is open, 16 px from the right edge of the 3D view and inside it;
  - the model chip;
  - no `role="menu"` is visible in `#cv-canvas-box`. TASK-014's click menu must carry `role="menu"` so this check bites.
- `expectCleared`: "panel closed" replaces "placeholder shown". The no-geometry part checks the panel is open.

Other files:
- `test/e2e/smoke.spec.mjs`: `#cv-details` is no longer in the visible list. The test asserts it is absent and that `#cv-props` is hidden before a selection.
- `test/e2e/grouping.spec.mjs`: the column drag test no longer clicks `Details einklappen`. Its assertion that every column fits without sideways scrolling stays and holds at full width.
- `test/e2e/viewer.spec.mjs`: the selector `#cv-details-body` becomes `#cv-props`; same assertion (GlobalId shown).
- Canvas-only screenshots (`test/support/view-3d.mjs`, `smoke.spec.mjs`, `viewer.spec.mjs` `CANVAS_ONLY`) also hide `#cv-props`, like the view bar. The panel is an overlay, not model pixels.
- `test/support/selection.mjs` `details()` reads `#cv-props`: `open`, `chip`; `placeholder` and the `PLACEHOLDER` export are removed.

### Changed expectations (approved CR-002 delta; no assertion loosened)
- The details column (320 px, collapsible, `Details` drawer) → absent (REQ-006-AC12, §2 User interface, Devices).
- The placeholder text when nothing is selected → the panel is hidden (REQ-007: the panel opens on click and closes on clear).
- REQ-007-AC4: selection via `CalcView.select` → table row click (the AC's wording).
- All other assertions of the touched tests are unchanged.

### Trace
- `INC2_PENDING`: removed `REQ-006-AC12` and `REQ-007-AC6` (now tested); **added `REQ-007-AC4`** (Decision 1).
- `docs/testing/traceability.md` regenerated: 50 of 100 ACs with a test (was 49), 293 tests.

## Results (2026-11-05, CV_TEST_PORT=4700)
- `node scripts/check.mjs`: green (format, lint, cdn-cache, test_fast incl. c8 and 29 integration tests on http).
- Playwright, both projects (`file` and `http`), all green:
  - `test/e2e`: properties-panel, selection, view-3d, smoke, filter-area, grouping, viewer, config, export, table, layout-followups, table-/filter-/grouping-/viewer-robustness, memory-robustness, volume-robustness (`file` only by design);
  - `test/integration`; `test/acceptance`.
- Perf (`file`): `selection.spec`, `table.spec`, `view-3d.spec`, `nfr-001.spec`, `grouping.spec`: 5 passed.
- Also green: `test/e2e/system.spec.mjs` (`file`; its `http` run is an existing conditional skip), `test/e2e/export.spec.mjs` (`file`).
- Not run: the perf specs `export`, `load-100mb`, `nfr-002`, `text-index`, `view-3d-volume`, `viewer` (no layout or panel dependency), `node --test test/perf`, `node scripts/check.mjs --all`.

## Decisions (for the release gate / orchestrator)
1. **REQ-007-AC4 is back in `INC2_PENDING`.** It is a changed AC whose whole includes "its buttons `Ausblenden` / `Isolieren` work (REQ-013-AC7)". Those buttons are inert until TASK-017b. Spec T5 says a test title names an AC only when the test verifies the whole AC. So the panel-part tests (`view-3d.spec`, `selection.spec`) cite it in comments, and TASK-017b must tag a test `@REQ-007-AC4` and remove it from the list.
2. **The row tools reserve their width** (opacity 0, not `display: none`), as the reference reserves it with `visibility: hidden`. So values do not reflow on hover, and the tools stay keyboard-focusable (needed by REQ-007-AC7). As a result, a 22-character GlobalId wraps into two lines in the 360 px panel (Linux test fonts). REQ-007-AC6 asks for wrapping within the panel width, so this meets the AC and closes BUG-T2: the value wraps inside its column instead of overflowing. If one-line GlobalIds are wanted, the tools would have to float over the value on hover. That is a look choice, not taken.
3. **The panel is hidden while nothing is selected** (reference behaviour, REQ-007 "opened by a click"). `#cv-props` and `#cv-props-body` always exist in the DOM.
4. **Group panels show no model chip** (a group can span models); the header buttons are shown, as REQ-007 requires for group rows.
5. **Interim offset under the 1.0.0 view bar** (52 px instead of 16 px) until TASK-015a/016 remove the bar.

## Open points / contracts for later tasks
- **TASK-015a (pill stack):**
  - Put the pills in a container `#cv-pills` inside `#cv-canvas-box`.
  - Set `--cv-pills-h` on `#cv-canvas-box` to the stack's height (as the reference's `--tov-pills-h`).
  - REQ-007-AC6's pill check then measures real pills.
  - Remove the interim `--cv-props-top` rule with the view bar.
- **TASK-014 (click menu):** give the menu `role="menu"` inside `#cv-canvas-box`. REQ-007-AC3's "no click menu open" check in `selection.spec.mjs` relies on it.
- **TASK-017b:** wire `propsHandlers.hide` / `isolate` / `filterByValue` in cv-app `renderLayout` options. Tag a whole REQ-007-AC4 test and remove it from `INC2_PENDING`. REQ-007-AC7 and AC8 are also TASK-017b's.
- **TASK-016:** wire `propsHandlers.colourByValue`.
- **TASK-017c / TASK-019:** `Esc` order with the menu, and focus return when the panel closes. Today Esc clears the selection, and focus is not moved.
- **Not built:** the reference's bottom sheet below 600 px. Outside the supported widths (≥ 1024 px, §2 Devices).

## Testing cycle 2 (2026-11-05)
- Follow-up fixes in this task's area (A-1 table width, X-1 panel head, X-2 legend, X-3 rule rows, A-4 gradient labels documented): see `docs/tasks/TASK-019.md` "Testing cycle 2" and `test/e2e/overlay-robustness.spec.mjs`.
