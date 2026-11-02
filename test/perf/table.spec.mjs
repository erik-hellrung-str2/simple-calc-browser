// TASK-006a table performance (REQ-006 "rows rendered virtualised", NFR-001 sort part) on the volume set of the spec
// (Testing -> Test data: >= 30,000 elements from several fixtures/copies): four copies of the fetched Revit MEP model
// plus SampleCastle. Measured in the page (performance clock), numbers printed and attached to the test:
//   scroll jumps     60 jumps to positions spread over the whole table: render time per jump (CalcTable.stats)
//   scroll smooth    200 animation frames with scrollTop += 120 px per frame: render time and frame interval
//   sort             header click (input event timeStamp) -> table updated (window.__calc.table.at, stamped by
//                    the update) and the next frame drawn, from a settled 3D view (test/support/perf-measure.mjs);
//                    median of 3 per direction, text column `Name` and a numeric column; the first (cold) sort builds
//                    the column
//   column filter    a checklist click in the Kategorie column filter -> table updated (asserted) and next frame
//                    (recorded; it can include the 3D redraw of 30,000 elements, TASK-010)
// Runs in the `file` project only (the user's path), never at the same time as another perf spec (test/support/
// perf-lock.mjs); Chromium headless with software WebGL.
import { test, expect } from "../support/perf-lock.mjs";
import { fetched, loadFiles, openBuilder } from "../support/builder.mjs";
import { idle } from "../support/view-3d.mjs";
import { measureInput } from "../support/perf-measure.mjs";
import { header, openColumnFilter } from "../support/table.mjs";

const BUDGET_MS = 500; // NFR-001
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const pct = (xs, p) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))];
const r1 = (x) => Math.round(x * 10) / 10;

/** Waits until the 3D view is idle and measures one input (test/support/perf-measure.mjs). */
const measure = measureInput;

test("@perf @REQ-006 @NFR-001 volume set (>= 30,000 elements): table scroll renders in a few ms; sort and column filter within 500 ms", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "file", "one run is enough; the file project is the user's path");
  test.setTimeout(900_000);
  const errors = await openBuilder(page);
  const t0 = Date.now();
  for (let i = 0; i < 4; i++) await loadFiles(page, fetched("Ifc4_Revit_MEP.ifc"), 300_000);
  await loadFiles(page, fetched("Ifc2x3_SampleCastle.ifc"), 300_000);
  await idle(page);
  const loadSeconds = (Date.now() - t0) / 1000;
  const total = await page.evaluate(() => window.__calc.rows.length);
  expect(total).toBeGreaterThanOrEqual(30_000);
  await expect(page.locator("#cv-status")).toHaveText(
    `${total.toLocaleString("de-DE")} von ${total.toLocaleString("de-DE")} Elementen`,
  );
  expect(await page.evaluate(() => window.__calc.table.count)).toBe(total);

  // ---- scroll: jumps over the whole table ----
  const jumps = await page.evaluate(async () => {
    const box = document.getElementById("cv-tbl-scroll");
    const frame = () => new Promise((r) => requestAnimationFrame((t) => r(t)));
    const out = [];
    const max = box.scrollHeight - box.clientHeight;
    for (let i = 0; i < 60; i++) {
      box.scrollTop = Math.round((((i * 37) % 60) / 59) * max);
      await frame();
      out.push(window.CalcTable.stats().lastMs);
    }
    return out;
  });
  // ---- scroll: smooth, 120 px per frame ----
  const smooth = await page.evaluate(async () => {
    const box = document.getElementById("cv-tbl-scroll");
    box.scrollTop = 0;
    const frame = () => new Promise((r) => requestAnimationFrame((t) => r(t)));
    let last = await frame();
    const render = [];
    const interval = [];
    for (let i = 0; i < 200; i++) {
      box.scrollTop += 120;
      const t = await frame();
      interval.push(t - last);
      last = t;
      render.push(window.CalcTable.stats().lastMs);
    }
    return { render, interval, nodes: window.CalcTable.stats() };
  });
  const scroll = {
    jumpRenderMedian: r1(median(jumps)),
    jumpRenderMax: r1(Math.max(...jumps)),
    smoothRenderMedian: r1(median(smooth.render)),
    smoothRenderP95: r1(pct(smooth.render, 0.95)),
    smoothFrameMedian: r1(median(smooth.interval)),
    smoothFrameP95: r1(pct(smooth.interval, 0.95)),
    rowNodes: smooth.nodes.rowNodes,
    cellNodes: smooth.nodes.cellNodes,
  };
  expect(scroll.jumpRenderMax).toBeLessThan(16);
  expect(scroll.smoothRenderP95).toBeLessThan(16);
  expect(scroll.smoothFrameP95, "smooth: frames keep coming while scrolling").toBeLessThan(50);
  expect(scroll.rowNodes).toBeLessThan(60);

  // ---- sort: text column Name and a numeric column ----
  const numeric = await page.evaluate(
    () =>
      window.__calc.catalog
        .filter((e) => e.kind === "number" && e.unit !== "gemischt")
        .sort((a, b) => b.count - a.count)[0].key,
  );
  await page.evaluate((key) => {
    const state = window.CalcTable.state();
    state.columns.push({ key });
    window.CalcTable.setState(state);
  }, numeric);
  await page.locator("#cv-tbl-scroll").evaluate((n) => (n.scrollTop = 0));
  const sorts = {};
  for (const key of ["Name", numeric]) {
    const label = header(page, key).locator(".cv-th-label");
    const runs = [];
    for (let i = 0; i < 3; i++) {
      runs.push({ asc: await measure(page, () => label.click()) });
      runs[i].desc = await measure(page, () => label.click());
      runs[i].off = await measure(page, () => label.click());
    }
    sorts[key] = {
      coldAsc: runs[0].asc.frame,
      ascMedian: median(runs.map((r) => r.asc.frame)),
      descMedian: median(runs.map((r) => r.desc.frame)),
      offMedian: median(runs.map((r) => r.off.frame)),
      tableMs: runs.map((r) => r.asc.table),
    };
    for (const r of runs) for (const m of [r.asc, r.desc, r.off]) expect(m.frame).toBeLessThan(BUDGET_MS);
  }
  // sorted order spot check on the numeric column (descending): non-increasing numbers, empty last
  await header(page, numeric).locator(".cv-th-label").click();
  await header(page, numeric).locator(".cv-th-label").click();
  const order = await page.evaluate((key) => {
    const rows = window.__calc.rows;
    const byKey = new Map(rows.map((r) => [r.key, r.values[key]]));
    return window.__calc.table.keys.map((k) => byKey.get(k));
  }, numeric);
  const filled = order.filter((v) => typeof v === "number");
  expect(order.slice(0, filled.length)).toEqual(filled);
  for (let i = 1; i < filled.length; i++) expect(filled[i]).toBeLessThanOrEqual(filled[i - 1]);

  // ---- column filter: a Kategorie checklist click (table, filter sets and 3D follow) ----
  const popup = await openColumnFilter(page, "Kategorie");
  const value = await page.evaluate(() => {
    const values = window.__calc.filter.facets.Kategorie.values.filter((v) => v.value !== null);
    return values.sort((a, b) => b.count - a.count)[0].value;
  });
  await popup.getByRole("searchbox").fill(value);
  const box = popup.getByRole("checkbox", { name: value, exact: true });
  const filterRuns = [];
  for (let i = 0; i < 3; i++) {
    filterRuns.push(await measure(page, () => box.click()));
    filterRuns.push(await measure(page, () => box.click()));
  }
  // a filter click also redraws the 3D view of 30,000 elements; the next frame can include that redraw (software
  // WebGL), which is the end-to-end NFR-001 measurement of TASK-010 (recorded here). Asserted: the table part.
  for (const m of filterRuns) expect(m.updated).toBeLessThan(BUDGET_MS);
  const columnFilter = {
    medianUpdated: median(filterRuns.map((m) => m.updated)),
    medianFrame: median(filterRuns.map((m) => m.frame)),
    maxFrame: Math.max(...filterRuns.map((m) => m.frame)),
    tableMs: filterRuns.map((m) => m.table),
  };

  const memory = await page.evaluate(() =>
    performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null,
  );
  const report = { total, models: 5, loadSeconds, scroll, sorts, numeric, columnFilter, heapMB: memory };
  console.log("table perf: " + JSON.stringify(report, null, 1));
  info.annotations.push({ type: "table-perf", description: JSON.stringify(report) });
  expect(errors).toEqual([]);
});
