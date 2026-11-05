// NFR-003 viewer file start and size (TASK-009, spec T6), NFR-005 (no request) on large files. For each set the
// builder loads the IFC files, `HTML exportieren` writes the viewer file, and the file is opened 3 times via file:// in
// a new offline context with every request blocked and logged (test/support/viewer.mjs):
//   size ratio   viewer file bytes / sum of the IFC file sizes                    -> asserted <= 40 % for >= 100 MB IFC
//   ready        navigation start -> phase ready (models shown, table, filters) in the page's clock   -> recorded
//   usable       navigation start -> ready and the 3D view idle (first complete frame drawn)
//                                                                     -> asserted median <= 15 s for >= 100 MB IFC
//   export       click on `HTML exportieren` -> download                                              -> recorded
//   requests     every request of the viewer page                                       -> asserted empty (NFR-005)
// The NFR names a viewer file built from >= 100 MB of IFC: the volume set (4 x Revit MEP + SampleCastle, 158.3 MiB,
// >= 30,000 elements; Testing -> Test data). AC20-FZK-Haus and the Duplex model (2.5 / 2.3 MiB) are recorded too: the
// embedded runtime (libraries and app, about 1 MB) dominates their files, so the 40 % ratio does not apply to them
// (recorded, not asserted). TASK-010 adds the synthetic single IFC of NFR-002 (151.8 MB, one model of 10,905 rows).
// TASK-020 (CR-002, NFR-003 "re-measured for 1.1.0 viewer files"): the volume set once more, exported with a search
// text and a `Freie Textsuche` rule. "Usable" then includes the display-text index built at the start and the table
// showing the exported (filtered) state; the expected count is an independent scan of the extracted values (the
// needles are letters only, so only string values can contain them, DEC-19). Runs in the `file` project only, never
// at the same time as another perf spec (perf-lock).
import { statSync } from "node:fs";
import { test, expect } from "../support/perf-lock.mjs";
import { fetched, fixture, loadFiles, openBuilder } from "../support/builder.mjs";
import { idle } from "../support/view-3d.mjs";
import { exportViewer, openViewerFile } from "../support/viewer.mjs";
import { addRule } from "../support/rules.mjs";

const START_BUDGET_MS = 15_000; // NFR-003
const SIZE_BUDGET = 0.4; // NFR-003
const LARGE_IFC = 100 * 1024 * 1024; // NFR-003 applies to viewer files built from >= 100 MB of IFC
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const MB = (n) => Math.round((n / 1024 / 1024) * 10) / 10;

const SETS = {
  "AC20-FZK-Haus": [fixture("AC20-FZK-Haus.ifc")],
  Duplex: [fixture("Ifc2x3_Duplex_Architecture.ifc")],
  "volume set": [...Array(4).fill(fetched("Ifc4_Revit_MEP.ifc")), fetched("Ifc2x3_SampleCastle.ifc")],
  // TASK-010: the synthetic single IFC of NFR-002 (151.8 MB, scripts/fetch-fixtures.mjs)
  "synthetic single IFC": [fetched("synthetic-castle-x3.ifc")],
  // TASK-020: the volume set with active text sources (setup below)
  "volume set with search and Freie Textsuche": [
    ...Array(4).fill(fetched("Ifc4_Revit_MEP.ifc")),
    fetched("Ifc2x3_SampleCastle.ifc"),
  ],
};
const TEXT_SOURCES = { search: "duct", rule: { mode: "text", op: "contains", value: "fitting" } };

/** Rows with some string value containing every needle (any letter case), from the extracted values. */
const scanAll = (page, needles) =>
  page.evaluate(
    (list) =>
      window.__calc.rows.filter((r) =>
        list.every((needle) => {
          const has = (v) =>
            Array.isArray(v) ? v.some(has) : typeof v === "string" && v.toLowerCase().includes(needle);
          return Object.values(r.values).some(has);
        }),
      ).length,
    needles,
  );

for (const [name, files] of Object.entries(SETS)) {
  test(`@perf @NFR-003 @NFR-005 @REQ-010 viewer file of ${name}: size and offline start`, async ({
    page,
    browser,
  }, info) => {
    test.skip(info.project.name !== "file", "one run is enough; the file project is the user's path");
    test.setTimeout(1_500_000);
    const ifcBytes = files.reduce((n, f) => n + statSync(f).size, 0);
    const errors = await openBuilder(page);
    for (const f of files) await loadFiles(page, f, 300_000);
    await idle(page);
    const rows = await page.evaluate(() => window.__calc.rows.length);
    const textSources = name.includes("Freie Textsuche");
    let expectedCount = null;
    if (textSources) {
      await addRule(page, TEXT_SOURCES.rule);
      await page.getByRole("searchbox", { name: "Suchen nach Objekten" }).fill(TEXT_SOURCES.search);
      expectedCount = await scanAll(page, [TEXT_SOURCES.search, TEXT_SOURCES.rule.value]);
      expect(expectedCount).toBeGreaterThan(0);
      expect(expectedCount).toBeLessThan(rows);
      await page.waitForFunction((n) => window.__calc.filter.count === n, expectedCount);
      await idle(page);
    }
    const builderState = await page.evaluate(() => ({
      config: window.CalcConfig.state(),
      count: window.__calc.filter.count,
    }));

    const file = await exportViewer(page, info.outputPath(`${name}.html`));
    expect(file.last.ok).toBe(true);
    await page.close(); // free the builder's memory before the viewer runs

    const opens = [];
    for (let i = 0; i < 3; i++) {
      const viewer = await openViewerFile(browser, file.path, { timeout: 120_000 });
      try {
        const v = viewer.page;
        expect(await v.evaluate(() => window.__calc.error)).toBeNull();
        const timing = await v.evaluate(async () => {
          const ready = window.__calc.viewer.startMs;
          await window.CalcView.whenIdle();
          // TASK-010: frames drawn because the view changed until usable (the start holds frames: recorded only)
          return { ready, usable: performance.now(), frames: window.CalcView.changeFrames().length };
        });
        const heap = await v.evaluate(() => (performance.memory ? performance.memory.usedJSHeapSize : null));
        expect(await v.evaluate(() => window.__calc.rows.length)).toBe(rows);
        expect(await v.evaluate(() => window.CalcConfig.state())).toEqual(builderState.config);
        expect(await v.evaluate(() => window.__calc.filter.count)).toBe(builderState.count);
        if (textSources) {
          // the exported (filtered) state: rule and search applied, the table shows exactly the filtered rows
          const shown = await v.evaluate(() => ({
            count: window.__calc.filter.count,
            table: window.__calc.table.count,
            rules: window.__calc.filter.rules.map((r) => [r.mode, r.op, r.value]),
            types: window.__calc.filter.active.map((f) => f.type).sort(),
          }));
          expect(shown).toEqual({
            count: expectedCount,
            table: expectedCount,
            rules: [["text", "contains", "fitting"]],
            types: ["rule", "search"],
          });
          // the search field (in the closed filter panel) holds the exported text
          await expect(v.getByRole("searchbox", { name: "Suchen nach Objekten", includeHidden: true })).toHaveValue(
            TEXT_SOURCES.search,
          );
          // the toolbar responds: `Filter` opens the panel with the result at once (index built at the start, no
          // `Eigenschaften werden gelesen` progress); recorded as usable incl. the toolbar (navigation start clock)
          const tools = v.getByRole("toolbar", { name: "3D-Werkzeuge" });
          await tools.getByRole("button", { name: "Filter", exact: true }).click();
          await expect(v.locator("#cv-filter-status")).toHaveText(
            new RegExp(`^${expectedCount.toLocaleString("de-DE")} von `),
          );
          timing.toolbar = await v.evaluate(() => performance.now());
        }
        expect(viewer.requests).toEqual([]);
        expect(viewer.blocked).toEqual([]);
        expect(viewer.errors).toEqual([]);
        opens.push({ ...timing, node: viewer.loadMs, heap });
      } finally {
        await viewer.context.close();
      }
    }

    const report = {
      set: name,
      textSources: textSources ? { ...TEXT_SOURCES, count: expectedCount } : null,
      ifcFiles: files.length,
      ifcMB: MB(ifcBytes),
      rows,
      viewerMB: MB(file.bytes.length),
      ratio: Math.round((file.bytes.length / ifcBytes) * 1000) / 1000,
      exportMs: Math.round(file.last.ms),
      clickToDownloadMs: file.ms,
      readyMsMedian: Math.round(median(opens.map((o) => o.ready))),
      usableMsMedian: Math.round(median(opens.map((o) => o.usable))),
      usableMsMax: Math.round(Math.max(...opens.map((o) => o.usable))),
      heapMBMax: opens.every((o) => o.heap) ? MB(Math.max(...opens.map((o) => o.heap))) : null,
      runs: opens.map((o) => ({
        ready: Math.round(o.ready),
        usable: Math.round(o.usable),
        node: o.node,
        frames: o.frames,
        ...(o.toolbar ? { toolbar: Math.round(o.toolbar) } : {}),
      })),
    };
    console.log(`[perf NFR-003 viewer] ${JSON.stringify(report)}`);
    info.annotations.push({ type: "nfr-003-viewer", description: JSON.stringify(report) });

    if (ifcBytes >= LARGE_IFC) {
      if (name.startsWith("volume set")) expect(rows).toBeGreaterThanOrEqual(30_000);
      expect(report.ratio, "NFR-003 size <= 40 % of the IFC size").toBeLessThanOrEqual(SIZE_BUDGET);
      expect(report.usableMsMedian, "NFR-003 usable within 15 s").toBeLessThanOrEqual(START_BUDGET_MS);
      if (textSources)
        expect(
          median(opens.map((o) => o.toolbar)),
          "NFR-003 usable incl. index, filtered table and toolbar within 15 s",
        ).toBeLessThanOrEqual(START_BUDGET_MS);
    } else {
      expect(report.usableMsMedian).toBeLessThanOrEqual(START_BUDGET_MS);
    }
    expect(errors).toEqual([]);
  });
}
