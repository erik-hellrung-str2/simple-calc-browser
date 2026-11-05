// Helpers for browser tests of the element tools `Ausblenden` / `Isolieren` (TASK-017a, spec REQ-013, DEC-18): the
// click menu in 3D (real clicks at a screen point where the engine's pick hits the element), the properties-panel
// buttons, the filter-area entries of the non-set filter sources (#cv-fa-sources, REQ-004) and the pill stack
// (#cv-pills). State is read from window.__calc (tools, filter) and CalcView.state() (spec 4.4).
import { expect } from "./network-guard.mjs";
import { addFilterSet, filterSet, toggleValue } from "./filter-area.mjs";
import { groupingState, pickGroup, setView } from "./grouping.mjs";
import { clickRow } from "./selection.mjs";
import { idle } from "./view-3d.mjs";

/** Texts of the filter-area entries of the non-set filter sources, top to bottom. */
export function sourceEntries(page) {
  return page.locator("#cv-fa-sources .cv-fa-source-text").allTextContents();
}

/** The filter-area entry whose text is `text` (li.cv-fa-source). */
export const sourceEntry = (page, text) =>
  page.locator("#cv-fa-sources .cv-fa-source").filter({ has: page.getByText(text, { exact: true }) });

/** Labels of the shown pills, top to bottom. */
export function shownPills(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("#cv-pills .cv-pill")]
      .filter((p) => !p.hidden && p.getBoundingClientRect().height > 0)
      .map((p) => p.querySelector(".cv-pill-label").textContent),
  );
}

/** window.__calc.tools: { hidden (sorted keys), isolated (sorted keys or null) }. */
export function toolSets(page) {
  return page.evaluate(() => {
    const t = window.__calc.tools;
    return { hidden: [...t.hidden].sort(), isolated: t.isolated ? [...t.isolated].sort() : null };
  });
}

/** Runs action, then waits until the filters have been evaluated again and the 3D view is idle. */
export async function afterUpdate(page, action) {
  const before = await page.evaluate(() => window.__calc.filter.updates);
  await action();
  await page.waitForFunction((n) => window.__calc.filter.updates > n, before);
  await idle(page);
}

/** Screen points inside the projected box of key, the projected centre first. */
async function candidatePoints(page, key) {
  const box = await page.evaluate((k) => window.CalcView.screenBox(k), key);
  if (!box) return [];
  const points = [[box.x, box.y]];
  for (const fx of [0.5, 0.35, 0.65, 0.2, 0.8])
    for (const fy of [0.5, 0.35, 0.65, 0.2, 0.8])
      points.push([box.left + (box.right - box.left) * fx, box.top + (box.bottom - box.top) * fy]);
  return points;
}

/** A screen point where a pick hits key (cv-3d hook pickAt, no click): { x, y } or null. */
export async function pickPoint(page, key) {
  const canvas = await page.locator("#cv-viewport canvas").boundingBox();
  for (const [x, y] of await candidatePoints(page, key)) {
    if (x < canvas.x + 2 || y < canvas.y + 2 || x > canvas.x + canvas.width - 2 || y > canvas.y + canvas.height - 2)
      continue;
    const hit = await page.evaluate(([px, py]) => window.CalcView3D.pickAt(px, py), [x, y]);
    if (hit && hit.key === key) return { x, y };
  }
  return null;
}

/** The first of keys that a real click can pick in the current view, with its point: { key, x, y }. */
export async function firstPickable(page, keys) {
  for (const key of keys) {
    const at = await pickPoint(page, key);
    if (at) return { key, ...at };
  }
  throw new Error("none of the elements can be picked in the current view");
}

/** The click menu (role menu inside #cv-pick). */
export const clickMenu = (page) => page.locator('#cv-pick [role="menu"]');

/**
 * Clicks the element at a point where the pick hits it (selects it and opens the click menu, REQ-013), then the menu
 * item `item` (`Ausblenden` | `Isolieren`); waits for the evaluation.
 */
export async function menuAction(page, at, item) {
  await page.mouse.click(at.x, at.y);
  await idle(page);
  await expect(clickMenu(page)).toBeVisible();
  expect((await page.evaluate(() => window.__calc.view.selected)) === at.key, "the click selected the element").toBe(
    true,
  );
  await afterUpdate(page, () => clickMenu(page).getByRole("menuitem", { name: item, exact: true }).click());
  await expect(clickMenu(page)).toBeHidden();
}

/**
 * Selects the element by a click on its table row (single-element view) and clicks the properties-panel button
 * `Ausblenden` (name 'hide') or `Isolieren` ('isolate'); waits for the evaluation.
 */
export async function panelAction(page, key, name) {
  await clickRow(page, key);
  await expect(page.locator("#cv-props")).toBeVisible();
  await afterUpdate(page, () => page.locator(`#cv-props-${name}`).click());
}

/**
 * Isolates exactly the elements with these GlobalIds with one `Isolieren` (a "Given" state reachable by the UI): the
 * filter set GlobalId (added if missing) is narrowed to them, the grouping view by `Geometrie` gives one group row
 * `Ja` holding them, a click on it selects them (group selection), `Isolieren` in the properties panel isolates
 * them; then the GlobalId ticks are reset and the single-element view is shown (grouping level 1 stays `Geometrie`).
 * All elements need geometry.
 */
export async function isolateTogether(page, guids) {
  if (!(await filterSet(page, "GlobalId").count())) await addFilterSet(page, "GlobalId", "GlobalId");
  const search = filterSet(page, "GlobalId").getByRole("searchbox");
  for (const guid of guids) {
    await search.fill(guid);
    await toggleValue(page, "GlobalId", guid);
  }
  await search.fill("");
  if ((await groupingState(page)).view !== "grouped") await setView(page, "Gruppiert");
  if ((await groupingState(page)).groupBy[0] !== "Geometrie") await pickGroup(page, 1, "Geometrie", "Geometrie");
  const id = await page.evaluate(
    () => window.__calc.table.display.find((r) => r.type === "group" && r.level === 1 && r.label === "Ja").id,
  );
  await clickRow(page, id, { group: true });
  await expect(page.locator("#cv-props")).toBeVisible();
  await afterUpdate(page, () => page.locator("#cv-props-isolate").click());
  await afterUpdate(page, () => page.getByRole("button", { name: "Auswahl zurücksetzen: GlobalId" }).click());
  await setView(page, "Einzelelemente");
  await idle(page);
}
