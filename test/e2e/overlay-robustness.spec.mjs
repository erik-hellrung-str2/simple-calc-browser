// Testing cycle 2 (release candidate 1.1.0, CR-002) regressions for layout and keyboard findings:
//   A-1 the table's header, rows and total row reach the right edge of the table area (CR-002 §1.4 "Die Tabelle unten
//       geht bis nach rechts", REQ-006-AC12) even when the columns are narrower than the area;
//   A-3 the click menu card stays clear of the properties panel (REQ-013 click menu, spec §2 Devices "no two overlays
//       overlap");
//   X-1 a very long element Name is clamped in the properties panel head, so `Ausblenden` / `Isolieren` and the body
//       stay reachable and the body scrolls (REQ-007, REQ-007-AC6 body scrolls, REQ-005 overlay head ≤ 160 px; T7);
//   X-2 a very long value in the colouring legend is clamped and its swatch stays at the first line (REQ-005, T7);
//   X-3 rule rows and the filter-area entry `Suche: „…“` clamp very long values; the dialog keeps the full value
//       (REQ-012, REQ-004 filter-area entries, T7);
//   X-4 `Esc` in `Eigenschaft` with the suggestion list open closes only the list (REQ-007 `Esc` order "an open dialog
//       or popup", REQ-012-AC11 for the second `Esc`).
// Each test failed before its fix (testing cycle 2, docs/tasks/TASK-019.md "Testing cycle 2").
import { test, expect } from "../support/network-guard.mjs";
import { fixture, loadFiles, openBuilder } from "../support/builder.mjs";
import { colourBy, colourPanel, idle, keysOfGuids, openColourPanel } from "../support/view-3d.mjs";
import { clickRow } from "../support/selection.mjs";
import { LONG_NAME, LONG_WALL, longFixture } from "../support/long-fixture.mjs";
import { addRuleLink, dialogFields, filterPanel, openFilterPanel, ruleDialog, ruleRows } from "../support/rules.mjs";
import { configFile, loadConfig } from "../support/config.mjs";
import { clickMenu } from "../support/tools.mjs";
import { setView } from "../support/grouping.mjs";

test.describe.configure({ timeout: 180_000 });

const FZK = fixture("AC20-FZK-Haus.ifc");
const rect = (locator) =>
  locator.evaluate((n) => {
    const r = n.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
  });

async function openWith(page, files, size = { width: 1280, height: 800 }) {
  const errors = await openBuilder(page);
  await page.setViewportSize(size);
  await loadFiles(page, files);
  await idle(page);
  return errors;
}

test("@e2e @UI A-1 the table header, the rows, the selected row and the total row reach the right edge of the table area when the columns are narrower", async ({
  page,
}) => {
  for (const size of [
    { width: 1920, height: 1080 },
    { width: 1280, height: 800 },
  ]) {
    const errors = await openWith(page, FZK, size);
    const m = await page.evaluate(() => {
      const scroll = document.getElementById("cv-tbl-scroll");
      const s = scroll.getBoundingClientRect();
      const right = s.left + scroll.clientWidth; // left of a vertical scrollbar
      const cols = [...scroll.querySelectorAll(".cv-tbl-head .cv-th")].map((n) => n.getBoundingClientRect().right);
      const head = scroll.querySelector(".cv-tbl-head").getBoundingClientRect().right;
      const row = scroll.querySelector(".cv-tbl-body .cv-tr:not([hidden])").getBoundingClientRect().right;
      return { right, lastColumn: Math.max(...cols), head, row, sw: scroll.scrollWidth, cw: scroll.clientWidth };
    });
    expect(m.lastColumn, `the default columns are narrower than the area at ${size.width} px`).toBeLessThan(
      m.right - 100,
    );
    expect(Math.abs(m.head - m.right), "header bar to the right edge").toBeLessThanOrEqual(1);
    expect(Math.abs(m.row - m.right), "row stripes to the right edge").toBeLessThanOrEqual(1);
    expect(m.sw, "no horizontal scrolling from the stretched rows").toBeLessThanOrEqual(m.cw);
    // the selection highlight and the total row (grouping view) as well
    const rows = await page.evaluate(() => window.__calc.rows.map((r) => r.key));
    await clickRow(page, rows[0]);
    const sel = await rect(page.locator("#cv-tbl-scroll .cv-tr.cv-sel").first());
    expect(Math.abs(sel.right - m.right), "selected row to the right edge").toBeLessThanOrEqual(1);
    await setView(page, "Gruppiert"); // level 1 = Kategorie (default of the grouping view)
    const foot = page.locator("#cv-tbl-total");
    await expect(foot).toBeVisible();
    // the grouping view's columns may be wider than the area: the total row is then as wide as the header
    const f = await rect(foot);
    const h = await rect(page.locator("#cv-tbl-scroll .cv-tbl-head"));
    expect(Math.abs(f.right - h.right), "total row as wide as the header").toBeLessThanOrEqual(1);
    expect(f.right, "total row to the right edge").toBeGreaterThanOrEqual(m.right - 1);
    expect(errors).toEqual([]);
  }
});

test("@e2e @UI A-3 the click menu card does not overlap the properties panel when the click point is near the panel", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  const canvas = await page.locator("#cv-viewport canvas").boundingBox();
  // the panel position: open it once with a table row
  const rows = await page.evaluate(() => window.__calc.rows.map((r) => r.key));
  await clickRow(page, rows[0]);
  const panelBox = await rect(page.locator("#cv-props"));
  await page.keyboard.press("Escape");
  await expect(page.locator("#cv-props")).toBeHidden();
  // a pickable point whose centred card (about 250 px wide, 80 px high, 20 px above the point) would reach into the panel
  let at = null;
  for (let x = panelBox.left - 30; x >= panelBox.left - 110 && !at; x -= 10)
    for (let y = canvas.y + 120; y <= Math.min(panelBox.bottom + 80, canvas.y + canvas.height - 90) && !at; y += 10) {
      const hit = await page.evaluate(([px, py]) => window.CalcView3D.pickAt(px, py), [x, y]);
      if (hit) at = { x, y, key: hit.key };
    }
  expect(at, "an element can be clicked left of the panel").not.toBeNull();
  await page.mouse.click(at.x, at.y);
  await idle(page);
  await expect(clickMenu(page)).toBeVisible();
  await expect(page.locator("#cv-props")).toBeVisible();
  const g = await page.evaluate(() => {
    const box = (n) => n.getBoundingClientRect();
    const d = box(document.querySelector("#cv-pick .cv-pick-dot"));
    const c = box(document.querySelector("#cv-pick .cv-pick-card"));
    const x = box(document.querySelector("#cv-pick .cv-pick-close"));
    const p = box(document.getElementById("cv-props"));
    const r = (b) => ({ left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width });
    return { dot: { x: d.left + d.width / 2, y: d.top + d.height / 2 }, card: r(c), close: r(x), panel: r(p) };
  });
  expect(at.x + g.card.width / 2, "the centred card would overlap the panel").toBeGreaterThan(g.panel.left);
  expect(Math.hypot(g.dot.x - at.x, g.dot.y - at.y), "marker at the click point").toBeLessThanOrEqual(3);
  expect(at.y - g.card.bottom, "card bottom within 30 px above the point").toBeLessThanOrEqual(30);
  expect(g.card.bottom).toBeLessThanOrEqual(at.y);
  const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  expect(overlaps(g.card, g.panel), "card clear of the panel").toBe(false);
  expect(overlaps(g.close, g.panel), "close button clear of the panel").toBe(false);
  expect(g.card.left, "card inside the 3D view").toBeGreaterThanOrEqual(canvas.x);
  // the menu still works
  await clickMenu(page).getByRole("menuitem", { name: "Menü schließen" }).click();
  await expect(clickMenu(page)).toBeHidden();
  expect(errors).toEqual([]);
});

test("@e2e @robustness X-1 a very long element Name is clamped in the properties panel head: buttons and body stay reachable, the body scrolls with the wheel", async ({
  page,
}) => {
  const errors = await openWith(page, longFixture());
  const [key] = await keysOfGuids(page, [LONG_WALL]);
  for (const size of [
    { width: 1280, height: 800 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(size);
    await clickRow(page, key);
    const panel = page.locator("#cv-props");
    await expect(panel).toBeVisible();
    const title = page.locator("#cv-props-title");
    const full = await title.textContent();
    expect(full === LONG_NAME || full === LONG_NAME.trim(), "the full Name is in the DOM").toBe(true);
    expect((await title.getAttribute("title")) === full, "the full Name as tooltip").toBe(true);
    const p = await rect(panel);
    const head = await rect(panel.locator(".cv-props-head"));
    expect(head.height, `head at most 160 px (REQ-005 overlay layout) at ${size.width} px`).toBeLessThanOrEqual(160);
    for (const id of ["#cv-props-hide", "#cv-props-isolate", "#cv-props-close"]) {
      const b = await rect(page.locator(id));
      expect(b.bottom, `${id} inside the panel`).toBeLessThanOrEqual(p.bottom);
      expect(b.top).toBeGreaterThanOrEqual(p.top);
    }
    const body = page.locator("#cv-props-body");
    const b = await rect(body);
    expect(b.height, "body visible").toBeGreaterThanOrEqual(80);
    const before = await body.evaluate((n) => n.scrollTop);
    await page.mouse.move(b.left + b.width / 2, b.top + b.height / 2);
    await page.mouse.wheel(0, 200);
    await expect.poll(() => body.evaluate((n) => n.scrollTop)).toBeGreaterThan(before);
    // the button is clickable at its place (not covered, not outside)
    await page.locator("#cv-props-hide").click({ trial: true });
  }
  expect(errors).toEqual([]);
});

test("@e2e @robustness X-2 a very long value in the colouring legend is clamped with a tooltip; its swatch stays at the first line", async ({
  page,
}) => {
  const errors = await openWith(page, longFixture(), { width: 1440, height: 900 });
  await colourBy(page, "Name", "Name", { keepOpen: true });
  await openColourPanel(page);
  const value = colourPanel(page).locator(".cv-legend-value").filter({ hasText: "Wand mit sehr langem Namen" });
  await expect(value).toHaveCount(1);
  const label = await value.textContent();
  expect(label === LONG_NAME || label === LONG_NAME.trim(), "the full value in the DOM").toBe(true);
  expect((await value.getAttribute("title")) === label, "the full value as tooltip").toBe(true);
  const row = value.locator("xpath=..");
  const r = await rect(row);
  const v = await rect(value);
  const s = await rect(row.locator(".cv-legend-swatch"));
  const line = await value.evaluate((n) => parseFloat(getComputedStyle(n).lineHeight));
  expect(r.height, "row at most 3 lines plus padding").toBeLessThanOrEqual(3 * line + 16);
  expect(s.top - v.top, "swatch at the first line").toBeLessThan(line);
  expect(s.top).toBeGreaterThanOrEqual(v.top - 1);
  expect(errors).toEqual([]);
});

test("@e2e @robustness X-3 rule rows and the filter-area entry `Suche` clamp very long values; the dialog keeps the full value", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  const long = "x".repeat(200_000);
  const search = "y".repeat(5_000);
  const result = await loadConfig(
    page,
    configFile({
      schema: "calc-viewer-config/1",
      filterRules: [
        { mode: "mark", key: "Name", op: "eq", value: long },
        { mode: "mark", key: "Name", op: "eq", value: "kurz" },
      ],
      search,
    }),
  );
  expect(result.ok).toBe(true);
  await openFilterPanel(page);
  await expect(ruleRows(page)).toHaveCount(2);
  const rowHeights = await ruleRows(page).evaluateAll((list) => list.map((n) => n.getBoundingClientRect().height));
  for (const h of rowHeights) expect(h, "rule row at most 3 lines").toBeLessThanOrEqual(80);
  const panel = await rect(filterPanel(page));
  const second = await rect(ruleRows(page).nth(1));
  expect(second.bottom, "the second rule is in view without scrolling").toBeLessThanOrEqual(panel.bottom);
  await expect(ruleRows(page).first().locator(".cv-rule-text [title]")).toHaveAttribute("title", /^Markieren: Name/);
  const entry = page.locator("#cv-fa-sources .cv-fa-source").filter({ hasText: "Suche:" });
  await expect(entry).toHaveCount(1);
  expect((await rect(entry)).height, "filter-area entry at most 3 lines").toBeLessThanOrEqual(80);
  expect(
    (await entry.locator(".cv-fa-source-text").textContent()) === "Suche: \u201e" + search + "\u201c",
    "the full text",
  ).toBe(true);
  // the dialog keeps the full value for editing
  await ruleRows(page).first().locator(".cv-rule-text").click();
  await expect(ruleDialog(page)).toBeVisible();
  expect((await dialogFields(page).value.inputValue()) === long, "the full value in `Wert`").toBe(true);
  await dialogFields(page).cancel.click();
  expect(errors).toEqual([]);
});

test("@e2e @robustness X-4 `Esc` in `Eigenschaft` with the suggestion list open closes only the list; the second `Esc` closes the dialog", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  await openFilterPanel(page);
  await addRuleLink(page).click();
  const f = dialogFields(page);
  await expect(f.dialog).toBeVisible();
  await f.property.fill("Na");
  await expect(f.suggestions).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(f.suggestions).toBeHidden();
  await expect(f.dialog).toBeVisible();
  await expect(f.property).toHaveValue("Na");
  await expect(f.property).toBeFocused();
  await expect(f.property).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Escape");
  await expect(f.dialog).toBeHidden();
  await expect(addRuleLink(page)).toBeFocused();
  await expect(filterPanel(page)).toBeVisible();
  expect(errors).toEqual([]);
});
