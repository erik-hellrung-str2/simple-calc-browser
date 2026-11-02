// TASK-006b robustness of the grouping view (spec Testing T7, T10): a grouping property with 5,000 distinct values
// (a copy of AC20-FZK-Haus.ifc with 5,000 extra proxies built in memory, test/support/many-groups-fixture.mjs; expected
// groups read back by the reference STEP parser), empty results (no model, filter without elements) and HTML strings
// as group values (test/support/xss-fixture.mjs).
import { test, expect } from "../support/network-guard.mjs";
import { REF, fixture, loadFiles, openBuilder } from "../support/builder.mjs";
import { toggleValue } from "../support/filter-area.mjs";
import { idle, viewState } from "../support/view-3d.mjs";
import { XSS_NAMES, xssFixture } from "../support/xss-fixture.mjs";
import {
  AMOUNT_KEY,
  GROUP_COUNT,
  GROUP_KEY,
  manyGroupsExpected,
  manyGroupsFixture,
} from "../support/many-groups-fixture.mjs";
import { addColumn, clickSort, tableUpdated, tableUpdates } from "../support/table.mjs";
import {
  COUNT_COLUMN,
  GROUP_COLUMN,
  allDisplayRows,
  deCount,
  pickGroup,
  setView,
  toggleGroup,
  totalRow,
} from "../support/grouping.mjs";

const FZK = fixture("AC20-FZK-Haus.ifc");
const fzkGroups = REF["REQ-006-grouping-fzk"];
const NOT_ROWS = ["IfcOpeningElement"];
const VOLUME = fzkGroups.column;
const rowsOf = (byKategorie) =>
  Object.entries(byKategorie)
    .filter(([k]) => !NOT_ROWS.includes(k))
    .reduce((a, [, n]) => a + (typeof n === "number" ? n : n.count), 0);
const FZK_TOTAL = rowsOf(fzkGroups.byKategorie);

test.describe.configure({ timeout: 300_000 });

/** Rows rendered in the body right now: [{ index, label, count, type }]. */
function renderedRows(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll(".cv-tbl-body .cv-tr")]
      .filter((r) => !r.hidden)
      .map((r) => ({
        index: Number(r.getAttribute("aria-rowindex")) - 2,
        type: r.dataset.group !== undefined ? "group" : "element",
        label: r.querySelector('.cv-td[data-col="@gruppe"]')?.textContent ?? null,
        count: r.querySelector('.cv-td[data-col="@anzahl"]')?.textContent ?? null,
      }))
      .sort((a, b) => a.index - b.index),
  );
}

async function scrollTo(page, fraction) {
  await page.evaluate(async (f) => {
    const box = document.getElementById("cv-tbl-scroll");
    box.scrollTop = Math.round((box.scrollHeight - box.clientHeight) * f);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, fraction);
}

test("@robustness @REQ-006 grouping by a property with 5,000 distinct values: every group reachable, virtualised, total once", async ({
  page,
}) => {
  const errors = await openBuilder(page);
  const file = manyGroupsFixture();
  const expected = manyGroupsExpected(file.text);
  expect(Object.keys(expected.groups).length).toBe(GROUP_COUNT);
  await loadFiles(page, { name: file.name, mimeType: file.mimeType, buffer: file.buffer });
  await idle(page);
  const emptyCount = rowsOf(expected.empty);
  const total = GROUP_COUNT + emptyCount;
  await expect(page.locator("#cv-status")).toHaveText(`${deCount(total)} von ${deCount(total)} Elementen`);

  await setView(page, "Gruppiert");
  await addColumn(page, "Menge", AMOUNT_KEY);
  await pickGroup(page, 1, "Nummer", GROUP_KEY);
  const table = await page.evaluate(() => ({
    groups: window.__calc.table.groups,
    count: window.__calc.table.count,
    lastMs: window.__calc.table.lastMs,
  }));
  expect(table.groups).toBe(GROUP_COUNT + 1); // + "(leer)" for the FZK elements
  expect(table.count).toBe(GROUP_COUNT + 1);
  expect(table.lastMs, "regrouping 5,099 rows into 5,001 groups").toBeLessThan(500);
  await expect(page.locator("#cv-tbl-scroll")).toHaveAttribute("aria-rowcount", String(GROUP_COUNT + 3));

  // every group in value order with count and amount (hook), "(leer)" last
  const display = await page.evaluate(() =>
    window.__calc.table.display.map((r) => ({ label: r.label, count: r.count })),
  );
  const amounts = await page.evaluate((key) => window.__calc.table.display.map((r) => r.cells[key]), AMOUNT_KEY);
  const values = Object.keys(expected.groups).sort();
  expect(display.map((r) => r.label)).toEqual([...values, "(leer)"]);
  values.forEach((v, i) => {
    expect(display[i].count).toBe(expected.groups[v].count);
    expect(amounts[i]).toBe(expected.groups[v].amount);
  });
  expect(display[GROUP_COUNT]).toMatchObject({ label: "(leer)", count: emptyCount });
  expect(amounts[GROUP_COUNT]).toBeNull();

  // the DOM: few row nodes; jumps to the middle and the end show the matching groups
  const stats = await page.evaluate(() => window.CalcTable.stats());
  expect(stats.rowNodes).toBeLessThan(60);
  for (const f of [0, 0.5, 1]) {
    await scrollTo(page, f);
    const shown = await renderedRows(page);
    expect(shown.length).toBeGreaterThan(3);
    for (const r of shown) {
      expect(r.label).toBe(display[r.index].label);
      expect(r.count).toBe(deCount(display[r.index].count));
    }
    if (f === 1) expect(shown[shown.length - 1]).toMatchObject({ index: GROUP_COUNT, label: "(leer)" });
  }
  expect((await page.evaluate(() => window.CalcTable.stats())).maxMs).toBeLessThan(50);
  // total row: every element once, amount sum of all
  expect(await totalRow(page)).toMatchObject({
    [COUNT_COLUMN]: deCount(total),
    [AMOUNT_KEY]: deCount(expected.amountTotal),
  });

  // sorted by the amount descending: largest group first, "(leer)" stays last
  await clickSort(page, AMOUNT_KEY);
  await clickSort(page, AMOUNT_KEY);
  const sorted = await page.evaluate(() => window.__calc.table.display.map((r) => r.label));
  const byAmount = [...values].sort((a, b) => expected.groups[b].amount - expected.groups[a].amount);
  expect(sorted).toEqual([...byAmount, "(leer)"]);

  // Alle aufklappen: 5,001 group rows + every element once (single-valued); still virtualised
  let before = await tableUpdates(page);
  await page.getByRole("button", { name: "Alle aufklappen" }).click();
  await tableUpdated(page, before);
  expect(await page.evaluate(() => window.__calc.table.count)).toBe(GROUP_COUNT + 1 + total);
  const expandMs = await page.evaluate(() => window.__calc.table.lastMs);
  expect(expandMs).toBeLessThan(500);
  console.log(`5,000 groups: regroup ${table.lastMs.toFixed(1)} ms, expand all ${expandMs.toFixed(1)} ms`);
  await scrollTo(page, 1);
  const end = await renderedRows(page);
  expect(end[end.length - 1]).toMatchObject({ type: "element", index: GROUP_COUNT + total });
  expect((await page.evaluate(() => window.CalcTable.stats())).rowNodes).toBeLessThan(60);
  before = await tableUpdates(page);
  await page.getByRole("button", { name: "Alle zuklappen" }).click();
  await tableUpdated(page, before);
  expect(await page.evaluate(() => window.__calc.table.count)).toBe(GROUP_COUNT + 1);
  expect(errors).toEqual([]);
});

test("@robustness @REQ-006 grouping view with no model and with a filter result without elements", async ({ page }) => {
  const errors = await openBuilder(page);
  // no model: grouping view shows the hint and a total of 0
  await setView(page, "Gruppiert");
  await expect(page.locator("#cv-tbl-empty")).toHaveText("Keine Elemente.");
  expect(await page.locator(".cv-tbl-body .cv-tr:not([hidden])").count()).toBe(0);
  expect(await totalRow(page)).toMatchObject({ [GROUP_COLUMN]: "Summe", [COUNT_COLUMN]: "0" });
  await page.getByRole("button", { name: "Alle aufklappen" }).click();
  await page.getByRole("button", { name: "Alle zuklappen" }).click();

  // the grouping survives loading a model (Kategorie, collapsed)
  await loadFiles(page, FZK);
  await idle(page);
  await addColumn(page, "NetVolume", VOLUME);
  await pickGroup(page, 2, "Geschoss", "Geschoss");
  const kats = Object.keys(fzkGroups.byKategorie).filter((k) => !NOT_ROWS.includes(k));
  expect((await allDisplayRows(page)).length).toBe(kats.length);

  // Kategorie X AND Geschoss Y where X has no element on Y: no element (from the reference)
  const storeys = [...new Set(kats.flatMap((k) => Object.keys(fzkGroups.byKategorie[k].byGeschoss)))].filter(
    (g) => g !== "(leer)",
  );
  const [kat, storey] = kats
    .flatMap((k) => storeys.map((g) => [k, g]))
    .find(([k, g]) => !(g in fzkGroups.byKategorie[k].byGeschoss));
  await toggleValue(page, "Kategorie", kat);
  // the storey is no longer offered in the Geschoss set (0 hits); set it as column filter through the seam
  await page.evaluate((value) => {
    const state = window.CalcTable.state();
    state.columnFilters = [{ key: "Geschoss", type: "values", values: [value] }];
    window.CalcTable.setState(state);
  }, storey);
  await expect(page.locator("#cv-status")).toHaveText(`0 von ${deCount(FZK_TOTAL)} Elementen`);
  await expect(page.locator("#cv-tbl-empty")).toHaveText("Keine Elemente im Filter.");
  expect(await page.locator(".cv-tbl-body .cv-tr:not([hidden])").count()).toBe(0);
  expect(await totalRow(page)).toMatchObject({ [COUNT_COLUMN]: "0", [VOLUME]: "" });
  expect(await page.evaluate(() => window.__calc.table.total)).toEqual({ count: 0, cells: expect.any(Object) });
  expect((await viewState(page)).opaque).toEqual([]);
  // harmless: expand/collapse all and sorting on an empty grouping
  await page.getByRole("button", { name: "Alle aufklappen" }).click();
  await clickSort(page, VOLUME);
  await page.getByRole("button", { name: "Alle zuklappen" }).click();
  expect(await page.evaluate(() => window.__calc.table.count)).toBe(0);
  // reset: the groups come back
  await page.getByRole("button", { name: "Alle Filter zurücksetzen" }).click();
  await expect(page.locator("#cv-status")).toHaveText(`${deCount(FZK_TOTAL)} von ${deCount(FZK_TOTAL)} Elementen`);
  await expect.poll(async () => (await allDisplayRows(page)).length).toBe(kats.length);
  expect(await totalRow(page)).toMatchObject({ [COUNT_COLUMN]: deCount(FZK_TOTAL) });
  expect(errors).toEqual([]);
});

test("@robustness @T10 @REQ-006 HTML strings as group values are shown as text (no XSS)", async ({ page }) => {
  const errors = await openBuilder(page);
  page.on("dialog", (d) => {
    errors.push("dialog: " + d.message());
    d.dismiss();
  });
  await loadFiles(page, xssFixture());
  await idle(page);
  await setView(page, "Gruppiert");
  await pickGroup(page, 1, "Name", "Name");
  const labels = (await allDisplayRows(page)).map((r) => r.cells[GROUP_COLUMN]);
  for (const name of Object.values(XSS_NAMES)) expect(labels).toContain(name);
  // expand one of them: its toggle's accessible name carries the literal text
  await toggleGroup(page, [XSS_NAMES["2XPyKWY018sA1ygZKgQPtU"]], true);
  expect(await page.evaluate(() => document.querySelectorAll("#cv-root img, #cv-root script, #cv-root b").length)).toBe(
    0,
  );
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  expect(errors).toEqual([]);
});
