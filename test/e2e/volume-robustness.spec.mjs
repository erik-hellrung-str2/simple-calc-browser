// T7 robustness with thousands of properties (spec Testing T7: "6,859-property model + volume set: column store holds
// only in-use properties, peak heap reported"; spec 4.3 column store). The volume set (4 x fetched Revit MEP +
// SampleCastle, >= 30,000 elements, Testing -> Test data) is loaded; the catalogue has thousands of properties.
// Asserted: the column store holds exactly the properties in use (filter sets, column filters, sort, grouping,
// colouring) after each change, and drops each again when it is no longer used; the page heap stays bounded.
// Recorded: catalogue size per model, peak JS heap of the page (CDP, polled during load and use).
// Runs in the `file` project only (fetched fixtures, the user's path), never at the same time as a perf spec.
import { test, expect } from "../support/perf-lock.mjs";
import { fetched, loadFiles, openBuilder } from "../support/builder.mjs";
import { colourBy, idle } from "../support/view-3d.mjs";

const MEP = fetched("Ifc4_Revit_MEP.ifc");
const CASTLE = fetched("Ifc2x3_SampleCastle.ifc");
const DEFAULT_SETS = ["Geschoss", "Kategorie", "Material"]; // REQ-003 default filter sets, sorted

test("@robustness @REQ-004 @REQ-006 thousands of properties (volume set): the column store holds only the properties in use; peak heap reported", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "file", "one run is enough; fetched fixtures, the file project is the user's path");
  test.setTimeout(900_000);
  const errors = await openBuilder(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  let peakHeap = 0;
  let polling = true;
  const poll = (async () => {
    while (polling) {
      try {
        const { metrics } = await cdp.send("Performance.getMetrics");
        const used = metrics.find((m) => m.name === "JSHeapUsedSize");
        if (used && used.value > peakHeap) peakHeap = used.value;
      } catch {
        break;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
  })();

  const perModel = [];
  for (const file of [MEP, CASTLE, MEP, MEP, MEP]) {
    await loadFiles(page, file, 300_000);
    perModel.push(await page.evaluate(() => window.__calc.catalog.length));
  }
  await idle(page);
  const total = await page.evaluate(() => window.__calc.rows.length);
  expect(total).toBeGreaterThanOrEqual(30_000);
  const catalogSize = await page.evaluate(() => window.__calc.catalog.length);
  expect(catalogSize, "thousands of properties").toBeGreaterThanOrEqual(1000);
  const store = () => page.evaluate(() => [...window.__calc.filter.storeColumns].sort());
  expect(await store()).toEqual(DEFAULT_SETS);

  // properties in use one after another: sort, a numeric column filter, grouping, colouring
  const numeric = await page.evaluate(
    () =>
      window.__calc.catalog
        .filter((e) => e.kind === "number" && e.unit !== "gemischt")
        .sort((a, b) => b.count - a.count)[0].key,
  );
  const textKey = await page.evaluate(
    (skip) =>
      window.__calc.catalog
        .filter((e) => e.kind === "text" && !skip.includes(e.key) && e.key !== "Name")
        .sort((a, b) => b.count - a.count)[0].key,
    DEFAULT_SETS,
  );
  const apply = async (fn, arg) => {
    const before = await page.evaluate(() => window.__calc.filter.updates + window.__calc.table.updates);
    await page.evaluate(fn, arg);
    await page.waitForFunction((n) => window.__calc.filter.updates + window.__calc.table.updates > n, before);
  };
  await apply(() => {
    const s = window.CalcTable.state();
    window.CalcTable.setState({ ...s, sort: { key: "Name", dir: "asc" } });
  });
  expect(await store()).toEqual([...DEFAULT_SETS, "Name"].sort());
  await apply((key) => {
    const s = window.CalcTable.state();
    window.CalcTable.setState({
      ...s,
      columns: [...s.columns, { key }],
      columnFilters: [{ key, type: "range", min: 0 }],
    });
  }, numeric);
  expect(await store()).toEqual([...DEFAULT_SETS, "Name", numeric].sort());
  await apply((key) => window.CalcTable.setGrouping({ view: "grouped", groupBy: [key] }), textKey);
  expect(await store()).toEqual([...DEFAULT_SETS, "Name", numeric, textKey].sort());
  await colourBy(page, "Typ", "Typ");
  expect(await store()).toEqual([...DEFAULT_SETS, "Name", numeric, textKey, "Typ"].sort());

  // and released again when no longer used
  await apply(() => window.CalcTable.setGrouping({ view: "single", groupBy: [] }));
  await apply(() => {
    const s = window.CalcTable.state();
    window.CalcTable.setState({ ...s, sort: null, columnFilters: [] });
  });
  await page.getByRole("button", { name: "Färbung entfernen" }).click();
  await expect(page.locator("#cv-colour")).toHaveAccessibleName(/^Färben nach/);
  await idle(page);
  const final = await store();
  expect(final, "sort, filter, grouping and colouring keys dropped").toEqual(DEFAULT_SETS);
  expect(final.length / catalogSize, "only in-use properties are held").toBeLessThan(0.01);

  polling = false;
  await poll;
  const report = {
    rows: total,
    catalogSizeAfterEachModel: perModel,
    catalogSize,
    storeColumnsAtEnd: final,
    peakMainJsHeapMB: Math.round(peakHeap / 1e6),
  };
  console.log(`[robustness properties] ${JSON.stringify(report)}`);
  info.annotations.push({ type: "t7-properties", description: JSON.stringify(report) });
  expect(peakHeap, "page heap bounded").toBeLessThan(2e9);
  expect(errors).toEqual([]);
});
