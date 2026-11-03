---
id: TASK-010
title: Performance and robustness pass (volume and 100 MB sets, NFR measurements, fixes)
type: feature
status: implemented (awaiting independent verification)
implements: [NFR-001, NFR-002, NFR-003, NFR-004, T7, TASK-009 V1/V2/V3, TASK-002 stall timeout]
relates_to: [NFR-001, NFR-002, NFR-003, NFR-004, NFR-005, REQ-001, REQ-010, T3, T5, T6, T7, R-2, R-4, Q-002, TASK-002, TASK-005, TASK-006a (D-c), TASK-006c (R1), TASK-009]
depends_on: [TASK-009]
touches: [calc-viewer-builder.html (cv-css, cv-core-src viewerHtmlParts, cv-3d-src settle / holdFrames / whenQuiet, cv-app-src openViewer, cv-viewer-guard (new), cv-viewer-bootstrap, cv-builder conversion watchdog and offlineSource), scripts/trace.mjs, docs/testing/traceability.md, test/perf/nfr-001.spec.mjs, test/perf/nfr-002.spec.mjs, test/perf/viewer.spec.mjs, test/perf/load-100mb.spec.mjs, test/support/perf-measure.mjs, test/support/perf-memory.mjs, test/support/viewer.mjs, test/e2e/system.spec.mjs, test/e2e/viewer-robustness.spec.mjs, test/e2e/volume-robustness.spec.mjs, test/e2e/smoke.spec.mjs, test/integration/load-robustness.spec.mjs, test/unit/trace.test.mjs, test/unit/core.test.mjs, test/unit/viewer.test.mjs]
---
# TASK-010: Performance and robustness pass

Spec §5 acceptance: NFR-001..004 measured and met (or deviation recorded for the release gate); full T7 suite green. The R-4 pre-work comes first below; the task itself follows from "Formal NFR measurements" on.

Note: the first developer of this task was interrupted by a container restart. Their unverified work in the tree (new perf/robustness specs, `scripts/trace.mjs`, the viewer start guard, the stall watchdog, `offlineSource`, the progress bar CSS) was reviewed, run and kept; two product fixes were added (viewer start, settle cap).

## Pre-work: R-4 settle patch applied (2026-11-02)

Source: `docs/spikes/R-4.md` and `docs/spikes/r4-settle.patch` (made against 7e04c37). cv-3d has changed since in TASK-006c and TASK-007, so the patch was ported by intent.

### What changed in the product (cv-3d)
- **One complete frame per click.** Before the engine calls of a display plan, cv-3d records the models that get calls (`settle`). It draws a changed view only once each of them has changed its tiles and then refreshed once without a change (Fragments can change a model's tiles in two steps, e.g. after `resetHighlight`), or at most `SETTLE_MS` = 300 ms after the last call (`settled`). A model still settling refreshes again after `KICK_MS` = 16 ms instead of waiting for Fragments' own ~100 ms refresh.
- **Also for the selection and the IfcSpace option.** `applySelection` (row click, group row click, pick) and `setItemsVisible` use the same settle step. This addresses TASK-006c follow-up R1 (group highlight of 1,459 elements drew two frames, 365-592 ms).
- **Pending state is merged, not replaced.** A selection queued right after a display plan does not drop that plan's models that are still settling. (The spike patch replaced the set.)
- **`whenIdle()` waits for settling**, so a test cannot read the state before the complete frame. **Model removal** deletes the model's pending state.
- **Camera moves are unchanged:** they draw directly.
- **New test seam `CalcView.shownFrames()`:** the time of the first animation frame after each changed frame. In headless Chromium this is when the frame is on screen ("pixels on screen", Q-002). It is recorded, not asserted.

### Tests
- `test/support/perf-measure.mjs`: `measureViewClick` (applied, first, complete frame, number of changed frames, pixels on screen, idle per filter click) and `summariseViewClicks` (medians, runs with exactly one changed frame).
- `test/perf/view-3d.spec.mjs` (10k, 3 runs per action): it now uses the shared helper, and asserts in addition that **most runs draw exactly one changed frame**. The existing < 500 ms assertions are unchanged. The helper also fixes a wait in the old local `measure`: it waited for `filter.updates >= n`, where n was the count before the click, so the wait was always already met. It now waits for n + 1.
- `test/perf/view-3d-volume.spec.mjs` (new, volume set 4 x Revit MEP + SampleCastle, 30,931 rows): a Kategorie filter click on `IfcMember` (5,809 elements in all 5 models). 5 runs each for ghost check, ghost uncheck and hide, and 3 runs coloured. Asserted for each action:
  - every click draws a changed frame;
  - most runs draw exactly one changed frame;
  - median complete frame <= 500 ms;
  - the 3D state is correct (opaque / ghost / hidden / colours).
  Pixels on screen is recorded only.
- `test/perf/selection.spec.mjs`: records the number of changed frames per click (no new assertion).

### Numbers before / after
Headless Chromium, software WebGL, `file` project, 1440x900. Medians in ms, measured from the click event's timestamp. *frame* = complete frame (last changed frame drawn). *shown* = pixels on screen. *frames* = changed frames per run. "Before" is the committed product (HEAD 69ae0db) plus only the `shownFrames` seam, run with the same specs right before the patched runs. Load average was 1.8-3.2.

| Set / action | Before frame / shown / frames | After frame / shown / frames |
|---|---|---|
| 10k (10,459 rows) ghost check | 335.6 / 574.6 / 2,2,1 | 161.2 / 459.9 / 1,1,1 |
| 10k ghost uncheck | 410.0 / 652.9 / 2,2,2 | 183.9 / 424.9 / 1,1,1 |
| 10k hide | 289.0 / 439.3 / 2,1,2 | 161.0 / 340.2 / 1,1,1 |
| 10k coloured | 334.3 / 602.6 / 2,2,1 | 174.3 / 435.8 / 1,1,1 |
| 30,931 ghost check | 211.1 / 895.4 / 1,1,1,2,2 (runs 211, 159, 140, 829, 713) | run 1: 360.5 / 998.6 / 1,1,1,1,1; run 2: 297.6 / 889.2 / 1,1,1,1,1 |
| 30,931 ghost uncheck | 883.1 / 1,499 / 2,2,2,2,2 | run 1: 347.5 / 980.1 / 1,1,2,1,1 (one run 1,036); run 2: 333.0 / 893.1 / 1,1,1,1,1 |
| 30,931 hide | 178.1 / 600.0 / 1,2,1,2,1 (runs up to 681) | run 1: 378.4 / 774.2 / 1,1,1,1,1; run 2: 245.4 / 628.3 / 1,1,1,1,1 |
| 30,931 coloured | 153.2 / 753.5 / 1,1,2 (one run 863) | run 1: 349.8 / 974.1 / 1,1,1; run 2: 300.2 / 901.8 / 1,1,1 |
| 10k row click (selection) | 194.8 / – / 1,1,1 | 144.9 / – / 1,1,1 |
| 10k group row click, 1,459 elements | 399.7 / – / 2,2,2 | 171.7 / – / 1,1,1 |

- Engine calls (applied) did not get worse: 10k 17-46 ms; 30k 34-112 ms.
- Before, both new assertions failed: 10k (check 1 of 3 runs with one frame) and 30k (uncheck 0 of 5).
- At 30k a single click's median complete frame was sometimes lower before the patch. That happened only when the partial first frame was also the only one. The other clicks drew their complete frame a whole frame later (713-905 ms).
- After the patch, the complete frame is 219-401 ms in every run except one ghost-uncheck run, which drew a second frame at 1,036 ms. There the second tile change came after the 300 ms cap, the residual risk named in the spike.
- Pixels on screen at 30k stays 0.6-1.0 s: one software-WebGL frame of 30k elements alone costs 550-700 ms.

### Commands run (all green)
- `node scripts/check.mjs`: all steps green.
- `npx playwright test test/e2e/view-3d.spec.mjs test/e2e/smoke.spec.mjs test/e2e/selection.spec.mjs` (both projects): 30 passed. Covers render smoke, ghost / hide / colour / section and selection.
- `npx playwright test test/e2e/filter-area.spec.mjs test/e2e/layout-followups.spec.mjs test/e2e/config.spec.mjs test/e2e/filter-robustness.spec.mjs` (both projects): 40 passed.
- `npx playwright test test/e2e/table.spec.mjs test/e2e/grouping.spec.mjs test/e2e/table-robustness.spec.mjs test/e2e/grouping-robustness.spec.mjs test/integration` (both projects): 84 passed.
- `npx playwright test test/perf/view-3d.spec.mjs`, `selection.spec.mjs`, `view-3d-volume.spec.mjs` (twice), `table.spec.mjs`, `grouping.spec.mjs`, `load-100mb.spec.mjs` with `--project=file`: all passed. With `--project=http` all 6 perf specs are skipped by design.
- `node --test 'test/perf/**/*.test.mjs'`: pass.

### Decision to confirm
- **Q-002 — confirmed by the user on 2026-11-02 (no longer a Decision to confirm):** "interaction done" for NFR-001 at 30k is the last changed 3D frame drawn. The tests assert that frame at <= 500 ms median, which is met. Pixels on screen is only recorded (0.85-1.27 s in software WebGL); the deviation for PCs without a GPU is recorded below and in `docs/process-log.md` (verification INC-1, SYNC F9).
- **"Most runs" = more than half of the runs per action** (10k: at least 2 of 3; 30k: at least 3 of 5, coloured at least 2 of 3). The spec has no rule for this. A strict "every run" would fail on the known residual case (a second tile change after `SETTLE_MS` under load).

### Open points for TASK-010 (pre-work)
- Residual second frame on ghost uncheck at 30k under load (1 of 10 runs here). **Fixed in TASK-010** (`SETTLE_BUSY_MS`, see Fixes). Options: a longer `SETTLE_MS` (trades the cap against a hung wait), or Fragments `maxUpdateRate` 16 while settling (spike: complete 190-449 ms at 30k).
- The settle step now also covers the selection. A pick of an element whose tiles are off screen (no tile change) waits up to `SETTLE_MS` in `whenIdle()`. No frame is delayed, because there is no changed view to draw.

## Formal NFR measurements (2026-11-03)

### Environment
All numbers from one container, measured one after another (perf specs hold `.cache/perf.lock`, so no two perf specs overlap): Intel Xeon @ 2.80 GHz, 4 vCPU, 17 GB RAM (no swap), Node v22.23.4, Playwright 1.63 Chromium 153.0.8010.12 headless, **software WebGL** (`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)`), viewport 1440x900, builder opened via `file://` (`file` project, the user's path). 1-min load average during the runs 1.3-2.7 (recorded per run in the JSON lines of the specs). No GPU is available, so no GPU numbers.

### Results (medians of 3 runs unless stated; all asserted targets met)

| NFR | Method (spec) | Test | Set | Result | Target | Met |
|---|---|---|---|---|---|---|
| NFR-001 filter set click | click -> filter sets, table and last changed 3D frame (Q-002), median of 3 | `test/perf/nfr-001.spec.mjs` | volume set, 30,931 rows (4 x Revit MEP + SampleCastle) | Kategorie `IfcMember` (5,809) check 406.9 ms (runs 452/329/407), uncheck 416.1 ms (491/416/358); filter sets and table 9-11 ms, the rest is the 3D frame; 1 changed frame in every run | <= 500 ms | yes |
| NFR-001 Name / GlobalId sets | same; facets of 6,957 / 10,459 values | same | same | Name check 362.0 / uncheck 361.5 ms; GlobalId check 355.4 / uncheck 409.1 ms (max 444) | <= 500 ms | yes |
| NFR-001 column filter | Kategorie column checklist, check / uncheck | same | same | 326.8 / 392.8 ms (max 418) | <= 500 ms | yes |
| NFR-001 sort | Name column asc / desc / off | same | same | 13.9 / 10.3 / 1.9 ms (no 3D change) | <= 500 ms | yes |
| NFR-001 view switch | `Gruppiert` / `Einzelelemente` | same | same | 16.0 / 7.3 ms | <= 500 ms | yes |
| NFR-001 regrouping | level 2 = Geschoss via catalogue dialog / removed | same | same | 23.1 / 12.2 ms | <= 500 ms | yes |
| NFR-001 selection | table row click -> engine calls (+ changed frame if any) | same | same | 17.8 ms median; a changed frame in 1 of 3 runs (330.8 ms); in the other 2 runs the selected element's tiles produced no changed frame (small element not drawn at this zoom; engine calls done at 18 ms) | <= 500 ms | yes |
| NFR-001 Name checklist | click on the Name column filter -> checklist rendered (virtualised, < 60 checkboxes) | same | same | 5.4 ms (shown 39 ms) | <= 500 ms | yes |
| NFR-001 3D detail | 5 runs per action, one complete frame | `test/perf/view-3d-volume.spec.mjs` (2 runs after the fix) | volume set | check 351.4 / 363.5, uncheck 370.8 / 390.4, hide 322.2 / 377.9, coloured 308.3 / 362.3 ms; 36 of 36 clicks drew exactly 1 changed frame (max single run 522 ms) | median <= 500 ms | yes |
| NFR-001 pixels on screen | first animation frame after the complete frame (recorded only, Q-002) | `nfr-001.spec.mjs`, `view-3d-volume.spec.mjs` | volume set | 0.85-1.27 s medians (one SwiftShader frame of 30k elements costs 0.5-0.8 s) | – | deviation, see below |
| NFR-002 single file | file input -> load finished, Node clock | `test/perf/nfr-002.spec.mjs` | `synthetic-castle-x3.ifc` 151.8 MB (10,905 rows, 6,107 catalogue entries) | 56.1 / 49.7 / 46.5 s -> median 49.7 s = **32.8 s per 100 MB**; peak page JS heap 301-313 MB; peak RSS of all Chromium processes 1,766-1,866 MB; no crash, no load error; conversion and extraction progress seen; longest silence of the conversion worker 8,559 ms | <= 60 s per 100 MB, no crash | yes |
| NFR-002 multi-model | same, one batch of 3 files | same | SampleCastle x2 + Revit MEP, 127.7 MB (14,094 rows) | 52.5 / 52.3 / 52.1 s -> **40.9 s per 100 MB**; page heap 179-193 MB; RSS 1,702-1,836 MB; longest worker silence 2,897 ms | same | yes |
| NFR-003 size | viewer file bytes / IFC bytes | `test/perf/viewer.spec.mjs` | volume set 158.3 MiB IFC | 23.5 MiB, **14.8 %** | <= 40 % | yes |
| NFR-003 start | offline `file://` open -> `CalcView.whenIdle()` (usable), 3 opens | same | volume set | ready 6,975 ms, **usable 8,930 ms** (8,842 / 8,930 / 8,984; 2-3 changed frames); before the fix 14,027 ms (max 15,303) | <= 15 s | yes |
| NFR-003 size / start | same | same | synthetic single IFC 151.8 MB (144.8 MiB) | 19.7 MiB, **13.6 %**; usable 5,613 ms (1 frame) | <= 40 %, <= 15 s | yes |
| NFR-003 small (recorded) | same | same | AC20-FZK-Haus 2.5 MiB / Duplex 2.3 MiB | 54.9 % / 58.8 % (fixed ~1 MB runtime; the 40 % target applies to >= 100 MB only, TASK-009); usable 1.5 / 1.6 s | – | n/a |
| NFR-004 | button click -> download, median of 3; longest task | `test/perf/export.spec.mjs` | volume set 30,931 rows x 20 columns | CSV 355 ms (max 436), longest task 212 ms; Excel 519 ms (max 554), longest task 127 ms; grouping view all expanded (30,960 rows): CSV 578 ms, Excel 677 ms; progress shown | <= 5 s, no block > 1 s | yes |
| NFR-004 core | Node, 30,000 x 20, median of 3 | `test/perf/export-core.test.mjs` | synthetic | pass (TASK-008 numbers: CSV 364 ms, Excel 1,154 ms) | <= 5 s | yes |

The volume set's 158.3 MiB (166 MB) also serves as the NFR-001/003/004 set; NFR-002's multi-model set is the TASK-002 R-2 set (127.7 MB) and stays asserted in `test/perf/load-100mb.spec.mjs` (now also `@robustness`).

### Deviation for the release gate
- **NFR-001 / Q-002, PCs without GPU (software WebGL).** Per the user's answer to Q-002, "interaction done" for the 3D part is the last changed frame drawn; this is met (table above). The pixels of that frame reach the screen 0.85-1.27 s after the input in headless Chromium with SwiftShader, because one software-rendered frame of ~30,000 elements costs 0.5-0.8 s on the main thread. On PCs without a GPU (or with WebGL falling back to software) the user therefore sees the new 3D view about 1 s after a filter click at >= 30,000 elements; filter sets and table update within 10-25 ms. Not measured on a GPU (none in this environment; the R-4 spike estimated 150-300 ms). Reason it cannot be fixed in the app: the cost is the rasterisation of the frame itself. Record: deviation accepted by the user's Q-002 answer, to be shown at the release gate.
- No other NFR target is missed.

## Fixes made in this task (product)
| Finding | Fix | Test (fails before the fix) |
|---|---|---|
| R-4 residual: at 30k a ghost uncheck drew a partial frame and the complete one ~1.1 s after the click (2 of 5 runs; `view-3d-volume.spec.mjs` failed once in this task's first run: most-runs-one-frame) | cv-3d `settleExpired`: after `SETTLE_MS` (300 ms) the draw still waits while a settling model's worker has pending tile requests (`model.isBusy`), up to `SETTLE_BUSY_MS` = 1,000 ms | `test/perf/view-3d-volume.spec.mjs` (1 frame in 36/36 clicks after, 3 of 5 uncheck runs before) |
| NFR-003 margin: volume viewer usable 14.0 s median, one open 15.3 s; the start drew 11-13 software frames (one per model and tile batch) | cv-3d `holdFrames(true/false)` and `whenQuiet(maxMs)`; `openViewer` holds drawing while it loads all models and applies the configuration, waits until the tiles stop changing (cap 8 s) and then draws once | `test/perf/viewer.spec.mjs` (records `frames`; usable 8.9 s after, 14.0 s before) |
| V1 (TASK-009): a truncated viewer file showed `Viewer wird geladen ...` forever | new classic block `cv-viewer-guard`, placed right after `#cv-root` before the payloads: at `DOMContentLoaded` without a bootstrap -> `Die Viewer-Datei konnte nicht gestartet werden: Die Datei ist unvollständig oder beschädigt. ...`; a start not ready within 120 s -> `... keine Antwort nach 120 s. ...` (test hook `window.__cvViewerTest`) | `viewer-robustness.spec.mjs` V1 (6 cut positions; hang with hook) |
| V2: a damaged payload showed English browser text | bootstrap maps Base64, gzip, UTF-8 and JSON errors and a failing `decodeTable` to `Die Datei ist beschädigt (eingebettete Daten „<id>“ nicht lesbar). Bitte die Viewer-Datei erneut exportieren.` | `viewer-robustness.spec.mjs` V2 (5 damage kinds; no English word) |
| V3: unused external URLs in the bundled libraries | `offlineSource` strips the jsDelivr SRI banner line and replaces Fragments' unpkg fallback worker URL by `about:blank` (the viewer always passes its embedded worker). Kept, cannot request: XHTML and OOXML namespace identifiers, a paper link in a GLSL comment, the pako licence comment | `viewer-robustness.spec.mjs` V3 (URL list must equal the documented list; request log empty) |
| Progress bar drawn in the browser's default blue | `.cv-progress` styles in the accent `#D72622` (UI-02) | `load-robustness.spec.mjs` "progress bar ... accent red" (checked: fails with the styles removed, red share 0) |
| TASK-002 deferral: a conversion worker that hangs after it started had no timeout | watchdog: start timeout 30 s before the first worker message, then a stall timeout of 180 s reset by every message -> `unreadable`: `… konnte nicht gelesen werden: der Konverter antwortet nicht mehr (keine Rückmeldung seit 180 s).`; `window.__calc.conversion` records `maxSilenceMs` (largest measured: 8.6 s on 151.8 MB) | `load-robustness.spec.mjs` stall test (hooks `hangNextConversion`, `stallTimeoutMs`) |
| Drop during model removal / IfcSpace option change untested | (behaviour existed since TASK-002 defect A) | `load-robustness.spec.mjs` two tests |

## T7 robustness suite (spec Testing T7 row -> tests)
| T7 item | Tests |
|---|---|
| every load error class | `integration/extraction.spec.mjs` `@REQ-001-AC2`; worker never starts; worker hangs mid-conversion (`load-robustness.spec.mjs`) |
| empty / huge / odd files | empty: `error-empty.ifc` in `@REQ-001-AC2`; huge: `perf/load-100mb.spec.mjs` (`@robustness`), `perf/nfr-002.spec.mjs`; odd: trailer comment and blank space (`extraction.spec.mjs`), odd file names incl. 200 characters, no extension (`load-robustness.spec.mjs`) |
| thousands of properties, column store holds only in-use properties, peak heap | `e2e/volume-robustness.spec.mjs` (6,187 catalogue entries, store back to the 3 default keys, peak page heap 177 MB); `e2e/filter-robustness.spec.mjs` Name set on Revit MEP + SampleCastle |
| elements without geometry / material / storey | `integration/extraction.spec.mjs` `@REQ-002-AC1` (conditional IfcVirtualElement: no storey, no material, no geometry), `acceptance/fetched-fixtures.spec.mjs` `@REQ-002-AC7`, `e2e/selection.spec.mjs` `@REQ-007-AC4`, `(leer)` values in `filter-area.spec.mjs` / `grouping-robustness.spec.mjs` |
| special characters and long texts in values and titles | `e2e/table-robustness.spec.mjs` long values; `e2e/export.spec.mjs` special values; `e2e/viewer.spec.mjs` long title with HTML characters; odd file names |
| every config error class | `e2e/config.spec.mjs` `@REQ-009-AC3`, tolerant load, `@REQ-009-AC2` robustness |
| cancelled file dialogs | IFC: `load-robustness.spec.mjs`; configuration and logo: `e2e/config.spec.mjs` |
| removing models with active filters | `@REQ-001-AC3` (`e2e/table.spec.mjs`, `integration/extraction.spec.mjs`), `e2e/selection.spec.mjs` robustness, removing the last model (`extraction.spec.mjs`) |
| HTML/script strings rendered as text (no XSS) | `e2e/filter-robustness.spec.mjs` and `e2e/grouping-robustness.spec.mjs` `@T10`; viewer SVG logo with script |
| viewer file: truncated, hanging, damaged, external URLs | `e2e/viewer-robustness.spec.mjs` V1-V3 |
| actions during a running action | drop during load / removal / IfcSpace option (`extraction.spec.mjs`, `load-robustness.spec.mjs`), rapid row clicks (`selection.spec.mjs`) |

All 36 `@robustness` tests (by title; 3 with fetched fixtures run only in the `file` project, the rest in both projects) pass (see Commands). No T7 item of the spec row is without a test.

## Spec testing table: every T-row executable?
| Row | Executable tests | Gap |
|---|---|---|
| T1 Unit | 117 `[unit]` tests, c8 99.8 % lines of cv-core | – |
| T2 Integration | 26 `@integration` (per project) | – |
| T3 System | `e2e/system.spec.mjs` (builder copied alone into an empty directory, `file://`, fresh context, hash-locked CDN cache), `smoke.spec.mjs` `@system` (http project = static server), `viewer.spec.mjs` / `viewer-robustness.spec.mjs` (viewer offline, request log empty) | – |
| T4 E2E | 66 `@e2e` | – |
| T5 Acceptance | every REQ AC and NFR has a test: `docs/testing/traceability.md` (50 of 50 ACs, 5 of 5 NFRs) | – |
| T6 Performance | `@perf` / `[perf]` 12 tests incl. the new NFR-001 and NFR-002 specs | – |
| T7 Robustness | 36 `@robustness` | – |
| T8 Regression, T9 Smoke | `node scripts/check.mjs --all`; 2 `@smoke` | – |
| T10 Security | `@T10` (2), REQ-008-AC4, NFR-005 tests | – |
| T11 Usability | – | **gap by design: manual heuristic review at release** |
| T12 Compatibility | Chromium: every Playwright test | **Chrome/Edge manual smoke and Firefox best effort at release** |
| T13 Migration | – (no data migration; config versioning in T7) | none needed |
| T14 Exploratory | – | **gap by design: 2 manual charters at release** |

## Traceability
`node scripts/trace.mjs` writes `docs/testing/traceability.md` from the test titles (`@REQ-…-AC#`, `@NFR-###`, also underscores) and the IDs in `docs/spec.md`; `[unit] trace: every acceptance criterion and NFR of the spec has a test; docs/testing/traceability.md is current` (`test/unit/trace.test.mjs`) fails when an AC/NFR has no test or the file is stale, so it is part of `check`. Current: 244 tests in 50 files, 50 of 50 ACs and 5 of 5 NFRs covered.

## Commands run (2026-11-03, all green)
- `node scripts/check.mjs`: all steps green (format, lint, unit with c8 99.79 % lines, `@integration` http 26/26).
- `npx playwright test test/perf/nfr-002.spec.mjs --project=file -g "single synthetic"` and `-g "multi-model"`: 2 passed.
- `npx playwright test test/perf/nfr-001.spec.mjs --project=file`: passed (twice; numbers above from the run after the fixes).
- `npx playwright test test/perf/viewer.spec.mjs --project=file`: 4 passed (after the fix).
- `npx playwright test test/perf/export.spec.mjs --project=file`: passed; `node --test 'test/perf/**/*.test.mjs'`: 2 pass.
- `npx playwright test test/perf/view-3d-volume.spec.mjs --project=file --repeat-each=2`: 2 passed after the settle fix (it had failed once before it).
- `npx playwright test test/perf/view-3d.spec.mjs test/perf/selection.spec.mjs test/perf/table.spec.mjs test/perf/grouping.spec.mjs --project=file`: 4 passed.
- T7: `npx playwright test test/e2e --grep @robustness` (both projects, without the two fetched-set tests): 42 passed; `--grep "Name filter set on Revit|@perf @robustness" --project=file`: 2 passed; `test/e2e/volume-robustness.spec.mjs test/integration/load-robustness.spec.mjs --project=file`: 7 passed; `test/integration test/acceptance --grep "@robustness|@acceptance"` (both projects): 46 passed.
- Regression: `npx playwright test test/e2e test/integration --grep-invert @robustness` (both projects): 141 passed, 1 skipped (by design); `test/e2e/view-3d.spec.mjs selection.spec.mjs smoke.spec.mjs viewer.spec.mjs table.spec.mjs` (both projects, after the last product change): 64 passed; `viewer-robustness.spec.mjs viewer.spec.mjs system.spec.mjs smoke.spec.mjs` (both projects): 23 passed, 1 skipped (system test runs in the `file` project by design).
- Not run as one command: `node scripts/check.mjs --all` (its single Playwright step exceeds the 10-minute command limit of this session); all of its specs were run in the parts above.

## Decisions to confirm
- **Viewer start timeout 120 s** (`START_TIMEOUT_MS`) and **conversion stall timeout 180 s** (`WORKER_STALL_TIMEOUT_MS`): the spec names no value. Chosen far above the measured worst cases (viewer usable 8.9 s; longest worker silence 8.6 s on 151.8 MB) so a slow PC is never cut off (conservative reading: a false error is worse than a late one).
- **Viewer start draws once** after all models, the configuration and the streamed tiles (cap 8 s); until then the overlay shows `<model> – Anzeige` (the model name since verification INC-1 UX minor 3; before: the `.ifc` file name). Faster to usable; the user sees no partial model.
- **`SETTLE_BUSY_MS` = 1,000 ms**: a click whose worker is still busy after 300 ms now draws one complete frame later instead of a partial frame at ~345 ms plus the complete one at ~1.1 s. A single run can exceed 500 ms (max 522 ms of 36); NFR-001 is a median and stays met.
- **V3 kept URLs** (namespace identifiers, comments; listed in `viewer-robustness.spec.mjs` `KEPT_URLS`) are not stripped: changing them would alter library code or the .xlsx output for no gain.
- **NFR-001 selection** is measured to the engine calls when the selected element's highlight changes no drawn tile (2 of 3 runs); then there is no 3D frame to wait for.

## Open points
- `node scripts/check.mjs --all` as one command was not run in this session (time limit); every spec was run in parts (above).
- Q-001 (fixture licence) stays open, not part of this task.
- GPU measurement of NFR-001 pixels on screen: not possible here; manual check on a PC with GPU at release (T12 manual smoke) is suggested.
