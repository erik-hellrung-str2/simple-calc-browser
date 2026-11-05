---
id: TASK-020
title: "Performance pass INC-2: NFR-001 with rules, search (incl. index target), hide/isolate, reset, table at full width; NFR-003 on a viewer file with active text sources; NFR-005 on 1.1.0 viewer files; trace pending list empty"
type: feature
status: implemented (awaiting orchestrator verification)
implements: [NFR-001, NFR-003, NFR-005]
relates_to: [CR-002, INC-2, NFR-001, NFR-003, NFR-005, Q-002, R-5, R-7, DEC-19, REQ-007-AC1, REQ-007-AC3, REQ-007-AC5, TASK-010, TASK-011, TASK-015a, TASK-017c, TASK-018, TASK-019]
depends_on: [TASK-018, TASK-019]
touches: [test/perf/nfr-001-cr002.spec.mjs (new), test/perf/nfr-001.spec.mjs, test/perf/viewer.spec.mjs, test/support/perf-measure.mjs, test/e2e/viewer-offline.spec.mjs (new), test/e2e/selection.spec.mjs (titles only), test/e2e/view-3d.spec.mjs (title only), test/unit/trace.test.mjs, docs/testing/traceability.md]
---
# TASK-020: Performance pass INC-2

Spec §5 acceptance: NFR-001 CR-002 cases measured (median of 3) and met, or the deviation recorded and, for the free-text scope, the question raised (CR-002 §8); index target of NFR-001 measured; NFR-003 met on a ≥ 100 MB 1.1.0 viewer file exported with a search text and a `Freie Textsuche` rule; NFR-005 met on a 1.1.0 viewer file; `INC2_PENDING` empty; `node scripts/check.mjs --all` green.

**Result: every target is met. No product change was needed.** The free-text scope of DEC-19 (search and `Freie Textsuche` over all properties) meets the 500 ms and the index target, so no trade-off question goes to the user (CR-002 §8, R-5 closed). The Q-002 deviation (pixels on screen on PCs without GPU) applies unchanged to the new interactions (R-7).

## Tests

### `test/perf/nfr-001-cr002.spec.mjs` (new; `file` project, perf-lock)
- `@perf @NFR-001 CR-002 volume set (>= 30,000 elements, table at full width): rules, search, Ausblenden / Isolieren, their pills and `Alle Filter zurücksetzen` within 500 ms (median of 3); index build within 2 s and 150 MB`
  - Volume set as TASK-010 (4 × Revit MEP + SampleCastle, 30,931 rows), 1440 × 900. Asserts first that the table's right edge is the window's right edge and `#cv-details` is absent.
  - **Index target:** the toolbar `Filter` click builds the display-text index (as ref L1435-1449; the first text source after a model change). Measured from the click until the progress text `Eigenschaften werden gelesen … %` is replaced by the result (`measureIndexBuild`). Extra heap = retained heap after a forced GC, after minus before (CDP). Asserted ≤ 2 s, ≤ 150 MB, and that progress was shown.
  - **Search:** `Suchen nach Objekten` = `duct` and cleared, measured from the end of the 250 ms debounce (`measureSearch`: last input event + 250 ms; the timer fires at or after it, so the value is an upper bound).
  - **Rules:** `Isolieren` · `Name` · `Enthält` · `pipe` and `Freie Textsuche` · `Enthält` · `fitting`, measured from the `Anwenden` click and from the × `Filter entfernen` click. The dialog is filled before the measured click.
  - **Element tools:** properties-panel `Ausblenden` / `Isolieren` on one element (rows at 10 / 50 / 90 % of the table; the row click is not measured), pills `Ausblendung entfernen` / `Isolierung entfernen`.
  - **Reset:** `Alle Filter zurücksetzen` with every source active (asserted filter types `keys`, `rule`, `search`, `values`): a rule, a search text, a Kategorie tick in the filter set and in the column filter, one hidden and one isolated element. After the click: no filter, rule, hidden or isolated element, search field empty.
  - Each click is measured by the shared `measureInteraction` (TASK-010): click event → filter sets, table and the last changed 3D frame (Q-002).
  - **Expected counts** come from an independent scan of the extracted values (`window.__calc.rows`), not from the filter code. The needles are letters only and not part of `ja` / `nein`, so only string values can contain them (DEC-19 display text equals the string in lower case).
  - Recorded only: the IfcSpace option switched twice while a search is active (TASK-015a follow-up: a new column store rebuilds the index synchronously in `refresh`); asserted ≤ 2 s (the index target, build included).
- `@perf @NFR-001 display-text index on SampleCastle (the model with the most properties): build time and peak heap through the filter panel recorded, no crash` (SampleCastle is "the 6,859-property model", TASK-011 decision 1).

### `test/perf/nfr-001.spec.mjs` (1.0.0 cases re-measured on 1.1.0)
- Unchanged cases and assertions; added: the table's right edge equals the window's right edge (evidence for "table at full width"), `tableWidth` in the report.

### `test/perf/viewer.spec.mjs` (NFR-003)
- New set `volume set with search and Freie Textsuche`: the builder adds the rule `Freie Textsuche` · `Enthält` · `fitting` and the search `duct` before `HTML exportieren`. The count must equal an independent scan (3,740 of 30,931).
- In each of the 3 offline opens, besides the existing checks (rows, configuration, count, no request): filter count = table count = expected, the rule list and both filter types (`rule`, `search`) are active, the search field holds `duct`. Then the toolbar `Filter` is clicked and the panel status must show the result at once (index already built); that time (navigation start clock) is "usable incl. toolbar", asserted ≤ 15 s (median).
- The other four sets are unchanged.

### `test/e2e/viewer-offline.spec.mjs` (new; both projects; NFR-005)
- `@system @acceptance @NFR-005 a 1.1.0 viewer file makes no request while filter panel, rules, search, colouring panel, element tools, properties panel, section and `Fokus` are used`
  - FZK viewer file opened via `file://` offline with every request aborted and logged.
  - Uses: search, ghost toggle off / on, two rules (one `Markieren`), panel `Zurücksetzen`; colouring panel with `Farbskala` and `Grün`, pill `Einfärbung entfernen`; click menu `Ausblenden`, panel `Isolieren`, both pills; `Schneiden`, handle `ArrowUp` / `ArrowDown`, pill `Schnitt entfernen`; `Fokus`.
  - Asserted: request log and blocked list empty, no page error.

### `test/support/perf-measure.mjs`
- `measureSearch(page, input, text)` and `measureIndexBuild(page, action)` (above). The integration rule "every perf spec measures inputs with the shared helper" holds.

### T5 retagging (TASK-017c open point; orchestrator note 1 of INC-2)
Spec Testing T5 (CR-002): "a test title names an AC only when the test verifies that whole AC". The 1.0.0 tests of the changed ACs were checked for 1.0.0 behaviour. None asserts it any more: REQ-004-AC4, REQ-005-AC1/AC2/AC4, REQ-007-AC1/AC3/AC4, REQ-009-AC1 and REQ-010-AC2 tests were updated by TASK-013..018. Four titles named a changed AC they verify only in part, so the tag was removed. Assertions are unchanged; each AC keeps its whole-AC test.

| Test (title start) | Removed tag | Why | Whole-AC test |
|---|---|---|---|
| `view-3d.spec` `@REQ-007-AC1 clicking a wall …` | `@REQ-007-AC5` | covers empty space and `Esc` only, not the click menu order or `Schließen` | `element-tools.spec` `@REQ-007-AC5` |
| `selection.spec` `@REQ-007-AC3 a table row click …` | `@REQ-007-AC5` | same | same |
| `selection.spec` `@REQ-007 Esc inside a filter search field …` | `@REQ-007-AC5` → `@REQ-007` | only the search-field part | same |
| `selection.spec` `@REQ-007-AC2 @REQ-007 a group row click …` | `@REQ-007-AC3` → `@REQ-007` | a group row, not the element-row click of AC3 (panel, no menu) | `selection.spec` `@REQ-007-AC3 a table row click …` |

The group-row test still names `@REQ-007-AC2` (an unchanged 1.0.0 AC: 3D click → table row). It verifies group selection rather than AC2. That tag was left as released; see Open points.

### `test/unit/trace.test.mjs`
- `INC2_PENDING` stays an empty list, and the check now asserts that it is empty (`INC-2 is complete (TASK-020)`): every AC needs a test again. `docs/testing/traceability.md` regenerated.

## Results (2026-11-05, CV_TEST_PORT=5120)

Environment: Intel Xeon @ 2.10 GHz, 4 vCPU, 17 GB, Node v22.23.4, Playwright Chromium 153.0.8010.12 headless, **software WebGL** (SwiftShader), 1440 × 900, `file` project. Load average 0.4-1.4. Medians of 3 in ms. *done* = click (search: end of debounce) → filter sets, table and last changed 3D frame; *filter* = filter sets and table; *shown* = pixels on screen (recorded only, Q-002).

| NFR-001 case (volume set, 30,931 rows) | done (runs) | filter | shown | Target | Met |
|---|---|---|---|---|---|
| Search `duct` (index built) | 320.2 (320 / 375 / 316) | 7.6 | 1,050 | ≤ 500 | yes |
| Search cleared | 330.4 (341 / 315 / 330) | 8.8 | 1,006 | ≤ 500 | yes |
| Rule `Isolieren` · `Name` · `Enthält` `Anwenden` | 319.6 (367 / 290 / 320) | 11.3 | 983 | ≤ 500 | yes |
| same, × removed | 332.2 (332 / 357 / 330) | 8.3 | 1,023 | ≤ 500 | yes |
| Rule `Freie Textsuche` · `Enthält` `Anwenden` | 289.5 (248 / 290 / 330) | 6.6 | 995 | ≤ 500 | yes |
| same, × removed | 338.2 (338 / 335 / 362) | 7.7 | 1,030 | ≤ 500 | yes |
| `Ausblenden` (panel) | 76.1 (76 / 54 / 256) | 12.2 | 903 | ≤ 500 | yes |
| `Ausblendung entfernen` (pill) | 11.1 (11 / 8 / 166) | 7.5 | 842 | ≤ 500 | yes |
| `Isolieren` (panel, 1 element left) | 287.4 (314 / 281 / 287) | 10.8 | 690 | ≤ 500 | yes |
| `Isolierung entfernen` (pill) | 329.2 (355 / 307 / 329) | 16.2 | 1,025 | ≤ 500 | yes |
| `Alle Filter zurücksetzen`, every source active | 345.2 (406 / 318 / 345) | 13.3 | 1,064 | ≤ 500 | yes |

- Every click that changed the 3D view drew exactly 1 changed frame. `Ausblenden` / its pill of a small element changed no frame in 2 of 3 runs (element not drawn at this zoom), as the TASK-010 selection case.
- **Index target** (volume set, toolbar `Filter`): progress after 13 ms, index built and result shown **325.7 ms** (16 progress steps), **+10.3 MB** retained heap (peak page heap 65 MB, heap before 47 MB). Target ≤ 2 s, ≤ 150 MB: met. A second run: 310.2 ms, +10.4 MB.
- **SampleCastle** (3,635 rows, 6,106 distinct properties): index 159.5 ms (progress after 91 ms), +3.1 MB retained, peak page heap 39 MB, peak Chromium RSS 912 MB, no error or crash. A search `wall` afterwards: 149.5 ms done, 1,421 rows (= independent scan).
- **IfcSpace option with an active search** (recorded): filter 495-549 ms (sync index rebuild included), complete frame 724-806 ms (on) and 1,537-1,551 ms (off); within the 2 s bound. See Decisions 2.
- **1.0.0 NFR-001 cases on 1.1.0 at full width** (`nfr-001.spec.mjs`, table 1,160 px to the right edge): filter set 286.7 / 346.5, Name set 267.8 / 344.0, GlobalId set 264.2 / 358.1, column filter 263.8 / 357.7, sort 12.4 / 9.3 / 1.9, view switch 23.3 / 6.9, regrouping 18.9 / 9.8, selection 22.4 (frame in 1 of 3 runs, 336.7), Name checklist 4.8 ms. All ≤ 500 ms. Similar to or better than TASK-010.

| NFR-003 viewer file (3 offline opens) | IFC | file | ratio | usable median (max) | usable incl. toolbar | Met |
|---|---|---|---|---|---|---|
| volume set + search `duct` + `Freie Textsuche` `fitting` (3,740 rows shown) | 158.3 MiB | 23.6 MiB | 14.9 % | 7,917 (8,403) ms | 8,663 ms (8,394-9,211) | yes (≤ 15 s, ≤ 40 %) |
| volume set (no text source) | 158.3 MiB | 23.6 MiB | 14.9 % | 7,936 (8,041) ms | – | yes |
| synthetic single IFC | 144.8 MiB | 19.7 MiB | 13.6 % | 4,663 (4,695) ms | – | yes |
| AC20-FZK-Haus / Duplex (recorded; ratio n/a below 100 MB) | 2.5 / 2.3 MiB | 1.4 / 1.4 MiB | 57.8 / 62.0 % | 1,493 / 1,462 ms | – | – |

- The index build at the viewer start (TASK-018 decision 2: synchronous inside the configuration's `refresh`) is inside "ready" and costs about the same as the 1.1.0 start without text sources. The 1.1.0 volume viewer is usable in 7.9 s; the 1.0.0 file in TASK-010 took 8.9 s (different CPU, 2.10 vs 2.80 GHz label).
- **NFR-005:** request log and blocked list empty in all 15 perf opens and in `viewer-offline.spec.mjs` (both projects).

## Commands run (all green)
- `CV_TEST_PORT=5120 node scripts/check.mjs`: all steps green, twice (start and end).
- `node scripts/check.mjs --all` runs longer than the 10-minute limit for one command, so its steps were run separately (same commands, both projects where it applies):
  - `npx playwright test test/e2e/[a-f]*.spec.mjs`: 140 passed;
  - `test/e2e/[g-r]*.spec.mjs`: 108 passed;
  - `test/e2e/[s-z]*.spec.mjs`: 100 passed, 2 skipped (the `http` half of `system.spec` and of `volume-robustness.spec`, skipped by design);
  - `npx playwright test test/integration test/acceptance`: 70 passed;
  - perf `--project=file`: `view-3d`, `view-3d-volume`, `selection`, `table` (4 passed); `grouping`, `export`, `text-index` (3 passed); `viewer` (5 sets; 4 + 1 passed); `nfr-002` (2 passed); `nfr-001` (1 passed); `nfr-001-cr002` (2 passed, run twice); `load-100mb` (1 passed);
  - `npx playwright test test/perf --project=http`: 18 skipped by design (perf runs in `file` only);
  - `node --test 'test/perf/**/*.test.mjs'`: 3 pass.
- `node scripts/trace.mjs`: regenerated. `node --test test/unit/trace.test.mjs`: 4 pass.

## Decisions (for the release gate / orchestrator)
1. **The index target is measured at the user's first text source, which is opening the filter panel.** The app builds the index there, as ref L1435-1449, so the first search does not wait. The measured time runs from the `Filter` click until the progress text is replaced by the result, so it includes the panel opening and the filter pass (upper bound).
2. **IfcSpace option or a model load while a search or `Freie Textsuche` rule is active: the index is rebuilt synchronously, without the `Eigenschaften werden gelesen` progress.** This is as built since TASK-015a / TASK-018. The NFR names "with the progress overlay while it runs" for the first text source after a model change. Measured at 30,931 rows: the switch's filter pass incl. the rebuild takes 495-549 ms and stays within the 2 s index target. The IfcSpace switch was never an NFR-001 interaction, and its 3D frame (0.7-1.6 s, setting 263 spaces visible or invisible) is the 1.0.0 behaviour of the option. A model load shows its own load progress. Not changed; shown at the release gate.
3. **Search times are measured from last input + 250 ms** (the debounce end as the NFR states). The timer fires at or after that point, so the reported value is an upper bound.
4. **T5 retagging** of four 1.0.0 titles (table above). Assertions are unchanged; no AC lost its whole-AC test.
5. **`check --all` was run in parts** (each command < 10 minutes); the parts together are exactly `npx playwright test` (both projects) plus `node --test 'test/perf/**/*.test.mjs'`.

## Open points / contracts for later tasks
- **Testing phase:** `selection.spec` `@REQ-007-AC2 @REQ-007 a group row click …` still names REQ-007-AC2, an unchanged 1.0.0 AC that the test does not verify (it verifies group-row selection). AC2 has its whole-AC test (`selection.spec` `@REQ-007-AC1 @REQ-007-AC2 a 3D click marks the table row …`). The tag was not changed (outside the changed-AC check); the verifier may retag it.
- No GPU numbers (none in this environment); the GPU check stays manual at release (T12, Q-002).
- §5 status of TASK-020 and spec §6 "INC-2 pending" row: for the orchestrator.

## Change history
- 2026-11-05 implemented (TASK-020 developer).
