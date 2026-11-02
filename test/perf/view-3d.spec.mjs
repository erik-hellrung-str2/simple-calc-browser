// NFR-001 3D part (TASK-005): with the volume set of TASK-004 (fetched Revit MEP + SampleCastle, about 10k rows) a
// filter click updates CalcView.state() and the next drawn frame within the 500 ms budget. Measured in the page from
// the click event's timestamp (performance clock), median of 3 per action:
//   applied = the engine calls of the new display plan are done (state() derives from them)      -> asserted < 500 ms
//   first   = the first frame drawn because the view changed after the click (cv-3d draws a frame
//             only when the tiles changed, once every model has refreshed, see changeFrames)     -> asserted < 500 ms
//   frame   = the last such frame before the view is idle (complete result)                      -> asserted < 500 ms
//   idle    = CalcView.whenIdle(): two further Fragments refreshes and a frame (upper bound)       -> recorded
// Chromium headless with software WebGL (one frame about 280 ms). Runs in the `file` project only (the user's path).
import { test, expect } from "../support/perf-lock.mjs";
import { fetched, loadFiles, openBuilder } from "../support/builder.mjs";
import { filterSet } from "../support/filter-area.mjs";
import { colourBy, idle, viewState } from "../support/view-3d.mjs";

const BUDGET_MS = 500; // NFR-001
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

/** Runs action (a Playwright input) and measures from its input event to the engine calls and the drawn frame. */
async function measure(page, action) {
  await page.evaluate(() => {
    window.__t0 = null;
    document.addEventListener("click", (e) => (window.__t0 = e.timeStamp), { capture: true, once: true });
  });
  const updates = await page.evaluate(() => window.__calc.filter.updates);
  await action();
  return page.evaluate(async (n) => {
    const t0 = window.__t0;
    const waitUpdates = () =>
      new Promise((resolve) => {
        const tick = () => (window.__calc.filter.updates >= n ? resolve() : requestAnimationFrame(tick));
        tick();
      });
    await waitUpdates();
    const idleAt = await window.CalcView.whenIdle();
    const changes = window.CalcView.changeFrames().filter((t) => t > t0);
    return {
      filterMs: window.__calc.filter.lastMs,
      applied: window.CalcView.lastAppliedAt() - t0,
      first: changes.length ? changes[0] - t0 : NaN,
      frame: changes.length ? changes[changes.length - 1] - t0 : NaN,
      idle: idleAt - t0,
    };
  }, updates);
}

test("@perf @NFR-001 @REQ-005 volume set: a filter click updates state() and the drawn frame within 500 ms", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "file", "one run is enough; the file project is the user's path");
  test.setTimeout(600_000);
  const errors = await openBuilder(page);
  await loadFiles(page, [fetched("Ifc4_Revit_MEP.ifc"), fetched("Ifc2x3_SampleCastle.ifc")], 300_000);
  await idle(page);
  const total = await page.evaluate(() => window.__calc.rows.length);
  const geometry = await page.evaluate(() => window.__calc.rows.filter((r) => r.geometry).length);
  expect(total).toBeGreaterThan(10_000);

  // the Kategorie value with the most elements: the largest change of the 3D state per click
  const value = await page.evaluate(() => {
    const values = window.__calc.filter.facets.Kategorie.values.filter((v) => v.value !== null);
    return values.sort((a, b) => b.count - a.count)[0];
  });
  await filterSet(page, "Kategorie").getByRole("searchbox").fill(value.value); // virtualised list: bring it into view
  const box = filterSet(page, "Kategorie").getByRole("checkbox", { name: value.value, exact: true });
  const insideWithGeometry = () =>
    page.evaluate(() => {
      const keys = new Set(window.__calc.filter.keys);
      return window.__calc.rows.filter((r) => r.geometry && keys.has(r.key)).length;
    });

  const results = { check: [], uncheck: [] };
  for (let i = 0; i < 3; i++) {
    results.check.push(await measure(page, () => box.click()));
    let state = await viewState(page);
    expect(state.opaque.length).toBe(await insideWithGeometry());
    expect(state.ghost.length).toBe(geometry - state.opaque.length);
    results.uncheck.push(await measure(page, () => box.click()));
    state = await viewState(page);
    expect(state.opaque.length).toBe(geometry);
  }

  // the same in hide mode and with colouring by Kategorie (one highlight call per colour)
  await page.getByRole("radio", { name: "Ausblenden" }).click();
  await idle(page);
  results.hide = [];
  for (let i = 0; i < 3; i++) {
    results.hide.push(await measure(page, () => box.click()));
    await box.click();
    await idle(page);
  }
  await page.getByRole("radio", { name: "Geist" }).click();
  await colourBy(page, "Kategorie", "Kategorie");
  await idle(page);
  results.coloured = [];
  for (let i = 0; i < 3; i++) {
    results.coloured.push(await measure(page, () => box.click()));
    const state = await viewState(page);
    expect(Object.keys(state.colours).length).toBe(state.opaque.length);
    await box.click();
    await idle(page);
  }

  const summary = Object.fromEntries(
    Object.entries(results).map(([k, runs]) => [
      k,
      {
        filterMs: +median(runs.map((r) => r.filterMs)).toFixed(1),
        appliedMs: +median(runs.map((r) => r.applied)).toFixed(1),
        firstFrameMs: +median(runs.map((r) => r.first)).toFixed(1),
        frameMs: +median(runs.map((r) => r.frame)).toFixed(1),
        idleMs: +median(runs.map((r) => r.idle)).toFixed(1),
        runs: runs.map((r) => +r.frame.toFixed(0)),
      },
    ]),
  );
  console.log(
    `[perf NFR-001 3D] rows=${total} withGeometry=${geometry} value=${value.value} (${value.count}) ` +
      JSON.stringify(summary),
  );
  for (const [k, sum] of Object.entries(summary)) {
    expect(sum.appliedMs, `${k}: click -> state() updated (engine calls done)`).toBeLessThan(BUDGET_MS);
    expect(sum.firstFrameMs, `${k}: click -> next drawn frame shows the change`).toBeLessThan(BUDGET_MS);
    expect(sum.frameMs, `${k}: click -> last changed frame (complete result)`).toBeLessThan(BUDGET_MS);
  }
  expect(errors).toEqual([]);
});
