// TASK-004 E2E / acceptance tests of the screen layout and the filter area (spec §2 User interface, REQ-003,
// REQ-004 filter-set part, REQ-001-AC1 Modell set). Expected keys and counts come from
// test/fixtures/reference-values.json (derived from the STEP text, independent of the product code).
// CV_SHOT_DIR=<dir> additionally writes screenshots of the builder with filters active (for reviews).
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "../support/network-guard.mjs";
import { REF, fixture, loadFiles, openBuilder } from "../support/builder.mjs";
import {
  addFilterSet,
  filterSet,
  filteredGuids,
  setTitles,
  shownCounts,
  shownValues,
  toggleValue,
} from "../support/filter-area.mjs";

const FZK = fixture("AC20-FZK-Haus.ifc");
const DUPLEX = fixture("Ifc2x3_Duplex_Architecture.ifc");
const fzkRef = REF["AC20-FZK-Haus"];
const duplexRef = REF.Ifc2x3_Duplex_Architecture;
// every STEP element is a row except IfcOpeningElement (not an importer element class; TASK-002)
const NOT_ROWS = ["IfcOpeningElement"];
const rowsByKategorie = (byKategorie) =>
  Object.fromEntries(Object.entries(byKategorie).filter(([k]) => !NOT_ROWS.includes(k)));
const sum = (byKategorie) => Object.values(byKategorie).reduce((a, b) => a + b, 0);
const FZK_ROWS_BY_KATEGORIE = rowsByKategorie(fzkRef.elementsInStepTextByKategorie);
const FZK_TOTAL = sum(FZK_ROWS_BY_KATEGORIE);
const DUPLEX_ROWS_BY_KATEGORIE = rowsByKategorie(duplexRef.elementsInStepTextByKategorie);
const DUPLEX_TOTAL = sum(DUPLEX_ROWS_BY_KATEGORIE);
const GROUND = fzkRef.filters["REQ-004-AC2"].groundFloorStorey.Name;
const TOP = fzkRef.storeys.find((s) => s.Name !== GROUND).Name;

test.describe.configure({ timeout: 120_000 });

async function shot(page, name) {
  const dir = process.env.CV_SHOT_DIR;
  if (!dir || test.info().project.name !== "http") return;
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, name + ".png") });
}

const status = (page) => page.locator("#cv-status");
const de = (n) => n.toLocaleString("de-DE");

test("@e2e @acceptance @REQ-003-AC3 a new configuration shows the filter sets Kategorie, Geschoss, Material in this order", async ({
  page,
}) => {
  const errors = await openBuilder(page);
  await expect(status(page)).toHaveText("0 von 0 Elementen");
  await loadFiles(page, FZK);
  expect(await setTitles(page)).toEqual(["Kategorie", "Geschoss", "Material"]);
  expect(await page.evaluate(() => window.__calc.filter.sets.map((s) => s.key))).toEqual([
    "Kategorie",
    "Geschoss",
    "Material",
  ]);
  // counts from facetCounts equal the reference counts; (leer) is the last value
  expect(await shownCounts(page, "Kategorie")).toEqual(FZK_ROWS_BY_KATEGORIE);
  const geschoss = await shownValues(page, "Geschoss");
  expect(geschoss.at(-1).label).toBe("(leer)");
  expect(
    geschoss
      .map((v) => v.label)
      .slice(0, -1)
      .sort(),
  ).toEqual(fzkRef.storeys.map((s) => s.Name).sort());
  await expect(status(page)).toHaveText(`${de(FZK_TOTAL)} von ${de(FZK_TOTAL)} Elementen`);
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-003-AC1 catalogue search `Length` adds `BaseQuantities.Length` at the bottom", async ({
  page,
}) => {
  await openBuilder(page);
  await loadFiles(page, FZK);
  await page.locator("#cv-add-filterset").click();
  const dialog = page.getByRole("dialog", { name: "Filtersatz hinzufügen" });
  await expect(dialog).toBeVisible();
  // grouped: Allgemein first, then pset names; every entry with its element count
  const groups = await dialog.locator(".cv-cat-group:not([hidden])").allTextContents();
  expect(groups[0]).toBe("Allgemein");
  const catalog = await page.evaluate(() => window.__calc.catalog);
  const firstPset = catalog.find((e) => e.group !== "Allgemein").group;
  expect(groups[1]).toBe(firstPset);
  const kategorie = dialog.locator('.cv-cat-entry[data-key="Kategorie"]');
  await expect(kategorie).toBeDisabled(); // already a filter set
  await expect(kategorie.locator(".cv-cat-count")).toHaveText(de(FZK_TOTAL));

  await dialog.getByRole("searchbox", { name: "Eigenschaft suchen" }).fill("Length");
  const entry = dialog.locator('.cv-cat-entry[data-key="BaseQuantities.Length"]');
  await expect(entry).toBeVisible();
  // reference: elements carrying BaseQuantities.Length (STEP text), restricted to the classes listed as rows
  const lengthCarriers = rowsByKategorie(fzkRef.propertyCarriers["BaseQuantities.Length"].byKategorie);
  const expectedCount = sum(lengthCarriers);
  expect(expectedCount).toBeGreaterThan(0);
  await expect(entry.locator(".cv-cat-count")).toHaveText(de(expectedCount));
  const found = await dialog.locator(".cv-cat-entry:not([hidden])").evaluateAll((n) => n.map((e) => e.dataset.key));
  expect(found).toContain("BaseQuantities.Length");
  for (const key of found) expect(key.toLowerCase()).toContain("length");
  await shot(page, "01-catalogue-search-length");
  await entry.click();
  await expect(dialog).toBeHidden();

  expect(await setTitles(page)).toEqual(["Kategorie", "Geschoss", "Material", "BaseQuantities.Length"]);
  const set = filterSet(page, "BaseQuantities.Length");
  await expect(set.locator(".cv-fs-unit")).toHaveText("(m)");
  const values = await shownValues(page, "BaseQuantities.Length");
  expect(values.length).toBeGreaterThan(1);
  expect(values.reduce((n, v) => n + v.count, 0)).toBe(FZK_TOTAL); // single-valued: every row counted once
  expect(values.at(-1)).toEqual({ label: "(leer)", count: FZK_TOTAL - expectedCount, checked: false });

  // Escape and the close button dismiss the dialog without adding anything
  await page.locator("#cv-add-filterset").click();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.locator("#cv-add-filterset").click();
  await dialog.getByRole("button", { name: "Schließen" }).click();
  await expect(dialog).toBeHidden();
  expect(await setTitles(page)).toHaveLength(4);
});

test("@e2e @acceptance @REQ-003-AC2 move up/down (buttons and drag and drop), collapse and remove filter sets", async ({
  page,
}) => {
  await openBuilder(page);
  await loadFiles(page, FZK);
  const configOrder = () => page.evaluate(() => window.__calc.filter.sets.map((s) => s.key));

  await page.getByRole("button", { name: "Filtersatz nach unten: Kategorie" }).click();
  expect(await setTitles(page)).toEqual(["Geschoss", "Kategorie", "Material"]);
  expect(await configOrder()).toEqual(["Geschoss", "Kategorie", "Material"]);
  await page.getByRole("button", { name: "Filtersatz nach oben: Material" }).click();
  expect(await setTitles(page)).toEqual(["Geschoss", "Material", "Kategorie"]);
  await expect(page.getByRole("button", { name: "Filtersatz nach oben: Geschoss" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Filtersatz nach unten: Kategorie" })).toBeDisabled();

  // drag and drop: Kategorie onto the upper half of Geschoss -> first
  await filterSet(page, "Kategorie")
    .locator(".cv-fs-head")
    .dragTo(filterSet(page, "Geschoss").locator(".cv-fs-head"), { targetPosition: { x: 60, y: 3 } });
  expect(await setTitles(page)).toEqual(["Kategorie", "Geschoss", "Material"]);
  expect(await configOrder()).toEqual(["Kategorie", "Geschoss", "Material"]);
  // drag Kategorie below Material (lower half of the last set, collapsed so it fits the panel) -> last
  await page.getByRole("button", { name: "Filtersatz einklappen: Material" }).click();
  const material = filterSet(page, "Material");
  const box = await material.boundingBox();
  await filterSet(page, "Kategorie")
    .locator(".cv-fs-head")
    .dragTo(material, { targetPosition: { x: 60, y: box.height - 4 } });
  expect(await setTitles(page)).toEqual(["Geschoss", "Material", "Kategorie"]);

  // collapse: values hidden, state in the configuration; expand again
  await toggleValue(page, "Kategorie", "IfcSlab");
  await page.getByRole("button", { name: "Filtersatz einklappen: Kategorie" }).click();
  await expect(filterSet(page, "Kategorie").locator(".cv-fs-body")).toBeHidden();
  await expect(filterSet(page, "Kategorie").locator(".cv-fs-badge")).toHaveText("1");
  expect(await page.evaluate(() => window.__calc.filter.sets.find((s) => s.key === "Kategorie").collapsed)).toBe(true);
  await page.getByRole("button", { name: "Filtersatz ausklappen: Kategorie" }).click();
  await expect(filterSet(page, "Kategorie").locator(".cv-fs-body")).toBeVisible();
  expect(await page.evaluate(() => window.__calc.filter.sets.find((s) => s.key === "Kategorie").collapsed)).toBe(false);

  // remove: the set and its filter are gone
  expect(await page.evaluate(() => window.__calc.filter.count)).toBe(fzkRef.elementsInStepTextByKategorie.IfcSlab);
  await page.getByRole("button", { name: "Filtersatz entfernen: Kategorie" }).click();
  expect(await setTitles(page)).toEqual(["Geschoss", "Material"]);
  expect(await configOrder()).toEqual(["Geschoss", "Material"]);
  expect(await page.evaluate(() => window.__calc.filter.count)).toBe(FZK_TOTAL);
  await expect(status(page)).toHaveText(`${de(FZK_TOTAL)} von ${de(FZK_TOTAL)} Elementen`);
});

test("@e2e @acceptance @REQ-003-AC2 dragging a set near the panel edge scrolls the filter panel to a target out of view", async ({
  page,
}) => {
  await openBuilder(page);
  await loadFiles(page, FZK);
  await addFilterSet(page, "Name", "Name");
  await addFilterSet(page, "Typ", "Typ");
  await addFilterSet(page, "Length", "BaseQuantities.Length");
  const panel = page.locator("#cv-filters");
  const metrics = () =>
    panel.evaluate((n) => ({ top: n.scrollTop, height: n.clientHeight, scrollHeight: n.scrollHeight }));
  const m0 = await metrics();
  expect(m0.top).toBe(0);
  expect(m0.scrollHeight, "the sets overflow the panel").toBeGreaterThan(m0.height + 200);
  const panelBox = await panel.boundingBox();
  const target = filterSet(page, "BaseQuantities.Length");
  const outOfView = async () => (await target.boundingBox()).y > panelBox.y + panelBox.height;
  expect(await outOfView(), "target below the visible part of the panel").toBe(true);

  // drag Kategorie (first) with real pointer moves; hold it near the bottom edge until the target is in view
  const source = await filterSet(page, "Kategorie").locator(".cv-fs-head").boundingBox();
  await page.mouse.move(source.x + 60, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + 60, source.y + source.height / 2 + 20, { steps: 4 });
  const x = panelBox.x + 140;
  const edgeY = panelBox.y + panelBox.height - 10;
  const t0 = Date.now();
  let wiggle = 0;
  for (;;) {
    await page.mouse.move(x + (wiggle++ % 2), edgeY); // dragover events keep the auto-scroll going
    const box = await target.boundingBox();
    if (box.y + box.height <= panelBox.y + panelBox.height - 12) break;
    expect(Date.now() - t0, "panel scrolls while dragging near the bottom edge").toBeLessThan(15_000);
    await page.waitForTimeout(50);
  }
  expect((await metrics()).top).toBeGreaterThan(0);
  // drop on the lower half of the target: Kategorie becomes last
  const box = await target.boundingBox();
  await page.mouse.move(x, box.y + box.height - 6, { steps: 3 });
  await page.mouse.move(x + 1, box.y + box.height - 6);
  await page.mouse.up();
  const order = ["Geschoss", "Material", "Name", "Typ", "BaseQuantities.Length", "Kategorie"];
  expect(await page.evaluate(() => window.__calc.filter.sets.map((s) => s.key))).toEqual(order);
  await expect(page.locator(".cv-fs.cv-dragging, .cv-fs.cv-drop-before, .cv-fs.cv-drop-after")).toHaveCount(0);

  // near the top edge it scrolls back up
  const head = await filterSet(page, "Kategorie").locator(".cv-fs-head").boundingBox();
  await page.mouse.move(head.x + 60, head.y + head.height / 2);
  await page.mouse.down();
  await page.mouse.move(head.x + 60, head.y + head.height / 2 - 20, { steps: 4 });
  const before = (await metrics()).top;
  const t1 = Date.now();
  for (;;) {
    await page.mouse.move(x + (wiggle++ % 2), panelBox.y + 8);
    if ((await metrics()).top < before - 100) break;
    expect(Date.now() - t1, "panel scrolls up while dragging near the top edge").toBeLessThan(15_000);
    await page.waitForTimeout(50);
  }
  await page.keyboard.press("Escape"); // cancel the drag: order unchanged
  await page.mouse.up();
  expect(await page.evaluate(() => window.__calc.filter.sets.map((s) => s.key))).toEqual(order);
});

test("@e2e @acceptance @REQ-004-AC1 @REQ-004-AC2 @REQ-004-AC3 @REQ-004-AC4 checking values filters the rows (filter sets)", async ({
  page,
}) => {
  await openBuilder(page);
  await loadFiles(page, FZK);
  const ac1 = fzkRef.filters["REQ-004-AC1"];
  const ac2 = fzkRef.filters["REQ-004-AC2"];

  // AC1: Kategorie = IfcWallStandardCase OR IfcSlab
  for (const k of ac1.filter.Kategorie) await toggleValue(page, "Kategorie", k);
  expect(await filteredGuids(page)).toEqual([...ac1.expectedGlobalIds].sort());
  await expect(status(page)).toHaveText(`${de(ac1.expectedCount)} von ${de(FZK_TOTAL)} Elementen`);
  // checking never hides the other values of the same set; header shows the checked count
  expect(await shownCounts(page, "Kategorie")).toEqual(FZK_ROWS_BY_KATEGORIE);
  await expect(filterSet(page, "Kategorie").locator(".cv-fs-badge")).toHaveText("2");

  // AC2: additionally the ground-floor storey
  await toggleValue(page, "Geschoss", GROUND);
  expect(await filteredGuids(page)).toEqual([...ac2.expectedGlobalIds].sort());
  await expect(status(page)).toHaveText(`${de(ac2.expectedCount)} von ${de(FZK_TOTAL)} Elementen`);
  const kategorieClasses = new Set(Object.keys(FZK_ROWS_BY_KATEGORIE));
  const expected = { ...ac2.kategorieCountsOnGroundFloor };
  for (const [k, n] of Object.entries(ac2.kategorieCountsOnGroundFloorConditional))
    if (kategorieClasses.has(k)) expected[k] = n;
  expect(await shownCounts(page, "Kategorie")).toEqual(expected);
  const checked = (await shownValues(page, "Kategorie")).filter((v) => v.checked).map((v) => v.label);
  expect(checked.sort()).toEqual([...ac2.filter.Kategorie].sort());
  await shot(page, "02-filters-active-ac2");

  // AC3: IfcStair (only on the ground floor) and IfcSlab checked, then the storey changes to the top floor: IfcStair
  // has 0 hits there but stays visible and checked with count 0
  await page.getByRole("button", { name: "Auswahl zurücksetzen: Kategorie" }).click();
  await page.getByRole("button", { name: "Auswahl zurücksetzen: Geschoss" }).click();
  expect(ac2.kategorieCountsOnGroundFloor.IfcStair).toBe(fzkRef.elementsInStepTextByKategorie.IfcStair);
  await toggleValue(page, "Kategorie", "IfcStair");
  await toggleValue(page, "Kategorie", "IfcSlab");
  await toggleValue(page, "Geschoss", TOP);
  const kat = await shownValues(page, "Kategorie");
  expect(kat.find((v) => v.label === "IfcStair")).toEqual({ label: "IfcStair", count: 0, checked: true });
  expect(kat.find((v) => v.label === "IfcSlab").checked).toBe(true);
  for (const v of kat) if (!v.checked) expect(v.count, `${v.label} shown with hits only`).toBeGreaterThan(0);
  const shown = await page.evaluate(() => {
    const byKey = new Map(window.__calc.rows.map((r) => [r.key, r.values]));
    return window.__calc.filter.keys.map((k) => byKey.get(k));
  });
  const slabsOnTop = fzkRef.elementsByGeschossAndKategorie[TOP].IfcSlab; // reference, STEP text
  expect(slabsOnTop).toBeGreaterThan(0);
  expect(shown.length).toBe(slabsOnTop);
  expect(kat.find((v) => v.label === "IfcSlab").count).toBe(slabsOnTop);
  for (const v of shown) expect([v.Kategorie, v.Geschoss]).toEqual(["IfcSlab", TOP]);
  await expect(status(page)).toHaveText(`${de(shown.length)} von ${de(FZK_TOTAL)} Elementen`);
  await shot(page, "03-checked-zero-ac3");

  // AC4: Alle Filter zuruecksetzen clears every value; every element passes again
  await page.getByRole("button", { name: "Alle Filter zurücksetzen" }).click();
  for (const key of ["Kategorie", "Geschoss", "Material"])
    expect((await shownValues(page, key)).filter((v) => v.checked)).toEqual([]);
  expect(await page.evaluate(() => window.__calc.filter.active)).toEqual([]);
  expect(await page.evaluate(() => window.__calc.filter.keys.length)).toBe(FZK_TOTAL);
  expect(await shownCounts(page, "Kategorie")).toEqual(FZK_ROWS_BY_KATEGORIE);
  await expect(status(page)).toHaveText(`${de(FZK_TOTAL)} von ${de(FZK_TOTAL)} Elementen`);
  await expect(page.getByRole("button", { name: "Alle Filter zurücksetzen" })).toBeDisabled();
});

test("@e2e @acceptance @REQ-001-AC1 two models: a filter set `Modell` lists both names with their element counts", async ({
  page,
}) => {
  await openBuilder(page);
  await loadFiles(page, [FZK, DUPLEX]);
  expect(await page.evaluate(() => window.__calc.modelCount)).toBe(2);
  await addFilterSet(page, "Modell", "Modell");
  // both counts are reference values (STEP text, scripts/ref): rows = STEP elements minus IfcOpeningElement
  expect(await shownCounts(page, "Modell")).toEqual({
    "AC20-FZK-Haus": FZK_TOTAL,
    Ifc2x3_Duplex_Architecture: DUPLEX_TOTAL,
  });
  await expect(page.locator("#cv-status-models")).toHaveText("2 Modelle");
  const total = FZK_TOTAL + DUPLEX_TOTAL;
  await expect(status(page)).toHaveText(`${de(total)} von ${de(total)} Elementen`);
  await toggleValue(page, "Modell", "AC20-FZK-Haus");
  await expect(status(page)).toHaveText(`${de(FZK_TOTAL)} von ${de(total)} Elementen`);
  expect(await shownCounts(page, "Kategorie")).toEqual(FZK_ROWS_BY_KATEGORIE);
  await toggleValue(page, "Modell", "AC20-FZK-Haus");
  await toggleValue(page, "Modell", "Ifc2x3_Duplex_Architecture");
  await expect(status(page)).toHaveText(`${de(DUPLEX_TOTAL)} von ${de(total)} Elementen`);
  expect(await shownCounts(page, "Kategorie")).toEqual(DUPLEX_ROWS_BY_KATEGORIE);
  await shot(page, "04-two-models-modell-set");
});

test("@e2e @UI screen layout: header, filter area ~280 px, details ~320 px collapsible, splitter 55/45, status line, colours", async ({
  page,
}) => {
  await openBuilder(page);
  const header = page.locator(".cv-header");
  await expect(header.locator("#cv-logo")).toBeVisible();
  await expect(header.locator("#cv-title")).toHaveText("Calc Viewer Builder");
  await expect(header.locator("#cv-date")).toHaveText(new Date().toLocaleDateString("de-DE"));
  for (const name of ["IFC laden", "Konfiguration speichern", "Konfiguration laden", "HTML exportieren"])
    await expect(header.getByRole("button", { name, exact: true })).toBeVisible();
  await expect(page.locator("#cv-add-filterset")).toHaveText("Filtersatz");
  await expect(page.getByRole("button", { name: "+ Filtersatz" })).toBeVisible();
  await expect(page.locator("#cv-status")).toHaveText("0 von 0 Elementen");
  // empty filter sets before a model is loaded
  expect(await setTitles(page)).toEqual(["Kategorie", "Geschoss", "Material"]);
  await expect(filterSet(page, "Kategorie").locator(".cv-fs-empty")).toHaveText("Keine Werte.");

  const width = (sel) => page.locator(sel).evaluate((n) => n.getBoundingClientRect().width);
  expect(await width("#cv-filters")).toBe(280);
  expect(await width("#cv-details")).toBe(320);
  const height = (sel) => page.locator(sel).evaluate((n) => n.getBoundingClientRect().height);
  const share = async () => {
    const v = await height("#cv-viewport");
    return v / (v + (await height("#cv-table")));
  };
  expect(await share()).toBeCloseTo(0.55, 2);

  // splitter: drag to ~30 %, then keyboard +5
  const center = await page.locator("#cv-center").boundingBox();
  const split = await page.locator("#cv-splitter").boundingBox();
  await page.mouse.move(split.x + split.width / 2, split.y + split.height / 2);
  await page.mouse.down();
  await page.mouse.move(split.x + split.width / 2, center.y + center.height * 0.3, { steps: 5 });
  await page.mouse.up();
  expect(await share()).toBeCloseTo(0.3, 1);
  await page.locator("#cv-splitter").press("ArrowDown");
  expect(await page.evaluate(() => window.__calc.layout.split)).toBeCloseTo(35, 0);

  // details collapsible
  await page.getByRole("button", { name: "Details einklappen" }).click();
  expect(await width("#cv-details")).toBe(40);
  expect(await page.evaluate(() => window.__calc.layout.detailsCollapsed)).toBe(true);
  await page.getByRole("button", { name: "Details ausklappen" }).click();
  expect(await width("#cv-details")).toBe(320);

  // light reference style (UI-02): colour tokens, font
  const tokens = await page.evaluate(() => {
    const css = getComputedStyle(document.documentElement);
    const names = ["accent", "ink", "ink-2", "muted", "faint", "bg", "bg-3d", "line"];
    return Object.fromEntries(
      names.map((n) => [
        n,
        css
          .getPropertyValue("--cv-" + n)
          .trim()
          .toLowerCase(),
      ]),
    );
  });
  expect(tokens).toEqual({
    accent: "#d72622",
    ink: "#35383a",
    "ink-2": "#4e5355",
    muted: "#6b6f73",
    faint: "#a4a8ac",
    bg: "#f4f5f6",
    "bg-3d": "#eceef0",
    line: "#e1e3e5",
  });
  const body = await page.evaluate(() => {
    const s = getComputedStyle(document.body);
    return { font: s.fontFamily, size: s.fontSize, bg: s.backgroundColor, color: s.color };
  });
  expect(body.font).toContain("Segoe UI");
  expect(body.size).toBe("14px");
  expect(body.bg).toBe("rgb(244, 245, 246)");
  expect(body.color).toBe("rgb(53, 56, 58)");
  expect(await page.locator("#cv-viewport").evaluate((n) => getComputedStyle(n).backgroundColor)).toBe(
    "rgb(236, 238, 240)",
  );
  await expect(page.locator("#cv-load")).toHaveCSS("background-color", "rgb(215, 38, 34)");
});

/** Pixels [r, g, b] of a PNG, decoded in the page (no image library in the test tooling). */
function pixelsOf(page, png) {
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, img.height).data;
    const out = [];
    for (let i = 0; i < data.length; i += 4) out.push([data[i], data[i + 1], data[i + 2]]);
    return out;
  }, png.toString("base64"));
}

test("@e2e @UI data text keeps its characters (no calt/liga); search clear button in the UI-02 muted ink", async ({
  page,
}) => {
  await openBuilder(page);
  await loadFiles(page, FZK);
  await addFilterSet(page, "Name", "Name");
  // V1: contextual alternates and ligatures off on every kind of data text
  for (const sel of [
    ".cv-fs-label",
    ".cv-fs-title",
    ".cv-model-name",
    ".cv-search input",
    "#cv-table",
    "#cv-details .cv-details-body",
  ]) {
    const style = await page
      .locator(sel)
      .first()
      .evaluate((n) => {
        const s = getComputedStyle(n);
        return { features: s.fontFeatureSettings, ligatures: s.fontVariantLigatures };
      });
    expect(style, sel).toEqual({ features: '"calt" 0, "liga" 0', ligatures: "none" });
  }
  await page.locator("#cv-add-filterset").click();
  const dialog = page.getByRole("dialog", { name: "Filtersatz hinzufügen" });
  for (const sel of [".cv-cat-name", ".cv-cat-group"])
    expect(
      await dialog
        .locator(sel)
        .first()
        .evaluate((n) => getComputedStyle(n).fontFeatureSettings),
      sel,
    ).toBe('"calt" 0, "liga" 0');
  await page.keyboard.press("Escape");

  // V2: the clear button of a search field (shown once it has text) is drawn in grey ink, not the Chromium blue
  const search = filterSet(page, "Name").locator(".cv-search");
  await search.getByRole("searchbox").fill("2x3");
  await search.getByRole("searchbox").focus();
  const box = await search.boundingBox();
  const png = await page.screenshot({
    clip: { x: box.x + box.width - 28, y: box.y + 4, width: 24, height: box.height - 8 },
  });
  if (process.env.CV_SHOT_DIR) await search.screenshot({ path: join(process.env.CV_SHOT_DIR, "08-search-clear.png") });
  const ink = (await pixelsOf(page, png)).filter(([r, g, b]) => Math.min(r, g, b) < 200);
  expect(ink.length, "clear button drawn").toBeGreaterThan(10);
  for (const [r, g, b] of ink)
    expect(Math.max(r, g, b) - Math.min(r, g, b), `grey pixel ${r},${g},${b}`).toBeLessThan(24);
  const darkest = Math.min(...ink.map(([r, g, b]) => r + g + b));
  expect(darkest / 3, "muted ink (#6b6f73), not black").toBeGreaterThan(0x5a);
  await search.getByRole("searchbox").fill("");
});

test("@e2e @UI the builder with FZK loaded and filters active (screenshots for review)", async ({ page }) => {
  await openBuilder(page);
  await loadFiles(page, FZK);
  await page.waitForFunction(() => window.__calc.modelCount === 1);
  await shot(page, "05-fzk-loaded");
  await toggleValue(page, "Kategorie", "IfcWindow");
  await toggleValue(page, "Kategorie", "IfcDoor");
  await addFilterSet(page, "Name", "Name");
  await filterSet(page, "Name").getByRole("searchbox").fill("fenster");
  await expect(status(page)).toHaveText(
    `${de(FZK_ROWS_BY_KATEGORIE.IfcWindow + FZK_ROWS_BY_KATEGORIE.IfcDoor)} von ${de(FZK_TOTAL)} Elementen`,
  );
  await shot(page, "06-fzk-filters-active");
  await page.getByRole("button", { name: "Details einklappen" }).click();
  await shot(page, "07-details-collapsed");
});
