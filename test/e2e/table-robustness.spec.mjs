// TASK-006a robustness of the table (spec Testing T7): empty results, very long values and 200 columns. The width of a
// long text is measured with a Range over its text (scrollWidth of a 4,000-character single word was sometimes reported
// as the box width under parallel load). Long values come from a copy of AC20-FZK-Haus.ifc built in memory
// (test/support/long-fixture.mjs); the other inputs are committed fixtures.
import { test, expect } from "../support/network-guard.mjs";
import { REF, fixture, loadFiles, openBuilder } from "../support/builder.mjs";
import { toggleValue } from "../support/filter-area.mjs";
import { idle, viewState } from "../support/view-3d.mjs";
import { LONG_NAME, LONG_PSET_KEY, LONG_PSET_VALUE, longFixture } from "../support/long-fixture.mjs";
import {
  allTableRows,
  checkColumnValue,
  clickSort,
  header,
  headerKeys,
  openColumnFilter,
  tableState,
} from "../support/table.mjs";

const FZK = fixture("AC20-FZK-Haus.ifc");
const fzkRef = REF["AC20-FZK-Haus"];
const FZK_TOTAL = Object.entries(fzkRef.elementsInStepTextByKategorie)
  .filter(([k]) => k !== "IfcOpeningElement")
  .reduce((a, [, n]) => a + n, 0);
const de = (n) => n.toLocaleString("de-DE");

test.describe.configure({ timeout: 180_000 });

test("@robustness @REQ-006 empty table: before loading and for a filter result without elements", async ({ page }) => {
  const errors = await openBuilder(page);
  // no model: header with the default columns, hint, no rows
  await expect(page.locator("#cv-tbl-empty")).toHaveText("Keine Elemente.");
  expect(await headerKeys(page)).toEqual(["Modell", "Kategorie", "Name", "Geschoss"]);
  expect(await page.locator(".cv-tr:not([hidden])").count()).toBe(0);
  await header(page, "Name").locator(".cv-th-label").click(); // sorting nothing is harmless
  await openColumnFilter(page, "Name");
  await expect(page.locator("#cv-colfilter")).toContainText("Keine Werte.");
  await page.keyboard.press("Escape");
  await header(page, "Name").locator(".cv-th-label").click();
  await header(page, "Name").locator(".cv-th-label").click();

  await loadFiles(page, FZK);
  await idle(page);
  // IfcSlab (filter set) AND Name = a wall's name (column filter): no element
  await toggleValue(page, "Kategorie", "IfcSlab");
  const wallName = fzkRef.filters["REQ-006-AC4"].values[0];
  await checkColumnValue(page, "Name", "Bodenplatte", "Bodenplatte"); // a slab name: one row
  await page.keyboard.press("Escape");
  await expect(page.locator("#cv-status")).toHaveText(`1 von ${de(FZK_TOTAL)} Elementen`);
  // the wall name is not in the checklist under the slab filter; set it through the configuration seam
  await page.evaluate((name) => {
    const state = window.CalcTable.state();
    state.columnFilters = [{ key: "Name", type: "values", values: [name] }];
    window.CalcTable.setState(state);
  }, wallName);
  await expect(page.locator("#cv-status")).toHaveText(`0 von ${de(FZK_TOTAL)} Elementen`);
  await expect(page.locator("#cv-tbl-empty")).toHaveText("Keine Elemente im Filter.");
  expect(await page.locator(".cv-tr:not([hidden])").count()).toBe(0);
  expect((await allTableRows(page)).length).toBe(0);
  expect((await viewState(page)).opaque).toEqual([]);
  await clickSort(page, "Name");
  await expect(header(page, "Name")).toHaveAttribute("aria-sort", "ascending");
  // the checked value with 0 hits stays visible and checked in the checklist (DEC-14)
  const popup = await openColumnFilter(page, "Name");
  await popup.getByRole("searchbox").fill(wallName);
  await expect(popup.getByRole("checkbox", { name: wallName, exact: true })).toBeChecked();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Alle Filter zurücksetzen" }).click();
  await expect(page.locator("#cv-tbl-empty")).toBeHidden();
  expect((await allTableRows(page)).length).toBe(FZK_TOTAL);
  expect(errors).toEqual([]);
});

test("@robustness @REQ-006 very long values stay on one row, ellipsised with the full text as tooltip; nothing overflows", async ({
  page,
}) => {
  const errors = await openBuilder(page);
  await loadFiles(page, longFixture());
  await idle(page);
  await page.evaluate((key) => {
    const state = window.CalcTable.state();
    state.columns.push({ key });
    window.CalcTable.setState(state);
  }, LONG_PSET_KEY);
  await expect(header(page, LONG_PSET_KEY)).toBeVisible();
  await clickSort(page, "Name"); // ascending: the long `Wand mit ...` name among the W... names
  const rows = await allTableRows(page);
  const long = rows.find((r) => r.cells.Name === LONG_NAME);
  expect(long, "the long name is shown in full text (textContent)").toBeTruthy();
  // bring it into view and check its cell: one line, row height unchanged, ellipsis, tooltip with the full text
  await page.evaluate((index) => {
    document.getElementById("cv-tbl-scroll").scrollTop = index * 28;
  }, long.index);
  const cell = page.locator(`.cv-tr[data-key="${long.key}"] .cv-td[data-col="Name"]`);
  await expect(cell).toBeVisible();
  const m = await cell.evaluate((n) => ({
    h: n.parentElement.offsetHeight,
    cellH: n.offsetHeight,
    sh: n.scrollHeight,
    ch: n.clientHeight,
    w: n.offsetWidth,
    sw: ((range) => (range.selectNodeContents(n), range.getBoundingClientRect().width))(document.createRange()),
    overflow: getComputedStyle(n).textOverflow,
    title: n.title,
  }));
  expect(m.h).toBe(28);
  expect(m.cellH).toBeLessThanOrEqual(28);
  expect(m.sh, "one line").toBeLessThanOrEqual(m.ch);
  expect(m.sw).toBeGreaterThan(m.w);
  expect(m.overflow).toBe("ellipsis");
  expect(m.title).toBe(LONG_NAME);
  // the very long pset text (4,000 characters) in its row: one line, ellipsised
  const psetRow = rows.find((r) => r.cells[LONG_PSET_KEY] === LONG_PSET_VALUE);
  expect(psetRow, "the long pset value is shown").toBeTruthy();
  const psetCell = page.locator(`.cv-tr[data-key="${psetRow.key}"] .cv-td[data-col="${LONG_PSET_KEY}"]`);
  // scrolled into view, also horizontally (the last column ends right of the visible width)
  await page.evaluate(async (index) => {
    const box = document.getElementById("cv-tbl-scroll");
    box.scrollTop = index * 28;
    box.scrollLeft = box.scrollWidth;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, psetRow.index);
  await expect(psetCell).toBeInViewport();
  const pm = await psetCell.evaluate((n) => ({
    row: n.parentElement.offsetHeight,
    sh: n.scrollHeight,
    ch: n.clientHeight,
    sw: ((range) => (range.selectNodeContents(n), range.getBoundingClientRect().width))(document.createRange()),
    w: n.offsetWidth,
  }));
  expect(pm.row).toBe(28);
  expect(pm.sh).toBeLessThanOrEqual(pm.ch);
  expect(pm.sw).toBeGreaterThan(pm.w);
  // the column keeps its width; the page never scrolls horizontally
  expect((await tableState(page)).columns.find((c) => c.key === "Name").width).toBe(240);
  const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(pageOverflow).toBeLessThanOrEqual(0);
  // the checklist of the Name filter: the long value ellipsised inside the fixed-width popup
  const popup = await openColumnFilter(page, "Name");
  await popup.getByRole("searchbox").fill("Abschnitt-0123456789");
  const label = popup.locator(".cv-fs-value:not([hidden]) .cv-fs-label").first();
  const lm = await label.evaluate((n) => ({
    w: n.offsetWidth,
    sw: ((range) => (range.selectNodeContents(n), range.getBoundingClientRect().width))(document.createRange()),
    title: n.title,
    row: n.parentElement.offsetHeight,
  }));
  expect(lm.sw).toBeGreaterThan(lm.w);
  expect(lm.title).toBe(LONG_NAME);
  expect(lm.row).toBe(26);
  expect(await popup.evaluate((n) => n.offsetWidth)).toBe(300);
  await popup.getByRole("checkbox").first().click();
  await expect(page.locator("#cv-status")).toHaveText(/^1 von /);
  await page.keyboard.press("Escape");
  // the details panel and filter sets are not this task's; the 3D state follows
  expect((await viewState(page)).opaque).toEqual([long.key]);
  expect(errors).toEqual([]);
});

test("@robustness @REQ-006 200 columns: only the visible cells are rendered; horizontal scroll and sort stay fast", async ({
  page,
}) => {
  const errors = await openBuilder(page);
  await loadFiles(page, FZK);
  await idle(page);
  const keys = await page.evaluate(() => window.__calc.catalog.slice(0, 200).map((e) => e.key));
  expect(keys.length).toBe(200);
  await page.evaluate((list) => window.CalcTable.setState({ columns: list.map((key) => ({ key })) }), keys);
  expect(await headerKeys(page)).toEqual(keys);
  expect((await tableState(page)).columns.length).toBe(200);
  // cells: only the columns near the visible width per row
  let stats = await page.evaluate(() => window.CalcTable.stats());
  expect(stats.rowNodes).toBeLessThan(40);
  expect(stats.cellNodes / stats.rowNodes).toBeLessThan(25);
  // scroll horizontally through all columns: every step renders quickly; the last column's cells appear
  const times = await page.evaluate(async () => {
    const box = document.getElementById("cv-tbl-scroll");
    const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    const out = [];
    for (let x = 0; x <= box.scrollWidth; x += 400) {
      box.scrollLeft = x;
      await frame();
      out.push(window.CalcTable.stats().lastMs);
    }
    box.scrollLeft = box.scrollWidth;
    await frame();
    return out;
  });
  times.sort((a, b) => a - b);
  console.log(
    `200 columns: ${times.length} horizontal steps, render median ${times[times.length >> 1].toFixed(2)} ms, max ${times[times.length - 1].toFixed(2)} ms`,
  );
  expect(times[times.length - 1]).toBeLessThan(50);
  const last = keys[keys.length - 1];
  await expect(header(page, last)).toBeInViewport();
  const lastCells = await page.evaluate((key) => {
    const rows = [...document.querySelectorAll(".cv-tr")].filter((r) => !r.hidden);
    return rows.map((r) => {
      const cell = [...r.querySelectorAll(".cv-td")].find((c) => !c.hidden && c.dataset.col === key);
      const value = window.__calc.rows.find((x) => x.key === r.dataset.key).values[key];
      return { rendered: Boolean(cell), text: cell ? cell.textContent : null, hasValue: value !== undefined };
    });
  }, last);
  expect(lastCells.length).toBeGreaterThan(0);
  for (const c of lastCells) {
    expect(c.rendered).toBe(true);
    expect(c.text !== "").toBe(c.hasValue);
  }
  stats = await page.evaluate(() => window.CalcTable.stats());
  expect(stats.cellNodes / stats.rowNodes).toBeLessThan(25);
  // sort by the last column; the chooser lists all 200 columns
  await clickSort(page, last);
  await expect(header(page, last)).toHaveAttribute("aria-sort", "ascending");
  await page.locator("#cv-columns").click();
  await expect(page.locator("#cv-chooser-list .cv-chooser-item")).toHaveCount(200);
  await page.getByRole("dialog", { name: "Spalten" }).getByRole("button", { name: "Schließen" }).click();
  expect(errors).toEqual([]);
});
