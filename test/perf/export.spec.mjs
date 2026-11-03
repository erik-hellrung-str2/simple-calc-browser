// NFR-004 export duration (TASK-008, spec T6): CSV and Excel export of the volume set (Testing -> Test data: four
// copies of the fetched Revit MEP model plus SampleCastle, >= 30,000 elements) with 20 visible columns, through the
// buttons `Export CSV` / `Export Excel`. Measured per export, median of 3 per format (single-element view):
//   click -> download   Node clock from the click to the download event                   -> asserted <= 5 s
//   export.ms           in the page, from the start of the export to the download offered  -> recorded
//   longest task        PerformanceObserver 'longtask' during the export                     -> asserted < 1 s
//   progress            the overlay showed the export step while it ran                      -> asserted
// Plus one export per format of the grouping view with every group expanded (all elements, group and total rows).
// The files are read back (row and column counts) by test/support/read-export.py. Runs in the `file` project only,
// never at the same time as another perf spec (perf-lock); Chromium headless.
import { test, expect } from "../support/perf-lock.mjs";
import { fetched, loadFiles, openBuilder } from "../support/builder.mjs";
import { idle } from "../support/view-3d.mjs";
import { setView } from "../support/grouping.mjs";
import { readExport } from "../support/export.mjs";

const BUDGET_MS = 5000; // NFR-004
const LONG_TASK_MS = 1000; // NFR-004: no main-thread block > 1 s
const COLUMN_COUNT = 20;
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

/** One export through its button: timings, longest task, progress texts seen, the saved file. */
async function measureExport(page, format, path) {
  const name = format === "csv" ? "Export CSV" : "Export Excel";
  await page.evaluate(() => {
    window.__perf = { longest: 0, tasks: 0, progress: [] };
    window.__perfObserver = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        window.__perf.tasks++;
        window.__perf.longest = Math.max(window.__perf.longest, e.duration);
      }
    });
    window.__perfObserver.observe({ type: "longtask" });
    window.__perfMutations = new MutationObserver(() => {
      const text = document.getElementById("cv-overlay-text")?.textContent || "";
      if (/Export/.test(text)) window.__perf.progress.push(text);
    });
    window.__perfMutations.observe(document.getElementById("cv-overlay"), {
      subtree: true,
      childList: true,
      characterData: true,
    });
  });
  const before = await page.evaluate(() => window.__calc.export.count);
  const t0 = Date.now();
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 60_000 }),
    page.getByRole("button", { name, exact: true }).click(),
  ]);
  const clickToDownload = Date.now() - t0;
  await page.waitForFunction((n) => window.__calc.export.count > n, before);
  await download.saveAs(path);
  await page.waitForTimeout(100); // let the observer deliver the last entries
  const perf = await page.evaluate(() => {
    window.__perfObserver.disconnect();
    window.__perfMutations.disconnect();
    return { ...window.__perf, last: window.__calc.export.last };
  });
  return { clickToDownload, ...perf, path };
}

test("@perf @NFR-004 @REQ-008 volume set (>= 30,000 rows) x 20 columns: CSV and Excel export each within 5 s, no main-thread block > 1 s, progress shown", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "file", "one run is enough; the file project is the user's path");
  test.setTimeout(1_200_000);
  const errors = await openBuilder(page);
  for (let i = 0; i < 4; i++) await loadFiles(page, fetched("Ifc4_Revit_MEP.ifc"), 300_000);
  await loadFiles(page, fetched("Ifc2x3_SampleCastle.ifc"), 300_000);
  await idle(page);
  const total = await page.evaluate(() => window.__calc.rows.length);
  expect(total).toBeGreaterThanOrEqual(30_000);

  // 20 columns: the 4 default columns plus the 16 properties with the most values (numbers first, then texts)
  const columns = await page.evaluate((n) => {
    const current = window.CalcTable.state().columns.map((c) => c.key);
    const rest = window.__calc.catalog
      .filter((e) => !current.includes(e.key))
      .sort((a, b) => (a.kind === "number") - (b.kind === "number") || a.count - b.count)
      .reverse()
      .slice(0, n - current.length)
      .map((e) => e.key);
    return current.concat(rest);
  }, COLUMN_COUNT);
  expect(columns).toHaveLength(COLUMN_COUNT);
  await page.evaluate((keys) => window.CalcTable.setState({ columns: keys.map((key) => ({ key })) }), columns);
  await idle(page);
  expect(await page.evaluate(() => window.__calc.table.count)).toBe(total);

  const runs = { csv: [], xlsx: [] };
  for (let i = 0; i < 3; i++)
    for (const format of ["csv", "xlsx"])
      runs[format].push(await measureExport(page, format, info.outputPath(`volume-${i}.${format}`)));

  // grouping view, every group expanded: all elements plus group rows and the total row
  await setView(page, "Gruppiert");
  await page.locator("#cv-expand-all").click();
  await page.waitForFunction((n) => window.__calc.table.count > n, total);
  const groupedRows = await page.evaluate(() => window.__calc.table.count);
  const grouped = {};
  for (const format of ["csv", "xlsx"])
    grouped[format] = await measureExport(page, format, info.outputPath(`volume-grouped.${format}`));

  const summary = (list) => ({
    clickToDownloadMedian: median(list.map((r) => r.clickToDownload)),
    clickToDownloadMax: Math.max(...list.map((r) => r.clickToDownload)),
    exportMsMedian: Math.round(median(list.map((r) => r.last.ms))),
    longestTaskMax: Math.round(Math.max(...list.map((r) => r.longest))),
  });
  const report = {
    rows: total,
    columns: COLUMN_COUNT,
    csv: summary(runs.csv),
    xlsx: summary(runs.xlsx),
    grouped: {
      rows: groupedRows,
      csv: summary([grouped.csv]),
      xlsx: summary([grouped.xlsx]),
    },
  };
  console.log("NFR-004 export:", JSON.stringify(report));
  await info.attach("nfr-004-export.json", { body: JSON.stringify(report, null, 2), contentType: "application/json" });

  for (const format of ["csv", "xlsx"]) {
    for (const r of [...runs[format], grouped[format]]) {
      expect(r.last.ok).toBe(true);
      expect(r.longest, `${format} longest task`).toBeLessThan(LONG_TASK_MS);
      expect(r.progress.length, `${format} progress shown`).toBeGreaterThan(0);
    }
    expect(report[format].clickToDownloadMedian, `${format} median`).toBeLessThanOrEqual(BUDGET_MS);
    expect(report.grouped[format].clickToDownloadMedian, `${format} grouped`).toBeLessThanOrEqual(BUDGET_MS);
    expect(runs[format][0].last).toMatchObject({ rows: total, columns: COLUMN_COUNT, view: "single" });
    expect(grouped[format].last).toMatchObject({ rows: groupedRows + 1, columns: COLUMN_COUNT + 3, view: "grouped" });
  }
  // the files are complete: every row and column read back
  const csv = readExport("csv", runs.csv[0].path);
  expect(csv.records).toHaveLength(total + 1);
  expect(csv.records.every((r) => r.length === COLUMN_COUNT)).toBe(true);
  const x = readExport("xlsx-summary", runs.xlsx[0].path);
  expect(x.testzip).toBeNull();
  expect([x.rowCount, x.columnCount]).toEqual([total + 1, COLUMN_COUNT]);
  expect(x.numericCells).toBeGreaterThan(0);
  const gx = readExport("xlsx-summary", grouped.xlsx.path);
  expect(gx.rowCount).toBe(groupedRows + 2);
  expect(errors).toEqual([]);
});
