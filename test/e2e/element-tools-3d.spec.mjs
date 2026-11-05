// TASK-014 (CR-002, INC-2): the 3D side of the element tools and `Fokus`, through the cv-3d test hook
// window.CalcView3D and real clicks on the canvas (spec REQ-013, REQ-005 `Fokus`, §4.4 CalcView.state(), DEC-18).
// The menu actions `Ausblenden` / `Isolieren` (TASK-017a, tested in hide-isolate.spec.mjs), the pills and the toolbar
// are wired in TASK-015a / TASK-017a / TASK-017c. The `Schneiden` and handle tests verify REQ-013-AC9 and AC10 as a
// whole since TASK-017c wired the pill `Schnitt entfernen` and are tagged with them; the other tests cite their ACs in
// comments only (spec T5), their end-to-end tests are in element-tools.spec.mjs: REQ-013-AC1 (menu placement and
// following), REQ-013-AC13 (menu below the point near the top), REQ-005-AC6 (`Fokus`).
// Expected values: GlobalIds and storeys from test/fixtures/reference-values.json (STEP-text derivation); planes,
// offsets, key steps and handle anchors derived here from the spec rules (REQ-013) and from the engine's geometry
// (element boxes, axis ranges, camera), never from the section code under test.
import { test, expect } from "../support/network-guard.mjs";
import { REF, fixture, loadFiles, openBuilder, removeModel } from "../support/builder.mjs";
import { addFilterSet, filterSet, toggleValue } from "../support/filter-area.mjs";
import { canvasShot, idle, keysOfGuids, pixelDifference, rowsByKey, viewState } from "../support/view-3d.mjs";

const FZK_REF = REF["AC20-FZK-Haus"];
const FZK = fixture("AC20-FZK-Haus.ifc");
const DUPLEX = fixture("Ifc2x3_Duplex_Architecture.ifc");
const WALL = "3rPX_Juz59peXXY6wDJl18"; // Wand-Ext-ERDG-1, exterior wall, ground floor
const SLAB = "1pPHnf7cXCpPsNEnQf8_6B"; // Bodenplatte, ground slab
const GROUND = FZK_REF.storeys.find((s) => s.elevation === 0).Name; // Erdgeschoss
const OFFSET = 0.002; // REQ-013: the plane sits 2 mm towards the camera

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => a.map((x, i) => x - b[i]);
const add = (a, b) => a.map((x, i) => x + b[i]);
const scale = (a, k) => a.map((x) => x * k);
const norm = (a) => Math.hypot(...a);
/** Component of v perpendicular to the unit vector n. */
const across = (v, n) => sub(v, scale(n, dot(v, n)));

async function openWith(page, files) {
  const errors = await openBuilder(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await loadFiles(page, files);
  await idle(page);
  return errors;
}

/**
 * Toggles these GlobalIds in the filter set GlobalId (added if missing): ticked ones stay opaque, all others are ghosts
 * (not pickable).
 */
async function onlyGuids(page, guids) {
  await ensureSet(page, "GlobalId");
  const search = filterSet(page, "GlobalId").getByRole("searchbox");
  for (const guid of guids) {
    await search.fill(guid);
    await toggleValue(page, "GlobalId", guid);
  }
  await search.fill("");
  await idle(page);
}

/** Adds the filter set key unless it is shown already (Geschoss is a default set, REQ-003). */
async function ensureSet(page, key) {
  if (!(await filterSet(page, key).count())) await addFilterSet(page, key, key);
}

/** Screen points inside the projected box of key, the projected centre first. */
async function candidatePoints(page, key) {
  const box = await page.evaluate((k) => window.CalcView.screenBox(k), key);
  const points = [[box.x, box.y]];
  for (const fx of [0.5, 0.35, 0.65, 0.2, 0.8])
    for (const fy of [0.5, 0.35, 0.65, 0.2, 0.8])
      points.push([box.left + (box.right - box.left) * fx, box.top + (box.bottom - box.top) * fy]);
  return points;
}

/** A screen point where a pick hits key (hook pickAt, no click), with the hit: { x, y, hit } or null. */
async function pickPoint(page, key, accept = () => true) {
  for (const [x, y] of await candidatePoints(page, key)) {
    const hit = await page.evaluate(([px, py]) => window.CalcView3D.pickAt(px, py), [x, y]);
    if (hit && hit.key === key && accept(hit)) return { x, y, hit };
  }
  return null;
}

/** Clicks key at a point where the pick hits it; returns { x, y, hit } (the menu is then open at the hit). */
async function clickElement(page, key, accept) {
  const at = await pickPoint(page, key, accept);
  expect(at, `a screen position of ${key} that picks it`).not.toBeNull();
  await page.mouse.click(at.x, at.y);
  await idle(page);
  await expect(menuOf(page)).toBeVisible();
  return at;
}

/** Centre of the menu's point marker and the card's box, in page pixels. */
async function menuGeometry(page) {
  return page.evaluate(() => {
    const d = document.querySelector("#cv-pick .cv-pick-dot").getBoundingClientRect();
    const c = document.querySelector("#cv-pick .cv-pick-card").getBoundingClientRect();
    return { x: d.left + d.width / 2, y: d.top + d.height / 2, card: { top: c.top, bottom: c.bottom } };
  });
}

const hook = (page, fn, arg) => page.evaluate(fn, arg);
/** The click menu (the card inside the zero-size anchor #cv-pick). */
const menuOf = (page) => page.locator('#cv-pick [role="menu"]');
const section = async (page) => (await viewState(page)).section;

test("@e2e a click on a wall opens the click menu at the clicked point; it follows an orbit and closes with `Menü schließen`, the selection stays", async ({
  page,
}) => {
  // REQ-013-AC1 (3D side): marker within 3 px of the click, card bottom within 30 px above it, exactly the buttons
  // `Ausblenden`, `Isolieren`, `Schneiden`, `Menü schließen`, properties panel open; the menu stays at the clicked
  // point when the camera orbits; `Menü schließen` closes it and keeps the selection
  test.setTimeout(240_000);
  const errors = await openWith(page, FZK);
  const [key] = await keysOfGuids(page, [WALL]);
  await onlyGuids(page, [WALL]);
  await expect(menuOf(page)).toBeHidden();
  const at = await clickElement(page, key);
  let state = await viewState(page);
  expect(state.selected).toEqual([key]);
  await expect(page.locator("#cv-props")).toBeVisible();
  const menu = menuOf(page);
  await expect(menu).toHaveAttribute("role", "menu");
  const items = menu.getByRole("menuitem");
  expect(
    await items.evaluateAll((list) => list.map((b) => b.getAttribute("aria-label") || b.textContent.trim())),
  ).toEqual(["Ausblenden", "Isolieren", "Schneiden", "Menü schließen"]);
  expect(await menu.locator("button").count()).toBe(4);
  let g = await menuGeometry(page);
  expect(Math.hypot(g.x - at.x, g.y - at.y), "marker centre at the click point").toBeLessThanOrEqual(3);
  expect(g.card.bottom).toBeLessThanOrEqual(at.y);
  expect(at.y - g.card.bottom, "card bottom within 30 px above the point").toBeLessThanOrEqual(30);
  const opened = await hook(page, () => window.CalcView3D.menu());
  expect(opened.key).toBe(key);
  expect(norm(sub(opened.point, at.hit.point)), "the clicked point (1 mm)").toBeLessThan(1e-3);

  // orbit: drag on the canvas left of the model (no pick: the pointer moves more than 4 px)
  const canvas = await page.locator("#cv-viewport canvas").boundingBox();
  const sx = canvas.x + 60;
  const sy = canvas.y + canvas.height - 60;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(sx + i * 6, sy - i * 2);
  await page.mouse.up();
  await idle(page);
  state = await viewState(page);
  expect(state.selected, "an orbit is no pick").toEqual([key]);
  g = await menuGeometry(page);
  expect(Math.hypot(g.x - at.x, g.y - at.y), "the camera moved the point on screen").toBeGreaterThan(5);
  const projected = await hook(page, (p) => window.CalcView3D.project(p), opened.point);
  expect(Math.hypot(g.x - projected.x, g.y - projected.y), "menu still at the clicked point").toBeLessThanOrEqual(1.5);
  const again = await hook(page, ([x, y]) => window.CalcView3D.pickAt(x, y), [g.x, g.y]);
  expect(again && again.key, "the marker lies on the wall").toBe(key);

  // `Menü schließen`: the menu closes, the selection and the properties panel stay
  await menu.getByRole("menuitem", { name: "Menü schließen" }).click();
  await expect(menu).toBeHidden();
  state = await viewState(page);
  expect(state.selected).toEqual([key]);
  await expect(page.locator("#cv-props")).toBeVisible();
  // `Ausblenden` closes the menu and hides the wall (wired by TASK-017a, REQ-013-AC2; was a stub that changed nothing);
  // `Ausblendung entfernen` shows it again
  await clickElement(page, key);
  await menu.getByRole("menuitem", { name: "Ausblenden" }).click();
  await expect(menu).toBeHidden();
  state = await viewState(page);
  expect(state.opaque).toEqual([]);
  expect(state.toolHidden).toContain(key);
  await page.locator("#cv-pill-hidden-reset").click();
  await idle(page);
  expect((await viewState(page)).opaque).toEqual([key]);
  // a click on empty space closes the menu (and clears the selection, REQ-007-AC5)
  await clickElement(page, key);
  await page.mouse.click(canvas.x + 20, canvas.y + 20);
  await idle(page);
  await expect(menu).toBeHidden();
  expect((await viewState(page)).selected).toEqual([]);
  expect(errors).toEqual([]);
});

test("@e2e the click menu opens below its point near the top of the 3D view and above it otherwise", async ({
  page,
}) => {
  // REQ-013-AC13 first part (3D side): the card flips below the point closer than 110 px to the top of the 3D view
  test.setTimeout(240_000);
  const errors = await openWith(page, FZK);
  const [key] = await keysOfGuids(page, [WALL]);
  await onlyGuids(page, [WALL]);
  const at = await clickElement(page, key);
  const canvas = await page.locator("#cv-viewport canvas").boundingBox();
  let g = await menuGeometry(page);
  expect(at.y - canvas.y).toBeGreaterThanOrEqual(110);
  expect(g.card.bottom).toBeLessThanOrEqual(g.y);
  // move the camera so that the point is 60 px below the top: shift camera and target along the screen's up vector
  const opened = await hook(page, () => window.CalcView3D.menu());
  const cam = await hook(page, () => window.CalcView3D.camera());
  for (let i = 0; i < 6; i++) {
    const p = await hook(page, (q) => window.CalcView3D.project(q), opened.point);
    const dy = p.y - (canvas.y + 60);
    if (Math.abs(dy) < 8) break;
    // the screen's up vector at the point: project a point 0.1 m higher and use the pixel ratio of a camera shift
    const up = [0, 0, 0.1];
    const q = await hook(page, (r) => window.CalcView3D.project(r), add(opened.point, up));
    const pxPerM = (p.y - q.y) / 0.1; // > 0: higher in the world is higher on screen
    const shift = scale([0, 0, 1], dy / pxPerM); // moving the camera up moves the point down on screen
    cam.position = sub(cam.position, shift);
    cam.target = sub(cam.target, shift);
    await hook(page, (c) => window.CalcView3D.look(c.position, c.target), cam);
    await idle(page);
  }
  g = await menuGeometry(page);
  expect(g.y - canvas.y, "point near the top").toBeLessThan(110);
  expect(g.y - canvas.y).toBeGreaterThan(0);
  expect(g.card.top, "card below the point").toBeGreaterThanOrEqual(g.y);
  await expect(page.locator("#cv-pick")).toHaveClass(/cv-pick-below/);
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-013-AC9 `Schneiden` on the slab top gives a horizontal plane 2 mm above the point with the handle and the pill `Schnitt entfernen`; on a wall's side face a vertical plane away from the camera; a second cut replaces it", async ({
  page,
}) => {
  // REQ-013-AC9: state().section = { point, normal }; slab top face with the camera above: normal [0, 0, -1],
  // point 2 mm above the clicked point (+-0.1 mm); the canvas changes; the handle `Schnitt verschieben` and the pill
  // `Schnitt entfernen` are shown (TASK-017c);
  // a wall's side face: normal horizontal (vertical component 0), perpendicular to the face, away from the camera;
  // a second `Schneiden` (the wall's top face) replaces the plane
  test.setTimeout(240_000);
  const errors = await openWith(page, FZK);
  const [wall, slab] = await keysOfGuids(page, [WALL, SLAB]);
  await onlyGuids(page, [SLAB]);
  const handle = page.getByRole("button", { name: "Schnitt verschieben" });
  const pill = page.locator("#cv-pill-section");
  await expect(handle).toBeHidden();
  await expect(pill).toBeHidden();

  // slab top face (camera above it)
  let without = await canvasShot(page);
  const slabBox = await hook(page, (k) => window.CalcView3D.box(k), slab);
  const slabAt = await clickElement(page, slab, (h) => h.normal && h.normal[2] > 0.9);
  expect(slabAt.hit.point[2], "the hit is on the slab's top face").toBeCloseTo(slabBox.max[2], 2);
  let cam = await hook(page, () => window.CalcView3D.camera());
  expect(cam.position[2]).toBeGreaterThan(slabBox.max[2]);
  const slabPick = await hook(page, () => window.CalcView3D.menu()); // the clicked point the menu holds
  expect(norm(sub(slabPick.point, slabAt.hit.point))).toBeLessThan(1e-3);
  await menuOf(page).getByRole("menuitem", { name: "Schneiden" }).click();
  await expect(menuOf(page)).toBeHidden();
  let s = await section(page);
  expect(s.normal).toEqual([0, 0, -1]);
  expect(Math.abs(s.point[2] - (slabPick.point[2] + OFFSET)), "2 mm above the clicked point").toBeLessThanOrEqual(1e-4);
  expect(Math.abs(s.point[0] - slabPick.point[0])).toBeLessThan(1e-6);
  expect(Math.abs(s.point[1] - slabPick.point[1])).toBeLessThan(1e-6);
  await expect(handle).toBeVisible();
  await expect(pill).toBeVisible();
  await expect(pill.getByRole("button", { name: "Schnitt entfernen", exact: true })).toHaveAttribute(
    "title",
    "Schnitt aufheben",
  );
  // the app holds the same plane (saved in the configuration, DEC-20)
  expect(await page.evaluate(() => window.__calc.view.section)).toEqual(s);
  // the canvas changes (the ghosts above the slab are cut away)
  expect(await pixelDifference(page, without, await canvasShot(page)), "the cut changes the canvas").toBeGreaterThan(
    0.01,
  );
  // table and selection unaffected by the section (REQ-013, Schneiden is 3D only)
  expect((await viewState(page)).selected).toEqual([slab]);
  expect(await page.evaluate(() => window.__calc.filter.count)).toBe(1);

  // wall side face (a hit whose face normal is horizontal), after removing the slab's section with the pill
  await pill.getByRole("button", { name: "Schnitt entfernen", exact: true }).click();
  expect(await section(page)).toBeNull();
  await expect(handle).toBeHidden();
  await expect(pill).toBeHidden();
  await onlyGuids(page, [SLAB, WALL]); // unticks the slab, ticks the wall
  without = await canvasShot(page);
  const wallAt = await clickElement(page, wall, (h) => h.normal && Math.abs(h.normal[2]) < 0.1);
  cam = await hook(page, () => window.CalcView3D.camera());
  const wallPick = await hook(page, () => window.CalcView3D.menu());
  expect(norm(sub(wallPick.point, wallAt.hit.point))).toBeLessThan(1e-3);
  await menuOf(page).getByRole("menuitem", { name: "Schneiden" }).click();
  s = await section(page);
  expect(s.normal[2], "vertical plane: horizontal normal").toBe(0);
  expect(norm(s.normal)).toBeCloseTo(1, 9);
  // perpendicular to the face: along the wall's thin horizontal axis (engine box of the wall)
  const box = await hook(page, (k) => window.CalcView3D.box(k), wall);
  const size = sub(box.max, box.min);
  const thin = size[0] < size[1] ? 0 : 1;
  expect(size[thin] * 3, "a wall: thin along one horizontal axis").toBeLessThan(size[1 - thin]);
  expect(Math.abs(s.normal[thin]), "normal perpendicular to the face").toBeGreaterThan(0.999);
  expect(dot(s.normal, sub(wallPick.point, cam.position)), "normal points away from the camera").toBeGreaterThan(0);
  // the point is the clicked point moved 2 mm towards the camera (against the normal)
  expect(norm(sub(s.point, add(wallPick.point, scale(s.normal, -OFFSET))))).toBeLessThan(1e-4);
  await expect(handle).toBeVisible();
  const cutWall = await canvasShot(page);
  expect(await pixelDifference(page, without, cutWall), "the cut changes the canvas").toBeGreaterThan(0.01);

  // a second `Schneiden` on the wall's top face (the wall is in the kept half) replaces the plane
  const topAt = await clickElement(page, wall, (h) => h.normal && h.normal[2] > 0.9);
  expect(topAt.hit.point[2]).toBeCloseTo(box.max[2], 2);
  const topPick = await hook(page, () => window.CalcView3D.menu());
  await menuOf(page).getByRole("menuitem", { name: "Schneiden" }).click();
  s = await section(page);
  expect(s.normal).toEqual([0, 0, -1]);
  expect(Math.abs(s.point[2] - (topPick.point[2] + OFFSET))).toBeLessThanOrEqual(1e-4);
  expect(
    await pixelDifference(page, cutWall, await canvasShot(page)),
    "the new plane replaced the first",
  ).toBeGreaterThan(0.01);
  expect(errors).toEqual([]);
});

test("@e2e `Schneiden` without a face normal uses the direction to the camera: vertical from the default view, horizontal from above", async ({
  page,
}) => {
  // REQ-013 camera fallback (ref L1082): |vertical component| >= 0.7 of the direction to the camera gives a horizontal
  // plane, else a vertical one; the half facing the camera is removed; the point moves 2 mm towards the camera
  test.setTimeout(180_000);
  const errors = await openWith(page, FZK);
  const [slab] = await keysOfGuids(page, [SLAB]);
  const slabBox = await hook(page, (k) => window.CalcView3D.box(k), slab);
  const point = scale(add(slabBox.min, slabBox.max), 0.5);
  const expected = (camPos) => {
    const toCamera = sub(camPos, point);
    let n = scale(toCamera, 1 / norm(toCamera));
    if (Math.abs(n[2]) >= 0.7) n = [0, 0, Math.sign(n[2])];
    else n = scale([n[0], n[1], 0], 1 / Math.hypot(n[0], n[1]));
    return { point: add(point, scale(n, OFFSET)), normal: scale(n, -1) };
  };
  // default view direction (1, 0.75, 1) in three = 0.47 vertical: vertical plane
  let cam = await hook(page, () => window.CalcView3D.camera());
  await hook(page, (p) => window.CalcView3D.cut(p, null), point);
  let s = await section(page);
  let e = expected(cam.position);
  expect(s.normal[2]).toBe(0);
  for (let i = 0; i < 3; i++) {
    expect(s.normal[i]).toBeCloseTo(e.normal[i], 9);
    expect(s.point[i]).toBeCloseTo(e.point[i], 9);
  }
  // camera straight above: horizontal plane, kept half below
  const above = { position: add(point, [0.5, 0.5, 40]), target: point };
  await hook(page, (c) => window.CalcView3D.look(c.position, c.target), above);
  cam = await hook(page, () => window.CalcView3D.camera());
  await hook(page, (p) => window.CalcView3D.cut(p, null), point);
  s = await section(page);
  e = expected(cam.position);
  expect(s.normal).toEqual([0, 0, -1]);
  for (let i = 0; i < 3; i++) {
    expect(s.normal[i]).toBeCloseTo(e.normal[i], 12);
    expect(s.point[i]).toBeCloseTo(e.point[i], 9);
  }
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-013-AC10 the section handle sits on the plane at the models' centre; arrow keys move the plane by 1 % / 10 % of the extent, dragging moves it along the normal only; `Schnitt entfernen` removes the section, handle and pill", async ({
  page,
}) => {
  // REQ-013-AC10: drag moves state().section.point along the normal only, normal unchanged; ArrowUp x3 = 3 % of the
  // extent along +normal (the kept half shrinks), ArrowDown x3 back; Shift = 10 %; ArrowRight / ArrowLeft as Up /
  // Down; the pill `Schnitt entfernen` (TASK-017c; was: the interim 1.0.0 axis controls) sets state().section = null
  // and hides handle and pill
  test.setTimeout(240_000);
  const errors = await openWith(page, FZK);
  const [slab] = await keysOfGuids(page, [SLAB]);
  await onlyGuids(page, [SLAB]);
  await clickElement(page, slab, (h) => h.normal && h.normal[2] > 0.9);
  await menuOf(page).getByRole("menuitem", { name: "Schneiden" }).click();
  const start = await section(page);
  expect(start.normal).toEqual([0, 0, -1]);
  const handle = page.getByRole("button", { name: "Schnitt verschieben" });
  await expect(handle).toBeVisible();

  // handle position: centre of the models' box (axis ranges) projected onto the plane
  const range = await hook(page, () => ["X", "Y", "Z"].map((a) => window.CalcView.axisRange(a)));
  const centre = range.map((r) => (r.min + r.max) / 2);
  const anchor = sub(centre, scale(start.normal, dot(start.normal, sub(centre, start.point))));
  const p = await hook(page, (q) => window.CalcView3D.project(q), anchor);
  const hb = await handle.boundingBox();
  expect(Math.hypot(hb.x + hb.width / 2 - p.x, hb.y + hb.height / 2 - p.y), "handle on the plane").toBeLessThanOrEqual(
    1.5,
  );
  expect(hb.width).toBe(36);

  // keys: extent of the models along the normal = the Z range (normal [0, 0, -1])
  const extent = range[2].max - range[2].min;
  expect(await hook(page, () => window.CalcView3D.extent())).toBeCloseTo(extent, 9);
  const moved = async (expectedMeters) => {
    const s = await section(page);
    expect(s.normal).toEqual(start.normal);
    const d = sub(s.point, start.point);
    expect(norm(across(d, start.normal)), "moves along the normal only").toBeLessThan(1e-9);
    expect(dot(d, start.normal)).toBeCloseTo(expectedMeters, 9);
  };
  await handle.focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowUp");
  await moved(0.03 * extent);
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowDown");
  await moved(0);
  await page.keyboard.press("Shift+ArrowUp");
  await moved(0.1 * extent);
  await page.keyboard.press("ArrowLeft");
  await moved(0.09 * extent);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+ArrowDown");
  await moved(0);
  // +normal = into the kept half: with normal [0, 0, -1] ArrowUp lowers the plane, so less of the model is kept
  await page.keyboard.press("ArrowUp");
  expect((await section(page)).point[2]).toBeLessThan(start.point[2]);
  await page.keyboard.press("ArrowDown");

  // drag: 40 px up on screen moves the plane against the normal (up), along the normal only
  const b = await handle.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 4; i++) await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 - i * 10);
  await page.mouse.up();
  await idle(page);
  const dragged = await section(page);
  expect(dragged.normal).toEqual(start.normal);
  const d = sub(dragged.point, start.point);
  expect(norm(across(d, start.normal))).toBeLessThan(1e-9);
  expect(dot(d, start.normal), "dragged upwards: against the downward normal").toBeLessThan(-0.05);
  expect((await viewState(page)).selected, "the drag is no pick").toEqual([slab]);

  // the app follows the handle (the plane it would save, DEC-20)
  expect(await page.evaluate(() => window.__calc.view.section)).toEqual(dragged);
  // `Schnitt entfernen`: no section, handle and pill gone
  const pill = page.locator("#cv-pill-section");
  await expect(pill).toBeVisible();
  await pill.getByRole("button", { name: "Schnitt entfernen", exact: true }).click();
  expect(await section(page)).toBeNull();
  expect(await page.evaluate(() => window.__calc.view.section)).toBeNull();
  await expect(handle).toBeHidden();
  await expect(pill).toBeHidden();
  expect(errors).toEqual([]);
});

test("@e2e `Fokus` fits the opaque elements: an isolated ground-floor wall fills the view; without an opaque element all models are fitted", async ({
  page,
}) => {
  // REQ-005-AC6 (3D side): isolated ground-floor wall (tool-removed: all other rows) and Geschoss = Erdgeschoss
  // checked; `Fokus`: every opaque element's projected box lies inside the canvas, the wall fills >= 25 % of the canvas
  // width or height; no opaque element: all models are fitted (the fit after loading)
  test.setTimeout(240_000);
  const errors = await openWith(page, FZK);
  const loadedCamera = await hook(page, () => window.CalcView.camera());
  const [wall] = await keysOfGuids(page, [WALL]);
  await ensureSet(page, "Geschoss");
  await toggleValue(page, "Geschoss", GROUND);
  await idle(page);
  const canvas = await page.locator("#cv-viewport canvas").boundingBox();
  const inside = (b) =>
    b.left >= canvas.x - 1 &&
    b.top >= canvas.y - 1 &&
    b.right <= canvas.x + canvas.width + 1 &&
    b.bottom <= canvas.y + canvas.height + 1;

  // Fokus with the filter only: the ground-floor elements (ghosts do not count) all fit
  await hook(page, () => window.CalcView3D.focus());
  let state = await viewState(page);
  expect(state.ghost.length).toBeGreaterThan(0);
  for (const key of state.opaque)
    expect(inside(await page.evaluate((k) => window.CalcView.screenBox(k), key)), key).toBe(true);

  // isolate the wall (3D side: tool-removed class for every other row, isolation active)
  await hook(
    page,
    (k) => {
      const plan = window.CalcView3D.lastPlan();
      return window.CalcView3D.display({
        toolRemoved: Uint8Array.from(plan.rows, (r) => (r.key === k ? 0 : 1)),
        isolating: true,
      });
    },
    wall,
  );
  state = await viewState(page);
  expect(state.opaque).toEqual([wall]);
  expect(state.ghost).toEqual([]);
  await hook(page, () => window.CalcView3D.focus());
  await idle(page);
  const box = await page.evaluate((k) => window.CalcView.screenBox(k), wall);
  expect(inside(box), "the wall's projected box lies inside the canvas").toBe(true);
  const share = Math.max((box.right - box.left) / canvas.width, (box.bottom - box.top) / canvas.height);
  console.log(`[REQ-005-AC6] isolated wall fills ${(share * 100).toFixed(0)} % of the canvas`);
  expect(share).toBeGreaterThanOrEqual(0.25);

  // no opaque element: all models fitted = the camera of the fit after loading; every element's box inside
  await hook(page, () => {
    const plan = window.CalcView3D.lastPlan();
    return window.CalcView3D.display({ toolRemoved: new Uint8Array(plan.rows.length).fill(1), isolating: true });
  });
  expect((await viewState(page)).opaque).toEqual([]);
  await hook(page, () => window.CalcView3D.focus());
  await idle(page);
  const cam = await hook(page, () => window.CalcView.camera());
  for (let i = 0; i < 3; i++) {
    expect(cam.position[i]).toBeCloseTo(loadedCamera.position[i], 6);
    expect(cam.target[i]).toBeCloseTo(loadedCamera.target[i], 6);
  }
  const rows = await rowsByKey(page);
  for (const row of rows.values())
    if (row.geometry)
      expect(inside(await page.evaluate((k) => window.CalcView.screenBox(k), row.key)), row.key).toBe(true);
  expect(errors).toEqual([]);
});

test("@e2e state() reports tool-hidden, marked and filtered-out elements by the reason of the engine call (display mirror)", async ({
  page,
}) => {
  // spec 4.4: toolHidden = removed by the tools (never ghost, also with ghosts on; wins over the filter), hidden =
  // filtered out with ghosts off, marked = shown elements matching a `Markieren` rule (subset of opaque), colours hold
  // mark and colouring paint; a colouring colour equal to the mark colour is not reported as marked; isolation hides
  // the context geometry (REQ-013-AC3 3D side: contextState().visible = 0)
  test.setTimeout(240_000);
  const errors = await openWith(page, FZK);
  const rows = [...(await rowsByKey(page)).values()];
  const geometry = rows.filter((r) => r.geometry).map((r) => r.key);
  const ground = rows.filter((r) => r.geometry && r.values.Geschoss === GROUND).map((r) => r.key);
  const upper = geometry.filter((k) => !ground.includes(k));
  expect(ground.length).toBeGreaterThan(5);
  expect(upper.length).toBeGreaterThan(5);
  await ensureSet(page, "Geschoss");
  await toggleValue(page, "Geschoss", GROUND);
  // tool-removed: two ground-floor elements and one upper-floor element; marked: two ground-floor elements, one of
  // them tool-removed, and one upper-floor element (outside the filter)
  const removed = [ground[0], ground[1], upper[0]];
  const marks = [ground[1], ground[2], upper[1]];
  const apply = (extra) =>
    hook(
      page,
      ([rm, mk, more]) => {
        const plan = window.CalcView3D.lastPlan();
        return window.CalcView3D.display({
          toolRemoved: Uint8Array.from(plan.rows, (r) => (rm.includes(r.key) ? 1 : 0)),
          marked: Uint8Array.from(plan.rows, (r) => (mk.includes(r.key) ? 1 : 0)),
          ...(more.colourAll ? { colourOf: () => "#F08A87" } : {}),
          ...(more.mode ? { mode: more.mode } : {}),
          ...(more.isolating ? { isolating: true } : {}),
        });
      },
      [removed, marks, extra],
    );
  await apply({});
  let s = await viewState(page);
  let full = await page.evaluate(() => {
    const st = window.CalcView.state();
    return { toolHidden: [...st.toolHidden].sort(), marked: [...st.marked].sort() };
  });
  const sorted = (a) => [...a].sort();
  expect(s.mode).toBe("ghost");
  expect(full.toolHidden).toEqual(sorted(removed));
  expect(s.opaque).toEqual(sorted(ground.filter((k) => !removed.includes(k))));
  expect(s.ghost).toEqual(sorted(upper.filter((k) => !removed.includes(k))));
  expect(s.hidden).toEqual([]);
  expect(full.marked).toEqual([ground[2]]);
  expect(s.colours).toEqual({ [ground[2]]: "#f08a87" });
  // the engine really hides the tool-removed elements
  const target = rows.find((r) => r.key === removed[0]);
  expect(
    await page.evaluate(([m, id]) => window.CalcView.engineVisible(m, [id]), [target.model, target.localId]),
  ).toEqual([false]);
  expect((await page.evaluate(() => window.CalcView.contextState())).visible).toBeGreaterThan(0);

  // ghosts off: filtered out -> hidden, tool-removed stays toolHidden
  await apply({ mode: "hide" });
  s = await viewState(page);
  full = await page.evaluate(() => [...window.CalcView.state().toolHidden].sort());
  expect(s.mode).toBe("hide");
  expect(full).toEqual(sorted(removed));
  expect(s.hidden).toEqual(sorted(upper.filter((k) => !removed.includes(k))));
  expect(s.ghost).toEqual([]);

  // colouring in the mark colour: every opaque element painted #f08a87, only the marked one reported as marked
  await apply({ colourAll: true });
  s = await viewState(page);
  const marked = await page.evaluate(() => [...window.CalcView.state().marked].sort());
  expect(marked).toEqual([ground[2]]);
  expect(Object.keys(s.colours).sort()).toEqual(s.opaque);
  expect(new Set(Object.values(s.colours))).toEqual(new Set(["#f08a87"]));

  // isolation active: the context geometry (IfcSite terrain) is hidden like tool-removed elements
  await apply({ isolating: true });
  const context = await page.evaluate(() => window.CalcView.contextState());
  expect(context.items).toBeGreaterThan(0);
  expect(context.visible).toBe(0);
  expect(errors).toEqual([]);
});

test("@e2e @robustness click menu and section handle: menu closes when its element stops being shown or its model is removed, hides behind the camera; planes outside the models, invalid planes; last model removed", async ({
  page,
}) => {
  // spec T7 (CR-002): click menu while its element stops being shown (filter, model removal) or its point moves
  // behind the camera; plane outside the models and handle off-screen or behind the camera; invalid planes; the last
  // model with geometry removed while a section is active
  test.setTimeout(300_000);
  const errors = await openWith(page, [FZK, DUPLEX]);
  const [wall] = await keysOfGuids(page, [WALL]);
  await onlyGuids(page, [WALL]);
  const menu = menuOf(page);
  const handle = page.getByRole("button", { name: "Schnitt verschieben" });

  // the element leaves the filter: the menu closes (the selection is cleared by cv-app, REQ-007)
  await clickElement(page, wall);
  await filterSet(page, "GlobalId").getByRole("searchbox").fill(WALL);
  await toggleValue(page, "GlobalId", WALL); // unticked: no filter, still shown -> menu stays
  await idle(page);
  await expect(menu).toBeVisible();
  await ensureSet(page, "Geschoss");
  const upper = FZK_REF.storeys.find((x) => x.elevation > 0).Name;
  await toggleValue(page, "Geschoss", upper);
  await idle(page);
  await expect(menu, "the wall became a ghost: menu closed").toBeHidden();
  await toggleValue(page, "Geschoss", upper);
  await onlyGuids(page, [WALL]); // the wall alone again (the other model's and walls' geometry may cover it)

  // tool-removed through the plan: the menu closes
  await clickElement(page, wall);
  await hook(
    page,
    (k) => {
      const plan = window.CalcView3D.lastPlan();
      return window.CalcView3D.display({ toolRemoved: Uint8Array.from(plan.rows, (r) => (r.key === k ? 1 : 0)) });
    },
    wall,
  );
  await expect(menu).toBeHidden();
  await hook(page, () => window.CalcView3D.display({ toolRemoved: null }));

  // point behind the camera: menu (and handle) hidden, back in view: shown again
  const at = await clickElement(page, wall);
  await menuOf(page).getByRole("menuitem", { name: "Schneiden" }).click();
  await expect(handle).toBeVisible();
  await clickElement(page, wall, (h) => norm(sub(h.point, at.hit.point)) < 5);
  const opened = await hook(page, () => window.CalcView3D.menu());
  const cam = await hook(page, () => window.CalcView3D.camera());
  const away = sub(opened.point, cam.position); // looking away from the point, from beyond it
  await hook(page, (c) => window.CalcView3D.look(c.position, c.target), {
    position: add(opened.point, scale(away, 0.5)),
    target: add(opened.point, scale(away, 2)),
  });
  await idle(page);
  expect(await hook(page, (q) => window.CalcView3D.project(q), opened.point)).toBeNull();
  await expect(menu).toHaveCSS("visibility", "hidden");
  await hook(page, (c) => window.CalcView3D.look(c.position, c.target), cam);
  await idle(page);
  await expect(menu).toHaveCSS("visibility", "visible");

  // a plane outside every model is applied as given; its handle (anchor far above) is hidden, the plane stays
  const far = { point: [0, 0, 1000], normal: [0, 0, -1] };
  expect(await hook(page, (p) => window.CalcView3D.setSection(p), far)).toBe(true);
  expect(await section(page)).toEqual(far);
  await expect(page.locator("#cv-section-handle")).toHaveCSS("visibility", "hidden");
  // a non-unit normal is normalised; invalid planes are not applied (the previous plane stays)
  expect(await hook(page, () => window.CalcView3D.setSection({ point: [1, 2, 3], normal: [0, 3, 4] }))).toBe(true);
  const plane = { point: [1, 2, 3], normal: [0, 0.6, 0.8] };
  const expectPlane = (s) => {
    for (let i = 0; i < 3; i++) {
      expect(s.point[i]).toBeCloseTo(plane.point[i], 12);
      expect(s.normal[i]).toBeCloseTo(plane.normal[i], 12);
    }
  };
  expectPlane(await section(page));
  for (const bad of [
    { point: [1, 2, 3], normal: [0, 0, 0] },
    { point: [1, 2, Number.NaN], normal: [0, 0, 1] },
    { point: [1, 2], normal: [0, 0, 1] },
    { point: [1, 2, 3], normal: [0, "1", 0] },
  ])
    expect(await hook(page, (p) => window.CalcView3D.setSection(p), bad), JSON.stringify(bad)).toBe(false);
  expectPlane(await section(page));

  // the menu's model removed: the menu closes; the section stays while a model with geometry is loaded
  await clickElement(page, wall);
  await removeModel(page, "AC20-FZK-Haus");
  await idle(page);
  await expect(menu).toBeHidden();
  expectPlane(await section(page));
  // the last model with geometry removed: the section is removed, the handle hidden
  await removeModel(page, "Ifc2x3_Duplex_Architecture");
  await idle(page);
  expect(await section(page)).toBeNull();
  await expect(handle).toBeHidden();
  expect(errors).toEqual([]);
});
