// TASK-021 (INC-2, cycle 2): `Fokus` fits the model into the part of the 3D view that the open overlays leave free.
// User decision Q-005 (2026-11-06, `Fokus freie Fläche`) for BUG-T11 (testing cycle 2 A-2: at 1280 x 800 the 3D view is
// about 1000 x 390 px and the open panels cover the model); a design detail inside REQ-005-AC6 (cited here, not in the
// titles: these tests check the free-area rule, the whole AC is tested in element-tools.spec.mjs), no layout change.
// Overlays that count (Q-005): the filter or colouring panel, the properties panel and the pill stack. Expected values:
// the walls and storeys from test/fixtures/reference-values.json (STEP-text derivation); the free area is derived
// here from the overlays' DOM rects and the engine's projection (test/support/free-area.mjs), never from the
// product's free-area computation. Without overlays `Fokus` stays the whole-view fit of REQ-005.
import { test, expect } from "../support/network-guard.mjs";
import { REF, fixture, loadFiles, openBuilder } from "../support/builder.mjs";
import { toggleValue } from "../support/filter-area.mjs";
import { idle, keysOfGuids, viewState } from "../support/view-3d.mjs";
import { clickRow } from "../support/selection.mjs";
import { openFilterPanel, toolbar } from "../support/rules.mjs";
import { afterUpdate } from "../support/tools.mjs";
import { freeAreaCheck, overlayRects, unionBox } from "../support/free-area.mjs";

const FZK = fixture("AC20-FZK-Haus.ifc");
const WALLS = REF["REQ-013-tools"].walls; // the 13 IfcWallStandardCase elements (name, GlobalId, storey)
const GROUND = REF["AC20-FZK-Haus"].storeys.find((s) => s.elevation === 0).Name; // Erdgeschoss

test.describe.configure({ timeout: 240_000 });

const camera = (page) => page.evaluate(() => window.CalcView.camera());
const props = (page) => page.locator("#cv-props");

async function fokus(page) {
  await toolbar(page).getByRole("button", { name: "Fokus", exact: true }).click();
  await idle(page);
}

/** Zooms out with the wheel, so the next `Fokus` has to fit. */
async function zoomOut(page) {
  const c = await page.locator("#cv-viewport canvas").boundingBox();
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 400);
  await idle(page);
}

/** After `Fokus`: the opaque elements' projected box lies in the free area and takes a reasonable share of it. */
async function expectInFreeArea(page, label, expectedOverlays) {
  const state = await viewState(page);
  expect(state.opaque.length, label).toBeGreaterThan(0);
  const rects = await overlayRects(page);
  expect(rects.covering.map((r) => r.id).sort(), `${label}: overlays`).toEqual([...expectedOverlays].sort());
  const box = await unionBox(page, state.opaque);
  const check = freeAreaCheck(box, rects, 3);
  console.log(
    `[TASK-021] ${label}: box ${["left", "top", "right", "bottom"].map((k) => box[k].toFixed(0)).join(",")}, ` +
      `room ${check.room.width.toFixed(0)} x ${check.room.height.toFixed(0)}, fill ${(check.fill * 100).toFixed(0)} %`,
  );
  expect(check.inside, `${label}: inside the canvas`).toBe(true);
  expect(check.hits, `${label}: covered by no open overlay`).toEqual([]);
  expect(check.fill, `${label}: not tiny, fills its free span`).toBeGreaterThanOrEqual(0.5);
  return box;
}

test("@e2e `Fokus` at 1280 x 800 with the properties panel and the filter or colouring panel open fits the opaque elements into the free area; `Isolieren` keeps the camera; without overlays the whole-view fit (Q-005, BUG-T11)", async ({
  page,
}) => {
  const errors = await openBuilder(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await loadFiles(page, FZK);
  await idle(page);
  const canvas = await page.locator("#cv-viewport canvas").boundingBox();
  expect(Math.round(canvas.width), "3D view width at 1280 x 800 (BUG-T11)").toBe(1000);
  expect(canvas.height, "3D view height at 1280 x 800 (BUG-T11)").toBeLessThan(400);

  // no overlay open: the toolbar `Fokus` is the whole-view fit of REQ-005 (the same camera as the 3D side's `Fokus`
  // without overlays, tested in element-tools-3d.spec.mjs), and every opaque element lies inside the canvas
  expect((await overlayRects(page)).covering).toEqual([]);
  await zoomOut(page);
  await fokus(page);
  const plain = await camera(page);
  await page.evaluate(() => window.CalcView3D.focus());
  await idle(page);
  const whole = await camera(page);
  for (let i = 0; i < 3; i++) {
    expect(plain.position[i]).toBeCloseTo(whole.position[i], 6);
    expect(plain.target[i]).toBeCloseTo(whole.target[i], 6);
  }
  await expectInFreeArea(page, "no overlay", []);

  // Geschoss = Erdgeschoss checked (pill `Filter entfernen`), a ground-floor wall selected in the table (properties
  // panel), filter panel open
  const ground = WALLS.filter((w) => w.Geschoss === GROUND);
  const [wall] = await keysOfGuids(page, [ground[0].GlobalId]);
  await afterUpdate(page, () => toggleValue(page, "Geschoss", GROUND));
  await clickRow(page, wall);
  await expect(props(page)).toBeVisible();
  await openFilterPanel(page);
  await zoomOut(page);
  await fokus(page);
  const groundState = await viewState(page);
  expect(groundState.ghost.length, "the other storeys are ghosts (they do not count)").toBeGreaterThan(0);
  expect(groundState.opaque).toContain(wall);
  await expectInFreeArea(page, "ground floor, properties + filter panel + pill", [
    "cv-props",
    "cv-filter-panel",
    "cv-pills",
  ]);

  // `Isolieren` in the properties panel: the camera stays (as the reference, ref L1109-1118: no refit); the pill
  // `Isolierung entfernen` appears; `Fokus` then fits the wall into the free area
  const beforeIsolate = await camera(page);
  await afterUpdate(page, () => page.locator("#cv-props-isolate").click());
  expect((await viewState(page)).opaque).toEqual([wall]);
  const afterIsolate = await camera(page);
  for (let i = 0; i < 3; i++) {
    expect(afterIsolate.position[i], "`Isolieren` does not move the camera").toBeCloseTo(beforeIsolate.position[i], 6);
    expect(afterIsolate.target[i]).toBeCloseTo(beforeIsolate.target[i], 6);
  }
  await expect(props(page)).toBeVisible();
  await expect(page.locator("#cv-filter-panel")).toBeVisible();
  await zoomOut(page);
  await fokus(page);
  const wallBox = await expectInFreeArea(page, "isolated wall, properties + filter panel + pills", [
    "cv-props",
    "cv-filter-panel",
    "cv-pills",
  ]);
  // the full-view fit would centre the wall in the canvas, under the overlays: the free-area fit moved it
  const centre = { x: canvas.x + canvas.width / 2, y: canvas.y + canvas.height / 2 };
  const shifted = Math.hypot(
    (wallBox.left + wallBox.right) / 2 - centre.x,
    (wallBox.top + wallBox.bottom) / 2 - centre.y,
  );
  expect(shifted, "the wall is not centred in the full canvas").toBeGreaterThan(20);

  // the colouring panel instead of the filter panel (taller): the same rule
  await toolbar(page).getByRole("button", { name: "Färben", exact: true }).click();
  await expect(page.locator("#cv-colour-panel")).toBeVisible();
  await zoomOut(page);
  await fokus(page);
  await expectInFreeArea(page, "isolated wall, properties + colouring panel + pills", [
    "cv-props",
    "cv-colour-panel",
    "cv-pills",
  ]);
  // `Fokus` twice with the same overlays gives the same camera
  const once = await camera(page);
  await fokus(page);
  const twice = await camera(page);
  for (let i = 0; i < 3; i++) expect(twice.position[i]).toBeCloseTo(once.position[i], 6);
  expect(errors).toEqual([]);
});

test("@e2e `Fokus` with only the pill stack shown fits an isolated wall beside the pills (Q-005)", async ({ page }) => {
  const errors = await openBuilder(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await loadFiles(page, FZK);
  await idle(page);
  // a ground-floor wall isolated through the properties panel, then the selection cleared (`Esc`): only the pills
  // `Filter entfernen` and `Isolierung entfernen` remain
  const ground = WALLS.filter((w) => w.Geschoss === GROUND);
  const keys = await keysOfGuids(
    page,
    ground.map((w) => w.GlobalId),
  );
  await clickRow(page, keys[0]);
  await expect(props(page)).toBeVisible();
  await afterUpdate(page, () => page.locator("#cv-props-isolate").click());
  await page.keyboard.press("Escape");
  await expect(props(page)).toBeHidden();
  await zoomOut(page);
  await fokus(page);
  await expectInFreeArea(page, "isolated wall, pills only", ["cv-pills"]);
  expect(errors).toEqual([]);
});
