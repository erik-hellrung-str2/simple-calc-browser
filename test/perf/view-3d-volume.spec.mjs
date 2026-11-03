// NFR-001 3D part at the volume set of the spec (Testing -> Test data: >= 30,000 elements; TASK-006a: four copies of
// the fetched Revit MEP model plus SampleCastle, 30,931 rows in 5 models), R-4 settle (TASK-010 pre-work). A filter
// click on the largest Kategorie value, measured in the page from the click event's timestamp (performance clock,
// test/support/perf-measure.mjs measureViewClick), 5 runs per action in ghost mode (check, uncheck) and hide mode,
// 3 with colouring by Kategorie:
//   changed = changed frames per click: cv-3d waits until every model that got calls shows them (SETTLE_MS) and
//             draws one complete frame                                                           -> asserted: one in most runs
//   frame   = the last changed frame drawn (complete frame)                                     -> asserted: median <= 500 ms
//   applied, first, idle                                                                         -> recorded
//   shown   = the animation frame after the last changed frame: pixels on screen. Q-002 (is this or the complete
//             frame "interaction done" for NFR-001?) is open, so it is recorded only; one software-WebGL frame of
//             30,000 elements alone costs 550-700 ms (docs/spikes/R-4.md).
// Runs in the `file` project only (the user's path), never at the same time as another perf spec (perf-lock);
// Chromium headless with software WebGL.
import { test, expect } from "../support/perf-lock.mjs";
import { fetched, loadFiles, openBuilder } from "../support/builder.mjs";
import { filterSet } from "../support/filter-area.mjs";
import { colourBy, idle, viewState } from "../support/view-3d.mjs";
import { measureViewClick, summariseViewClicks } from "../support/perf-measure.mjs";

const BUDGET_MS = 500; // NFR-001

test("@perf @NFR-001 @REQ-005 volume set (>= 30,000 elements): a filter click draws one complete 3D frame within 500 ms", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "file", "one run is enough; the file project is the user's path");
  test.setTimeout(900_000);
  const errors = await openBuilder(page);
  for (let i = 0; i < 4; i++) await loadFiles(page, fetched("Ifc4_Revit_MEP.ifc"), 300_000);
  await loadFiles(page, fetched("Ifc2x3_SampleCastle.ifc"), 300_000);
  await idle(page);
  const total = await page.evaluate(() => window.__calc.rows.length);
  const geometry = await page.evaluate(() => window.__calc.rows.filter((r) => r.geometry).length);
  expect(total).toBeGreaterThanOrEqual(30_000);

  // the Kategorie value with the most elements: the largest change of the 3D state per click, in all 5 models
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

  const results = { check: [], uncheck: [], hide: [], coloured: [] };
  for (let i = 0; i < 5; i++) {
    results.check.push(await measureViewClick(page, () => box.click()));
    let state = await viewState(page);
    expect(state.opaque.length).toBe(await insideWithGeometry());
    expect(state.ghost.length).toBe(geometry - state.opaque.length);
    results.uncheck.push(await measureViewClick(page, () => box.click()));
    state = await viewState(page);
    expect(state.opaque.length).toBe(geometry);
  }
  await page.getByRole("radio", { name: "Ausblenden" }).click();
  for (let i = 0; i < 5; i++) {
    results.hide.push(await measureViewClick(page, () => box.click()));
    expect((await viewState(page)).hidden.length).toBe(geometry - (await insideWithGeometry()));
    await box.click();
  }
  await page.getByRole("radio", { name: "Geist" }).click();
  await colourBy(page, "Kategorie", "Kategorie");
  for (let i = 0; i < 3; i++) {
    results.coloured.push(await measureViewClick(page, () => box.click()));
    const state = await viewState(page);
    expect(Object.keys(state.colours).length).toBe(state.opaque.length);
    await box.click();
  }
  await idle(page);

  const summary = summariseViewClicks(results);
  const report = { total, withGeometry: geometry, value: value.value, count: value.count, summary };
  console.log(`[perf NFR-001 3D volume] ${JSON.stringify(report)}`);
  info.annotations.push({ type: "view-3d-volume-perf", description: JSON.stringify(report) });
  for (const [k, sum] of Object.entries(summary)) {
    for (const n of sum.frames) expect(n, `${k}: every click draws a changed frame`).toBeGreaterThan(0);
    expect(sum.oneFrameRuns, `${k}: runs with exactly one changed frame ${sum.frames}`).toBeGreaterThan(
      sum.frames.length / 2,
    );
    expect(sum.frameMs, `${k}: click -> last changed frame (complete frame), median`).toBeLessThanOrEqual(BUDGET_MS);
  }
  expect(errors).toEqual([]);
});
