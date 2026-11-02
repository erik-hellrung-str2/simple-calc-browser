// TASK-006c selection timing on the volume set (fetched Revit MEP + SampleCastle, about 10k rows; NFR-001 budget of
// 500 ms applied to the selection, spec T6). Measured in the page from the click event's timestamp (performance
// clock), median of 3 per action:
//   applied = the selection's engine calls (highlight / reset) are done (CalcView.lastSelectedAt)  -> asserted < 500 ms
//   first   = the first frame drawn because the view changed after the click (changeFrames)        -> asserted < 500 ms
//   frame   = the last such frame before the view is idle (the highlight is drawn completely)     -> asserted < 500 ms
//   idle    = CalcView.whenIdle() (upper bound)                                                     -> recorded
// Actions: a table row click (single-element view, rows at the start, middle and end of the table) and a group row
// click on the largest Kategorie group (grouping view; every element of the group is highlighted). Runs in the `file`
// project only (the user's path); Chromium headless with software WebGL.
import { test, expect } from "../support/perf-lock.mjs";
import { fetched, loadFiles, openBuilder } from "../support/builder.mjs";
import { idle, viewState } from "../support/view-3d.mjs";
import { setView } from "../support/grouping.mjs";
import { clickRow } from "../support/selection.mjs";

const BUDGET_MS = 500; // NFR-001
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

/** Runs click (a Playwright input on a table row) and measures from its click event to the highlight drawn. */
async function measureClick(page, click) {
  await idle(page);
  await page.evaluate(() => {
    window.__t0 = null;
    window.__selectedBefore = window.CalcView.lastSelectedAt();
    document.addEventListener("click", (e) => (window.__t0 = e.timeStamp), { capture: true, once: true });
  });
  await click();
  return page.evaluate(async () => {
    await new Promise((resolve) => {
      const tick = () =>
        window.CalcView.lastSelectedAt() > window.__selectedBefore ? resolve() : requestAnimationFrame(tick);
      tick();
    });
    const idleAt = await window.CalcView.whenIdle();
    const t0 = window.__t0;
    const changes = window.CalcView.changeFrames().filter((t) => t > t0);
    return {
      applied: window.CalcView.lastSelectedAt() - t0,
      first: changes.length ? changes[0] - t0 : NaN,
      frame: changes.length ? changes[changes.length - 1] - t0 : NaN,
      idle: idleAt - t0,
    };
  });
}

test("@perf @NFR-001 @REQ-007 volume set: a row click and a group row click draw the 3D highlight within 500 ms", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "file", "one run is enough; the file project is the user's path");
  test.setTimeout(600_000);
  const errors = await openBuilder(page);
  await loadFiles(page, [fetched("Ifc4_Revit_MEP.ifc"), fetched("Ifc2x3_SampleCastle.ifc")], 300_000);
  await idle(page);
  const total = await page.evaluate(() => window.__calc.rows.length);
  expect(total).toBeGreaterThan(10_000);

  // rows with geometry from three places of the table (table order = row order without a sort) whose
  // element is on screen with a projected box of at least 20 x 20 px: an element outside the view has no drawn tile,
  // so its highlight draws no frame and there is nothing to measure
  const keys = await page.evaluate(async () => {
    const geometry = new Set(window.__calc.rows.filter((r) => r.geometry).map((r) => r.key));
    const shown = window.__calc.filter.keys.filter((k) => geometry.has(k));
    const canvas = document.querySelector("#cv-viewport canvas").getBoundingClientRect();
    const out = [];
    // start points spread over the table; the search wraps around and never takes a key twice
    for (const start of [0, Math.floor(shown.length / 3), Math.floor((shown.length * 2) / 3)]) {
      for (let n = 0; n < shown.length; n++) {
        const key = shown[(start + n) % shown.length];
        if (out.includes(key)) continue;
        const b = await window.CalcView.screenBox(key);
        const inside =
          b && b.left >= canvas.left && b.right <= canvas.right && b.top >= canvas.top && b.bottom <= canvas.bottom;
        if (inside && b.right - b.left >= 20 && b.bottom - b.top >= 20) {
          out.push(key);
          break;
        }
      }
    }
    return out;
  });
  expect(keys).toHaveLength(3);
  const results = { row: [], group: [] };
  for (const key of keys) {
    results.row.push(await measureClick(page, () => clickRow(page, key)));
    expect((await viewState(page)).selected).toEqual([key]);
  }

  // grouping view by Kategorie: the largest group
  await page.keyboard.press("Escape");
  await setView(page, "Gruppiert");
  const largest = await page.evaluate(
    () => window.__calc.table.display.filter((r) => r.type === "group").sort((a, b) => b.count - a.count)[0],
  );
  const groupGeometry = await page.evaluate((id) => {
    const geometry = new Set(window.__calc.rows.filter((r) => r.geometry).map((r) => r.key));
    window.CalcView.selectGroup(id);
    const n = window.__calc.view.selectedKeys.filter((k) => geometry.has(k)).length;
    window.CalcView.select(null);
    return n;
  }, largest.id);
  for (let i = 0; i < 3; i++) {
    results.group.push(await measureClick(page, () => clickRow(page, largest.id, { group: true })));
    expect((await viewState(page)).selected.length).toBe(groupGeometry);
    await page.keyboard.press("Escape");
    await idle(page);
  }

  const summary = Object.fromEntries(
    Object.entries(results).map(([k, runs]) => [
      k,
      {
        appliedMs: +median(runs.map((r) => r.applied)).toFixed(1),
        firstFrameMs: +median(runs.map((r) => r.first)).toFixed(1),
        frameMs: +median(runs.map((r) => r.frame)).toFixed(1),
        idleMs: +median(runs.map((r) => r.idle)).toFixed(1),
        runs: runs.map((r) => +r.frame.toFixed(0)),
      },
    ]),
  );
  console.log(
    `[perf REQ-007 selection] rows=${total} group=${largest.label} (${largest.count}, ${groupGeometry} with geometry) ` +
      JSON.stringify(summary),
  );
  for (const [k, runs] of Object.entries(results))
    for (const r of runs) expect(Number.isFinite(r.frame), `${k}: every click draws a changed frame`).toBe(true);
  for (const [k, sum] of Object.entries(summary)) {
    expect(sum.appliedMs, `${k}: click -> highlight engine calls done`).toBeLessThan(BUDGET_MS);
    expect(sum.firstFrameMs, `${k}: click -> next drawn frame shows the highlight`).toBeLessThan(BUDGET_MS);
    expect(sum.frameMs, `${k}: click -> last changed frame (complete highlight)`).toBeLessThan(BUDGET_MS);
  }
  expect(errors).toEqual([]);
});
