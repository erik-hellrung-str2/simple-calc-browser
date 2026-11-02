// [unit] tests of the TASK-006a table logic in cv-core (spec REQ-006): default columns, column normalisation and
// widths, moving columns, cell text in German number format, range bounds typed with a decimal comma (TASK-003 D2),
// pruning selections after a row-set change (REQ-001-AC3) and the value range hint of numeric column filters.
// Real-data checks use the AC20-FZK-Haus rows snapshot as INPUT only; expected values come from
// test/fixtures/reference-values.json (STEP-text derivation).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCore } from "../load-core.mjs";

const core = await loadCore();
const {
  DEFAULT_COLUMNS,
  COLUMN_WIDTH,
  clampColumnWidth,
  createColumnStore,
  defaultColumnWidth,
  evaluateFilters,
  filterRows,
  formatCell,
  moveItem,
  normaliseColumns,
  numberRange,
  parseNumberInput,
  pruneSelection,
  sortRows,
} = core;

const fixtures = new URL("../fixtures/", import.meta.url);
const REF = JSON.parse(readFileSync(new URL("reference-values.json", fixtures), "utf8"));
const FZK_ROWS = JSON.parse(readFileSync(new URL("fzk-rows.snapshot.json", fixtures), "utf8")).rows;
const row = (key, values) => ({ key, guid: key, values });

test("[unit] REQ-006 default columns Modell, Kategorie, Name, Geschoss; widths by kind, clamped", () => {
  assert.deepEqual(DEFAULT_COLUMNS, ["Modell", "Kategorie", "Name", "Geschoss"]);
  const catalog = new Map([
    ["Kategorie", { kind: "text" }],
    ["Q.Vol", { kind: "number" }],
  ]);
  assert.deepEqual(normaliseColumns(DEFAULT_COLUMNS, catalog), [
    { key: "Modell", width: COLUMN_WIDTH.text },
    { key: "Kategorie", width: COLUMN_WIDTH.text },
    { key: "Name", width: COLUMN_WIDTH.name },
    { key: "Geschoss", width: COLUMN_WIDTH.text },
  ]);
  assert.equal(defaultColumnWidth("Q.Vol", catalog.get("Q.Vol")), COLUMN_WIDTH.number);
  assert.equal(defaultColumnWidth("X", undefined), COLUMN_WIDTH.text);
  // duplicates, empty and non-string keys dropped; widths clamped and rounded; strings and objects accepted
  assert.deepEqual(
    normaliseColumns(
      [
        "A",
        { key: "B", width: 10 },
        { key: "A", width: 300 },
        "",
        null,
        { key: 5 },
        { key: "C", width: 9999 },
        { key: "D", width: 99.6 },
      ],
      catalog,
    ),
    [
      { key: "A", width: COLUMN_WIDTH.text },
      { key: "B", width: COLUMN_WIDTH.min },
      { key: "C", width: COLUMN_WIDTH.max },
      { key: "D", width: 100 },
    ],
  );
  assert.equal(clampColumnWidth("abc", 123), 123);
  assert.equal(clampColumnWidth(undefined), COLUMN_WIDTH.text);
  assert.equal(clampColumnWidth(-5), COLUMN_WIDTH.min);
  assert.deepEqual(normaliseColumns(undefined), []);
});

test("[unit] REQ-006-AC6 moveItem moves one column (clamped target) and leaves the input unchanged", () => {
  const list = ["a", "b", "c", "d"];
  assert.deepEqual(moveItem(list, 3, 0), ["d", "a", "b", "c"]);
  assert.deepEqual(moveItem(list, 0, 3), ["b", "c", "d", "a"]);
  assert.deepEqual(moveItem(list, 1, 99), ["a", "c", "d", "b"]);
  assert.deepEqual(moveItem(list, 2, -4), ["c", "a", "b", "d"]);
  assert.deepEqual(moveItem(list, 7, 0), list);
  assert.deepEqual(list, ["a", "b", "c", "d"]);
});

test("[unit] REQ-006 cell text: German numbers (thousands '.', decimal ',', <= 3 decimals), multi-values joined, empty cells empty", () => {
  assert.equal(formatCell(1234567.891), "1.234.567,891");
  assert.equal(formatCell(5.80797), "5,808");
  assert.equal(formatCell(0.12345), "0,123");
  assert.equal(formatCell(-2.5), "-2,5");
  assert.equal(formatCell(24), "24");
  assert.equal(formatCell("1.5"), "1.5", "numeric-looking text stays as typed (DEC-5)");
  assert.equal(formatCell(["Holz", "Glas"]), "Holz, Glas");
  assert.equal(formatCell(["Holz", null, "", 2.5]), "Holz, 2,5");
  for (const empty of [undefined, null, "", [], NaN, Infinity]) assert.equal(formatCell(empty), "", String(empty));
  assert.equal(formatCell("Ja"), "Ja");
});

test("[unit] D2 range bounds: German decimal comma and point accepted, empty = no bound, other text invalid", () => {
  const ok = (text, value) => assert.deepEqual(parseNumberInput(text), { value, valid: true }, JSON.stringify(text));
  const bad = (text) => assert.deepEqual(parseNumberInput(text), { value: null, valid: false }, JSON.stringify(text));
  ok("2,5", 2.5);
  ok("2.5", 2.5);
  ok(" 5 ", 5);
  ok("-0,75", -0.75);
  ok("+3", 3);
  ok(",5", 0.5);
  ok("2,", 2);
  ok("1.234,5", 1234.5);
  ok("1.234.567,25", 1234567.25);
  ok("1.234", 1.234); // without a comma the point is the decimal separator
  ok("", null);
  ok("   ", null);
  ok(null, null);
  ok(undefined, null);
  ok(0, 0);
  for (const text of ["abc", "2,5,3", "1,234.5", "1e3", "2 5", "--1", ".", ",", "+", "12a", "1.23.4", "Infinity"])
    bad(text);
});

test("[unit] REQ-006-AC9 + D2: bounds parsed from '2,5' / '2' / '5' filter like the numbers (inclusive, empty excluded)", () => {
  const rows = [1.9, 2, 2.5, 3.5, 5, 5.1, undefined, "4"].map((v, i) => row("r" + i, { V: v }));
  const store = createColumnStore(rows);
  const range = (min, max) => {
    const filter = {
      id: "col:V",
      key: "V",
      type: "range",
      min: parseNumberInput(min).value,
      max: parseNumberInput(max).value,
    };
    return Array.from(filterRows(store, [filter]), (i) => rows[i].key);
  };
  assert.deepEqual(range("2", "5"), ["r1", "r2", "r3", "r4"]);
  assert.deepEqual(range("2,5", ""), ["r2", "r3", "r4", "r5"]);
  assert.deepEqual(range("", "2,0"), ["r0", "r1"]);
  assert.equal(range("", "").length, rows.length, "no bound: no filter");
});

test("[unit] REQ-006-AC9 fzk-range reference: `von` 2 `bis` 5 keeps exactly the reference walls", () => {
  const ref = REF["REQ-006-AC9"];
  const rows = Object.entries(ref.byGlobalId).map(([guid, v]) => row(guid, { [ref.property]: v }));
  for (let i = 0; i < ref.elementsWithoutValue; i++) rows.push(row("empty" + i, {}));
  const store = createColumnStore(rows);
  for (const name of ["von 2 bis 5", "von 2,5"]) {
    const spec = ref[name];
    const min = spec.input ? parseNumberInput(spec.input).value : spec.min;
    const keys = Array.from(
      filterRows(store, [{ key: ref.property, type: "range", min, max: spec.max }]),
      (i) => rows[i].key,
    );
    assert.deepEqual(keys.sort(), [...spec.expectedGlobalIds].sort(), name);
  }
});

test("[unit] REQ-001-AC3 pruneSelection keeps values that still occur (incl. (leer) while a row is empty), drops the rest", () => {
  const rows = [row("a", { K: "Wand", M: ["Holz", "Glas"] }), row("b", { K: "Decke" }), row("c", { K: 3 })];
  const store = createColumnStore(rows);
  assert.deepEqual(pruneSelection(store, "K", ["Wand", "Tuer", 3, "3", null, undefined]), ["Wand", 3]);
  assert.deepEqual(pruneSelection(store, "M", ["Glas", null, "Stahl"]), ["Glas", null]);
  assert.deepEqual(pruneSelection(store, "K", []), []);
  assert.deepEqual(pruneSelection(store, "Unbekannt", [null, "x"]), [null]);
  assert.deepEqual(pruneSelection(createColumnStore([]), "K", ["Wand", null]), []);
  assert.deepEqual(pruneSelection(rows, "K", undefined), []);
});

test("[unit] REQ-006 numberRange: min / max of a numeric column among the rows of a bitset", () => {
  const rows = [3, -1, 7.5, undefined, "9", NaN].map((v, i) => row("r" + i, { V: v }));
  const store = createColumnStore(rows);
  assert.deepEqual(numberRange(store, "V"), { min: -1, max: 7.5 });
  const ev = evaluateFilters(store, [{ id: "set", key: "V", type: "values", values: [3, "9"] }]);
  assert.deepEqual(numberRange(store, "V", ev.pass), { min: 3, max: 3 });
  assert.equal(numberRange(store, "Nichts"), null);
  assert.equal(numberRange(createColumnStore([]), "V"), null);
});

test("[unit] REQ-006-AC5 FZK NetVolume column descending: reference values in order, empty cells last", () => {
  const ref = REF["AC20-FZK-Haus"].columnValues["BaseQuantities.NetVolume"];
  const store = createColumnStore(FZK_ROWS);
  const all = filterRows(store, []);
  const order = sortRows(store, all, { key: "BaseQuantities.NetVolume", dir: "desc" });
  const values = Array.from(order, (i) => FZK_ROWS[i].values["BaseQuantities.NetVolume"]);
  const expected = Object.values(ref.byGlobalId).sort((a, b) => b - a);
  const shown = values.slice(0, ref.carriers);
  shown.forEach((v, i) =>
    assert.ok(Math.abs(v - expected[i]) <= 1e-9 * Math.max(1, Math.abs(expected[i])), `${i}: ${v}`),
  );
  assert.ok(
    values.slice(ref.carriers).every((v) => v === undefined),
    "empty values last",
  );
  // ascending as well: smallest first, empty still last
  const asc = sortRows(store, all, { key: "BaseQuantities.NetVolume", dir: "asc" });
  assert.equal(FZK_ROWS[asc[0]].values["BaseQuantities.NetVolume"], Math.min(...expected));
  assert.equal(FZK_ROWS[asc[asc.length - 1]].values["BaseQuantities.NetVolume"], undefined);
});
