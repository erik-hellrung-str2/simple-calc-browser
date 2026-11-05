// TASK-006c selection in both directions (spec REQ-007-AC1 table side, AC2, AC3, AC4 table side, AC5 both sides; the
// REQ-007 text "clicking a group row highlights all its elements"). The 3D side is read from CalcView.state() (spec
// 4.4), the table side from the rendered rows (class `cv-sel` + aria-selected, fully visible in the table box), the
// properties from the floating properties panel `#cv-props` (CR-002, TASK-013). 3D clicks are real mouse clicks at a probed screen position of the element (as REQ-007-AC1).
// Expected GlobalIds and labels come from test/fixtures/reference-values.json (section REQ-007-selection and REQ-005-AC4,
// STEP-text derivation).
import { test, expect } from "../support/network-guard.mjs";
import { REF, fixture, loadFiles, openBuilder, removeModel } from "../support/builder.mjs";
import { shownValues, toggleValue } from "../support/filter-area.mjs";
import { idle, keysOfGuids, rowsByKey, viewState } from "../support/view-3d.mjs";
import { addColumn, clickSort, headerKeys } from "../support/table.mjs";
import { deCount, pickGroup, setView, toggleGroup } from "../support/grouping.mjs";
import {
  camera,
  clickRow,
  details,
  displayIndex,
  markedRows,
  probePick,
  rowVisibility,
  scrollTable,
  selection,
} from "../support/selection.mjs";

const FZK = fixture("AC20-FZK-Haus.ifc");
const DUPLEX = fixture("Ifc2x3_Duplex_Architecture.ifc");
const SEL = REF["REQ-007-selection"];
const FZK_REF = REF["AC20-FZK-Haus"];
const MULTI = REF["REQ-005-AC4"].element; // Duplex wall with two materials
const VOLUME = "BaseQuantities.NetVolume";
const sorted = (a) => [...a].sort();

test.describe.configure({ timeout: 240_000 });

async function openWith(page, files) {
  const errors = await openBuilder(page);
  await loadFiles(page, files);
  await idle(page);
  return errors;
}

/** The table side of a selection of key: its row is marked when brought into view; no other row is marked. */
async function expectMarked(page, key) {
  const index = await displayIndex(page, key);
  expect(index, `${key} is a shown row`).toBeGreaterThanOrEqual(0);
  await scrollTable(page, Math.max(0, index * 28 - 40));
  const marks = await markedRows(page);
  expect(marks.keys).toEqual([key]);
  expect(marks.groups).toEqual([]);
  expect(marks.inconsistent).toEqual([]);
}

/** Nothing selected on any side: 3D, hook, properties panel closed (REQ-007), no marked row. */
async function expectCleared(page) {
  expect((await viewState(page)).selected).toEqual([]);
  expect(await selection(page)).toEqual({ selected: null, selectedGroup: null, selectedKeys: [] });
  const d = await details(page);
  expect(d.open, "the properties panel is closed").toBe(false);
  expect(d.key).toBeNull();
  expect(d.group).toBeNull();
  expect((await markedRows(page)).keys).toEqual([]);
  expect((await markedRows(page)).groups).toEqual([]);
}

/**
 * No click menu is open in the 3D view (REQ-007-AC3; the menu of REQ-013 is a role="menu" inside #cv-canvas-box,
 * TASK-014).
 */
async function expectNoClickMenu(page) {
  await expect(page.locator('#cv-canvas-box [role="menu"]:visible')).toHaveCount(0);
}

/** The properties panel is shown inside the 3D view at its top right (REQ-007, CR-002). */
async function expectPanelInView(page) {
  const panel = await page.locator("#cv-props").boundingBox();
  const view = await page.locator("#cv-canvas-box").boundingBox();
  expect(panel, "properties panel shown").not.toBeNull();
  expect(panel.x).toBeGreaterThanOrEqual(view.x);
  expect(panel.y).toBeGreaterThanOrEqual(view.y);
  expect(Math.abs(view.x + view.width - 16 - (panel.x + panel.width)), "16 px from the right edge").toBeLessThanOrEqual(
    1,
  );
  expect(panel.y + panel.height).toBeLessThanOrEqual(view.y + view.height);
}

/** Clicks empty canvas (bottom-left corner of the 3D view). */
async function clickEmptyCanvas(page) {
  const canvas = await page.locator("#cv-viewport canvas").boundingBox();
  await page.mouse.click(canvas.x + 12, canvas.y + canvas.height - 12);
}

test("@e2e @acceptance @REQ-007-AC3 a table row click selects the element in 3D and shows its properties panel without a click menu; the camera stays; the selection survives sort, columns and view switch", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  const [wall] = await keysOfGuids(page, [SEL.wall.GlobalId]);
  const before = await camera(page);

  await clickRow(page, wall);
  expect((await viewState(page)).selected).toEqual([wall]);
  expect(await selection(page)).toEqual({ selected: wall, selectedGroup: null, selectedKeys: [wall] });
  let d = await details(page);
  expect(d.open).toBe(true);
  expect(d.key).toBe(wall);
  expect(d.kicker).toBe(SEL.wall.Kategorie);
  expect(d.title).toBe(SEL.wall.Name);
  expect(d.chip, "model chip").toBe("AC20-FZK-Haus");
  await expect(
    page.locator('#cv-props .cv-det-group[data-group="Allgemein"] dt', { hasText: /^GlobalId$/ }).locator("+ dd"),
  ).toHaveText(SEL.wall.GlobalId);
  await expectPanelInView(page);
  await expectNoClickMenu(page);
  await expectMarked(page, wall);
  expect(await camera(page), "a row click does not move the camera").toEqual(before);

  // another row moves the selection (one element at a time)
  const [slabGuid] = FZK_REF.filters["REQ-004-AC1"].expectedGlobalIds.filter((g) => !SEL.group.globalIds.includes(g));
  const [slab] = await keysOfGuids(page, [slabGuid]);
  await clickRow(page, slab);
  expect((await viewState(page)).selected).toEqual([slab]);
  await expectMarked(page, slab);
  await clickRow(page, wall);
  expect((await viewState(page)).selected).toEqual([wall]);

  // survives sort (both directions), adding and removing a column and the view switch
  await clickSort(page, "Name");
  await clickSort(page, "Name");
  expect((await viewState(page)).selected).toEqual([wall]);
  await expectMarked(page, wall);
  await addColumn(page, "NetVolume", VOLUME);
  await expectMarked(page, wall);
  await page.locator("#cv-columns").click();
  const dialog = page.getByRole("dialog", { name: "Spalten" });
  await dialog.getByRole("button", { name: "Spalte entfernen: Geschoss" }).click();
  await dialog.getByRole("button", { name: "Schließen" }).click();
  expect(await headerKeys(page)).not.toContain("Geschoss");
  await expectMarked(page, wall);
  await setView(page, "Gruppiert");
  expect((await viewState(page)).selected).toEqual([wall]);
  expect((await details(page)).key).toBe(wall);
  await setView(page, "Einzelelemente");
  await expectMarked(page, wall);
  expect(await camera(page)).toEqual(before);

  // REQ-007-AC4 panel part (table side; the whole AC with the buttons: panel-actions.spec, TASK-017b): an element without
  // geometry, clicked in the table
  const virtual = FZK_REF.conditionalElements.find((e) => e.hasRepresentationInIfc === false);
  const [noGeo] = await keysOfGuids(page, [virtual.GlobalId]);
  expect((await rowsByKey(page)).get(noGeo).values.Geometrie).toBe("Nein");
  await clickRow(page, noGeo);
  d = await details(page);
  expect(d.open).toBe(true);
  expect(d.key).toBe(noGeo);
  expect(d.nogeo).toBe("Dieses Element hat keine 3D-Geometrie.");
  expect(d.kicker).toBe(virtual.Kategorie);
  expect((await viewState(page)).selected, "nothing to highlight in 3D").toEqual([]);
  expect((await selection(page)).selected).toBe(noGeo);
  await expectMarked(page, noGeo);

  // REQ-007-AC5 on both sides: Esc, then an empty 3D click
  await page.keyboard.press("Escape");
  await expectCleared(page);
  await clickRow(page, wall);
  await expectMarked(page, wall);
  await clickEmptyCanvas(page);
  await expectCleared(page);
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-007-AC1 @REQ-007-AC2 a 3D click marks the table row and scrolls it into view; in the grouping view its groups are expanded", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  // only walls are opaque (pickable) and in the table; the table needs scrolling for them
  await toggleValue(page, SEL.levels[0], SEL.group.Kategorie);
  const keys = await page.evaluate(() => window.__calc.table.keys);
  expect(sorted(keys)).toEqual(sorted(await keysOfGuids(page, SEL.group.globalIds)));
  const first = keys[0];
  const last = keys[keys.length - 1];
  const [wall] = await keysOfGuids(page, [SEL.wall.GlobalId]);
  const hits = {};
  for (const key of new Set([first, last, wall])) {
    hits[key] = await probePick(page, key);
    expect(hits[key], `a 3D click position for ${key}`).not.toBeNull();
  }
  const before = await camera(page);

  // the last row, while the table shows its top: the pick scrolls it into view and marks it
  await scrollTable(page, 0);
  expect((await rowVisibility(page, last)).visible, "precondition: row out of view").toBe(false);
  await page.mouse.click(...hits[last]);
  expect((await viewState(page)).selected).toEqual([last]);
  expect((await details(page)).key).toBe(last);
  expect(await rowVisibility(page, last)).toMatchObject({ rendered: true, visible: true });
  let marks = await markedRows(page);
  expect(marks.keys).toEqual([last]);
  expect(marks.inconsistent).toEqual([]);

  // the first row, while the table shows its end
  await scrollTable(page, "end");
  expect((await rowVisibility(page, first)).visible, "precondition: row out of view").toBe(false);
  await page.mouse.click(...hits[first]);
  expect((await viewState(page)).selected).toEqual([first]);
  expect(await rowVisibility(page, first)).toMatchObject({ rendered: true, visible: true });
  expect((await markedRows(page)).keys).toEqual([first]);
  expect(await camera(page), "a pick does not move the camera").toEqual(before);
  // REQ-007-AC5 (changed CR-002, TASK-017c): the 3D click opened the click menu; the first Esc closes only the menu,
  // the second clears the selection
  await page.keyboard.press("Escape");
  await expect(page.locator('#cv-pick [role="menu"]')).toBeHidden();
  expect((await viewState(page)).selected).toEqual([first]);
  await page.keyboard.press("Escape");
  await expectCleared(page);

  // grouping view, Kategorie then Geschoss, everything collapsed: the pick expands the wall's group and sub-group
  await setView(page, "Gruppiert");
  await pickGroup(page, 2, SEL.levels[1], SEL.levels[1]);
  const groupsShown = () =>
    page.evaluate(() => {
      let parent = null;
      return window.__calc.table.display
        .filter((r) => r.type === "group")
        .map((r) => {
          if (r.level === 1) parent = r.label;
          return { path: r.level === 1 ? [r.label] : [parent, r.label], expanded: r.expanded };
        });
    });
  expect((await groupsShown()).every((g) => !g.expanded)).toBe(true);
  expect((await rowVisibility(page, wall)).rendered).toBe(false);
  await page.mouse.click(...hits[wall]);
  expect((await viewState(page)).selected).toEqual([wall]);
  const groups = await groupsShown();
  const expanded = groups.filter((g) => g.expanded).map((g) => g.path);
  expect(expanded).toEqual([[SEL.wall.Kategorie], [SEL.wall.Kategorie, SEL.wall.Geschoss]]);
  expect(await rowVisibility(page, wall)).toMatchObject({ rendered: true, visible: true });
  marks = await markedRows(page);
  expect(marks.keys).toEqual([wall]);
  expect(marks.groups).toEqual([]);
  expect(marks.inconsistent).toEqual([]);
  // a click on empty space clears the table side too; the groups stay expanded
  await clickEmptyCanvas(page);
  await expectCleared(page);
  expect((await groupsShown()).filter((g) => g.expanded).length).toBe(2);
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-007-AC2 DEC-16 an element in two Material groups: a pick expands both groups and marks both rows", async ({
  page,
}) => {
  const errors = await openWith(page, DUPLEX);
  const [key] = await keysOfGuids(page, [MULTI.GlobalId]);
  expect((await rowsByKey(page)).get(key).values.Material).toEqual(MULTI.Material);
  await setView(page, "Gruppiert");
  await pickGroup(page, 1, "Material", "Material");
  // CalcView.select takes the same path as a 3D pick (cv-3d onPick -> select(key, reveal))
  await page.evaluate((k) => window.CalcView.select(k), key);
  expect((await viewState(page)).selected).toEqual([key]);
  const display = await page.evaluate(() => window.__calc.table.display);
  const expandedLabels = display.filter((r) => r.type === "group" && r.expanded).map((r) => r.label);
  expect(sorted(expandedLabels)).toEqual(sorted(MULTI.Material));
  expect(display.filter((r) => r.type === "element" && r.key === key)).toHaveLength(MULTI.Material.length);
  expect(await rowVisibility(page, key)).toMatchObject({ rendered: true, visible: true });
  // both occurrences carry the mark
  for (const label of MULTI.Material) {
    const at = display.findIndex((r) => r.type === "group" && r.label === label);
    const row = display.slice(at + 1).findIndex((r) => r.type === "element" && r.key === key) + at + 1;
    await scrollTable(page, Math.max(0, row * 28 - 40));
    const marked = await page.evaluate(
      (i) => document.querySelector(`#cv-tbl-scroll .cv-tr[aria-rowindex="${i + 2}"]`).getAttribute("aria-selected"),
      row,
    );
    expect(marked, `row under ${label}`).toBe("true");
  }
  expect(errors).toEqual([]);
});

// a group row, not the 3D click of REQ-007-AC2 (verification INC-2 SYNC-4: tag removed, spec Testing T5)
test("@e2e @acceptance @REQ-007 a group row click selects all elements of the group in 3D; sub-groups; elements leaving the filter leave the selection", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  await setView(page, "Gruppiert");
  await pickGroup(page, 2, SEL.levels[1], SEL.levels[1]);
  const groupKeys = await keysOfGuids(page, SEL.group.globalIds);
  const groupGeometry = await keysOfGuids(page, SEL.group.withRepresentation);
  const subKeys = await keysOfGuids(page, SEL.subGroup.globalIds);
  const subGeometry = await keysOfGuids(page, SEL.subGroup.withRepresentation);
  const idOf = (path) =>
    page.evaluate((labels) => {
      let parent = null;
      for (const r of window.__calc.table.display) {
        if (r.type !== "group") continue;
        if (r.level === 1) parent = r.label;
        if (
          labels.length === 1
            ? r.level === 1 && r.label === labels[0]
            : r.level === 2 && parent === labels[0] && r.label === labels[1]
        )
          return r.id;
      }
      return null;
    }, path);
  const before = await camera(page);

  // level-1 group IfcWallStandardCase: every wall selected, 3D highlights those with geometry
  const wallsId = await idOf([SEL.group.Kategorie]);
  await clickRow(page, wallsId, { group: true });
  expect((await viewState(page)).selected).toEqual(sorted(groupGeometry));
  expect(await selection(page)).toEqual({ selected: null, selectedGroup: wallsId, selectedKeys: sorted(groupKeys) });
  let marks = await markedRows(page);
  expect(marks.groups).toEqual([wallsId]);
  expect(marks.inconsistent).toEqual([]);
  let d = await details(page);
  expect(d.group).toBe(wallsId);
  expect(d.kicker).toBe(`Gruppe: ${SEL.levels[0]}`);
  expect(d.title).toBe(SEL.group.Kategorie);
  expect(d.count).toBe(`${deCount(SEL.group.count)} Elemente ausgewählt`);
  expect(d.nogeo).toBeNull();
  // a row click is not the toggle: the group stays collapsed
  const shown = await page.evaluate((id) => window.__calc.table.display.find((r) => r.id === id), wallsId);
  expect(shown.expanded).toBe(false);
  expect(await camera(page), "a group click does not move the camera").toEqual(before);
  // expanded, its element rows carry the mark too
  await toggleGroup(page, [SEL.group.Kategorie], true);
  await toggleGroup(page, [SEL.group.Kategorie, SEL.subGroup.Geschoss], true);
  await scrollTable(page, Math.max(0, (await displayIndex(page, subKeys[0])) * 28 - 40));
  marks = await markedRows(page);
  expect(marks.keys.length).toBeGreaterThan(0);
  expect(marks.keys.every((k) => groupKeys.includes(k))).toBe(true);
  expect(marks.inconsistent).toEqual([]);

  // level-2 group IfcWallStandardCase / Erdgeschoss
  const subId = await idOf([SEL.subGroup.Kategorie, SEL.subGroup.Geschoss]);
  await clickRow(page, subId, { group: true });
  expect((await viewState(page)).selected).toEqual(sorted(subGeometry));
  expect((await selection(page)).selectedKeys).toEqual(sorted(subKeys));
  d = await details(page);
  expect(d.kicker).toBe(`Gruppe: ${SEL.levels[0]} / ${SEL.levels[1]}`);
  expect(d.title).toBe(`${SEL.subGroup.Kategorie} / ${SEL.subGroup.Geschoss}`);
  expect(d.count).toBe(`${deCount(SEL.subGroup.count)} Elemente ausgewählt`);
  expect((await markedRows(page)).groups).toEqual([subId]);

  // an element row click replaces the group selection
  await clickRow(page, subKeys[0]);
  expect((await viewState(page)).selected).toEqual([subKeys[0]]);
  expect((await selection(page)).selectedGroup).toBeNull();
  expect((await markedRows(page)).groups).toEqual([]);

  // elements that leave the filter leave the group selection; when none is left it is cleared
  await clickRow(page, wallsId, { group: true });
  await toggleValue(page, SEL.levels[1], SEL.subGroup.Geschoss);
  expect((await selection(page)).selectedKeys, "only the walls still inside the filter").toEqual(sorted(subKeys));
  expect((await viewState(page)).selected).toEqual(sorted(subGeometry));
  expect((await details(page)).count).toBe(`${deCount(SEL.subGroup.count)} Elemente ausgewählt`);
  await toggleValue(page, SEL.levels[1], SEL.subGroup.Geschoss); // no filter: the selection does not grow back
  expect((await selection(page)).selectedKeys).toEqual(sorted(subKeys));
  const otherStorey = Object.keys(REF["REQ-006-grouping-fzk"].byKategorie[SEL.group.Kategorie].byGeschoss).find(
    (g) => g !== SEL.subGroup.Geschoss,
  );
  await toggleValue(page, SEL.levels[1], otherStorey);
  await expectCleared(page);
  await toggleValue(page, SEL.levels[1], otherStorey);

  // Esc clears a group selection on both sides
  await clickRow(page, wallsId, { group: true });
  expect((await viewState(page)).selected).toEqual(sorted(groupGeometry));
  await page.keyboard.press("Escape");
  await expectCleared(page);
  expect(errors).toEqual([]);
});

test("@e2e @robustness @REQ-007 selection then removing a model, then filtering it out; rapid row clicks end in one consistent selection", async ({
  page,
}) => {
  const errors = await openWith(page, [FZK, DUPLEX]);
  const models = await page.evaluate(() => window.__calc.models.map((m) => ({ id: m.id, modell: m.modell })));
  const duplex = models.find((m) => m.modell.startsWith("Ifc2x3_Duplex"));
  const [duplexKey] = await keysOfGuids(page, [MULTI.GlobalId]);
  const [wall] = await keysOfGuids(page, [SEL.wall.GlobalId]);

  // a selected element of a removed model is cleared on every side
  await clickRow(page, duplexKey);
  expect((await viewState(page)).selected).toEqual([duplexKey]);
  await removeModel(page, duplex.modell);
  await expectCleared(page);
  expect((await viewState(page)).opaque.some((k) => k.startsWith(duplex.id + ":"))).toBe(false);

  // a selection of the remaining model survives another model's removal
  await loadFiles(page, DUPLEX);
  await idle(page);
  await clickRow(page, wall);
  const again = await page.evaluate(
    () => window.__calc.models.find((m) => m.modell.startsWith("Ifc2x3_Duplex")).modell,
  );
  await removeModel(page, again);
  expect((await viewState(page)).selected).toEqual([wall]);
  await expectMarked(page, wall);
  expect((await details(page)).key).toBe(wall);

  // filtered out: cleared on every side; it does not come back when the filter is removed
  await toggleValue(page, "Kategorie", "IfcSlab");
  await expectCleared(page);
  await toggleValue(page, "Kategorie", "IfcSlab");
  await expectCleared(page);

  // rapid clicks on many rows, mixed with Escape: the last click wins everywhere, one row marked
  await scrollTable(page, 0);
  const rendered = await page.evaluate(() =>
    [...document.querySelectorAll("#cv-tbl-scroll .cv-tbl-body .cv-tr")]
      .filter(
        (r) =>
          !r.hidden &&
          r.dataset.key &&
          r.getBoundingClientRect().bottom < document.getElementById("cv-tbl-scroll").getBoundingClientRect().bottom,
      )
      .map((r) => r.dataset.key),
  );
  expect(rendered.length).toBeGreaterThanOrEqual(6);
  for (let round = 0; round < 3; round++) {
    for (const key of rendered)
      await page.locator(`#cv-tbl-scroll .cv-tr[data-key="${key}"]`).click({ position: { x: 300, y: 14 } });
    await page.keyboard.press("Escape");
  }
  for (const key of rendered)
    await page.locator(`#cv-tbl-scroll .cv-tr[data-key="${key}"]`).click({ position: { x: 300, y: 14 } });
  const lastKey = rendered[rendered.length - 1];
  const rows = await rowsByKey(page);
  expect((await viewState(page)).selected).toEqual(rows.get(lastKey).geometry ? [lastKey] : []);
  expect(await selection(page)).toEqual({ selected: lastKey, selectedGroup: null, selectedKeys: [lastKey] });
  expect((await details(page)).key).toBe(lastKey);
  const marks = await markedRows(page);
  expect(marks.keys).toEqual([lastKey]);
  expect(marks.inconsistent).toEqual([]);

  // removing the last model with a selection leaves an empty, error-free builder
  await removeModel(page, models.find((m) => m.id !== duplex.id).modell);
  await expectCleared(page);
  expect(errors).toEqual([]);
});

test("@e2e switching `Einzelelemente` / `Gruppiert` starts the table at its first row (TASK-006b follow-up)", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  const top = () => page.evaluate(() => document.getElementById("cv-tbl-scroll").scrollTop);
  expect(await scrollTable(page, "end")).toBeGreaterThan(0);
  await setView(page, "Gruppiert");
  expect(await top()).toBe(0);
  await page.getByRole("button", { name: "Alle aufklappen" }).click();
  await expect.poll(() => page.evaluate(() => window.__calc.table.count)).toBeGreaterThan(20);
  expect(await scrollTable(page, "end")).toBeGreaterThan(0);
  await setView(page, "Einzelelemente");
  expect(await top()).toBe(0);
  // a new grouping property also starts at the top
  await setView(page, "Gruppiert");
  await page.getByRole("button", { name: "Alle aufklappen" }).click();
  await expect.poll(() => page.evaluate(() => window.__calc.table.count)).toBeGreaterThan(20);
  expect(await scrollTable(page, "end")).toBeGreaterThan(0);
  await pickGroup(page, 2, SEL.levels[1], SEL.levels[1]);
  expect(await top()).toBe(0);
  expect(errors).toEqual([]);
});

test("@e2e @REQ-007 Esc inside a filter search field clears only the field, not the element selection (TASK-006c R2)", async ({
  page,
}) => {
  const errors = await openBuilder(page);
  await loadFiles(page, FZK);
  await idle(page);
  const [wall] = await keysOfGuids(page, [SEL.wall.GlobalId]);
  await page.evaluate((key) => window.CalcView.select(key), wall);
  await expect.poll(async () => (await selection(page)).selected).toBe(wall);
  const search = page.getByRole("searchbox", { name: "Werte suchen: Kategorie" });
  const labels = async () => (await shownValues(page, "Kategorie")).map((v) => v.label);
  const all = await labels();
  expect(all.length).toBeGreaterThan(1);
  await search.fill(SEL.wall.Kategorie);
  await expect.poll(labels).toEqual([SEL.wall.Kategorie]);
  await search.press("Escape");
  await expect(search).toHaveValue("");
  await expect.poll(labels).toEqual(all);
  expect((await selection(page)).selected, "selection kept").toBe(wall);
  await search.press("Escape"); // an empty field: still nothing else happens
  expect((await selection(page)).selected).toBe(wall);
  // Esc outside a field still clears the selection (REQ-007-AC5)
  await page.locator("#cv-status").click();
  await page.keyboard.press("Escape");
  await expect.poll(async () => (await selection(page)).selected).toBeNull();
  expect(errors).toEqual([]);
});

test("@e2e @robustness @REQ-007 keyboard: arrows move the row cursor, Enter / Space select a row or group like a click, Right / Left expand / collapse", async ({
  page,
}) => {
  // verification INC-1 UX M2: rows were selectable with the mouse only
  const errors = await openWith(page, FZK);
  const grid = page.locator("#cv-tbl-scroll");
  await grid.focus();
  const cursorRow = () =>
    page.evaluate(() => {
      const box = document.getElementById("cv-tbl-scroll");
      const node = box.querySelector(".cv-tr.cv-cursor");
      return {
        index: node ? Number(node.getAttribute("aria-rowindex")) - 2 : -1,
        active: box.getAttribute("aria-activedescendant"),
        id: node ? node.id : null,
      };
    });
  const keys = await page.evaluate(() => window.__calc.table.keys.slice());
  expect(keys.length).toBe(await page.evaluate(() => window.__calc.rows.length));
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  expect(await cursorRow()).toEqual({ index: 1, active: "cv-tr-cursor", id: "cv-tr-cursor" });
  expect((await selection(page)).selected).toBeNull();
  await page.keyboard.press("Enter");
  await idle(page);
  expect((await selection(page)).selected).toBe(keys[1]);
  expect((await details(page)).key).toBe(keys[1]);
  expect((await markedRows(page)).keys).toEqual([keys[1]]);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press(" ");
  await idle(page);
  expect((await selection(page)).selected).toBe(keys[2]);
  // End moves to the last row and scrolls it into view
  await page.keyboard.press("End");
  expect((await cursorRow()).index).toBe(keys.length - 1);
  expect((await rowVisibility(page, keys.at(-1))).visible).toBe(true);
  await page.keyboard.press("Enter");
  await idle(page);
  expect((await selection(page)).selected).toBe(keys.at(-1));
  expect(await grid.evaluate((n) => document.activeElement === n)).toBe(true);

  // grouped view: Enter on a group row selects its elements, Right / Left expand and collapse it
  await setView(page, "Gruppiert");
  await grid.focus();
  await page.keyboard.press("Home");
  const first = await page.evaluate(() => window.__calc.table.display[0]);
  expect(first.type).toBe("group");
  await page.keyboard.press("Enter");
  await idle(page);
  expect((await selection(page)).selectedGroup).toBe(first.id);
  expect((await details(page)).group).toBe(first.id);
  expect(first.expanded).toBe(false);
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => page.evaluate(() => window.__calc.table.display[0].expanded)).toBe(true);
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => page.evaluate(() => window.__calc.table.display[0].expanded)).toBe(false);
  expect(errors).toEqual([]);
});
