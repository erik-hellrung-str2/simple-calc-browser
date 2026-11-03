---
id: TASK-006b
title: Table grouping view (up to 2 levels, `Gruppe` / `Anzahl` / sums, equal-or-empty text, `(leer)`, multi-valued groups, expand / collapse, total row, group sorting, view switch, grouping state)
type: feature
status: done (verification pending)
implements: [REQ-006-AC2, REQ-006-AC3, REQ-006-AC7, REQ-006-AC8, REQ-006-AC10, REQ-006-AC5 (groups by their sums), DEC-16, ASM-008]
relates_to: [NFR-001, DEC-2, DEC-9, REQ-008, REQ-009, TASK-006a, TASK-006c, TASK-007, TASK-008, TASK-010]
depends_on: [TASK-006a]
touches: [calc-viewer-builder.html (cv-css, cv-core-src, cv-ui-src, cv-app-src), scripts/ref/derive-reference.mjs, test/fixtures/reference-values.json, test/unit/grouping.test.mjs, test/support/grouping.mjs, test/support/many-groups-fixture.mjs, test/e2e/grouping.spec.mjs, test/e2e/grouping-robustness.spec.mjs, test/perf/grouping.spec.mjs]
---
# TASK-006b: Table, grouping view

## What was built

### cv-core (pure, unit-tested)
- `groupRows(store, indices, { levels, columns, sort })` builds the grouping view.
  - `indices` are the rows passing all filters, already in table order (`sortRows`). So element rows inside a group follow the sort.
  - `levels` holds one or two grouping properties. `GROUP_LEVELS` = 2; further keys are ignored (spec §3).
  - `columns` is `[{ key, mode }]`:
    - `sum` (numeric columns): Neumaier sum. The cell is `null` when no element of the group has a value, so it shows empty, not 0.
    - `same` (text columns): the value if every element of the group has the same one, compared as displayed (multi-values joined), else `null` (REQ-006-AC7).
    - `none`: numbers with unit `gemischt` (DEC-2: no sums).
  - Groups come from the dictionary codes of the column store, so a multi-valued cell (e.g. `Material`) puts the element into each of its groups. It is counted and summed there (DEC-16, ASM-008).
  - Group order without a sort: value order (`compareValues`), `(leer)` (value `null`) last.
  - With a sort, groups are ordered by their cell of the sort column (sum or common text) via `sortByValue`. Empty cells come last, and `(leer)` stays last in both directions (REQ-006-AC5). Level-2 groups are sorted inside their parent.
  - Group ids are paths of value tokens (`$text`, `#number`, `~` for empty), with level 2 as `<id1>\u001f<token2>`. They stay stable across filter changes, so the expanded state survives a filter click.
  - `total` = `{ count, cells }` over the filtered rows, each element once. Only sums are filled; text cells stay empty (REQ-006-AC8).
- `groupDisplayRows(tree, isExpanded)` gives the shown rows: every level-1 group. Under an expanded group come its level-2 groups, or its elements when it is the last level (`depth` 1 or 2). This is also the row order TASK-008 exports.
- `allGroups(tree)`; `normaliseGrouping({ view, groupBy }, catalog)` gives the configuration part. It keeps up to two distinct keys, and drops unknown keys while a catalogue exists.

### cv-ui
- **Toolbar.**
  - `Einzelelemente | Gruppiert` is enabled (radio group).
  - In the grouping view a second toolbar row `#cv-group-tools` appears:
    - `Gruppe 1: <Eigenschaft>` and `Gruppe 2: <Eigenschaft> | –` (`#cv-group-1/2`). Each opens the catalogue dialog `Gruppieren nach (Ebene n)`, and the other level's property is disabled there.
    - `Gruppe 2 entfernen` (×).
    - `Alle aufklappen` / `Alle zuklappen` (icon buttons with these accessible names and tooltips).
  - The table head wraps (`flex-wrap`), and the group tools always take their own row. At 1280 px the head is two rows in the grouping view and one in the single-element view.
- **Table (`createTable`).**
  - `setGroups(rows, items, total, emptyText)` next to `setRows`. The same virtualised pool renders group and element rows (only rows near the window, cells only near the visible width).
  - The scroll box gets `role=treegrid` and the label `Tabelle gruppiert`.
  - **Fixed columns** `Gruppe` (`@gruppe`, 260 px) and `Anzahl` (`@anzahl`, 90 px, right-aligned) come first. They have a plain header: no sort, filter, drag or resize. Moving a normal column by drag and drop counts positions among the movable columns, so the app's column list (DEC-9, shared with the single view) stays right.
  - **Group row** (`.cv-grp`, `data-group`, `data-level`, `aria-level`, `aria-expanded`):
    - The `Gruppe` cell has the toggle `Gruppe aufklappen: <Wert>` / `Gruppe zuklappen: <Wert>` (chevron, rotated when open) and the value. `(leer)` is used for the empty value; numbers are in German format. Values are set as text.
    - `Anzahl` shows the count.
    - Numeric columns show the sum and text columns the common value (or empty).
    - Level 1 has a darker background than level 2. Both are bold.
  - **Element row** (`.cv-tr-el`, `data-key`, `data-depth`): the element's values. Its `Gruppe` cell is empty with a small marker, indented one step (18 px) deeper than its group (REQ-006-AC3).
  - **Total row** `#cv-tbl-total` (`Summe`, `Anzahl`, sums): sticky at the bottom of the scroll box, bold, so it is always visible.
  - Clicking a group row (not its toggle) calls `handlers.groupClick(id)`. This is the hook for TASK-006c.

### cv-app
- **State.**
  - `tableView` (`single` | `grouped`) and `groupBy` (`[key1, key2?]`).
  - Expanded state: a group is open when `expandDefault` differs from `toggled.has(id)`. `Alle aufklappen` / `Alle zuklappen` set the default and clear the toggles (O(1)), and a toggle flips one id. A new grouping (another property) starts collapsed. Filter changes and view switches keep the state.
- **Update.** `updateTable` in the grouping view runs `sortRows` → `groupRows` (sums for catalogue kind `number` unless the unit is `gemischt`, else equal-or-empty) → `groupDisplayRows` → `setGroups`. Expand and collapse only rebuild the display rows, without regrouping.
  - Adding a column in the grouping view regroups, so the new column gets its sums. This was found by the AC10 test.
- **Switch.** `Gruppiert` without a grouping property groups by `Kategorie`.
  - The grouping properties are kept in the column store (`keysInUse`) while the view is grouped.
  - On a row-set change, properties that no longer exist in the catalogue are dropped and level 2 moves up. With a model loaded and no property left, the view falls back to `Kategorie`. With no model, keys are kept, so a grouping chosen before loading survives.
- **Configuration part for TASK-007 (REQ-009 "table view, grouping properties").**
  - `start().groupingState()` / `window.CalcTable.grouping()` → `{ view, groupBy }`.
  - `setGroupingState(state)` / `CalcTable.setGrouping(state)` apply one. Unknown keys are skipped.
  - The expanded state is not part of it (REQ-009).
  - `tableState()` is unchanged (columns, sort, column filters).
- **Hook.** `window.__calc.table` adds:
  - `view`, `groupBy`, and `groups` (number of groups on both levels).
  - `total` `{ count, cells }`.
  - `display`, built when read: the shown rows in order, group rows with `level`, `id`, `key`, `value`, `label`, `count`, unrounded `cells` and `expanded`, element rows with `key` and `depth`.
  - `at`: the `performance.now()` time of the last table update.
  - In the grouping view, `count` is the number of shown rows and `keys` the shown element keys.
- `start().onGroupClick(listener(id, elementKeys))` is the hook for TASK-006c (group row selection).

## Tests

| AC / item | Test | Type | Result (file + http) |
|---|---|---|---|
| REQ-006-AC2, AC8 | `test/e2e/grouping.spec.mjs` `@REQ-006-AC2 @REQ-006-AC8`. **Setup:** FZK; `Gruppiert` via the UI (default `Kategorie`); `BaseQuantities.NetVolume` column; `Gruppe 2` = Geschoss through the catalogue dialog; header = `Gruppe`, `Anzahl`, columns. **Collapsed:** one row per Kategorie in value order, `Anzahl` and volume sum = reference (German text). **After `Alle aufklappen`:** each Kategorie's Geschoss sub-rows (`(leer)` last) have count and volume = reference, and each has exactly that many element rows. Sub-row counts add up to the parent, and unrounded sums add up within 1e-9 relative; every unrounded sum equals the reference. **Total row:** `Summe`, `Anzahl` = 99, volume = reference total, text cells empty; it stays visible at the bottom; the status line agrees. **Under a filter** (Kategorie wall + slab, filter set): only those groups; total = their count and volume; the expanded state is kept. | e2e, acceptance | pass |
| REQ-006-AC3 | `@REQ-006-AC3`. **One level:** expanding `IfcWallStandardCase` (toggle click) puts its 13 element rows directly under it, `depth` 1, with the `Gruppe` cell indented more than the group row. Their GlobalIds are in the reference wall/slab set, their Kategorie cells are walls and their Name cells equal the single-element view. Collapsing hides them. **Two levels:** a new level-2 grouping starts collapsed. Wall → Geschoss sub-groups (indented) → `Erdgeschoss` → 9 element rows at `depth` 2, indented more again. Collapsing the parent hides both, and expanding it again keeps the sub-group open. `Alle aufklappen` shows all 99 elements; `Alle zuklappen` shows only level-1 rows. | e2e, acceptance | pass |
| REQ-006-AC7 | `@REQ-006-AC7`. A and B are picked from the reference: A = a Kategorie with one storey and ≥ 2 elements (IfcDoor), B = one on several storeys (IfcWallStandardCase). Row A shows the Geschoss, row B leaves it empty. For every group, Geschoss and Name equal the reference's common value (or empty), and Kategorie = the group. The total row's text cell is empty. | e2e, acceptance | pass |
| REQ-006-AC10 | `@REQ-006-AC10`. **Setup:** Duplex; group 1 = Material via the dialog; the column `PSet_Revit_Dimensions.Volume` (catalogue `number`, `m³`) is added **after** grouping. **Groups:** each material group's count and volume = reference (row classes), unrounded within tolerance. **Total row:** count = 218 (each element once), less than the sum of the group counts, and volume = reference total; status line agrees. **Multi-material element:** the two-material element of `REQ-005-AC4` is an element row under both of its material groups, and each group's row count = its `Anzahl`. | e2e, acceptance | pass |
| REQ-006-AC5 (groups) | `@REQ-006-AC5`, grouped by Geschoss with NetVolume. **Order:** without a sort, value order; ascending and descending order the groups by their reference sums (asc gives Erdgeschoss before Dachgeschoss, unlike the value order), with `(leer)` last. **Elements:** inside the expanded first group the elements are ordered by volume descending, empty last. | e2e, acceptance | pass |
| View switch, columns, state | `@REQ-006 switching views ...`. **Grouped:** with filter Kategorie = IfcDoor, `Gruppiert` gives one group, `treegrid`, and an unchanged 3D `opaque`. Dragging `Geschoss` before `Modell` keeps the fixed columns first, and `CalcTable.state()` has the new order. Fixed headers have no buttons or resize handle. **Back to single:** same columns and filter, no total row or group tools; `grouping()` = `{ single, [Kategorie] }`. **Seam:** `setGrouping` with an unknown key skips it. **`Gruppe 2 entfernen`** removes level 2. | e2e | pass |
| T7 5,000 groups | `test/e2e/grouping-robustness.spec.mjs`. **Fixture:** FZK + 5,000 proxies without geometry, each with its own `CalcTest_Group.Nummer` and a `CalcTest_Group.Menge` (`test/support/many-groups-fixture.mjs`, built in memory). Expected values come from parsing the generated text with `scripts/ref/ifc-model.mjs`. **Grouping by it:** 5,001 groups (+ `(leer)` for the 99 FZK rows); `aria-rowcount` 5,003; every group's label, count and amount equal the expectation. **DOM:** < 60 row nodes; jumps to 0 / 50 / 100 % show the matching rows, with `(leer)` last; render max < 50 ms. **Total row:** 5.099 and 12.502.500. **Sort:** amount descending puts `(leer)` last. **Expand all:** 10,100 rows; the last row is an element; still < 60 nodes. Regroup measured 11.9 ms, expand all 4.7 ms (asserted < 500). | robustness | pass |
| T7 empty | **No model:** `Gruppiert` shows `Keine Elemente.`, `Summe` 0, and expand / collapse do no harm. **The grouping survives loading.** **Filter without elements** (Kategorie X filter set AND a Geschoss column filter on a storey where X has no element, both from the reference): `Keine Elemente im Filter.`, no body rows, total `0` with an empty sum, 3D `opaque` empty. Expand, sort and collapse do no harm. Reset brings the groups back. | robustness | pass |
| T7/T10 HTML values | `@robustness @T10`: XSS fixture grouped by Name. The HTML strings show literally as group labels; expanding one by its toggle (accessible name with the literal text) works. No img/script/b elements, `window.__xss` undefined, no dialog. | robustness | pass |
| Unit | `test/unit/grouping.test.mjs` (7 `[unit]`): count / sums / empty sum / equal-or-empty / `(leer)` last / total; multi-valued groups and total once; multi-value equality as displayed; number ids; two levels add up, ids by path, empty levels and empty input; sorting by sums asc/desc with `(leer)` last, elements in row order, text sort, level-2 sort; display rows under expanded states; `normaliseGrouping`; FZK snapshot rows by Kategorie × Geschoss = reference counts, volumes and common values | unit | pass |
| NFR-001 / perf | `test/perf/grouping.spec.mjs` `@perf` (file project, numbers below) | perf | pass |

### Performance (volume set, `test/perf/grouping.spec.mjs`)
- **Setup.** Volume set as in TASK-006a: 4 × Revit MEP + SampleCastle = **30,931 rows**, loaded in 64 s. The numeric column `Pset_MemberCommon.Span` is summed per group. Kategorie gives 29 groups; Kategorie × Geschoss gives 158.
- **Environment.** Chromium headless with software WebGL; JS heap 68 MB after the run.
- **Method.** Measured from the click event to the table update (`__calc.table.at`, stamped by the update itself), and to the next frame. Each measurement starts from an idle 3D view. Values are medians of 3 runs.

| Action | Click → table updated | Click → next frame | Table work |
|---|---|---|---|
| `Gruppiert` (from single view) | 22 ms (max 28) | 43 ms | 16–24 ms |
| back to `Einzelelemente` | 8 ms | 27 ms | 2–3 ms |
| level 2 = Geschoss (dialog entry click) | 23 ms (max 26) | 29 ms | 15–22 ms |
| remove level 2 | 12 ms | 28 ms | 8–11 ms |
| `Alle aufklappen` (31,089 rows) | 11 ms | 27 ms | 2–12 ms |
| `Alle zuklappen` | 5 ms | 28 ms | 2–3 ms |
| Kategorie filter-set click (grouped) | 21 ms (max 24) | 45 ms | 6–21 ms |
| sort numeric ascending (groups by sums) | 42 ms (max 56) | 62 ms | 38–51 ms |

- **Asserted:** every action's click → table updated < 500 ms, and every action except the filter click also click → next frame < 500 ms.
- **Not asserted:** the frame after a filter click. It can include the 3D redraw of 30,000 elements, which is the end-to-end NFR-001 measurement of TASK-010.
- **Measurement fix.** At first, `updated` was taken when a polling `page.evaluate` ran. A long 3D frame still pending from the previous filter click delayed that call, giving up to 1.5 s with a table part of 21 ms. Now the time is stamped by the table update itself (`table.at`), and each measurement waits for an idle 3D view first.

## Reference data and fixtures (no value typed by hand)
- `scripts/ref/derive-reference.mjs` adds two sections, both derived from the STEP text:
  - `REQ-006-grouping-fzk`: AC20-FZK-Haus by Kategorie, then Geschoss. Per group: count, `BaseQuantities.NetVolume` sum (Neumaier, rounded to 12 digits, `null` = no value), and the common Geschoss / Name / Typ (`null` = differs or empty). Per Geschoss sub-group: count, volume and common Typ.
  - `REQ-006-grouping-duplex`: the Duplex fixture by Material (multi-valued). Per material and Kategorie: count and `PSet_Revit_Dimensions.Volume` sum. Also the totals by Kategorie (each element once) and the number of elements with several materials (80).
  - Tests leave out the classes the extractor does not list as rows (`IfcOpeningElement`).
- The 5,000-group fixture is built in memory (`test/support/many-groups-fixture.mjs`, deterministic GlobalIds via `ifcGuidFromSeed`). No binary is committed, and its expectation comes from the reference parser.
- `node scripts/ref/derive-reference.mjs --check`: up to date.

## Commands run and results
- `node scripts/check.mjs`: all steps green (format, lint, cdn-cache, test_fast).
  - 85 `[unit]` tests pass; c8 cv-core 100 % lines / 93.42 % branches.
  - 17 `@integration` pass on http.
- `npx playwright test test/e2e --project=http`: 45 passed. `--project=file`: 45 passed.
- `npx playwright test test/acceptance test/integration`: http 21 passed, file 21 passed.
- Perf, file project, run one at a time:
  - `test/perf/table.spec.mjs` + `test/perf/grouping.spec.mjs` passed.
  - `test/perf/view-3d.spec.mjs` + `test/perf/load-100mb.spec.mjs` passed.
  - `node --test 'test/perf/**/*.test.mjs'`: 1 passed.
- **Not run:** a single full `npx playwright test` / `node scripts/check.mjs --all`. The tool limit is 10 minutes per command, so the suites were run in the parts above, covering every spec file.
- **Screenshots** in `/tmp/claude-0/-home-user/b4080e59-f4c4-52f1-9269-192eeef60a44/scratchpad/task006b-shots/`:
  - `01-grouped-1280.png`: 1280×800, FZK + Duplex, Kategorie × Geschoss, wall → Erdgeschoss expanded, NetVolume first, total row.
  - `02-grouped-1920.png`: 1920×1080.

## Deviations / interpretations
- **Default grouping.** Switching to `Gruppiert` without a chosen property groups by `Kategorie`. The spec says the user chooses; a grouping view without groups would show nothing useful. The user changes it with `Gruppe 1`.
- **`Gruppe` and `Anzahl` are fixed columns.** Their width is fixed, and they are not sortable, filterable or movable. Sorting groups uses the shared sort of the visible columns (REQ-006-AC5: groups by their sums), so the sort part of the configuration stays `{ key, dir }` of a real column.
- **`(leer)` stays last** even when groups are sorted by a column (spec: "(leer), sorted last"). Groups whose sort cell is empty come after the others in both directions, like empty values.
- **Text cells of the total row stay empty.** The spec names only `Anzahl` and the sums for it. Numbers with unit `gemischt` get neither a sum nor a common value (DEC-2).
- **Expanded state.** It is kept across filter changes and view switches, and reset when the grouping properties change. `Alle aufklappen` opens both levels down to the elements.
- **Grouping configuration seam.** It is separate from `tableState()`: `groupingState()` / `CalcTable.grouping()`. `tableState()` keeps its TASK-006a shape (an existing exact-equality test relies on it). TASK-007 saves both.
- **Group toggle.** Only the chevron toggles. A click elsewhere on a group row is reserved for TASK-006c (select all elements of the group, REQ-007).

## Open points
- **TASK-006c.**
  - Wire `start().onGroupClick(listener(id, keys))` to select all elements of the group.
  - For a 3D pick in the grouping view, open the containing groups (by group id path: `toggled`, or by setting the ids) and scroll the element row into view. Element rows carry `data-key`, and `__calc.table.display` gives positions.
- **TASK-007.** Save and load `groupingState()` / `setGroupingState()` together with `tableState()`. Unknown keys are skipped by `normaliseGrouping` and should be named in the notice (REQ-009-AC2).
- **TASK-008.** Export the grouping view from `__calc.table.display` (or `groupDisplayRows` on the same tree) and `table.total`:
  - `Ebene` = group level, or `Element` / `Summe`.
  - Unrounded `cells` give the sums.
  - Element rows use the row values.
- **TASK-010.** End-to-end NFR-001 including the 3D frame after a filter click in the grouping view. The table part measured here is ≤ 56 ms.

## Fix pass (independent verification: FAIL)
**Blocking defect: `test/perf/table.spec.mjs` failed at `expect(m.updated).toBeLessThan(500)`.** The verifier measured 607 ms with `grouping.spec`, and 690 ms when run alone.
- **Cause: the test's measurement, not the product.** Its `measure()` read `performance.now()` after a `requestAnimationFrame` poll, with no idle wait first. So a long 3D frame drawn after the click (software WebGL, 30,000 elements) counted as table time. The verifier measured the update itself at 4–6 ms. `test/perf/grouping.spec.mjs` already had the fix, but `table.spec.mjs` had not been changed. My earlier report said both passed; that pass did not reproduce.
- **Fix:** the measurement now lives in one shared helper, `test/support/perf-measure.mjs` (`measureInput`). It waits for `idle`, records the click `timeStamp`, and takes `window.__calc.table.at`, which the table update stamps itself. Both `test/perf/table.spec.mjs` and `test/perf/grouping.spec.mjs` use it, so the two copies can no longer drift apart. No budget or assertion was changed, and the product was not changed.
- **Regression tests** are in `test/integration/perf-measure.spec.mjs` (`@integration`, both projects):
  - A 400 ms busy task is queued right after a `Gruppiert` / `Einzelelemente` click, the way a long 3D frame would arrive. The test asserts that the table update comes before the busy task and that the measured table time stays below 400 ms. The old poll would have read the time only after the busy task. Passed with `--repeat-each=3`.
  - A source guard over `test/perf/*.spec.mjs`: no perf spec polls `__calc.table.updates` itself or sets `updatedAt = performance.now()`. A perf spec that measures table inputs must import the shared helper.

**Evidence**
- `CV_TEST_PORT=4331 node scripts/check.mjs`: all steps green, with 19 `@integration` tests on http, the 2 new ones included.
- `npx playwright test test/integration --project=file`: 19 passed.
- `npx playwright test test/perf/` (both projects; the perf specs skip `http` by design): 4 passed and 4 skipped, in 4.6 min. `table.spec.mjs` was run together with `grouping.spec.mjs`, and `table.spec.mjs` alone with `--workers=1 --project=file` also passed.
  - Grouping medians from click to table update: 4–37 ms.
  - Column-filter `updated` in `table.spec`: about 8–36 ms.
- `node --test 'test/perf/**/*.test.mjs'`: 1 passed.

**Non-blocking findings, not changed (both are product UX choices the spec does not decide)**
- At 1280×800 the grouped table shows about 6 body rows, because the second toolbar row (`Gruppe 1/2`) takes space. A layout change belongs with the UI review of TASK-010 or a later change.
- After switching back to `Einzelelemente`, the scroll position carries over from the grouped view. The spec does not say whether to keep or reset it, so this is recorded here as an open point and not changed without a decision.

## Orchestrator verification
- First independent verification: FAIL on one blocking item (perf measurement bug in `test/perf/table.spec.mjs`, product unaffected). Fix pass: shared `measureInput` helper plus regression tests. Recheck in fresh context: VERDICT PASS (ACs AC2, AC3, AC7, AC8, AC10, AC5 groups; e2e 90, acceptance+integration 46, perf 4/4 on file).
- Accepted own decisions: `Gruppiert` starts with Kategorie; `Gruppe`/`Anzahl` fixed; text cells in `Summe` empty; arrow toggles, row click left for TASK-006c; grouping state is a separate seam.
- Follow-ups (non-blocking): only ~6 body rows at 1280x800 in grouped view; scroll position carried over when switching views -> reset to top (TASK-006c).
- TASK-006b done.

## Verification INC-1 (2026-11-03)
- **UX M3, fixed in part:** in the grouping view `Gruppe` and `Anzahl` are pinned at the left edge while the table scrolls sideways (head, group/element rows and the total row; opaque in their row colour; `scroll-padding-left` keeps scrolled-to cells clear of them). Test: `@e2e @UI grouping view at 1280 x 800: Gruppe and Anzahl stay pinned ...` (`test/e2e/grouping.spec.mjs`). The `@REQ-006 switching views ...` drag test now collapses the details first so its drop target is not under the pinned columns.
- **Refinement, not changed:** quantity headers keep the spec's form `<Pset>.<Property> (<unit>)` (REQ-002-AC2, REQ-006-AC2), cut with an ellipsis at the default numeric width 150 px; the full header is the tooltip and the width can be changed (drag, keyboard). Shortening the header text would change baseline text; widening the default width would change saved default widths.
- Numeric group labels now use at most 3 decimals (spec §3.2; see TASK-004 Verification INC-1).
