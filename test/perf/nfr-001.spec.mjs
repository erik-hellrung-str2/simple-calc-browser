// NFR-001 interaction speed, formal measurement (TASK-010, spec T6 "NFR-001 on the volume set"): "with >= 30,000
// elements loaded, a filter click, column filter change, sort, view switch or regrouping updates filter sets, table
// and 3D state within <= 500 ms, measured from the input event until all three show the new result (performance
// marks); median of 3, Chromium. Includes filter sets on `Name` and `GlobalId` (about one value per element) and
// opening the `Name` column-filter checklist."
// Volume set (Testing -> Test data): four copies of the fetched Revit MEP model plus SampleCastle, 30,931 rows.
// Each input is a real click; measured in the page from the click event's timeStamp (test/support/perf-measure.mjs
// measureInteraction): done = max(filter sets updated, table rendered, last changed 3D frame drawn). Q-002 (answered
// 2026-11-02): for the 3D part "done" is the last changed frame drawn; pixels on screen (`shown`) is recorded only (in
// software WebGL one frame of 30,000 elements costs 0.5-0.7 s; deviation recorded in docs/tasks/TASK-010.md).
// Actions, median of 3 runs each (asserted <= 500 ms):
//   filter set     Kategorie: check / uncheck the value with the most elements (ghost mode)
//   Name set       a filter set on Name (one value per element): check / uncheck a value
//   GlobalId set   a filter set on GlobalId: check / uncheck a value
//   column filter  the Kategorie column checklist: check / uncheck the largest value
//   sort           the Name column: ascending, descending, off
//   view switch    `Gruppiert` (grouping by Kategorie) and back to `Einzelelemente`
//   regrouping     level 2 = Geschoss through the catalogue dialog, and removed again
//   selection      a table row click (element highlighted in 3D, details shown)
//   checklist      opening the Name column-filter checklist (click -> list rendered)
// Each result is also checked for correctness (filter counts against the rows). Runs in the `file` project only (the
// user's path), never at the same time as another perf spec (perf-lock); Chromium headless with software WebGL.
import { test, expect } from "../support/perf-lock.mjs";
import { REF, fetched, loadFiles, openBuilder } from "../support/builder.mjs";
import { addFilterSet, filterSet } from "../support/filter-area.mjs";
import { idle } from "../support/view-3d.mjs";
import { measureInteraction, summariseInteractions } from "../support/perf-measure.mjs";
import { header, openColumnFilter } from "../support/table.mjs";
import { clickRow } from "../support/selection.mjs";
import { perfEnvironment } from "../support/perf-memory.mjs";

const BUDGET_MS = 500; // NFR-001
const RUNS = 3;
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const NAME_VALUE = REF["NFR-001-name-filter"].filter.Name[0]; // a Name with a few elements (reference-values.json)

/** Number of rows whose property key has value (independent of the filter engine). */
const rowsWith = (page, key, value) =>
  page.evaluate(
    ({ key, value }) =>
      window.__calc.rows.filter((r) => {
        const v = r.values[key];
        return Array.isArray(v) ? v.includes(value) : v === value;
      }).length,
    { key, value },
  );

test("@perf @NFR-001 volume set (>= 30,000 elements): filter sets, column filter, sort, view switch, regrouping, selection and the Name checklist within 500 ms (median of 3)", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "file", "one run is enough; the file project is the user's path");
  test.setTimeout(1_500_000);
  const errors = await openBuilder(page);
  const environment = await perfEnvironment(page);
  for (let i = 0; i < 4; i++) await loadFiles(page, fetched("Ifc4_Revit_MEP.ifc"), 300_000);
  await loadFiles(page, fetched("Ifc2x3_SampleCastle.ifc"), 300_000);
  await idle(page);
  const total = await page.evaluate(() => window.__calc.rows.length);
  expect(total).toBeGreaterThanOrEqual(30_000);
  // TASK-020 (CR-002 "re-measured for 1.1.0 with the table at full width"): no details column, the table ends at the
  // window's right edge
  const tableBox = await page.locator("#cv-table").boundingBox();
  const width = await page.evaluate(() => window.innerWidth);
  expect(Math.abs(tableBox.x + tableBox.width - width), "table right edge = window right edge").toBeLessThanOrEqual(1);
  const results = {};
  const measure = (name, action) =>
    measureInteraction(page, action).then((m) => {
      (results[name] = results[name] || []).push(m);
      return m;
    });

  // ---- filter set Kategorie ----
  const kat = await page.evaluate(() => {
    const values = window.__calc.filter.facets.Kategorie.values.filter((v) => v.value !== null);
    return values.sort((a, b) => b.count - a.count)[0];
  });
  await filterSet(page, "Kategorie").getByRole("searchbox").fill(kat.value);
  const katBox = filterSet(page, "Kategorie").getByRole("checkbox", { name: kat.value, exact: true });
  for (let i = 0; i < RUNS; i++) {
    expect((await measure("filterSet check", () => katBox.click())).count).toBe(kat.count);
    expect((await measure("filterSet uncheck", () => katBox.click())).count).toBe(total);
  }
  await filterSet(page, "Kategorie").getByRole("searchbox").fill("");

  // ---- filter sets on Name and GlobalId (about one value per element) ----
  await addFilterSet(page, "Name", "Name");
  await filterSet(page, "Name").getByRole("searchbox").fill(NAME_VALUE);
  const nameBox = filterSet(page, "Name").getByRole("checkbox", { name: NAME_VALUE, exact: true });
  const nameCount = await rowsWith(page, "Name", NAME_VALUE);
  expect(nameCount).toBeGreaterThan(0);
  for (let i = 0; i < RUNS; i++) {
    expect((await measure("Name set check", () => nameBox.click())).count).toBe(nameCount);
    expect((await measure("Name set uncheck", () => nameBox.click())).count).toBe(total);
  }
  await addFilterSet(page, "GlobalId", "GlobalId");
  const guid = REF["NFR-001-name-filter"].expectedGlobalIds[0];
  const guidCount = await rowsWith(page, "GlobalId", guid);
  expect(guidCount).toBeGreaterThan(0);
  await filterSet(page, "GlobalId").getByRole("searchbox").fill(guid);
  const guidBox = filterSet(page, "GlobalId").getByRole("checkbox", { name: guid, exact: true });
  for (let i = 0; i < RUNS; i++) {
    expect((await measure("GlobalId set check", () => guidBox.click())).count).toBe(guidCount);
    expect((await measure("GlobalId set uncheck", () => guidBox.click())).count).toBe(total);
  }
  const facetSizes = await page.evaluate(() => ({
    Name: window.__calc.filter.facets.Name.values.length,
    GlobalId: window.__calc.filter.facets.GlobalId.values.length,
  }));

  // ---- column filter: Kategorie checklist ----
  const popup = await openColumnFilter(page, "Kategorie");
  await popup.getByRole("searchbox").fill(kat.value);
  const colBox = popup.getByRole("checkbox", { name: kat.value, exact: true });
  for (let i = 0; i < RUNS; i++) {
    expect((await measure("column filter check", () => colBox.click())).count).toBe(kat.count);
    expect((await measure("column filter uncheck", () => colBox.click())).count).toBe(total);
  }
  await page.keyboard.press("Escape");
  await expect(popup).toBeHidden();

  // ---- sort: Name ----
  const sortLabel = header(page, "Name").locator(".cv-th-label");
  for (let i = 0; i < RUNS; i++) {
    await measure("sort asc", () => sortLabel.click());
    await measure("sort desc", () => sortLabel.click());
    await measure("sort off", () => sortLabel.click());
  }

  // ---- view switch and regrouping ----
  const grouped = page.getByRole("radio", { name: "Gruppiert", exact: true });
  const single = page.getByRole("radio", { name: "Einzelelemente", exact: true });
  for (let i = 0; i < RUNS; i++) {
    await measure("view grouped", () => grouped.click());
    await measure("view single", () => single.click());
  }
  await grouped.click();
  await idle(page);
  const groups1 = await page.evaluate(() => window.__calc.table.groups);
  for (let i = 0; i < RUNS; i++) {
    await page.locator("#cv-group-2").click();
    const dialog = page.getByRole("dialog", { name: "Gruppieren nach (Ebene 2)" });
    await dialog.getByRole("searchbox", { name: "Eigenschaft suchen" }).fill("Geschoss");
    await measure("regroup level 2", () => dialog.locator('.cv-cat-entry[data-key="Geschoss"]').click());
    expect(await page.evaluate(() => window.__calc.table.groups)).toBeGreaterThan(groups1);
    await measure("regroup remove level 2", () => page.locator("#cv-group-2-clear").click());
    expect(await page.evaluate(() => window.__calc.table.groups)).toBe(groups1);
  }
  await single.click();
  await idle(page);

  // ---- selection: a table row click ----
  // rows with 3D geometry at the start, middle and end of the table (the highlight changes the 3D view)
  const keys = await page.evaluate(() => {
    const geometry = new Set(window.__calc.rows.filter((r) => r.geometry).map((r) => r.key));
    const k = window.__calc.table.keys.filter((key) => geometry.has(key));
    return [k[Math.floor(k.length * 0.1)], k[Math.floor(k.length * 0.5)], k[Math.floor(k.length * 0.9)]];
  });
  for (const key of keys) {
    expect((await measure("selection row click", () => clickRow(page, key))).selected).not.toBeNull();
    expect(await page.evaluate(() => [...window.CalcView.state().selected])).toEqual([key]);
  }
  await page.keyboard.press("Escape");
  await idle(page);

  // ---- opening the Name column-filter checklist: click -> list rendered ----
  const checklist = [];
  for (let i = 0; i < RUNS; i++) {
    await idle(page);
    await page.evaluate(() => {
      window.__t0 = null;
      window.__shownAt = null;
      document.addEventListener("click", (e) => (window.__t0 = e.timeStamp), { capture: true, once: true });
      const observer = new MutationObserver(() => {
        const pop = document.querySelector('#cv-colfilter[data-key="Name"]');
        if (pop && !pop.hidden && pop.querySelector('input[type="checkbox"]')) {
          window.__shownAt = performance.now();
          observer.disconnect();
        }
      });
      observer.observe(document.body, { subtree: true, childList: true, attributes: true });
    });
    await header(page, "Name").locator(".cv-th-filter").click();
    const popupName = page.locator('#cv-colfilter[data-key="Name"]');
    await expect(popupName).toBeVisible();
    const m = await page.evaluate(async () => {
      await new Promise((r) => requestAnimationFrame((t) => r(t)));
      const painted = await new Promise((r) => requestAnimationFrame((t) => r(t)));
      return { done: window.__shownAt - window.__t0, shown: painted - window.__t0 };
    });
    expect(await popupName.locator('input[type="checkbox"]').count()).toBeLessThan(60); // virtualised
    checklist.push({ done: Math.round(m.done * 10) / 10, shown: Math.round(m.shown * 10) / 10 });
    await page.keyboard.press("Escape");
    await expect(popupName).toBeHidden();
  }

  const summary = Object.fromEntries(Object.entries(results).map(([k, runs]) => [k, summariseInteractions(runs)]));
  summary["open Name checklist"] = {
    done: median(checklist.map((c) => c.done)),
    doneMax: Math.max(...checklist.map((c) => c.done)),
    shown: median(checklist.map((c) => c.shown)),
    runs: checklist.map((c) => Math.round(c.done)),
  };
  const heapMB = await page.evaluate(() =>
    performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null,
  );
  const report = {
    total,
    tableWidth: Math.round(tableBox.width),
    kategorie: kat,
    facetSizes,
    environment,
    heapMB,
    summary,
  };
  console.log(`[perf NFR-001] ${JSON.stringify(report)}`);
  info.annotations.push({ type: "nfr-001", description: JSON.stringify(report) });
  for (const [k, s] of Object.entries(summary))
    expect(s.done, `${k}: input -> filter sets, table and 3D done (median of ${RUNS})`).toBeLessThanOrEqual(BUDGET_MS);
  expect(errors).toEqual([]);
});
