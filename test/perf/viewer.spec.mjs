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
// (recorded, not asserted). Runs in the `file` project only, never at the same time as another perf spec (perf-lock).
import { statSync } from "node:fs";
import { test, expect } from "../support/perf-lock.mjs";
import { fetched, fixture, loadFiles, openBuilder } from "../support/builder.mjs";
import { idle } from "../support/view-3d.mjs";
import { exportViewer, openViewerFile } from "../support/viewer.mjs";

const START_BUDGET_MS = 15_000; // NFR-003
const SIZE_BUDGET = 0.4; // NFR-003
const LARGE_IFC = 100 * 1024 * 1024; // NFR-003 applies to viewer files built from >= 100 MB of IFC
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const MB = (n) => Math.round((n / 1024 / 1024) * 10) / 10;

const SETS = {
  "AC20-FZK-Haus": [fixture("AC20-FZK-Haus.ifc")],
  Duplex: [fixture("Ifc2x3_Duplex_Architecture.ifc")],
  "volume set": [...Array(4).fill(fetched("Ifc4_Revit_MEP.ifc")), fetched("Ifc2x3_SampleCastle.ifc")],
};

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
          return { ready, usable: performance.now() };
        });
        const heap = await v.evaluate(() => (performance.memory ? performance.memory.usedJSHeapSize : null));
        expect(await v.evaluate(() => window.__calc.rows.length)).toBe(rows);
        expect(await v.evaluate(() => window.CalcConfig.state())).toEqual(builderState.config);
        expect(await v.evaluate(() => window.__calc.filter.count)).toBe(builderState.count);
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
      runs: opens.map((o) => ({ ready: Math.round(o.ready), usable: Math.round(o.usable), node: o.node })),
    };
    console.log(`[perf NFR-003 viewer] ${JSON.stringify(report)}`);
    info.annotations.push({ type: "nfr-003-viewer", description: JSON.stringify(report) });

    if (ifcBytes >= LARGE_IFC) {
      expect(rows).toBeGreaterThanOrEqual(30_000);
      expect(report.ratio, "NFR-003 size <= 40 % of the IFC size").toBeLessThanOrEqual(SIZE_BUDGET);
      expect(report.usableMsMedian, "NFR-003 usable within 15 s").toBeLessThanOrEqual(START_BUDGET_MS);
    } else {
      expect(report.usableMsMedian).toBeLessThanOrEqual(START_BUDGET_MS);
    }
    expect(errors).toEqual([]);
  });
}
