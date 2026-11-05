---
id: TASK-017a
title: "Hide/isolate as filter sources: menu `Ausblenden` / `Isolieren`, filter-area entries, pills, reset scope, deselect, model removal / IfcSpace, rules on properties no longer loaded"
type: feature
status: implemented (awaiting orchestrator verification)
implements: [REQ-013-AC2, REQ-013-AC4, REQ-013-AC5, REQ-013-AC6, REQ-013-AC8, REQ-004-AC4, REQ-004-AC5, REQ-004-AC6, REQ-012-AC12, REQ-012-AC13, REQ-012-AC14, DEC-18 (cv-app part)]
partly: [REQ-013-AC3 (first part; second part is an open question, see Open points)]
relates_to: [CR-002, INC-2, REQ-004, REQ-012, REQ-013, DEC-14, DEC-18, DEC-19, DEC-20, DEC-21, Q-003, TASK-011, TASK-014, TASK-015b, TASK-016, TASK-017b, TASK-017c, TASK-018, TASK-019, TASK-020]
depends_on: [TASK-016]
touches: [calc-viewer-builder.html (cv-css own section "TASK-017a entries of the non-set filter sources", cv-ui-src createFilterArea setSources, createViewTools tool pills + setToolState, renderLayout closeDrawer, cv-app-src hidden / isolated sets, filter sources, display plan, reset, model removal, configuration load, menu and panel wiring), scripts/ref/derive-reference.mjs, test/fixtures/reference-values.json, test/support/tools.mjs (new), test/e2e/hide-isolate.spec.mjs (new), test/e2e/grouping.spec.mjs, test/e2e/filter-area.spec.mjs, test/e2e/table.spec.mjs, test/e2e/table-robustness.spec.mjs, test/e2e/rule-filter.spec.mjs, test/e2e/element-tools-3d.spec.mjs, test/unit/trace.test.mjs, docs/testing/traceability.md]
---
# TASK-017a: Hide / isolate as filter sources

Spec §5 acceptance: REQ-013-AC2..AC6, AC8, REQ-004-AC4, AC5 (UI), AC6, REQ-012-AC12..AC14 green; `table.spec.mjs`, `table-robustness.spec.mjs`, `grouping.spec.mjs`, `filter-area.spec.mjs` reset test updated.

## What was built

### cv-app
- **Hidden set and isolated set** (DEC-18, session only): `hiddenKeys` (Set of row keys) and `isolatedKeys` (Set, or null while no isolation is active).
  - `Ausblenden` adds to the hidden set. The first `Isolieren` starts the isolated set; each further one adds to it.
  - Both are filter sources in `coreFilters()`: `{ type: 'keys', mode: 'exclude' }` and `{ type: 'keys', mode: 'include' }` (TASK-011 core, spec 4.3). Table, status line, filter-set counts (DEC-14 after them), groups, sums, the total row and CSV / XLSX therefore follow them without further code.
  - Display plan: `toolRemoved` (1 = hidden, or not isolated while isolating) and `isolating` go to cv-3d (TASK-014). Tool-removed elements are always invisible, never ghosts. Context geometry (IfcSite terrain) is hidden while isolating. `filterActive` (context ghosting) ignores the key sets, so `Ausblenden` does not change the context geometry (REQ-013).
  - A selected element that stops being shown is deselected; a group selection shrinks (existing `sync3d`, Q-003).
- **Wiring:** click menu `Ausblenden` / `Isolieren` (`createEngine` option `onMenu`, the TASK-014 stub); properties-panel buttons `Ausblenden` / `Isolieren` act on the selected element or on every element of a selected group (`propsHandlers.hide` / `isolate`). TASK-017b owns the panel tests (group texts, no-geometry element, REQ-013-AC7).
- **Reset scope** (REQ-004-AC4, User answer Q9): `Alle Filter zurücksetzen` and the pill `Filter entfernen` also clear both sets. `Alle Filter zurücksetzen` is enabled while any filter source is active or any rule exists (also a lone `Markieren` rule).
- **Model removal / IfcSpace switched off** (REQ-013-AC8): `publish()` drops keys that left the row set from both sets. An isolated set that becomes empty ends the isolation.
- **Configuration load** clears both sets (DEC-20 "Loading any configuration clears hidden and isolated elements"; one line in `applyConfiguration`, verified end to end by TASK-018 / REQ-009-AC5).
- **Filter-area entries** (`publishSources`, REQ-004 / DEC-21): `Ausgeblendet: <n> Element(e)`, `Isoliert: <n> Element(e)`, `Filterregeln: <n>` (every rule: `Markieren` and rules whose property is not loaded included), `Suche: „<text>“`, in this order. Each × clears only its source: the hidden set; the isolation; all rules (the search stays); the search text (the field is emptied too). The text of `Filterregeln` / `Suche` opens the in-viewer filter panel and closes the filter drawer below 1280 px.
- Test hook `window.__calc.tools = { hidden, isolated }`; `__calc.filter.active` lists key filters with their keys as arrays.
- REQ-012-AC14 (rules on properties no longer loaded) needed no new code: TASK-015b already leaves such rules out of evaluation, marks them `Eigenschaft nicht geladen`, and re-applies them once the catalogue has the property again. TASK-017a adds the acceptance test.

### cv-ui
- `createFilterArea`: list `#cv-fa-sources` (label `Weitere aktive Filter`) between `Alle Filter zurücksetzen` and the filter sets; `setSources(items)`.
  - Entries keep their nodes while their id stays, so the focus is kept.
  - A removed entry passes the focus to the next entry's ×, or to `Alle Filter zurücksetzen`.
  - Remove buttons are named `<text> entfernen`.
  - Texts are set as text only.
- `createViewTools`: pills `Isolierung entfernen` (title `Alle Elemente wieder anzeigen`, icon `isolate`) and `Ausblendung entfernen` (title `Ausgeblendete Elemente wieder anzeigen`, icon `hide`) below `Einfärbung entfernen`, as the reference (ref L1016-1036); `setToolState({ hidden, isolating })`; handlers `clearIsolation()`, `clearHidden()`. The pill stack height (`--cv-pills-h`) is updated.
- `renderLayout` returns `closeDrawer()`.

### cv-css
Own section "TASK-017a entries of the non-set filter sources": grey rounded rows as the rule rows, 13 px.

## Tests

Expected values: the new section `REQ-013-tools` of `test/fixtures/reference-values.json`, written by `scripts/ref/derive-reference.mjs` (`toolSection`) from the STEP text. It contains:
- the 13 walls with name, GlobalId, storey and volume;
- the REQ-013-AC5 group counts and Neumaier volume sums for the hidden case and the isolated case (walls `Wand-Ext-ERDG-1` / `-2`);
- the REQ-004-AC5 Kategorie counts before and after hiding one wall;
- REQ-012-AC14: the Duplex-only property `PSet_Revit_Constraints.Base Constraint`, its value `Level 1`, the 17 matching GlobalIds, and `fzkHasProperty: false`.

`derive-reference.mjs --check` is green. The other sections are unchanged; only `meta.purpose` lists the new IDs.

All the other values come from the reference file, from extracted rows (`__calc.rows`: keys, geometry flag) or from the engine (`engineVisible`). None comes from the filter code.

| Test (file, title abridged) | Covers |
|---|---|
| hide-isolate.spec `@e2e @acceptance @REQ-013-AC2 \`Ausblenden\` in the click menu …` | real 3D click on a pickable wall, menu `Ausblenden`; `toolHidden` = [wall] with ghosts on, not opaque / ghost; 98 table rows without it; `98 von 99 Elementen`; entry `Ausgeblendet: 1 Element`; pill + title; pill order; selection and panel cleared; second wall → `Ausgeblendet: 2 Elemente`, `97 von 99` |
| hide-isolate.spec `@e2e \`Isolieren\` in the click menu …; a further \`Isolieren\` adds` (REQ-013-AC3 first part, AC ID in a comment only) | opaque = [wall], every other geometry row in `toolHidden`, no ghost; `contextState().visible` 0; 1 table row; `Isoliert: 1 Element`; pill + title; selection and panel stay; menu closed. A further `Isolieren` adds to the set (selection seam). After `Isolierung entfernen` a new `Isolieren` starts a new set |
| hide-isolate.spec `@REQ-013-AC4` | two walls on different storeys isolated together (group row); one hidden → only the other, `1 von 99`; `Geschoss` = `Erdgeschoss` → the other wall is a ghost (ghosts on) or `hidden` (ghosts off), `1 von 99` |
| hide-isolate.spec `@REQ-013-AC6` | `Ausblendung entfernen` keeps the isolation; `Isolierung entfernen` ends it; `Alle Filter zurücksetzen` and the pill `Filter entfernen` each clear both sets, pills and entries (all elements opaque again) |
| hide-isolate.spec `@REQ-013-AC8` | FZK + Duplex, hidden and isolated elements in both; removing Duplex → sets, entries and counts drop; only Duplex isolated → isolation ends; IfcSpace (7 spaces, option off) never in `opaque` / `ghost` and never visible in the engine (`engineVisible`) through hide, isolate, both pills, `Fokus` (isolated and not) and the ghost toggle |
| hide-isolate.spec `@REQ-004-AC5` | rule `Isolieren` · `Kategorie` · `Enthält` · `wall` → Kategorie set `{ IfcWallStandardCase: 13 }`, 12 after hiding one wall; `IfcSlab` checked first → it stays checked with count 0, `IfcWallStandardCase` 13 |
| hide-isolate.spec `@REQ-004-AC6` | 3 hidden, 2 isolated, 2 rules, search `wand` → the four entries in order; × on `Ausgeblendet: 3 Elemente` returns only the hidden ones; 1 hidden → `Ausgeblendet: 1 Element`; the `Filterregeln` text opens the filter panel; × on `Suche` / `Filterregeln` clears only that source |
| hide-isolate.spec `@REQ-012-AC12` | pill hidden without sources and rules; a lone `Markieren` rule → `active` empty, entry `Filterregeln: 1`, `Filter` dot, pill first in the stack (with `Einfärbung entfernen`), ghost toggle left of and `Filter anzeigen` right of the main button (boxes); the chevron opens the panel; the REQ-004-AC4 state reset by the button and by the pill gives equal snapshots (status, entries, pills, active filters, rules, search, sets, column filters, table, Kategorie values, the whole `state()`, colouring), with section, colouring and ghosts off kept |
| hide-isolate.spec `@REQ-012-AC14` | rule on `PSet_Revit_Constraints.Base Constraint` `Enthält` `Level 1` → the 17 reference GlobalIds; Duplex removed → `Eigenschaft nicht geladen`, `99 von 99`, all opaque, entry `Filterregeln: 1`; Duplex loaded again → note gone, the 17 again |
| grouping.spec `@REQ-013-AC5` | 2 hidden walls: group rows, counts, volume sums (DOM and unrounded), total row, Kategorie counts, CSV and XLSX (read back by csv / openpyxl) = reference `hidden` case (walls 11); the same 2 isolated = reference `isolated` case |
| filter-area.spec `@REQ-004-AC1 … @REQ-004-AC4` (AC4 part extended, see Changed expectations) | full REQ-004-AC4: checked values, column filter, `Markieren` + `Ausblenden` rule, search, 1 hidden, 1 isolated; after the reset: nothing checked, no column filter, rule, search (field empty) or entry, both sets empty, 99 rows, `99 von 99`, colouring, section and ghost toggle unchanged |
| rule-filter.spec `@e2e @robustness @acceptance @REQ-012-AC13` | rule value `<img src=x onerror=alert(1)>` and search `<script>window.__xss=5</script>` shown literally in the rule row, both entries and the dialog field; no `img` / `script` added, no other element in the entries, `__xss` unset, no alert. A crafted FZK copy names one wall `Wärme-Wand` (STEP `\X2\` encoding); search `wärme` / `WÄRME` and rules `Enthält` `WÄRME` / `Gleich` `wärme-wand` find exactly it |
| table-robustness.spec `@robustness @REQ-013 hide / isolate at the edges …` | an isolated wall excluded by a rule → empty table with hint, `0 von 99`, ghost; a whole group (11 windows) hidden through its group row → group gone, selection cleared; slabs isolated through their group row → combine; the reset restores all |

### Changed expectations
Each follows the approved CR-002 delta.
- `test/e2e/filter-area.spec.mjs`, test `… @REQ-004-AC4 checking values filters the rows`: the AC4 part now builds the full changed AC (REQ-004-AC4 _(changed CR-002)_). It was "reset clears the checked values". All earlier assertions are kept.
- `test/e2e/table.spec.mjs`, the former `@REQ-004-AC1 @REQ-004-AC4 … reset clears both`:
  - it now also hides and isolates an element before the reset and asserts that both sets are empty and nothing is `toolHidden` after it;
  - `@REQ-004-AC4` was moved from its title to the full test in filter-area.spec (T5: a title names an AC only when the test verifies all of it). A comment says so;
  - no assertion was removed.
- `test/e2e/element-tools-3d.spec.mjs`, first test: the TASK-014 stub expectation "`Ausblenden` … changes nothing in 3D until TASK-017a wires it" became "hides the wall (`toolHidden`, opaque empty)"; `Ausblendung entfernen` then shows it again (REQ-013-AC2). The header comment was updated.
- `test/e2e/grouping.spec.mjs`, `test/e2e/table-robustness.spec.mjs`, `test/e2e/rule-filter.spec.mjs`: tests were only added.

### Trace
- `INC2_PENDING`: removed REQ-004-AC5, AC6, REQ-012-AC12, AC13, AC14, REQ-013-AC2, AC4, AC5, AC6, AC8. **REQ-013-AC3 stays listed** (see Open points). REQ-004-AC4 was never pending (a changed AC); its test is updated above.
- `docs/testing/traceability.md` regenerated (`node scripts/trace.mjs`).

## Results (2026-11-05, CV_TEST_PORT=4910)
- `node scripts/check.mjs`: green (format, lint, cdn-cache, test_fast incl. trace, ASCII / `</script>` checks, 29 integration tests on `http`).
- Playwright, both projects (`file` and `http`), all green:
  - `test/e2e`: hide-isolate (new, 9 × 2), filter-area, grouping, table, table-robustness, rule-filter, element-tools-3d, colouring, view-3d, view-tools, selection, properties-panel, smoke, layout-followups, config, export, viewer, system, filter-, grouping-, viewer- and memory-robustness;
  - `test/acceptance`;
  - `test/integration` on `file` (on `http` via `check`);
  - `system.spec` `http` is the existing conditional skip.
- On `file` only (existing project rule), green: `volume-robustness` and `test/perf/view-3d.spec.mjs` (NFR-001 filter click on the volume set).
- Not run: the other perf suites. NFR-001 for the hide / isolate clicks and the full reset is TASK-020's acceptance. The extra cost per evaluation is two key masks and one `toolMask` pass, both O(rows).

## Decisions (for the release gate / orchestrator)
1. **The properties-panel buttons are wired here, not in TASK-017b.** REQ-013-AC3 (in this task) needs `Isolieren` in the panel. The buttons act on the element or on all elements of a group selection (DEC-18). TASK-017b keeps their acceptance tests (REQ-013-AC7, REQ-007-AC4 buttons, AC8 texts).
2. **Configuration load clears hidden / isolated elements already here** (one line, DEC-20). The end-to-end test (REQ-009-AC5, REQ-013-AC12) stays with TASK-018.
3. **`Alle Filter zurücksetzen` is enabled for a lone `Markieren` rule**, as the pill `Filter entfernen` is: both do the same (Q9). Before, it was disabled because a mark is no filter source.
4. **× on `Filterregeln: <n>` removes all rules and keeps the search text**; × on `Suche` clears only the search. The panel `Zurücksetzen` (both together) is unchanged.
5. **The entry `Suche: „…“` shows the trimmed text**, the text the filter applies.
6. **Clicking the `Filterregeln` / `Suche` text closes the filter drawer below 1280 px** before it opens the in-viewer filter panel, so the panel is not hidden under the drawer. The focus stays on the entry. The keyboard pass is TASK-019.
7. **Context geometry ghosting ignores the key sets:** hiding elements does not ghost or hide the IfcSite terrain (REQ-013 "`Ausblenden` does not change it"); isolation hides it.
8. **Expected values for REQ-012-AC13 umlauts:** FZK has no element value with `Wärme` (its two `Wärme…` strings are property names with empty values, which DEC-19 never matches). The test therefore renames one wall in an in-memory copy to `Wärme-Wand`, the literal example of the AC.

## Open points / contracts for later tasks
- **REQ-013-AC3, second part (QUESTION FOR USER via the orchestrator).** The AC reads: "When the user selects a second wall in the table and clicks `Isolieren` in the properties panel, Then both walls are shown". While wall A is isolated, the table, the 3D view (tool-removed elements are invisible and not pickable, DEC-18) and the group rows show only A. So no second wall can be selected through the UI, and "further `Isolieren` add to it" (DEC-18, as ref L1109-1117, which is just as unreachable there) has no UI path. The first part of AC3 and the add semantics (through the `CalcView.select` seam) are tested without the AC ID. REQ-013-AC3 stays in `INC2_PENDING` until the user decides. Options:
  - (a) **Recommended:** correct REQ-013-AC3 by a small CR, so that its second part becomes a reachable flow. Before any isolation, the user selects a group row of two walls and clicks `Isolieren`: both walls are shown and the entry reads `Isoliert: 2 Elemente`. Keep DEC-18 "further `Isolieren` add" as written (harmless) and leave it to the unit test of the key sets.
  - (b) Make adding reachable: while isolation is active, `Isolieren` on a table row selected before the isolation… This needs a new UI concept (for example the table lists tool-removed rows greyed), which contradicts Q3 ("removed from 3D and table").
  - (c) Change DEC-18 so that each `Isolieren` replaces the isolated set (deviation from the reference).
- **TASK-017b:** the panel buttons are wired; the group panel texts, the no-geometry element (REQ-013-AC7) and REQ-007-AC4 (buttons) remain for 017b to test. `test/support/tools.mjs` (`panelAction`, `isolateTogether`, `menuAction`, `sourceEntries`, `shownPills`, `toolSets`) is available.
- **TASK-017c:** the pill `Schnitt entfernen` goes after `Ausblendung entfernen` (`pills.append`), as REQ-013-AC13 requires. The REQ-012-AC12 and REQ-004-AC4 tests use the interim `Schnitt Z` control for "section unchanged"; switch them to the click section when the axis bar is removed.
- **TASK-018:** REQ-009-AC5 / REQ-013-AC12 end to end (configuration load clears both sets; already implemented).
- **TASK-019:** keyboard pass over the entries (Tab order, focus after ×, focus into the filter panel when an entry text opens it) and the pill stack with up to five pills (REQ-005-AC12).
- **TASK-020:** NFR-001 for `Ausblenden`, `Isolieren`, both pills and the full reset on the volume set.
