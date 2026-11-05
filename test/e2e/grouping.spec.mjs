// TASK-006b grouping view (spec REQ-006-AC2/AC3/AC5 (groups)/AC7/AC8/AC10, DEC-16, ASM-008). The table is read from
// the DOM (every shown row collected by scrolling the virtualised body, the sticky total row `Summe`), unrounded sums
// from window.__calc.table (display / total). Expected counts, sums and common values come from
// test/fixtures/reference-values.json (sections REQ-006-grouping-fzk / -duplex, STEP-text derivation).
import { test, expect } from "../support/network-guard.mjs";
import { REF, expectClose, fixture, loadFiles, openBuilder } from "../support/builder.mjs";
import { shownCounts, toggleValue } from "../support/filter-area.mjs";
import { csvNumber, exportFile, readExport } from "../support/export.mjs";
import { isolateTogether, panelAction } from "../support/tools.mjs";
import { idle, keysOfGuids, viewState } from "../support/view-3d.mjs";
import { addColumn, allTableRows, clickSort, de3, header, headerKeys, tableState } from "../support/table.mjs";
import {
  COUNT_COLUMN,
  GROUP_COLUMN,
  allDisplayRows,
  deCount,
  groupingState,
  nest,
  pickGroup,
  setView,
  toggleGroup,
  totalRow,
} from "../support/grouping.mjs";

const FZK = fixture("AC20-FZK-Haus.ifc");
const DUPLEX = fixture("Ifc2x3_Duplex_Architecture.ifc");
const fzkGroups = REF["REQ-006-grouping-fzk"];
const duplexGroups = REF["REQ-006-grouping-duplex"];
const NOT_ROWS = ["IfcOpeningElement"]; // STEP classes the extractor does not list as rows (TASK-002)
const VOLUME = fzkGroups.column; // BaseQuantities.NetVolume
const DUPLEX_VOLUME = duplexGroups.column; // PSet_Revit_Dimensions.Volume
const EMPTY = "(leer)";
const COLLATOR = new Intl.Collator("de");
/** Group order of the product without a sort: values alphabetically (German collation), "(leer)" last. */
const valueOrder = (labels) =>
  [...labels].sort((a, b) => (a === EMPTY) - (b === EMPTY) || COLLATOR.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0));
const sumOf = (xs) => {
  const nums = xs.filter((x) => typeof x === "number");
  return nums.length ? nums.reduce((a, b) => a + b, 0) : null;
};
const sumText = (x) => (x === null ? "" : de3(x));

/** Expected level-1 groups of FZK by Kategorie (row classes only), each with its Geschoss sub-groups. */
const FZK_KATEGORIEN = Object.fromEntries(
  Object.entries(fzkGroups.byKategorie).filter(([kat]) => !NOT_ROWS.includes(kat)),
);
const FZK_TOTAL = Object.values(FZK_KATEGORIEN).reduce((a, g) => a + g.count, 0);
const FZK_VOLUME_TOTAL = sumOf(Object.values(FZK_KATEGORIEN).map((g) => g.volume));

test.describe.configure({ timeout: 180_000 });

async function openWith(page, files) {
  const errors = await openBuilder(page);
  await loadFiles(page, files);
  await idle(page);
  return errors;
}

/** Unrounded cells of the shown group rows from the hook: [{ level, label, parent, count, cells }]. */
function hookGroups(page) {
  return page.evaluate(() => {
    let parent = null;
    return window.__calc.table.display
      .filter((r) => r.type === "group")
      .map((r) => {
        if (r.level === 1) parent = r.label;
        return {
          level: r.level,
          label: r.label,
          parent: r.level === 2 ? parent : null,
          count: r.count,
          cells: r.cells,
        };
      });
  });
}

test("@e2e @acceptance @REQ-006-AC2 @REQ-006-AC8 grouping by Kategorie then Geschoss: counts and volume sums per group and sub-group, sub-rows add up, total row", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  await setView(page, "Gruppiert");
  expect(await groupingState(page)).toEqual({ view: "grouped", groupBy: ["Kategorie"] });
  await addColumn(page, "NetVolume", VOLUME);
  await pickGroup(page, 2, "Geschoss", "Geschoss");
  expect(await groupingState(page)).toEqual({ view: "grouped", groupBy: ["Kategorie", "Geschoss"] });
  await expect(page.locator("#cv-group-1")).toHaveText("Gruppe 1: Kategorie");
  await expect(page.locator("#cv-group-2")).toHaveText("Gruppe 2: Geschoss");
  expect(await headerKeys(page)).toEqual([
    GROUP_COLUMN,
    COUNT_COLUMN,
    "Modell",
    "Kategorie",
    "Name",
    "Geschoss",
    VOLUME,
  ]);
  await expect(header(page, GROUP_COLUMN)).toHaveText("Gruppe");
  await expect(header(page, COUNT_COLUMN)).toHaveText("Anzahl");

  // collapsed: one row per Kategorie in value order with count and volume sum
  const collapsed = await allDisplayRows(page);
  const kats = valueOrder(Object.keys(FZK_KATEGORIEN));
  expect(collapsed.map((r) => r.cells[GROUP_COLUMN])).toEqual(kats);
  for (const row of collapsed) {
    const ref = FZK_KATEGORIEN[row.cells[GROUP_COLUMN]];
    expect(row).toMatchObject({ type: "group", level: 1, expanded: false });
    expect(row.cells[COUNT_COLUMN], row.cells[GROUP_COLUMN]).toBe(deCount(ref.count));
    expect(row.cells[VOLUME], row.cells[GROUP_COLUMN]).toBe(sumText(ref.volume));
  }

  // all expanded: each Kategorie row has its Geschoss sub-rows ("(leer)" last) with count and volume
  await page.getByRole("button", { name: "Alle aufklappen" }).click();
  await expect.poll(async () => (await allDisplayRows(page)).length).toBeGreaterThan(FZK_TOTAL);
  const nested = nest(await allDisplayRows(page));
  expect(nested.map((g) => g.cells[GROUP_COLUMN])).toEqual(kats);
  const raw = await hookGroups(page);
  for (const g1 of nested) {
    const kat = g1.cells[GROUP_COLUMN];
    const ref = FZK_KATEGORIEN[kat];
    expect(
      g1.children.map((g) => g.cells[GROUP_COLUMN]),
      kat,
    ).toEqual(valueOrder(Object.keys(ref.byGeschoss)));
    for (const g2 of g1.children) {
      const sub = ref.byGeschoss[g2.cells[GROUP_COLUMN]];
      expect(g2.level).toBe(2);
      expect(g2.cells[COUNT_COLUMN], `${kat} / ${g2.cells[GROUP_COLUMN]}`).toBe(deCount(sub.count));
      expect(g2.cells[VOLUME], `${kat} / ${g2.cells[GROUP_COLUMN]}`).toBe(sumText(sub.volume));
      expect(g2.elements.length).toBe(sub.count);
    }
    // single-valued grouping properties: the sub-rows add up to the parent row (counts and unrounded sums)
    const parent = raw.find((r) => r.level === 1 && r.label === kat);
    const children = raw.filter((r) => r.level === 2 && r.parent === kat);
    expect(children.reduce((a, r) => a + r.count, 0)).toBe(parent.count);
    if (ref.volume === null) expect(parent.cells[VOLUME]).toBeNull();
    else {
      expectClose(parent.cells[VOLUME], ref.volume, `${kat} volume`);
      expectClose(sumOf(children.map((r) => r.cells[VOLUME])), parent.cells[VOLUME], `${kat} sub-rows`);
    }
    for (const child of children) {
      const sub = ref.byGeschoss[child.label];
      if (sub.volume === null) expect(child.cells[VOLUME]).toBeNull();
      else expectClose(child.cells[VOLUME], sub.volume, `${kat} / ${child.label}`);
    }
  }

  // REQ-006-AC8: total row = number of filtered elements and the volume sum over them
  expect(await totalRow(page)).toMatchObject({
    [GROUP_COLUMN]: "Summe",
    [COUNT_COLUMN]: deCount(FZK_TOTAL),
    [VOLUME]: sumText(FZK_VOLUME_TOTAL),
    Name: "",
  });
  const total = await page.evaluate(() => window.__calc.table.total);
  expect(total.count).toBe(FZK_TOTAL);
  expectClose(total.cells[VOLUME], FZK_VOLUME_TOTAL, "total volume");
  await expect(page.locator("#cv-status")).toHaveText(`${deCount(FZK_TOTAL)} von ${deCount(FZK_TOTAL)} Elementen`);
  // the total row stays visible at the bottom of the scroll box (sticky)
  const visible = await page.evaluate(() => {
    const box = document.getElementById("cv-tbl-scroll").getBoundingClientRect();
    const foot = document.getElementById("cv-tbl-total").getBoundingClientRect();
    return foot.top >= box.top && foot.bottom <= box.bottom + 1;
  });
  expect(visible).toBe(true);

  // REQ-006-AC8 under a filter: Kategorie = wall, slab -> only those groups; total = their elements and volume
  await toggleValue(page, "Kategorie", "IfcWallStandardCase");
  await toggleValue(page, "Kategorie", "IfcSlab");
  const filtered = ["IfcSlab", "IfcWallStandardCase"];
  const fRows = nest(await allDisplayRows(page));
  expect(fRows.map((g) => g.cells[GROUP_COLUMN])).toEqual(valueOrder(filtered));
  const fCount = filtered.reduce((a, k) => a + FZK_KATEGORIEN[k].count, 0);
  const fVolume = sumOf(filtered.map((k) => FZK_KATEGORIEN[k].volume));
  expect(await totalRow(page)).toMatchObject({ [COUNT_COLUMN]: deCount(fCount), [VOLUME]: sumText(fVolume) });
  expectClose((await page.evaluate(() => window.__calc.table.total)).cells[VOLUME], fVolume, "filtered total");
  await expect(page.locator("#cv-status")).toHaveText(`${deCount(fCount)} von ${deCount(FZK_TOTAL)} Elementen`);
  // the expanded state is kept across the filter change (Alle aufklappen still applies)
  expect(fRows.every((g) => g.expanded && g.children.length > 0)).toBe(true);
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-006-AC3 a group expanded to single elements shows them indented under it; level 2 one step deeper", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  await setView(page, "Gruppiert");
  const walls = FZK_KATEGORIEN.IfcWallStandardCase;
  const wallSlabGuids = REF["AC20-FZK-Haus"].filters["REQ-004-AC1"].expectedGlobalIds;

  // one level: expand IfcWallStandardCase -> its elements directly under it, indented
  await toggleGroup(page, ["IfcWallStandardCase"], true);
  let rows = await allDisplayRows(page);
  let at = rows.findIndex((r) => r.type === "group" && r.cells[GROUP_COLUMN] === "IfcWallStandardCase");
  const group = rows[at];
  expect(group.expanded).toBe(true);
  const elements = rows.slice(at + 1, at + 1 + walls.count);
  expect(elements.every((r) => r.type === "element" && r.depth === 1)).toBe(true);
  expect(rows[at + 1 + walls.count]).toMatchObject({ type: "group", level: 1 });
  expect(rows.filter((r) => r.type === "element").length).toBe(walls.count);
  for (const r of elements) {
    expect(r.cells.Kategorie).toBe("IfcWallStandardCase");
    expect(r.cells[GROUP_COLUMN]).toBe("");
    expect(r.cells[COUNT_COLUMN]).toBe("");
    expect(r.groupPad).toBeGreaterThan(group.groupPad); // indented under the group
  }
  const guids = await page.evaluate(
    (keys) => keys.map((k) => window.__calc.rows.find((r) => r.key === k).guid),
    elements.map((r) => r.key),
  );
  expect(guids.every((g) => wallSlabGuids.includes(g))).toBe(true);
  expect(new Set(guids).size).toBe(walls.count);
  // the element rows are real table rows: their Name cells are the elements' names (from the single view)
  await setView(page, "Einzelelemente");
  const single = new Map((await allTableRows(page)).map((r) => [r.key, r.cells]));
  expect(single.size).toBe(FZK_TOTAL);
  await setView(page, "Gruppiert");
  rows = await allDisplayRows(page);
  for (const r of rows.filter((x) => x.type === "element")) expect(r.cells.Name).toBe(single.get(r.key).Name);

  // collapse again
  await toggleGroup(page, ["IfcWallStandardCase"], false);
  rows = await allDisplayRows(page);
  expect(rows.every((r) => r.type === "group")).toBe(true);

  // two levels: a new grouping starts collapsed; wall -> Geschoss sub-groups (indented) -> elements (indented more)
  await pickGroup(page, 2, "Geschoss", "Geschoss");
  rows = await allDisplayRows(page);
  expect(rows.every((r) => r.type === "group" && r.level === 1 && !r.expanded)).toBe(true);
  await toggleGroup(page, ["IfcWallStandardCase"], true);
  await toggleGroup(page, ["IfcWallStandardCase", "Erdgeschoss"], true);
  rows = await allDisplayRows(page);
  at = rows.findIndex((r) => r.type === "group" && r.cells[GROUP_COLUMN] === "IfcWallStandardCase");
  const subs = valueOrder(Object.keys(walls.byGeschoss));
  expect(rows[at + 1]).toMatchObject({ type: "group", level: 2, cells: { [GROUP_COLUMN]: subs[0] }, expanded: false });
  const eg = rows.findIndex((r, i) => i > at && r.level === 2 && r.cells[GROUP_COLUMN] === "Erdgeschoss");
  const egCount = walls.byGeschoss.Erdgeschoss.count;
  const egElements = rows.slice(eg + 1, eg + 1 + egCount);
  expect(egElements.every((r) => r.type === "element" && r.depth === 2 && r.cells.Geschoss === "Erdgeschoss")).toBe(
    true,
  );
  expect(rows[at + 1].groupPad).toBeGreaterThan(rows[at].groupPad);
  expect(egElements[0].groupPad).toBeGreaterThan(rows[eg].groupPad);
  expect(rows.filter((r) => r.type === "element").length).toBe(egCount);
  // collapsing the parent hides sub-groups and elements; expanding it again keeps the sub-group expanded
  await toggleGroup(page, ["IfcWallStandardCase"], false);
  expect((await allDisplayRows(page)).every((r) => r.level === 1)).toBe(true);
  await toggleGroup(page, ["IfcWallStandardCase"], true);
  expect((await allDisplayRows(page)).filter((r) => r.type === "element").length).toBe(egCount);
  // Alle aufklappen / Alle zuklappen
  await page.getByRole("button", { name: "Alle aufklappen" }).click();
  await expect
    .poll(async () => (await allDisplayRows(page)).filter((r) => r.type === "element").length)
    .toBe(FZK_TOTAL);
  await page.getByRole("button", { name: "Alle zuklappen" }).click();
  await expect.poll(async () => (await allDisplayRows(page)).length).toBe(Object.keys(FZK_KATEGORIEN).length);
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-006-AC7 a text column shows its value on a group row only if it is the same for all elements of the group", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  await setView(page, "Gruppiert");
  const entries = Object.entries(FZK_KATEGORIEN);
  // A: equal Geschoss in all its elements; B: elements on different storeys (both with >= 2 elements)
  const [katA, refA] = entries.find(([, g]) => g.count >= 2 && g.common.Geschoss !== null);
  const [katB] = entries.find(
    ([, g]) => g.count >= 2 && g.common.Geschoss === null && Object.keys(g.byGeschoss).length >= 2,
  );
  const rows = await allDisplayRows(page);
  const row = (kat) => rows.find((r) => r.cells[GROUP_COLUMN] === kat);
  expect(row(katA).cells.Geschoss).toBe(refA.common.Geschoss);
  expect(row(katB).cells.Geschoss).toBe("");
  // every group row: Geschoss and Name equal-or-empty as the reference; Kategorie (the grouping) always shown
  for (const [kat, ref] of entries) {
    expect(row(kat).cells.Geschoss, kat).toBe(ref.common.Geschoss ?? "");
    expect(row(kat).cells.Name, kat).toBe(ref.common.Name ?? "");
    expect(row(kat).cells.Kategorie, kat).toBe(kat);
  }
  // a text column of the total row stays empty
  expect((await totalRow(page)).Geschoss).toBe("");
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-006-AC10 grouping by Material: an element with two materials is under both groups and counted in each; the total counts it once", async ({
  page,
}) => {
  const errors = await openWith(page, DUPLEX);
  await setView(page, "Gruppiert");
  await pickGroup(page, 1, "Material", "Material");
  await addColumn(page, "Dimensions.Volume", DUPLEX_VOLUME);
  const entry = await page.evaluate((k) => window.__calc.catalog.find((e) => e.key === k), DUPLEX_VOLUME);
  expect(entry).toMatchObject({ kind: "number", unit: "m³" });

  // expected groups: per material the row classes' counts and volume sums
  const expected = {};
  for (const [mat, byKat] of Object.entries(duplexGroups.byMaterial)) {
    const kats = Object.entries(byKat).filter(([k]) => !NOT_ROWS.includes(k));
    if (!kats.length) continue;
    expected[mat] = { count: kats.reduce((a, [, v]) => a + v.count, 0), volume: sumOf(kats.map(([, v]) => v.volume)) };
  }
  const totalKats = Object.entries(duplexGroups.totalByKategorie).filter(([k]) => !NOT_ROWS.includes(k));
  const total = totalKats.reduce((a, [, v]) => a + v.count, 0);
  const totalVolume = sumOf(totalKats.map(([, v]) => v.volume));

  const rows = await allDisplayRows(page);
  expect(rows.map((r) => r.cells[GROUP_COLUMN])).toEqual(valueOrder(Object.keys(expected)));
  for (const r of rows) {
    const ref = expected[r.cells[GROUP_COLUMN]];
    expect(r.cells[COUNT_COLUMN], r.cells[GROUP_COLUMN]).toBe(deCount(ref.count));
    expect(r.cells[DUPLEX_VOLUME], r.cells[GROUP_COLUMN]).toBe(sumText(ref.volume));
  }
  for (const g of await hookGroups(page)) {
    const ref = expected[g.label];
    if (ref.volume === null) expect(g.cells[DUPLEX_VOLUME]).toBeNull();
    else expectClose(g.cells[DUPLEX_VOLUME], ref.volume, g.label);
  }
  // total row: every element once, although the group counts add up to more
  const groupSum = Object.values(expected).reduce((a, g) => a + g.count, 0);
  expect(groupSum).toBeGreaterThan(total);
  expect(await totalRow(page)).toMatchObject({ [COUNT_COLUMN]: deCount(total), [DUPLEX_VOLUME]: sumText(totalVolume) });
  const hookTotal = await page.evaluate(() => window.__calc.table.total);
  expect(hookTotal.count).toBe(total);
  expectClose(hookTotal.cells[DUPLEX_VOLUME], totalVolume, "total volume");
  await expect(page.locator("#cv-status")).toHaveText(`${deCount(total)} von ${deCount(total)} Elementen`);

  // the two-material element of REQ-005-AC4 is an element row under both of its material groups
  const multi = REF["REQ-005-AC4"].element;
  expect(multi.Material.length).toBe(2);
  const [key] = await keysOfGuids(page, [multi.GlobalId]);
  for (const mat of multi.Material) await toggleGroup(page, [mat], true);
  const groups = nest(await allDisplayRows(page));
  for (const mat of multi.Material) {
    const g = groups.find((x) => x.cells[GROUP_COLUMN] === mat);
    expect(
      g.elements.map((e) => e.key),
      mat,
    ).toContain(key);
    expect(g.elements.length).toBe(expected[mat].count);
  }
  expect(groups.filter((g) => g.elements.some((e) => e.key === key)).length).toBe(2);
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-006-AC5 sorting a numeric column orders groups by their sums (empty sums last, `(leer)` last) and elements within a group", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  await setView(page, "Gruppiert");
  await pickGroup(page, 1, "Geschoss", "Geschoss");
  await addColumn(page, "NetVolume", VOLUME);
  // expected volume per storey from the reference (row classes only)
  const byGeschoss = {};
  for (const g of Object.values(FZK_KATEGORIEN))
    for (const [name, sub] of Object.entries(g.byGeschoss)) (byGeschoss[name] ??= []).push(sub.volume);
  const sums = Object.fromEntries(Object.entries(byGeschoss).map(([k, v]) => [k, sumOf(v)]));
  const named = Object.keys(sums).filter((k) => k !== EMPTY);
  const order = (dir) => {
    const withSum = named
      .filter((k) => sums[k] !== null)
      .sort((a, b) => (dir === "asc" ? sums[a] - sums[b] : sums[b] - sums[a]));
    const without = valueOrder(named.filter((k) => sums[k] === null));
    return [...withSum, ...without, ...(EMPTY in sums ? [EMPTY] : [])];
  };
  expect((await allDisplayRows(page)).map((r) => r.cells[GROUP_COLUMN])).toEqual(valueOrder(Object.keys(sums)));
  await clickSort(page, VOLUME);
  expect(await tableState(page)).toMatchObject({ sort: { key: VOLUME, dir: "asc" } });
  expect((await allDisplayRows(page)).map((r) => r.cells[GROUP_COLUMN])).toEqual(order("asc"));
  await clickSort(page, VOLUME);
  expect((await allDisplayRows(page)).map((r) => r.cells[GROUP_COLUMN])).toEqual(order("desc"));
  // elements within an expanded group follow the sort: volumes descending, empty last
  const first = order("desc")[0];
  await toggleGroup(page, [first], true);
  const elements = nest(await allDisplayRows(page)).find((g) => g.cells[GROUP_COLUMN] === first).elements;
  const values = await page.evaluate(
    ({ keys, key }) => keys.map((k) => window.__calc.rows.find((r) => r.key === k).values[key] ?? null),
    { keys: elements.map((e) => e.key), key: VOLUME },
  );
  const filled = values.filter((v) => v !== null);
  expect(filled.length).toBeGreaterThan(1);
  expect(values.slice(0, filled.length)).toEqual([...filled].sort((a, b) => b - a));
  expect(values.slice(filled.length).every((v) => v === null)).toBe(true);
  expect(errors).toEqual([]);
});

test("@e2e @REQ-006 switching views keeps columns, filters and grouping; columns move in the grouping view; 3D unchanged", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  await toggleValue(page, "Kategorie", "IfcDoor");
  const state3d = await viewState(page);
  await setView(page, "Gruppiert");
  expect(await page.getByRole("radio", { name: "Gruppiert" }).getAttribute("aria-checked")).toBe("true");
  await expect(page.locator("#cv-group-tools")).toBeVisible();
  await expect(page.locator("#cv-tbl-scroll")).toHaveAttribute("role", "treegrid");
  expect((await viewState(page)).opaque).toEqual(state3d.opaque);
  const rows = await allDisplayRows(page);
  expect(rows.map((r) => r.cells[GROUP_COLUMN])).toEqual(["IfcDoor"]);
  expect(rows[0].cells[COUNT_COLUMN]).toBe(deCount(FZK_KATEGORIEN.IfcDoor.count));

  // drag `Geschoss` before `Modell`: the fixed columns stay first, the column order is the configuration.
  // Every column fits (CR-002: the table spans to the right edge, no details column): scrolled sideways, `Modell` would
  // lie under the pinned `Gruppe` / `Anzahl` columns (verification INC-1 UX M3) where no drop can reach it.
  expect(await page.locator("#cv-tbl-scroll").evaluate((n) => n.scrollWidth <= n.clientWidth)).toBe(true);
  const target = await header(page, "Modell").boundingBox();
  await header(page, "Geschoss")
    .locator(".cv-th-text")
    .dragTo(header(page, "Modell"), { targetPosition: { x: 8, y: target.height / 2 } });
  await expect
    .poll(() => headerKeys(page))
    .toEqual([GROUP_COLUMN, COUNT_COLUMN, "Geschoss", "Modell", "Kategorie", "Name"]);
  expect((await tableState(page)).columns.map((c) => c.key)).toEqual(["Geschoss", "Modell", "Kategorie", "Name"]);
  // the fixed columns have no sort, filter or resize controls
  await expect(header(page, GROUP_COLUMN).locator("button")).toHaveCount(0);
  await expect(header(page, COUNT_COLUMN).locator(".cv-th-resize")).toHaveCount(0);

  // back to the single-element view: same columns and filter, no fixed columns, no total row
  await setView(page, "Einzelelemente");
  expect(await headerKeys(page)).toEqual(["Geschoss", "Modell", "Kategorie", "Name"]);
  expect((await allTableRows(page)).length).toBe(FZK_KATEGORIEN.IfcDoor.count);
  await expect(page.locator("#cv-tbl-total")).toBeHidden();
  await expect(page.locator("#cv-group-tools")).toBeHidden();
  expect(await groupingState(page)).toEqual({ view: "single", groupBy: ["Kategorie"] });
  // grouping state applied through the seam (TASK-007 configuration load): unknown keys are skipped
  await page.evaluate(() =>
    window.CalcTable.setGrouping({ view: "grouped", groupBy: ["Geschoss", "Gibt.Es.Nicht", "Kategorie"] }),
  );
  expect(await groupingState(page)).toEqual({ view: "grouped", groupBy: ["Geschoss", "Kategorie"] });
  expect(await page.evaluate(() => window.__calc.table.view)).toBe("grouped");
  // removing level 2
  await page.getByRole("button", { name: "Gruppe 2 entfernen" }).click();
  expect(await groupingState(page)).toEqual({ view: "grouped", groupBy: ["Geschoss"] });
  await expect(page.locator("#cv-group-2-clear")).toBeHidden();
  expect(errors).toEqual([]);
});

test("@e2e @UI grouping view at 1280 x 800: `Gruppe` and `Anzahl` stay pinned at the left while the table scrolls sideways", async ({
  page,
}) => {
  // verification INC-1 UX M3: scrolled right, the sums were shown without their group name
  const errors = await openWith(page, FZK);
  await page.setViewportSize({ width: 1280, height: 800 });
  await setView(page, "Gruppiert");
  await addColumn(page, "NetVolume", VOLUME);
  await addColumn(page, "NetSideArea", "BaseQuantities.NetSideArea");
  await addColumn(page, "GrossVolume", "BaseQuantities.GrossVolume");
  const grid = page.locator("#cv-tbl-scroll");
  const overflow = await grid.evaluate((n) => n.scrollWidth - n.clientWidth);
  expect(overflow, "the columns are wider than the table").toBeGreaterThan(100);
  const pinnedBoxes = () =>
    page.evaluate(
      ({ group, count }) => {
        const box = document.getElementById("cv-tbl-scroll").getBoundingClientRect();
        const at = (sel) => {
          const n = document.querySelector(sel);
          if (!n) return null;
          const r = n.getBoundingClientRect();
          // the element drawn at the middle of the cell is the cell itself (not covered by a scrolled cell)
          const hit = document.elementFromPoint(r.left + Math.min(r.width / 2, 40), r.top + r.height / 2);
          return { x: Math.round(r.left - box.left), text: n.textContent, onTop: Boolean(hit && n.contains(hit)) };
        };
        return {
          headGroup: at(`.cv-th[data-key="${group}"]`),
          headCount: at(`.cv-th[data-key="${count}"]`),
          rowGroup: at(`.cv-tbl-body .cv-tr.cv-grp:not([hidden]) .cv-td[data-col="${group}"]`),
          totalGroup: at(`#cv-tbl-total .cv-td[data-col="${group}"]`),
        };
      },
      { group: GROUP_COLUMN, count: COUNT_COLUMN },
    );
  const before = await pinnedBoxes();
  await grid.evaluate((n) => {
    n.scrollLeft = n.scrollWidth;
    n.dispatchEvent(new Event("scroll"));
  });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  expect(await grid.evaluate((n) => n.scrollLeft)).toBeGreaterThan(100);
  const after = await pinnedBoxes();
  for (const part of ["headGroup", "headCount", "rowGroup", "totalGroup"]) {
    expect(after[part], part).not.toBeNull();
    expect(after[part].x, part + " stays at its place").toBe(before[part].x);
    expect(after[part].text, part).toBe(before[part].text);
    expect(after[part].onTop, part + " is drawn over the scrolled cells").toBe(true);
  }
  expect(after.totalGroup.text).toBe("Summe");
  // the single-element view has no pinned columns
  await setView(page, "Einzelelemente");
  expect(await page.locator(".cv-pinned").count()).toBe(0);
  expect(errors).toEqual([]);
});

// TASK-017a (CR-002): hidden and isolated elements are filter sources for groups, sums, the total row, the filter-set
// counts and the exports (REQ-013-AC5, DEC-18). Expected counts and sums: reference-values.json REQ-013-tools (the two
// walls Wand-Ext-ERDG-1 / -2; STEP-text derivation), exports read back by the independent reader (csv / openpyxl).
test("@e2e @acceptance @REQ-013-AC5 hidden walls leave the IfcWallStandardCase group's count and sum, the total row, the Kategorie count and the CSV / XLSX export; isolated walls are all that remain", async ({
  page,
}, testInfo) => {
  const errors = await openWith(page, FZK);
  const tools = REF["REQ-013-tools"];
  const ac5 = tools["REQ-013-AC5"];
  expect(ac5.column).toBe(VOLUME);
  const guids = tools.toolWalls.map((w) => w.GlobalId);
  const keys = await keysOfGuids(page, guids);
  await addColumn(page, "NetVolume", VOLUME);

  /** Groups (collapsed, by Kategorie), total row, Kategorie counts and both exports against one expected case. */
  async function check(expected, name) {
    const kats = valueOrder(Object.keys(expected.byKategorie));
    const rows = await allDisplayRows(page);
    expect(
      rows.map((r) => r.cells[GROUP_COLUMN]),
      name,
    ).toEqual(kats);
    const raw = await hookGroups(page);
    for (const row of rows) {
      const ref = expected.byKategorie[row.cells[GROUP_COLUMN]];
      expect(row.cells[COUNT_COLUMN], `${name} ${row.cells[GROUP_COLUMN]}`).toBe(deCount(ref.count));
      expect(row.cells[VOLUME], `${name} ${row.cells[GROUP_COLUMN]}`).toBe(sumText(ref.volume));
      const hookRow = raw.find((r) => r.label === row.cells[GROUP_COLUMN]);
      if (ref.volume === null) expect(hookRow.cells[VOLUME]).toBeNull();
      else expectClose(hookRow.cells[VOLUME], ref.volume, `${name} ${row.cells[GROUP_COLUMN]} volume`);
    }
    expect(await totalRow(page)).toMatchObject({
      [COUNT_COLUMN]: deCount(expected.count),
      [VOLUME]: sumText(expected.volume),
    });
    const total = await page.evaluate(() => window.__calc.table.total);
    expect(total.count).toBe(expected.count);
    expectClose(total.cells[VOLUME], expected.volume, `${name} total volume`);
    expect(await shownCounts(page, "Kategorie")).toEqual(
      Object.fromEntries(Object.entries(expected.byKategorie).map(([k, g]) => [k, g.count])),
    );
    // CSV: header, one level-1 row per group in table order, `Summe` last
    const csv = readExport("csv", (await exportFile(page, "csv", testInfo.outputPath(`${name}.csv`))).path);
    const body = csv.records.slice(1);
    expect(body.map((r) => r[0])).toEqual([...kats.map(() => "1"), "Summe"]);
    kats.forEach((kat, i) => {
      const ref = expected.byKategorie[kat];
      expect(body[i].slice(1, 3), `${name} CSV ${kat}`).toEqual([kat, String(ref.count)]);
      if (ref.volume === null) expect(body[i][7]).toBe("");
      else expectClose(csvNumber(body[i][7]), ref.volume, `${name} CSV ${kat} volume`);
    });
    expect(body[kats.length][2]).toBe(String(expected.count));
    expectClose(csvNumber(body[kats.length][7]), expected.volume, `${name} CSV total volume`);
    // XLSX: the same rows, counts and sums as numeric cells
    const x = readExport("xlsx", (await exportFile(page, "xlsx", testInfo.outputPath(`${name}.xlsx`))).path);
    expect(x.rows).toHaveLength(csv.records.length);
    x.rows.slice(1).forEach((row, j) => {
      expect(row[0].v, `${name} XLSX row ${j}`).toBe(body[j][0]);
      expect(row[2]).toMatchObject({ v: Number(body[j][2]), t: "n" });
      if (body[j][7] === "") expect(row[7].v).toBeNull();
      else expectClose(row[7].v, csvNumber(body[j][7]), `${name} XLSX row ${j} volume`);
    });
  }

  // two hidden walls (properties panel `Ausblenden` on their table rows)
  for (const key of keys) await panelAction(page, key, "hide");
  await setView(page, "Gruppiert");
  expect(await groupingState(page)).toEqual({ view: "grouped", groupBy: ["Kategorie"] });
  await check(ac5.hidden, "hidden");
  expect(ac5.hidden.byKategorie.IfcWallStandardCase.count).toBe(11);

  // the same two walls isolated instead
  await page.locator("#cv-pill-hidden-reset").click();
  await isolateTogether(page, guids);
  await setView(page, "Gruppiert");
  await pickGroup(page, 1, "Kategorie", "Kategorie");
  await check(ac5.isolated, "isolated");
  expect(errors).toEqual([]);
});
