// Helpers for browser tests of the table (TASK-006a, REQ-006): header cells `.cv-th[data-key]`, virtualised body rows
// `.cv-tr[data-key]` (only rows near the visible window exist, cells only for columns near the visible width), the
// column filter popup `#cv-colfilter` and the column chooser dialog `Spalten`.
import { expect } from "./network-guard.mjs";

export const header = (page, key) => page.locator(`.cv-th[data-key="${key}"]`);

/** Column keys of the header in display order. */
export function headerKeys(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("#cv-tbl-scroll .cv-th")]
      .sort((a, b) => parseFloat(a.style.left) - parseFloat(b.style.left))
      .map((c) => c.dataset.key),
  );
}

/** Waits until the table has been updated after `before` (window.__calc.table.updates). */
export function tableUpdated(page, before) {
  return page.waitForFunction((n) => window.__calc.table.updates > n, before);
}

export function tableUpdates(page) {
  return page.evaluate(() => window.__calc.table.updates);
}

/**
 * Every table row in display order, collected by scrolling the table from top to bottom (the rows are
 * virtualised): [{ key, index (0-based display position), cells: { columnKey -> text } }]. Cells are those rendered
 * (columns near the visible width); with the default columns all are rendered. Scroll position is restored.
 */
export function allTableRows(page) {
  return page.evaluate(async () => {
    const box = document.getElementById("cv-tbl-scroll");
    const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const keep = box.scrollTop;
    const byIndex = new Map();
    const collect = () => {
      for (const row of box.querySelectorAll(".cv-tr")) {
        if (row.hidden || !row.dataset.key) continue;
        const index = Number(row.getAttribute("aria-rowindex")) - 2;
        const cells = {};
        for (const cell of row.querySelectorAll(".cv-td")) if (!cell.hidden) cells[cell.dataset.col] = cell.textContent;
        byIndex.set(index, { key: row.dataset.key, index, cells });
      }
    };
    box.scrollTop = 0;
    await frame();
    collect();
    const step = Math.max(28, box.clientHeight - 60);
    while (box.scrollTop + box.clientHeight < box.scrollHeight - 1) {
      const before = box.scrollTop;
      box.scrollTop = before + step;
      await frame();
      collect();
      if (box.scrollTop === before) break;
    }
    box.scrollTop = keep;
    await frame();
    return [...byIndex.values()].sort((a, b) => a.index - b.index);
  });
}

/** GlobalIds of the table rows (display order). */
export async function tableGuids(page) {
  const rows = await allTableRows(page);
  return page.evaluate(
    (keys) => {
      const byKey = new Map(window.__calc.rows.map((r) => [r.key, r.guid]));
      return keys.map((k) => byKey.get(k));
    },
    rows.map((r) => r.key),
  );
}

/** Clicks a header label (sort asc -> desc -> none) and waits for the table update. */
export async function clickSort(page, key) {
  const before = await tableUpdates(page);
  await header(page, key).locator(".cv-th-label").click();
  await tableUpdated(page, before);
}

/** Opens the column filter popup of a column; returns its locator. */
export async function openColumnFilter(page, key) {
  const popup = page.locator(`#cv-colfilter[data-key="${key}"]`);
  if (!(await popup.isVisible().catch(() => false))) await header(page, key).locator(".cv-th-filter").click();
  await expect(popup).toBeVisible();
  return popup;
}

/** Checks one value (by its label) in the open checklist popup of a text column and waits for the evaluation. */
export async function checkColumnValue(page, key, label, search) {
  const popup = await openColumnFilter(page, key);
  if (search !== undefined) await popup.getByRole("searchbox").fill(search);
  const before = await page.evaluate(() => window.__calc.filter.updates);
  await popup.getByRole("checkbox", { name: label, exact: true }).click();
  await page.waitForFunction((n) => window.__calc.filter.updates > n, before);
}

/** Types into the `von` / `bis` field of an open numeric column filter popup (fill = one input event). */
export async function typeBound(page, key, bound, text) {
  const popup = await openColumnFilter(page, key);
  await popup.locator(`input[data-bound="${bound}"]`).fill(text);
}

/** Opens `Spalten`, searches and adds the property `key`; closes the dialog. */
export async function addColumn(page, query, key) {
  await page.locator("#cv-columns").click();
  const dialog = page.getByRole("dialog", { name: "Spalten" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("searchbox", { name: "Eigenschaft suchen" }).fill(query);
  await dialog.locator(`.cv-cat-entry[data-key="${key}"]`).click();
  await expect(header(page, key)).toBeVisible();
  await dialog.getByRole("button", { name: "Schließen" }).click();
  await expect(dialog).toBeHidden();
}

/** CalcTable.state() (configuration part of the table). */
export function tableState(page) {
  return page.evaluate(() => window.CalcTable.state());
}

/** German number text as the reference formatting (independent of the product): thousands ".", up to 3 decimals. */
export const de3 = (n) => n.toLocaleString("de-DE", { maximumFractionDigits: 3 });
