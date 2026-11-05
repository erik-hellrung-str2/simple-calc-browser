// Helpers for browser tests of the selection (TASK-006c, REQ-007): table rows `.cv-tr[data-key]` / group rows
// `.cv-tr[data-group]` marked `cv-sel` + aria-selected, the selection in window.__calc.view (selected, selectedGroup,
// selectedKeys), real 3D clicks at a probed screen position of an element, and the camera seam.
import { expect } from "./network-guard.mjs";
import { viewState } from "./view-3d.mjs";

/** window.__calc.view selection part: { selected, selectedGroup, selectedKeys (sorted) }. */
export function selection(page) {
  return page.evaluate(() => {
    const v = window.__calc.view;
    return { selected: v.selected, selectedGroup: v.selectedGroup, selectedKeys: [...v.selectedKeys].sort() };
  });
}

/**
 * Rendered body rows that carry the selection mark: { keys (element rows, sorted, unique), groups (group ids) }. Every
 * marked row must have both the class and aria-selected; unmarked rows neither.
 */
export function markedRows(page) {
  return page.evaluate(() => {
    const keys = new Set();
    const groups = [];
    const inconsistent = [];
    for (const row of document.querySelectorAll("#cv-tbl-scroll .cv-tbl-body .cv-tr")) {
      if (row.hidden) continue;
      const cls = row.classList.contains("cv-sel");
      const aria = row.getAttribute("aria-selected") === "true";
      if (cls !== aria) inconsistent.push(row.dataset.key || row.dataset.group);
      if (!cls) continue;
      if (row.dataset.key) keys.add(row.dataset.key);
      else groups.push(row.dataset.group);
    }
    return { keys: [...keys].sort(), groups, inconsistent };
  });
}

/**
 * Whether a row of element key (or of group id with { group: true }) is rendered and fully visible in the table box,
 * between the sticky header and the sticky total row: { rendered, visible, index (display index) }.
 */
export function rowVisibility(page, id, options = {}) {
  return page.evaluate(
    ({ id, group }) => {
      const box = document.getElementById("cv-tbl-scroll");
      const head = box.querySelector(".cv-tbl-head").getBoundingClientRect();
      const foot = document.getElementById("cv-tbl-total");
      const outer = box.getBoundingClientRect();
      const top = head.bottom;
      const bottom =
        foot && !foot.hidden ? foot.getBoundingClientRect().top : outer.top + box.clientTop + box.clientHeight;
      const rows = [...box.querySelectorAll(".cv-tbl-body .cv-tr")].filter(
        (r) => !r.hidden && (group ? r.dataset.group === id : r.dataset.key === id),
      );
      if (!rows.length) return { rendered: false, visible: false, index: -1 };
      const visible = rows.find((r) => {
        const rect = r.getBoundingClientRect();
        return rect.top >= top - 0.5 && rect.bottom <= bottom + 0.5;
      });
      const row = visible || rows[0];
      return { rendered: true, visible: Boolean(visible), index: Number(row.getAttribute("aria-rowindex")) - 2 };
    },
    { id, group: Boolean(options.group) },
  );
}

/** Scrolls the table box (test side) to a scrollTop and waits two frames. */
export function scrollTable(page, top) {
  return page.evaluate(async (t) => {
    const box = document.getElementById("cv-tbl-scroll");
    box.scrollTop = t === "end" ? box.scrollHeight : t;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return box.scrollTop;
  }, top);
}

/** Display index of an element key (first occurrence) or group id in the shown table (window.__calc.table). */
export function displayIndex(page, id, options = {}) {
  return page.evaluate(
    ({ id, group }) => {
      const t = window.__calc.table;
      if (t.view === "grouped")
        return t.display.findIndex((r) =>
          group ? r.type === "group" && r.id === id : r.type === "element" && r.key === id,
        );
      return group ? -1 : t.keys.indexOf(id);
    },
    { id, group: Boolean(options.group) },
  );
}

/**
 * Clicks a table row like a user: brings it into view by scrolling the box (test side), then clicks inside the row at
 * x = 300 px (in the grouping view the `Anzahl` cell, away from the expand toggle).
 */
export async function clickRow(page, id, options = {}) {
  const index = await displayIndex(page, id, options);
  expect(index, `row ${id} is shown`).toBeGreaterThanOrEqual(0);
  await page.evaluate(async (i) => {
    const box = document.getElementById("cv-tbl-scroll");
    box.scrollTop = Math.max(0, i * 28 - 40);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, index);
  const row = page.locator(`#cv-tbl-scroll .cv-tbl-body .cv-tr[aria-rowindex="${index + 2}"]:not([hidden])`);
  await row.click({ position: { x: 300, y: 14 } });
}

/**
 * Finds a screen position where a real 3D click selects the element key (projected centre of its engine bounding box
 * first, then points inside the box; as the REQ-007-AC1 test). The probe clicks select; the selection is cleared with
 * Escape afterwards (since CR-002 a 3D click also opens the click menu, which the first Escape closes alone, REQ-007
 * `Esc` order; TASK-017c). Returns [x, y] or null.
 */
export async function probePick(page, key) {
  const box = await page.evaluate((k) => window.CalcView.screenBox(k), key);
  const points = [[box.x, box.y]];
  for (const fx of [0.5, 0.35, 0.65, 0.2, 0.8])
    for (const fy of [0.5, 0.35, 0.65])
      points.push([box.left + (box.right - box.left) * fx, box.top + (box.bottom - box.top) * fy]);
  let hit = null;
  for (const [x, y] of points) {
    await page.mouse.click(x, y);
    const state = await viewState(page);
    if (state.selected.length === 1 && state.selected[0] === key) {
      hit = [x, y];
      break;
    }
  }
  if (await page.locator('#cv-pick [role="menu"]').isVisible()) await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  expect((await viewState(page)).selected).toEqual([]);
  return hit;
}

/** Camera position and orbit target (CalcView.camera()). */
export function camera(page) {
  return page.evaluate(() => window.CalcView.camera());
}

/**
 * The properties panel (REQ-007, CR-002: floating inside the 3D view, hidden while nothing is selected): { open (shown),
 * key (data-key), group (data-group), kicker, title, chip (Modell), count, nogeo }.
 */
export function details(page) {
  return page.evaluate(() => {
    const panel = document.getElementById("cv-props");
    const text = (sel) => panel.querySelector(sel)?.textContent ?? null;
    return {
      open: !panel.hidden && panel.getBoundingClientRect().height > 0,
      key: panel.dataset.key || null,
      group: panel.dataset.group ?? null,
      kicker: text(".cv-det-kicker"),
      title: text(".cv-det-title"),
      chip: text(".cv-props-chip"),
      count: text(".cv-det-count"),
      nogeo: text(".cv-det-nogeo"),
    };
  });
}
