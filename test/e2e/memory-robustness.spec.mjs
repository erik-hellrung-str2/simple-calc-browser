// T7 robustness of the model life cycle (verification INC-1, CODE F1): a removed model is freed. Before the fix the
// 3D engine kept every removed Fragments model alive in two Maps keyed by the model (tile signatures, refresh
// counts), so repeated load and remove grew the heap by one model per cycle.
// Measured with the test seam CalcView.liveModels() (a WeakRef per loaded model) after a forced garbage collection
// (CDP HeapProfiler.collectGarbage).
import { test, expect } from "../support/network-guard.mjs";
import { fixture, loadFiles, openBuilder, removeModel } from "../support/builder.mjs";
import { idle } from "../support/view-3d.mjs";

const FZK = fixture("AC20-FZK-Haus.ifc");
const CYCLES = 4;

async function liveAfterGc(page, cdp) {
  // WeakRefs are cleared by a collection in a later task: collect, yield, collect again
  for (let i = 0; i < 3; i++) {
    await cdp.send("HeapProfiler.collectGarbage");
    await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 50)));
  }
  return page.evaluate(() => window.CalcView.liveModels());
}

test("@robustness @REQ-001 repeated load and remove of a model frees every removed model (no heap growth per cycle)", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors = await openBuilder(page);
  const cdp = await page.context().newCDPSession(page);
  for (let i = 1; i <= CYCLES; i++) {
    await loadFiles(page, FZK);
    await idle(page);
    expect(await liveAfterGc(page, cdp), `cycle ${i}: the loaded model is alive`).toBe(1);
    await removeModel(page, "AC20-FZK-Haus");
    await idle(page);
    expect(await page.evaluate(() => window.__calc.modelCount)).toBe(0);
    expect(await liveAfterGc(page, cdp), `cycle ${i}: no removed model retained`).toBe(0);
  }
  await cdp.detach();
  expect(errors).toEqual([]);
});
