---
status: draft
relates_to: [INC-1, BUG-T1, BUG-T2, BUG-T3, BUG-T4, NFR-001, NFR-002, NFR-003, NFR-004, NFR-005, Q-002, CR-A, T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T14]
---
# Test report INC-1 (testing phase, cycle 2)

An independent tester in a fresh context wrote this report, following kernel §5, §5a and `process/calibration/testing.md` for tier S. This cycle re-tests the BUG-T1 fix and runs the full regression. No product code, test or `docs/` file was changed.

## 1. Release candidate and environment
- **Version tested:** commit `bd65d71` ("TASK-010 perf/robustness pass, verification INC-1, BUG-T1 fix"), tested on 2026-11-03. `calc-viewer-builder.html` was last changed at 06:33:06, so every run below used the same build.
- **The fix:** a `MutationObserver` on `#cv-messages` calls `setDrawer("filters")` when a message arrives while `(max-width: 1279px)` matches. The regression test is the last one in `test/e2e/filter-area.spec.mjs`.
- **Machine:** Linux 6.18, Intel Xeon 2.80 GHz with 4 cores, 17 GB RAM, no GPU.
- **Software:** Node v22.23.4, Playwright 1.63.0, headless Chromium 153.0.8010.12. WebGL ran as ANGLE/SwiftShader, which is software rendering.
- **Server:** `scripts/serve.mjs` on `CV_TEST_PORT=4480`. `check.mjs` picked its own port.
- **Projects:** `file` (the builder opened via `file://`) and `http`.
- **Run logs:** `/tmp/claude-0/-home-user/b4080e59-f4c4-52f1-9269-192eeef60a44/scratchpad/tester2/`.
- **Probes and screenshots:** the probe sources are in `/tmp/claude-0/-home-user/b4080e59-f4c4-52f1-9269-192eeef60a44/scratchpad/tester2/probe-src/`, and the screenshots are in `/tmp/claude-0/-home-user/b4080e59-f4c4-52f1-9269-192eeef60a44/scratchpad/tester2/`.

## 2. Results per test type (pass / fail / skip)

| Part / type | Command | file | http |
|---|---|---|---|
| `node scripts/check.mjs` (format, lint, unit with c8, integration on `http`) | as configured | green, 110 s | (included) |
| T1 Unit, inside check | `node --test 'test/unit/**/*.test.mjs'` | 118/0/0 | – |
| T4 E2E part A: config, export, filter-area, filter-robustness, grouping-robustness, grouping, layout-followups, memory-robustness | `npx playwright test --project=<p> test/e2e/…` | 46/0/0 | 46/0/0 |
| T4 E2E part B: selection, smoke, system, table-robustness, table, view-3d, viewer-robustness, viewer, volume-robustness | same | 43/0/0 | 41/0/2 |
| T5 Acceptance (`test/acceptance`) | `npx playwright test test/acceptance test/integration` | 4/0/0 | 4/0/0 |
| T2 Integration (`test/integration`) | same | 27/0/0 | 27/0/0 |
| T6 Perf part 1: nfr-001, grouping, selection, table | `--project=file --workers=1` | 3/**1**/0 | – |
| T6 Perf, nfr-001 re-run | same | 0/**1**/0 | – |
| T6 Perf part 2: export, view-3d, viewer | same | 6/0/0 | – |
| T6 Perf part 3: view-3d-volume, load-100mb | same | 2/0/0 | – |
| T6 Perf part 4: nfr-002 | same | 2/0/0 | – |
| T6 Perf, Node | `node --test 'test/perf/**/*.test.mjs'` | 2/0/0 | – |
| T3 System (within the parts above) | `@system` | 4/0/0 | 3/0/1 |
| T9 Smoke (within the parts above) | `@smoke` | 2/0/0 | 2/0/0 |
| **T8 Regression, all Playwright** | sum of the parts | **133/1/0** | **118/0/2** |

- **Change from cycle 1:** one more test per project, the new BUG-T1 regression test. It passed on both projects.
- **Skips:** the 2 skips on `http` are deliberate `test.skip` calls, the same as in cycle 1: the `file://` system test and `volume-robustness`. I did not run perf on `http`, where all 14 perf tests are deliberate skips.
- **T7 robustness and T10 security:** their tests sit in the e2e and integration files above, and all of them passed.
- **Unit coverage (c8):** lines 99.8 %, branches 93.47 %, functions 100 %.
- **Traceability:** `node scripts/trace.mjs --check` reports `docs/testing/traceability.md` is current.
- **The one failure** is `test/perf/nfr-001.spec.mjs`. It is BUG-T4 in section 5, and NFR-001 in section 4 has the numbers.

## 3. AC coverage
- **Unchanged from cycle 1:** 50 of 50 ACs and 5 of 5 NFRs are covered (traceability check is current).
- **Must ACs:** 44 of 44 pass.
- **Should ACs:** 6 of 6 pass (REQ-007, REQ-011).
- **AC tests skipped on `http`:** they all passed on `file`.
- **REQ-001-AC2:** load-error texts are now visible below 1280 px as well (new e2e test plus probes N2, P2 and P3).
- **Decision to confirm at the release gate:** SYNC F1 / CR-A. `IfcOpeningElement` and `IfcDistributionPort` are not listed as rows. This is still open.

## 4. NFRs
Measured on the `file` project in this cycle; the cycle-1 value is in brackets.

| NFR | Target | Measured | Met |
|---|---|---|---|
| 001 filter sets, Name / GlobalId sets, column filter at 30,931 rows, input to last changed 3D frame | ≤ 500 ms, median of 3 | Run 1: 415–509 ms, `Name set check` **508.7**. Run 2: 354–533 ms, `Name set uncheck` **513.7** and `column filter uncheck` **533.3** (cycle 1: 283–431) | **no, on software rendering** (see BUG-T4) |
| 001, same metric, the share that is not drawing | – | filter 6–25 ms, table 9–22 ms | yes |
| 001 sort, view switch, regroup, open Name checklist | ≤ 500 ms | 3–34 ms | yes |
| 001 3D, FZK-derived set (view-3d) | ≤ 500 ms | check 254 ms, uncheck 202 ms, one frame per click | yes |
| 001 3D, volume set (view-3d-volume), 5 runs | ≤ 500 ms | check 351 ms (max 478), uncheck 425 ms (max 482) | yes |
| 001 selection | ≤ 500 ms | row click 148.5 ms, group click 202.9 ms | yes |
| 001 grouping and table specs | ≤ 500 ms | passed | yes |
| 001 pixels on screen (recorded only) | – | 1.19–1.54 s (0.83–1.37) | deviation per Q-002 |
| 002 single file, 151.8 MB | ≤ 60 s per 100 MB, no crash | **33.5 s per 100 MB**; page heap ≤ 310 MB, browser memory ≤ 1,872 MB | yes |
| 002 multi-model, 127.7 MB | same | **41.8 s per 100 MB** (46.0) | yes |
| 003 size | ≤ 40 % of the IFC | volume set 14.8 %, synthetic file 13.6 % | yes |
| 003 start | usable ≤ 15 s | volume set 9.8 s (max 10.1), synthetic 5.5 s, FZK 1.7 s, Duplex 1.5 s | yes |
| 004 export, 30,931 rows × 20 columns | ≤ 5 s, no block > 1 s | CSV 335 ms (longest task 71 ms), Excel 640 ms (137 ms); grouped CSV 487 ms, grouped Excel 767 ms | yes |
| 005 offline | 0 requests | 0 (viewer specs, V3, system test) | yes |

**Is the NFR-001 failure caused by the fix?** No. I ran the same spec against a copy of the build with the 7 lines of the observer removed, as an A/B check. It failed the same way: `filterSet check` median 538.0 ms, `GlobalId set check` 506.8 ms, `filterSet uncheck` 506.2 ms. The observer only reacts to changes in `#cv-messages`, and no filter click changes it.

**Where the time goes:** the time over 500 ms is the frame time of the software renderer. The machine was slower in this cycle than in cycle 1 (load average about 3 during the runs). On this machine without a GPU, the "last changed frame" measure that Q-002 counts is right at the 500 ms limit.

## 5. Open bugs
- **BUG-T1 (major), from cycle 1: fixed and verified.**
  - Below 1280 px, load errors, configuration errors, the no-model message, configuration notices and the configuration success message now open the filter drawer, and the message is visible there.
  - It works on both projects, in the builder and in the exported viewer.
  - Details are in section 6.
- **BUG-T2 (trivial):** in the details panel, a long value such as a GlobalId breaks in the middle of the word. Unchanged and still open.
- **BUG-T3 (minor, new):** the filter drawer reopens although no new message arrived.
  - **Trigger:** the observer reacts to any change in `#cv-messages`, including a message being removed, as long as some text remains.
  - **Steps (probe P4, both projects):**
    1. At 1100 px with no model, load `kaputt.ifc`. The drawer opens with the error.
    2. Close the drawer.
    3. Drop a `.json` configuration. The drawer opens with the no-model message.
    4. Close the drawer.
    5. Load FZK. The no-model message is removed by the program, the old error is still there, and the drawer opens again over the model area.
  - **Fix idea:** only react when a node is added (`addedNodes.length`).
  - **Related limit, recorded only:** a message that arrived at a wide width is not shown again after the window is narrowed to below 1280 px. The drawer stays closed and the `Filter` button has no badge. The user already saw that message at the wide width.
- **BUG-T4 (minor, test/environment, new):** `test/perf/nfr-001.spec.mjs` is red 2 of 2 times on this machine without a GPU.
  - Medians are 508–533 ms on the current build and 538 ms on the build without the fix.
  - Cycle 1 measured 283–431 ms with the same test.
  - It is not a product regression (A/B check in section 4).
  - The test now passes or fails depending on the machine's load. Under testing calibration §4 such a test counts as a bug, and it also means NFR-001 on PCs without a GPU is no longer "met" for the frame metric that Q-002 counts.
  - **Needs a decision by the orchestrator or user:** either widen the recorded Q-002 deviation (software rendering may also exceed 500 ms for the last changed frame) or make the budget depend on the environment. The GPU check at release (T12) stays the deciding measurement.

There are no blocker bugs and no open major bugs.

## 6. Exploratory and break sessions (T14)
Probe file `break.spec.mjs` plus the cycle-1 probe `narrow.spec.mjs`, run on both projects; 20 of 20 probes passed. Each probe below ran on `file` and `http` with the same result.

**N2, the cycle-1 probe at 1100 px:** loading `kaputt.ifc` now shows the visible text `kaputt.ifc ist keine IFC-Datei.`. The drawer is open (`aria-expanded=true`, `cv-show-filters`). In cycle 1 this probe failed; screenshot `n2.png`.

**P1, no unexpected drawer:**
- Starting at 1100 px, no drawer opens, and none opens after a successful FZK load.
- At 1440 px, a load error shows in the column, no `cv-show-*` class is set and the toggle buttons are hidden.

**P2, configuration messages at 1100 px:**
- A configuration dropped without a model shows `Zum Laden einer Konfiguration zuerst ein IFC-Modell laden.` in the opened drawer.
- When FZK is loaded next, that message is removed and the closed drawer stays closed.
- `Konfiguration gut.json geladen.` (a success message) and the notice `Konfiguration geladen. Nicht angewendet: … Fehlt.Nicht.` each open the drawer.

**P3, message while the details drawer is open:** the error switches to the filter drawer, so the details drawer closes and the message is visible. The keyboard focus stays on `Details`, so the drawer does not take the focus away.

**P4, removal reopens the drawer:** this is BUG-T3.

**P5, resizing and closing:**
- After moving back and forth between 1100 and 1440 px, and switching between 1279 and 1280 px three times, the layout is correct. At 1440 px the filter column is at x = 0 with a width of 280, and the centre starts at x = 280, even with `cv-show-filters` still set from the narrow width.
- Closing all messages with × inside the drawer leaves the drawer open, as the user left it.
- A new error after the user closed the drawer opens it again.
- The related limit (message from the wide width not shown after narrowing) is noted under BUG-T3.

**P6, Tab order at 1100 px after the drawer opened for a message:**
- The order is: `Filter`, `Details`, `IFC laden`, `Konfiguration speichern`, `Konfiguration laden`, `HTML exportieren`, then the drawer: `Meldung schließen`, `Modell entfernen: AC20-FZK-Haus`, the IfcSpace option, `+ Filtersatz`, the filter-set controls and values.
- The focus is not moved when the drawer opens.
- With the drawer closed, nothing inside `#cv-filters` can be reached with Tab (20 Tab presses checked).

**P7, the exported FZK viewer at 1100 px:**
- **Healthy file:** no drawer opens, whether the window is narrowed after opening or is narrow from the start.
- **Configuration notice:** I changed the embedded configuration to name a filter set `Fehlt.Nicht`. Opening that file narrow from the start opens the filter drawer with the notice; screenshot `p7-viewer-notice-*.png`.
- **V1, a cut-off file:** the full-page error `Die Viewer-Datei konnte nicht gestartet werden: Die Datei ist unvollständig oder beschädigt. …` is visible at 1100 px.
- **V2, a damaged configuration payload:** the full-page error `… (eingebettete Daten „cv-payload-config“ nicht lesbar) …` is visible at 1100 px.
- These two errors use `#cv-root` with `role=alert`, not `#cv-messages`, so the drawer plays no part.

## 7. Recommendation
**Exit criteria:**
- Every core type was run: T1–T10 plus T14.
- Must ACs pass 44 of 44, and should ACs pass 6 of 6.
- There are no open blocker or major bugs. BUG-T1 is fixed and verified.
- NFR-002 to NFR-005 are met.
- NFR-001 is met for everything except the 3D frame on software rendering. That part is red in this environment, and the A/B check shows the fix did not cause it.

**Result:** GO WITH DEVIATIONS, to be shown at the release gate:
1. **NFR-001 on PCs without a GPU (Q-002):**
   - Pixels reach the screen in 1.2–1.5 s.
   - New in this cycle: the "last changed frame" metric that Q-002 counts reached medians of 508–538 ms on SwiftShader. That makes `test/perf/nfr-001.spec.mjs` red here (BUG-T4).
   - The user should confirm the wider deviation. The manual GPU check at release (T12) stays the deciding measurement.
2. **SYNC F1 / CR-A:** the decision to exclude `IfcOpeningElement` and `IfcDistributionPort` from the rows is still to be confirmed.
3. **BUG-T2 (trivial):** a GlobalId breaks mid-word in the details panel.
4. **BUG-T3 (minor):** the drawer reopens when a message is removed while other messages remain. A fix in a later increment is fine.

If the user does not accept the wider NFR-001 deviation (item 1), the recommendation becomes NO-GO until the NFR-001 test is green again.

## 8. Orchestrator addendum (after this report)
- **BUG-T3 fixed:** the observer reacts only to added nodes (`addedNodes`), so a message that goes away no longer reopens the drawer. Regression test `@e2e @robustness @UI below 1280 px a message that goes away does not reopen the filter drawer` (`test/e2e/filter-area.spec.mjs`, the P4 sequence) fails before the fix and passes after it on both projects; independent recheck in the release preparation.
- **BUG-T4 / NFR-001 on software rendering:** not changed (the test budget is not weakened). The wider deviation goes to the user at the release gate; the T12 GPU check at release stays the deciding measurement.

RECOMMENDATION: GO WITH DEVIATIONS
