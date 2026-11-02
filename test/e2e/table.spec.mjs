// TASK-006a table, single-element view (spec REQ-006-AC4/AC5/AC6/AC9, REQ-004-AC1/AC4 with table + 3D + filter sets,
// REQ-001-AC3/AC4 in full, TASK-003 D2). The table is read from the DOM (all rows collected by scrolling the
// virtualised body), the 3D side from CalcView.state() (spec 4.4), the filter sets from their rendered values.
// Expected key sets, counts and values come from test/fixtures/reference-values.json (STEP-text derivation).
import { test, expect } from "../support/network-guard.mjs";
import { REF, fixture, loadFiles, openBuilder, removeModel } from "../support/builder.mjs";
import { addFilterSet, filterSet, shownCounts, shownValues, toggleValue } from "../support/filter-area.mjs";
import { idle, keysOfGuids, rowsByKey, viewState } from "../support/view-3d.mjs";
import {
  addColumn,
  allTableRows,
  checkColumnValue,
  clickSort,
  de3,
  header,
  headerKeys,
  openColumnFilter,
  tableGuids,
  tableState,
  tableUpdated,
  tableUpdates,
  typeBound,
} from "../support/table.mjs";

const FZK = fixture("AC20-FZK-Haus.ifc");
const DUPLEX = fixture("Ifc2x3_Duplex_Architecture.ifc");
const RANGE = fixture("fzk-range.ifc");
const fzkRef = REF["AC20-FZK-Haus"];
const duplexRef = REF.Ifc2x3_Duplex_Architecture;
const NOT_ROWS = ["IfcOpeningElement"]; // STEP classes the extractor does not list as rows (TASK-002)
const rowsByKategorie = (byKategorie) =>
  Object.fromEntries(Object.entries(byKategorie).filter(([k]) => !NOT_ROWS.includes(k)));
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
const FZK_ROWS_BY_KATEGORIE = rowsByKategorie(fzkRef.elementsInStepTextByKategorie);
const FZK_TOTAL = sum(FZK_ROWS_BY_KATEGORIE);
const DUPLEX_TOTAL = sum(rowsByKategorie(duplexRef.elementsInStepTextByKategorie));
const GROUND = fzkRef.filters["REQ-004-AC2"].groundFloorStorey.Name;
const VOLUME = "BaseQuantities.NetVolume";
const DEFAULT_COLUMNS = ["Modell", "Kategorie", "Name", "Geschoss"];

test.describe.configure({ timeout: 180_000 });

const status = (page) => page.locator("#cv-status");
const de = (n) => n.toLocaleString("de-DE");
const sorted = (a) => [...a].sort();

async function openWith(page, files) {
  const errors = await openBuilder(page);
  await loadFiles(page, files);
  await idle(page);
  return errors;
}

/** Keys (sorted) of the elements with the given GlobalIds that have 3D geometry. */
async function geometryKeysOf(page, guids) {
  const rows = await rowsByKey(page);
  const keys = await keysOfGuids(page, guids);
  return keys.filter((k) => rows.get(k).geometry).sort();
}

/** Keys (sorted) of every row with 3D geometry. */
async function allGeometryKeys(page) {
  return [...(await rowsByKey(page)).values()]
    .filter((r) => r.geometry)
    .map((r) => r.key)
    .sort();
}

test("@e2e @acceptance @REQ-006 the table shows the default columns and every element of the model", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  expect(await headerKeys(page)).toEqual(DEFAULT_COLUMNS);
  const rows = await allTableRows(page);
  expect(rows.length).toBe(FZK_TOTAL);
  // reference elements: their cells show the STEP-text values
  const byGuid = new Map((await tableGuids(page)).map((g, i) => [g, rows[i]]));
  for (const e of fzkRef.elements) {
    const cells = byGuid.get(e.GlobalId).cells;
    expect(cells, e.GlobalId).toEqual({
      Modell: "AC20-FZK-Haus",
      Kategorie: e.Kategorie,
      Name: e.Name ?? "",
      Geschoss: e.Geschoss ?? "",
    });
  }
  // virtualised: only the rows near the visible window exist
  const nodes = await page.locator("#cv-tbl-scroll .cv-tr").count();
  expect(nodes).toBeLessThan(40);
  await expect(page.locator("#cv-tbl-empty")).toBeHidden();
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-006-AC4 column filter Name: table, 3D state and filter-set counts show only the matching elements", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  const ac4 = fzkRef.filters["REQ-006-AC4"];
  const [name] = ac4.values;
  await checkColumnValue(page, "Name", name, name);
  // table
  expect(sorted(await tableGuids(page))).toEqual(sorted(ac4.expectedGlobalIds));
  await expect(status(page)).toHaveText(`${de(ac4.expectedCount)} von ${de(FZK_TOTAL)} Elementen`);
  await expect(header(page, "Name").locator(".cv-th-filter")).toHaveAttribute("aria-pressed", "true");
  // 3D: exactly the matching elements opaque, all others ghosts
  const state = await viewState(page);
  const expectedKeys = await geometryKeysOf(page, ac4.expectedGlobalIds);
  expect(state.opaque).toEqual(expectedKeys);
  const geometry = await allGeometryKeys(page);
  expect(state.ghost).toEqual(geometry.filter((k) => !expectedKeys.includes(k)));
  // filter sets count under the column filter
  expect(await shownCounts(page, "Kategorie")).toEqual(ac4.byKategorie);
  expect(await shownCounts(page, "Geschoss")).toEqual(ac4.byGeschoss);
  // the checklist counts under all other filters (own selection excluded): every Name value stays listed
  const popup = await openColumnFilter(page, "Name");
  await popup.getByRole("searchbox").fill("");
  expect(await popup.locator(".cv-fs-value:not([hidden])").count()).toBeGreaterThan(1);
  await popup.getByRole("searchbox").fill(name); // virtualised list: bring the value into view
  await expect(popup.getByRole("checkbox", { name, exact: true })).toBeChecked();
  // unchecking restores everything
  const before = await page.evaluate(() => window.__calc.filter.updates);
  await popup.getByRole("checkbox", { name, exact: true }).click();
  await page.waitForFunction((n) => window.__calc.filter.updates > n, before);
  await expect(status(page)).toHaveText(`${de(FZK_TOTAL)} von ${de(FZK_TOTAL)} Elementen`);
  expect((await viewState(page)).opaque).toEqual(geometry);
  await page.keyboard.press("Escape");
  await expect(page.locator("#cv-colfilter")).toBeHidden();
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-006-AC5 sorting a numeric column descending orders rows by value, empty values last", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  const ref = fzkRef.columnValues[VOLUME];
  await addColumn(page, "NetVolume", VOLUME);
  const desc = Object.values(ref.byGlobalId).sort((a, b) => b - a);

  await clickSort(page, VOLUME); // ascending
  await expect(header(page, VOLUME)).toHaveAttribute("aria-sort", "ascending");
  let rows = await allTableRows(page);
  expect(rows.map((r) => r.cells[VOLUME]).slice(0, ref.carriers)).toEqual([...desc].reverse().map(de3));
  expect(rows.slice(ref.carriers).every((r) => r.cells[VOLUME] === "")).toBe(true);

  await clickSort(page, VOLUME); // descending
  await expect(header(page, VOLUME)).toHaveAttribute("aria-sort", "descending");
  expect(await tableState(page)).toMatchObject({ sort: { key: VOLUME, dir: "desc" } });
  rows = await allTableRows(page);
  expect(rows.length).toBe(FZK_TOTAL);
  expect(rows.map((r) => r.cells[VOLUME]).slice(0, ref.carriers)).toEqual(desc.map(de3));
  expect(
    rows.slice(ref.carriers).every((r) => r.cells[VOLUME] === ""),
    "empty values last",
  ).toBe(true);
  // the GlobalIds of the first rows carry the reference values
  const guids = await tableGuids(page);
  guids.slice(0, ref.carriers).forEach((g, i) => expect(ref.byGlobalId[g]).toBe(desc[i]));
  // numbers right-aligned
  const align = await page
    .locator(`.cv-tr .cv-td[data-col="${VOLUME}"]`)
    .first()
    .evaluate((n) => getComputedStyle(n).textAlign);
  expect(align).toBe("right");

  await clickSort(page, VOLUME); // third click: unsorted (row order)
  await expect(header(page, VOLUME)).toHaveAttribute("aria-sort", "none");
  expect((await tableState(page)).sort).toBeNull();

  // text column via the popup buttons: names in German order, empty names last
  const popup = await openColumnFilter(page, "Name");
  let before = await tableUpdates(page);
  await popup.getByRole("button", { name: "Absteigend sortieren" }).click();
  await tableUpdated(page, before);
  rows = await allTableRows(page);
  const names = rows.map((r) => r.cells.Name);
  const filled = names.filter((n) => n !== "");
  expect(names.slice(0, filled.length)).toEqual(filled); // empty last
  const collator = new Intl.Collator("de");
  for (let i = 1; i < filled.length; i++) expect(collator.compare(filled[i - 1], filled[i])).toBeGreaterThanOrEqual(0);
  await expect(header(page, "Name")).toHaveAttribute("aria-sort", "descending");
  before = await tableUpdates(page);
  await popup.getByRole("button", { name: "Absteigend sortieren" }).click(); // again: sort off
  await tableUpdated(page, before);
  await expect(header(page, "Name")).toHaveAttribute("aria-sort", "none");
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-006-AC6 add, move (drag and buttons), resize and remove columns; the change is in the configuration state", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  expect((await tableState(page)).columns.map((c) => c.key)).toEqual(DEFAULT_COLUMNS);

  // add
  await addColumn(page, "NetVolume", VOLUME);
  expect(await headerKeys(page)).toEqual([...DEFAULT_COLUMNS, VOLUME]);
  expect((await tableState(page)).columns.map((c) => c.key)).toEqual([...DEFAULT_COLUMNS, VOLUME]);
  await expect(header(page, VOLUME)).toContainText("BaseQuantities.NetVolume (m³)");
  const volumeCells = await allTableRows(page);
  expect(volumeCells.filter((r) => r.cells[VOLUME] !== "").length).toBe(fzkRef.columnValues[VOLUME].carriers);

  // move by drag and drop: the new column onto the left half of `Modell` -> first
  const target = await header(page, "Modell").boundingBox();
  await header(page, VOLUME)
    .locator(".cv-th-text")
    .dragTo(header(page, "Modell"), {
      targetPosition: { x: 8, y: target.height / 2 },
    });
  await expect.poll(() => headerKeys(page)).toEqual([VOLUME, ...DEFAULT_COLUMNS]);
  expect((await tableState(page)).columns.map((c) => c.key)).toEqual([VOLUME, ...DEFAULT_COLUMNS]);
  // body cells follow the header: the first cell of a row is the volume cell
  const firstCellCol = await page.evaluate(() => {
    const row = [...document.querySelectorAll(".cv-tr")].find((r) => !r.hidden);
    return [...row.querySelectorAll(".cv-td")].sort((a, b) => parseFloat(a.style.left) - parseFloat(b.style.left))[0]
      .dataset.col;
  });
  expect(firstCellCol).toBe(VOLUME);
  // drag `Modell` onto the right half of `Name` -> after Name
  const nameBox = await header(page, "Name").boundingBox();
  await header(page, "Modell")
    .locator(".cv-th-text")
    .dragTo(header(page, "Name"), {
      targetPosition: { x: nameBox.width - 10, y: nameBox.height / 2 },
    });
  await expect.poll(() => headerKeys(page)).toEqual([VOLUME, "Kategorie", "Name", "Modell", "Geschoss"]);

  // move with the chooser buttons
  await page.locator("#cv-columns").click();
  const dialog = page.getByRole("dialog", { name: "Spalten" });
  await dialog.getByRole("button", { name: "Spalte nach links: Modell" }).click();
  await expect.poll(() => headerKeys(page)).toEqual([VOLUME, "Kategorie", "Modell", "Name", "Geschoss"]);
  await dialog.getByRole("button", { name: "Spalte nach rechts: BaseQuantities.NetVolume (m³)" }).click();
  await expect.poll(() => headerKeys(page)).toEqual(["Kategorie", VOLUME, "Modell", "Name", "Geschoss"]);
  await expect(dialog.locator(".cv-cat-entry[data-key='Kategorie']")).toBeDisabled(); // shown columns: `angezeigt`
  await dialog.getByRole("button", { name: "Schließen" }).click();

  // resize by pointer drag on the handle (+70 px) and by keyboard (-16 px)
  const width = async (key) => (await tableState(page)).columns.find((c) => c.key === key).width;
  const w0 = await width("Name");
  const handle = header(page, "Name").locator(".cv-th-resize");
  const hb = await handle.boundingBox();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2 + 35, hb.y + hb.height / 2, { steps: 4 });
  await page.mouse.move(hb.x + hb.width / 2 + 70, hb.y + hb.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect.poll(() => width("Name")).toBe(w0 + 70);
  expect(Math.round((await header(page, "Name").boundingBox()).width)).toBe(w0 + 70);
  const cellWidth = await page
    .locator('.cv-tr:not([hidden]) .cv-td[data-col="Name"]')
    .first()
    .evaluate((n) => n.offsetWidth);
  expect(cellWidth).toBe(w0 + 70);
  await handle.focus();
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => width("Name")).toBe(w0 + 70 - 16);
  // a resize drag neither sorts nor moves
  expect((await tableState(page)).sort).toBeNull();
  expect(await headerKeys(page)).toEqual(["Kategorie", VOLUME, "Modell", "Name", "Geschoss"]);

  // remove: via the column popup (also drops its filter and sort) and via the chooser
  await typeBound(page, VOLUME, "min", "1");
  await expect(status(page)).not.toHaveText(`${de(FZK_TOTAL)} von ${de(FZK_TOTAL)} Elementen`);
  const popup = await openColumnFilter(page, VOLUME);
  await popup.getByRole("button", { name: "Aufsteigend sortieren" }).click();
  expect(await tableState(page)).toMatchObject({ sort: { key: VOLUME, dir: "asc" } });
  await popup.getByRole("button", { name: "Spalte entfernen" }).click();
  await expect(page.locator("#cv-colfilter")).toBeHidden();
  expect(await headerKeys(page)).toEqual(["Kategorie", "Modell", "Name", "Geschoss"]);
  expect(await tableState(page)).toEqual({
    columns: [
      { key: "Kategorie", width: expect.any(Number) },
      { key: "Modell", width: expect.any(Number) },
      { key: "Name", width: w0 + 70 - 16 },
      { key: "Geschoss", width: expect.any(Number) },
    ],
    sort: null,
    columnFilters: [],
  });
  await expect(status(page)).toHaveText(`${de(FZK_TOTAL)} von ${de(FZK_TOTAL)} Elementen`);
  await page.locator("#cv-columns").click();
  await dialog.getByRole("button", { name: "Spalte entfernen: Geschoss" }).click();
  await expect.poll(() => headerKeys(page)).toEqual(["Kategorie", "Modell", "Name"]);
  await dialog.getByRole("button", { name: "Schließen" }).click();
  expect((await tableState(page)).columns.map((c) => c.key)).toEqual(["Kategorie", "Modell", "Name"]);
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-006-AC9 numeric column filter `von` 2 `bis` 5 is inclusive and excludes empty values; decimal comma (D2)", async ({
  page,
}) => {
  const errors = await openWith(page, RANGE);
  const ref = REF["REQ-006-AC9"];
  const key = ref.property;
  const total = await page.evaluate(() => window.__calc.rows.length);
  await addColumn(page, "CalcTest_Range", key);

  const expectRows = async (guids) => {
    await expect.poll(async () => sorted(await tableGuids(page))).toEqual(sorted(guids));
    await expect(status(page)).toHaveText(`${de(guids.length)} von ${de(total)} Elementen`);
    expect((await viewState(page)).opaque).toEqual(await geometryKeysOf(page, guids));
  };

  await typeBound(page, key, "min", "2");
  await typeBound(page, key, "max", "5");
  await expectRows(ref["von 2 bis 5"].expectedGlobalIds);
  // the bounds are in the rows, their neighbours and the empty cells are not
  const values = (await allTableRows(page)).map((r) => r.cells[key]);
  expect(sorted(values)).toEqual(sorted(["2", "2,5", "3,5", "5"]));
  expect(await tableState(page)).toMatchObject({ columnFilters: [{ key, type: "range", min: 2, max: 5 }] });
  await expect(header(page, key).locator(".cv-th-filter")).toHaveAttribute("aria-pressed", "true");

  // D2: German decimal comma; empty `bis` = no bound
  await typeBound(page, key, "min", ref["von 2,5"].input);
  await typeBound(page, key, "max", "");
  await expectRows(ref["von 2,5"].expectedGlobalIds);
  expect(await tableState(page)).toMatchObject({ columnFilters: [{ key, type: "range", min: 2.5, max: null }] });
  // invalid input: German hint, input ignored (filter unchanged)
  await typeBound(page, key, "max", "fünf");
  const popup = await openColumnFilter(page, key);
  await expect(popup.getByRole("status")).toHaveText(
    "Ungültige Zahl in „bis“ – die Eingabe wird ignoriert. Beispiel: 2,5",
  );
  await expect(popup.locator('input[data-bound="max"]')).toHaveAttribute("aria-invalid", "true");
  await expectRows(ref["von 2,5"].expectedGlobalIds);
  // a decimal point is accepted as well; the hint disappears
  await typeBound(page, key, "max", "5.0");
  await expect(popup.getByRole("status")).toBeHidden();
  await expect
    .poll(async () => (await tableState(page)).columnFilters)
    .toEqual([{ key, type: "range", min: 2.5, max: 5 }]);
  // reopened, the popup shows the applied bounds in German format
  await page.keyboard.press("Escape");
  const again = await openColumnFilter(page, key);
  await expect(again.locator('input[data-bound="min"]')).toHaveValue("2,5");
  await expect(again.locator('input[data-bound="max"]')).toHaveValue("5");
  // `Filter zuruecksetzen` clears it
  await again.getByRole("button", { name: "Filter zurücksetzen" }).click();
  await expect(status(page)).toHaveText(`${de(total)} von ${de(total)} Elementen`);
  expect((await tableState(page)).columnFilters).toEqual([]);
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-004-AC1 @REQ-004-AC4 filter sets and column filters drive table, 3D and filter sets together; reset clears both", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  const ac1 = fzkRef.filters["REQ-004-AC1"];
  const ac2 = fzkRef.filters["REQ-004-AC2"];
  const geometry = await allGeometryKeys(page);

  // AC1: filter set Kategorie = IfcWallStandardCase OR IfcSlab -> table and 3D
  for (const k of ac1.filter.Kategorie) await toggleValue(page, "Kategorie", k);
  expect(sorted(await tableGuids(page))).toEqual(sorted(ac1.expectedGlobalIds));
  let state = await viewState(page);
  expect(state.opaque).toEqual(await geometryKeysOf(page, ac1.expectedGlobalIds));
  expect(state.ghost.length).toBe(geometry.length - state.opaque.length);

  // a column filter Geschoss = ground floor joins with AND: table, 3D and the filter-set counts follow
  await checkColumnValue(page, "Geschoss", GROUND);
  expect(sorted(await tableGuids(page))).toEqual(sorted(ac2.expectedGlobalIds));
  state = await viewState(page);
  expect(state.opaque).toEqual(await geometryKeysOf(page, ac2.expectedGlobalIds));
  const kategorie = { ...ac2.kategorieCountsOnGroundFloor };
  for (const [k, n] of Object.entries(ac2.kategorieCountsOnGroundFloorConditional))
    if (k in FZK_ROWS_BY_KATEGORIE) kategorie[k] = n;
  expect(await shownCounts(page, "Kategorie")).toEqual(kategorie);
  await expect(status(page)).toHaveText(`${de(ac2.expectedCount)} von ${de(FZK_TOTAL)} Elementen`);
  await page.keyboard.press("Escape");

  // AC4: `Alle Filter zuruecksetzen` clears filter sets and column filters
  await page.getByRole("button", { name: "Alle Filter zurücksetzen" }).click();
  await expect(status(page)).toHaveText(`${de(FZK_TOTAL)} von ${de(FZK_TOTAL)} Elementen`);
  expect((await allTableRows(page)).length).toBe(FZK_TOTAL);
  expect((await tableState(page)).columnFilters).toEqual([]);
  expect(await page.evaluate(() => window.__calc.filter.active)).toEqual([]);
  await expect(header(page, "Geschoss").locator(".cv-th-filter")).toHaveAttribute("aria-pressed", "false");
  for (const key of ["Kategorie", "Geschoss", "Material"])
    expect((await shownValues(page, key)).filter((v) => v.checked)).toEqual([]);
  state = await viewState(page);
  expect(state.opaque).toEqual(geometry);
  expect(state.ghost).toEqual([]);
  await expect(page.getByRole("button", { name: "Alle Filter zurücksetzen" })).toBeDisabled();
  // a column filter alone also enables the reset
  await checkColumnValue(page, "Kategorie", "IfcSlab");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Alle Filter zurücksetzen" })).toBeEnabled();
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-001-AC3 removing a model removes its elements from 3D, filter sets and table; filters on remaining values stay active", async ({
  page,
}) => {
  const errors = await openWith(page, [FZK, DUPLEX]);
  await addFilterSet(page, "Modell", "Modell");
  // IfcWallStandardCase exists in both models; IfcFurnishingElement only in the Duplex model
  expect(duplexRef.elementsInStepTextByKategorie.IfcFurnishingElement).toBeGreaterThan(0);
  expect(fzkRef.elementsInStepTextByKategorie.IfcFurnishingElement).toBeUndefined();
  await toggleValue(page, "Kategorie", "IfcWallStandardCase");
  await toggleValue(page, "Kategorie", "IfcFurnishingElement");
  await checkColumnValue(page, "Modell", "Ifc2x3_Duplex_Architecture");
  await checkColumnValue(page, "Modell", "AC20-FZK-Haus");
  await page.keyboard.press("Escape");
  const walls = fzkRef.elementsInStepTextByKategorie.IfcWallStandardCase;
  const duplexWallsAndFurniture =
    duplexRef.elementsInStepTextByKategorie.IfcWallStandardCase +
    duplexRef.elementsInStepTextByKategorie.IfcFurnishingElement;
  await expect(status(page)).toHaveText(
    `${de(walls + duplexWallsAndFurniture)} von ${de(FZK_TOTAL + DUPLEX_TOTAL)} Elementen`,
  );

  await removeModel(page, "Ifc2x3_Duplex_Architecture");
  await idle(page);
  // table: only the FZK walls remain (the wall filter stays active)
  const rows = await allTableRows(page);
  expect(rows.length).toBe(walls);
  expect(new Set(rows.map((r) => r.cells.Modell))).toEqual(new Set(["AC20-FZK-Haus"]));
  expect(new Set(rows.map((r) => r.cells.Kategorie))).toEqual(new Set(["IfcWallStandardCase"]));
  await expect(status(page)).toHaveText(`${de(walls)} von ${de(FZK_TOTAL)} Elementen`);
  // filter sets: the Duplex-only value is gone, the remaining checked value stays checked
  const kat = await shownValues(page, "Kategorie");
  expect(kat.filter((v) => v.checked).map((v) => v.label)).toEqual(["IfcWallStandardCase"]);
  expect(kat.map((v) => v.label)).not.toContain("IfcFurnishingElement");
  expect(await shownCounts(page, "Modell")).toEqual({ "AC20-FZK-Haus": walls });
  // the Modell column filter keeps the remaining value only
  expect((await tableState(page)).columnFilters).toEqual([
    { key: "Modell", type: "values", values: ["AC20-FZK-Haus"] },
  ]);
  // 3D: no element of the removed model; the FZK walls opaque, the rest ghosts
  const state = await viewState(page);
  const all = [...state.opaque, ...state.ghost, ...state.hidden];
  expect(all.filter((k) => !k.startsWith("m1:"))).toEqual([]);
  const wallGuids = await page.evaluate(() =>
    window.__calc.rows.filter((r) => r.values.Kategorie === "IfcWallStandardCase").map((r) => r.guid),
  );
  expect(wallGuids.length).toBe(walls);
  expect(state.opaque).toEqual(await geometryKeysOf(page, wallGuids));
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-001-AC4 IfcSpace rows appear in table, filter sets and 3D only with the option", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  const spaces = fzkRef.spaces;
  const tableKategorien = async () => new Set((await allTableRows(page)).map((r) => r.cells.Kategorie));
  expect(await tableKategorien()).not.toContain("IfcSpace");
  expect((await allTableRows(page)).length).toBe(FZK_TOTAL);
  expect(Object.keys(await shownCounts(page, "Kategorie"))).not.toContain("IfcSpace");

  const option = async (on) => {
    const loads = await page.evaluate(() => window.__calc.loads);
    await page.locator("#cv-opt-spaces").setChecked(on);
    await page.waitForFunction((n) => window.__calc.loads > n && window.__calc.phase === "ready", loads);
    await idle(page);
  };
  await option(true);
  expect((await allTableRows(page)).length).toBe(FZK_TOTAL + spaces.count);
  expect((await shownCounts(page, "Kategorie")).IfcSpace).toBe(spaces.count);
  // the table's own column filter on Kategorie = IfcSpace lists exactly the reference spaces
  await checkColumnValue(page, "Kategorie", "IfcSpace");
  await page.keyboard.press("Escape");
  expect(sorted(await tableGuids(page))).toEqual(sorted(spaces.GlobalIds));
  let state = await viewState(page);
  expect(state.opaque).toEqual(await geometryKeysOf(page, spaces.GlobalIds));
  expect(state.opaque.length).toBeGreaterThan(0);

  // option off: the spaces leave table, filter sets and 3D; the column filter on the vanished value is dropped
  await option(false);
  expect((await allTableRows(page)).length).toBe(FZK_TOTAL);
  expect(await tableKategorien()).not.toContain("IfcSpace");
  expect((await tableState(page)).columnFilters).toEqual([]);
  state = await viewState(page);
  const spaceKeys = await page.evaluate(() => window.__calc.models[0].spaceIds.map((id) => "m1:" + id));
  expect([...state.opaque, ...state.ghost, ...state.hidden].filter((k) => spaceKeys.includes(k))).toEqual([]);
  await expect(status(page)).toHaveText(`${de(FZK_TOTAL)} von ${de(FZK_TOTAL)} Elementen`);
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-006 the column filter popup closes with Escape without clearing the 3D selection; the filter button toggles it", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  const [wall] = await keysOfGuids(page, ["3rPX_Juz59peXXY6wDJl18"]);
  await page.evaluate((k) => window.CalcView.select(k), wall);
  await openColumnFilter(page, "Kategorie");
  await page.keyboard.press("Escape");
  await expect(page.locator("#cv-colfilter")).toBeHidden();
  expect(await page.evaluate(() => window.__calc.view.selected)).toBe(wall);
  await header(page, "Kategorie").locator(".cv-th-filter").click();
  await expect(page.locator("#cv-colfilter")).toBeVisible();
  await header(page, "Kategorie").locator(".cv-th-filter").click();
  await expect(page.locator("#cv-colfilter")).toBeHidden();
  // a click elsewhere closes it too
  await openColumnFilter(page, "Name");
  await page.locator("#cv-status").click();
  await expect(page.locator("#cv-colfilter")).toBeHidden();
  // row click hook for TASK-006c: no error, nothing selected by the table yet
  await page.locator(".cv-tr:not([hidden])").first().click();
  expect(errors).toEqual([]);
  await filterSet(page, "Kategorie").scrollIntoViewIfNeeded();
});
