---
status: draft
relates_to: [INC-1, NFR-001, NFR-002, NFR-003, NFR-004, NFR-005, Q-002, T1, T2, T3, T4, T5, T6, T7, T9, T10, T14]
---
# Test report INC-1 (testing phase, cycle 1)

An independent tester in a fresh context wrote this report, following kernel §5, §5a and `process/calibration/testing.md` for tier S. No product code or test was changed. `docs/testing/traceability.md` was regenerated and came out identical.

## 1. Release candidate and environment
- **Version tested:** branch `claude/keen-cori-j7ysfx`, HEAD `3464048`, plus the uncommitted fixes from the verification phase. Tested on 2026-11-03.
- **Machine:** Linux 6.18, Intel Xeon 2.80 GHz with 4 cores, 15–17 GB RAM, no GPU.
- **Software:** Node v22.23.4, Playwright 1.63.0, headless Chromium 153.0.8010.12. WebGL ran as ANGLE/SwiftShader, which is software rendering.
- **Server:** `scripts/serve.mjs` on `CV_TEST_PORT=4460`, started and stopped by Playwright. The CDN libraries came from the hash-checked cache through the network guard.
- **Projects:** `file` (the builder opened via `file://`, which is how users open it) and `http`.

## 2. Results per test type (pass / fail / skip)

| Type | Command(s) | file | http |
|---|---|---|---|
| T1 Unit | `node --test --test-name-pattern='\[unit\]' 'test/unit/**/*.test.mjs'` | 118/0/0 (Node) | – |
| T2 Integration | `npx playwright test test/integration test/acceptance`; check test_fast | 26/0/0 | 26/0/0 |
| T3 System | tag `@system` | 4/0/0 | 3/0/1 |
| T4 E2E | `npx playwright test --project=<p> test/e2e/…`, 2 parts per project | 73/0/0 | 73/0/0 |
| T5 Acceptance | tag `@acceptance` | 54/0/0 | 54/0/0 |
| T6 Perf | `npx playwright test --project=file --workers=1 test/perf/…` in 4 parts; `--project=http test/perf`; `node --test 'test/perf/**/*.test.mjs'` | 14/0/0, plus Node 2/0/0 | 0/0/14 |
| T7 Robustness | tag `@robustness` | 40/0/0 | 38/0/2 |
| T9 Smoke | tag `@smoke` | 2/0/0 | 2/0/0 |
| T10 Security | tag `@T10` | 2/0/0 | 2/0/0 |
| T8 Regression, all Playwright | 266 tests in 36 files | 133/0/0 | 117/0/16 |

- **Skips:** all 16 are deliberate `test.skip` calls that only apply on `http`:
  - all 14 perf tests ("one run is enough");
  - the system test for opening via `file://`;
  - `volume-robustness`.
- **No empty test type:** `@system` has 4 tests on each project.
- **Gap:** T3 starts the builder from a clean folder, but it does not do a fresh `npm ci` install on a clean machine.
- **`node scripts/check.mjs`:** green in 95 s.
- **`--all`:** about 45 minutes in one go, longer than the 10-minute limit per command. I ran its parts instead, with 0 failures.
- **Unit coverage (c8):** lines 99.8 %, branches 93.5 %, functions 100 %. The tier S target is at least 70 %.

## 3. AC coverage
- **Traceability file:** `scripts/trace.mjs --check` reports it is current: 253 tests in 51 files, 50 of 50 ACs and 5 of 5 NFRs covered.
- **Must ACs:** 44 of 44 pass (REQ-001, 002, 003, 004, 005, 006, 008, 009, 010).
- **Should ACs:** 6 of 6 pass (REQ-007, REQ-011).
- **AC tests skipped on `http`:** all of them passed on `file`.
- **Decision to confirm at the release gate:** SYNC F1 / CR-A. `IfcOpeningElement` and `IfcDistributionPort` are not listed as rows.

## 4. NFRs
Measured in this run on the `file` project; the number in brackets is the TASK-010 value.

| NFR | Target | Measured, median of 3 | Met |
|---|---|---|---|
| 001 filter-set click | ≤ 500 ms to the last changed 3D frame | 336.0 / 394.7 ms (406.9 / 416.1) | yes |
| 001 Name / GlobalId sets | same | 282.8 / 399.8; 383.8 / 430.5 ms (max 540) | yes |
| 001 column filter | same | 350.1 / 377.7 ms | yes |
| 001 sort, view switch, regroup | same | 2.9–27.1 ms | yes |
| 001 3D, volume set, 5 runs | same | 303.6–411.1 ms, one frame per click | yes |
| 001 grouping, table, selection | same | ≤ 77 ms; row click to highlight 161.6 ms, group click 143.5 ms | yes |
| 001 pixels on screen (recorded only) | – | 0.83–1.37 s on software rendering (0.85–1.27 s) | **deviation**, accepted with the Q-002 answer; to be shown at the gate |
| 002 single file, 151.8 MB | ≤ 60 s per 100 MB, no crash | **35.5 s per 100 MB**; page heap 305 MB, browser memory ≤ 1,884 MB (32.8) | yes |
| 002 multi-model, 127.7 MB | same | **46.0 s per 100 MB** (40.9) | yes |
| 003 size | ≤ 40 % of the IFC | volume set 14.8 %, synthetic file 13.6 % | yes |
| 003 start | usable ≤ 15 s | volume set 10.2 s (max 10.5), synthetic 5.7 s, FZK 1.6 s, Duplex 1.7 s (8.9 / 5.6) | yes |
| 004 export | ≤ 5 s, no block > 1 s | CSV 306 ms (longest task 75 ms); Excel 496 ms (119 ms); Node core 615 / 1,490 ms | yes |
| 005 offline | 0 requests | 0, also after a reload | yes |

- **Not measured on a GPU:** no GPU was available. The manual T12 check at the release gate covers this.

## 5. Open bugs

**BUG-T1 (major):** what is left of review finding UX M1 / SYNC F2.
- **What happens:** below 1280 px, messages in `#cv-messages` are invisible. This covers load errors (the REQ-001-AC2 texts), configuration messages and the no-model message.
  - The collapsed panel has `visibility:hidden`, so screen readers do not announce the `role="alert"` either.
  - The `Filter` button gets no badge, and no drawer opens.
- **Reproduction in this run:**
  - Probe N2 fails on both projects; control N2b at 1440 px passes.
  - Probe: `/tmp/claude-0/-home-user/b4080e59-f4c4-52f1-9269-192eeef60a44/scratchpad/tester/narrow.spec.mjs`.
  - Screenshot: `/tmp/claude-0/-home-user/b4080e59-f4c4-52f1-9269-192eeef60a44/scratchpad/tester/n2.png`.
- **Test gap:** no test in the suite checks messages at narrow width.
- **Fix:** either keep the messages visible when the panels collapse, or mark the `Filter` button and open the drawer when a message arrives. Add an e2e/robustness test at 1100 px.

**BUG-T2 (trivial):** in the details panel, long values such as a GlobalId break in the middle of the word (`e5-viewer-details.png`).

There are no blocker bugs and one open major bug.

## 6. Exploratory sessions (T14)
Screenshots `e1`–`e8` and `n2.png` are in the tester scratchpad folder, and I looked at each of them.

**Charter 1: a colleague opens the exported viewer from the file system.**
- **Export:** in the builder, I loaded FZK and Duplex and filtered to `IfcWallStandardCase`. `HTML exportieren` produced `AC20-FZK-Haus_2026-11-03.html` (1.75 MB) in 0.25 s.
- **Opening:** offline via `file://` it was ready in 1.9 s, with 0 requests and 0 page errors.
- **Exported state:** `69 von 317 Elementen` and 2 models. The header shows title and date, and there is no `IFC laden` or `HTML exportieren` button.
- **Filtering:** switching to `IfcDoor` gives `19 von 317`. The filter counts update, and the 3D view keeps the context as ghosts.
- **Grouping:** `Gruppiert` shows `IfcDoor 19` and `Summe 19`.
- **Selection:** clicking a row highlights the row and the element in 3D, and the details show `Innentuer-3` with German number formats.
- **CSV export:** `AC20-FZK-Haus_2026-11-03.csv` has a BOM and `;` separators.
- **Narrow window:** at 1100 px the `Filter` drawer works.
- **Reload:** the exported state comes back and no requests are made.
- **Findings:** only BUG-T2, and the flow is understandable without explanation.

**Charter 2: the builder at 1100 px with a broken file.**
- Loading `kaputt.ifc` shows nothing: no message, no badge (BUG-T1).
- At 1440 px the message appears.

## 7. Recommendation
- **Exit criteria:**
  - every core type was run;
  - must ACs pass 44 of 44;
  - the NFRs are met, apart from the accepted Q-002 deviation;
  - **"no open major bugs" is not met, because of BUG-T1.**
- **Result:** NO-GO.
- **After the BUG-T1 fix:** I expect GO WITH DEVIATIONS, listing:
  1. the NFR-001 deviation on PCs without a GPU (Q-002);
  2. the Decision to confirm on SYNC F1 / CR-A;
  3. the SYNC F8 orchestrator action on spec §5–§7.
- **Re-test scope after the fix:**
  - the new narrow-width test;
  - `filter-area`, `config` and the `extraction` error tests;
  - smoke and `node scripts/check.mjs`;
  - the full Playwright regression on both projects.

RECOMMENDATION: NO-GO
