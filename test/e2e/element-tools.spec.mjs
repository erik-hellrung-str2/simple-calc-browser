// TASK-017c (CR-002, INC-2): the element tools end to end through the UI — the click menu in 3D (REQ-013-AC1,
// AC13), the `Esc` order with the click menu (REQ-007-AC5), `Fokus` from the toolbar (REQ-005-AC6), the pill stack
// with `Schnitt entfernen` (REQ-013-AC13) and the exports under rules, hidden elements, a `Markieren` rule and a
// section (REQ-008-AC6). Real clicks on the canvas at points where the engine's pick hits the element (cv-3d hook
// pickAt, no click); state from CalcView.state() (spec 4.4), window.__calc and the DOM. Expected walls, names and
// storeys come from test/fixtures/reference-values.json (STEP-text derivation), never from the code under test;
// menu, fit and section geometry are derived here from the spec rules and from the engine's projection.
import { test, expect } from "../support/network-guard.mjs";
import { REF, fixture, loadFiles, openBuilder } from "../support/builder.mjs";
import { filterSet, toggleValue } from "../support/filter-area.mjs";
import { colourBy, idle, keysOfGuids, rowsByKey, viewState } from "../support/view-3d.mjs";
import { allTableRows, headerKeys } from "../support/table.mjs";
import { clickRow } from "../support/selection.mjs";
import { addRule, openFilterPanel, removeRule, toolbar } from "../support/rules.mjs";
import { exportFile, readExport } from "../support/export.mjs";
import {
  afterUpdate,
  appSection,
  clickMenu,
  cutAt,
  firstPickable,
  isolateTogether,
  menuAction,
  menuGeometry,
  panelAction,
  pickPoint,
  shownPills,
} from "../support/tools.mjs";

const FZK = fixture("AC20-FZK-Haus.ifc");
const TOOLS = REF["REQ-013-tools"];
const Y = TOOLS.rows; // 99 element rows of FZK
const WALLS = TOOLS.walls; // the 13 IfcWallStandardCase elements (name, GlobalId, storey)
const GROUND = REF["AC20-FZK-Haus"].storeys.find((s) => s.elevation === 0).Name; // Erdgeschoss
const de = (n) => n.toLocaleString("de-DE");
const status = (page) => page.locator("#cv-status");
const props = (page) => page.locator("#cv-props");

test.describe.configure({ timeout: 240_000 });

async function openWith(page, files) {
  const errors = await openBuilder(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await loadFiles(page, files);
  await idle(page);
  return errors;
}

const canvasBox = (page) => page.locator("#cv-viewport canvas").boundingBox();
const project = (page, point) => page.evaluate((p) => window.CalcView3D.project(p), point);

/** A canvas point where no element is picked (empty space), searched along the canvas border. */
async function emptyPoint(page) {
  const c = await canvasBox(page);
  for (const [fx, fy] of [
    [0.02, 0.04],
    [0.98, 0.04],
    [0.02, 0.6],
    [0.5, 0.04],
  ]) {
    const x = c.x + c.width * fx;
    const y = c.y + c.height * fy;
    if (!(await page.evaluate(([px, py]) => window.CalcView3D.pickAt(px, py), [x, y]))) return { x, y };
  }
  throw new Error("no empty canvas point");
}

test("@e2e @acceptance @REQ-013-AC1 a click on a wall at its projected screen position selects it and opens the click menu at the point (marker within 3 px, card within 30 px above) with `Ausblenden`, `Isolieren`, `Schneiden`, `Menü schließen` and the properties panel; the menu follows an orbit; `Menü schließen` keeps the selection", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  const keys = await keysOfGuids(
    page,
    WALLS.map((w) => w.GlobalId),
  );
  // no filter: the first of the 13 walls a click at a point inside its projected box picks
  const at = await firstPickable(page, keys);
  const wall = WALLS[keys.indexOf(at.key)];
  const box = await page.evaluate((k) => window.CalcView.screenBox(k), at.key);
  expect(at.x).toBeGreaterThanOrEqual(box.left);
  expect(at.x).toBeLessThanOrEqual(box.right);
  expect(at.y).toBeGreaterThanOrEqual(box.top);
  expect(at.y).toBeLessThanOrEqual(box.bottom);
  await expect(clickMenu(page)).toBeHidden();
  await page.mouse.click(at.x, at.y);
  await idle(page);

  expect((await viewState(page)).selected).toEqual([at.key]);
  await expect(props(page)).toBeVisible();
  await expect(props(page)).toHaveAttribute("data-key", at.key);
  await expect(props(page).locator(".cv-det-title")).toHaveText(wall.Name);
  const menu = clickMenu(page);
  await expect(menu).toBeVisible();
  expect(
    await menu
      .locator("button")
      .evaluateAll((list) => list.map((b) => b.getAttribute("aria-label") || b.textContent.trim())),
  ).toEqual(["Ausblenden", "Isolieren", "Schneiden", "Menü schließen"]);
  let g = await menuGeometry(page);
  expect(Math.hypot(g.x - at.x, g.y - at.y), "marker centre within 3 px of the click point").toBeLessThanOrEqual(3);
  expect(g.card.bottom, "card above the point").toBeLessThanOrEqual(at.y);
  expect(at.y - g.card.bottom, "card bottom within 30 px above the point").toBeLessThanOrEqual(30);
  const opened = await page.evaluate(() => window.CalcView3D.menu());
  expect(opened.key).toBe(at.key);

  // orbit: a drag from empty space (more than 4 px: no pick); the menu stays at the wall's clicked point
  const start = await emptyPoint(page);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(start.x + i * 8, start.y + i * 3);
  await page.mouse.up();
  await idle(page);
  expect((await viewState(page)).selected, "an orbit is no pick").toEqual([at.key]);
  await expect(menu).toBeVisible();
  g = await menuGeometry(page);
  expect(Math.hypot(g.x - at.x, g.y - at.y), "the orbit moved the point on screen").toBeGreaterThan(5);
  const p = await project(page, opened.point);
  expect(Math.hypot(g.x - p.x, g.y - p.y), "menu at the clicked point after the orbit").toBeLessThanOrEqual(1.5);
  const again = await page.evaluate(([x, y]) => window.CalcView3D.pickAt(x, y), [g.x, g.y]);
  expect(again && again.key, "the marker lies on the wall").toBe(at.key);

  // `Menü schließen`: the menu closes, the selection and the properties panel stay
  await menu.getByRole("menuitem", { name: "Menü schließen" }).click();
  await expect(menu).toBeHidden();
  expect((await viewState(page)).selected).toEqual([at.key]);
  await expect(props(page)).toBeVisible();
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-007-AC5 `Esc` closes the click menu first and then the selection with its properties panel; empty space in 3D and `Schließen` clear the selection; `Esc` in a filter search field clears only the field", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  const keys = await keysOfGuids(
    page,
    WALLS.map((w) => w.GlobalId),
  );
  const at = await firstPickable(page, keys);
  const selected = async () => (await viewState(page)).selected;

  // a selected element with the click menu open: the first Esc closes only the menu, the second the selection
  await page.mouse.click(at.x, at.y);
  await idle(page);
  await expect(clickMenu(page)).toBeVisible();
  expect(await selected()).toEqual([at.key]);
  await page.keyboard.press("Escape");
  await expect(clickMenu(page)).toBeHidden();
  expect(await selected(), "the first Esc keeps the selection").toEqual([at.key]);
  await expect(props(page)).toBeVisible();
  await expect(page.locator(`#cv-tbl-scroll .cv-tr[aria-selected="true"][data-key="${at.key}"]`)).toHaveCount(1);
  await page.keyboard.press("Escape");
  expect(await selected()).toEqual([]);
  await expect(props(page)).toBeHidden();
  await expect(page.locator('#cv-tbl-scroll .cv-tr[aria-selected="true"]')).toHaveCount(0);

  // a click on empty space in 3D clears the selection, closes the panel and the menu
  await page.mouse.click(at.x, at.y);
  await idle(page);
  await expect(clickMenu(page)).toBeVisible();
  const empty = await emptyPoint(page);
  await page.mouse.click(empty.x, empty.y);
  await idle(page);
  expect(await selected()).toEqual([]);
  await expect(props(page)).toBeHidden();
  await expect(clickMenu(page)).toBeHidden();

  // `Schließen` in the properties panel (a selection from the table: no click menu)
  await clickRow(page, at.key);
  expect(await selected()).toEqual([at.key]);
  await expect(clickMenu(page)).toBeHidden();
  await props(page).getByRole("button", { name: "Schließen", exact: true }).click();
  expect(await selected()).toEqual([]);
  await expect(props(page)).toBeHidden();

  // Esc inside a filter search field clears only the field; the next Esc the selection
  await clickRow(page, at.key);
  const search = filterSet(page, "Kategorie").getByRole("searchbox");
  await search.fill("Wall");
  await page.keyboard.press("Escape");
  await expect(search).toHaveValue("");
  expect(await selected(), "Esc in the field keeps the selection").toEqual([at.key]);
  await expect(props(page)).toBeVisible();
  await page.locator("body").click({ position: { x: 5, y: 5 } }); // focus leaves the field (header area)
  await page.keyboard.press("Escape");
  expect(await selected()).toEqual([]);
  await expect(props(page)).toBeHidden();
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-005-AC6 `Fokus` in the toolbar fits an isolated ground-floor wall with Geschoss = Erdgeschoss checked: every opaque element inside the canvas, the wall at least 25 % of its width or height; with no opaque element it fits all models", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  const loaded = await page.evaluate(() => window.CalcView.camera()); // the fit of all models after loading
  const ground = WALLS.filter((w) => w.Geschoss === GROUND);
  expect(ground.length).toBeGreaterThan(0);
  const keys = await keysOfGuids(
    page,
    ground.map((w) => w.GlobalId),
  );
  // isolate one ground-floor wall with the click menu, then check Geschoss = Erdgeschoss
  const at = await firstPickable(page, keys);
  await menuAction(page, at, "Isolieren");
  await afterUpdate(page, () => toggleValue(page, "Geschoss", GROUND));
  // move the camera away first (zoom out with the wheel), so `Fokus` has to fit
  const c = await canvasBox(page);
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 400);
  await idle(page);
  let box = await page.evaluate((k) => window.CalcView.screenBox(k), at.key);
  const before = Math.max((box.right - box.left) / c.width, (box.bottom - box.top) / c.height);

  await toolbar(page).getByRole("button", { name: "Fokus", exact: true }).click();
  await idle(page);
  const state = await viewState(page);
  expect(state.opaque).toEqual([at.key]);
  const inside = (b) =>
    b.left >= c.x - 1 && b.top >= c.y - 1 && b.right <= c.x + c.width + 1 && b.bottom <= c.y + c.height + 1;
  for (const key of state.opaque)
    expect(inside(await page.evaluate((k) => window.CalcView.screenBox(k), key)), key).toBe(true);
  box = await page.evaluate((k) => window.CalcView.screenBox(k), at.key);
  const share = Math.max((box.right - box.left) / c.width, (box.bottom - box.top) / c.height);
  console.log(
    `[REQ-005-AC6] wall share of the canvas: ${(before * 100).toFixed(0)} % -> ${(share * 100).toFixed(0)} %`,
  );
  expect(share).toBeGreaterThanOrEqual(0.25);

  // no opaque element: a rule that no isolated element passes (the wall is no slab); `Fokus` fits all models
  await addRule(page, { mode: "isolate", key: "Kategorie", op: "eq", value: "IfcSlab" });
  await toolbar(page).getByRole("button", { name: "Filter", exact: true }).click(); // close the filter panel
  await expect(status(page)).toHaveText(`0 von ${de(Y)} Elementen`);
  expect((await viewState(page)).opaque).toEqual([]);
  await toolbar(page).getByRole("button", { name: "Fokus", exact: true }).click();
  await idle(page);
  const cam = await page.evaluate(() => window.CalcView.camera());
  for (let i = 0; i < 3; i++) {
    expect(cam.position[i]).toBeCloseTo(loaded.position[i], 6);
    expect(cam.target[i]).toBeCloseTo(loaded.target[i], 6);
  }
  for (const row of (await rowsByKey(page)).values())
    if (row.geometry)
      expect(inside(await page.evaluate((k) => window.CalcView.screenBox(k), row.key)), row.key).toBe(true);
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-013-AC13 a wall clicked less than 110 px below the top of the 3D view opens the menu card below the point; with a rule, colouring, isolated and hidden elements and a section the pills read `Filter entfernen`, `Einfärbung entfernen`, `Isolierung entfernen`, `Ausblendung entfernen`, `Schnitt entfernen`", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  const keys = await keysOfGuids(
    page,
    WALLS.map((w) => w.GlobalId),
  );
  const c = await canvasBox(page);
  // a wall point well below the top: the card opens above it
  let at = await firstPickable(page, keys);
  const point = at.hit.point;
  await page.mouse.click(at.x, at.y);
  await idle(page);
  let g = await menuGeometry(page);
  expect(at.y - c.y).toBeGreaterThanOrEqual(110);
  expect(g.card.bottom).toBeLessThanOrEqual(g.y);
  await page.keyboard.press("Escape"); // menu
  await page.keyboard.press("Escape"); // selection
  // move the camera (and its target) along world Z until that wall point is 60 px below the top of the 3D view
  const cam = await page.evaluate(() => window.CalcView3D.camera());
  for (let i = 0; i < 8; i++) {
    const p = await project(page, point);
    const dy = p.y - (c.y + 60);
    if (Math.abs(dy) < 6) break;
    const q = await project(page, [point[0], point[1], point[2] + 0.1]);
    const pxPerM = (p.y - q.y) / 0.1; // > 0: higher in the world is higher on screen
    const shift = dy / pxPerM; // moving the camera up moves the point down on screen
    cam.position[2] -= shift;
    cam.target[2] -= shift;
    await page.evaluate((v) => window.CalcView3D.look(v.position, v.target), cam);
    await idle(page);
  }
  // click the wall at a point less than 110 px below the top
  at = await pickPoint(page, at.key, (hit, x, y) => y - c.y < 110 && y - c.y > 12);
  expect(at, "a point of the wall less than 110 px below the top").not.toBeNull();
  await page.mouse.click(at.x, at.y);
  await idle(page);
  await expect(clickMenu(page)).toBeVisible();
  g = await menuGeometry(page);
  expect(Math.hypot(g.x - at.x, g.y - at.y)).toBeLessThanOrEqual(3);
  expect(g.y - c.y, "point less than 110 px below the top").toBeLessThan(110);
  expect(g.card.top, "card below the point").toBeGreaterThanOrEqual(g.y);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  // pill order: a section (click section on a wall), a rule, colouring, two isolated walls of which one is hidden
  await page.evaluate(() => window.CalcView3D.focus()); // back to a view of the house (test camera only)
  await idle(page);
  await cutAt(page, await firstPickable(page, keys));
  await addRule(page, { mode: "mark", key: "Kategorie", op: "eq", value: "IfcSlab" });
  await toolbar(page).getByRole("button", { name: "Filter", exact: true }).click(); // close the filter panel
  await colourBy(page, "Kategorie", "Kategorie");
  const [erdg1, erdg2] = TOOLS.toolWalls.map((w) => w.GlobalId);
  await isolateTogether(page, [erdg1, erdg2]);
  const [hidden] = await keysOfGuids(page, [erdg1]);
  await panelAction(page, hidden, "hide");
  expect(await shownPills(page)).toEqual([
    "Filter entfernen",
    "Einfärbung entfernen",
    "Isolierung entfernen",
    "Ausblendung entfernen",
    "Schnitt entfernen",
  ]);
  // the pills are stacked top to bottom in that order
  const tops = await page.evaluate(() =>
    [...document.querySelectorAll("#cv-pills .cv-pill")]
      .filter((p) => !p.hidden)
      .map((p) => p.getBoundingClientRect().top),
  );
  expect(tops).toEqual([...tops].sort((a, b) => a - b));
  await expect(page.locator("#cv-pill-section-reset")).toHaveAttribute("title", "Schnitt aufheben");
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-008-AC6 with the rule `Isolieren` · `Name` · `Beginnt mit` · `Wand`, one of those walls hidden, a `Markieren` rule and a section, CSV and Excel contain exactly the table's rows in table order, the same as without the `Markieren` rule and the section", async ({
  page,
}, testInfo) => {
  const errors = await openWith(page, FZK);
  // expected rows: the walls whose Name begins with `Wand` (all 13 reference walls; case-insensitive, DEC-19) minus the
  // hidden one; checked against the extracted names too
  const rows = [...(await rowsByKey(page)).values()];
  const wand = rows.filter((r) => typeof r.values.Name === "string" && r.values.Name.toLowerCase().startsWith("wand"));
  expect(wand.map((r) => r.guid).sort()).toEqual(WALLS.map((w) => w.GlobalId).sort());
  const [hiddenGuid] = TOOLS.toolWalls.map((w) => w.GlobalId);
  const [hiddenKey] = await keysOfGuids(page, [hiddenGuid]);
  const expectedNames = WALLS.filter((w) => w.GlobalId !== hiddenGuid)
    .map((w) => w.Name)
    .sort();

  // section first (click section on a wall), then the rules and the hidden wall
  const wallKeys = await keysOfGuids(
    page,
    WALLS.map((w) => w.GlobalId),
  );
  await cutAt(page, await firstPickable(page, wallKeys));
  await addRule(page, { mode: "isolate", key: "Name", op: "starts", value: "Wand" });
  await addRule(page, { mode: "mark", key: "Kategorie", op: "eq", value: "IfcWallStandardCase" });
  await toolbar(page).getByRole("button", { name: "Filter", exact: true }).click(); // close the filter panel
  await panelAction(page, hiddenKey, "hide");
  await expect(status(page)).toHaveText(`${de(WALLS.length - 1)} von ${de(Y)} Elementen`);
  const s = await viewState(page);
  expect(s.section).not.toBeNull();
  expect(s.marked.length).toBeGreaterThan(0);

  /** Table rows (display order) and both exports; the exports must equal the table. */
  async function exportsOf(name) {
    const table = await allTableRows(page);
    const header = await headerKeys(page);
    const csv = readExport("csv", (await exportFile(page, "csv", testInfo.outputPath(`${name}.csv`))).path);
    const xlsx = readExport("xlsx", (await exportFile(page, "xlsx", testInfo.outputPath(`${name}.xlsx`))).path);
    const body = csv.records.slice(1);
    expect(body.length, `${name}: one CSV line per table row`).toBe(table.length);
    table.forEach((row, i) => {
      header.forEach((key, j) => expect(body[i][j], `${name} CSV row ${i} ${key}`).toBe(row.cells[key]));
    });
    expect(xlsx.rows.length, `${name}: one XLSX row per table row plus header`).toBe(table.length + 1);
    xlsx.rows.slice(1).forEach((row, i) => {
      header.forEach((key, j) => expect(String(row[j].v ?? ""), `${name} XLSX row ${i} ${key}`).toBe(body[i][j]));
    });
    return { keys: table.map((r) => r.key), csv: csv.records, xlsx: xlsx.rows.map((r) => r.map((c) => c.v)) };
  }
  const withAll = await exportsOf("with-mark-and-section");
  expect(withAll.keys).not.toContain(hiddenKey);
  const nameAt = withAll.csv[0].indexOf("Name");
  expect(nameAt).toBeGreaterThanOrEqual(0);
  expect(
    withAll.csv
      .slice(1)
      .map((r) => r[nameAt])
      .sort(),
  ).toEqual(expectedNames);

  // without the `Markieren` rule and without the section: the same rows and files
  await openFilterPanel(page);
  await removeRule(page, 1);
  await toolbar(page).getByRole("button", { name: "Filter", exact: true }).click();
  await page.locator("#cv-pill-section-reset").click();
  await idle(page);
  expect(await appSection(page)).toBeNull();
  expect((await viewState(page)).marked).toEqual([]);
  const plain = await exportsOf("plain");
  expect(plain).toEqual(withAll);
  expect(errors).toEqual([]);
});
