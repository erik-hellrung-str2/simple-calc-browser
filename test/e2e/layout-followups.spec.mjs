// Layout follow-ups from the TASK-004/TASK-005 verification, fixed in TASK-006a (spec 2 User interface, UI-02,
// REQ-005 "legend under the model"):
//   F1 filter panel content is not cut off at its right edge (long labels ellipsised with tooltip, search field visible)
//   L1 the colour legend is under the 3D view (never over the geometry); `Ansicht einpassen` fits into the free area
//   L2 legend text 13-14 px
//   L3 context geometry (IfcSite terrain) is neutral grey while `Faerben nach` is active
//   L4 the 3D toolbar stays one row at 1280 px with colouring and section active
// This file runs with real (classic) scrollbars: Playwright's headless default hides them, which hid F1.
import { test, expect } from "../support/network-guard.mjs";
import { fixture, loadFiles, openBuilder } from "../support/builder.mjs";
import { addFilterSet, filterSet, toggleValue } from "../support/filter-area.mjs";
import { colourBy, idle, legendEntries, viewState } from "../support/view-3d.mjs";
import { LONG_NAME, longFixture } from "../support/long-fixture.mjs";

test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });
test.describe.configure({ timeout: 180_000 });

const FZK = fixture("AC20-FZK-Haus.ifc");
const CONTEXT_GREY = "#e3e5e7"; // cv-3d CONTEXT_COLOR

test("@e2e @UI F1 filter panel: sets fit the panel next to a classic scrollbar; long labels ellipsised with tooltip", async ({
  page,
}) => {
  const errors = await openBuilder(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await loadFiles(page, longFixture());
  await idle(page);
  await addFilterSet(page, "Name", "Name");
  await addFilterSet(page, "Typ", "Typ");
  const panel = page.locator("#cv-filters");
  await panel.evaluate((n) => (n.scrollTop = n.scrollHeight));
  const m = await panel.evaluate((p) => {
    const box = p.getBoundingClientRect();
    const right = box.left + p.clientWidth; // left of the scrollbar
    const out = { clientWidth: p.clientWidth, offsetWidth: p.offsetWidth, scrollWidth: p.scrollWidth, sticking: [] };
    for (const n of p.querySelectorAll(".cv-fs, .cv-fs-head, .cv-fs-body, .cv-search, .cv-fs-values, .cv-fs-value")) {
      if (n.hidden || n.closest("[hidden]")) continue;
      const r = n.getBoundingClientRect();
      if (r.width && r.right > right + 0.5) out.sticking.push(n.className + " " + Math.round(r.right - right));
    }
    return out;
  });
  expect(m.offsetWidth - m.clientWidth, "a classic scrollbar takes space").toBeGreaterThan(5);
  expect(m.scrollWidth).toBeLessThanOrEqual(m.clientWidth);
  expect(m.sticking).toEqual([]);
  // the search field of the Name set is fully visible (its right border inside the panel)
  const search = filterSet(page, "Name").locator(".cv-search");
  const sb = await search.boundingBox();
  const pb = await panel.boundingBox();
  expect(sb.x + sb.width).toBeLessThanOrEqual(pb.x + m.clientWidth);
  // the long Name value: ellipsised, tooltip with the full text, row height unchanged
  await filterSet(page, "Name").getByRole("searchbox").fill("Abschnitt-0123456789");
  const label = filterSet(page, "Name").locator(".cv-fs-value:not([hidden]) .cv-fs-label").first();
  const lm = await label.evaluate((n) => ({
    w: n.offsetWidth,
    sw: ((range) => (range.selectNodeContents(n), range.getBoundingClientRect().width))(document.createRange()),
    title: n.title,
    overflow: getComputedStyle(n).textOverflow,
    row: n.parentElement.offsetHeight,
    right: n.parentElement.getBoundingClientRect().right,
  }));
  expect(lm.sw).toBeGreaterThan(lm.w);
  expect(lm.overflow).toBe("ellipsis");
  expect(lm.title).toBe(LONG_NAME);
  expect(lm.row).toBe(26);
  expect(lm.right).toBeLessThanOrEqual(pb.x + m.clientWidth);
  expect(errors).toEqual([]);
});

test("@e2e @UI L1 L2 the legend is under the 3D view at 13-14 px; `Ansicht einpassen` fits the model into the free area", async ({
  page,
}) => {
  const errors = await openBuilder(page);
  await loadFiles(page, FZK);
  await idle(page);
  await colourBy(page, "Kategorie", "Kategorie");
  await idle(page);
  const boxes = await page.evaluate(() => {
    const rect = (sel) => {
      const r = document.querySelector(sel).getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height };
    };
    return {
      viewport: rect("#cv-viewport"),
      canvasBox: rect("#cv-canvas-box"),
      canvas: rect("#cv-viewport canvas"),
      legend: rect("#cv-legend"),
    };
  });
  // the legend is a strip under the canvas, inside the model area; the canvas fills the rest
  expect(boxes.legend.top).toBeGreaterThanOrEqual(boxes.canvas.bottom - 0.5);
  expect(boxes.legend.bottom).toBeLessThanOrEqual(boxes.viewport.bottom + 0.5);
  expect(Math.abs(boxes.canvas.height + boxes.legend.height - boxes.viewport.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(boxes.canvas.height - boxes.canvasBox.height)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.querySelector("#cv-legend").closest("#cv-canvas-box"))).toBeNull();
  // L2: legend title, labels and counts 13-14 px
  const sizes = await page
    .locator("#cv-legend .cv-legend-title, #cv-legend .cv-legend-label, #cv-legend .cv-legend-count")
    .evaluateAll((nodes) => [...new Set(nodes.map((n) => parseFloat(getComputedStyle(n).fontSize)))]);
  for (const size of sizes) {
    expect(size).toBeGreaterThanOrEqual(13);
    expect(size).toBeLessThanOrEqual(14);
  }
  expect((await legendEntries(page)).length).toBeGreaterThan(5);
  // `Ansicht einpassen`: every element's projected box lies inside the canvas, above the legend
  await page.getByRole("button", { name: "Ansicht einpassen" }).click();
  await idle(page);
  const union = await page.evaluate(async () => {
    const out = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
    const keys = [...window.CalcView.state().opaque];
    for (const key of keys) {
      const b = await window.CalcView.screenBox(key);
      if (!b) continue;
      out.left = Math.min(out.left, b.left);
      out.top = Math.min(out.top, b.top);
      out.right = Math.max(out.right, b.right);
      out.bottom = Math.max(out.bottom, b.bottom);
    }
    return out;
  });
  expect(union.top).toBeGreaterThanOrEqual(boxes.canvas.top - 1);
  expect(union.bottom).toBeLessThanOrEqual(boxes.canvas.bottom + 1);
  expect(union.bottom).toBeLessThan(boxes.legend.top);
  expect(union.left).toBeGreaterThanOrEqual(boxes.canvas.left - 1);
  expect(union.right).toBeLessThanOrEqual(boxes.canvas.right + 1);
  // a filter that shortens the legend does not resize the canvas (a resize redraws the whole view; NFR-001)
  const canvasHeight = () =>
    page.evaluate(() => document.querySelector("#cv-viewport canvas").getBoundingClientRect().height);
  const before = await canvasHeight();
  await toggleValue(page, "Kategorie", "IfcSlab");
  await idle(page);
  expect((await legendEntries(page)).length).toBe(1);
  expect(await canvasHeight()).toBe(before);
  await toggleValue(page, "Kategorie", "IfcSlab");
  // without colouring the strip is empty and the canvas takes the whole model area again
  await page.getByRole("button", { name: "Färbung entfernen" }).click();
  await expect(page.locator("#cv-legend")).toBeHidden();
  await expect
    .poll(() => page.evaluate(() => document.querySelector("#cv-viewport canvas").getBoundingClientRect().height))
    .toBeGreaterThan(boxes.viewport.height - 1);
  expect(errors).toEqual([]);
});

test("@e2e @UI L3 while `Färben nach` is active the context geometry (IfcSite terrain) is neutral grey, not a legend colour", async ({
  page,
}) => {
  const errors = await openBuilder(page);
  await loadFiles(page, FZK);
  await idle(page);
  const context = () => page.evaluate(() => window.CalcView.contextState());
  const loaded = await context();
  expect(loaded.items, "AC20-FZK-Haus has context geometry (terrain)").toBeGreaterThan(0);
  expect(loaded.paints).toEqual({ none: loaded.items });

  await colourBy(page, "Kategorie", "Kategorie");
  await idle(page);
  expect(await context()).toEqual({
    items: loaded.items,
    visible: loaded.items,
    paints: { [CONTEXT_GREY]: loaded.items },
  });
  const legend = (await legendEntries(page)).map((e) => e.colour);
  expect(legend).not.toContain(CONTEXT_GREY);
  expect(Object.values((await viewState(page)).colours)).not.toContain(CONTEXT_GREY);
  // grey: equal channels
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(CONTEXT_GREY.slice(i, i + 2), 16));
  expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(6);
  // numeric scale too
  await colourBy(page, "NetVolume", "BaseQuantities.NetVolume");
  await idle(page);
  expect((await context()).paints).toEqual({ [CONTEXT_GREY]: loaded.items });
  expect((await legendEntries(page)).map((e) => e.colour)).not.toContain(CONTEXT_GREY);
  // with a filter the terrain is a ghost like every element outside it; in hide mode hidden
  await toggleValue(page, "Kategorie", "IfcWallStandardCase");
  await idle(page);
  expect((await context()).paints).toEqual({ ghost: loaded.items });
  await page.getByRole("radio", { name: "Ausblenden" }).click();
  await idle(page);
  expect(await context()).toEqual({ items: loaded.items, visible: 0, paints: { none: loaded.items } });
  await page.getByRole("radio", { name: "Geist" }).click();
  await page.locator("#cv-reset-all").click();
  await page.getByRole("button", { name: "Färbung entfernen" }).click();
  await idle(page);
  expect(await context()).toEqual(loaded);
  expect(errors).toEqual([]);
});

test("@e2e @UI L4 the 3D toolbar stays one row at 1280 px with colouring (long property) and section active", async ({
  page,
}) => {
  const errors = await openBuilder(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await loadFiles(page, FZK);
  await idle(page);
  await colourBy(page, "NetVolume", "BaseQuantities.NetVolume");
  await page.getByRole("radio", { name: "Schnitt Z" }).click();
  await idle(page);
  const m = await page.evaluate(() => {
    const bar = document.getElementById("cv-view-bar");
    const box = document.getElementById("cv-canvas-box").getBoundingClientRect();
    const kids = [...bar.children].map((c) => c.getBoundingClientRect());
    return {
      barHeight: bar.getBoundingClientRect().height,
      tops: kids.map((r) => Math.round(r.top)),
      lefts: kids.map((r) => r.left),
      rights: kids.map((r) => r.right),
      box: { left: box.left, right: box.right },
      panel: document.getElementById("cv-section-panel").getBoundingClientRect().toJSON(),
      barBottom: bar.getBoundingClientRect().bottom,
    };
  });
  expect(new Set(m.tops).size, "one row").toBe(1);
  expect(m.barHeight).toBeLessThanOrEqual(34);
  expect(Math.min(...m.lefts)).toBeGreaterThanOrEqual(m.box.left);
  expect(Math.max(...m.rights)).toBeLessThanOrEqual(m.box.right);
  for (let i = 1; i < m.lefts.length; i++) expect(m.lefts[i]).toBeGreaterThan(m.rights[i - 1]); // no overlap
  // the section panel (slider, flip, remove) sits under the bar, inside the 3D view
  expect(m.panel.top).toBeGreaterThanOrEqual(m.barBottom);
  expect(m.panel.right).toBeLessThanOrEqual(m.box.right);
  await expect(page.getByRole("slider", { name: "Schnittposition" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Schnitt umkehren" })).toBeVisible();
  // texts stay available: visible mode label, names of the colour and fit buttons
  await expect(page.locator("#cv-mode-label")).toHaveText("Elemente außerhalb des Filters:");
  await expect(page.locator("#cv-mode-label")).toBeVisible();
  await expect(page.locator("#cv-colour")).toHaveAccessibleName("Färben nach: BaseQuantities.NetVolume (m³)");
  await expect(page.locator("#cv-colour")).toContainText("Färben nach");
  await expect(page.locator("#cv-fit")).toHaveAccessibleName("Ansicht einpassen");
  expect(errors).toEqual([]);
});
