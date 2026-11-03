// TASK-008 CSV and Excel export of the shown table rows (spec REQ-008-AC1..AC5, REQ-011-AC1 file-name part, DEC-6;
// T7 robustness of the export). The downloads are read back by an independent reader (test/support/read-export.py:
// Python's csv module with ';', openpyxl 3.1.5 plus a ZIP / XML structure check), never by the product's code.
// Expected values come from test/fixtures/reference-values.json (section REQ-008-export, STEP-text derivation; group
// rows from REQ-006-grouping-fzk); row order is the table's own order (window.__calc.table), which the export must
// follow, plus a sort whose order is checked against the reference values.
import { test, expect } from "../support/network-guard.mjs";
import { REF, expectClose, fixture, loadFiles, openBuilder } from "../support/builder.mjs";
import { toggleValue } from "../support/filter-area.mjs";
import { idle } from "../support/view-3d.mjs";
import { addColumn, clickSort, typeBound } from "../support/table.mjs";
import { setView, pickGroup, toggleGroup } from "../support/grouping.mjs";
import { openHeaderDialog } from "../support/config.mjs";
import { csvNumber, csvText, exportFile, readExport } from "../support/export.mjs";

const EXP = REF["REQ-008-export"];
const SINGLE = EXP.single;
const GROUPED = EXP.grouped;
const fzkGroups = REF["REQ-006-grouping-fzk"];
const FZK = fixture("AC20-FZK-Haus.ifc");
const DUPLEX = fixture("Ifc2x3_Duplex_Architecture.ifc");
const EXPORT_IFC = fixture("fzk-export.ifc");
const NUMBER = SINGLE.properties.number; // CalcTest_Export.Zahl
const TEXT = SINGLE.properties.text; // CalcTest_Export.Text
const VOLUME = GROUPED.column; // BaseQuantities.NetVolume
const VOLUMES = REF["AC20-FZK-Haus"].columnValues[VOLUME].byGlobalId;
const NOT_ROWS = ["IfcOpeningElement"]; // STEP classes the extractor does not list as rows (TASK-002)
// classes whose presence as rows depends on the importer / the IfcSpace option (scripts/ref/derive-reference.mjs)
const CONDITIONAL = ["IfcAnnotation", "IfcOpeningElement", "IfcVirtualElement", "IfcDistributionPort", "IfcSpace"];
const COLUMNS = ["Modell", "Kategorie", "Name", "Geschoss", "Material", NUMBER, TEXT, VOLUME];

const refByGuid = new Map(SINGLE.rows.map((r) => [r.GlobalId, r]));
const join = (list) => (list || []).join(", ");

/** Catalogue headers (title with unit) of column keys. */
function headers(page, keys) {
  return page.evaluate((list) => list.map((k) => window.__calc.catalog.find((e) => e.key === k).header), keys);
}

/** GlobalIds of the table rows in table order (window.__calc.table.keys). */
function tableGuidOrder(page) {
  return page.evaluate(() => {
    const byKey = new Map(window.__calc.rows.map((r) => [r.key, r.guid]));
    return window.__calc.table.keys.map((k) => byKey.get(k));
  });
}

/** Sets title and date through the header dialog `Titel, Datum und Logo`. */
async function editHeader(page, title, date) {
  const dialog = await openHeaderDialog(page);
  await dialog.locator("#cv-hdr-title").fill(title);
  await dialog.locator("#cv-hdr-date").fill(date);
  await dialog.getByRole("button", { name: "Übernehmen" }).click();
  await expect(dialog).toBeHidden();
}

/** fzk-export.ifc + Duplex, Kategorie = IfcWallStandardCase, columns Material / Zahl / Text / NetVolume added. */
async function singleView(page) {
  const errors = await openBuilder(page);
  await loadFiles(page, [EXPORT_IFC, DUPLEX]);
  await idle(page);
  for (const k of Object.keys(SINGLE.filter)) for (const v of SINGLE.filter[k]) await toggleValue(page, k, v);
  await addColumn(page, "Material", "Material");
  await addColumn(page, "CalcTest_Export", NUMBER);
  await addColumn(page, "CalcTest_Export", TEXT);
  await addColumn(page, "NetVolume", VOLUME);
  expect(await page.evaluate(() => window.CalcTable.state().columns.map((c) => c.key))).toEqual(COLUMNS);
  expect(await page.evaluate(() => window.__calc.table.count)).toBe(SINGLE.rows.length);
  return errors;
}

/** Expected CSV record of a reference row (single view, COLUMNS). */
function expectedCsvRecord(ref) {
  return [
    ref.Modell,
    ref.Kategorie,
    csvText(ref.Name ?? ""),
    csvText(ref.Geschoss ?? ""),
    csvText(join(ref.Material)),
    ref.Zahl ? ref.Zahl.csv : "",
    csvText(ref.Text ?? ""),
  ];
}

test("@e2e @acceptance @REQ-008-AC1 @REQ-008-AC4 @REQ-008-AC5 single view: CSV with BOM, ';', CRLF, header, one line per row in table order, 0,12345, materials joined, '=SUM(A1)", async ({
  page,
}, testInfo) => {
  const errors = await singleView(page);
  await editHeader(page, "A/B: C?", "2026-08-12");
  const titles = await headers(page, COLUMNS);
  expect(titles[7]).toBe(`${VOLUME} (m³)`); // unit in the header (REQ-002)

  const file = await exportFile(page, "csv", testInfo.outputPath("single.csv"));
  expect(file.fileName).toBe("A_B_ C__2026-08-12.csv"); // REQ-008-AC5
  expect(file.last).toMatchObject({ ok: true, format: "csv", rows: SINGLE.rows.length, columns: COLUMNS.length });
  expect([...file.bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const csv = readExport("csv", file.path);
  expect(csv.bom).toBe(true);
  expect(csv.endsWithCrlf).toBe(true);
  expect(csv.bareLfOutsideQuotes).toBe(0);
  expect(csv.records[0]).toEqual(titles);
  expect(csv.records).toHaveLength(1 + SINGLE.rows.length);

  // one line per table row, in table order, values from the STEP derivation
  const order = await tableGuidOrder(page);
  expect(new Set(order)).toEqual(new Set(SINGLE.rows.map((r) => r.GlobalId)));
  order.forEach((guid, i) => {
    const ref = refByGuid.get(guid);
    const record = csv.records[i + 1];
    expect(record.slice(0, 7), guid).toEqual(expectedCsvRecord(ref));
    const volume = csvNumber(record[7]);
    if (VOLUMES[guid] !== undefined && ref.Modell === "fzk-export") expectClose(volume, VOLUMES[guid], guid);
    else expect(volume, guid).toBeNull();
  });
  const csvLine = (guid) => csv.records[order.indexOf(guid) + 1];
  const zahl = (value) => SINGLE.rows.find((r) => r.Zahl && r.Zahl.value === value);
  expect(csvLine(zahl(0.12345).GlobalId)[5]).toBe("0,12345"); // REQ-008-AC1
  expect(csvLine(zahl(0.12345).GlobalId)[6]).toBe("'=SUM(A1)"); // REQ-008-AC4, DEC-6
  expect(csvLine(zahl(1e-7).GlobalId)[5]).toBe("0,0000001"); // no exponent notation
  expect(csvLine(zahl(2.5e21).GlobalId)[5]).toBe("2500000000000000000000");
  expect(csvLine(zahl(-2.5).GlobalId)[5]).toBe("-2,5"); // numeric cells get no prefix
  const multi = SINGLE.rows.find((r) => r.Material.length > 1);
  expect(multi, "a multi-material wall in the reference").toBeTruthy();
  expect(csvLine(multi.GlobalId)[4]).toBe(multi.Material.join(", "));

  // a sort changes the exported order the same way (REQ-008 "in their order"): Zahl descending, empty last
  await clickSort(page, NUMBER);
  await clickSort(page, NUMBER);
  const sorted = readExport("csv", (await exportFile(page, "csv", testInfo.outputPath("sorted.csv"))).path);
  const withNumber = SINGLE.rows.filter((r) => r.Zahl).sort((a, b) => b.Zahl.value - a.Zahl.value);
  expect(sorted.records.slice(1, 1 + withNumber.length).map((r) => r[5])).toEqual(withNumber.map((r) => r.Zahl.csv));
  expect(sorted.records.slice(1 + withNumber.length).every((r) => r[5] === "")).toBe(true);
  const sortedOrder = await tableGuidOrder(page);
  sortedOrder.forEach((guid, i) =>
    expect(sorted.records[i + 1].slice(0, 7)).toEqual(expectedCsvRecord(refByGuid.get(guid))),
  );
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-008-AC2 @REQ-008-AC4 single view: Excel read by openpyxl with the same headers and values, numbers numeric, =SUM(A1) as text", async ({
  page,
}, testInfo) => {
  const errors = await singleView(page);
  await editHeader(page, "A/B: C?", "2026-08-12");
  const titles = await headers(page, COLUMNS);
  const file = await exportFile(page, "xlsx", testInfo.outputPath("single.xlsx"));
  expect(file.fileName).toBe("A_B_ C__2026-08-12.xlsx");
  const x = readExport("xlsx", file.path);
  // structure: valid ZIP (CRC), well-formed XML parts, deflate, content types
  expect(x.testzip).toBeNull();
  expect(x.methods).toEqual([8]);
  expect(Object.keys(x.overrides).sort()).toEqual([
    "/xl/sharedStrings.xml",
    "/xl/styles.xml",
    "/xl/workbook.xml",
    "/xl/worksheets/sheet1.xml",
  ]);
  expect(x.sheetChildren).toEqual(["dimension", "sheetViews", "sheetFormatPr", "cols", "sheetData", "autoFilter"]);
  expect(x.sheetNames).toEqual(["Tabelle"]);
  expect(x.freezePanes).toBe("A2");
  expect(x.pane).toMatchObject({ state: "frozen", ySplit: "1" });
  expect(x.autoFilter).toBe(`A1:H${1 + SINGLE.rows.length}`);
  expect(x.maxRow).toBe(1 + SINGLE.rows.length);
  expect(x.maxColumn).toBe(COLUMNS.length);
  // header: same titles, bold
  expect(x.rows[0].map((c) => c.v)).toEqual(titles);
  expect(x.rows[0].every((c) => c.b && c.t === "s")).toBe(true);
  // fitted column widths: the long Text column is wider than Kategorie, all within bounds
  const widths = Object.values(x.widths);
  expect(widths).toHaveLength(COLUMNS.length);
  expect(x.widths.G).toBeGreaterThan(x.widths.B);
  expect(Math.max(...widths)).toBeLessThanOrEqual(80);

  const order = await tableGuidOrder(page);
  order.forEach((guid, i) => {
    const ref = refByGuid.get(guid);
    const row = x.rows[i + 1];
    const text = (j, expected) => {
      if (expected === null || expected === "") expect(row[j].v, `${guid} col ${j}`).toBeNull();
      else expect([row[j].v, row[j].t], `${guid} col ${j}`).toEqual([expected, "s"]);
    };
    text(0, ref.Modell);
    text(1, ref.Kategorie);
    text(2, ref.Name);
    text(3, ref.Geschoss);
    text(4, join(ref.Material));
    if (ref.Zahl) expect([row[5].v, row[5].t]).toEqual([ref.Zahl.value, "n"]);
    else expect(row[5].v).toBeNull();
    text(6, ref.Text); // no "'" prefix in Excel: =SUM(A1) is a text cell (REQ-008-AC4)
    if (VOLUMES[guid] !== undefined && ref.Modell === "fzk-export") {
      expect(row[7].t).toBe("n");
      expectClose(row[7].v, VOLUMES[guid], guid);
    } else expect(row[7].v).toBeNull();
    expect(row.some((c) => c.b)).toBe(false);
  });
  const sum = SINGLE.rows.find((r) => r.Text === "=SUM(A1)");
  expect(x.rows[order.indexOf(sum.GlobalId) + 1][6]).toEqual({ v: "=SUM(A1)", t: "s", b: false });
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-008-AC3 grouping view: Ebene;Gruppe;Anzahl;<columns>, one 1-row per Kategorie, walls under IfcWallStandardCase, Summe last; Excel bold groups and total", async ({
  page,
}, testInfo) => {
  const errors = await openBuilder(page);
  await loadFiles(page, FZK);
  await idle(page);
  await addColumn(page, "NetVolume", VOLUME);
  await setView(page, "Gruppiert"); // level 1 = Kategorie (default of the grouping view)
  expect(await page.evaluate(() => window.CalcTable.grouping())).toEqual({ view: "grouped", groupBy: ["Kategorie"] });
  await toggleGroup(page, [GROUPED.expanded], true);
  await editHeader(page, "The M Bouwkundig", "2026-08-12");
  const columns = ["Modell", "Kategorie", "Name", "Geschoss", VOLUME];
  const titles = await headers(page, columns);

  const file = await exportFile(page, "csv", testInfo.outputPath("grouped.csv"));
  expect(file.fileName).toBe("The M Bouwkundig_2026-08-12.csv"); // REQ-011-AC1 file-name part
  const csv = readExport("csv", file.path);
  expect(csv.records[0]).toEqual(["Ebene", "Gruppe", "Anzahl", ...titles]);

  const groupsInTable = await page.evaluate(() =>
    window.__calc.table.display.filter((r) => r.type === "group").map((r) => r.label),
  );
  // every Kategorie of the STEP text that is a row class, in value order (German collation)
  const expectedKats = Object.keys(fzkGroups.byKategorie).filter((k) => !NOT_ROWS.includes(k));
  for (const kat of groupsInTable) expect(expectedKats).toContain(kat);
  for (const kat of expectedKats) if (!CONDITIONAL.includes(kat)) expect(groupsInTable).toContain(kat);
  const collator = new Intl.Collator("de");
  expect(groupsInTable).toEqual([...groupsInTable].sort((a, b) => collator.compare(a, b)));
  expect(groupsInTable).toContain(GROUPED.expanded);

  const walls = GROUPED.walls;
  const body = csv.records.slice(1);
  expect(body).toHaveLength(groupsInTable.length + walls.length + 1);
  let i = 0;
  const wallOrder = await tableGuidOrder(page);
  expect(new Set(wallOrder)).toEqual(new Set(walls.map((w) => w.GlobalId)));
  let total = 0;
  let volumeTotal = 0;
  for (const kat of groupsInTable) {
    const ref = fzkGroups.byKategorie[kat];
    const r = body[i++];
    expect(r.slice(0, 3), kat).toEqual(["1", kat, String(ref.count)]);
    expect(r[3]).toBe("AC20-FZK-Haus"); // equal in every element of the group
    expect(r[4]).toBe(kat);
    expect(r[5]).toBe(csvText(ref.common.Name ?? ""));
    expect(r[6]).toBe(csvText(ref.common.Geschoss ?? ""));
    if (ref.volume === null) expect(r[7]).toBe("");
    else expectClose(csvNumber(r[7]), ref.volume, `${kat} volume`);
    total += ref.count;
    volumeTotal += ref.volume ?? 0;
    if (kat !== GROUPED.expanded) continue;
    for (const guid of wallOrder) {
      const wall = walls.find((w) => w.GlobalId === guid);
      const e = body[i++];
      expect(e.slice(0, 7), guid).toEqual(["Element", "", "", "AC20-FZK-Haus", kat, wall.Name, wall.Geschoss]);
      expectClose(csvNumber(e[7]), wall[VOLUME], guid);
    }
  }
  const last = body[i++];
  expect(last.slice(0, 7)).toEqual(["Summe", "", String(total), "", "", "", ""]);
  expectClose(csvNumber(last[7]), volumeTotal, "total volume");
  expect(i).toBe(body.length);

  // the same view as Excel: Ebene text, Anzahl numeric, bold group and total rows, autofilter without the total row
  const x = readExport("xlsx", (await exportFile(page, "xlsx", testInfo.outputPath("grouped.xlsx"))).path);
  expect(x.testzip).toBeNull();
  expect(x.rows).toHaveLength(csv.records.length);
  expect(x.autoFilter).toBe(`A1:H${csv.records.length - 1}`);
  x.rows.slice(1).forEach((row, j) => {
    const rec = body[j];
    const isGroup = rec[0] !== "Element";
    expect(
      row.every((c) => c.v === null || c.b === isGroup),
      `bold row ${j}`,
    ).toBe(true);
    expect(row[0]).toMatchObject({ v: rec[0], t: "s" });
    if (rec[2] === "") expect(row[2].v).toBeNull();
    else expect(row[2]).toMatchObject({ v: Number(rec[2]), t: "n" });
    if (rec[7] === "") expect(row[7].v).toBeNull();
    else {
      expect(row[7].t).toBe("n");
      expectClose(row[7].v, csvNumber(rec[7]), `xlsx row ${j}`);
    }
  });
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-008-AC3 grouping view with two levels: level-2 rows only under the expanded level-1 group, elements only under the expanded level-2 group", async ({
  page,
}, testInfo) => {
  const errors = await openBuilder(page);
  await loadFiles(page, FZK);
  await idle(page);
  await setView(page, "Gruppiert");
  await pickGroup(page, 2, "Geschoss", "Geschoss");
  await toggleGroup(page, [GROUPED.expanded], true);
  const ground = REF["AC20-FZK-Haus"].filters["REQ-004-AC2"].groundFloorStorey.Name;
  await toggleGroup(page, [GROUPED.expanded, ground], true);
  const csv = readExport("csv", (await exportFile(page, "csv", testInfo.outputPath("two-levels.csv"))).path);
  const body = csv.records.slice(1);
  const display = await page.evaluate(() => window.__calc.table.display);
  expect(body).toHaveLength(display.length + 1);
  const ref = fzkGroups.byKategorie[GROUPED.expanded];
  let parent = null;
  display.forEach((row, j) => {
    const rec = body[j];
    if (row.type === "group") {
      expect(rec[0]).toBe(String(row.level));
      if (row.level === 1) parent = row.label;
      else {
        expect(parent).toBe(GROUPED.expanded); // level-2 rows only under the expanded level-1 group
        expect(rec.slice(1, 3)).toEqual([row.label, String(ref.byGeschoss[row.label].count)]);
      }
    } else {
      expect(rec.slice(0, 3)).toEqual(["Element", "", ""]);
      expect(parent).toBe(GROUPED.expanded);
    }
  });
  const levels = body.map((r) => r[0]);
  expect(levels.filter((l) => l === "2")).toHaveLength(Object.keys(ref.byGeschoss).length);
  expect(levels.filter((l) => l === "Element")).toHaveLength(ref.byGeschoss[ground].count);
  expect(levels.at(-1)).toBe("Summe");
  expect(errors).toEqual([]);
});

test("@robustness @REQ-008 special values: = + - @ prefixed in CSV only, line break, ';' and quotes quoted, non-ASCII UTF-8, 1,000 characters unchanged in CSV and Excel", async ({
  page,
}, testInfo) => {
  const errors = await singleView(page);
  const csvFile = await exportFile(page, "csv", testInfo.outputPath("special.csv"));
  const csv = readExport("csv", csvFile.path);
  const x = readExport("xlsx", (await exportFile(page, "xlsx", testInfo.outputPath("special.xlsx"))).path);
  const order = await tableGuidOrder(page);
  const special = SINGLE.rows.filter((r) => r.Text !== null);
  expect(special.length).toBeGreaterThanOrEqual(7);
  for (const ref of special) {
    const i = order.indexOf(ref.GlobalId) + 1;
    expect(csv.records[i][6], ref.Text.slice(0, 20)).toBe(csvText(ref.Text));
    expect(x.rows[i][6], ref.Text.slice(0, 20)).toMatchObject({ v: ref.Text, t: "s" });
  }
  const starts = special.map((r) => r.Text[0]);
  for (const c of ["=", "+", "-", "@"]) expect(starts).toContain(c);
  const long = special.find((r) => r.Text.length === 1000);
  expect(long, "a 1,000-character value").toBeTruthy();
  const multiline = special.find((r) => r.Text.includes("\n"));
  expect(multiline.Text).toMatch(/;.*"/);
  // raw bytes: the multi-line value is one quoted field with doubled quotes; the non-ASCII value is UTF-8
  const raw = csvFile.bytes.toString("utf8");
  expect(raw).toContain('"' + multiline.Text.replace(/"/g, '""') + '"');
  const nonAscii = special.find((r) => /[^ -~\n]/.test(r.Text)); // a character outside printable ASCII
  expect(csvFile.bytes.includes(Buffer.from(nonAscii.Text, "utf8"))).toBe(true);
  expect(errors).toEqual([]);
});

test("@robustness @REQ-008 empty table: CSV and Excel hold only the header (single view) or header and Summe (grouping view)", async ({
  page,
}, testInfo) => {
  const errors = await openBuilder(page);
  await loadFiles(page, FZK);
  await idle(page);
  await addColumn(page, "NetVolume", VOLUME);
  const before = await page.evaluate(() => window.__calc.filter.updates);
  await typeBound(page, VOLUME, "min", "1000000");
  await page.waitForFunction((n) => window.__calc.filter.updates > n, before);
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => window.__calc.table.count)).toBe(0);
  const titles = await headers(page, ["Modell", "Kategorie", "Name", "Geschoss", VOLUME]);

  const csv = readExport("csv", (await exportFile(page, "csv", testInfo.outputPath("empty.csv"))).path);
  expect(csv.records).toEqual([titles]);
  const x = readExport("xlsx", (await exportFile(page, "xlsx", testInfo.outputPath("empty.xlsx"))).path);
  expect(x.testzip).toBeNull();
  expect(x.rows.map((r) => r.map((c) => c.v))).toEqual([titles]);
  expect(x.autoFilter).toBe("A1:E1");

  await setView(page, "Gruppiert");
  const g = readExport("csv", (await exportFile(page, "csv", testInfo.outputPath("empty-grouped.csv"))).path);
  expect(g.records).toEqual([
    ["Ebene", "Gruppe", "Anzahl", ...titles],
    ["Summe", "", "0", "", "", "", "", ""],
  ]);
  const gx = readExport("xlsx", (await exportFile(page, "xlsx", testInfo.outputPath("empty-grouped.xlsx"))).path);
  expect(gx.rows[1].map((c) => c.v)).toEqual(["Summe", null, 0, null, null, null, null, null]);
  expect(gx.rows[1][0].b).toBe(true);
  expect(errors).toEqual([]);
});

test("@e2e @REQ-008 export buttons: disabled without a model, progress shown while exporting, the view is unchanged afterwards", async ({
  page,
}, testInfo) => {
  const errors = await openBuilder(page);
  for (const name of ["Export CSV", "Export Excel"]) {
    const button = page.getByRole("button", { name, exact: true });
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute("title", "Zuerst ein IFC-Modell laden.");
  }
  await loadFiles(page, FZK);
  await idle(page);
  // progress: the overlay names the file and the step while the export runs
  await page.evaluate(() => {
    window.__progressSeen = [];
    const observer = new MutationObserver(() => {
      const text = document.querySelector(".cv-overlay")?.textContent || "";
      if (text.includes("Export")) window.__progressSeen.push(text);
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
  });
  const stateBefore = await page.evaluate(() => ({
    table: window.CalcTable.state(),
    count: window.__calc.table.count,
    filter: window.__calc.filter.count,
  }));
  const file = await exportFile(page, "xlsx", testInfo.outputPath("progress.xlsx"));
  expect(file.last.ok).toBe(true);
  const seen = await page.evaluate(() => window.__progressSeen);
  expect(seen.length).toBeGreaterThan(0);
  expect(seen[0]).toContain(file.fileName);
  expect(seen.some((t) => /Export Excel/.test(t))).toBe(true);
  expect(await page.evaluate(() => window.__calc.phase)).toBe("ready");
  expect(
    await page.evaluate(() => ({
      table: window.CalcTable.state(),
      count: window.__calc.table.count,
      filter: window.__calc.filter.count,
    })),
  ).toEqual(stateBefore);
  await expect(page.getByRole("button", { name: "Export CSV", exact: true })).toBeEnabled();
  expect(errors).toEqual([]);
});
