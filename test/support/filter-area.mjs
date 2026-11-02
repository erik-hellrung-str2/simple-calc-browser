// Helpers for browser tests of the filter area (TASK-004): filter sets are `.cv-fs[data-key=<property key>]`, their
// value rows `.cv-fs-value` (virtualised: only the rows near the visible window exist, hidden pool rows are skipped).
import { expect } from "./network-guard.mjs";

export const filterSet = (page, key) => page.locator(`.cv-fs[data-key="${key}"]`);

/** Titles of the filter sets in display order. */
export function setTitles(page) {
  return page.locator("#cv-filtersets .cv-fs-title").allTextContents();
}

/** Rendered value rows of a filter set in list order: [{ label, count (number), checked }]. */
export function shownValues(page, key) {
  return page.evaluate((k) => {
    const set = document.querySelector(`.cv-fs[data-key="${k}"]`);
    if (!set) return null;
    return [...set.querySelectorAll(".cv-fs-value")]
      .filter((row) => !row.hidden)
      .sort((a, b) => parseFloat(a.style.top) - parseFloat(b.style.top))
      .map((row) => ({
        label: row.querySelector(".cv-fs-label").textContent,
        count: Number(row.querySelector(".cv-fs-count").textContent.replace(/\./g, "")),
        checked: row.querySelector("input").checked,
      }));
  }, key);
}

/** { label -> count } of the rendered values of a filter set. */
export async function shownCounts(page, key) {
  return Object.fromEntries((await shownValues(page, key)).map((v) => [v.label, v.count]));
}

/** Clicks the checkbox of one value (by its label) in a filter set and waits for the filter evaluation. */
export async function toggleValue(page, key, label) {
  const before = await page.evaluate(() => window.__calc.filter.updates);
  await filterSet(page, key).getByRole("checkbox", { name: label, exact: true }).click();
  await page.waitForFunction((n) => window.__calc.filter.updates > n, before);
}

/** GlobalIds of the rows passing all filters (window.__calc.filter.keys), sorted. */
export function filteredGuids(page) {
  return page.evaluate(() => {
    const byKey = new Map(window.__calc.rows.map((r) => [r.key, r.guid]));
    return window.__calc.filter.keys.map((k) => byKey.get(k)).sort();
  });
}

/** Opens the property catalogue, searches `query` and adds the entry with property key `key`. */
export async function addFilterSet(page, query, key) {
  await page.locator("#cv-add-filterset").click();
  const dialog = page.getByRole("dialog", { name: "Filtersatz hinzufügen" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("searchbox", { name: "Eigenschaft suchen" }).fill(query);
  await dialog.locator(`.cv-cat-entry[data-key="${key}"]`).click();
  await expect(dialog).toBeHidden();
  await expect(filterSet(page, key)).toBeVisible();
}
