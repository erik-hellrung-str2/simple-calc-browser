// Display-text index on real models (TASK-011 acceptance "index build time and heap on the 6,859-property model
// recorded"; spec 4.3 display-text index, NFR-001 CR-002 part, R-5). The four fetched models of the spike (§4.8:
// "28k elements (4 models) ... one model had 6,859 distinct pset properties") are loaded into the builder; the cv-core
// of the builder file is imported into the page (Blob module, as the app links it) and builds the index over the
// builder's rows (window.__calc.rows) per model, for the volume set (Testing -> Test data: 4 x Revit MEP +
// SampleCastle, >= 30,000 rows) and for everything loaded, chunked with a yield per chunk as cv-app will run it. Recorded per set: rows, distinct properties, catalogue size, build time, retained heap (CDP heap usage
// after a forced GC) and peak page heap while building; a search over the built index is timed too.
// Asserted: every build finishes without a page error or crash (the model with the most properties included; the
// NFR-002 crash threshold), and on the volume set the build stays within the NFR-001 index target, <= 2 s and
// <= 150 MB extra heap (core build in the page; the end-to-end measurement through the UI is TASK-020's).
// Runs in the `file` project only, never at the same time as another perf spec (perf-lock).
import { readFileSync } from "node:fs";
import { test, expect } from "../support/perf-lock.mjs";
import { fetched, loadFiles, openBuilder } from "../support/builder.mjs";
import { perfEnvironment, sampleMemory } from "../support/perf-memory.mjs";
import { BUILDER_HTML, extractScript } from "../load-core.mjs";

const CASTLE = "Ifc2x3_SampleCastle.ifc";
const MEP = "Ifc4_Revit_MEP.ifc";
// the four fetched models of the spike, then three more Revit MEP copies for the volume set
const MODELS = [CASTLE, MEP, "Ifc4_Revit_ARC.ifc", "Ifc2x3_Duplex_MEP.ifc", MEP, MEP, MEP];
const INDEX_MS = 2000;
const INDEX_MB = 150;
const MB = 1e6;

test("@perf display-text index on real models: build time and heap per fetched model (incl. the model with the most properties) and on the volume set within 2 s and 150 MB", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "file", "one run is enough; fetched fixtures, the file project is the user's path");
  test.setTimeout(600_000);
  const errors = await openBuilder(page);
  for (const file of MODELS) await loadFiles(page, fetched(file), 300_000);
  const coreSource = extractScript(readFileSync(BUILDER_HTML, "utf8"), "cv-core-src");
  await page.evaluate(async (src) => {
    const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
    window.__t011 = { core: await import(url) };
  }, coreSource);
  const cdp = await page.context().newCDPSession(page);
  const heapUsed = async () => {
    await cdp.send("HeapProfiler.collectGarbage");
    return (await cdp.send("Runtime.getHeapUsage")).usedSize;
  };
  const models = await page.evaluate(() => window.__calc.models.map((m) => ({ id: m.id, name: m.name })));
  expect(models.length).toBe(MODELS.length);

  const volumeIds = models.filter((m) => m.name === CASTLE || m.name === MEP).map((m) => m.id);
  const sets = [
    ...models.slice(0, 4).map((m) => ({ label: m.name, ids: [m.id] })),
    { label: "volume set (4 x Revit MEP + SampleCastle)", ids: volumeIds },
    { label: "all loaded", ids: null },
  ];
  const results = [];
  for (const set of sets) {
    await page.evaluate(() => {
      window.__t011.keep = null;
    });
    const before = await heapUsed();
    const memory = await sampleMemory(page);
    const r = await page.evaluate(async (ids) => {
      const { core } = window.__t011;
      const rows = window.__calc.rows.filter((row) => ids === null || ids.includes(row.model));
      const keys = new Set();
      for (const row of rows) for (const key in row.values) keys.add(key);
      const store = core.createColumnStore(rows);
      const t0 = performance.now();
      await store.buildTextIndex({ pause: () => new Promise((resolve) => setTimeout(resolve, 0)) });
      const buildMs = performance.now() - t0;
      const searchMs = [];
      for (const text of ["wand", "door", "1,5"]) {
        const t1 = performance.now();
        core.filterRows(store, [{ type: "search", text }]);
        searchMs.push(performance.now() - t1);
      }
      window.__t011.keep = store.textIndex();
      return { rows: rows.length, properties: keys.size, buildMs, searchMs };
    }, set.ids);
    const { pageHeapMB } = await memory.stop();
    const after = await heapUsed();
    const catalogue = set.ids === null ? await page.evaluate(() => window.__calc.catalog.length) : null;
    results.push({
      set: set.label,
      rows: r.rows,
      properties: r.properties,
      catalogue,
      buildMs: Math.round(r.buildMs),
      extraHeapMB: Math.round(((after - before) / MB) * 10) / 10,
      peakPageHeapMB: pageHeapMB,
      searchMs: r.searchMs.map((x) => Math.round(x * 10) / 10),
    });
  }
  const environment = await perfEnvironment(page);
  const report = { results, environment };
  console.log("[perf] TASK-011 display-text index " + JSON.stringify(report));
  info.annotations.push({ type: "task-011-text-index", description: JSON.stringify(report) });

  expect(errors, "no page error").toEqual([]);
  const most = results.slice(0, 4).sort((a, b) => b.properties - a.properties)[0];
  expect(most.properties, "a model with thousands of properties").toBeGreaterThanOrEqual(1000);
  const volume = results[4];
  expect(volume.rows, "volume set: >= 30,000 elements").toBeGreaterThanOrEqual(30_000);
  expect(volume.buildMs, "index build, volume set").toBeLessThanOrEqual(INDEX_MS);
  expect(volume.extraHeapMB, "index extra heap, volume set").toBeLessThanOrEqual(INDEX_MB);
});
