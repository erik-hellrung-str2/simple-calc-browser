---
id: TASK-021
title: "`Fokus` fits the model into the part of the 3D view the open overlays leave free (Q-005, BUG-T11)"
type: bug fix (design detail inside REQ-005-AC6; user decision Q-005)
status: implemented (awaiting orchestrator verification)
implements: [REQ-005-AC6, BUG-T11]
relates_to: [CR-002, INC-2, REQ-005, REQ-013, DEC-18, Q-005, BUG-T11, TASK-014, TASK-017c, TASK-019, TASK-020]
depends_on: [TASK-020]
touches: [calc-viewer-builder.html (cv-core `freeFitArea` / `FREE_AREA_MIN_SCALE`; cv-3d `fitBox` free-area branch, `freeArea`, `focus(covering)`, import from calc-core; cv-ui `createViewTools().coveringRects()`; cv-app toolbar handler `focus`), test/unit/free-area.test.mjs (new), test/e2e/focus-free-area.spec.mjs (new), test/support/free-area.mjs (new), test/e2e/element-tools.spec.mjs (REQ-005-AC6 test, second half), docs/process-log.md, docs/testing/traceability.md]
---
# TASK-021: `Fokus` into the free area

Spec §5: "`Fokus` and `Isolieren` fit the model into the 3D area not covered by open overlays (filter / colouring / properties panel, pill stack); user decision Q-005 for BUG-T11, design detail inside REQ-005-AC6 / REQ-013, no layout change". Implements REQ-005-AC6 and REQ-013-AC3 (fit part); BUG-T11.

## Does `Isolieren` refit? No, so only `Fokus` changed
- **Reference:** `isolateTool` (ref L1109-1118) adds to the isolated set and calls `refresh()`. It does not refit. `fitToVisibleModels` (ref L820-847) runs only after loading and from `Modell einpassen`. `docs/reviews/CR-002-reference-app.md` "Isolieren" says: "The camera does not refit."
- **Spec:** REQ-013 and DEC-18 describe the sets, the pills and the selection, but no camera change. REQ-013-AC3 has no fit part.
- **Builder:** `isolateElements` (cv-app) only changes the isolated set and calls `refresh()`. No fit, before and after this task.
- **Result:** as the orchestrator's instruction says for this case, only `Fokus` respects the free area. `Isolieren` keeps the camera. The new e2e test asserts that (camera unchanged by `Isolieren`). The release gate should see that Q-005's wording ("`Fokus` and `Isolieren` fit …") is not fully met. A refit after `Isolieren` would change behaviour that the approved baseline and the reference do not have (see "Open", item 1).

## What was built
- **cv-core `freeFitArea(view, overlays, modelWidth, modelHeight, minScale)`** (pure, unit-tested). It returns the rectangle of the 3D view that the model is fitted into, or `null` for the whole view.
  - The candidates are the rectangles with edges on the view edges and overlay edges that no overlay covers. Overlays are clipped to the view, and empty or invalid ones are ignored.
  - The rule picks the candidate where the model can be shown largest: the highest `min(w / modelWidth, h / modelHeight)`. A tie goes to the larger area, then to the first found.
  - It returns `null` when no overlay covers the view, or when the best scale is below `FREE_AREA_MIN_SCALE` = 25 % of the whole view's scale.
  - Why the 25 % is measured on scale and not on area: in the BUG-T11 situation (properties panel, filter panel and two pills at 1280 × 800) the largest free rectangle is only 9-21 % of the canvas area. An area limit would fall back to the whole view in exactly the case Q-005 is about. Measured on scale, the wall gets 38 % of the whole-view scale, the ground floor 33 %.
- **cv-3d `fitBox(box, covering)`:**
  - **Without `covering`, or when `freeArea` returns null:** the unchanged reference fit. View direction (1, 0.75, 1), tight 8-corner distance, padding 1.15, orbit target at the box centre.
  - **With a free area:** for each screen axis the 8 corners must project between the area's edges, written as view-angle tangents `lo` / `hi`. With the camera at `centre + dir·d + axis·s`, this gives the linear conditions `lo·(d − p·dir) ≤ p·axis − s ≤ hi·(d − p·dir)`.
    - The smallest distance is `d = (max v − min u) / (hi − lo)`, and it is never less than the corner depth.
    - That distance is multiplied by the reference padding 1.15.
    - `s` is set to the middle of its allowed range, so the box is centred in the free area.
    - Camera and orbit target move together across the view, so the view direction stays the reference one. The orbit pivot is the point in the middle of the free area, at the model's depth.
  - `freeArea(corners, right, up, covering)` reads the overlay rects when the queued fit runs, not at the click. A display plan queued before the click is applied first, as before. It converts the rects to canvas coordinates and passes the box's extent across and up the screen to `freeFitArea`.
  - `api.focus(covering)` takes the optional getter. The test seam `CalcView3D.focus()` and the fit after loading call it without one, so their behaviour is unchanged.
- **cv-ui `createViewTools().coveringRects()`:** the page rects of the overlays named in Q-005, while shown and not empty: the open filter or colouring panel, the properties panel and the pill stack.
- **cv-app:** the toolbar `Fokus` handler calls `engine.focus(() => ui.tools.coveringRects())`. The viewer file uses the same app, so it gets the same behaviour.
- **No layout change.** The split, the overlay places (TASK-019 `layoutOverlays`), the CSS and the DOM are unchanged.

## Tests
Expected values: walls and storeys come from `test/fixtures/reference-values.json`. The free area is derived in the test from the overlays' DOM rects and the engine's projection (`CalcView.screenBox`), in `test/support/free-area.mjs`. The unit expectations are worked out by hand in the test comments. Nothing is taken from the product's own free-area computation.

| Test (file, title abridged) | Covers |
|---|---|
| free-area.test `[unit] freeFitArea: no covering overlay …` | `null` for no / empty / outside / NaN overlays and an empty view |
| free-area.test `[unit] … one panel over the right half …` | the left half is chosen; an overlay reaching outside the view is clipped |
| free-area.test `[unit] … the model's aspect picks the free part …` | a square model takes the left part (tie → first found); a 10 × 1 model takes the bottom strip; non-positive extents count as 1 |
| free-area.test `[unit] … below FREE_AREA_MIN_SCALE (25 %) …` | fallback to `null`; `minScale` parameter; a flat model in a strip; the limit is exact (250 kept, 249 → `null`) |
| free-area.test `[unit] … BUG-T11 layout at 1280 x 800 …` | the measured rects: a square model → x 498-744 / y 243-391; a 5 × 1 model → x 0-624 / y 0-129 |
| focus-free-area.spec `@e2e \`Fokus\` at 1280 x 800 with the properties panel and the filter or colouring panel open …` | 3D view 1000 × < 400 (BUG-T11). The steps: (1) no overlay: the toolbar `Fokus` gives the same camera as the 3D-side whole-view `Fokus`, with every opaque element inside the canvas. (2) Geschoss = Erdgeschoss, a ground-floor wall selected in the table, filter panel open (overlays: properties panel, filter panel, pill): after zooming out and `Fokus`, the union of the opaque elements' projected boxes lies inside the canvas, overlaps no overlay (3 px tolerance) and fills ≥ 50 % of its free span (measured 77 %). (3) `Isolieren` in the properties panel leaves the camera unchanged; `Fokus` then puts the wall in the free area (87 %), at least 20 px away from where the whole-view fit would centre it. (4) The same with the colouring panel. (5) `Fokus` twice gives the same camera |
| focus-free-area.spec `@e2e \`Fokus\` with only the pill stack shown …` | an isolated wall, selection cleared, only the two pills: the wall lies beside the pills (87 %) |
| element-tools.spec `@e2e @acceptance @REQ-005-AC6 …` (changed, see below) | the whole AC6, now with the free-area rule for "all models fitted" |

Re-run, all green: element-tools-3d (3D-side `Fokus` incl. the camera-equality check of the fit after loading), section-robustness (`Fokus` with queued plans), layout-followups, view-tools, view-3d, viewer-offline (`Fokus` in the viewer file), overlay-layout, element-tools.

**Bite check** (cv-app back to `engine.focus()` temporarily, `file`; the change was then restored):
- The new main e2e test fails ("covered by no open overlay").
- The changed REQ-005-AC6 test fails.
- The pills-only test still passes: with the whole-view fit the wall happens to lie clear of the pills. It is kept as a check of that case, not as a bite.

### Changed expectations (approved behaviour change: Q-005)
- `test/e2e/element-tools.spec.mjs` `@REQ-005-AC6`, second half ("no opaque element: all models are fitted"). The pills `Filter entfernen` and `Isolierung entfernen` are shown there, so `Fokus` now fits all models beside them.
  - **Was:** the camera equals the fit after loading (6 digits), and every element is inside the canvas.
  - **Now:** every element with geometry is inside the canvas (unchanged), and the union box of all models:
    - overlaps no overlay (only the pill stack is shown, asserted);
    - fills ≥ 50 % of its free span (measured 59 %), so it is a fit of all models and not just any distant camera;
    - is seen along the view direction of the fit after loading (6 digits).
  - Camera equality without overlays is still asserted:
    - for the 3D side: element-tools-3d, unchanged;
    - for the toolbar: focus-free-area step 1.
  - The first half of AC6 (wall ≥ 25 % of the canvas, opaque elements inside the canvas) is unchanged and passes (85 %).

### Trace
- `INC2_PENDING` stays empty. No AC was pending: REQ-005-AC6 has had its whole-AC test since TASK-017c, and REQ-013-AC3 is unchanged (no fit part, see above).
- The new tests cite REQ-005-AC6 in comments only (T5: they check the Q-005 detail, not the whole AC).
- `docs/testing/traceability.md` regenerated (392 tests in 74 files).

## Results (2026-11-06, CV_TEST_PORT=5500)
- `node scripts/check.mjs`: green (format, lint, cdn-cache, test_fast incl. unit with c8, trace, ASCII / `</script>` checks, 29 integration tests on `http`).
- Playwright, both projects:
  - focus-free-area (2) and the `@REQ-005-AC6` test: green on `file` and `http`, also after formatting;
  - element-tools-3d, section-robustness, layout-followups, view-tools: `file` 21 / 21;
  - view-3d, viewer-offline, overlay-layout, element-tools: `file` 18 / 18;
  - all eight on `http`: 39 / 39.
- Perf `test/perf/view-3d.spec.mjs` (`file`, volume set, 10,459 rows): green; filter click first frame 150-159 ms, shown 417 ms (≤ 500 ms). `Fokus` is not on the filter path. The free-area search runs once per `Fokus` (at most 4 overlays: ≤ 10 edges per axis, about 2,000 candidate checks).
- Not run: the full `--all` regression and the other perf suites. The change is limited to the `Fokus` path; the filter, table and export paths are untouched.

## Decisions (for the release gate)
1. **`Isolieren` does not refit.** Neither the reference nor the spec has a refit. Only `Fokus` uses the free area. Q-005's wording names both (see "Open", item 1).
2. **Which overlays count:** the filter panel, the colouring panel, the properties panel and the pill stack (the Q-005 list).
   - The click menu does not count. It is anchored at a model point and moves with the camera, so it cannot be fitted around.
   - The toolbar (142 × 54 px, bottom centre), the hint (6 s, `pointer-events: none`) and the title chip do not count either. They are small, at the edge, and not in Q-005.
3. **The free area is chosen by the scale the model gets, not by area.** The fallback is at 25 % of the whole-view scale (see "What was built"). At 1280 × 800 with the properties and filter panels open, the ground floor fits into the strip above the filter panel (x 0-624 / y 0-129 of the view). It is visible, but small (about 240 × 100 px).
4. **The orbit pivot moves with the fit.** The target is the middle of the free area at the model's depth, not the box centre. This keeps the reference view direction and puts no lasting state on the camera (no `setViewOffset`). An orbit after a free-area `Fokus` therefore turns around a point next to the model.
5. **The camera is not refitted when overlays open or close later.** The fit applies when `Fokus` runs (as the reference: the camera only changes on the user's request).
6. **The fit after loading stays the whole-view fit.** No overlay is open then, except a pill stack from a loaded configuration.

## Open
1. **Answered 2026-11-06 (Q-005 clarified, user: `Nein, wie HTML Viewer (Recommended)`): `Isolieren` keeps the camera.** Original question: Q-005 reads "`Fokus` and `Isolieren` fit the model into the area not covered by panels". `Isolieren` currently keeps the camera, as the reference and REQ-013 / DEC-18. Options:
   - (a) **(Recommended)** leave it: `Fokus` after `Isolieren` gives the free-area fit with one click, and the camera does not jump on each `Isolieren`;
   - (b) refit into the free area after every `Isolieren`. This changes REQ-013 behaviour against the reference, so it needs a CR or a recorded user decision. Then a small change in cv-app `isolateElements`: call the same fit after the refresh.
2. Not tested: a free-area `Fokus` below 1280 px with the filter drawer open. The drawer is outside the 3D view's overlays, and the 3D view is then at full width. Also not tested: the splitter at its extremes.

## Verification

Independent verifier (fresh context), 2026-11-06: VERDICT PASS. Unit 5/5; focus-free-area + element-tools 14/14 on both projects; regression 84/84 on both projects; perf view-3d, nfr-001, nfr-001-cr002 4/4 on `file`; check green; trace current. Own probe at 1280×800 (properties + filter / colouring panel, tiny-area fallback) confirmed. Minor: AC6 fill bound loose (≥ 50 %, measured 59 %); orbit pivot after a free-area `Fokus` is the middle of the free area (decision 4, release gate); OrbitControls damping after a drag (older behaviour).
