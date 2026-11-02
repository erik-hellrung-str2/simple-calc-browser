// Helpers for browser tests of the grouping view (TASK-006b, REQ-006): the view switch `Einzelelemente | Gruppiert`,
// the level pickers `#cv-group-1` / `#cv-group-2` (catalogue dialog `Gruppieren nach (Ebene n)`), group rows
// `.cv-tr.cv-grp[data-group]` with the toggle `.cv-grp-toggle`, element rows `.cv-tr.cv-tr-el[data-key]` and the
// total row `#cv-tbl-total`. Body rows are virtualised: allDisplayRows collects them by scrolling.
import { expect } from "./network-guard.mjs";
import { tableUpdated, tableUpdates } from "./table.mjs";

export const GROUP_COLUMN = "@gruppe";
export const COUNT_COLUMN = "@anzahl";

/** Clicks `Einzelelemente` or `Gruppiert` and waits for the table update. */
export async function setView(page, name) {
  const before = await tableUpdates(page);
  await page.getByRole("radio", { name, exact: true }).click();
  await tableUpdated(page, before);
}

/** Chooses the property of grouping level 1 or 2 through its picker and the catalogue dialog. */
export async function pickGroup(page, level, query, key) {
  await page.locator(`#cv-group-${level}`).click();
  const dialog = page.getByRole("dialog", { name: `Gruppieren nach (Ebene ${level})` });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("searchbox", { name: "Eigenschaft suchen" }).fill(query);
  const before = await tableUpdates(page);
  await dialog.locator(`.cv-cat-entry[data-key="${key}"]`).click();
  await tableUpdated(page, before);
  await expect(dialog).toBeHidden();
}

/** CalcTable.grouping() (configuration part: view and grouping properties). */
export function groupingState(page) {
  return page.evaluate(() => window.CalcTable.grouping());
}

/**
 * Every shown row of the table in display order, collected by scrolling (virtualised body): [{ index, type 'group' |
 * 'element', id (group), level (group), key (element), depth (data-depth), expanded (group: aria-expanded), cells
 * { columnKey -> text }, groupPad (left padding of the `Gruppe` cell in px), markLeft (element: left edge of the
 * marker in px relative to the row) }].
 */
export function allDisplayRows(page) {
  return page.evaluate(async () => {
    const box = document.getElementById("cv-tbl-scroll");
    const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const keep = box.scrollTop;
    const byIndex = new Map();
    const collect = () => {
      for (const row of box.querySelectorAll(".cv-tbl-body .cv-tr")) {
        if (row.hidden) continue;
        const index = Number(row.getAttribute("aria-rowindex")) - 2;
        const cells = {};
        let groupPad = null;
        for (const cell of row.querySelectorAll(".cv-td")) {
          if (cell.hidden) continue;
          cells[cell.dataset.col] = cell.textContent;
          if (cell.dataset.col === "@gruppe") groupPad = parseFloat(getComputedStyle(cell).paddingLeft);
        }
        const isGroup = row.dataset.group !== undefined;
        byIndex.set(index, {
          index,
          type: isGroup ? "group" : "element",
          id: isGroup ? row.dataset.group : null,
          level: isGroup ? Number(row.dataset.level) : null,
          key: isGroup ? null : row.dataset.key,
          depth: Number(row.dataset.depth),
          expanded: isGroup ? row.getAttribute("aria-expanded") === "true" : null,
          cells,
          groupPad,
        });
      }
    };
    box.scrollTop = 0;
    await frame();
    collect();
    const step = Math.max(28, box.clientHeight - 90);
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

/** Cells { columnKey -> text } of the total row `Summe` (null when hidden). */
export function totalRow(page) {
  return page.evaluate(() => {
    const foot = document.getElementById("cv-tbl-total");
    if (!foot || foot.hidden) return null;
    return Object.fromEntries([...foot.querySelectorAll(".cv-td")].map((c) => [c.dataset.col, c.textContent]));
  });
}

/**
 * Clicks the toggle of a group given by its path of `Gruppe` labels ([level-1 label] or [level-1 label, level-2
 * label]): the row is scrolled into view first (virtualised body), then its toggle is clicked like a user does.
 * expand: the expected state before the click is the opposite (the toggle's accessible name says what it does).
 */
export async function toggleGroup(page, path, expand) {
  const index = await page.evaluate(async (labels) => {
    let parent = null;
    const display = window.__calc.table.display;
    for (let i = 0; i < display.length; i++) {
      const row = display[i];
      if (row.type !== "group") continue;
      if (row.level === 1) parent = row.label;
      const match =
        labels.length === 1
          ? row.level === 1 && row.label === labels[0]
          : row.level === 2 && parent === labels[0] && row.label === labels[1];
      if (!match) continue;
      const box = document.getElementById("cv-tbl-scroll");
      box.scrollTop = Math.max(0, i * 28 - 40);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return i;
    }
    return -1;
  }, path);
  expect(index, `group ${path.join(" / ")}`).toBeGreaterThanOrEqual(0);
  const label = path[path.length - 1];
  const name = `${expand ? "Gruppe aufklappen" : "Gruppe zuklappen"}: ${label}`;
  const before = await tableUpdates(page);
  await page
    .locator(`.cv-tbl-body .cv-tr[aria-rowindex="${index + 2}"]`)
    .getByRole("button", { name, exact: true })
    .click();
  await tableUpdated(page, before);
}

/** Groups of the display rows: level-1 groups, each with its level-2 groups and element keys that follow it. */
export function nest(rows) {
  const out = [];
  let g1 = null;
  let g2 = null;
  for (const row of rows) {
    if (row.type === "group" && row.level === 1) {
      g1 = { ...row, children: [], elements: [] };
      g2 = null;
      out.push(g1);
    } else if (row.type === "group") {
      g2 = { ...row, elements: [] };
      g1.children.push(g2);
    } else (g2 || g1).elements.push(row);
  }
  return out;
}

/** German count text: thousands ".". */
export const deCount = (n) => n.toLocaleString("de-DE");
