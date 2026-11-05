// TASK-017b (CR-002, INC-2): the properties-panel actions (spec REQ-003, REQ-007, REQ-013 panel buttons): `Nach Wert
// filtern` ticks the element's value(s) in the matching left filter set, adding the set if missing (REQ-003-AC4/AC5,
// [U Q8], DEC-21); the row tools by keyboard (REQ-007-AC7); `Ausblenden` / `Isolieren` in the panel for an element
// without geometry and for a group selection (REQ-007-AC4, REQ-013-AC7). The SampleCastle part of REQ-007-AC8 needs a
// fetched fixture: test/acceptance/panel-fetched.spec.mjs.
// Expected names, values, GlobalIds and counts come from test/fixtures/reference-values.json (STEP text, never the code
// under test); the 3D side is read from CalcView.state() (spec 4.4), the filter sets from the DOM and window.__calc.
import { test, expect } from "../support/network-guard.mjs";
import { REF, fixture, loadFiles, openBuilder } from "../support/builder.mjs";
import { filterSet, setTitles, shownValues } from "../support/filter-area.mjs";
import { colourPanel, idle, keysOfGuids, rowsByKey, viewState } from "../support/view-3d.mjs";
import { allTableRows } from "../support/table.mjs";
import { groupingState, pickGroup, setView } from "../support/grouping.mjs";
import { clickRow, details } from "../support/selection.mjs";
import { afterUpdate, sourceEntries, toolSets } from "../support/tools.mjs";

const FZK = fixture("AC20-FZK-Haus.ifc");
const DUPLEX = fixture("Ifc2x3_Duplex_Architecture.ifc");
const FZK_REF = REF["AC20-FZK-Haus"];
const WALL = FZK_REF.elements.find((e) => e.Name === "Wand-Ext-ERDG-1"); // Typ `Leichtbeton 102890359 300`
const GROUND = REF["AC20-FZK-Haus"].filters["REQ-004-AC2"];
const MULTI = REF["REQ-005-AC4"]; // Duplex element STEP 4131 with two materials
const SEL = REF["REQ-007-selection"];
const Y = REF["REQ-013-tools"].rows; // FZK element rows (99)
const NO_GEO = FZK_REF.conditionalElements.find((e) => e.hasRepresentationInIfc === false); // IfcVirtualElement

const status = (page) => page.locator("#cv-status");
const de = (n) => n.toLocaleString("de-DE");
const sorted = (a) => [...a].sort();
const props = (page) => page.locator("#cv-props");
const propRow = (page, key) => page.locator(`#cv-props .cv-prop-row[data-key="${key}"]`);

test.describe.configure({ timeout: 240_000 });

async function openWith(page, files, width = 1280, height = 800) {
  const errors = await openBuilder(page);
  await page.setViewportSize({ width, height });
  await loadFiles(page, files);
  await idle(page);
  return errors;
}

/** Clicks `Nach Wert filtern` on the property row `key` of the open panel (hover first, as a pointer user). */
async function filterByValue(page, key) {
  const row = propRow(page, key);
  await expect(row).toHaveCount(1);
  await row.scrollIntoViewIfNeeded();
  await row.hover();
  await afterUpdate(page, () => row.getByRole("button", { name: "Nach Wert filtern", exact: true }).click());
}

/**
 * Checked values of a filter set, sorted: the set's selection (window.__calc.filter.sets), each one also checked in the
 * DOM (the value list is virtualised, so each value is looked up through the set's search field `Werte suchen`, which is
 * emptied again).
 */
async function checkedLabels(page, key) {
  const set = (await hookSets(page)).find((s) => s.key === key);
  const selected = sorted(set.selected);
  const search = filterSet(page, key).getByRole("searchbox");
  for (const label of selected) {
    await search.fill(label);
    const shown = await shownValues(page, key);
    expect(shown.find((v) => v.label === label)?.checked, `${key}: ${label} checked in the list`).toBe(true);
  }
  await search.fill("");
  return selected;
}

/** window.__calc.filter.sets: [{ key, collapsed, selected }]. */
function hookSets(page) {
  return page.evaluate(() =>
    window.__calc.filter.sets.map((s) => ({ key: s.key, collapsed: s.collapsed, selected: s.selected })),
  );
}

/**
 * Whether the filter set `key` is scrolled into view inside the filter panel (#cv-filters): its head is visible and
 * either the whole set is visible or (a set higher than the panel) its head is at the top of the panel.
 */
function setInView(page, key) {
  return page.evaluate((k) => {
    const panel = document.getElementById("cv-filters").getBoundingClientRect();
    const set = document.querySelector(`.cv-fs[data-key="${k}"]`).getBoundingClientRect();
    const head = document.querySelector(`.cv-fs[data-key="${k}"] .cv-fs-head`).getBoundingClientRect();
    const headIn = head.height > 0 && head.top >= panel.top - 0.5 && head.bottom <= panel.bottom + 0.5;
    return headIn && (set.bottom <= panel.bottom + 0.5 || head.top <= panel.top + 24);
  }, key);
}

/** Keys of the rows on the ground floor, checked per Kategorie against the reference counts. */
async function groundFloorKeys(page) {
  const rows = [...(await rowsByKey(page)).values()];
  const ground = rows.filter((r) => r.values.Geschoss === GROUND.groundFloorStorey.Name);
  const byKategorie = {};
  for (const r of ground) byKategorie[r.values.Kategorie] = (byKategorie[r.values.Kategorie] || 0) + 1;
  const rowClasses = new Set(rows.map((r) => r.values.Kategorie));
  const expected = { ...GROUND.kategorieCountsOnGroundFloor };
  for (const [k, n] of Object.entries(GROUND.kategorieCountsOnGroundFloorConditional))
    if (rowClasses.has(k)) expected[k] = n;
  expect(byKategorie, "ground-floor rows per Kategorie = reference").toEqual(expected);
  return {
    keys: sorted(ground.map((r) => r.key)),
    geometry: sorted(ground.filter((r) => r.geometry).map((r) => r.key)),
  };
}

test("@e2e @acceptance @REQ-003-AC4 `Nach Wert filtern` on the `Geschoss` row of the selected wall `Wand-Ext-ERDG-1` checks `Erdgeschoss` in the existing `Geschoss` set (no second set); table, status line and 3D show only the ground floor", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  expect(await setTitles(page)).toEqual(["Kategorie", "Geschoss", "Material"]);
  const [wall] = await keysOfGuids(page, [WALL.GlobalId]);
  const ground = await groundFloorKeys(page);
  const allGeometry = sorted([...(await rowsByKey(page)).values()].filter((r) => r.geometry).map((r) => r.key));
  await clickRow(page, wall);
  await expect(props(page)).toBeVisible();
  await expect(propRow(page, "Geschoss").locator(".cv-prop-text")).toHaveText(WALL.Geschoss);

  await filterByValue(page, "Geschoss");
  // exactly the value checked in the existing set, no second `Geschoss` set, the other sets unchanged
  expect(await setTitles(page)).toEqual(["Kategorie", "Geschoss", "Material"]);
  await expect(filterSet(page, "Geschoss")).toHaveCount(1);
  expect(await checkedLabels(page, "Geschoss")).toEqual([WALL.Geschoss]);
  expect(await hookSets(page)).toEqual([
    { key: "Kategorie", collapsed: false, selected: [] },
    { key: "Geschoss", collapsed: false, selected: [WALL.Geschoss] },
    { key: "Material", collapsed: false, selected: [] },
  ]);
  // table, status line and 3D: only the elements on that storey
  const rows = await allTableRows(page);
  expect(sorted(rows.map((r) => r.key))).toEqual(ground.keys);
  await expect(status(page)).toHaveText(`${de(ground.keys.length)} von ${de(Y)} Elementen`);
  const s = await viewState(page);
  expect(s.opaque).toEqual(ground.geometry);
  expect(s.ghost).toEqual(allGeometry.filter((k) => !ground.geometry.includes(k)));
  // nothing else changes: the wall stays selected, no other filter source
  expect(s.selected).toEqual([wall]);
  expect(await sourceEntries(page)).toEqual([]);

  // a second click keeps the value ticked (it does not toggle)
  const before = await page.evaluate(() => window.__calc.filter.updates);
  await propRow(page, "Geschoss").hover();
  await propRow(page, "Geschoss").getByRole("button", { name: "Nach Wert filtern", exact: true }).click();
  await idle(page);
  expect(await checkedLabels(page, "Geschoss")).toEqual([WALL.Geschoss]);
  expect(await page.evaluate(() => window.__calc.filter.updates), "no re-evaluation: nothing changed").toBe(before);
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-003-AC5 `Nach Wert filtern` on `Typ` adds a `Typ` set at the bottom with exactly `Leichtbeton 102890359 300` checked; on the Duplex element with two materials it checks both `Material` values", async ({
  page,
}) => {
  const errors = await openWith(page, [FZK, DUPLEX]);
  const [wall, multi] = await keysOfGuids(page, [WALL.GlobalId, MULTI.element.GlobalId]);
  expect(await setTitles(page)).toEqual(["Kategorie", "Geschoss", "Material"]);
  await expect(filterSet(page, "Typ")).toHaveCount(0);

  await clickRow(page, wall);
  await expect(propRow(page, "Typ").locator(".cv-prop-text")).toHaveText(WALL.Typ);
  await filterByValue(page, "Typ");
  expect(await setTitles(page)).toEqual(["Kategorie", "Geschoss", "Material", "Typ"]);
  // expanded and (at 1280 px) scrolled into view (checked before checkedLabels uses the set's search field)
  expect(await setInView(page, "Typ"), "the new set is scrolled into view").toBe(true);
  await expect(filterSet(page, "Typ").locator(".cv-fs-body")).toBeVisible();
  const sets = await hookSets(page);
  expect(sets[3]).toEqual({ key: "Typ", collapsed: false, selected: [WALL.Typ] });
  expect(await checkedLabels(page, "Typ")).toEqual([WALL.Typ]);
  const typed = await page.evaluate(() => window.__calc.filter.keys.slice());
  const byKey = await rowsByKey(page);
  expect(typed.length).toBeGreaterThan(0);
  for (const k of typed) expect(byKey.get(k).values.Typ, k).toBe(WALL.Typ);

  // multi-valued property: every value of the element is checked in the existing `Material` set
  await afterUpdate(page, () =>
    filterSet(page, "Typ").getByRole("button", { name: "Auswahl zurücksetzen: Typ" }).click(),
  );
  await clickRow(page, multi);
  await expect(props(page)).toHaveAttribute("data-key", multi);
  await expect(propRow(page, "Material").locator(".cv-prop-text")).toHaveText(MULTI.element.Material.join(", "));
  await filterByValue(page, "Material");
  expect(await setTitles(page)).toEqual(["Kategorie", "Geschoss", "Material", "Typ"]);
  expect(await checkedLabels(page, "Material")).toEqual(sorted(MULTI.element.Material));
  // OR within the set: every shown element has at least one of the two materials
  for (const k of await page.evaluate(() => window.__calc.filter.keys.slice())) {
    const m = byKey.get(k).values.Material;
    expect(
      (Array.isArray(m) ? m : [m]).some((v) => MULTI.element.Material.includes(v)),
      k,
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});

// DEC-21: below 1280 px `Nach Wert filtern` keeps the filter drawer closed; the set is scrolled into view when the
// drawer is opened
test("@e2e @REQ-003 `Nach Wert filtern` below 1280 px: the drawer stays closed; opening it shows the new set in view", async ({
  page,
}) => {
  const errors = await openWith(page, FZK, 1100, 700);
  const [wall] = await keysOfGuids(page, [WALL.GlobalId]);
  await clickRow(page, wall);
  await filterByValue(page, "Typ");
  const toggle = page.locator("#cv-toggle-filters");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#cv-filters")).toHaveCSS("visibility", "hidden");
  expect(await setTitles(page)).toEqual(["Kategorie", "Geschoss", "Material", "Typ"]);
  expect((await hookSets(page)).find((x) => x.key === "Typ")).toEqual({
    key: "Typ",
    collapsed: false,
    selected: [WALL.Typ],
  });
  await toggle.click();
  await expect(page.locator("#cv-filters")).toHaveCSS("visibility", "visible");
  expect(await setInView(page, "Typ"), "the new set is scrolled into view when the drawer opens").toBe(true);
  expect(
    await page.evaluate(() => document.getElementById("cv-filters").scrollTop),
    "the drawer was scrolled",
  ).toBeGreaterThan(0);
  expect(await checkedLabels(page, "Typ")).toEqual([WALL.Typ]);
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-007-AC7 keyboard focus on a property row shows its row tools `Nach Wert filtern` and `Farbe nach Wert`, both operable with Enter; on pointer devices they appear on hover", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  const [wall] = await keysOfGuids(page, [WALL.GlobalId]);
  await clickRow(page, wall);
  await expect(props(page)).toBeVisible();
  const row = propRow(page, "Geschoss");
  const tools = row.locator(".cv-row-tools");
  await page.mouse.move(0, 0);
  await expect(tools).toHaveCSS("opacity", "0");

  // hover (pointer device)
  await row.scrollIntoViewIfNeeded();
  await row.hover();
  await expect(tools).toHaveCSS("opacity", "1");
  await page.mouse.move(0, 0);
  await expect(tools).toHaveCSS("opacity", "0");

  // keyboard: Tab from `Schliessen` through the panel until the focus is on the `Geschoss` row
  await page.locator("#cv-props-close").focus();
  let onRow = false;
  for (let i = 0; i < 300 && !onRow; i++) {
    await page.keyboard.press("Tab");
    onRow = await page.evaluate(() => {
      const a = document.activeElement;
      return Boolean(a && a.closest('#cv-props .cv-prop-row[data-key="Geschoss"]'));
    });
  }
  expect(onRow, "Tab reaches the property row").toBe(true);
  expect(await page.evaluate(() => document.activeElement.getAttribute("aria-label"))).toBe("Nach Wert filtern");
  await expect(tools).toHaveCSS("opacity", "1");
  // the tools of the other rows stay hidden
  await expect(propRow(page, "Kategorie").locator(".cv-row-tools")).toHaveCSS("opacity", "0");
  // Enter on `Nach Wert filtern`
  await afterUpdate(page, () => page.keyboard.press("Enter"));
  // (the set's selection from the hook: the DOM lookup of checkedLabels would move the focus)
  expect((await hookSets(page)).find((x) => x.key === "Geschoss").selected).toEqual([WALL.Geschoss]);
  expect(await page.evaluate(() => document.activeElement.getAttribute("aria-label"))).toBe("Nach Wert filtern");
  await expect(tools).toHaveCSS("opacity", "1");
  // Tab to `Farbe nach Wert` of the same row, Enter colours by `Geschoss` and opens the colouring panel at its legend
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement.getAttribute("aria-label"))).toBe("Farbe nach Wert");
  await expect(tools).toHaveCSS("opacity", "1");
  await page.keyboard.press("Enter");
  await expect(colourPanel(page)).toBeVisible();
  await expect(colourPanel(page).locator("#cv-legend")).toBeVisible();
  expect(await page.evaluate(() => window.__calc.view.colourKey)).toBe("Geschoss");
  const s = await viewState(page);
  expect(Object.keys(s.colours).length).toBeGreaterThan(0);
  expect(s.selected).toEqual([wall]);
  expect(errors).toEqual([]);
});

/** Selects the element without geometry by its table row; checks the panel and the hint. */
async function selectNoGeometry(page, key) {
  await clickRow(page, key);
  const d = await details(page);
  expect(d.open).toBe(true);
  expect(d.key).toBe(key);
  expect(d.kicker).toBe(NO_GEO.Kategorie);
  expect(d.nogeo).toBe("Dieses Element hat keine 3D-Geometrie.");
  await expect(
    props(page).locator('.cv-det-group[data-group="Allgemein"] .cv-prop-row[data-key="GlobalId"] .cv-prop-text'),
  ).toHaveText(NO_GEO.GlobalId);
  for (const name of ["Ausblenden", "Isolieren"])
    await expect(props(page).getByRole("button", { name, exact: true }), name).toBeVisible();
}

test("@e2e @acceptance @REQ-007-AC4 an element with `Geometrie` = `Nein`, clicked in the table: the panel shows its properties and the no-geometry hint, its buttons `Ausblenden` / `Isolieren` work, no error", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  const [key] = await keysOfGuids(page, [NO_GEO.GlobalId]);
  expect(key, "IfcVirtualElement is a row").not.toBeNull();
  expect((await rowsByKey(page)).get(key).values.Geometrie).toBe("Nein");
  const geometryBefore = await viewState(page);

  // `Isolieren`: only it is in the table; nothing with geometry is shown in 3D; the panel stays (it is still shown)
  await selectNoGeometry(page, key);
  await afterUpdate(page, () => props(page).getByRole("button", { name: "Isolieren", exact: true }).click());
  expect((await allTableRows(page)).map((r) => r.key)).toEqual([key]);
  await expect(status(page)).toHaveText(`1 von ${de(Y)} Elementen`);
  expect(await sourceEntries(page)).toEqual(["Isoliert: 1 Element"]);
  expect(await toolSets(page)).toEqual({ hidden: [], isolated: [key] });
  let s = await viewState(page);
  expect(s.opaque).toEqual([]);
  expect(s.ghost).toEqual([]);
  expect(s.toolHidden).toEqual(sorted([...geometryBefore.opaque, ...geometryBefore.ghost]));
  expect((await details(page)).key).toBe(key);
  await afterUpdate(page, () => page.getByRole("button", { name: "Isolierung entfernen", exact: true }).click());
  expect((await allTableRows(page)).length).toBe(Y);

  // `Ausblenden`: its row is gone, the selection and the panel are cleared
  await selectNoGeometry(page, key);
  await afterUpdate(page, () => props(page).getByRole("button", { name: "Ausblenden", exact: true }).click());
  expect((await allTableRows(page)).map((r) => r.key)).not.toContain(key);
  await expect(status(page)).toHaveText(`${de(Y - 1)} von ${de(Y)} Elementen`);
  expect(await sourceEntries(page)).toEqual(["Ausgeblendet: 1 Element"]);
  expect(await toolSets(page)).toEqual({ hidden: [key], isolated: null });
  s = await viewState(page);
  expect(s.opaque).toEqual(geometryBefore.opaque);
  expect(s.toolHidden).toEqual([]);
  await expect(props(page)).toBeHidden();
  expect(await page.evaluate(() => window.__calc.view.selected)).toBeNull();
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-013-AC7 `Ausblenden` in the panel of an element without geometry removes its row (`Ausgeblendet: 1 Element`); `Isolieren` in the panel of a selected group row of 13 walls shows exactly those walls (`Isoliert: 13 Elemente`)", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  const [noGeo] = await keysOfGuids(page, [NO_GEO.GlobalId]);
  await selectNoGeometry(page, noGeo);
  await afterUpdate(page, () => page.locator("#cv-props-hide").click());
  expect((await allTableRows(page)).map((r) => r.key)).not.toContain(noGeo);
  expect((await allTableRows(page)).length).toBe(Y - 1);
  expect(await sourceEntries(page)).toEqual(["Ausgeblendet: 1 Element"]);
  await afterUpdate(page, () => page.getByRole("button", { name: "Ausblendung entfernen", exact: true }).click());
  expect(await sourceEntries(page)).toEqual([]);

  // group row of the 13 walls (grouping by Kategorie)
  const walls = sorted(await keysOfGuids(page, SEL.group.globalIds));
  expect(walls.length).toBe(13);
  const all = await viewState(page);
  await setView(page, "Gruppiert");
  if ((await groupingState(page)).groupBy[0] !== "Kategorie") await pickGroup(page, 1, "Kategorie", "Kategorie");
  const id = await page.evaluate(
    (k) => window.__calc.table.display.find((r) => r.type === "group" && r.level === 1 && r.label === k).id,
    SEL.group.Kategorie,
  );
  await clickRow(page, id, { group: true });
  await expect(props(page)).toBeVisible();
  expect((await viewState(page)).selected).toEqual(walls);
  await afterUpdate(page, () => page.locator("#cv-props-isolate").click());
  const s = await viewState(page);
  expect(s.opaque).toEqual(walls);
  expect(s.ghost).toEqual([]);
  expect(s.toolHidden).toEqual(sorted([...all.opaque, ...all.ghost].filter((k) => !walls.includes(k))));
  expect(await sourceEntries(page)).toEqual(["Isoliert: 13 Elemente"]);
  expect((await toolSets(page)).isolated).toEqual(walls);
  await setView(page, "Einzelelemente");
  expect(sorted((await allTableRows(page)).map((r) => r.key))).toEqual(walls);
  await expect(status(page)).toHaveText(`13 von ${de(Y)} Elementen`);
  expect(errors).toEqual([]);
});
