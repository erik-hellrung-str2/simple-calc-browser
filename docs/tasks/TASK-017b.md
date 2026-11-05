---
id: TASK-017b
title: "Properties-panel actions: `Ausblenden` / `Isolieren` for element and group, group panel texts, `Nach Wert filtern`, row tools by keyboard"
type: feature
status: implemented (awaiting orchestrator verification)
implements: [REQ-003-AC4, REQ-003-AC5, REQ-007-AC4, REQ-007-AC7, REQ-007-AC8, REQ-013-AC7, DEC-21 (`Nach Wert filtern` below 1280 px)]
relates_to: [CR-002, INC-2, REQ-003, REQ-004, REQ-007, REQ-013, DEC-18, DEC-21, TASK-013, TASK-016, TASK-017a, TASK-017c, TASK-019, TASK-020]
depends_on: [TASK-017a]
touches: [calc-viewer-builder.html (cv-ui-src createFilterArea reveal / flushReveal, renderLayout setDrawer, createDetails doc comment; cv-app-src propsHandlers.filterByValue), test/e2e/panel-actions.spec.mjs (new), test/acceptance/panel-fetched.spec.mjs (new), test/support/selection.mjs, test/e2e/view-3d.spec.mjs (comment), test/e2e/selection.spec.mjs (comment), test/e2e/properties-panel.spec.mjs (comment), test/unit/trace.test.mjs, docs/testing/traceability.md]
---
# TASK-017b: Properties-panel actions

Spec §5 acceptance: REQ-003-AC4/AC5, REQ-007-AC4 (buttons), AC7, AC8, REQ-013-AC7 green.

## What was built

### cv-app
- **`Nach Wert filtern`** (`propsHandlers.filterByValue(key, value)`; REQ-003, [U Q8], DEC-21):
  - takes every value the element has for the property (a multi-valued property: all of them; empty values are skipped);
  - finds the filter set of that property; if there is none, it adds one at the bottom, expanded (`{ id: key, key, collapsed: false, selected: [] }`, as `+ Filtersatz` does);
  - ticks the values not yet ticked. Ticked values stay ticked (no toggle). Nothing else changes: no other set, filter source, selection or colouring.
  - Only when something was added does it re-evaluate (`changed()`).
  - Then it asks the filter area to scroll the set into view (`ui.filters.reveal`).
- The panel buttons `Ausblenden` / `Isolieren` were already wired by TASK-017a (element or every element of a selected group, DEC-18). The group panel texts (`<n> Elemente ausgewählt`, `Davon ohne 3D-Geometrie: <n>`) and the no-geometry hint were built in TASK-013. This task adds their acceptance tests.

### cv-ui
- `createFilterArea` returns `reveal(id)` and `flushReveal()`.
  - `reveal` scrolls the set into view at once while the filter area is shown (≥ 1280 px, or the drawer open).
  - Otherwise the request waits, and `renderLayout`'s `setDrawer("filters")` flushes it when the drawer is opened. The drawer itself stays closed (DEC-21).
  - Scrolling brings the set's head into view, and the whole set when it fits (the panel's scroller, no page scroll).
- `createDetails`: the doc comment names who wires which handler. No behaviour change.
- REQ-007-AC7 needed no new code. The row tools are buttons (Tab, `Enter`). `.cv-prop-row:focus-within` / `:hover` show them (TASK-013 CSS).

## Tests

Expected values come from `test/fixtures/reference-values.json`, never from the code under test:
- `AC20-FZK-Haus.elements` (wall `Wand-Ext-ERDG-1`: Geschoss `Erdgeschoss`, Typ `Leichtbeton 102890359 300`);
- `filters.REQ-004-AC2` (ground-floor Kategorie counts);
- `conditionalElements` (IfcVirtualElement without representation);
- `REQ-005-AC4` (Duplex STEP 4131, materials `Metal - Stud Layer`, `Plasterboard`);
- `REQ-007-selection` (the 13 walls);
- `REQ-013-tools.rows` (99);
- `REQ-002-AC7` (SampleCastle element without geometry).

Ground-floor rows are taken from the extracted rows (`Geschoss`) and checked per Kategorie against the reference counts first. REQ-007-AC8's n is the AC's own definition: the group's rows with `Geometrie` = `Nein` (extraction, verified by REQ-002-AC7), not the panel code.

| Test (file, title abridged) | Covers |
|---|---|
| panel-actions.spec `@e2e @acceptance @REQ-003-AC4 …` | selected wall, `Nach Wert filtern` on `Geschoss`: `Erdgeschoss` checked in the existing set (DOM via the set search and `__calc.filter.sets`), still exactly the three sets, the other sets empty; table = ground-floor rows (38), `38 von 99 Elementen`, 3D opaque = ground-floor geometry, ghosts = the rest; selection kept, no other source entry; a second click keeps the value and does not re-evaluate |
| panel-actions.spec `@e2e @acceptance @REQ-003-AC5 …` | FZK + Duplex: `Typ` set added at the bottom (4th), expanded, scrolled into view at 1280 px, exactly `Leichtbeton 102890359 300` checked, every filtered row has that Typ; Duplex STEP 4131 `Material` row: both values checked in the existing `Material` set, every filtered row has one of them (OR) |
| panel-actions.spec `@e2e @REQ-003 … below 1280 px …` | DEC-21 at 1100 × 700: the drawer stays closed (`aria-expanded` false, panel hidden), the set is added and ticked; opening the drawer scrolls the set into view |
| panel-actions.spec `@e2e @acceptance @REQ-007-AC7 …` | the row tools are hidden (opacity 0), shown on hover. Tab from `Schließen` reaches the `Geschoss` row's `Nach Wert filtern`; its tools are shown and the other rows' tools stay hidden. `Enter` ticks `Erdgeschoss` (focus stays). Tab to `Farbe nach Wert`, `Enter` colours by `Geschoss` and opens the colouring panel at its legend |
| panel-actions.spec `@e2e @acceptance @REQ-007-AC4 …` | IfcVirtualElement (`Geometrie` = `Nein`) clicked in the table: panel with kicker, GlobalId, hint, both buttons. `Isolieren`: 1 table row, `1 von 99`, `Isoliert: 1 Element`, nothing opaque or ghost, every geometry element tool-hidden, panel stays. `Ausblenden`: row gone, `98 von 99`, `Ausgeblendet: 1 Element`, 3D unchanged, selection and panel cleared. No page error |
| panel-actions.spec `@e2e @acceptance @REQ-013-AC7 …` | no-geometry element `Ausblenden` in the panel → row gone (98 rows), `Ausgeblendet: 1 Element`. Group row `IfcWallStandardCase` (grouping by Kategorie) selected (= the 13 reference walls), `Isolieren` → opaque = exactly the 13 walls, every other geometry element tool-hidden, `Isoliert: 13 Elemente`, 13 table rows, `13 von 99` |
| panel-fetched.spec `@acceptance @REQ-007-AC8 …` (fetched SampleCastle) | FZK group row `IfcWallStandardCase`: `state().selected` = the 13 walls, `13 Elemente ausgewählt`, no hint, buttons shown. SampleCastle group `IfcBuildingElementProxy` (27 elements, 14 without geometry in this run): `27 Elemente ausgewählt`, `Davon ohne 3D-Geometrie: 14`, selection = the group's keys, buttons shown |

Without the reveal code, the `@REQ-003-AC5` and the below-1280 px tests fail ("scrolled into view"). Checked by disabling it temporarily.

### Changed tests (no expectation changed, nothing weakened)
- `test/support/selection.mjs` `clickRow`: the row locator skips hidden pool rows (`:not([hidden])`). After the table grew from 1 to 99 rows, a hidden recycled row kept a stale `aria-rowindex`, so the locator matched two rows (Playwright strict mode). Every spec that uses `clickRow` is green (see Results).
- `view-3d.spec.mjs`, `selection.spec.mjs`, `properties-panel.spec.mjs`: comments only. They now point to the whole-AC tests in `panel-actions.spec.mjs`.

### Trace
- `INC2_PENDING`: removed REQ-003-AC4, AC5, REQ-007-AC4, AC7, AC8, REQ-013-AC7.
- `docs/testing/traceability.md` regenerated (`node scripts/trace.mjs`).

## Results (2026-11-05, CV_TEST_PORT=5010)
- `node scripts/check.mjs`: green (format, lint, cdn-cache, test_fast incl. trace and the ASCII / `</script>` checks, 29 integration tests on `http`).
- `test/e2e/panel-actions.spec.mjs`: 6 / 6 green on `file` and on `http`.
- `test/acceptance/panel-fetched.spec.mjs`: green on `file` and on `http`.
- Regression, both projects, green:
  - selection, properties-panel, view-3d, colouring (50);
  - hide-isolate, filter-area, grouping (62);
  - rule-filter, table-robustness, table, smoke, layout-followups (64);
  - viewer, element-tools-3d, view-tools, config, `test/acceptance` table-fetched and fetched-fixtures (70).
- Not run: the perf suites (no hot path changed; `filterByValue` is one `changed()` like a checkbox click), and system / export / the other robustness specs (no code they use changed).

## Decisions (for the release gate / orchestrator)
1. **An existing set is not expanded or moved.** When `Nach Wert filtern` ticks a value in an existing collapsed set, the set stays collapsed: "nothing else changes", REQ-003. It is still scrolled into view. Only a new set is created expanded.
2. **Scrolling into view applies to existing sets too**, not only to a newly added one. It is the same DEC-21 behaviour; no filter state changes.
3. **The ticked value is not scrolled into view inside the set's value list.** The list is virtualised and the spec asks only for the set. A set with many values may show the ticked value further down; the set badge and `Auswahl zurücksetzen` show that something is ticked.
4. **A second `Nach Wert filtern` on an already ticked value does nothing** (no re-evaluation), as "Values already ticked stay ticked" reads.

## Open points / contracts for later tasks
- **TASK-019:** the keyboard pass. Tab order through the panel: `Schließen`, `Ausblenden`, `Isolieren`, group heads, row tools. Also focus after `Nach Wert filtern` (stays on the row tool) and the drawer case below 1280 px.
- **TASK-020:** NFR-001 for `Nach Wert filtern` is the same evaluation as a filter-set click (already measured in TASK-010). No separate case was added.
