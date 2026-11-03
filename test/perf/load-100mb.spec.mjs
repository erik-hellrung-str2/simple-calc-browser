// R-2 / NFR-002 smoke (TASK-002): a multi-model set of >= 100 MB (SampleCastle twice + Revit MEP, fetched fixtures)
// converts and extracts in Chromium without worker or tab crash. Records wall time, the main page's peak JS heap
// (CDP Performance.getMetrics, polled) and the row count; the full NFR-002 measurement (median of 3, synthetic
// single file) is TASK-010. Runs in the `file` project only (the user's path; http is covered by the smoke test).
import { statSync, writeFileSync, mkdirSync } from "node:fs";
import { test, expect } from "../support/perf-lock.mjs";
import { fetched, loadFiles, openBuilder } from "../support/builder.mjs";

const SET = ["Ifc2x3_SampleCastle.ifc", "Ifc2x3_SampleCastle.ifc", "Ifc4_Revit_MEP.ifc"].map(fetched);

test("@perf @robustness @REQ-001 @NFR-002 multi-model set >= 100 MB loads without crash (R-2 smoke)", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "file", "one run is enough; the file project is the user's path");
  test.setTimeout(900_000);
  const totalBytes = SET.reduce((sum, f) => sum + statSync(f).size, 0);
  expect(totalBytes).toBeGreaterThanOrEqual(100e6);

  let crashed = false;
  page.on("crash", () => (crashed = true));
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

  const t0 = Date.now();
  await loadFiles(page, SET, 840_000);
  const seconds = (Date.now() - t0) / 1000;
  polling = false;
  await poll;

  const hook = await page.evaluate(() => ({
    models: window.__calc.models.map((m) => ({ modell: m.modell, elements: m.elements, withGeometry: m.withGeometry })),
    rows: window.__calc.rows.length,
    catalog: window.__calc.catalog.length,
    loadErrors: window.__calc.loadErrors,
    modelCount: window.__calc.modelCount,
  }));
  const result = {
    date: new Date().toISOString(),
    files: SET.map((f) => f.split("/").pop()),
    totalMB: +(totalBytes / 1e6).toFixed(1),
    seconds: +seconds.toFixed(1),
    peakMainJsHeapMB: +(peakHeap / 1e6).toFixed(0),
    rows: hook.rows,
    catalogEntries: hook.catalog,
    models: hook.models,
    browser: page.context().browser().version(),
  };
  console.log("[perf] " + JSON.stringify(result));
  mkdirSync("test-results", { recursive: true });
  writeFileSync("test-results/perf-100mb-multi-model.json", JSON.stringify(result, null, 2));

  expect(crashed).toBe(false);
  expect(hook.loadErrors).toEqual([]);
  expect(hook.modelCount).toBe(3);
  expect(hook.models.map((m) => m.modell)).toEqual([
    "Ifc2x3_SampleCastle",
    "Ifc2x3_SampleCastle (2)",
    "Ifc4_Revit_MEP",
  ]);
  expect(hook.models[0].elements).toBe(hook.models[1].elements);
  expect(errors).toEqual([]);
});
