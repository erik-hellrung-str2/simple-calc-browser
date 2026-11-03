---
id: TASK-010
title: Performance and robustness pass (volume and 100 MB sets, NFR measurements, fixes)
type: feature
status: todo (pre-work R-4 settle applied)
implements: [NFR-001 (3D part, pre-work)]
relates_to: [NFR-001, NFR-002, NFR-003, NFR-004, T7, R-4, Q-002, TASK-005, TASK-006a (D-c), TASK-006c (R1)]
depends_on: [TASK-009]
touches: [calc-viewer-builder.html (cv-3d-src, cv-app-src: CalcView.shownFrames), test/support/perf-measure.mjs, test/perf/view-3d.spec.mjs, test/perf/view-3d-volume.spec.mjs, test/perf/selection.spec.mjs, docs/spikes/R-4.md]
---
# TASK-010: Performance and robustness pass

The task itself is still to do (spec plan: after TASK-009). This record so far holds only the pre-work.

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
- **Q-002 (open): what "interaction done" means for NFR-001 at 30k.** The tests assert the complete frame (last changed frame drawn) at <= 500 ms median, which is met. Pixels on screen is only recorded (0.6-1.0 s in software WebGL).
  - The conservative reading is "pixels on screen". Under that reading NFR-001 at 30k is not met in headless software WebGL. It would then need a recorded deviation for software rendering, or a GPU measurement, before the TASK-010 gate.
  - Not decided here: it is a user decision (Q-002).
- **"Most runs" = more than half of the runs per action** (10k: at least 2 of 3; 30k: at least 3 of 5, coloured at least 2 of 3). The spec has no rule for this. A strict "every run" would fail on the known residual case (a second tile change after `SETTLE_MS` under load).

### Open points for TASK-010
- Residual second frame on ghost uncheck at 30k under load (1 of 10 runs here). Options: a longer `SETTLE_MS` (trades the cap against a hung wait), or Fragments `maxUpdateRate` 16 while settling (spike: complete 190-449 ms at 30k).
- The settle step now also covers the selection. A pick of an element whose tiles are off screen (no tile change) waits up to `SETTLE_MS` in `whenIdle()`. No frame is delayed, because there is no changed view to draw.
