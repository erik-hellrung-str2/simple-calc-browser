// [unit] tests of the TASK-003 filter engine in cv-core (spec REQ-004, REQ-006 filter/sort logic, §4.3 column
// store, §4.4 filterRows / facetCounts / sortRows, DEC-14, DEC-17).
// Real-data tests use the builder's AC20-FZK-Haus rows from test/fixtures/fzk-rows.snapshot.json (kept equal to the
// live extraction by test/integration/fzk-rows-snapshot.spec.mjs) as INPUT only; every expected key set and count
// comes from test/fixtures/reference-values.json (derived from the STEP text, independent of the product code).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCore } from "../load-core.mjs";

const core = await loadCore();
const { createColumnStore, filterRows, facetCounts, sortRows, evaluateFilters, sortByValue } = core;

const fixtures = new URL("../fixtures/", import.meta.url);
const REF = JSON.parse(readFileSync(new URL("reference-values.json", fixtures), "utf8"))["AC20-FZK-Haus"];
const FZK_ROWS = JSON.parse(readFileSync(new URL("fzk-rows.snapshot.json", fixtures), "utf8")).rows;

const guidsOf = (rows, indices) => [...indices].map((i) => rows[i].guid).sort();
const valueMap = (facet) =>
  Object.fromEntries(facet.values.map((e) => [e.value === null ? "(leer)" : e.value, e.count]));
const row = (key, values) => ({ key, guid: key, values });

// ---------------------------------------------------------------------------------------------------------------
// REQ-004 on AC20-FZK-Haus (expected values from reference-values.json)
// ---------------------------------------------------------------------------------------------------------------

test("[unit] REQ-004-AC1 Kategorie = IfcWallStandardCase OR IfcSlab gives exactly the reference key set", () => {
  const ac = REF.filters["REQ-004-AC1"];
  const store = createColumnStore(FZK_ROWS);
  const filters = [{ key: "Kategorie", type: "values", values: ac.filter.Kategorie }];
  const result = filterRows(store, filters);
  assert.equal(result.length, ac.expectedCount);
  assert.deepEqual(guidsOf(FZK_ROWS, result), [...ac.expectedGlobalIds].sort());
});

test("[unit] REQ-004-AC2 adding Geschoss = ground floor: AND across sets; Kategorie counts on that storey", () => {
  const ac = REF.filters["REQ-004-AC2"];
  const store = createColumnStore(FZK_ROWS);
  const filters = [
    { key: "Kategorie", type: "values", values: ac.filter.Kategorie },
    { key: "Geschoss", type: "values", values: ac.filter.Geschoss },
  ];
  assert.deepEqual(ac.filter.Geschoss, [ac.groundFloorStorey.Name]);
  const result = filterRows(store, filters);
  assert.equal(result.length, ac.expectedCount);
  assert.deepEqual(guidsOf(FZK_ROWS, result), [...ac.expectedGlobalIds].sort());

  // The Kategorie set is counted under the Geschoss filter only (its own selection excluded): exactly the
  // categories on the ground floor with their counts there. IfcAnnotation is a row class of the extractor
  // (present in the rows), so its conditional count applies; IfcSpace rows are hidden by default (DEC-13).
  const facets = facetCounts(store, filters, ["Kategorie", "Geschoss"]);
  const kategorieRowClasses = new Set(FZK_ROWS.map((r) => r.values.Kategorie));
  const expected = { ...ac.kategorieCountsOnGroundFloor };
  for (const [k, n] of Object.entries(ac.kategorieCountsOnGroundFloorConditional))
    if (kategorieRowClasses.has(k)) expected[k] = n;
  assert.deepEqual(valueMap(facets.get("Kategorie")), expected);
  // checked values flagged, checking never hides the other values of the same set
  const checked = facets
    .get("Kategorie")
    .values.filter((e) => e.checked)
    .map((e) => e.value);
  assert.deepEqual(checked.sort(), [...ac.filter.Kategorie].sort());
  assert.equal(facets.get("Kategorie").checkedCount, 2);
  // the Geschoss set is counted under the Kategorie filter: the walls and slabs per storey (AC1 key set)
  const ac1 = new Set(REF.filters["REQ-004-AC1"].expectedGlobalIds);
  const perStorey = {};
  for (const r of FZK_ROWS)
    if (ac1.has(r.guid)) perStorey[r.values.Geschoss ?? "(leer)"] = (perStorey[r.values.Geschoss ?? "(leer)"] || 0) + 1;
  assert.deepEqual(valueMap(facets.get("Geschoss")), perStorey);
  assert.equal(
    facets.get("Geschoss").values.find((e) => e.value === ac.groundFloorStorey.Name).count,
    ac.expectedCount,
  );
});

test("[unit] REQ-004-AC3 DEC-14 a checked value with 0 hits after another filter changes stays, checked, count 0", () => {
  const store = createColumnStore(FZK_ROWS);
  // IfcStair exists only on the ground floor (reference counts); Geschoss = top storey leaves it with 0 hits
  const ac = REF.filters["REQ-004-AC2"];
  assert.equal(ac.kategorieCountsOnGroundFloor.IfcStair, 1);
  assert.equal(REF.elementsInStepTextByKategorie.IfcStair, 1);
  const top = REF.storeys.find((s) => s.Name !== ac.groundFloorStorey.Name).Name;
  const filters = [
    { key: "Kategorie", type: "values", values: ["IfcStair"] },
    { key: "Geschoss", type: "values", values: [top] },
  ];
  assert.equal(filterRows(store, filters).length, 0);
  const kat = facetCounts(store, filters, ["Kategorie"]).get("Kategorie");
  const stair = kat.values.find((e) => e.value === "IfcStair");
  assert.deepEqual(stair, { value: "IfcStair", count: 0, checked: true });
  // unchecked values with 0 hits on that storey are hidden: no IfcDoor/IfcWindow etc. with count 0
  for (const e of kat.values) if (!e.checked) assert.ok(e.count > 0, `${e.value} hidden`);
  // a checked value that does not exist in the data at all (e.g. from a configuration) also stays visible
  const ghost = facetCounts(store, [{ key: "Kategorie", type: "values", values: ["IfcNirgends"] }], ["Kategorie"]);
  assert.deepEqual(
    ghost.get("Kategorie").values.find((e) => e.value === "IfcNirgends"),
    { value: "IfcNirgends", count: 0, checked: true },
  );
});

test("[unit] REQ-004-AC4 resetting all filters (filter sets and column filters) gives every element", () => {
  const store = createColumnStore(FZK_ROWS);
  const total = Object.values(REF.elementsInStepTextByKategorie).reduce((a, b) => a + b, 0);
  // the extractor lists no IfcOpeningElement rows (TASK-002); every other STEP element is a row
  assert.equal(FZK_ROWS.length, total - REF.elementsInStepTextByKategorie.IfcOpeningElement);
  const filters = [
    { key: "Kategorie", type: "values", values: ["IfcSlab"] },
    { id: "col:Name", key: "Name", type: "values", values: ["Bodenplatte"] },
    { id: "col:Vol", key: "BaseQuantities.NetVolume", type: "range", min: 1, max: null },
  ];
  assert.ok(filterRows(store, filters).length < FZK_ROWS.length);
  const reset = filters.map((f) => (f.type === "range" ? { ...f, min: null, max: null } : { ...f, values: [] }));
  assert.equal(core.activeFilters(reset).length, 0);
  assert.equal(filterRows(store, reset).length, FZK_ROWS.length);
  assert.equal(filterRows(store, []).length, FZK_ROWS.length);
  const kat = facetCounts(store, [], ["Kategorie"]).get("Kategorie");
  const expected = { ...REF.elementsInStepTextByKategorie };
  delete expected.IfcOpeningElement;
  assert.deepEqual(valueMap(kat), expected);
});

test("[unit] REQ-006-AC4 column filter Name = one reference element narrows rows and filter set counts", () => {
  const ref = REF.elements.find((e) => e.Kategorie === "IfcWallStandardCase");
  const store = createColumnStore(FZK_ROWS);
  const filters = [{ id: "col:Name", key: "Name", type: "values", values: [ref.Name] }];
  const result = filterRows(store, filters);
  assert.deepEqual(guidsOf(FZK_ROWS, result), [ref.GlobalId]);
  const facets = facetCounts(store, filters, ["Kategorie", "Geschoss"]);
  assert.deepEqual(valueMap(facets.get("Kategorie")), { [ref.Kategorie]: 1 });
  assert.deepEqual(valueMap(facets.get("Geschoss")), { [ref.Geschoss]: 1 });
});

test("[unit] REQ-006-AC5 numeric sort on FZK NetVolume: descending by value, empty last, ascending mirrors it", () => {
  const store = createColumnStore(FZK_ROWS);
  const all = filterRows(store, []);
  const key = "BaseQuantities.NetVolume";
  const ref = REF.elements.find((e) => e.quantities && e.quantities[key]);
  for (const dir of ["desc", "asc"]) {
    const sorted = [...sortRows(store, all, { key, dir })].map((i) => FZK_ROWS[i].values[key]);
    const firstEmpty = sorted.findIndex((v) => v === undefined);
    assert.ok(firstEmpty > 0, "some rows have a NetVolume, some do not");
    assert.ok(
      sorted.slice(firstEmpty).every((v) => v === undefined),
      `${dir}: empty last`,
    );
    const nums = sorted.slice(0, firstEmpty);
    for (let i = 1; i < nums.length; i++) assert.ok(dir === "desc" ? nums[i - 1] >= nums[i] : nums[i - 1] <= nums[i]);
    assert.ok(nums.some((v) => Math.abs(v - ref.quantities[key].value) <= 1e-9 * ref.quantities[key].value));
  }
});

// ---------------------------------------------------------------------------------------------------------------
// REQ-006 column filters and sorting (synthetic rows)
// ---------------------------------------------------------------------------------------------------------------

test("[unit] REQ-006-AC9 DEC-17 range von 2 bis 5: 2 and 5 included; 1.9, 5.1 and empty excluded", () => {
  const values = [1.9, 2, 3.5, 5, 5.1, undefined, null, "", 4];
  const rows = values.map((v, i) => row("r" + i, v === undefined ? {} : { Wert: v }));
  const keep = (min, max) =>
    [...filterRows(rows, [{ key: "Wert", type: "range", min, max }])].map((i) => rows[i].values.Wert);
  assert.deepEqual(keep(2, 5), [2, 3.5, 5, 4]);
  // one bound only: the other side is open; empty values still excluded while a bound is set
  assert.deepEqual(keep(2, null), [2, 3.5, 5, 5.1, 4]);
  assert.deepEqual(keep("", 2), [1.9, 2]);
  // no bound at all: no filter, empty values included
  assert.equal(keep(null, null).length, rows.length);
  assert.equal(keep("", undefined).length, rows.length);
  // bounds given as text (input fields) are numbers; min > max matches nothing
  assert.deepEqual(keep("2", "5"), [2, 3.5, 5, 4]);
  assert.deepEqual(keep(5, 2), []);
});

test("[unit] REQ-006 text column filter: checklist OR within the column, AND with filter sets and other columns", () => {
  const rows = [
    row("a", { Kategorie: "Wand", Name: "W1", Volumen: 1 }),
    row("b", { Kategorie: "Wand", Name: "W2", Volumen: 3 }),
    row("c", { Kategorie: "Decke", Name: "D1", Volumen: 3 }),
    row("d", { Kategorie: "Decke", Volumen: 7 }),
  ];
  const ids = (filters) => [...filterRows(rows, filters)].map((i) => rows[i].key);
  const nameCol = { id: "col:Name", key: "Name", type: "values", values: ["W1", "D1", null] };
  assert.deepEqual(ids([nameCol]), ["a", "c", "d"]);
  assert.deepEqual(ids([nameCol, { key: "Kategorie", type: "values", values: ["Decke"] }]), ["c", "d"]);
  assert.deepEqual(
    ids([nameCol, { key: "Kategorie", type: "values", values: ["Decke"] }, { key: "Volumen", type: "range", max: 5 }]),
    ["c"],
  );
  // a column filter on the same property as a filter set is a separate filter (own id): the set's counts honour it
  const facets = facetCounts(rows, [nameCol, { key: "Name", type: "values", values: ["W1"] }], ["Name"]);
  assert.deepEqual(valueMap(facets.get("Name")), { W1: 1, D1: 1, "(leer)": 1 });
});

test("[unit] REQ-006 sortRows: numbers numerically, text alphabetically, empty last in both directions, stable", () => {
  const rows = [
    row("a", { Zahl: 10, Text: "b" }),
    row("b", { Zahl: 9, Text: "B" }),
    row("c", { Text: "a" }),
    row("d", { Zahl: 100, Text: "" }),
    row("e", { Zahl: 9, Text: "c" }),
    row("f", { Zahl: -1.5 }),
  ];
  const order = (key, dir) => [...sortRows(rows, [0, 1, 2, 3, 4, 5], { key, dir })].map((i) => rows[i].key);
  assert.deepEqual(order("Zahl", "asc"), ["f", "b", "e", "a", "d", "c"]);
  assert.deepEqual(order("Zahl", "desc"), ["d", "a", "b", "e", "f", "c"]);
  assert.deepEqual(order("Text", "asc"), ["c", "a", "b", "e", "d", "f"]);
  assert.deepEqual(order("Text", "desc"), ["e", "b", "a", "c", "d", "f"]);
  assert.deepEqual(order(null), ["a", "b", "c", "d", "e", "f"]);
  // a subset of indices keeps only those rows; ties (9, 9) keep the given order
  assert.deepEqual([...sortRows(rows, [4, 0, 1], { key: "Zahl", dir: "asc" })], [4, 1, 0]);
  // numbers inside a text column sort numerically and before texts; numeric-looking texts sort as text (DEC-5)
  const mixed = [row("x", { V: "10" }), row("y", { V: 9 }), row("z", { V: 10 }), row("w", { V: "9" })];
  assert.deepEqual(
    [...sortRows(mixed, [0, 1, 2, 3], { key: "V", dir: "asc" })].map((i) => mixed[i].key),
    ["y", "z", "x", "w"],
  );
});

test("[unit] REQ-006-AC5 sortByValue orders groups by their sums, empty sums last, stable", () => {
  const groups = [
    { g: "A", sum: 5 },
    { g: "B", sum: null },
    { g: "C", sum: 12.5 },
    { g: "D", sum: 5 },
    { g: "E", sum: NaN },
  ];
  assert.deepEqual(
    sortByValue(groups, (x) => x.sum, "desc").map((x) => x.g),
    ["C", "A", "D", "B", "E"],
  );
  assert.deepEqual(
    sortByValue(groups, (x) => x.sum, "asc").map((x) => x.g),
    ["A", "D", "C", "B", "E"],
  );
  assert.deepEqual(
    sortByValue([{ v: ["b", "c"] }, { v: ["a"] }, { v: "b" }], (x) => x.v, "asc").map((x) => core.displayValue(x.v)),
    ["a", "b", "b, c"],
  );
});

test("[unit] REQ-006 sortRows on a multi-valued column compares the displayed text (values joined with ', ')", () => {
  const rows = [
    row("a", { Material: ["Beton", "Putz"] }),
    row("b", { Material: ["Beton"] }),
    row("c", { Material: [] }),
    row("d", { Material: ["Aluminium", "Glas"] }),
  ];
  assert.deepEqual(
    [...sortRows(rows, [0, 1, 2, 3], { key: "Material", dir: "asc" })].map((i) => rows[i].key),
    ["d", "b", "a", "c"],
  );
});

// ---------------------------------------------------------------------------------------------------------------
// Facets: multi-valued properties, value order, (leer), hidden values
// ---------------------------------------------------------------------------------------------------------------

test("[unit] REQ-004 REQ-002-AC4 multi-valued Material: matches if any value checked, counted once per value", () => {
  const rows = [
    row("a", { Material: ["Beton", "Daemmung"], Geschoss: "EG" }),
    row("b", { Material: ["Beton"], Geschoss: "EG" }),
    row("c", { Material: ["Daemmung", "Putz"], Geschoss: "OG" }),
    row("d", { Material: [], Geschoss: "OG" }),
    row("e", { Geschoss: "OG" }),
  ];
  const ids = (filters) => [...filterRows(rows, filters)].map((i) => rows[i].key);
  assert.deepEqual(ids([{ key: "Material", type: "values", values: ["Daemmung"] }]), ["a", "c"]);
  assert.deepEqual(ids([{ key: "Material", type: "values", values: ["Putz", "Beton"] }]), ["a", "b", "c"]);
  assert.deepEqual(ids([{ key: "Material", type: "values", values: [null] }]), ["d", "e"]);
  const f = [{ key: "Geschoss", type: "values", values: ["EG"] }];
  const mat = facetCounts(rows, f, ["Material"]).get("Material");
  assert.deepEqual(mat.values, [
    { value: "Beton", count: 2, checked: false },
    { value: "Daemmung", count: 1, checked: false },
  ]);
  assert.equal(mat.total, 2);
  const all = facetCounts(rows, [], ["Material"]).get("Material");
  assert.deepEqual(valueMap(all), { Beton: 2, Daemmung: 2, Putz: 1, "(leer)": 2 });
  // duplicates inside one cell count once
  const dup = facetCounts([row("x", { M: ["A", "A", "B"] })], [], ["M"]).get("M");
  assert.deepEqual(valueMap(dup), { A: 1, B: 1 });
});

test("[unit] REQ-004 value order: numbers numerically, text alphabetically (German), (leer) last", () => {
  const rows = [10, 9, 100, 2.5, undefined, "", -3, 9].map((v, i) => row("n" + i, v === undefined ? {} : { N: v }));
  const n = facetCounts(rows, [], ["N"]).get("N");
  assert.deepEqual(
    n.values.map((e) => [e.value, e.count]),
    [
      [-3, 1],
      [2.5, 1],
      [9, 2],
      [10, 1],
      [100, 1],
      [null, 2],
    ],
  );
  const texts = ["Zimmer", "Ärger", "apfel", "Birne", "Apfel", "10", "9"].map((v, i) => row("t" + i, { T: v }));
  texts.push(row("t-num", { T: 7 }));
  const t = facetCounts(texts, [], ["T"]).get("T");
  assert.deepEqual(
    t.values.map((e) => e.value),
    [7, "10", "9", "apfel", "Apfel", "Ärger", "Birne", "Zimmer"],
  );
  assert.equal(core.EMPTY_LABEL, "(leer)");
});

test("[unit] REQ-004 checking a value never hides the other values of the same set (own selection excluded)", () => {
  const rows = [row("a", { K: "A", G: "1" }), row("b", { K: "B", G: "1" }), row("c", { K: "C", G: "2" })];
  const filters = [{ key: "K", type: "values", values: ["A"] }];
  const k = facetCounts(rows, filters, ["K", "G"]);
  assert.deepEqual(valueMap(k.get("K")), { A: 1, B: 1, C: 1 });
  assert.deepEqual(valueMap(k.get("G")), { 1: 1 });
  // with a second set, each set excludes only its own selection
  const two = facetCounts(rows, [...filters, { key: "G", type: "values", values: ["2"] }], ["K", "G"]);
  assert.deepEqual(valueMap(two.get("K")), { A: 0, C: 1 });
  assert.deepEqual(valueMap(two.get("G")), { 1: 1, 2: 0 });
  assert.equal(two.get("G").values.find((e) => e.value === "2").checked, true);
  // number vs text identity: 1 and "1" are different values
  const ident = [row("p", { V: 1 }), row("q", { V: "1" })];
  assert.deepEqual([...filterRows(ident, [{ key: "V", type: "values", values: [1] }])], [0]);
  assert.deepEqual([...filterRows(ident, [{ key: "V", type: "values", values: ["1"] }])], [1]);
});

// ---------------------------------------------------------------------------------------------------------------
// Column store (spec 4.3): lazy, cached, dropped when unused
// ---------------------------------------------------------------------------------------------------------------

test("[unit] column store builds only properties in use, caches them and drops unused ones", () => {
  const store = createColumnStore(FZK_ROWS);
  assert.deepEqual(store.keys(), []);
  const filters = [{ key: "Kategorie", type: "values", values: ["IfcSlab"] }];
  facetCounts(store, filters, ["Geschoss"]);
  assert.deepEqual(store.keys().sort(), ["Geschoss", "Kategorie"]);
  const col = store.column("Kategorie");
  facetCounts(store, filters, ["Geschoss"]);
  assert.equal(store.column("Kategorie"), col, "cached");
  assert.equal(col.masks.size, 1, "filter bitset cached");
  sortRows(store, filterRows(store, filters), { key: "Name", dir: "asc" });
  assert.ok(store.has("Name"));
  store.retain(["Kategorie"]);
  assert.deepEqual(store.keys(), ["Kategorie"]);
  assert.equal(store.has("Geschoss"), false);
  // dictionary coding: distinct values once, empty value last
  const ges = store.column("Geschoss");
  assert.deepEqual(ges.values, ["Dachgeschoss", "Erdgeschoss", null]);
  assert.equal(ges.single, true);
  assert.equal(ges.flat.length, FZK_ROWS.length);
  // the bitset cache is bounded
  for (let i = 0; i < 40; i++) filterRows(store, [{ key: "Kategorie", type: "values", values: ["X" + i] }]);
  assert.ok(store.column("Kategorie").masks.size <= 16);
});

test("[unit] evaluateFilters once serves filterRows and facetCounts with the same result", () => {
  const store = createColumnStore(FZK_ROWS);
  const ac = REF.filters["REQ-004-AC2"];
  const ev = evaluateFilters(store, [
    { key: "Kategorie", type: "values", values: ac.filter.Kategorie },
    { key: "Geschoss", type: "values", values: ac.filter.Geschoss },
  ]);
  assert.equal(filterRows(ev).length, ac.expectedCount);
  assert.deepEqual(valueMap(facetCounts(ev, null, ["Kategorie"]).get("Kategorie")), {
    ...ac.kategorieCountsOnGroundFloor,
    ...ac.kategorieCountsOnGroundFloorConditional,
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Edge cases (property-based style: generated rows checked against a naive reference implementation)
// ---------------------------------------------------------------------------------------------------------------

test("[unit] edge cases: no rows, single row, everything filtered out, unknown property", () => {
  assert.deepEqual([...filterRows([], [{ key: "K", type: "values", values: ["A"] }])], []);
  assert.deepEqual(facetCounts([], [], ["K"]).get("K"), { id: "K", key: "K", total: 0, checkedCount: 0, values: [] });
  assert.deepEqual([...sortRows([], [], { key: "K", dir: "asc" })], []);
  const one = [row("only", { K: "A", N: 3 })];
  assert.deepEqual([...filterRows(one, [])], [0]);
  assert.deepEqual(facetCounts(one, [], ["K"]).get("K").values, [{ value: "A", count: 1, checked: false }]);
  const none = [{ key: "K", type: "values", values: ["B"] }];
  assert.deepEqual([...filterRows(one, none)], []);
  assert.deepEqual(facetCounts(one, none, ["K", "N"]).get("N").values, []);
  assert.deepEqual(facetCounts(one, none, ["K"]).get("K").values, [
    { value: "A", count: 1, checked: false },
    { value: "B", count: 0, checked: true },
  ]);
  // an array holding only empty entries is empty
  assert.deepEqual(valueMap(facetCounts([row("e", { M: ["", null] })], [], ["M"]).get("M")), { "(leer)": 1 });
  // a property no row has: every row is (leer)
  assert.deepEqual(valueMap(facetCounts(one, [], ["Fehlt"]).get("Fehlt")), { "(leer)": 1 });
  // filters without a key or without anything checked do not restrict
  assert.equal(filterRows(one, [null, { type: "values", values: ["x"] }, { key: "K", values: [] }]).length, 1);
  // facet ids: a facet with its own id excludes only that filter
  const f = facetCounts(one, [{ id: "col:K", key: "K", values: ["B"] }], [{ id: "set:K", key: "K" }]);
  assert.deepEqual(f.get("set:K").values, []);
});

/** Deterministic pseudo-random generator (mulberry32). */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("[unit] property check: filterRows and facetCounts equal a naive implementation on 200 random cases", () => {
  const cell = (v) =>
    v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length) ? [null] : [].concat(v);
  const matches = (r, f) => {
    if (f.type === "range") {
      const v = r.values[f.key];
      if (typeof v !== "number") return false;
      return (f.min === null || v >= f.min) && (f.max === null || v <= f.max);
    }
    return cell(r.values[f.key]).some((v) => f.values.includes(v));
  };
  for (let seed = 1; seed <= 200; seed++) {
    const rand = rng(seed);
    const pick = (list) => list[Math.floor(rand() * list.length)];
    const n = Math.floor(rand() * 40);
    const rows = [];
    for (let i = 0; i < n; i++) {
      const values = {};
      if (rand() < 0.8) values.A = pick(["x", "y", "z", 1, 2]);
      if (rand() < 0.7) values.B = Array.from({ length: Math.floor(rand() * 3) }, () => pick(["p", "q", "r"]));
      if (rand() < 0.7) values.N = Math.round(rand() * 100) / 10;
      rows.push(row("k" + i, values));
    }
    const filters = [];
    if (rand() < 0.6) filters.push({ key: "A", type: "values", values: [pick(["x", "y", 1, null])] });
    if (rand() < 0.6) filters.push({ key: "B", type: "values", values: [pick(["p", "q", null]), pick(["r", "w"])] });
    if (rand() < 0.5)
      filters.push({ key: "N", type: "range", min: rand() < 0.7 ? 2 : null, max: rand() < 0.7 ? 7 : null });
    const active = filters.filter((f) => f.type !== "range" || f.min !== null || f.max !== null);
    const expected = rows.map((r, i) => (active.every((f) => matches(r, f)) ? i : -1)).filter((i) => i >= 0);
    assert.deepEqual([...filterRows(rows, filters)], expected, `seed ${seed}`);
    const facets = facetCounts(rows, filters, ["A", "B"]);
    for (const key of ["A", "B"]) {
      const others = active.filter((f) => f.key !== key);
      const counts = new Map();
      for (const r of rows) {
        if (!others.every((f) => matches(r, f))) continue;
        for (const v of new Set(cell(r.values[key]))) counts.set(v, (counts.get(v) || 0) + 1);
      }
      const own = active.find((f) => f.key === key);
      const want = [...counts].filter(([, c]) => c > 0).map(([v]) => v);
      for (const v of own ? own.values : []) if (!want.includes(v)) want.push(v);
      want.sort(core.compareValues);
      const got = facets.get(key).values;
      assert.deepEqual(
        got.map((e) => e.value),
        want,
        `seed ${seed} ${key} values`,
      );
      for (const e of got) assert.equal(e.count, counts.get(e.value) || 0, `seed ${seed} ${key}=${e.value}`);
    }
    const sorted = [...sortRows(rows, expected, { key: "N", dir: "desc" })].map((i) => rows[i].values.N);
    const firstEmpty = sorted.findIndex((v) => v === undefined);
    const head = firstEmpty === -1 ? sorted : sorted.slice(0, firstEmpty);
    if (firstEmpty !== -1) assert.ok(sorted.slice(firstEmpty).every((v) => v === undefined));
    for (let i = 1; i < head.length; i++) assert.ok(head[i - 1] >= head[i], `seed ${seed} sort`);
  }
});

test("[unit] cv-core stays ASCII-only and free of </script> after the filter engine (spec 4.2)", () => {
  const html = readFileSync(new URL("../../calc-viewer-builder.html", import.meta.url), "utf8");
  const src = /<script type="text\/plain" id="cv-core-src">([\s\S]*?)<\/script>/.exec(html)[1];
  assert.ok(/export function facetCounts/.test(src));
  assert.ok(
    [...src].every((ch) => ch.charCodeAt(0) < 128),
    "ASCII only",
  );
});
