// [unit] tests of the TASK-008 export writers in cv-core (spec REQ-008 CSV / Excel, DEC-6, ASM-004): plainNumber,
// exportValue, exportSheet (single and grouping view), csvField / toCsv, xmlText, crc32, zipArchive, toXlsx. The .xlsx
// and .csv bytes are read back by the independent reader test/support/read-export.py (Python csv module, openpyxl
// 3.1.5, ZIP / XML structure). Real-data checks use the AC20-FZK-Haus rows snapshot as INPUT only; expected group
// counts and sums come from test/fixtures/reference-values.json (STEP-text derivation).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";
import { loadCore } from "../load-core.mjs";

const core = await loadCore();
const {
  EXPORT_STEP_ROWS,
  XLSX_MAX_TEXT,
  XLSX_SHEET_NAME,
  columnName,
  crc32,
  createColumnStore,
  csvField,
  exportSheet,
  exportValue,
  germanPlainNumber,
  groupDisplayRows,
  groupRows,
  plainNumber,
  toCsv,
  toXlsx,
  xmlText,
  zipArchive,
} = core;

const READER = fileURLToPath(new URL("../support/read-export.py", import.meta.url));
const fixtures = new URL("../fixtures/", import.meta.url);
const REF = JSON.parse(readFileSync(new URL("reference-values.json", fixtures), "utf8"));
const FZK_ROWS = JSON.parse(readFileSync(new URL("fzk-rows.snapshot.json", fixtures), "utf8")).rows;

const dir = mkdtempSync(join(tmpdir(), "cv-export-"));
process.once("exit", () => rmSync(dir, { recursive: true, force: true }));
let fileNo = 0;
/** Writes bytes or text to a temporary file and reads it back with the Python reader. */
function readBack(mode, data) {
  const path = join(dir, `f${fileNo++}.${mode === "csv" ? "csv" : "xlsx"}`);
  writeFileSync(path, typeof data === "string" ? Buffer.from(data, "utf8") : data);
  return JSON.parse(execFileSync("python3", ["-I", READER, mode, path], { encoding: "utf8", maxBuffer: 1 << 28 }));
}

const row = (key, values) => ({
  key,
  model: "m1",
  localId: Number(key.split(":")[1]),
  guid: key,
  geometry: true,
  values,
});
const ROWS = [
  row("m1:1", { Name: "=SUM(A1)", Kat: "Wand", Vol: 0.12345, Mat: ["Beton", "Putz"] }),
  row("m1:2", { Name: 'Zeile 1\r\nZeile 2; "Zitat"', Kat: "Wand", Vol: 1e-7, Mat: "Beton" }),
  row("m1:3", { Name: "+49", Kat: "Decke", Vol: -2.5 }),
  row("m1:4", { Name: "Größe € 漢", Kat: "Decke", Vol: 2.5e21, Mat: [] }),
  row("m1:5", { Name: "@x", Vol: NaN }),
];
const COLUMNS = [
  { key: "Name", title: "Name" },
  { key: "Kat", title: "Kategorie" },
  { key: "Vol", title: "Vol (m³)" },
  { key: "Mat", title: "Material" },
];
const all = (n) => Uint32Array.from({ length: n }, (_, i) => i);

test("[unit] plainNumber / germanPlainNumber: unrounded shortest form without exponent (REQ-008)", () => {
  const cases = [
    [0.12345, "0.12345"],
    [1e-7, "0.0000001"],
    [-1.5e-9, "-0.0000000015"],
    [1.234e-7, "0.0000001234"],
    [2.5e21, "2500000000000000000000"],
    [1e21, "1000000000000000000000"],
    [-1.2345e22, "-12345000000000000000000"],
    [1.7976931348623157e308, "17976931348623157" + "0".repeat(292)],
    [5e-324, "0." + "0".repeat(323) + "5"],
    [0.1 + 0.2, "0.30000000000000004"],
    [123456789.125, "123456789.125"],
    [-0, "0"],
    [0, "0"],
    [42, "42"],
  ];
  for (const [n, text] of cases) {
    assert.equal(plainNumber(n), text, String(n));
    assert.equal(Number(text), n === 0 ? 0 : n, `round trip ${n}`);
  }
  assert.equal(germanPlainNumber(-1234.5), "-1234,5"); // decimal comma, no thousands separator
  assert.equal(germanPlainNumber(1e-7), "0,0000001");
});

test("[unit] exportValue: numbers stay numbers, multi-values joined with ', ', empty values null", () => {
  assert.equal(exportValue(0.5), 0.5);
  assert.equal(exportValue(["Beton", "Putz"]), "Beton, Putz");
  assert.equal(exportValue(["A", null, "", 1.5]), "A, 1,5");
  for (const empty of [null, undefined, "", [], NaN, Infinity]) assert.equal(exportValue(empty), null);
  assert.equal(exportValue([null, ""]), null);
  assert.equal(exportValue("Ja"), "Ja");
});

test("[unit] csvField: DEC-6 prefix for = + - @ texts only, RFC 4180 quoting, numbers with decimal comma", () => {
  assert.equal(csvField("=SUM(A1)"), "'=SUM(A1)");
  assert.equal(csvField("+49"), "'+49");
  assert.equal(csvField("-5"), "'-5"); // text that looks numeric stays text (DEC-5) and is prefixed
  assert.equal(csvField("@x"), "'@x");
  assert.equal(csvField(" =x"), " =x");
  assert.equal(csvField(-5), "-5");
  assert.equal(csvField(0.12345), "0,12345");
  assert.equal(csvField(null), "");
  assert.equal(csvField("a;b"), '"a;b"');
  assert.equal(csvField('sag "hallo"'), '"sag ""hallo"""');
  assert.equal(csvField("a\nb"), '"a\nb"');
  assert.equal(csvField("a\rb"), '"a\rb"');
  assert.equal(csvField('=a;"b"'), '"\'=a;""b"""');
  assert.equal(csvField("Größe"), "Größe");
});

test("[unit] exportSheet + toCsv single view: BOM, ';', CRLF, header, rows in the given order; Python csv reads it back", async () => {
  const sheet = exportSheet({ rows: ROWS, columns: COLUMNS, view: "single", order: Uint32Array.from([2, 0, 1, 3, 4]) });
  assert.deepEqual(sheet.headers, ["Name", "Kategorie", "Vol (m³)", "Material"]);
  assert.equal(sheet.total, false);
  assert.deepEqual(sheet.bold, [false, false, false, false, false]);
  const text = await toCsv(sheet);
  assert.equal(
    text,
    "﻿Name;Kategorie;Vol (m³);Material\r\n" +
      "'+49;Decke;-2,5;\r\n" +
      "'=SUM(A1);Wand;0,12345;Beton, Putz\r\n" +
      '"Zeile 1\r\nZeile 2; ""Zitat""";Wand;0,0000001;Beton\r\n' +
      "Größe € 漢;Decke;2500000000000000000000;\r\n" +
      "'@x;;;\r\n",
  );
  const back = readBack("csv", text);
  assert.equal(back.bom, true);
  assert.equal(back.bareLfOutsideQuotes, 0);
  assert.deepEqual(back.records[2], ["'=SUM(A1)", "Wand", "0,12345", "Beton, Putz"]);
  assert.deepEqual(back.records[3], ['Zeile 1\r\nZeile 2; "Zitat"', "Wand", "0,0000001", "Beton"]);
  assert.equal(back.records.length, 6);
});

test("[unit] exportSheet grouping view: Ebene / Gruppe / Anzahl, expanded groups only, total row last (REQ-008)", async () => {
  const store = createColumnStore(ROWS);
  const tree = groupRows(store, all(ROWS.length), {
    levels: ["Kat"],
    columns: [
      { key: "Name", mode: "same" },
      { key: "Kat", mode: "same" },
      { key: "Vol", mode: "sum" },
      { key: "Mat", mode: "same" },
    ],
  });
  const items = groupDisplayRows(tree, (g) => g.value === "Wand");
  const sheet = exportSheet({ rows: ROWS, columns: COLUMNS, view: "grouped", items, total: tree.total });
  assert.deepEqual(sheet.headers, ["Ebene", "Gruppe", "Anzahl", "Name", "Kategorie", "Vol (m³)", "Material"]);
  assert.deepEqual(
    sheet.rows.map((r) => r.slice(0, 3)),
    [
      ["1", "Decke", 2],
      ["1", "Wand", 2],
      ["Element", null, null],
      ["Element", null, null],
      ["1", "(leer)", 1],
      ["Summe", null, 5],
    ],
  );
  assert.deepEqual(sheet.bold, [true, true, false, false, true, true]);
  assert.equal(sheet.total, true);
  assert.deepEqual(sheet.rows[1].slice(3), [null, "Wand", 0.12345 + 1e-7, null]); // common Kat, summed Vol
  assert.deepEqual(sheet.rows[2].slice(3), ["=SUM(A1)", "Wand", 0.12345, "Beton, Putz"]);
  assert.deepEqual(sheet.rows[5].slice(3), [null, null, tree.total.cells.Vol, null]);
  const lines = (await toCsv(sheet)).split("\r\n");
  assert.equal(lines[0], "﻿Ebene;Gruppe;Anzahl;Name;Kategorie;Vol (m³);Material");
  assert.equal(lines[1], "1;Decke;2;;Decke;2500000000000000000000;");
  assert.equal(lines[3], "Element;;;'=SUM(A1);Wand;0,12345;Beton, Putz");
  // lines[4] and [5] are one record: the quoted value holds CR LF
  assert.equal(lines[4] + "\r\n" + lines[5], 'Element;;;"Zeile 1\r\nZeile 2; ""Zitat""";Wand;0,0000001;Beton');
  assert.equal(lines[6], "1;(leer);1;'@x;;;");
  assert.ok(lines[7].startsWith("Summe;;5;;;"), lines[7]);
  assert.equal(lines[8], "");

  // empty table: header and the total row only
  const empty = groupRows(store, new Uint32Array(0), { levels: ["Kat"], columns: [] });
  const none = exportSheet({ rows: ROWS, columns: COLUMNS, view: "grouped", items: [], total: empty.total });
  assert.deepEqual(none.rows, [["Summe", null, 0, null, null, null, null]]);
  // a numeric group value stays a number
  const byVol = groupRows(store, Uint32Array.from([0]), { levels: ["Vol"], columns: [] });
  const numeric = exportSheet({
    rows: ROWS,
    columns: [],
    view: "grouped",
    items: groupDisplayRows(byVol, () => false),
    total: byVol.total,
  });
  assert.deepEqual(numeric.rows[0], ["1", 0.12345, 1]);
});

test("[unit] exportSheet on the AC20-FZK-Haus snapshot grouped by Kategorie: counts and NetVolume sums as in reference-values.json", async () => {
  const VOLUME = REF["REQ-006-grouping-fzk"].column;
  const store = createColumnStore(FZK_ROWS);
  const tree = groupRows(store, all(FZK_ROWS.length), {
    levels: ["Kategorie"],
    columns: [{ key: VOLUME, mode: "sum" }],
  });
  const sheet = exportSheet({
    rows: FZK_ROWS,
    columns: [{ key: VOLUME, title: VOLUME }],
    view: "grouped",
    items: groupDisplayRows(tree, () => false),
    total: tree.total,
  });
  const ref = REF["REQ-006-grouping-fzk"].byKategorie;
  const close = (a, b) => assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(Math.abs(b), 1e-12), `${a} vs ${b}`);
  let total = 0;
  for (const r of sheet.rows.slice(0, -1)) {
    const expected = ref[r[1]];
    assert.ok(expected, r[1]);
    assert.equal(r[2], expected.count, r[1]);
    if (expected.volume === null) assert.equal(r[3], null);
    else close(r[3], expected.volume);
    total += expected.count;
  }
  assert.deepEqual(sheet.rows.at(-1).slice(0, 3), ["Summe", null, total]);
  const back = readBack("csv", await toCsv(sheet));
  assert.equal(back.records.length, sheet.rows.length + 1);
});

test("[unit] toCsv / toXlsx call options.pause with a growing fraction every EXPORT_STEP_ROWS rows", async () => {
  const n = EXPORT_STEP_ROWS * 2 + 5;
  const rows = Array.from({ length: n }, (_, i) => row("m1:" + i, { Name: "R" + i, Vol: i }));
  const sheet = exportSheet({ rows, columns: COLUMNS.slice(0, 3), view: "single", order: all(n) });
  for (const writer of [toCsv, toXlsx]) {
    const seen = [];
    await writer(sheet, { pause: async (f) => seen.push(f) });
    assert.ok(seen.length >= 3, writer.name);
    for (let i = 1; i < seen.length; i++) assert.ok(seen[i] >= seen[i - 1], `${writer.name} monotonic`);
    assert.equal(seen.at(-1), 1, writer.name);
  }
});

test("[unit] toXlsx: openpyxl reads sheet `Tabelle`, bold frozen header, autofilter, numeric cells, texts unchanged, fitted widths", async () => {
  const store = createColumnStore(ROWS);
  const tree = groupRows(store, all(ROWS.length), {
    levels: ["Kat"],
    columns: [
      { key: "Name", mode: "same" },
      { key: "Kat", mode: "same" },
      { key: "Vol", mode: "sum" },
      { key: "Mat", mode: "same" },
    ],
  });
  const sheet = exportSheet({
    rows: ROWS,
    columns: COLUMNS,
    view: "grouped",
    items: groupDisplayRows(tree, () => true),
    total: tree.total,
  });
  const bytes = await toXlsx(sheet);
  assert.deepEqual([...bytes.subarray(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  const x = readBack("xlsx", bytes);
  assert.equal(x.testzip, null);
  assert.deepEqual(x.methods, [8]);
  assert.deepEqual(x.sheetNames, [XLSX_SHEET_NAME]);
  assert.equal(x.freezePanes, "A2");
  assert.equal(x.autoFilter, `A1:G${sheet.rows.length}`); // header + rows, without the total row
  assert.deepEqual(x.sheetChildren, ["dimension", "sheetViews", "sheetFormatPr", "cols", "sheetData", "autoFilter"]);
  assert.equal(x.rows.length, sheet.rows.length + 1);
  assert.deepEqual(
    x.rows[0].map((c) => [c.v, c.t, c.b]),
    sheet.headers.map((h) => [h, "s", true]),
  );
  sheet.rows.forEach((r, i) => {
    const cells = x.rows[i + 1];
    r.forEach((value, j) => {
      const c = cells[j];
      if (value === null) assert.equal(c.v, null, `r${i} c${j}`);
      else if (typeof value === "number") assert.deepEqual([c.v, c.t], [value, "n"], `r${i} c${j}`);
      else assert.deepEqual([c.v, c.t], [value, "s"], `r${i} c${j}`);
      if (value !== null) assert.equal(c.b, sheet.bold[i], `bold r${i} c${j}`);
    });
  });
  // =SUM(A1) is a text cell (REQ-008-AC4), CR LF kept, non-ASCII kept
  const texts = x.rows.flat().map((c) => c.v);
  assert.ok(texts.includes("=SUM(A1)"));
  assert.ok(texts.includes('Zeile 1\r\nZeile 2; "Zitat"'));
  assert.ok(texts.includes("Größe € 漢"));
  for (const w of Object.values(x.widths)) assert.ok(w >= 8 && w <= 80, String(w));
  assert.ok(x.widths.D > x.widths.A, "Name wider than Ebene");
  // equal content gives equal bytes (fixed ZIP timestamps)
  assert.deepEqual(await toXlsx(sheet), bytes);
});

test("[unit] toXlsx edge cases: empty table, no columns, texts over the Excel cell limit, XML special characters", async () => {
  const header = readBack(
    "xlsx",
    await toXlsx(exportSheet({ rows: ROWS, columns: COLUMNS, view: "single", order: [] })),
  );
  assert.deepEqual(
    header.rows.map((r) => r.map((c) => c.v)),
    [["Name", "Kategorie", "Vol (m³)", "Material"]],
  );
  assert.equal(header.autoFilter, "A1:D1");

  const bare = readBack("xlsx", await toXlsx(exportSheet({ rows: ROWS, columns: [], view: "single", order: all(2) })));
  assert.equal(bare.testzip, null);
  assert.equal(bare.autoFilter, null);
  assert.equal(await toCsv(exportSheet({ rows: ROWS, columns: [], view: "single", order: all(2) })), "﻿\r\n\r\n\r\n");

  const long = "x".repeat(XLSX_MAX_TEXT + 10);
  const odd = "<a & b> _x0041_ \u0001 ]]>";
  const rows = [row("m1:1", { Name: long }), row("m1:2", { Name: odd }), row("m1:3", { Name: "  Leerzeichen  " })];
  const x = readBack(
    "xlsx",
    await toXlsx(exportSheet({ rows, columns: COLUMNS.slice(0, 1), view: "single", order: all(3) })),
  );
  assert.equal(x.rows[1][0].v.length, XLSX_MAX_TEXT); // cut to what an Excel cell holds
  // the literal "_x0041_" survives (its "_" is escaped as _x005F_); openpyxl keeps the control character in its
  // OOXML escape form _x0001_ (Excel shows the character)
  assert.equal(x.rows[2][0].v, "<a & b> _x0041_ _x0001_ ]]>");
  assert.equal(x.rows[3][0].v, "  Leerzeichen  ");
  assert.equal(xmlText("a\rb<c>&_x00e4_\u0002￿"), "a&#13;b&lt;c&gt;&amp;_x005F_x00e4__x0002__xFFFF_");
});

test("[unit] crc32, zipArchive (deflate-raw and stored without CompressionStream), columnName", async () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  assert.equal(crc32(new Uint8Array(0)), 0);
  const enc = new TextEncoder();
  const bytes = enc.encode("Hallo ".repeat(100));
  const zip = await zipArchive([{ name: "a.txt", chunks: [bytes.subarray(0, 50), bytes.subarray(50)] }]);
  const view = new DataView(zip.buffer, zip.byteOffset);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  assert.equal(view.getUint16(8, true), 8);
  assert.equal(view.getUint32(14, true), crc32(bytes));
  const size = view.getUint32(18, true);
  assert.deepEqual(new Uint8Array(inflateRawSync(zip.subarray(30 + 5, 30 + 5 + size))), bytes);
  const saved = globalThis.CompressionStream;
  try {
    delete globalThis.CompressionStream;
    const stored = await zipArchive([{ name: "a.txt", chunks: [bytes] }]);
    const v = new DataView(stored.buffer, stored.byteOffset);
    assert.equal(v.getUint16(8, true), 0);
    assert.deepEqual(stored.subarray(35, 35 + bytes.length), bytes);
    const x = readBack(
      "xlsx",
      await toXlsx(exportSheet({ rows: ROWS, columns: COLUMNS, view: "single", order: all(5) })),
    );
    assert.deepEqual(x.methods, [0]);
    assert.equal(x.testzip, null);
    assert.equal(x.rows[1][0].v, "=SUM(A1)");
  } finally {
    globalThis.CompressionStream = saved;
  }
  assert.deepEqual([0, 25, 26, 51, 701, 702].map(columnName), ["A", "Z", "AA", "AZ", "ZZ", "AAA"]);
});
