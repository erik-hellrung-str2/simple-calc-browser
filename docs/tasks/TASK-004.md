---
id: TASK-004
title: Layout and filter area (screen layout, styles, virtualised value lists, filter sets with catalogue dialog, reset, status line); TASK-003 follow-ups D1/D4/D5/W1/W4; parallel-safe load-core
type: feature
status: done (verification pending)
implements: [REQ-003, REQ-004 (filter-set part), REQ-001-AC1 (Modell set), spec §2 User interface, §4.5]
relates_to: [NFR-001, DEC-14, DEC-17, UI-01, UI-02, T7, T10]
depends_on: [TASK-003]
touches: [calc-viewer-builder.html (cv-css, cv-core-src, cv-ui-src, cv-app-src), test/load-core.mjs, test/unit/core.test.mjs, test/unit/filter-engine.test.mjs, test/perf/filter-engine.test.mjs, test/e2e/smoke.spec.mjs, test/e2e/filter-area.spec.mjs, test/e2e/filter-robustness.spec.mjs, test/support/filter-area.mjs, test/support/xss-fixture.mjs]
---
# TASK-004: Layout and filter area

## (0) Test infrastructure: parallel-safe cv-core extraction
- **Problem.** `test/load-core.mjs` always wrote `.cache/cv-core.mjs`. Two test runs at the same time could import a file that the other run was still writing.
- **Fix.** The text is first written to a per-process temporary file, `.cache/.cv-core-<pid>-<random>.tmp`, and then renamed to `.cache/cv-core-<sha256 of the text, 16 hex>.mjs`.
  - The rename is atomic, so a run never sees a half-written file.
  - A different HTML version gets a different file name.
  - The temporary file is removed on exit.
  - Extracted files of other versions are pruned after one hour.
  - The blank-line padding is unchanged, so line numbers still equal the HTML lines.
- **Deviation from "per-process unique file".** The final file name is per content, not per process.
  - With a per-process name, c8 would report one partial entry per test process, about 5 files each with a fraction of cv-core covered. The 70 % gate applies to the total over all files, so those partial entries would pull it down.
  - With the content-addressed name, every process of one run writes the same file, so c8 merges the coverage into one entry. The check reports `cv-core-<hash>.mjs`: 100 % lines, 92.9 % branches.
  - The per-process part is the temporary file, and it is what makes the write race-free.
- `c8 --include='.cache/**'` (scripts/check.mjs, AGENTS.md §4 `test_fast`) still matches, so it is unchanged.
- **New `[unit]` test.** It checks the content-addressed name: the same HTML gives the same file, and another HTML gives another file. The line-number test now reads `corePath(html).path`.
- **Check.** Three `node --test 'test/unit/**'` runs at the same time: 63/63 pass in each.

## (1) TASK-003 follow-ups in cv-core
Each fix has a `[unit]` test that was run first and failed on the old code. The failures were: D1 `normaliseFilter` returned `min: 0` for `"  "`; D4 `isEmptyValue(NaN)` was false; D5 `checkedCount` was 2 for `["A","A"]`.

| Item | Fix | Test (`test/unit/filter-engine.test.mjs`) |
|---|---|---|
| D1 | `noBound` treats whitespace-only strings as no bound. Text bounds are converted with `Number()`, so `" 2 "` becomes 2. | `D1 DEC-17 whitespace-only range bounds mean no bound; bounds are trimmed` |
| D4 | `isEmptyValue` treats non-finite numbers as empty, and `compareValues` puts them last, equal to null. In the column build, NaN and ±Infinity get the empty code and `nums` = NaN, so they show as `(leer)`, are excluded by range bounds and sort last. `displayValue` and `sortByValue` follow the same rule. | `D4 non-finite numbers (NaN, Infinity) are empty values in compare, sort and facets` |
| D5 | `normaliseFilter` removes duplicate selection values, and `undefined` becomes `null`. `checkedCount` therefore counts distinct values, including values that are missing from the data. | `D5 a selection with duplicate values counts each distinct value once (checkedCount)` |
| W1 | The property test has 300 seeded cases (was 200). It now covers filters with their own ids (`col:A` next to the set `A`, and the facet `set:N`), `id`/`key`/`total`/`checkedCount` and the `checked` flag of every value. Bounds vary: null, `""`, whitespace, numbers, numeric text and inverted bounds. Cells include NaN/Infinity and `1` vs `"1"`. Sorting is checked on shuffled input in both directions on single, multi-valued and numeric columns, and must be stable. | `property check: filterRows, facetCounts and sortRows equal a naive implementation on 300 random cases` |
| W4 | The perf test title and comments now say "median of 9 warm passes (3 stores x 3 selections)". | `test/perf/filter-engine.test.mjs` |

**Defect found by W1, fixed.** A multi-valued cell with a repeated value, for example `["r","r"]`, sorted by `"r, r"` when the column was not single-valued, but by `"r"` when it was. `sortKeyOf` now sorts every cell by its distinct values joined with `, `, the same way the facets count it.

## (2) TASK-004: layout and filter area

### Layout (spec §2 User interface, §4.5; cv-css + cv-ui)
- **Header.**
  - Logo placeholder `#cv-logo`, a red tile with a cube icon. The real logo comes in TASK-007.
  - Title `#cv-title` with the date `#cv-date` below it (today, `de-DE`).
  - Builder buttons `IFC laden` (primary), `Konfiguration speichern`, `Konfiguration laden` and `HTML exportieren`. The last three stay disabled until TASK-007/009. The viewer mode leaves them out.
- **Columns.**
  - Filter area 280 px.
  - Centre: 3D view and table with a splitter `#cv-splitter`. The default split is 55/45 (`grid-template-rows: 55fr 6px 45fr`). It can be dragged with the pointer or moved with ArrowUp/ArrowDown (±5 %), clamped to 15–85 %.
  - Details 320 px, collapsible with `Details einklappen` / `Details ausklappen` to a 40 px strip.
  - Below 1280 px the side panels collapse (as before).
- **Status line.** `#cv-status` shows `X von Y Elementen` in German number format. `#cv-status-models` shows `1 Modell` / `N Modelle`.
- **Style (UI-02).**
  - The tokens on `:root` are exactly accent `#d72622`, ink `#35383a` / `#4e5355` / `#6b6f73` / `#a4a8ac`, backgrounds `#f4f5f6` / `#eceef0` and line `#e1e3e5`.
  - Font 13–14 px "Segoe UI"/system-ui; inline SVG icons.
  - Components follow the reference CSS (ref L1714-1938, L18-115): search field with an accent focus ring, link buttons, dialog with backdrop and shadow, check rows with `accent-color`.
- **Model list and option.** The model list and the option `Räume (IfcSpace) einbeziehen` moved from the header to the top of the filter area, next to the models they refer to. The header keeps the builder buttons only.
- **German UI texts.** All embedded source blocks are ASCII-only (`\u` escapes); the existing unit test checks this.

### Filter area (REQ-003, REQ-004)
- **Head.** `+ Filtersatz` (`#cv-add-filterset`) and `Alle Filter zurücksetzen` (`#cv-reset-all`). The reset button is disabled while no filter is active. It clears every filter-set selection; the table's column filters join this reset in TASK-006a.
- **Default sets.** A new configuration has the sets `Kategorie`, `Geschoss`, `Material` (`DEFAULT_FILTER_SETS` in cv-app). They are shown even before a model is loaded, with `Keine Werte.`.
- **Filter set (`.cv-fs[data-key]`).**
  - **Header.** Drag handle (the whole header is draggable), collapse toggle, title (catalogue label = property key), unit `(m)` for numbers, and a badge with the number of checked values. Then the buttons `Auswahl zurücksetzen: <Titel>`, `Filtersatz nach oben/unten: <Titel>` (disabled at the ends) and `Filtersatz entfernen: <Titel>`.
  - **Body.** A search field `Werte suchen` and a virtualised value list. Each row has a checkbox, a colour dot placeholder (`.cv-dot`, invisible until TASK-005 sets a colour), the value (numbers in `de-DE` format, `(leer)` in italics) and its count.
  - **Values and counts.** They come from `facetCounts`: the set's own selection is excluded, values with 0 hits are hidden, checked values with 0 hits stay (DEC-14), and `(leer)` comes last.
- **Reorder.**
  - Up/down buttons.
  - HTML5 drag and drop: dropping on the upper half of a set places the dragged set before it, the lower half places it after. The target set is marked with an accent line.
- **Collapse and remove.** Both are visible immediately. The state is in `window.__calc.filter.sets` (order, `collapsed`, `selected`), which is the part of the configuration TASK-007 saves (REQ-003-AC2). Removing a set drops its filter and calls `store.retain` with the keys in use.
- **Property catalogue dialog** (`role=dialog`, `Filtersatz hinzufügen`):
  - Search field `Eigenschaft suchen`; it matches the property key or the group, case-insensitive.
  - Entries are grouped in catalogue order: `Allgemein` first, then pset names and `Typ: <pset>`.
  - Each entry shows its element count from the catalogue. Properties that already have a set are disabled and marked `vorhanden`.
  - The list is virtualised. A footer reads `N von M Eigenschaften`.
  - Escape, the close button or a click on the backdrop closes it without adding anything. Choosing an entry adds the set at the bottom.
- **Virtualised lists (`createVirtualList`).**
  - A scroll box holds a spacer of the full height and a pool of absolutely positioned row nodes. Only the visible rows plus 6 overscan rows on each side exist (at most 24 per value list).
  - On scroll and on update, the pool rows only get new text and checkbox state; no nodes are created per value.
  - A change of one checkbox re-evaluates the filters and re-fills the pools (NFR-001: no rebuild of thousands of nodes).
  - Value lists are at most 10 rows high (26 px each). The catalogue list is 32 px per row.
- **Text only.** Every value from the model (values, property keys, pset names, file names) is set with `textContent` or as an attribute value, never as HTML. Icons are constant SVG markup.

### Filter evaluation and test hook (cv-app)
- **One store per row set.** Each `publish()` (load, remove, IfcSpace option) creates one column store (`createColumnStore(rows)`).
- **`refresh()` per change** runs `evaluateFilters` once, then `filterRows` and `facetCounts` for all sets. It then updates the filter area and the status line, and notifies the listeners.
- **Seams for TASK-005 and TASK-006a.** `start()` now also returns `filterView()` = `{ evaluation, indices, facets }` and `onFilterChange(listener)`. 3D coupling and table are not implemented here.
- **`window.__calc.filter`** = `{ sets, active, count, total, keys, facets, updates, lastMs }`.
  - `keys` are the row keys that pass all filters, in ascending row order.
  - `keys` and `facets` are lazy getters, built only when read, not on every click.
  - `window.__calc.layout` = `{ split, detailsCollapsed }`.

## Tests

| AC / NFR | Test | Type | Result (file + http) |
|---|---|---|---|
| REQ-003-AC3 | `test/e2e/filter-area.spec.mjs` `@REQ-003-AC3`: order of the sets; Kategorie counts equal `elementsInStepTextByKategorie` without openings; `(leer)` last; status line | e2e, acceptance | pass |
| REQ-003-AC1 | `@REQ-003-AC1`: catalogue grouped (`Allgemein`, then the first pset); the used entry is disabled with its count; search `Length` shows only matching keys; `BaseQuantities.Length` with its catalogue count is added at the bottom with unit `(m)`; its counts sum to all rows; Escape and close add nothing | e2e, acceptance | pass |
| REQ-003-AC2 | `@REQ-003-AC2`: up/down buttons (disabled at the ends), drag and drop before and after, collapse/expand (badge kept, `collapsed` in the configuration state), remove (filter dropped, all rows back) | e2e, acceptance | pass |
| REQ-004-AC1/AC2/AC3/AC4 (filter-set part) | `@REQ-004-AC1 @REQ-004-AC2 @REQ-004-AC3 @REQ-004-AC4`: the AC1/AC2 key sets equal `reference-values.json` (via `__calc.filter.keys`); the Kategorie list on the ground floor equals `kategorieCountsOnGroundFloor` plus the conditional IfcAnnotation; AC3 IfcStair stays checked with count 0 when the storey changes; `Alle Filter zurücksetzen` clears everything; status line at every step | e2e, acceptance | pass |
| REQ-001-AC1 (Modell set) | `@REQ-001-AC1`: FZK + Duplex; `Modell` set via the catalogue lists both names, FZK with the reference count 99 and Duplex with its row count; `2 Modelle`; filtering by Modell | e2e, acceptance | pass |
| Layout (§2 User interface, UI-02) | `@e2e @UI screen layout`: header parts and buttons, 280/320 px, details collapse to 40 px, splitter 55 % → drag to 30 % → ArrowDown, colour tokens, font, backgrounds | e2e | pass |
| Screenshots | `@e2e @UI the builder with FZK loaded and filters active` (`CV_SHOT_DIR=…` writes PNGs) | e2e | pass |
| NFR-001 / T7 large lists | `test/e2e/filter-robustness.spec.mjs` `@robustness @NFR-001`: fetched Revit MEP + SampleCastle (10,459 rows, catalogue 6,187 entries, Name 6,957 values). Catalogue < 60 row nodes, scroll to its end; Name set ≤ 24 row nodes; scroll to the last value 0.8 ms; search keystroke 4.0 ms; spacer equals the number of matches; checking a result applies in 9.8 ms (`lastMs`) | robustness | pass |
| T7/T10 no XSS | `@robustness @T10`: FZK copy built in memory (`test/support/xss-fixture.mjs`) with wall names `<img onerror>`, `<script>`, `& <b>` and pset name `<b onmouseover>`, file name `fzk-<img src=x onerror=alert(4)>.ifc`. Values, Modell, catalogue group and set title show the literal text; no img/script/b/i elements in `#cv-root`; `window.__xss` undefined; no dialog | robustness | pass |
| Smoke | `test/e2e/smoke.spec.mjs`: the status assertion now checks `99 von 99 Elementen` and `1 Modell`. The TASK-002 note said the `N Elemente in M Modell(en)` text would be replaced in TASK-004 | smoke | pass |

## Commands run and results
- `node scripts/check.mjs`: all steps green.
  - format, lint, cdn-cache.
  - test_fast: 63 unit tests pass; c8 cv-core 100 % lines / 92.94 % branches; 17 `@integration` tests pass on http.
- `npx playwright test --project=file`: 31 passed (3.4 min), including the 100 MB perf smoke.
- `npx playwright test --project=http`: 30 passed, 1 skipped (the perf test runs in `file` only) (2.4 min).
- `node --test test/perf/filter-engine.test.mjs`: pass, warm median 5.5 ms.
- Screenshots for the verifier are in `/tmp/claude-0/-home-user/b4080e59-f4c4-52f1-9269-192eeef60a44/scratchpad/task004-shots/` (01 catalogue search, 02 filters AC2, 03 checked zero AC3, 04 two models with the Modell set, 05 FZK loaded, 06 filters active with the Name set, 07 details collapsed).

## Deviations / interpretations
- **load-core.** The extracted file name is per content, not per process; the per-process part is the temporary file (see (0)).
- **Filter set id.** It equals the property key, so there is one set per property. The catalogue disables properties that already have a set. The table's column filters use their own ids (`col:<key>`, TASK-003).
- **Selections after removing a model.** They are kept as they are. A checked value whose rows were all removed stays checked with count 0 (DEC-14). Whether such values should be dropped on removal is left to TASK-006a, which implements REQ-001-AC3 in full.
- **Catalogue entry name.** Inside a pset group the entry shows the property name without the pset prefix (the group header shows the pset). The full key is in the tooltip, the accessible name and `data-key`. The filter set title is the full key, `BaseQuantities.Length` (REQ-003-AC1).
- **Model list and IfcSpace option.** They moved from the header to the filter area (see Layout); `#cv-opt-spaces` and its label are unchanged.

## Open points
- TASK-005: colour the `.cv-dot` (the virtual list's `updateRow` reads `item.colour`). Couple 3D through `onFilterChange` / `filterView().indices`.
- TASK-006a: the table follows `filterView().indices`. Column filters join `refresh()` (ids `col:<key>`) and `resetAll`.
- TASK-007: save and restore `__calc.filter.sets` (order, collapsed, selected), plus title, date and logo in the header placeholders.
- TASK-010: measure NFR-001 end to end at 30k rows in Chromium. Here: 9.8 ms per filter click at 10k rows with a 7k-value Name set.

## Independent verification (orchestrator record, 2026-11-02)
Verdict: all TASK-004 acceptance items PASS (fresh context; visual review at 1280x800 and 1920x1080 against UI-02; usability and performance probes). FAIL only on tooling: two checks started at the same moment collide on c8 `coverage/tmp` (A1).
Follow-ups (fix pass before TASK-005): A1 per-run c8 temp/report dirs; W1–W4 replace product-vs-product assertions by reference-derived values; V1 disable `calt` on data text (`2x3` shown as `2×3`); V2 style search clear button; drag auto-scroll of the filter panel. P1 (3D renders every frame, ~300 ms per frame headless) → render on demand in TASK-005; NFR-001 tests measure until the next drawn frame.
