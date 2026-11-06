// Spec Testing T7 (CR-002) robustness items assigned to the cycle-2 testing phase by verification INC-2 SYNC-5:
// (1) `Schneiden` and `Fokus` while a display plan is queued: the plane and the fit apply to the latest plan, the plane
//     is taken from the clicked element's current pick, `Fokus` fits the bounding box of the elements shown by the
//     latest plan (no stale plane or bounding box);
// (2) arrow keys on the section handle on a flat, single-element extent: at least 1 mm per key press (REQ-013).
// Expected values are derived here from the spec rules (REQ-013 plane and key steps, REQ-005 `Fokus`) and from the
// engine's geometry (element boxes, axis ranges) or the crafted fixture's STEP text (test/support/flat-fixture.mjs),
// never from the section or fit code under test. A plan is "queued" when it is sent in the same task as the action:
// the engine applies plans asynchronously through its call queue, and an engine call (`box`) is queued ahead of it so
// the queue is busy when the plan and the action arrive.
import { test, expect } from "../support/network-guard.mjs";
import { fixture, loadFiles, openBuilder } from "../support/builder.mjs";
import { FLAT_SIZE_X, FLAT_SIZE_Y, FLAT_THICKNESS, FLAT_GUID, flatFixture } from "../support/flat-fixture.mjs";
import { clickMenu, pickPoint } from "../support/tools.mjs";
import { idle, keysOfGuids, viewState } from "../support/view-3d.mjs";

const FZK = fixture("AC20-FZK-Haus.ifc");
const WALL_A = "3rPX_Juz59peXXY6wDJl18"; // Wand-Ext-ERDG-1, ground floor (reference-values.json REQ-013-tools)
const WALL_B = "25OWQvmXj5BPgyergP43tY"; // Wand-Ext-OG-2, Dachgeschoss
const SLAB = "1pPHnf7cXCpPsNEnQf8_6B"; // Bodenplatte, ground slab
const OFFSET = 0.002; // REQ-013: the plane sits 2 mm towards the camera
const MIN_STEP = 0.001; // REQ-013: at least 1 mm per key press

const sub = (a, b) => a.map((x, i) => x - b[i]);
const norm = (a) => Math.hypot(...a);
const centre = (box) => box.min.map((x, i) => (x + box.max[i]) / 2);
const hook = (page, fn, arg) => page.evaluate(fn, arg);

async function openWith(page, files) {
  const errors = await openBuilder(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await loadFiles(page, files);
  await idle(page);
  return errors;
}

test("@e2e @robustness `Fokus` clicked while display plans are queued fits the element the latest plan shows, not a replaced plan or the applied one", async ({
  page,
}) => {
  // T7 (CR-002): two isolation plans (wall A, then wall B) queued behind a busy engine call, then the toolbar `Fokus`
  // in the same task: at the click the applied plan still shows every element; afterwards the opaque set is [B], the
  // camera target is the centre of B's box (the fit's centre, REQ-005 / ref L820-847), B lies inside the canvas and
  // fills >= 25 % of its width or height, and a second `Fokus` on the settled plan leaves the camera unchanged
  test.setTimeout(240_000);
  const errors = await openWith(page, FZK);
  const [a, b] = await keysOfGuids(page, [WALL_A, WALL_B]);
  const boxA = await hook(page, (k) => window.CalcView3D.box(k), a);
  const boxB = await hook(page, (k) => window.CalcView3D.box(k), b);
  expect(norm(sub(centre(boxA), centre(boxB))), "the two walls are far apart").toBeGreaterThan(3);
  const loaded = await hook(page, () => window.CalcView3D.camera());
  expect(norm(sub(loaded.target, centre(boxB))), "the loaded view is not already centred on B").toBeGreaterThan(1);

  const atClick = await page.evaluate(
    ([ka, kb]) => {
      const v = window.CalcView3D;
      const plan = v.lastPlan();
      const isolate = (k) => ({
        toolRemoved: Uint8Array.from(plan.rows, (r) => (r.key === k ? 0 : 1)),
        isolating: true,
      });
      v.box(ka); // busy engine call ahead of the plans
      v.display(isolate(ka));
      v.display(isolate(kb)); // replaces the queued plan
      const opaque = window.CalcView.state().opaque.size;
      const button = [...document.querySelectorAll('[role="toolbar"][aria-label="3D-Werkzeuge"] button')].find(
        (el) => (el.getAttribute("aria-label") || el.textContent.trim()) === "Fokus",
      );
      button.click();
      return { opaque, found: !!button };
    },
    [a, b],
  );
  expect(atClick.found, "toolbar button `Fokus`").toBe(true);
  expect(atClick.opaque, "the plans were still queued when `Fokus` was clicked").toBeGreaterThan(1);

  const state = await viewState(page);
  expect(state.opaque).toEqual([b]);
  const cam = await hook(page, () => window.CalcView3D.camera());
  expect(norm(sub(cam.target, centre(boxB))), "fit centred on B's box (not A's, not all models)").toBeLessThan(1e-6);
  const canvas = await page.locator("#cv-viewport canvas").boundingBox();
  const sb = await page.evaluate((k) => window.CalcView.screenBox(k), b);
  expect(sb.left).toBeGreaterThanOrEqual(canvas.x - 1);
  expect(sb.top).toBeGreaterThanOrEqual(canvas.y - 1);
  expect(sb.right).toBeLessThanOrEqual(canvas.x + canvas.width + 1);
  expect(sb.bottom).toBeLessThanOrEqual(canvas.y + canvas.height + 1);
  expect(
    Math.max((sb.right - sb.left) / canvas.width, (sb.bottom - sb.top) / canvas.height),
    "B fills the view",
  ).toBeGreaterThanOrEqual(0.25);

  // the same `Fokus` on the settled plan gives the same camera (no stale box was used)
  await hook(page, () => window.CalcView3D.focus());
  await idle(page);
  const again = await hook(page, () => window.CalcView3D.camera());
  for (let i = 0; i < 3; i++) {
    expect(again.position[i]).toBeCloseTo(cam.position[i], 6);
    expect(again.target[i]).toBeCloseTo(cam.target[i], 6);
  }
  expect(errors).toEqual([]);
});

test("@e2e @robustness `Schneiden` clicked while display plans are queued cuts at the menu's pick and the latest plan applies", async ({
  page,
}) => {
  // T7 (CR-002): the click menu is open on the slab's top face; a plan marking the slab and a plan isolating slab and
  // wall A (replacing it) are queued behind a busy engine call, then `Schneiden` in the same task: the plane is the
  // menu's pick (normal [0, 0, -1], point 2 mm above the clicked point, REQ-013-AC9 rule), the latest plan applies
  // (opaque = [slab, A], nothing marked, every other element tool-hidden), the menu is closed, the app holds the plane
  test.setTimeout(240_000);
  const errors = await openWith(page, FZK);
  const [slab, a] = await keysOfGuids(page, [SLAB, WALL_A]);
  const rows = await page.evaluate(() => window.__calc.rows.length);
  // look straight down at the slab's centre from above, so its top face is pickable (camera above it)
  const slabBox = await hook(page, (k) => window.CalcView3D.box(k), slab);
  const c = centre(slabBox);
  await hook(page, ([p, t]) => window.CalcView3D.look(p, t), [
    [c[0] + 0.01, c[1] - 0.01, slabBox.max[2] + 2],
    [c[0], c[1], slabBox.max[2]],
  ]);
  await idle(page);
  const at = await pickPoint(page, slab, (h) => h.normal && h.normal[2] > 0.9);
  expect(at, "a screen point that picks the slab's top face").not.toBeNull();
  await page.mouse.click(at.x, at.y);
  await idle(page);
  await expect(clickMenu(page)).toBeVisible();
  const pick = await hook(page, () => window.CalcView3D.menu());
  expect(pick.key).toBe(slab);
  expect(pick.point[2]).toBeCloseTo(slabBox.max[2], 2);

  const atClick = await page.evaluate(
    ([ks, ka]) => {
      const v = window.CalcView3D;
      const plan = v.lastPlan();
      v.box(ks); // busy engine call ahead of the plans
      v.display({ marked: Uint8Array.from(plan.rows, (r) => (r.key === ks ? 1 : 0)) });
      v.display({
        marked: Uint8Array.from(plan.rows, () => 0),
        toolRemoved: Uint8Array.from(plan.rows, (r) => (r.key === ks || r.key === ka ? 0 : 1)),
        isolating: true,
      }); // replaces the queued plan
      const opaque = window.CalcView.state().opaque.size;
      const item = [...document.querySelectorAll('#cv-pick [role="menuitem"]')].find(
        (el) => (el.getAttribute("aria-label") || el.textContent.trim()) === "Schneiden",
      );
      item.click();
      return { opaque, found: !!item };
    },
    [slab, a],
  );
  expect(atClick.found, "menu item `Schneiden`").toBe(true);
  expect(atClick.opaque, "the plans were still queued when `Schneiden` was clicked").toBeGreaterThan(2);

  const state = await viewState(page);
  expect(state.section.normal).toEqual([0, 0, -1]);
  expect(
    Math.abs(state.section.point[2] - (pick.point[2] + OFFSET)),
    "2 mm above the picked point",
  ).toBeLessThanOrEqual(1e-4);
  expect(Math.abs(state.section.point[0] - pick.point[0])).toBeLessThan(1e-6);
  expect(Math.abs(state.section.point[1] - pick.point[1])).toBeLessThan(1e-6);
  expect(state.opaque).toEqual([slab, a].sort());
  expect(state.marked, "the replaced plan's mark is not applied").toEqual([]);
  expect(state.toolHidden.length).toBeGreaterThan(0);
  expect(state.opaque.length + state.toolHidden.length + state.ghost.length + state.hidden.length).toBeLessThanOrEqual(
    rows,
  );
  await expect(clickMenu(page)).toBeHidden();
  expect(await page.evaluate(() => window.__calc.view.section)).toEqual(state.section);
  await expect(page.getByRole("button", { name: "Schnitt verschieben" })).toBeAttached();
  expect(errors).toEqual([]);
});

test("@e2e @robustness arrow keys on the section handle of a flat single-element model move the plane at least 1 mm; 10 % with Shift; along the normal only", async ({
  page,
}) => {
  // T7 (CR-002), REQ-013 key steps: one IfcSlab, FLAT_THICKNESS thick (fixture STEP text); a horizontal cut on its top
  // face: extent along the normal = the thickness (axis range Z), 1 % of it (0.5 mm) is below the minimum, so each
  // plain key press moves exactly 1 mm; Shift: 10 % = 5 mm. A vertical plane (normal [1, 0, 0]) on the same model: the
  // extent is FLAT_SIZE_X, 1 % = 40 mm (the minimum does not apply)
  test.setTimeout(240_000);
  const errors = await openWith(page, flatFixture());
  expect(await page.evaluate(() => window.__calc.rows.length), "one element").toBe(1);
  const [slab] = await keysOfGuids(page, [FLAT_GUID]);
  expect(slab).not.toBeNull();
  const range = await hook(page, () => ["X", "Y", "Z"].map((ax) => window.CalcView.axisRange(ax)));
  const size = range.map((r) => r.max - r.min);
  expect(size[0]).toBeCloseTo(FLAT_SIZE_X, 4);
  expect(size[1]).toBeCloseTo(FLAT_SIZE_Y, 4);
  expect(size[2]).toBeCloseTo(FLAT_THICKNESS, 4);
  const plain = Math.max(MIN_STEP, 0.01 * size[2]);
  const shifted = Math.max(MIN_STEP, 0.1 * size[2]);
  expect(plain, "1 % of the thickness is below 1 mm").toBe(MIN_STEP);
  expect(shifted).toBeGreaterThan(MIN_STEP);

  // horizontal cut on the top face (the camera of the fit after loading is above the slab)
  const at = await pickPoint(page, slab, (h) => h.normal && h.normal[2] > 0.9);
  expect(at, "a screen point that picks the slab's top face").not.toBeNull();
  await page.mouse.click(at.x, at.y);
  await idle(page);
  await clickMenu(page).getByRole("menuitem", { name: "Schneiden" }).click();
  const start = (await viewState(page)).section;
  expect(start.normal).toEqual([0, 0, -1]);
  const handle = page.getByRole("button", { name: "Schnitt verschieben" });
  await expect(handle).toBeVisible();
  const moved = async (expectedMeters, label) => {
    const s = (await viewState(page)).section;
    expect(s.normal).toEqual(start.normal);
    const d = sub(s.point, start.point);
    expect(Math.hypot(d[0], d[1]), "along the normal only").toBeLessThan(1e-9);
    // along normal [0, 0, -1]
    expect(-d[2], label).toBeCloseTo(expectedMeters, 9);
  };
  await handle.focus();
  await page.keyboard.press("ArrowUp");
  await moved(MIN_STEP, "one ArrowUp: 1 mm");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowRight");
  await moved(3 * MIN_STEP, "three presses: 3 mm");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowDown");
  await moved(0, "back to the start");
  await page.keyboard.press("ArrowDown");
  await moved(-MIN_STEP, "below the start: 1 mm");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Shift+ArrowUp");
  await moved(shifted, "Shift: 10 % of the thickness");
  await page.keyboard.press("Shift+ArrowDown");
  await moved(0, "Shift back");
  expect(await page.evaluate(() => window.__calc.view.section)).toEqual((await viewState(page)).section);

  // vertical plane through the slab's centre: the extent along the normal is the slab's X size
  const mid = range.map((r) => (r.min + r.max) / 2);
  expect(await hook(page, (p) => window.CalcView3D.setSection({ point: p, normal: [1, 0, 0] }), mid)).toBe(true);
  await idle(page);
  await expect(handle).toBeVisible();
  await handle.focus();
  await page.keyboard.press("ArrowUp");
  const s = (await viewState(page)).section;
  expect(s.normal).toEqual([1, 0, 0]);
  expect(s.point[0] - mid[0], "1 % of the X size").toBeCloseTo(0.01 * size[0], 9);
  expect(Math.abs(s.point[1] - mid[1]) + Math.abs(s.point[2] - mid[2])).toBeLessThan(1e-9);
  expect(errors).toEqual([]);
});
