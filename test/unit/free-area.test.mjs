// TASK-021 (user decision Q-005 for BUG-T11; design detail inside REQ-005-AC6, cited here in a comment only, T5):
// freeFitArea, the part of the 3D view a `Fokus` fits the model into while overlays cover the view. Expected rects are
// derived by hand from the geometry of each case (listed in the comments), never from the code under test. The
// 1280 x 800 case uses the overlay rects measured in the builder (testing cycle 2, BUG-T11; TASK-021 probe).
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadCore } from "../load-core.mjs";

const { freeFitArea, FREE_AREA_MIN_SCALE } = await loadCore();
const VIEW = { width: 1000, height: 400 };

test("[unit] freeFitArea: no covering overlay (none, empty, outside the view, invalid) gives null = the whole view", () => {
  assert.equal(freeFitArea(VIEW, [], 1, 1), null);
  assert.equal(freeFitArea(VIEW, undefined, 1, 1), null);
  assert.equal(freeFitArea(VIEW, [null, { left: 10, right: 10, top: 0, bottom: 50 }], 1, 1), null, "zero width");
  assert.equal(freeFitArea(VIEW, [{ left: 1100, right: 1200, top: 0, bottom: 50 }], 1, 1), null, "right of the view");
  assert.equal(freeFitArea(VIEW, [{ left: 0, right: 100, top: -80, bottom: -10 }], 1, 1), null, "above the view");
  assert.equal(freeFitArea(VIEW, [{ left: NaN, right: 100, top: 0, bottom: 10 }], 1, 1), null, "not a number");
  assert.equal(freeFitArea({ width: 0, height: 400 }, [{ left: 0, right: 10, top: 0, bottom: 10 }], 1, 1), null);
  assert.equal(freeFitArea(null, [{ left: 0, right: 10, top: 0, bottom: 10 }], 1, 1), null);
});

test("[unit] freeFitArea: one panel over the right half leaves the left half; overlays are clipped to the view", () => {
  // free: x 0-500, full height. Scale (model 1 x 1) min(500, 400) = 400 = the whole view's min(1000, 400)
  assert.deepEqual(freeFitArea(VIEW, [{ left: 500, right: 1000, top: 0, bottom: 400 }], 1, 1), {
    left: 0,
    top: 0,
    right: 500,
    bottom: 400,
  });
  // an overlay reaching beyond the top left corner covers x 0-300 inside the view: free x 300-1000
  assert.deepEqual(freeFitArea(VIEW, [{ left: -50, right: 300, top: -50, bottom: 500 }], 1, 1), {
    left: 300,
    top: 0,
    right: 1000,
    bottom: 400,
  });
});

test("[unit] freeFitArea: the model's aspect picks the free part it is shown biggest in", () => {
  // a block at the top centre (x 400-600, y 0-300): free parts left (x 0-400, 400 x 400), right (x 600-1000) and
  // the bottom strip (y 300-400, 1000 x 100)
  const block = [{ left: 400, right: 600, top: 0, bottom: 300 }];
  // square model: left min(400, 400) = 400 beats the strip min(1000, 100) = 100; left and right tie -> the first (left)
  assert.deepEqual(freeFitArea(VIEW, block, 1, 1), { left: 0, top: 0, right: 400, bottom: 400 });
  // a model 10 x 1: left min(40, 400) = 40, strip min(100, 100) = 100 -> the strip
  assert.deepEqual(freeFitArea(VIEW, block, 10, 1), { left: 0, top: 300, right: 1000, bottom: 400 });
  // non-positive extents count as 1 (square)
  assert.deepEqual(freeFitArea(VIEW, block, 0, -3), { left: 0, top: 0, right: 400, bottom: 400 });
});

test("[unit] freeFitArea: below FREE_AREA_MIN_SCALE (25 %) of the whole view's scale it falls back to the whole view", () => {
  assert.equal(FREE_AREA_MIN_SCALE, 0.25);
  // only a strip y 350-400 stays free: square model min(1000, 50) = 50 < 0.25 * min(1000, 400) = 100 -> null
  const top = [{ left: 0, right: 1000, top: 0, bottom: 350 }];
  assert.equal(freeFitArea(VIEW, top, 1, 1), null);
  assert.deepEqual(freeFitArea(VIEW, top, 1, 1, 0.1), { left: 0, top: 350, right: 1000, bottom: 400 }, "50 >= 40");
  // a flat model 20 x 1: strip min(50, 50) = 50 = whole view min(50, 400) = 50 -> the strip
  assert.deepEqual(freeFitArea(VIEW, top, 20, 1), { left: 0, top: 350, right: 1000, bottom: 400 });
  // exactly at the limit: free x 0-250 (square model min(250, 400) = 250 vs 0.25 * 1000 = 250 for a 1000 x 1000 view)
  const square = { width: 1000, height: 1000 };
  const wide = [{ left: 250, right: 1000, top: 0, bottom: 1000 }];
  assert.deepEqual(freeFitArea(square, wide, 1, 1), { left: 0, top: 0, right: 250, bottom: 1000 });
  assert.equal(freeFitArea(square, [{ left: 249, right: 1000, top: 0, bottom: 1000 }], 1, 1), null, "249 < 250");
});

test("[unit] freeFitArea: BUG-T11 layout at 1280 x 800 (3D view 1000 x 391) with properties panel, filter panel and two pills", () => {
  // overlay rects relative to the 3D view as measured: properties panel x 624-984 y 16-243, filter panel x 118-498
  // y 129-311, pill stack x 744-984 y 255-371. Maximal free parts (square model, scale = shorter side): x 0-118 full
  // height (118), x 498-624 full height (126), x 0-624 y 0-129 (129), x 0-744 y 311-391 (80), and x 498-744 y 243-391
  // (246 x 148 -> 148, the biggest). 148 >= 0.25 * min(1000, 391) = 97.75 -> that part.
  const view = { width: 1000, height: 391 };
  const overlays = [
    { left: 624, top: 16, right: 984, bottom: 243 },
    { left: 118, top: 129, right: 498, bottom: 311 },
    { left: 744, top: 255, right: 984, bottom: 371 },
  ];
  assert.deepEqual(freeFitArea(view, overlays, 1, 1), { left: 498, top: 243, right: 744, bottom: 391 });
  // a model 5 x 1 (a long low building): x 0-624 y 0-129 gives min(124.8, 129) = 124.8, beats x 498-744 (49.2) and
  // x 0-744 y 311-391 (min(148.8, 80) = 80)
  assert.deepEqual(freeFitArea(view, overlays, 5, 1), { left: 0, top: 0, right: 624, bottom: 129 });
});
