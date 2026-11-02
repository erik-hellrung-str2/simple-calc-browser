---
id: TASK-003
title: Filter engine (lazy column store, OR/AND, facet counts with hidden and checked-zero values, column filters, sorting)
type: feature
status: done (verification pending)
implements: [REQ-004 (logic), REQ-006 (filter/sort logic)]
relates_to: [REQ-002-AC4, DEC-5, DEC-14, DEC-17, NFR-001]
depends_on: [TASK-002]
touches: [calc-viewer-builder.html (cv-core-src only), test/unit/filter-engine.test.mjs, test/perf/filter-engine.test.mjs, test/integration/fzk-rows-snapshot.spec.mjs, test/fixtures/fzk-rows.snapshot.json]
---
# TASK-003: Filter engine

## What was built (cv-core, pure, no DOM; appended after `buildCatalog`)

- **Column store (spec 4.3).** `createColumnStore(rows)` builds columns lazily: only the properties asked for (filter set, column filter, sort key; later grouping and colouring) get a column.
  - A column is dictionary-coded. `values` holds the distinct values in facet order, with the empty value `null` as the last code (`emptyCode`). Rows are stored as offsets (`start`) into `flat` codes, which covers multi-valued cells. `single` marks columns with one code per row, which gives a fast path. `nums` (Float64Array, NaN = no number) is used for range filters.
  - Filter bitsets are `Uint32Array`, one bit per row, one per active filter selection. They are cached on the column by selection signature, at most 16 per column.
  - The store keeps columns cached. `retain(keys)` drops every column not in use. A new store is created whenever the row set changes (load, remove, IfcSpace option).
  - Interpretation: "value bitsets" are kept per active selection, not per distinct value. Per-value bitsets for a ~30k-value `Name` property would need ~110 MB (30k × 30k bits). A selection bitset is built in one O(n) scan over the codes.
- **Filters.**
  - `{ id?, key, type: 'values', values }` is a filter set or a text column checklist: OR within it, `null` = `(leer)`. A multi-valued cell matches if any of its values is checked.
  - `{ id?, key, type: 'range', min, max }` is a numeric column filter: inclusive bounds; `null`, `""` or NaN mean no bound; empty or non-numeric cells are excluded while a bound is set (DEC-17).
  - All filters combine with AND. `id` defaults to `key`. A column filter on the same property as a filter set uses its own id, for example `col:Name`.
  - `normaliseFilter` and `activeFilters` drop filters that restrict nothing (reset = no active filters).
- **`evaluateFilters(store, filters)`** builds the masks once. It computes prefix/suffix ANDs, so that `pass` (all filters) and `except(id)` (all filters but one) each cost O(k·n/32) word operations.
- **`filterRows(store|rows|evaluation, filters)`** returns the ascending row indices (`Uint32Array`) of the rows that pass.
- **`facetCounts(store|rows|evaluation, filters, facets)`** returns `Map id → { id, key, total, checkedCount, values: [{ value, count, checked }] }`. It works as follows:
  - Each facet is counted under all active filters except the one with its own id (REQ-004).
  - Values with count 0 are hidden, except checked values. Checked values stay with count 0 (DEC-14), including checked values missing from the data, for example from a configuration.
  - A multi-valued cell counts once per distinct value.
- **Value order: `compareValues`.**
  - Numbers sort numerically, before texts.
  - Texts sort with `Intl.Collator("de")`, then by code units, so the order is total.
  - `null` comes last.
  - `1` and `"1"` are different values. Numeric-looking text stays text (DEC-5).
- **Sorting.** `sortRows(store, indices, {key, dir})` handles both directions:
  - Numbers sort numerically. Texts sort alphabetically. A multi-valued cell sorts by its displayed text (joined with `, `).
  - Empty values come last in both directions. The sort is stable (ties keep the given order).
  - The sort key is built once per column.
- **`sortByValue(items, valueOf, dir)`** uses the same rules for arbitrary items, for example group rows by their sums (REQ-006-AC5, used by TASK-006b).
- **Helpers:** `EMPTY_LABEL = "(leer)"`, `isEmptyValue`, `displayValue`, `bitsToIndices`.
- cv-core stays ASCII-only and contains no `</script>` (a unit test checks this). Nothing is wired into the UI yet; TASK-004 does that.

## Tests

- `test/unit/filter-engine.test.mjs` contains 19 `[unit]` tests.
  - **Real data.** The input rows are the builder's AC20-FZK-Haus rows from `test/fixtures/fzk-rows.snapshot.json`. All expected key sets and counts come from `reference-values.json`.
    - REQ-004-AC1: the key set matches.
    - REQ-004-AC2: the key set matches; the Kategorie facet on the ground floor equals `kategorieCountsOnGroundFloor` plus the conditional IfcAnnotation (a row class); the Geschoss facet is counted under the Kategorie filter.
    - REQ-004-AC3: IfcStair is checked and the upper storey is selected, so its count is 0; it stays checked, and the other zero values are hidden.
    - REQ-004-AC4: after a reset, all rows are back and the Kategorie counts equal `elementsInStepTextByKategorie` without IfcOpeningElement.
    - REQ-006-AC4: a column filter on Name matches one reference element.
    - REQ-006-AC5: sorting by NetVolume puts the values in order with empty values last.
  - **Synthetic.**
    - REQ-006-AC9 range bounds: 2 and 5 are in; 1.9, 5.1 and empty values are out; one-sided, text and inverted bounds are covered.
    - The text column checklist works, including combined with AND.
    - `sortRows`: numbers, German text, mixed number and text, multi-valued cells, stability.
    - `sortByValue` for group sums.
    - Multi-valued Material (REQ-002-AC4): matches if any value is checked, counted once per value, duplicates inside a cell ignored.
    - Value order and `(leer)` last.
    - Own selection excluded; each set excludes only its own selection.
    - Number and text identity: `1` and `"1"` are different values.
    - Column store: lazy, cached, `retain` drops columns, bounded bitset cache, dictionary layout.
    - Edge cases: no rows, a single row, everything filtered out, an unknown property, an array holding only empty entries, inert filters, facet ids.
  - **Property-based style.** 200 seeded random cases compare `filterRows`, `facetCounts` (values, order, counts, checked zeros) and the descending sort with a naive reference implementation.
- `test/integration/fzk-rows-snapshot.spec.mjs` (`@integration`, part of test_fast) checks that the committed snapshot equals the live extraction (11 properties per row, rows sorted by GlobalId), so the unit-test input cannot drift silently. To regenerate it: `CV_WRITE_SNAPSHOT=1 npx playwright test fzk-rows-snapshot --project=http`.
- `test/perf/filter-engine.test.mjs` (`[perf]`) uses 30,000 synthetic rows and 6 filter sets: Modell, Kategorie, Name with 30,000 distinct values, Geschoss, Material (multi-valued) and Typ. It also has a 2,000-value Name selection and a NetVolume range filter.
  - A facet pass = `evaluateFilters` + `filterRows` + `facetCounts` for all 6 sets.
  - **Acceptance:** the median of 9 passes (3 stores × 3 changed selections, so the bitsets are rebuilt) must be ≤ 50 ms.
  - **Regression guard, not the acceptance target:** the cold pass also builds the 7 columns from the rows; its median of 3 must be ≤ 250 ms.

## Commands run and results

- `node scripts/check.mjs` is green:
  - format, lint and cdn-cache pass;
  - test_fast: 59 unit tests pass, cv-core coverage is 100 % lines / 92.33 % branches, and 17 Playwright `@integration` tests pass on http.
- `node --test --test-name-pattern='\[perf\]' 'test/perf/**/*.test.mjs'` passes. Typical numbers on the Intel Xeon @ 2.10 GHz container, Node v22.23.4, with other test runs in parallel:

| Measurement | Result |
|---|---|
| Facet pass (warm) | median 5–6 ms (range 3–12 ms) |
| Cold pass incl. column build | median 45–92 ms; first run 90–200 ms (JIT) |
| Cold sort of 30k rows by a numeric column | 20–30 ms |
| Heap used | ~28 MB |

## Deviations / interpretations

- Bitsets are kept per active selection, not per distinct value (see the column store above). This keeps memory at O(n/32) per active filter.
- When the cold column build (one-off, the first time a property is used) is counted, the pass can exceed 50 ms on this machine. The TASK-003 target is met by the facet pass itself. The cold path counts against NFR-001's 500 ms end-to-end budget, which TASK-010 measures in Chromium.
- Text order uses German collation (`Intl.Collator("de")`, no numeric option): `"10"` comes before `"9"` as text. Numbers in number cells sort numerically.

## Open points

- None blocking. TASK-004 and TASK-006 wire the engine into the UI. They should create one store per row set, call `retain` with the keys in use after configuration changes, and run `evaluateFilters` once per update for the table, the facets and 3D.

## Independent verification (orchestrator record, 2026-11-02)
Verdict PASS (fresh context; 10,000 random cases vs. a spec-only reference implementation identical; warm facet pass 5.8–7.2 ms median at 30k rows; cold first pass 51–64 ms incl. column build, counted under NFR-001 / TASK-010).
Follow-ups assigned (low severity):
- D1 whitespace range bound becomes 0 → trim in `normaliseFilter` — TASK-004 (cv-core)
- D2 German decimal comma in range bounds → parse in the column-filter UI — TASK-006a
- D3 `""` in a saved selection must map to `null`/`(leer)` → `applyConfig` — TASK-007
- D4 NaN cells break ordering → treat non-finite numbers as empty in compare/sort — TASK-004 (cv-core)
- D5 `checkedCount` counts duplicate missing values → dedupe selection — TASK-004 (cv-core)
- W1/W4 repo tests: strengthen the property test (ids, checked/total, stability, more bounds) and fix the perf test title — TASK-004
