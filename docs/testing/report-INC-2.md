---
status: draft
relates_to: [INC-2, CR-002, CR-003, BUG-T5, BUG-T6, BUG-T7, BUG-T8, BUG-T9, BUG-T10, BUG-T11, BUG-T12, BUG-T13, BUG-T14, BUG-T4, NFR-001, NFR-002, NFR-003, NFR-004, NFR-005, Q-002, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14]
---
# Test report INC-2 (release candidate 1.1.0, CR-002)

This report follows kernel §5 and §5a and `process/calibration/testing.md` for tier S. It covers the testing phase of delivery cycle 2 (INC-2, CR-002). Five testers worked in separate contexts: perf, regression, acceptance (exploratory as the requesting user), robustness (exploratory break session), and a T7 test author for the open SYNC-5 items. A developer then fixed the findings. The reporter re-ran `check` and the full Playwright regression on the fixed build, plus four perf specs. The reporter changed no product code, test or other `docs/` file, and nothing was committed.

## 1. Release candidate and environment
- **Commit:** `8bd454d` on `claude/keen-cori-j7ysfx` ("Verification INC-2: … CR-003 proposed"), tested on 2026-11-05.
- **Uncommitted changes on top of `8bd454d`:** the release candidate is this commit plus the following changes, which are not committed.
  - Testing-phase fixes in `calc-viewer-builder.html`, last changed at 21:26:38 (sha256 `deeeba51…bbb68`). These are the fixes for BUG-T5 to BUG-T10: CSS clamps, table rows at `min-width: 100%`, `shiftPickCard` for the click menu, and `Esc` in the `Eigenschaft` combobox.
  - Tests:
    - `test/e2e/overlay-robustness.spec.mjs` (new, 6 tests)
    - `test/e2e/section-robustness.spec.mjs` (new, 3 tests, SYNC-5)
    - `test/support/flat-fixture.mjs` (new)
    - `test/e2e/keyboard.spec.mjs` (the `REQ-012-AC11` test now also checks the two-step `Esc`)
  - Documents: `docs/process-log.md` (4 rows), `docs/tasks/TASK-013/014/015b/016/017c/019.md`, and a regenerated `docs/testing/traceability.md`.
- **Which build each run used:** the perf, regression, acceptance and robustness testers ran on the build before the fixes (`calc-viewer-builder.html` changed at 18:43:02). Every run marked **"fixed build"** below is the reporter's own run on the 21:26:38 build.
- **Machine:** Linux 6.18, Intel Xeon at 2.10 GHz with 4 cores, 17 GB RAM, no GPU. Load average was 1.0–3.6 during the runs.
- **Software:** Node v22.23.4, Playwright 1.63.0, headless Chromium 153.0.8010.12. WebGL ran as ANGLE/SwiftShader, which is software rendering.
- **Ports (`CV_TEST_PORT`):** perf 5300, regression 5310, acceptance 5320, robustness 5330, T7 author 5340, developer 5350, reporter 5360.
- **Logs:** under `/tmp/claude-0/-home-user/b4080e59-f4c4-52f1-9269-192eeef60a44/scratchpad/testing-c2/`, in one folder per role: `perf/`, `regression/`, `exploratory/` (acceptance), `robustness/`, `robustness-author/`, `developer/`, and `reporter/` (this report's runs, including `summary.txt` and `run.sh`).
- **Housekeeping:** two orphaned `node scripts/serve.mjs` processes from the acceptance and robustness sessions are still running (PIDs 17816 and 25122, ports 5320 and 5330). The permission system did not allow those sessions to stop them. Someone must stop them before those ports are used again.

## 2. Results per test type (pass / fail / skip)

### 2.1 Fixed build (reporter, port 5360, `--workers=2`, retries 0)

| Part / type | Command | file | http |
|---|---|---|---|
| `node scripts/check.mjs`: format, lint, cdn-cache, unit with c8, `@integration` on `http` | as configured | green, 71 s (exit 0) | (included) |
| T1 Unit, inside check | `node --test 'test/unit/**/*.test.mjs'` under c8 | 180/0/0 | – |
| T2 `@integration`, inside check | `--grep @integration --project=http` | – | 29/0/0 |
| E2E A: colouring, config-compat, config | `npx playwright test --project=<p> …` | 35/0/0 | 35/0/0 |
| E2E B: element-tools-3d, element-tools, export, filter-area | same | 33/**1**/0 | 34/0/0 |
| E2E C: filter-robustness, grouping-robustness, grouping, hide-isolate, keyboard, layout-followups, memory-robustness | same | 32/0/0 | 32/0/0 |
| E2E D: overlay-layout, panel-actions, properties-panel, rule-filter | same | 29/0/0 | 29/0/0 |
| E2E E: selection, smoke, system, table-robustness, table, view-3d | same | 31/0/0 | 30/0/1 |
| E2E F: view-tools, viewer-offline, viewer-robustness, viewer, volume-robustness | same | 20/0/0 | 19/0/1 |
| E2E G (new): overlay-robustness, section-robustness | same | 9/0/0 | 9/0/0 |
| T5 Acceptance + T2 Integration (`test/acceptance`, `test/integration`) | same | 35/0/0 | 35/0/0 |
| Re-run of the B failure, `element-tools.spec.mjs:68`, `--repeat-each` | 6 + 12 on `file`, 6 on `http` | 18/0/0 | 6/0/0 |
| T6 perf spot check: nfr-001 | `--project=file --workers=1` | 1/0/0 | – |
| T6 perf spot check: nfr-001-cr002, selection, table | same | 4/0/0 | – |
| Traceability | `node scripts/trace.mjs --check` | current (385 tests in 72 files) | – |
| Reference values | `node scripts/ref/derive-reference.mjs --check` | up to date | – |
| **T8 Regression, all Playwright except perf (first run)** | sum of A–H | **224/1/0** | **223/0/2** |

Tag counts in the fixed-build regression (first run, file / http, pass/fail/skip):

| Tag | file | http |
|---|---|---|
| T3 `@system` | 5/0/0 | 4/0/1 |
| T9 `@smoke` | 2/0/0 | 2/0/0 |
| T7 `@robustness` | 77/0/0 | 76/0/1 |
| T5 `@acceptance` | 119/1/0 | 120/0/0 |
| T4 `@e2e` | 172/1/0 | 173/0/0 |
| `@UI` | 15/0/0 | 15/0/0 |

Notes on the fixed-build run:
- **The one failure:** `element-tools.spec.mjs:68` (`@REQ-013-AC1`) failed once on `file`. The assertion was "menu at the clicked point after the orbit", with 1.62 px received against ≤ 1.5 px. It then passed 24 of 24 repeats (18 on `file`, 6 on `http`) and its first run on `http`. In total it failed 1 of 25 runs on the fixed build. This is BUG-T14 in section 4, now fixed: the test read the marker and the projection in different frames while the damped orbit still moved the camera. After the test fix it passed 30 of 30 repeats on `file` and 10 of 10 on `http`. All other ACs passed on the first run.
- **Skips:** both skips on `http` are the deliberate `test.skip(project !== "file")` calls, unchanged since INC-1: `e2e/system.spec.mjs:18` (the `file://` copy-alone system test) and `e2e/volume-robustness.spec.mjs:16`.
- **Unit coverage (c8):** lines 99.84 %, statements 99.84 %, branches 94.31 %, functions 100 %. The tier S target is ≥ 70 %.
- **Count growth since the pre-fix regression run:** 9 more tests per project (216 to 225). These are 6 in `overlay-robustness` and 3 in `section-robustness`.

### 2.2 Pre-fix build (testers, `8bd454d` as committed)

| Role / type | file | http | Notes |
|---|---|---|---|
| `check.mjs` (regression, port 5310) | green, 82.6 s | (included) | unit 180/0/0; `@integration` 29/0/0 |
| T8 Regression, all Playwright except perf (7 batches) | 216/0/0 | 214/0/2 | T4 E2E 181/0/0 and 179/0/2; acceptance + integration 35/0/0 each; `@system` 5/0/0 and 4/0/1; `@smoke` 2/0/0 each; `@robustness` 70/0/0 and 69/0/1 |
| T6 Perf, 12 spec files split per file, `--workers=1` (port 5300) | 18/0/0 | 0/0/18 (skipped by design) | Node perf `test/perf/**/*.test.mjs`: 3/0/0 |
| T7 SYNC-5 items, new `section-robustness.spec.mjs` (port 5340) | 3/0/0 | 3/0/0 | `--repeat-each 5`, both projects: 30/0/0; bite checks: each test fails on its mutation |
| T14 Acceptance probes (port 5320), final runs | all passed | all passed | earlier failures were probe defects (section 5) |
| T14 Robustness probes (port 5330), final runs | all passed | 5/0/0 | earlier failures were probe defects (section 5) |
| Developer, `overlay-robustness.spec.mjs` before the fixes | – | 0/6/0 | each test failed for its bug |
| Developer, `overlay-robustness.spec.mjs` after the fixes (each test twice) | 24/0/0 in total over both projects | | 19 affected specs re-run green on both projects |

### 2.3 Core types against tier S
- **T1–T7:** all seven core types were run. Results per type are in the tables above, and the NFRs for T6 are in section 3.
- **T8 Regression and T9 Smoke:** run in full on both builds.
- **T10 Security** is ○ (no login and no sensitive data). The covered parts passed: formula injection (`REQ-008-AC4`), XSS through model strings, rule values, search text, configuration and SVG logo (robustness session), and 0 requests from the viewer file.
- **T11 Usability:** heuristic review against the reference through the acceptance session (section 5). The keyboard pass from TASK-019 is green, and the new X-4 `Esc` step is covered.
- **T12 Compatibility:** Chromium is automated. The manual Chrome/Edge smoke check and the GPU check stay with the release.
- **T13 Migration:** the 1.0.0 to 1.1.0 configuration (axis section converted to `{point:[0,0,3], normal:[0,0,-1]}`) and the `REQ-009-AC7` round trip are green (`config-compat`, the acceptance session).
- **T14 Exploratory:** two charters, "the requesting user builds and shares a view" and "break the cycle-2 features", in section 5.

## 3. NFR measurements
Perf ran on the `file` project with `--workers=1` and medians of 3. The **pre-fix** values come from the perf tester on the full suites. The **fixed** values come from the reporter's spot check (nfr-001, nfr-001-cr002, selection and table only). "1.0.0" is the release-1.0.0 testing report (`report-INC-1.md`).

| NFR | Target | 1.1.0 pre-fix | 1.1.0 fixed build | 1.0.0 | Met |
|---|---|---|---|---|---|
| 001 filter sets, Name / GlobalId sets, column filter at 30,931 rows (last changed 3D frame) | ≤ 500 ms | 240.9–373.7 ms | 229.9–355.6 ms | 354–533 ms (red, BUG-T4) | yes |
| 001 sort, view switch, regroup, `Name` checklist | ≤ 500 ms | 1.5–18.3 ms | 1.6–18.2 ms | 3–34 ms | yes |
| 001 CR-002: search, rule `Name` / `Freie Textsuche`, `Ausblenden` / `Isolieren`, their pills, `Alle Filter zurücksetzen` | ≤ 500 ms | 14.4–348.8 ms | 10.0–355.5 ms | – (new) | yes |
| 001 display-text index, volume set | ≤ 2 s, ≤ 150 MB extra | 297.1 ms, +10.3 MB | 270.4 ms, +10.3 MB | – | yes |
| 001 index, SampleCastle (6,106 properties) | recorded | 147.5 ms, +3.1 MB, RSS 917 MB | 126.2 ms, +3.1 MB, RSS 918 MB | – | recorded, no crash |
| 001 3D view-3d / view-3d-volume (frame) | ≤ 500 ms | 196–225 / 257–316 ms (max 363) | not re-run | 202–254 / 351–425 ms | yes |
| 001 selection row / group | ≤ 500 ms | 149.6 / 152.3 ms | 141.5 / 138.4 ms | 148.5 / 202.9 ms | yes |
| 001 table: scroll render, sort, column filter | ≤ 500 ms | 0.6 ms, ≤ 42.2 ms, frame 28.9 ms | 0.6 ms, ≤ 44.9 ms, frame 29.4 ms | passed | yes |
| 001 pixels on screen (recorded only) | – | 0.68–1.06 s | 0.86–1.00 s | 1.19–1.54 s | deviation per Q-002 |
| 001 IfcSpace switch with an active search (recorded; SYNC-1) | index ≤ 2 s | filter 543.7 / 663.4 ms, frame 956.7 / 1,710.7 ms | filter 529.8 / 476.4 ms, frame 701.3 / 975.3 ms | – | within the index bound; above the recorded 495–549 ms (section 7) |
| 002 single file, 151.8 MB | ≤ 60 s per 100 MB, no crash | **24.5 s per 100 MB**; heap ≤ 329 MB, RSS ≤ 1,870 MB | not re-run | 33.5 s | yes |
| 002 multi-model, 127.7 MB | same | **30.0 s per 100 MB**; RSS ≤ 1,893 MB | not re-run | 41.8 s | yes |
| 003 size | ≤ 40 % of the IFC | volume set 14.9 %, synthetic 13.6 % | not re-run | 14.8 % / 13.6 % | yes |
| 003 start | usable ≤ 15 s | volume set 7.1 s; with search + `Freie Textsuche` 7.9 s; synthetic 4.4 s | not re-run | 9.8 s / 5.5 s | yes |
| 004 export, 30,931 × 20 | ≤ 5 s, no block > 1 s | CSV 204 ms, XLSX 429 ms, grouped 312 / 452 ms; longest task 107 ms | not re-run | 335 / 640 / 487 / 767 ms | yes |
| 005 offline | 0 requests | 0 requests, 0 blocked in 15 viewer opens; acceptance and robustness viewers 0 | not re-run | 0 | yes |

- **BUG-T4 (1.0.0, `nfr-001.spec.mjs` red on software rendering):** it did not happen again. The spec was green on the first run on both builds, with medians up to 373.7 ms.
- **Perf not re-run after the fixes:**
  - What was not re-run: NFR-002, NFR-003, NFR-004 and NFR-005, and the view-3d specs.
  - Why: the fixes change CSS (clamps, table rows at `min-width: 100%`), the `Esc` handling in one dialog, and the click-menu placement, which runs only while the menu is open. None of them is on a load, export or viewer-start path.
  - The four spot-check specs on the fixed build cover the table and filter paths that the `min-width` change touches, and they are green.
  - The viewer file embeds the same builder code, so NFR-003 / NFR-005 carry over by reasoning, not by measurement.

## 4. Bugs
The bugs continue the cycle-1 numbering (BUG-T1 to BUG-T4). The role ids are mapped as follows.

| ID | Role id | Title | Severity | Status | Evidence |
|---|---|---|---|---|---|
| BUG-T5 | X-1 | Properties panel: a long element Name grows the header without limit, and `Ausblenden` / `Isolieren` and the property list fall outside the panel (body 0 px visible at 1280 × 800 / 1024 × 768 with 300 characters) | **major** | **fixed, verified** | title clamped to 3 lines, kicker and chip to 2, full text as `title`; test `@e2e @robustness X-1 …` failed before the fix, green on both projects in the fixed-build run |
| BUG-T6 | A-1 | Table header, row stripes and selection end at the last column instead of the right edge (CR-002 §1 "Die Tabelle unten geht bis nach rechts") | minor | fixed, verified | `min-width: 100%` on head, rows and total row; `@e2e @UI A-1 …` (before: header 920 px short at 1920 px) |
| BUG-T7 | A-3 | Click menu card covers the properties panel (header, chip, first rows) | minor | fixed, verified | `shiftPickCard` plus a `MutationObserver`, process-log row 2026-11-05; `@e2e @UI A-3 …` |
| BUG-T8 | X-2 | Colouring legend row about 1,900 px tall for a very long value; swatch 951 px down | minor | fixed, verified | legend value clamped to 3 lines; `@e2e @robustness X-2 …` |
| BUG-T9 | X-3 | Rule row and filter-area entry without a length limit (89,767 px row for a 200,000-character value) | minor | fixed, verified | clamped to 3 lines, the dialog keeps the full value; `@e2e @robustness X-3 …` |
| BUG-T10 | X-4 | `Esc` with the `Eigenschaft` suggestion list open closed the whole `Filter bearbeiten` dialog | minor | fixed, verified | first `Esc` closes only the list (process-log row 2026-11-05); `@e2e @robustness X-4 …`; `keyboard.spec.mjs` `REQ-012-AC11` now asserts both steps |
| BUG-T11 | A-2 | At 1280 × 800 the 3D view is 1000 × 390.5 px: the filter panel covers the whole model (no clickable model point), `Färben` hides it, the properties panel shows 2 rows, and after `Isolieren` the element sits behind the panel | minor | **open, user decision** | it matches the approved REQ-005 overlay layout (UX-2 of verification INC-2, set aside on baseline grounds); seen from the user's side it conflicts with Q4 `Genauso`; workaround: drag the splitter (390 to 506 px) |
| BUG-T12 | A-4 | `Farbskala` gradient labels name values no shown element has, while a filter is active | minor | **known limitation, user decision** | as designed by DEC-15 (scale over all rows, stable colours); long labels now one line with ellipsis; process-log row 2026-11-05 |
| BUG-T13 | X-5 | A configuration `sectionPlane` far outside every model is accepted without a notice; the view is empty and the handle hidden | minor | **known limitation, user decision** | as specified by the DEC-20 field table (and tested); `Schnitt entfernen` clears it in one click; a notice or clamping needs a CR; process-log row 2026-11-05 |
| BUG-T14 | (reporter) | Flaky test: `element-tools.spec.mjs:68` `@REQ-013-AC1`, "menu at the clicked point after the orbit" received 1.62 px against ≤ 1.5 px | minor (test) | fixed, verified | Found: 1 failure in 25 runs on the fixed build (`reporter/B-file.log`; repeats in `rep-et68-*.log`, `rep2-et68-file.log`). **Root cause: test timing, not a product defect.** `whenIdle` does not wait for the damped orbit (OrbitControls `enableDamping`), so the camera keeps moving about 1.2 px per frame right after the drag. A probe that read the marker and `CalcView3D.project()` in the same frame found 0.00 px difference over 90 frames, so the marker follows the camera exactly each frame. The test read the marker (`menuGeometry`) and the projection (`project`) in two separate `evaluate` calls, and a damping frame between them gave the 1.62 px. The A-3 card shift does not move the marker. **Fix (test only, tolerance unchanged at 1.5 px):** a new helper `settledMenu` in `element-tools.spec.mjs` waits until the marker stays still over two consecutive follow frames, then reads the marker and the projection in that same frame. **Evidence:** `--repeat-each=30` on `file`: 30/30 passed; `--repeat-each=10` on `http` (`CV_TEST_PORT=5400`): 10/10 passed; `node scripts/check.mjs` green (logs in `bugfix-t14/`) |

Cycle-1 bugs:
- **BUG-T2 is closed:** `REQ-007-AC6` is green.
- **BUG-T3 is fixed** (1.0.0).
- **BUG-T4 did not reproduce** (section 3).

There are no open blocker or major bugs.

## 5. Exploratory findings (T14) and screenshots

### Charter 1: the requesting user builds a quantity overview and shares it
This is the acceptance session on the pre-fix build. It used file and http, 1280 × 800 and 1920 × 1080, FZK, Duplex and both models together, and it compared the result with the reference viewer and `docs/reviews/CR-002-screenshots/ref-01..13`.

What works against CR-002 §1 and Q1–Q10:
- **Toolbar and panels:** the toolbar has exactly `Fokus` / `Filter` / `Färben` with the reference hint pill. The filter panel, the rule dialog, the colouring panel and the click menu look almost the same as the reference.
- **Rule dialog:** actions `Isolieren` / `Ausblenden` / `Markieren` / `Freie Textsuche` and comparisons `Gleich` / `Beginnt mit` / `Endet mit` / `Enthält`. "nicht" works through `Ausblenden` (Q2).
- **Left filter sets:** they combine with AND with rules and search (Q1). `Nach Wert filtern` ticks the value in the left set (Q8), and `Farbe nach Wert` opens the colouring panel.
- **Layout:** `#cv-details` is gone, and the table area and the 3D view reach the right edge. The visible table rows did not reach the edge; that was BUG-T6, now fixed.
- **Journey on FZK:**

  | Step | Status line |
  |---|---|
  | Geschoss = Erdgeschoss | `38 von 99 Elementen` |
  | plus `Isolieren: Kategorie enthält „wall“` | 9 |
  | plus search `ext` | 4 |
  | hide 1 element | 8 |
  | isolate 1 more | 1 |
  | `Isolierung entfernen` | 8 |
  | `Schneiden` | unchanged (only the 3D image changes) |
  | pill `Filter entfernen` | 99; the colouring and section pills stay |

- **Exports:** the grouped CSV and XLSX hold `1;IfcWallStandardCase;8` and `Summe;;8`. Every CSV/XLSX was read back with openpyxl: hidden elements are left out, while section and `Markieren` have no effect. CSV has BOM, `;` and CRLF. XLSX has sheet `Tabelle`, bold header, frozen row, autofilter and numeric `Anzahl`.
- **Two models:** both loaded give 317. `Ausblenden Kategorie enthält „wall“` gives 247, plus `Freie Textsuche „door“` gives 56. Removing Duplex ends the isolation and keeps the hidden entry.
- **A Duplex-only rule:** `57 von 317` with both models, then `Eigenschaft nicht geladen` after removing Duplex, then 57 again after reloading it.
- **Configuration round trip:** identical JSON on file and http, with no hidden or isolated elements in it (Q6).
- **Exported viewer:** about 1.49 MB, offline with 0 requests and 0 page errors. Rules, section and colouring are as exported, and the click menu, `Isolieren` and CSV export work in it.
- **Findings:** BUG-T6, BUG-T11, BUG-T7 and BUG-T12 (A-1 to A-4).

### Charter 2: break the cycle-2 features
This is the robustness session on the pre-fix build. It used file and http and the network guard.

- **XSS:** no injection in the builder or the viewer. Tested: IFC names, pset names, file name, title, rule values and keys, search text, filter sets, notices, legend, properties panel, `Nach Wert filtern`, `Farbe nach Wert`, and an SVG logo with onload/script/foreignObject.
- **Configuration:**
  - Malformed `sectionPlane` values give the notice `Schnitt`.
  - Overflowing normals are normalised.
  - Invalid rules are skipped as `Filterregel`.
  - 3,000 missing-property rules give a truncated notice (`… und 2.980 weitere.`).
- **Races:**
  - Toolbar and pill clicks during a load.
  - Removing a model with its click menu open.
  - Removing a model during isolation or the index build.
  - Remove is disabled during the viewer export.
  - Repeated `Ausblenden` / `Isolieren`, 21 `Filter` toggles, and 9 IfcSpace toggles with a search active.

  All were handled cleanly.
- **Keyboard:** the `Esc` order matches REQ-007, and Tab stays inside the rule dialog.
- **Resize:** at 12 widths from 1024 to 1920 px, with 5 pills and all panels open, there were no overlaps and no page overflow.
- **Findings:** BUG-T5 (major) and BUG-T8, BUG-T9, BUG-T10, BUG-T13 (X-1 to X-5).
- **Observed, not filed:** a section stays after the model it was created on is removed, while another model remains. It is cleared when the last model goes. The spec does not decide this; it is listed in section 7.

### SYNC-5 T7 items (test author)
`test/e2e/section-robustness.spec.mjs` adds three tests:
1. `Fokus` while two plans are queued.
2. `Schneiden` while a mark plan is queued and then replaced by an isolation plan.
3. The 1 mm minimum arrow step on a 50 mm slab, with Shift 5 mm.

All three are green on both projects, 30/30 with `--repeat-each 5`. Each test was seen failing on a mutated copy of the builder.

Not covered: `Schneiden` when the queued plan hides the clicked element itself. The spec does not decide this case, and the product cuts with the pick it holds.

### Probe defects (not product failures)
The acceptance probes p2, p4, p6 and p8, and the robustness probes A4, D1, D3, E1 and F1, failed first because of probe errors, such as clicks under an overlay or an un-awaited pick. Each one passed after the probe was corrected. The exception is p8 run 1, whose failure is BUG-T11 itself.

### Key screenshots
Folders:
- **Acceptance:** `/tmp/claude-0/-home-user/b4080e59-f4c4-52f1-9269-192eeef60a44/scratchpad/testing-c2/exploratory/shots/`
- **Robustness:** `/tmp/claude-0/-home-user/b4080e59-f4c4-52f1-9269-192eeef60a44/scratchpad/testing-c2/robustness/`
- **Developer:** `/tmp/claude-0/-home-user/b4080e59-f4c4-52f1-9269-192eeef60a44/scratchpad/testing-c2/developer/`

| Screenshot | Folder | Shows |
|---|---|---|
| `p1-file-1280-loaded.png`, `p1-http-1920-loaded.png` | acceptance | layout; BUG-T6 before the fix |
| `p2-http-05-rule-search.png` | acceptance | filter panel over the model, BUG-T11 |
| `p2-file-09-colour-scale.png` | acceptance | BUG-T12, BUG-T11 |
| `p2-file-10-click-menu-props.png`, `p4-http-08-viewer-click.png` | acceptance | BUG-T7, BUG-T11 |
| `p2-http-13-isolated.png` | acceptance | isolated element behind the panel, BUG-T11 |
| `p10-ref-viewer-1280-click.png` | acceptance | the reference at the same size |
| `p6-http-01-both.png` | acceptance | two models |
| `G1-1024.png`, `G1-1440.png`, `H1-300-1024.png` | robustness | BUG-T5 |
| `G1-1440-legend.png` | robustness | BUG-T8 |
| `B1-hostile-config.png` | robustness | BUG-T9 |
| `B3-far.png` | robustness | BUG-T13 |
| `C1-viewer.png` | robustness | hostile strings shown as text in the viewer |
| `a2-1280-props.png` | developer | BUG-T11 reproduced |

## 6. Coverage and traceability
- **Traceability:** `node scripts/trace.mjs --check` reports `docs/testing/traceability.md` as current: 385 tests in 72 files, **100 of 100 active ACs** and **5 of 5 NFRs** each with at least one test. `REQ-005-AC3` is retired.
- **AC results:** every `@acceptance`-tagged test passed on both projects in the fixed-build run. The one exception was the first `file` run of `REQ-013-AC1`, which failed once and passed 24 of 24 repeats. That was the flaky test BUG-T14, now fixed in the test and green over 30 repeats on `file` and 10 on `http`. The pre-fix run was 120/120 on both projects. So all must ACs and all should ACs pass.
- **Spec T7 items:** all CR-002 T7 items now have a test. SYNC-5 (1) and (2) were closed by `section-robustness.spec.mjs`, and (3) was already closed in verification.
- **New tests for the testing-phase bugs:** BUG-T5 to BUG-T10 each have a test in `overlay-robustness.spec.mjs` that failed before its fix. BUG-T11 to BUG-T13 have no code change, so they have no new test. The existing tests for the DEC-20 "plane outside the models" case are in `element-tools-3d.spec.mjs` and the unit tests.
- **Unit coverage:** lines 99.84 %, branches 94.31 % (tier S: ≥ 70 %).

## 7. Deviations and items for the release gate
The user must confirm or decide these at the 1.1.0 release gate.

**User decisions raised in this testing phase**
1. **BUG-T11 / A-2 (UX-2), 3D view at 1280 × 800.** Options from the developer:
   - (a) keep the approved layout and accept it;
   - (b) a larger default 3D share, for example 65/35, which needs a CR;
   - (c) `Fokus` / isolate fit into the area not covered by panels, a design detail of about one task.

   The developer recommends (c). The acceptance tester rates it the most important gate item, because it conflicts with Q4 `Genauso` from the user's side.
2. **BUG-T12 / A-4, `Farbskala` labels.** Options:
   - (a) keep the scale over all elements (current state);
   - (b) add a note that the scale covers all elements;
   - (c) compute the scale over the shown elements only.

   The developer recommends (a).
3. **BUG-T13 / X-5, far-out `sectionPlane`.** Options:
   - (a) known limitation;
   - (b) a CR to DEC-20 to report and skip such a plane.

   The developer recommends (a).
4. **Section after the removal of its model** (robustness observation): it stays while another model remains. The spec does not decide this. The user can accept the current behaviour or decide otherwise.
5. **BUG-T14 (flaky `REQ-013-AC1` test):** fixed in the test (it waits for the settled follow frame; the tolerance is unchanged) and verified (30/30 `file`, 10/10 `http`, `check` green). Nothing left to decide.

**Deviations and refinements recorded earlier (process log, 2026-11-04/05)**

6. **NFR-001 on PCs without a GPU (Q-002), unchanged:**
   - The pixels reach the screen 0.68–1.06 s after the input.
   - The last changed frame now meets 500 ms (BUG-T4 did not reproduce).
   - The GPU check at release (T12) stays the deciding measurement.
7. **SYNC-1, synchronous index rebuild without the progress text** on a row-set change, a configuration load or the viewer start. The record (TASK-020, process log) gives 495–549 ms for the filter step of the IfcSpace switch with an active search. This testing measured 543.7 / **663.4** ms on the pre-fix build and 529.8 / 476.4 ms on the fixed build, with the complete frame up to 1,710.7 ms. This is still within the 2 s index bound and is not an NFR-001 interaction. **The recorded range should be updated to 476–663 ms.**
8. **SYNC-2 (a):** `Eigenschaft` suggestions and the colouring list in catalogue order, with the unit in the colouring label.
9. **SYNC-2 (d):** the index is built when the filter panel first opens.
10. **CODE-2, known limitation:** filter evaluation is linear in the number of rules (20,000 rules cost about 78 ms per interaction).
11. **New design details:**
    - A-3, click-menu card shifted clear of floating panels.
    - X-4, two-step `Esc` in the `Eigenschaft` combobox.
12. **SYNC-6 / CR-003 (proposed, text only):** spec §4.4 names `CalcView.contextState()`, and §4.2 and `AGENTS.md` `source_layout` list `test/acceptance` and `test/support`.
13. **Process deviations:**
    - CR-002 work stays on the session branch with tag `pre-CR-002`, not an own branch.
    - INC-2 tasks ran one after another.
    - The temporary `INC2_PENDING` list is now empty.
14. **Earlier gate lists:**
    - SYNC-7: the TASK-007 note "not saved: collapsed details panel" is obsolete.
    - DEC-15 (changed) and DEC-18 to DEC-22, with the reference deviations of DEC-21 (a) listed separately next to CR-002 §8.
    - TASK-019 decision 6: no keyboard path to create a section in 1.1.0; it would be a new CR.
    - The task-record decision lists TASK-011 to TASK-020 ("Decisions (for the release gate / orchestrator)").
15. **Before the release:**
    - Commit the testing-phase changes (section 1).
    - Run the full regression on the release commit.
    - Stop the two orphaned `serve.mjs` processes on ports 5320 and 5330.

## 8. Recommendation

**Exit criteria (kernel §5, testing):**
- **Core types:** every core type T1–T7 was run, plus T8, T9, T10 (covered part), T11, T13 and T14. T12 is automated for Chromium; the manual browser check is at release.
- **ACs:** 100 of 100 active ACs pass, all must and all should ACs. The one AC test failure was the flaky BUG-T14. Its cause was test timing, it is now fixed, and the test passed 30 of 30 repeats on `file` and 10 of 10 on `http`.
- **Bugs:** there are no open blocker or major bugs. The only major bug, BUG-T5, is fixed and verified on both projects.
- **NFRs:** NFR-001 to NFR-005 are met on this machine. NFR-001 "pixels on screen" stays the accepted Q-002 deviation.
- **Regression:** green on the fixed build (`check`, 224/1/0 file with the flake re-run green, 223/0/2 http).

**Result: GO WITH DEVIATIONS**, to be confirmed at the release gate:
- the open user decisions BUG-T11 (A-2), BUG-T12 (A-4), BUG-T13 (X-5) and the section-after-model-removal behaviour;
- the Q-002 deviation;
- the SYNC-1 range update;
- the refinements and known limitations in section 7;
- CR-003;
- BUG-T14 is fixed (test timing). The release-commit regression run confirms it.

If the user decides that BUG-T11 must change the layout for 1.1.0, option (b) needs a CR and option (c) needs a task. Either one means a fix and a scoped re-test before the release.

RECOMMENDATION: GO WITH DEVIATIONS

## 9. Orchestrator addendum (2026-11-06)

- Report saved by the orchestrator unchanged (the reporter could not write files); independent report review: VERDICT PASS (6 findings: BUG-T14 claim, evidence labels, perf re-run on the release commit, E2E label, TASK-015b decision 5 superseded by X-4, file not saved) - handled: BUG-T14 fixed in the test (wait for a settled follow frame, tolerance unchanged; 15/15 repeats green on `file`), TASK-015b decision 5 marked superseded, full regression incl. perf on the release commit before the gate.
- User decisions (question dialog 2026-11-06): BUG-T11 (A-2) `Fokus freie Fläche` -> TASK-021 (`Fokus` / `Isolieren` fit the area not covered by panels), re-test scoped to it; BUG-T12 (A-4) `So lassen` -> known limitation confirmed; BUG-T13 (X-5) `Akzeptieren` -> known limitation confirmed. Recorded as Q-005..Q-007.
