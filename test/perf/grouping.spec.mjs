// TASK-006b grouping performance (REQ-006 grouping view, NFR-001 "view switch or regrouping ... within 500 ms") on the
// volume set of the spec (Testing -> Test data: >= 30,000 elements): four copies of the fetched Revit MEP model plus
// SampleCastle, with a numeric column (summed per group). Measured in the page from the input event (click
// timeStamp) until the table is updated (window.__calc.table.at, stamped by the update) and until the next frame;
// median of 3 per action:
//   view        `Gruppiert` from the single-element view (grouping by Kategorie), and back
//   level 2     picking Geschoss as level 2 in the catalogue dialog (regrouping), and removing it again
//   expand      `Alle aufklappen` (30,000 element rows) and `Alle zuklappen`
//   filter      a Kategorie filter-set click in the grouping view (filter sets, table and 3D follow; the frame can
//               include the 3D redraw of 30,000 elements, which is TASK-010's end-to-end measurement: recorded only)
//   sort        the numeric column ascending (groups by their sums)
// Runs in the `file` project only, never at the same time as another perf spec (test/support/perf-lock.mjs).
import { test, expect } from "../support/perf-lock.mjs";
import { fetched, loadFiles, openBuilder } from "../support/builder.mjs";
import { filterSet } from "../support/filter-area.mjs";
import { idle } from "../support/view-3d.mjs";
import { measureInput } from "../support/perf-measure.mjs";
import { header } from "../support/table.mjs";

const BUDGET_MS = 500; // NFR-001
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

/** Waits until the 3D view is idle and measures one input (test/support/perf-measure.mjs). */
const measure = measureInput;

const summary = (runs) => ({
  medianUpdated: median(runs.map((m) => m.updated)),
  medianFrame: median(runs.map((m) => m.frame)),
  maxUpdated: Math.max(...runs.map((m) => m.updated)),
  tableMs: runs.map((m) => m.table),
});

test("@perf @REQ-006 @NFR-001 volume set (>= 30,000 elements): grouping, regrouping, expand all, filter and sort in the grouping view within 500 ms", async ({
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
  // a numeric column summed per group: the numeric property with most values
  const numeric = await page.evaluate(() => {
    const key = window.__calc.catalog
      .filter((e) => e.kind === "number" && e.unit !== "gemischt")
      .sort((a, b) => b.count - a.count)[0].key;
    const state = window.CalcTable.state();
    state.columns.push({ key });
    window.CalcTable.setState(state);
    return key;
  });

  // ---- view switch ----
  const grouped = page.getByRole("radio", { name: "Gruppiert", exact: true });
  const single = page.getByRole("radio", { name: "Einzelelemente", exact: true });
  const viewRuns = [];
  const backRuns = [];
  for (let i = 0; i < 3; i++) {
    viewRuns.push(await measure(page, () => grouped.click()));
    backRuns.push(await measure(page, () => single.click()));
  }
  await grouped.click();
  const groups1 = await page.evaluate(() => window.__calc.table.groups);
  expect(groups1).toBeGreaterThan(5);

  // ---- regrouping: level 2 = Geschoss through the catalogue dialog, then removed ----
  const level2Runs = [];
  const removeRuns = [];
  for (let i = 0; i < 3; i++) {
    await page.locator("#cv-group-2").click();
    const dialog = page.getByRole("dialog", { name: "Gruppieren nach (Ebene 2)" });
    await dialog.getByRole("searchbox", { name: "Eigenschaft suchen" }).fill("Geschoss");
    level2Runs.push(await measure(page, () => dialog.locator('.cv-cat-entry[data-key="Geschoss"]').click()));
    removeRuns.push(await measure(page, () => page.locator("#cv-group-2-clear").click()));
  }
  await page.locator("#cv-group-2").click();
  const dialog = page.getByRole("dialog", { name: "Gruppieren nach (Ebene 2)" });
  await dialog.getByRole("searchbox", { name: "Eigenschaft suchen" }).fill("Geschoss");
  await dialog.locator('.cv-cat-entry[data-key="Geschoss"]').click();
  const groups2 = await page.evaluate(() => window.__calc.table.groups);
  expect(groups2).toBeGreaterThan(groups1);

  // ---- expand / collapse all ----
  const expandRuns = [];
  const collapseRuns = [];
  for (let i = 0; i < 3; i++) {
    expandRuns.push(await measure(page, () => page.locator("#cv-expand-all").click()));
    collapseRuns.push(await measure(page, () => page.locator("#cv-collapse-all").click()));
  }
  for (const m of expandRuns) expect(m.rows).toBe(groups2 + total);

  // ---- filter click in the grouping view ----
  const value = await page.evaluate(() => {
    const values = window.__calc.filter.facets.Kategorie.values.filter((v) => v.value !== null);
    return values.sort((a, b) => b.count - a.count)[0].value;
  });
  const set = filterSet(page, "Kategorie");
  await set.getByRole("searchbox").fill(value);
  const box = set.getByRole("checkbox", { name: value, exact: true });
  const filterRuns = [];
  for (let i = 0; i < 3; i++) {
    filterRuns.push(await measure(page, () => box.click()));
    filterRuns.push(await measure(page, () => box.click()));
  }

  // ---- sort the numeric column (groups by their sums) ----
  const label = header(page, numeric).locator(".cv-th-label");
  const sortRuns = [];
  for (let i = 0; i < 3; i++) {
    sortRuns.push(await measure(page, () => label.click())); // ascending
    await label.click(); // descending
    await label.click(); // off
  }

  const results = {
    view: summary(viewRuns),
    back: summary(backRuns),
    level2: summary(level2Runs),
    removeLevel2: summary(removeRuns),
    expandAll: summary(expandRuns),
    collapseAll: summary(collapseRuns),
    filter: summary(filterRuns),
    sort: summary(sortRuns),
  };
  const memory = await page.evaluate(() =>
    performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null,
  );
  const report = {
    total,
    loadSeconds,
    numeric,
    groups1,
    groups2,
    results,
    runs: { viewRuns, level2Runs, filterRuns, sortRuns },
    heapMB: memory,
  };
  console.log("grouping perf: " + JSON.stringify(report, null, 1));
  info.annotations.push({ type: "grouping-perf", description: JSON.stringify(report) });
  // NFR-001: every grouping interaction updates the table within 500 ms (input event -> table rendered)
  for (const runs of [viewRuns, backRuns, level2Runs, removeRuns, expandRuns, collapseRuns, filterRuns, sortRuns])
    for (const m of runs) expect(m.updated).toBeLessThan(BUDGET_MS);
  // grouping-only interactions (no 3D change): also the next frame within 500 ms
  for (const runs of [viewRuns, backRuns, level2Runs, removeRuns, expandRuns, collapseRuns, sortRuns])
    for (const m of runs) expect(m.frame).toBeLessThan(BUDGET_MS);
  expect(errors).toEqual([]);
});
