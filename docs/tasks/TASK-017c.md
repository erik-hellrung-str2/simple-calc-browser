---
id: TASK-017c
title: "Section and menu wiring end to end, `Esc` order, `Fokus` end to end; exports and counts under section"
type: feature
status: implemented (awaiting orchestrator verification)
implements: [REQ-013-AC1, REQ-013-AC9, REQ-013-AC10, REQ-013-AC11, REQ-013-AC13, REQ-007-AC5, REQ-005-AC6, REQ-006-AC11, REQ-008-AC6, REQ-005-AC7]
relates_to: [CR-002, INC-2, REQ-005, REQ-006, REQ-007, REQ-008, REQ-009, REQ-013, DEC-18, DEC-20, DEC-21, TASK-014, TASK-015a, TASK-016, TASK-017a, TASK-017b, TASK-018, TASK-019, TASK-020]
depends_on: [TASK-017b]
touches: [calc-viewer-builder.html (cv-css interim view-bar rules removed; cv-ui-src createViewControls removed, createViewTools pill `Schnitt entfernen` + setSectionState, renderLayout without `view`; cv-app-src section state as plane, onSection, clearSection, configuration apply of `display.sectionPlane`, `Esc` order, viewHandlers removed), test/e2e/element-tools.spec.mjs (new), test/e2e/grouping.spec.mjs, test/e2e/element-tools-3d.spec.mjs, test/e2e/view-3d.spec.mjs, test/e2e/colouring.spec.mjs, test/e2e/layout-followups.spec.mjs, test/e2e/filter-area.spec.mjs, test/e2e/hide-isolate.spec.mjs, test/e2e/config.spec.mjs, test/e2e/viewer.spec.mjs, test/e2e/selection.spec.mjs, test/support/tools.mjs, test/support/selection.mjs, test/unit/trace.test.mjs, docs/testing/traceability.md]
---
# TASK-017c: Section and menu wiring end to end

Spec §5 acceptance: REQ-013-AC1 (end to end), AC9..AC11, AC13, REQ-007-AC5, REQ-005-AC6 (end to end), REQ-006-AC11, REQ-008-AC6 green; REQ-005-AC7 completed by removing the X/Y/Z axis bar incl. `Schnitt X` (tag `@REQ-005-AC7`).

## What was built

### cv-app
- **Section state is the plane** `{ point, normal }` (spec 4.4, DEC-20). It was the 1.0.0 axis section `{ axis, offset, flipped }`.
  - `createEngine` gets `onSection(plane | null)` (the TASK-014 contract). cv-3d calls it for `Schneiden`, handle drag and arrow keys, and when the last model with geometry is removed.
  - `sectionChanged(plane)` keeps the app state, shows or hides the pill `Schnitt entfernen` and updates the test hook `__calc.view.section`.
  - `setSection(plane | null)` (configuration load, pill) normalises the plane with cv-core `normaliseSectionPlane` and sends it to cv-3d.
  - `Konfiguration speichern` writes this plane as `display.sectionPlane` (cv-core `buildConfig`, unchanged).
- **Configuration load applies `display.sectionPlane` as given.** The interim TASK-012 path, which accepted only axis-parallel planes (`axisSectionOfPlane`) and named any other plane `Schnitt`, is removed. cv-core `applyConfig` already converts a 1.0.0 `display.section` and skips a plane while no model with geometry is loaded (DEC-20). The end-to-end notice tests stay with TASK-018.
- **Pill `Schnitt entfernen`** → `toolHandlers.clearSection()` → `setSection(null)`.
- **`Esc` order** (REQ-007, DEC-21). One document handler closes only the first that applies:
  1. a dialog, popup or filter search field handles `Esc` itself (`defaultPrevented`, as before);
  2. the click menu (`engine.closeMenu()`); the selection stays;
  3. the selection with its properties panel;
  4. an open `Filter` / `Färben` panel; its button gets the focus back (TASK-015a).
- `Fokus` was already wired to `engine.focus()` (TASK-015a). This task adds its end-to-end test.
- `viewHandlers` (axis, offset, flip, clearSelection) are removed. `Schließen` uses `propsHandlers.clear`.

### cv-ui
- Removed `createViewControls`: the interim 1.0.0 view bar `#cv-view-bar` with `Schnitt` X / Y / Z, the slider `Schnittposition`, `Schnitt umkehren` and its `Schnitt entfernen` button. `renderLayout` no longer returns `view`.
- `createViewTools`: pill `Schnitt entfernen` (`#cv-pill-section`, icon `scissors`, title `Schnitt aufheben`, as ref L1031), last in the pill stack after `Ausblendung entfernen`; `setSectionState(active)`; `layoutPills()` on change.

### cv-css
- Removed the interim view-bar rules (`.cv-view-bar`, `.cv-view-group`, `.cv-view-label`, `.cv-section`, `.cv-section-panel`, `.cv-section-slider`, `.cv-section-flip`) and the `--cv-props-top: 52px` offset under the bar. The properties panel now always starts 16 px from the top (REQ-007). `.cv-seg*` stays (table view switch).

## Tests

Expected values: `test/fixtures/reference-values.json` (`REQ-013-tools`: the 13 walls with names, GlobalIds and storeys, the hidden case of REQ-013-AC5 with group counts and Neumaier volume sums; `AC20-FZK-Haus.storeys`), all from the STEP text. Menu, fit and plane geometry are derived in the tests from the spec rules and the engine's projection and boxes, never from the code under test.

| Test (file, title abridged) | Covers |
|---|---|
| element-tools.spec `@e2e @acceptance @REQ-013-AC1 …` | no filter. The first of the 13 reference walls that a click at a point inside its projected box picks. Selected, properties panel with its name. Exactly `Ausblenden`, `Isolieren`, `Schneiden`, `Menü schließen`. Marker ≤ 3 px from the click, card bottom 0–30 px above. After an orbit drag from empty space: still selected, menu moved, ≤ 1.5 px from the projected clicked point, the marker picks the wall. `Menü schließen` closes the menu; selection and panel stay |
| element-tools.spec `@e2e @acceptance @REQ-007-AC5 …` | 3D click (menu open): 1st `Esc` closes only the menu (selection, panel and table-row mark stay), 2nd `Esc` clears all. Empty 3D space clears selection, panel and menu. Table-row selection: `Schließen` clears. `Esc` in the Kategorie search field clears only the field, the next `Esc` the selection |
| element-tools.spec `@e2e @acceptance @REQ-005-AC6 …` | a ground-floor wall isolated with the click menu, Geschoss = `Erdgeschoss`, camera zoomed out, toolbar `Fokus`: opaque = [wall], every opaque box inside the canvas, wall share 66 % (≥ 25 %). A rule `Isolieren` · `Kategorie` · `Gleich` · `IfcSlab` on top leaves no opaque element (`0 von 99`). `Fokus` gives the camera of the fit after loading (6 digits), every geometry element inside the canvas |
| element-tools.spec `@e2e @acceptance @REQ-013-AC13 …` | a wall clicked far below the top: card above the point. Camera (test hook `look`) moved until that wall point is 60 px below the top. A real click on the wall at a point < 110 px below the top: card below the point. Then a section, a `Markieren` rule, colouring, two isolated walls of which one is hidden: pills `Filter entfernen`, `Einfärbung entfernen`, `Isolierung entfernen`, `Ausblendung entfernen`, `Schnitt entfernen`, stacked top to bottom in that order; title `Schnitt aufheben` |
| element-tools.spec `@e2e @acceptance @REQ-008-AC6 …` | section, rules `Isolieren` · `Name` · `Beginnt mit` · `Wand` and `Markieren`, wall `Wand-Ext-ERDG-1` hidden. `12 von 99`. CSV and XLSX (read back by csv / openpyxl) equal the table cell by cell in table order, Names = the 12 other reference walls. After removing the `Markieren` rule and the section (pill), table and both exports are equal |
| element-tools-3d.spec `@e2e @acceptance @REQ-013-AC9 …` (TASK-014 test, completed) | added: the pill `Schnitt entfernen` (title) is shown with the handle; `__calc.view.section` equals `state().section`. The removal between slab and wall uses the pill (was the hook `setSection(null)`): section null, handle and pill hidden |
| element-tools-3d.spec `@e2e @acceptance @REQ-013-AC10 …` (TASK-014 test, completed) | added: the app follows the drag (`__calc.view.section`). `Schnitt entfernen` is the pill (was the interim axis controls): `state().section` and the app section null, handle and pill hidden |
| grouping.spec `@e2e @acceptance @REQ-006-AC11 …` | 2 hidden walls (ERDG-1/-2, properties panel) + rule `Ausblenden` · `Kategorie` · `Gleich` · `IfcSlab`, grouped by Kategorie with `BaseQuantities.NetVolume`. Expected = the reference hidden case without its IfcSlab group (93 = Y − 6, volume 118.5435 − 76.9916). Status `93 von 99 Elementen`; group labels; counts and unrounded sums per group; IfcWallStandardCase `11` and its DOM sum; no IfcSlab group; total row (DOM and hook). `Schneiden` on the side face of `Wand-Int-ERDG-1`: the same values |
| grouping.spec `@e2e @acceptance @REQ-013-AC11 …` | a snapshot without section: single-view rows with cells, status, Kategorie / Geschoss / Material counts, grouped rows, total, grouped CSV. A vertical cut on the side face of `Wand-Int-ERDG-1` (made pickable by a GlobalId tick, which is reset). 42 of 82 geometry elements lie entirely in the removed half and 27 entirely in the kept half (engine boxes, 8 corners against the plane): asserted ≥ 30 % / ≥ 20 %. The snapshot with section is equal. A clipped element (entirely removed) is selected from its table row: `state().selected`, panel `data-key`, section unchanged |
| colouring.spec `@e2e @acceptance @REQ-005-AC7 …` (TASK-016 test, completed) | `Schnitt X` added to the "no control" names (button, radiogroup, radio, text); no radio `Schnitt Y` / `Schnitt Z`, slider `Schnittposition`, `Schnitt umkehren` or `#cv-view-bar` |

Bite checks (product change reverted temporarily, the test failed, change restored):
- without the menu step of the `Esc` handler → `@REQ-007-AC5` fails;
- without the section pill in the stack → `@REQ-013-AC13` fails;
- without `onSection` → `@REQ-013-AC9` fails (app section, pill).

### Changed expectations
Each follows the approved CR-002 delta. No assertion was weakened.
- `view-3d.spec.mjs`:
  - The test "interim 1.0.0 `Schnitt` Z at mid-height, flip and slider …" is **removed**. It tested the axis controls, which CR-002 removes (REQ-005-AC3 retired, spec 2: "the X/Y/Z `Schnitt` … removed"). A comment points to the click-section tests.
  - `@REQ-007-AC1 @REQ-007-AC5 …`: after a 3D click the first `Esc` now closes only the click menu (asserted), the second clears the selection (REQ-007-AC5 _(changed CR-002)_). Was: one `Esc` cleared it.
- `selection.spec.mjs`, `@REQ-007-AC1 @REQ-007-AC2 a 3D click marks …`: the same two-step `Esc` after a 3D click (asserted). `test/support/selection.mjs` `probePick` closes the menu first.
- `element-tools-3d.spec.mjs`: the AC9 / AC10 tests are tagged (they now verify the whole ACs) and gained the pill assertions; the header comment was updated.
- `colouring.spec.mjs`: the REQ-005-AC7 test is tagged, `Schnitt X` and the other axis controls were added (assertions only added).
- `layout-followups.spec.mjs` L4 "the 3D toolbar stays one row at 1280 px with colouring and section active": it measured the removed 1.0.0 view bar (one row, slider and flip under it). It now measures the 3D toolbar `3D-Werkzeuge`: 3 buttons in one row, inside the 3D view, no overlap. The section is a click section with the pill `Schnitt entfernen`; `#cv-view-bar`, slider and flip are absent.
- `filter-area.spec.mjs` (REQ-004-AC4), `hide-isolate.spec.mjs` (REQ-012-AC12), `viewer.spec.mjs` (REQ-010-AC1 setup): the "Given a section" is made by `Schneiden` in the click menu (was the interim radio `Schnitt Z`). The assertions are unchanged: the section survives the reset; the viewer shows the exported state.
- `config.spec.mjs` `@REQ-009-AC1 …`:
  - the section is a click section (was `Schnitt Z` flipped);
  - `display.sectionPlane` equals the plane `state().section` reports, and the app's `view.section` equals it. Was: `view.section` = `{ axis: Z, flipped: true }`, and the plane derived from the offset;
  - after loading, the pill `Schnitt entfernen` and the handle are shown (was the radio `Schnitt Z` checked).
  - The round trip (second JSON = first) is unchanged.
- `test/support/tools.mjs`:
  - `pickPoint` takes an optional `accept(hit, x, y)` and returns the hit too (callers unchanged);
  - new helpers: `anyPickable`, `menuGeometry`, `appSection`, `cutAt`.

### Trace
- `INC2_PENDING`: removed REQ-005-AC6, AC7, REQ-006-AC11, REQ-008-AC6, REQ-013-AC1, AC9, AC10, AC11, AC13. REQ-007-AC5 was never pending (a changed AC); its tests are updated above and the whole AC has the new test.
- `docs/testing/traceability.md` regenerated (`node scripts/trace.mjs`).

## Results (2026-11-05, CV_TEST_PORT=5020)
- `node scripts/check.mjs`: green (format, lint, cdn-cache, test_fast incl. trace and the ASCII / `</script>` checks, 29 integration tests on `http`).
- Playwright `http`, all green:
  - element-tools (5);
  - element-tools-3d, view-3d, colouring, layout-followups (26);
  - filter-area, hide-isolate, config (33);
  - viewer, selection, properties-panel, smoke;
  - selection, grouping, panel-actions, rule-filter (all green after the `probePick` update);
  - table, table-robustness, export, view-tools, system (27, 1 existing conditional skip);
  - filter-, grouping-, viewer-, memory-robustness and `test/acceptance` (15).
- Playwright `file`, all green:
  - element-tools, element-tools-3d, view-3d, colouring, layout-followups (31);
  - filter-area, hide-isolate, config, selection (41);
  - grouping, panel-actions, rule-filter, viewer, properties-panel, smoke (39);
  - table, table-robustness, export, view-tools, system, filter- and grouping-robustness (33);
  - viewer-, memory-robustness, `test/acceptance`, `test/integration` (40).
- Not run: the perf suites and `volume-robustness`. No hot path changed: the `Esc` handler checks one flag, and the section is the existing cv-3d code. The perf specs press `Esc` only after row clicks (no click menu), which this task does not change.

## Decisions (for the release gate / orchestrator)
1. **A configuration plane is applied as given** (any valid plane, not only axis-parallel ones), as DEC-20 and spec 4.4 say. The TASK-012 interim conversion to an axis section is removed with the axis bar. REQ-009-AC4 / AC8 end to end stay TASK-018's.
2. **Closing the click menu with `Esc` moves no focus.** The menu is opened by a pointer click on the canvas, and no control opened it (DEC-21: the menu is pointer-only). The other steps keep their behaviour; TASK-019 does the keyboard pass.
3. **`Schneiden` keeps the selection.** The click that opens the menu selects the element (REQ-007), and `Schneiden` closes the menu only, as the reference does. Tests that need a clean selection press `Esc` after the cut.
4. **No flip or slider for the click section.** The removed 1.0.0 bar had them. The handle (drag, arrow keys) and a new `Schneiden` replace them, as the reference does (spec 3: more than one plane and the axis section are out of scope).
5. **The test seam `CalcView3D.setSection` bypasses the app** (no pill, no app state). Only the TASK-014 robustness tests use it; every UI path goes through `onSection` or the app's `setSection`.
6. **Test shapes:**
   - REQ-013-AC1 runs without any filter: the first of the 13 walls that a click picks from the load view.
   - REQ-013-AC13 places the wall point near the top with the camera hook `look`, then clicks it for real.
   - REQ-005-AC6 reaches "no opaque element" with a rule on top of the isolation.
   - REQ-013-AC11 cuts through `Wand-Int-ERDG-1` (42 of 82 geometry elements entirely removed, 27 entirely kept).

## Open points / contracts for later tasks
- **TASK-018:**
  - REQ-009-AC4 / AC8 / REQ-010-AC4 with the plane section end to end. The app now holds and saves the click plane, applies `display.sectionPlane` directly, and `applyConfig` names `Schnitt` when no model with geometry is loaded.
  - `config-roundtrip.spec.mjs` (integration) was not changed.
- **TASK-019:**
  - the keyboard pass. The section handle has focus and arrow keys (TASK-014). The `Esc` order is now complete (menu → selection → panel); check focus return after the selection step.
  - The REQ-005-AC12 layout with the fifth pill `Schnitt entfernen`: icon-only pills, properties panel left of the pill stack.
- **TASK-020:**
  - T5 check: `view-3d.spec` `@REQ-007-AC1 @REQ-007-AC5` and `selection.spec` `@REQ-007-AC3 @REQ-007-AC5` (1.0.0 tests) carry `@REQ-007-AC5` but verify only parts of the changed AC. The whole AC is `element-tools.spec` `@REQ-007-AC5`. Their tags were left as they were (not this task's tests); TASK-020 decides whether to retag them.
  - NFR-001 is unaffected by this task.
- **Not tested here:** `Schneiden` while a display plan is queued (TASK-014 open point, spec T7) and the 1 mm minimum step on a flat extent.

## Verification INC-2 (2026-11-05)
- **SYNC-5 (1)/(2):** see `docs/tasks/TASK-014.md` "Verification INC-2" (open for the testing phase with the reason).

## Testing cycle 2 (2026-11-05)
- The "Not tested here" items (`Schneiden` / `Fokus` while a display plan is queued; 1 mm minimum step on a flat extent) are now tested end to end through the toolbar `Fokus`, the menu item `Schneiden` and the focused handle: `test/e2e/section-robustness.spec.mjs` (`@e2e @robustness`, green on both projects). Details and bite checks: `docs/tasks/TASK-014.md` "Testing cycle 2".
