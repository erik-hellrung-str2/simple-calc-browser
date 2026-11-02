---
id: TASK-006c
title: Selection in both directions (table row -> 3D + details, 3D pick -> marked and revealed table row incl. expanded groups, group row -> all its elements); follow-ups D-a, D-b, view-switch scroll reset
type: feature
status: done (verification pending)
implements: [REQ-007-AC2, REQ-007-AC3, REQ-007-AC1 (table side), REQ-007-AC4 (table side), REQ-007-AC5 (table side), REQ-007 text "clicking a group row highlights all its elements"]
relates_to: [NFR-001, DEC-16, TASK-005, TASK-006a, TASK-006b, TASK-010]
depends_on: [TASK-005, TASK-006b]
touches: [calc-viewer-builder.html (cv-css, cv-core-src, cv-ui-src, cv-3d-src, cv-app-src), eslint.config.mjs, scripts/ref/derive-reference.mjs, test/fixtures/reference-values.json, test/unit/grouping.test.mjs, test/support/selection.mjs, test/e2e/selection.spec.mjs, test/e2e/table.spec.mjs, test/perf/selection.spec.mjs]
---
# TASK-006c: Selection in both directions

## What was built

### cv-core (pure, unit-tested)
- `groupsOfRow(tree, rowIndex)`: the groups of a `groupRows` tree that contain a row. The order is depth first: each level-1 group, then its level-2 groups. A row with several values of a grouping property (DEC-16) is in several groups of one level, and all of them are returned. The app uses this to expand the groups of a picked element.

### cv-ui
- **Table (`createTable`).**
  - `setSelection(keys, groupId)` marks the rows of the selected element keys and the selected group row with class `cv-sel` and `aria-selected="true"`. The mark is applied in `render()`, so it follows the rows through scrolling, sort, column changes and the view switch.
  - Every row with the key is marked. In the grouping view an element of a multi-valued group appears more than once.
  - `reveal(index)` scrolls the least needed to show a display row fully between the sticky header and the sticky total row.
  - `scrollToTop()`.
  - **D-a.** A cell the row does not need any more is now parked. Before, it was only hidden: it kept its `data-col`, text and tooltip, so a removed column's values stayed in the DOM. Now the cell is hidden and loses `data-col`, `aria-colindex`, text and title. When the column set changes, the cells beyond the column count are removed from every pooled row (`trimCells`).
- **Details (`createDetails`).** `showGroup({ id, kicker, title, count, withoutGeometry })` shows the group selection:
  - kicker `Gruppe: <Ebene 1>[ / <Ebene 2>]`;
  - title = the group path (`IfcWallStandardCase / Erdgeschoss`);
  - `<n> Elemente ausgewählt`;
  - `Davon ohne 3D-Geometrie: <n>` when that applies;
  - the close button `Auswahl aufheben`.
  - `body.dataset.group` carries the group id.
- **CSS.** `.cv-tr.cv-sel` uses the accent at 14 % with a 3 px accent bar on the left. Hover does not override it. `.cv-det-count` is new.

### cv-3d
- `lastSelectedAt()`: the time (performance.now) when the last selection's highlight and reset calls were done. Used by the perf test.
- `camera()`: `{ position, target }` as arrays. A test seam to show that a selection does not move the camera.
- **`updateView` with no model left** no longer calls `fragments.update(true)`. That call waits for a tile FINISH that never arrives when no model is loaded (TASK-005 noted this for `removeModel`). The new robustness test found the hang: with a selection active, removing the last model clears the selection, `applySelection` calls `updateView(true)`, and the engine queue never finished, so `whenIdle()` waited forever. With no model, `updateView` now requests a plain update and a frame and resolves at once.

### cv-app (wiring)
- **Table row click** (`tableHandlers.rowClick`) calls `select(key)`: 3D highlight, details and the table mark. The table does not scroll, because the clicked row is already in view, and the camera does not move. The `start().onRowClick` listeners are called after it.
- **Group row click** (`tableHandlers.groupClick`, not the toggle) calls `selectGroup`:
  - every element of the group inside the filter is selected;
  - 3D highlights those with geometry;
  - the group row is marked;
  - the details show the group summary.
  - The `start().onGroupClick` listeners are called after it.
- **3D pick** (`onPick`), `CalcView.select(key)` and `start().select(key)` call `select(key, reveal = true)`:
  - In the grouping view, every group that contains the element is expanded (`groupsOfRow`, through the `toggled` set). With a multi-valued grouping property that can be several groups.
  - Then the first row of the element is scrolled into view (`reveal`).
- **Clearing.** `Esc` (not one a dialog handled), a click on empty space and the details close button all call `select(null)`. It clears the element or group selection on every side: 3D, details and the table mark.
- **The selection survives** sort, column add / move / remove, column resize, expand / collapse and the view switch, because marks are by key. A group row mark is shown only while the table shows the same grouping properties. A group id is a path of values, so under another grouping it would name a different group.
- **Filter and row-set changes** (`sync3d`, after every refresh, as in TASK-005):
  - A selected element that left the filter or the row set (model removed, IfcSpace option) is deselected on every side.
  - For a group selection, the elements that left are dropped. When none is left, the selection is cleared. A later filter change does not add elements back.
- **View switch and regrouping** (`setGroupingState`) reset the table scroll to the first row. This is the TASK-006b follow-up.
- **Seams.**
  - `window.__calc.view` gains `selectedGroup` (id or null) and `selectedKeys` (element keys of the selection). `selected` is still the single element key, and null for a group selection.
  - `CalcView` gains `selectGroup(id)`, `camera()` and `lastSelectedAt()`.
  - `CalcView.select` and `start().select` reveal the row like a pick.

## Tests

| AC / item | Test | Type | Result (file + http) |
|---|---|---|---|
| REQ-007-AC3, AC4 (table side), AC5 (both sides) | `test/e2e/selection.spec.mjs` `@REQ-007-AC3 @REQ-007-AC4 @REQ-007-AC5`. A real click on the reference wall's table row: `state().selected` = [wall], `__calc.view`, details (kicker, title, GlobalId from `REQ-007-selection`), exactly this row marked (class and aria-selected), camera unchanged. A slab row moves the selection. It survives sort asc/desc, adding `NetVolume`, removing `Geschoss` via the chooser, and `Gruppiert` -> `Einzelelemente`; the camera is still unchanged. The IfcVirtualElement row (`Geometrie` = `Nein`): details with the hint, nothing highlighted in 3D, the row marked. `Esc`, then an empty canvas click, each clear 3D, hook, details and table. | e2e, acceptance | pass |
| REQ-007-AC1 (table side), AC2 | `@REQ-007-AC1 @REQ-007-AC2`. Filter Kategorie = walls: 13 rows, more than fit in the table box. Pick positions are probed per element (projected box, as the TASK-005 AC1 test). With the table at its top, a real click on the last wall marks that row and scrolls it fully into view (precondition: not visible before). The same for the first wall with the table at its end. The camera does not move. Grouping view Kategorie then Geschoss, all collapsed: a click on the reference wall expands exactly `IfcWallStandardCase` and `IfcWallStandardCase / Erdgeschoss` (from the reference); the row is visible and the only one marked. An empty click clears the table side; the groups stay expanded. | e2e, acceptance | pass |
| REQ-007-AC2 + DEC-16 | `@REQ-007-AC2 DEC-16`. Duplex grouped by Material. Selecting the two-material wall `REQ-005-AC4` (CalcView.select, the pick path) expands exactly its two material groups. The element row appears under both, both rows are marked, and the first is visible. | e2e, acceptance | pass |
| REQ-007 group row (spec text; AC2/AC3) | `@REQ-007-AC2 @REQ-007-AC3`. Grouping Kategorie then Geschoss. A click on the `IfcWallStandardCase` group row: `state().selected` = the walls with a representation, `selectedKeys` = all 13 walls, the group row marked, details `Gruppe: Kategorie` / `IfcWallStandardCase` / `13 Elemente ausgewählt`. The group stays collapsed and the camera is unchanged. Expanded, its element rows are marked. The level-2 group `IfcWallStandardCase / Erdgeschoss` gives the 9 reference walls and the path title. An element row click replaces the group selection. With Geschoss = Erdgeschoss, the 13-wall selection shrinks to the 9; without the filter it stays at 9; with Geschoss = Dachgeschoss it is cleared on every side. `Esc` clears a group selection. | e2e, acceptance | pass |
| T7 robustness | `@robustness @REQ-007`: (1) a selected Duplex element, then Duplex removed: cleared on every side. (2) A selected FZK wall survives the removal of the other model. (3) Filtered out (Kategorie = IfcSlab): cleared; removing the filter does not bring it back. (4) Rapid clicks: 4 rounds over every fully visible row (at least 6), with `Esc` in between, end with the last row selected in 3D, hook, details and as the only marked row. (5) Removing the last model with a selection active leaves an empty builder with no error. Step 5 found the `updateView` hang described above. | robustness | pass (`--repeat-each=3`) |
| View switch scroll reset | `@e2e switching Einzelelemente / Gruppiert starts the table at its first row`: scrolled to the end, then `Gruppiert` -> top; `Alle aufklappen`, end, `Einzelelemente` -> top; a new level-2 grouping -> top. | e2e | pass |
| D-a | `test/e2e/table.spec.mjs` `@REQ-006-AC6 D-a`. Add `NetVolume`, then remove it via the chooser: no body cell carries its `data-col`, no row has more cells than columns, and no hidden cell has a column or text. Still true after scrolling through all rows. **Detects the defect:** with the old hide-only code the test fails (the removed column's key is still in the rows). | e2e | pass |
| D-b | `@REQ-006-AC9`: the bounds typed and the expected cell texts come from `REF["REQ-006-AC9"]`: the cells = `de3(byGlobalId[g])` of the expected GlobalIds, including both bounds; state bounds from `min` / `max`; the reopened popup shows `de3(min)` / `de3(max)`. No hand-typed values remain. | e2e, acceptance | pass |
| `groupsOfRow` | `test/unit/grouping.test.mjs` `[unit] REQ-007-AC2 groupsOfRow`: two levels, `(leer)`, multi-valued level 1 (both groups with their level-2 groups), a filtered-out row, empty tree, ids equal `allGroups`. | unit | pass |
| NFR-001 (selection) | `test/perf/selection.spec.mjs` `@perf @NFR-001 @REQ-007` (file project; numbers below) | perf | pass |

### Selection timing (volume set: Revit MEP + SampleCastle, 10,459 rows; T6)
- Setup as the TASK-005 3D perf test (software WebGL, 1440x900). The time is measured from the click event's `timeStamp`, as the median of 3.
- *applied* = `lastSelectedAt` (highlight engine calls done). *first* / *complete frame* = the first and last frame drawn because the view changed.
- Row clicks are on elements on screen with a projected box of at least 20x20 px, taken from three places of the table. Without this, an off-screen element's highlight draws no frame and there is nothing to measure; the first run saw that, and the test now requires a frame in every run.
- The group is `IfcMember` (1,459 elements, all with geometry).

| Run | Action | applied (ms) | first frame (ms) | complete frame (ms) | per run (ms) |
|---|---|---|---|---|---|
| spec alone | row click | 12.1 | 96.7 | 96.7 | 76 / 97 / 191 |
| spec alone | group row click | 16.3 | 80.7 | 413.1 | 472 / 413 / 386 |
| with view-3d perf | row click | 18.4 | 87.8 | 87.8 | 87 / 88 / 197 |
| with view-3d perf | group row click | 14.5 | 81.7 | 484.8 | 463 / 485 / 507 |

All medians are within 500 ms. The complete frame for a 1,459-element group highlight leaves little margin (one run 507 ms). It costs the same as a filter click of the same size: the TASK-005 3D perf test measured 481 ms in the same run. This is risk R-4 / D-c, which TASK-010 handles.

## Commands run and results
- `node scripts/check.mjs`: all steps green.
  - format, lint, cdn-cache.
  - test_fast: 86 unit tests pass; c8 cv-core 100 % lines / 93.48 % branches; 19 `@integration` on http.
- `npx playwright test test/e2e test/acceptance --project=http`: 56 passed (3.4 min).
- `npx playwright test test/e2e test/acceptance --project=file`: 56 passed (3.6 min).
- `npx playwright test test/integration --project=file`: 19 passed. `npx playwright test test/perf --project=http`: 5 skipped (perf runs in `file` only, by design).
- `npx playwright test test/perf/selection.spec.mjs test/perf/view-3d.spec.mjs --project=file`: 2 passed.
- `npx playwright test test/perf/table.spec.mjs test/perf/grouping.spec.mjs --project=file`: 2 passed.
- `npx playwright test test/perf/load-100mb.spec.mjs --project=file`: 1 passed.
- `node --test 'test/perf/**/*.test.mjs'`: pass.
- `npx playwright test test/e2e/selection.spec.mjs --project=file --repeat-each=3`: 18 passed.
- `node scripts/ref/derive-reference.mjs --check`: up to date.
- Embedded sources: ASCII only, checked for every `text/plain` script block.
- Screenshots at 1280x800 are in `/tmp/claude-0/-home-user/b4080e59-f4c4-52f1-9269-192eeef60a44/scratchpad/task006c-shots/`:
  - `01-row-selected`;
  - `02-group-selected`;
  - `03-pick-expands-groups`. The second, lighter row there is the mouse hover; the DOM has exactly one marked row.

## Changes to existing tests and reference data
- `test/e2e/table.spec.mjs` AC9 (D-b): hand-typed bounds and cell texts are replaced by values derived from `REF["REQ-006-AC9"]`. The assertions are as strict as before; `toContain` checks for both bounds were added.
- `test/e2e/table.spec.mjs`: new D-a test.
- `scripts/ref/derive-reference.mjs` + `test/fixtures/reference-values.json`: new section `REQ-007-selection`, derived from the FZK STEP text:
  - the GlobalIds of the `IfcWallStandardCase` group and of its `Erdgeschoss` sub-group, each with the ones that have a representation;
  - the reference wall #21966 with Kategorie / Geschoss / Name.
  - The meta `purpose` names REQ-007. No other section changed. No value was typed by hand.

- `eslint.config.mjs`: `.claude/` is now ignored, as it already is in `.prettierignore`.
  - **Why.** During this task a parallel agent's worktree appeared under `.claude/worktrees/` (the R-4 perf spike, a full checkout). ESLint linted its spike spec, which made `node scripts/check.mjs` red on code that does not belong to this checkout.
  - **Effect.** No file of this repository is excluded. The worktree itself was not touched.

## Deviations / interpretations
- **The camera never moves on a selection** (row click, group click, pick), as in the reference app. The reference has no zoom-to-element, and the spec does not ask for one. The user can still use `Ansicht einpassen`.
- **A row click does not scroll the table.** The row is already visible. A 3D pick and the API (`CalcView.select`, `start().select`) do reveal the row.
- **A 3D pick in the grouping view expands every group that contains the element.** With a multi-valued grouping property (DEC-16) these are all of its groups, and all its rows are marked. The table scrolls to the first one. Expanded groups stay expanded after the selection is cleared, because the user may want to keep them.
- **Group selection = the group's elements inside the current filter** (the rows the group counts). 3D highlights those with geometry. Elements without geometry are counted in the details (`Davon ohne 3D-Geometrie`).
- **Group selection and filter changes:** elements that leave the filter leave the selection. When none is left, the selection is cleared. Elements are never added back. This is the TASK-005 rule ("cleared when the element leaves the filter") applied per element.
- **Group details** show a summary (grouping properties, group path, count), not the elements' properties. The spec defines the details panel for one element only.
- **The group row mark** is kept only under the same grouping properties. After regrouping or in the single-element view, the selected elements stay selected and their rows are marked, but no group row is marked.
- **`__calc.view.selected`** is still the single element key, and null for a group selection. `selectedKeys` / `selectedGroup` are new. TASK-005 tests read `selected` unchanged.
- **The scroll reset** also applies to a new grouping property, not only to the view switch. A new grouping collapses every group (TASK-006b), so the old offset has no meaning.
- **NFR-001 for the selection.** NFR-001 names filter, sort, view switch and regrouping, not selection. The 500 ms budget was applied to the selection highlight as the closest target.

## Decisions to confirm
- **Group selection under a changing filter** (see above): the conservative reading. The selection only shrinks, and it is cleared when empty. The alternative would be to follow the group, so its current members are selected again after a filter change. That is not decided by the spec. It is a selection rule, not a business rule of the quantities.

## Open points
- **TASK-007.** The selection is not part of the configuration; REQ-009 does not list it.
- **TASK-010.**
  - A group highlight of about 1.5k elements draws its complete frame at 386–507 ms on the volume set in software WebGL. That is the same cost class as a filter click (R-4 / D-c). Optimise it together with the 3D frame at 30k.
  - With the stricter `updateView` (no fence without models), check that removing the last model during a running load still behaves.

## Orchestrator verification
- Independent verification in fresh context: VERDICT PASS (REQ-007-AC1..AC5 incl. group selection and multi-group expand, break attempts, visual review at both sizes, check and both projects green; one perf run over budget only under CPU load from the parallel spike, three isolated reruns passed).
- Decision to confirm (user): a group selection only shrinks when the filter changes and is cleared once empty.
- Follow-ups: R1 group highlight 365-592 ms for 1,459 elements (R-4 work); R2 `Esc` inside a filter search field also clears the element selection -> only clear the field (TASK-008 pass).
- TASK-006c done.
