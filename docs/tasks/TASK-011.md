---
id: TASK-011
title: "Core: rule, search and key-set filters, mark mask, display-text index; facet counts under them"
type: feature
status: implemented (awaiting orchestrator verification)
implements: [REQ-012 (logic of AC3-AC9), REQ-013 (key-set logic), REQ-004-AC5 (logic), DEC-18 (core part), DEC-19, spec 4.3 filter sources and display-text index, spec 4.4 CalcCore additions]
relates_to: [CR-002, INC-2, REQ-004, REQ-012, REQ-013, DEC-14, DEC-18, DEC-19, DEC-20, NFR-001, R-5, TASK-011a, TASK-012, TASK-015a, TASK-015b, TASK-017a, TASK-020]
depends_on: [TASK-011a]
touches: [calc-viewer-builder.html (cv-core-src only), test/unit/rules.test.mjs, test/perf/rules.test.mjs, test/perf/text-index.spec.mjs, docs/testing/traceability.md]
---
# TASK-011: Core filter sources of CR-002

Spec §5 acceptance: `[unit]` tests per action × comparison × kind (text, number display text `0,3` / `1.234,5`, multi, bool `Ja`/`Nein`, empty and missing), `Freie Textsuche` vs search, include/exclude key sets, mark mask, facet counts and DEC-14 under rules and key sets (REQ-012-AC5 and REQ-004-AC5 logic; these unit tests cite UI-level ACs in a comment only, T5); `[perf]` micro-benchmarks at ≥ 30k rows: `Enthält` on `Name` ≤ 50 ms, search over all properties ≤ 100 ms after the index is built, index build ≤ 2 s and ≤ 150 MB extra heap at 30k rows, index build time and heap on the 6,859-property model recorded.

## What was built (cv-core only; pure, no DOM; new section after `sortByValue`)

- **New filter types** in `normaliseFilter` / `evaluateFilters` / `filterRows` / `facetCounts`. Each one is one row mask, so facet counts are computed under it and DEC-14 holds unchanged (spec 4.3):
  - `{ type: 'rule', id?, mode, key, op, value }`:
    - `isolate` keeps the matching rows, `hide` removes them, `text` (`Freie Textsuche`) keeps rows where some value of some property matches.
    - A `mark` rule is no filter source (`normaliseFilter` returns null); an invalid rule (see `normaliseRule`) is ignored.
    - Default id `rule␁<mode>␁<op>␁<key>␁<value>`, so it never collides with a filter-set id. Two equal rules give the same filter (AND is idempotent).
  - `{ type: 'search', id?, text }`: contains over every value of every property. The text is trimmed (as ref L1465); blank = no filter. Default id `search`.
  - `{ type: 'keys', id?, mode: 'include' | 'exclude', keys }` (DEC-18): `include` = isolated set (`keys` null = no isolation; an empty set keeps nothing), `exclude` = hidden set (empty = no filter). `keys` is any iterable of element keys; unknown keys are ignored. Default id `keys:<mode>`.
- **Matching (DEC-19)**:
  - `displayText(value, entry)` gives the text as the table shows it: `formatCell`'s cached `Intl.NumberFormat("de-DE", {maximumFractionDigits: 3})`, booleans `Ja` / `Nein`, multi-values joined with `, `. `valueTexts(value)` gives one text per value.
  - `matchText(text)` = `toLowerCase()` with C0/C1 control characters replaced by a space.
  - `textMatches(text, op, needle)` implements `eq` / `starts` / `ends` / `contains` (ref `textMatches`).
  - A property rule is evaluated once per distinct value of its column (dictionary codes, match texts cached on the column) and then mapped to the rows. The empty value never matches.
  - Masks are cached per op and needle on the column (16 per column, as filter-set masks).
- **Display-text index (spec 4.3)** lives on the column store, so it is dropped with the store when the row set changes. A new store is already created on load, remove and IfcSpace switch (builder L9427).
  - One string per row: `␁` + the match texts of all non-empty values (each multi-value on its own) joined by `␁` + `␁`. Property names are not included.
  - `text` rules and the search use `includes` with the separator patterns of spec 4.3. Their masks are cached on the store (16).
  - `store.buildTextIndex({ chunkRows, pause })` builds in chunks of 2,000 rows (`TEXT_INDEX_CHUNK_ROWS`), awaiting `pause(fraction)` after each chunk (the exporters' convention, for the progress overlay). Concurrent calls share one build.
  - `store.textIndex()` builds synchronously if needed. This is the fallback when a text filter is evaluated before the async build. A chunked build that finds a synchronous one done stops and returns it.
  - `store.hasTextIndex()` tells cv-app whether the progress overlay is needed.
  - Keystrokes during a build: cv-app restarts the debounce and applies only the latest text. The core has no stale state to discard: masks are keyed by needle.
- **`store.rowOf(key)`**: element key → row index, built on the first key-set filter.
- **`markRows(source, rules, within)`**: bitset of the rows matching ANY `mark` rule; other actions and invalid rules are ignored. `within` restricts it to the shown rows (`evaluateFilters(...).pass`).
- **Constants and helpers for the UI tasks**:
  - `RULE_MODES` (`isolate` / `hide` / `mark` / `text` with `Isolieren` / `Ausblenden` / `Markieren` / `Freie Textsuche`) and `RULE_OPS` (`eq` / `starts` / `ends` / `contains` with `Gleich` / `Beginnt mit` / `Endet mit` / `Enthält`), in the reference order (ref L224-225).
  - `RULE_ANY_PROPERTY` = `Beliebige Eigenschaft`, `MARK_COLOUR` = `#f08a87`, `TEXT_SEPARATOR` = `\u0001`.
  - `normaliseRule(rule)`: the DEC-20 rule shape — mode, op, value a non-empty string, key a non-empty string except for `text`, where the key becomes null.
  - `describeRule(rule, catalog)` → `{ mode: <Aktion>, text: <Eigenschaft> <vergleich> „<Wert>“ }`. The comparison is in lower case, `Freie Textsuche` shows `Beliebige Eigenschaft`, and the label comes from the catalogue (the key when not loaded).
- The ASCII-only rule of embedded sources holds: `\u` escapes only, checked by the existing `[unit] cv-core stays ASCII-only …` test.
- No existing function changed behaviour for the existing filter types (`values`, `range`). The 1.0.0 UI is unchanged: cv-app does not pass the new types yet (TASK-015a/b, TASK-017a).

## Tests

All test titles carry no AC ID (spec Testing T5: unit tests of UI-level ACs cite them in comments only). So `INC2_PENDING` in `test/unit/trace.test.mjs` is **unchanged**: no AC is fully verified at UI level by this task. `docs/testing/traceability.md` was regenerated (new test count only).

Expected values are hand-derived from the synthetic rows (table in the test file), taken from `reference-values.json` (counts from the STEP text), or computed by a naive oracle in the test (per row and value with `toLocaleString`, no index, no column store).

`test/unit/rules.test.mjs` (41 tests):
- `[unit] rule <key> <op> "<value>" x Isolieren / Ausblenden / Markieren: <why>` — 27 matrix cases. Each checks that `isolate` keeps exactly the matching rows, `hide` keeps the complement (rows without the property included), and `mark` filters nothing and marks exactly the matching rows. Kinds covered:
  - text: case, prefix/suffix, umlaut, HTML text;
  - number display text: `0,3` vs `0.3`, `1.234,5` vs `1234,5`, 3 decimals, negative;
  - multi-values: any value, not the joined text;
  - bool: `ja` / `NEIN`;
  - control character in a value; unknown property.
  
  (REQ-012-AC5 logic)
- `[unit] rule: a row without the property or with an empty value never matches, so Isolieren removes it and Ausblenden keeps it (DEC-19)`
- `[unit] Freie Textsuche: some value of some property matches the comparison; property names are not matched` (REQ-012-AC6 logic)
- `[unit] search field: contains over every value of every property, case-insensitive, trimmed; blank = no filter` — also compares `Freie Textsuche` with the search (REQ-012-AC7 logic, REQ-012-AC13 umlauts and literal HTML text)
- `[unit] display text (DEC-19): numbers as the table shows them, booleans Ja / Nein, multi-values per value`
- `[unit] display-text index: one lower-cased string per row, values enclosed by the separator, built lazily`
- `[unit] display-text index: chunked build with pause(fraction) per chunk; concurrent calls share one build`
- `[unit] key sets (DEC-18): exclude = hidden set, include = isolated set; shown = isolated minus hidden, AND with every filter` (REQ-013-AC2..AC4 logic)
- `[unit] rules combine with AND with each other and with filter sets, column filters and key sets` (REQ-012-AC8 logic)
- `[unit] mark mask: rows matching ANY mark rule, restricted to the shown rows; colour constant` (REQ-012-AC9 logic)
- `[unit] rule validity (DEC-20 rule shape): mode, op, non-empty string value, key except for Freie Textsuche`
- `[unit] rule labels and row text: the four actions and comparisons of the reference; describeRule` (REQ-012-AC2 option lists, AC3/AC6 row texts)
- `[unit] FZK-Haus: rule Isolieren Kategorie enthält wall keeps the walls; facet counts and DEC-14 under rules and key sets` — on the FZK rows snapshot (REQ-012-AC3 and REQ-004-AC5 logic):
  - 13 walls = `elementsInStepTextByKategorie`;
  - the Kategorie set lists only `IfcWallStandardCase` 13, then 12 with one wall hidden;
  - `IfcSlab` checked before the rule stays checked with count 0;
  - the Geschoss counts under the rule equal `elementsByGeschossAndKategorie`;
  - 2 isolated walls count 2.
- `[unit] FZK-Haus: Markieren Kategorie gleich IfcSlab marks the slabs and changes no row`
- `[unit] FZK-Haus: every action x comparison on Name, Material, Geschoss, Kategorie and Freie Textsuche equals a naive oracle` — 156 rule cases plus 13 searches.

`test/perf/rules.test.mjs` (Node, 30,000 synthetic rows with 8 special properties and 40 sparse pset properties each, median of 9):
- `[perf] TASK-011 at 30k rows: rule Enthält on Name <= 50 ms, search and Freie Textsuche <= 100 ms after the index, index build <= 2 s and <= 150 MB extra heap`

`test/perf/text-index.spec.mjs` (Playwright, `file` project only, as every perf spec; perf-lock):
- `@perf display-text index on real models: build time and heap per fetched model (incl. the model with the most properties) and on the volume set within 2 s and 150 MB`
- It loads SampleCastle, Revit MEP, Revit ARC and Duplex MEP, plus 3 more Revit MEP copies.
- It imports the builder file's cv-core into the page as a Blob module and builds the index chunked, with a `setTimeout` yield per chunk, over `window.__calc.rows`.
- Heap = CDP `Runtime.getHeapUsage` after `HeapProfiler.collectGarbage`.

## Results (2026-11-04; Intel Xeon 2.80 GHz, 4 cores, Node v22.23.4, Chromium 153, headless)

| Measurement | Result | Target | Met |
|---|---|---|---|
| Node: rule `Enthält` on `Name`, 30k rows, Name column in use | median 2.6 ms (cold, incl. one-off Name column build: 155 ms, guard 250 ms) | ≤ 50 ms | yes |
| Node: search over all properties, index built | median 12.2 ms | ≤ 100 ms | yes |
| Node: `Freie Textsuche` `Gleich`, index built | median 13.2 ms | (≤ 100 ms, same path) | yes |
| Node: index build, 30k rows | median 565 ms (495-700); 16.1 M characters | ≤ 2 s | yes |
| Node: index extra heap, retained after GC | 14.1 MB (26.6 MB before GC, incl. garbage) | ≤ 150 MB | yes |
| Browser: SampleCastle (3,635 rows, **6,106 distinct properties**, the model with the most) | build 160-194 ms, +1.9-2.9 MB retained, peak page heap 40-50 MB, search 1.3-2.5 ms, no error or crash | recorded, no crash | yes |
| Browser: Revit MEP (6,824 rows, 102 properties) / Revit ARC (454, 109) / Duplex MEP (926, 463) | 39-43 / 3 / 20-40 ms; +1.8 / 0.2 / 0.9 MB | recorded | – |
| Browser: volume set (4 × Revit MEP + SampleCastle, 30,931 rows, 6,186 properties) | build 292 ms, +10.2 MB retained, peak page heap 64 MB, search 3.9-5.3 ms | ≤ 2 s, ≤ 150 MB | yes |
| Browser: everything loaded (32,311 rows, catalogue 6,655 entries) | build 342 ms, +11.2 MB | recorded | – |

Two runs of the browser spec. The first run had only the four spike models; the second run, recorded above, used the final spec. NFR-001 end to end (from the `Anwenden` click or the end of the debounce until table, filter sets and 3D show the result) is TASK-020's. These core numbers leave most of the 500 ms for the 3D frame. Free text over all properties (DEC-19) meets its targets, so no trade-off question arises (CR-002 §8, R-5).

## Decisions (for the release gate / orchestrator)

1. **"The 6,859-property model" is SampleCastle.**
   - Spike §4.8 named no file. Of the four fetched spike models, SampleCastle has by far the most properties: 6,106 distinct keys in today's rows, versus 102-463 for the others.
   - The spike's figure 6,859 was counted by the spike script, probably over the importer's raw psets including properties without a value; that count cannot be reproduced from the current rows. The catalogue drops properties no element has (TASK-002).
   - The spike's "28k elements (4 models)" also differs from today's 11,839 rows for these four models.
   - The measurement is recorded on SampleCastle and, as the stronger case, on the volume set.
2. **The search text is trimmed in the core (as ref L1465); a rule value is matched as given.** The dialog trims it, as ref L733. So a whitespace-only search is no filter, while a `Freie Textsuche` value `" putz"` is matched with its blank.
3. **An empty isolated set keeps nothing in the core.** DEC-18 says "an isolated set that becomes empty ends the isolation": that is cv-app's job, which passes `keys: null` (TASK-017a). An empty hidden set is no filter.
4. **A rule on a property that no row has never matches in the core.** `Isolieren` then removes every row. Leaving such a rule out of evaluation (`Eigenschaft nicht geladen`, REQ-012-AC14, DEC-21) is cv-app's job: it drops those rules before calling the core (TASK-015b/017a).
5. **Invalid rules are ignored by the core, not reported.** Notices for invalid configuration rules are TASK-012's (DEC-20 field table).
6. **Index text is lower-cased once per row**, over the joined string. This equals per-value lower-casing because the separator is no letter. Both go through `toLowerCase()` (spec 4.3).
7. **`describeRule`, `RULE_MODES` / `RULE_OPS` and `markRows` are built here.** They are listed in spec 4.4 as CalcCore additions and are pure logic. The UI tasks (TASK-015b, TASK-016) only render them.
8. **`displayText(value, entry)` keeps the spec 4.4 signature, but `entry` changes nothing.** Units are converted and booleans normalised at extraction (REQ-002), and the unit text is not part of the display text (DEC-19).

## Evidence
- `node --test test/unit/rules.test.mjs`: 41/41 pass.
- `node --test 'test/perf/**/*.test.mjs'`: 3/3 pass (incl. the TASK-003 and export benchmarks).
- `CV_TEST_PORT=4610 npx playwright test test/perf/text-index.spec.mjs --project=file`: 1 passed (1.4 min).
- Regression run `CV_TEST_PORT=4610 npx playwright test test/e2e/table.spec.mjs test/e2e/filter-area.spec.mjs`: 46 passed, both projects.
- `CV_TEST_PORT=4610 node scripts/check.mjs`: all steps green:
  - 160 unit tests;
  - cv-core line coverage 99.81 %;
  - 26 `@integration` tests in the `http` project.

## Open points
- cv-app wiring is for TASK-015a/b and TASK-017a:
  - pass rules, search and key sets to `evaluateFilters`;
  - `await store.buildTextIndex({pause})` with the progress overlay before the first text source;
  - drop rules whose property is not loaded;
  - null an empty isolated set;
  - use `markRows(store, rules, evaluation.pass)` for the display plan.
- The configuration fields `filterRules` / `search` (DEC-20) are TASK-012's; `normaliseRule` gives the rule shape they validate.
- Spec §5 status is for the orchestrator to update.
