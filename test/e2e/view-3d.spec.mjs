// TASK-005 3D coupling (spec REQ-005, REQ-007-AC1/AC4/AC5, §4.4 CalcView.state(), DEC-15, process-log 2026-11-02):
// ghost / hide, colouring with legend and filter-set dots, section, picking and details, render on demand, IfcSpace kept
// hidden. 3D assertions read CalcView.state() (derived from the calls cv-3d makes to the engine) and, where stated,
// the engine itself (model.getVisible) or the drawn canvas. Expected key sets and counts come from
// test/fixtures/reference-values.json (STEP-text derivation), not from the product.
import { test, expect } from "../support/network-guard.mjs";
import { REF, fixture, loadFiles, openBuilder } from "../support/builder.mjs";
import { addFilterSet, filterSet, toggleValue } from "../support/filter-area.mjs";
import {
  canvasShot,
  colourBy,
  idle,
  keysOfGuids,
  legendEntries,
  pixelDifference,
  rowsByKey,
  setDots,
  viewState,
} from "../support/view-3d.mjs";

const FZK_REF = REF["AC20-FZK-Haus"];
const FZK = fixture("AC20-FZK-Haus.ifc");
const DUPLEX = fixture("Ifc2x3_Duplex_Architecture.ifc");
const WALL = "3rPX_Juz59peXXY6wDJl18"; // reference wall Wand-Ext-ERDG-1 (exterior, ground floor)

async function openWith(page, file) {
  const errors = await openBuilder(page);
  await loadFiles(page, file);
  await idle(page);
  return errors;
}

/** Keys of the rows with 3D geometry, sorted. */
async function geometryKeys(page) {
  return [...(await rowsByKey(page)).values()]
    .filter((r) => r.geometry)
    .map((r) => r.key)
    .sort();
}

const minus = (a, b) => a.filter((k) => !b.includes(k));

test("@e2e @acceptance @REQ-005-AC1 elements outside the filter are ghosts; `Ausblenden` hides them", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors = await openWith(page, FZK);
  const geometry = await geometryKeys(page);
  expect(geometry.length).toBeGreaterThan(50);

  // no filter: every element with geometry opaque, default mode ghost
  await expect(page.getByRole("radio", { name: "Geist" })).toHaveAttribute("aria-checked", "true");
  let state = await viewState(page);
  expect(state.mode).toBe("ghost");
  expect(state.opaque).toEqual(geometry);
  expect(state.ghost).toEqual([]);
  expect(state.hidden).toEqual([]);

  // filter Kategorie = IfcWallStandardCase OR IfcSlab: exactly the reference key set opaque, all others ghost
  const ac = FZK_REF.filters["REQ-004-AC1"];
  for (const value of ac.filter.Kategorie) await toggleValue(page, "Kategorie", value);
  const expected = (await keysOfGuids(page, ac.expectedGlobalIds)).sort();
  expect(expected).toHaveLength(ac.expectedCount);
  expect(
    expected.every((k) => geometry.includes(k)),
    "walls and slabs have geometry",
  ).toBe(true);
  state = await viewState(page);
  expect(state.opaque).toEqual(expected);
  expect(state.ghost).toEqual(minus(geometry, expected));
  expect(state.hidden).toEqual([]);

  // `Ausblenden`: the others are hidden, also according to the engine (model.getVisible)
  await page.getByRole("radio", { name: "Ausblenden" }).click();
  await expect(page.getByRole("radio", { name: "Ausblenden" })).toHaveAttribute("aria-checked", "true");
  state = await viewState(page);
  expect(state.mode).toBe("hide");
  expect(state.opaque).toEqual(expected);
  expect(state.ghost).toEqual([]);
  expect(state.hidden).toEqual(minus(geometry, expected));
  const engine = await page.evaluate(
    async ({ shown, hidden }) => {
      const ids = (keys) => keys.map((k) => Number(k.split(":")[1]));
      return {
        shown: await window.CalcView.engineVisible("m1", ids(shown)),
        hidden: await window.CalcView.engineVisible("m1", ids(hidden)),
      };
    },
    { shown: expected, hidden: state.hidden },
  );
  expect(engine.shown.every(Boolean), "engine: filtered elements visible").toBe(true);
  expect(engine.hidden.some(Boolean), "engine: others invisible").toBe(false);

  // back to `Geist`, then reset: all opaque again
  await page.getByRole("radio", { name: "Geist" }).click();
  state = await viewState(page);
  expect(state.ghost).toEqual(minus(geometry, expected));
  expect(state.hidden).toEqual([]);
  await page.locator("#cv-reset-all").click();
  state = await viewState(page);
  expect(state.opaque).toEqual(geometry);
  expect(state.ghost).toEqual([]);
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-005-AC2 `Färben nach` Kategorie: one colour per category in state, legend and filter-set dots", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors = await openWith(page, FZK);
  const rows = await rowsByKey(page);
  const ac = FZK_REF.filters["REQ-004-AC2"];
  await toggleValue(page, "Geschoss", ac.groundFloorStorey.Name);
  await colourBy(page, "Kategorie", "Kategorie");

  const state = await viewState(page);
  // only elements inside the filter are coloured, and all of them
  expect(Object.keys(state.colours).sort()).toEqual(state.opaque);
  for (const key of state.ghost) expect(state.colours[key]).toBeUndefined();
  const byKategorie = {};
  for (const [key, colour] of Object.entries(state.colours)) {
    const k = rows.get(key).values.Kategorie;
    expect(byKategorie[k] ?? colour, `${k}: one colour`).toBe(colour);
    byKategorie[k] = colour;
  }
  expect(new Set(Object.values(byKategorie)).size).toBe(Object.keys(byKategorie).length);

  // legend: every category in the filter with its reference count and the colour of its elements
  await expect(page.locator("#cv-legend")).toBeVisible();
  await expect(page.locator("#cv-legend .cv-legend-title")).toHaveText("Kategorie");
  const legend = await legendEntries(page);
  const expected = { ...ac.kategorieCountsOnGroundFloor };
  const present = new Set([...rows.values()].map((r) => r.values.Kategorie));
  for (const [k, n] of Object.entries(ac.kategorieCountsOnGroundFloorConditional)) if (present.has(k)) expected[k] = n;
  expect(Object.fromEntries(legend.map((e) => [e.label, e.count]))).toEqual(expected);
  for (const entry of legend) {
    expect(entry.colour).toMatch(/^#[0-9a-f]{6}$/);
    if (byKategorie[entry.label]) expect(entry.colour, entry.label).toBe(byKategorie[entry.label]);
  }
  expect(Object.keys(byKategorie).every((k) => legend.some((e) => e.label === k))).toBe(true);

  // dots in the Kategorie filter set match the legend colours; other sets have no dots
  const dots = await setDots(page, "Kategorie");
  for (const entry of legend) expect(dots[entry.label], `dot ${entry.label}`).toBe(entry.colour);
  expect(Object.values(await setDots(page, "Geschoss")).every((c) => c === "")).toBe(true);

  // precedence: selection over colour; deselecting restores the colour layer
  const coloured = state.opaque[0];
  await page.evaluate((k) => window.CalcView.select(k), coloured);
  let after = await viewState(page);
  expect(after.selected).toEqual([coloured]);
  expect(after.colours[coloured]).toBe(state.colours[coloured]);
  await page.keyboard.press("Escape");
  after = await viewState(page);
  expect(after.selected).toEqual([]);
  expect(after.colours).toEqual(state.colours);

  // remove the colouring: no colours, no legend, no dots
  await page.getByRole("button", { name: "Färbung entfernen" }).click();
  after = await viewState(page);
  expect(after.colours).toEqual({});
  await expect(page.locator("#cv-legend")).toBeHidden();
  expect(Object.values(await setDots(page, "Kategorie")).every((c) => c === "")).toBe(true);
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-005-AC3 `Schnitt` Z at mid-height, flip and slider; the canvas changes", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors = await openWith(page, FZK);
  const without = await canvasShot(page);

  await page.getByRole("radio", { name: "Schnitt Z" }).click();
  const range = await page.evaluate(() => window.CalcView.axisRange("Z"));
  expect(range.max - range.min).toBeGreaterThan(3); // a two-storey house
  const mid = (range.min + range.max) / 2;
  let state = await viewState(page);
  expect(state.section).toEqual({ axis: "Z", offset: mid, flipped: false });
  await expect(page.getByRole("slider", { name: "Schnittposition" })).toBeVisible();
  const withSection = await canvasShot(page);
  const d1 = await pixelDifference(page, without, withSection);
  expect(d1, "section changes the canvas").toBeGreaterThan(0.01);

  await page.getByRole("button", { name: "Schnitt umkehren" }).click();
  state = await viewState(page);
  expect(state.section).toEqual({ axis: "Z", offset: mid, flipped: true });
  const flipped = await canvasShot(page);
  expect(await pixelDifference(page, withSection, flipped), "flip shows the other part").toBeGreaterThan(0.01);

  // slider: offset follows
  const low = range.min + (range.max - range.min) * 0.25;
  await page.getByRole("slider", { name: "Schnittposition" }).evaluate((input, v) => {
    input.value = String(v);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, low);
  state = await viewState(page);
  expect(state.section.axis).toBe("Z");
  expect(state.section.flipped).toBe(true);
  expect(Math.abs(state.section.offset - low)).toBeLessThanOrEqual((range.max - range.min) / 1000);

  // X axis: mid of the X range
  await page.getByRole("radio", { name: "Schnitt X" }).click();
  const rx = await page.evaluate(() => window.CalcView.axisRange("X"));
  state = await viewState(page);
  expect(state.section).toEqual({ axis: "X", offset: (rx.min + rx.max) / 2, flipped: false });

  await page.getByRole("button", { name: "Schnitt entfernen" }).click();
  state = await viewState(page);
  expect(state.section).toBeNull();
  await expect(page.getByRole("slider", { name: "Schnittposition" })).toBeHidden();
  const back = await canvasShot(page);
  expect(await pixelDifference(page, without, back), "back to the uncut view").toBeLessThan(0.005);
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-005-AC4 `Färben nach` Material: an element with two materials gets `mehrere Werte`", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const ac = REF["REQ-005-AC4"];
  const errors = await openWith(page, DUPLEX);
  const [key] = await keysOfGuids(page, [ac.element.GlobalId]);
  expect(key).not.toBeNull();
  const row = (await rowsByKey(page)).get(key);
  expect([...row.values.Material].sort()).toEqual(ac.element.Material);
  await colourBy(page, "Material", "Material");

  const legend = await legendEntries(page);
  const multi = legend.find((e) => e.label === "mehrere Werte");
  expect(multi, "legend lists `mehrere Werte`").toBeTruthy();
  expect(multi.kind).toBe("multi");
  expect(multi.count, "every element with several materials").toBe(ac.elementsWithSeveralMaterials);
  const state = await viewState(page);
  expect(state.colours[key]).toBe(multi.colour);
  const valueColours = legend.filter((e) => e.kind === "value").map((e) => e.colour);
  expect(valueColours).not.toContain(multi.colour);
  // dots of a Material filter set match the legend colours
  const dots = await setDots(page, "Material");
  for (const [label, colour] of Object.entries(dots)) {
    const entry = legend.find((e) => e.label === label);
    if (entry) expect(colour, label).toBe(entry.colour);
  }
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-007-AC1 @REQ-007-AC5 clicking a wall selects it and shows its details; empty space and Esc clear", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors = await openWith(page, FZK);
  const ref = FZK_REF.elements.find((e) => e.GlobalId === WALL);
  const [key] = await keysOfGuids(page, [WALL]);
  // isolate the wall (all other elements are ghosts and not pickable), then click its projected screen position
  await addFilterSet(page, "GlobalId", "GlobalId");
  await filterSet(page, "GlobalId").getByRole("searchbox").fill(WALL);
  await toggleValue(page, "GlobalId", WALL);
  await page.locator("#cv-fit").click();
  let state = await viewState(page);
  expect(state.opaque).toEqual([key]);

  const box = await page.evaluate((k) => window.CalcView.screenBox(k), key);
  const canvas = await page.locator("#cv-viewport canvas").boundingBox();
  expect(box.x).toBeGreaterThan(canvas.x);
  expect(box.x).toBeLessThan(canvas.x + canvas.width);
  // candidate points: the projected centre first, then points inside the projected bounding box
  const points = [[box.x, box.y]];
  for (const fx of [0.5, 0.35, 0.65, 0.2, 0.8])
    for (const fy of [0.5, 0.35, 0.65])
      points.push([box.left + (box.right - box.left) * fx, box.top + (box.bottom - box.top) * fy]);
  let hit = null;
  for (const [x, y] of points) {
    await page.mouse.click(x, y);
    state = await viewState(page);
    if (state.selected.length) {
      hit = [x, y];
      break;
    }
  }
  expect(hit, "a click on the wall's screen position selects it").not.toBeNull();
  expect(state.selected).toEqual([key]);
  console.log(`[REQ-007-AC1] wall ${WALL} picked at (${hit.map((v) => v.toFixed(0)).join(", ")})`);

  // details: kicker, title, GlobalId and the BaseQuantities pset with reference values (German format, units)
  const details = page.locator("#cv-details-body");
  await expect(details).toHaveAttribute("data-key", key);
  await expect(details.locator(".cv-det-kicker")).toHaveText(ref.Kategorie);
  await expect(details.locator(".cv-det-title")).toHaveText(ref.Name);
  const general = details.locator('.cv-det-group[data-group="Allgemein"]');
  await expect(general.locator("dt", { hasText: /^GlobalId$/ }).locator("+ dd")).toHaveText(WALL);
  const qto = details.locator('.cv-det-group[data-group="BaseQuantities"]');
  await expect(qto).toBeVisible();
  const de = (q) => q.value.toLocaleString("de-DE", { maximumFractionDigits: 3 }) + " " + q.unit;
  for (const [k, q] of Object.entries(ref.quantities))
    await expect(qto.locator("dt", { hasText: new RegExp(`^${k.split(".")[1]}$`) }).locator("+ dd")).toHaveText(de(q));
  await expect(details.locator(".cv-det-nogeo")).toHaveCount(0);
  // groups: Allgemein first, psets before type psets, collapsible
  const groups = await details.locator(".cv-det-group").evaluateAll((g) => g.map((n) => n.dataset.group));
  expect(groups[0]).toBe("Allgemein");
  const firstType = groups.findIndex((g) => g.startsWith("Typ: "));
  if (firstType !== -1) expect(groups.slice(firstType).every((g) => g.startsWith("Typ: "))).toBe(true);
  await qto.locator(".cv-det-group-head").click();
  await expect(qto.locator(".cv-det-group-head")).toHaveAttribute("aria-expanded", "false");
  await expect(qto.locator("dl")).toBeHidden();
  await qto.locator(".cv-det-group-head").click();
  await expect(qto.locator("dl")).toBeVisible();

  // REQ-007-AC5: a click on empty space clears the selection and the details
  await page.mouse.click(canvas.x + 12, canvas.y + canvas.height - 12);
  state = await viewState(page);
  expect(state.selected).toEqual([]);
  await expect(details).toHaveText("Klick auf ein Element zeigt seine Eigenschaften.");

  // ... and so does Esc (but not an Escape that closes a dialog)
  await page.mouse.click(...hit);
  expect((await viewState(page)).selected).toEqual([key]);
  await page.locator("#cv-add-filterset").click();
  await expect(page.getByRole("dialog", { name: "Filtersatz hinzufügen" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await viewState(page)).selected, "Escape in a dialog keeps the selection").toEqual([key]);
  await page.keyboard.press("Escape");
  expect((await viewState(page)).selected).toEqual([]);
  await expect(details).toHaveText("Klick auf ein Element zeigt seine Eigenschaften.");

  // a ghost is not pickable: reset the filter to Kategorie = IfcSlab only, the wall becomes a ghost
  await toggleValue(page, "GlobalId", WALL);
  await toggleValue(page, "Kategorie", "IfcSlab");
  await page.mouse.click(...hit);
  state = await viewState(page);
  expect(state.ghost).toContain(key);
  expect(state.selected).not.toContain(key);
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-007-AC4 an element without geometry selected via the API shows its details and the hint", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors = await openWith(page, FZK);
  const virtual = FZK_REF.conditionalElements.find((e) => e.hasRepresentationInIfc === false);
  const [key] = await keysOfGuids(page, [virtual.GlobalId]);
  expect(key, "IfcVirtualElement is a row").not.toBeNull();
  const row = (await rowsByKey(page)).get(key);
  expect(row.values.Geometrie).toBe("Nein");

  await page.evaluate((k) => window.CalcView.select(k), key);
  const details = page.locator("#cv-details-body");
  await expect(details).toHaveAttribute("data-key", key);
  await expect(details.locator(".cv-det-nogeo")).toHaveText("Dieses Element hat keine 3D-Geometrie.");
  await expect(details.locator(".cv-det-kicker")).toHaveText(virtual.Kategorie);
  await expect(
    details.locator('.cv-det-group[data-group="Allgemein"] dt', { hasText: /^GlobalId$/ }).locator("+ dd"),
  ).toHaveText(virtual.GlobalId);
  expect(await page.evaluate(() => window.__calc.view.selected)).toBe(key);
  expect((await viewState(page)).selected, "nothing to highlight in 3D").toEqual([]);
  await page.keyboard.press("Escape");
  await expect(details.locator(".cv-det-nogeo")).toHaveCount(0);
  expect(await page.evaluate(() => window.__calc.view.selected)).toBeNull();
  expect(errors).toEqual([]);
});

test("@e2e @smoke render smoke: ghost and hide give different canvases; frames are drawn on demand only (P1)", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors = await openWith(page, FZK);
  await toggleValue(page, "Kategorie", "IfcWallStandardCase");
  const ghost = await canvasShot(page);
  await page.getByRole("radio", { name: "Ausblenden" }).click();
  const hidden = await canvasShot(page);
  const diff = await pixelDifference(page, ghost, hidden);
  console.log(`[render smoke] ghost vs hide: ${(diff * 100).toFixed(2)} % of the pixels differ`);
  expect(diff).toBeGreaterThan(0.005);

  // render on demand: no frames while nothing changes; a change draws
  await idle(page);
  await page.waitForTimeout(2_000);
  const before = await page.evaluate(() => window.CalcView.frames());
  await page.waitForTimeout(1_500);
  const idleFrames = (await page.evaluate(() => window.CalcView.frames())) - before;
  expect(idleFrames, "no frames while idle").toBe(0);
  await page.getByRole("radio", { name: "Geist" }).click();
  await idle(page);
  expect(await page.evaluate(() => window.CalcView.frames())).toBeGreaterThan(before);
  // orbit drag draws frames too and does not select anything
  const canvas = await page.locator("#cv-viewport canvas").boundingBox();
  const f0 = await page.evaluate(() => window.CalcView.frames());
  await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvas.x + canvas.width / 2 + 80, canvas.y + canvas.height / 2 + 10, { steps: 5 });
  await page.mouse.up();
  await idle(page);
  expect(await page.evaluate(() => window.CalcView.frames())).toBeGreaterThan(f0);
  expect((await viewState(page)).selected).toEqual([]);
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-001-AC4 IfcSpace stays hidden through ghost / hide changes and is not in CalcView.state() while the option is off", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors = await openWith(page, FZK);
  const spaceIds = await page.evaluate(() => window.__calc.models[0].spaceIds);
  expect(spaceIds.length, "AC20-FZK-Haus has IfcSpace items").toBeGreaterThan(0);
  const spaceKeys = spaceIds.map((id) => "m1:" + id);
  const engineVisible = () => page.evaluate((ids) => window.CalcView.engineVisible("m1", ids), spaceIds);
  const inState = (state) =>
    [...state.opaque, ...state.ghost, ...state.hidden, ...Object.keys(state.colours)].filter((k) =>
      spaceKeys.includes(k),
    );
  const expectSpacesOff = async (label) => {
    const state = await viewState(page);
    expect(inState(state), `${label}: no IfcSpace in state()`).toEqual([]);
    expect((await engineVisible()).some(Boolean), `${label}: no IfcSpace visible in the engine`).toBe(false);
  };

  await expectSpacesOff("loaded");
  await toggleValue(page, "Kategorie", "IfcWallStandardCase");
  await expectSpacesOff("filter, ghost");
  await page.getByRole("radio", { name: "Ausblenden" }).click();
  await expectSpacesOff("filter, hide");
  await page.getByRole("radio", { name: "Geist" }).click();
  await expectSpacesOff("filter, ghost again");
  await page.locator("#cv-reset-all").click();
  await expectSpacesOff("reset");
  await colourBy(page, "Kategorie", "Kategorie");
  await expectSpacesOff("coloured");

  // option on: the spaces are elements (rows); with no filter they are opaque and visible
  const loads = await page.evaluate(() => window.__calc.loads);
  await page.locator("#cv-opt-spaces").check();
  await page.waitForFunction((n) => window.__calc.loads > n && window.__calc.phase === "ready", loads);
  let state = await viewState(page);
  const rows = await rowsByKey(page);
  const spaceRows = spaceKeys.filter((k) => rows.has(k) && rows.get(k).geometry);
  expect(spaceRows.length).toBeGreaterThan(0);
  expect(spaceRows.every((k) => state.opaque.includes(k))).toBe(true);
  expect((await engineVisible()).filter(Boolean).length).toBeGreaterThanOrEqual(spaceRows.length);
  // hide mode with a wall filter: spaces are hidden like every element outside the filter
  await page.getByRole("radio", { name: "Ausblenden" }).click();
  await toggleValue(page, "Kategorie", "IfcWallStandardCase");
  state = await viewState(page);
  expect(spaceRows.every((k) => state.hidden.includes(k))).toBe(true);

  // option off again: gone from state and invisible, through every later reset
  const loads2 = await page.evaluate(() => window.__calc.loads);
  await page.locator("#cv-opt-spaces").uncheck();
  await page.waitForFunction((n) => window.__calc.loads > n && window.__calc.phase === "ready", loads2);
  await expectSpacesOff("option off, hide");
  await page.getByRole("radio", { name: "Geist" }).click();
  await expectSpacesOff("option off, ghost");
  await page.locator("#cv-reset-all").click();
  await expectSpacesOff("option off, reset");
  expect(errors).toEqual([]);
});
