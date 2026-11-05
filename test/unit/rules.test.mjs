// [unit] tests of the TASK-011 filter sources in cv-core (CR-002): rules (isolate, hide, mark, text = `Freie
// Textsuche`), the search field, the key sets of the element tools (include = isolated set, exclude = hidden set), the
// mark mask, the display-text index and facet counts under all of them (spec 4.3 filter sources, 4.4, DEC-14, DEC-18,
// DEC-19).
// Spec Testing T5: these tests check the core logic of UI-level acceptance criteria; they cite those ACs in comments
// only (REQ-012-AC3..AC9 logic, REQ-004-AC5 logic, REQ-013 key-set logic), so the trace check keeps requiring the UI
// tests of TASK-015b/017a.
// Expected values: hand-derived from the synthetic rows below (each expectation states the rows it follows from), from
// test/fixtures/reference-values.json (counts read from the STEP text, independent of the product code), or from an
// independent naive oracle written in this file (per value, per row, toLocaleString - not the index or the column
// store of the product).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCore } from "../load-core.mjs";

const core = await loadCore();
const {
  createColumnStore,
  evaluateFilters,
  filterRows,
  facetCounts,
  markRows,
  bitsToIndices,
  describeRule,
  displayText,
  valueTexts,
  normaliseRule,
  normaliseFilter,
  matchText,
  RULE_MODES,
  RULE_OPS,
  MARK_COLOUR,
  TEXT_SEPARATOR,
} = core;

const fixtures = new URL("../fixtures/", import.meta.url);
const REF = JSON.parse(readFileSync(new URL("reference-values.json", fixtures), "utf8"))["AC20-FZK-Haus"];
const FZK_ROWS = JSON.parse(readFileSync(new URL("fzk-rows.snapshot.json", fixtures), "utf8")).rows.map((r) => ({
  ...r,
  key: "fzk:" + r.guid,
}));

// ---------------------------------------------------------------------------------------------------------------
// Synthetic rows: one per kind of value (text, number display text, multi, bool, empty, missing)
// ---------------------------------------------------------------------------------------------------------------
//   key  Name                Vol (number)  Len (number)  Mat (multi)          Tragend (bool)  Note
//   r1   Wand-Ext-ERDG-1     0.3 -> "0,3"  1234.5 ->     [Beton, Putz]        Ja              W\u00e4rmed\u00e4mmung
//                                          "1.234,5"
//   r2   Wand-Int            12 -> "12"    0.33333 ->    [Putz]               Nein            ""   (empty)
//                                          "0,333"
//   r3   T\u00fcr                 (missing)     "" (empty)    [] (empty)           (missing)       (missing)
//   r4   wand                1.5 -> "1,5"  -0.25 ->      "Holz" (single)      Ja              W\u00c4RME
//                                          "-0,25"
//   r5   <img src=x onerror=alert(1)>  -   -             -                    -               "a\u0001b" (control)
const ROWS = [
  {
    key: "m:1",
    values: {
      Name: "Wand-Ext-ERDG-1",
      Vol: 0.3,
      Len: 1234.5,
      Mat: ["Beton", "Putz"],
      Tragend: "Ja",
      Note: "W\u00e4rmed\u00e4mmung",
    },
  },
  { key: "m:2", values: { Name: "Wand-Int", Vol: 12, Len: 0.33333, Mat: ["Putz"], Tragend: "Nein", Note: "" } },
  { key: "m:3", values: { Name: "T\u00fcr", Len: "", Mat: [] } },
  { key: "m:4", values: { Name: "wand", Vol: 1.5, Len: -0.25, Mat: "Holz", Tragend: "Ja", Note: "W\u00c4RME" } },
  { key: "m:5", values: { Name: "<img src=x onerror=alert(1)>", Note: "a\u0001b" } },
];
const ALL = ["m:1", "m:2", "m:3", "m:4", "m:5"];

const keysOf = (store, indices) => [...indices].map((i) => store.rows[i].key);
const run = (filters, rows = ROWS) => {
  const store = createColumnStore(rows);
  return keysOf(store, filterRows(store, filters));
};
const rule = (mode, key, op, value) => ({ type: "rule", mode, key, op, value });
const minus = (all, some) => all.filter((k) => !some.includes(k));

// Matrix of comparison x kind for one property rule; `match` = rows whose value matches (hand-derived, see table).
// Isolieren keeps exactly `match`; Ausblenden keeps every other row (incl. rows without the property: DEC-19);
// Markieren keeps every row and marks exactly `match`; Freie Textsuche is tested separately (all properties).
const MATRIX = [
  // text
  ["Name", "eq", "wand-int", ["m:2"], "text Gleich: whole value, case-insensitive"],
  ["Name", "eq", "wand", ["m:4"], "text Gleich: not a prefix of a longer value"],
  ["Name", "starts", "WAND", ["m:1", "m:2", "m:4"], "text Beginnt mit, upper-case input"],
  ["Name", "ends", "-1", ["m:1"], "text Endet mit"],
  ["Name", "contains", "ext-erdg", ["m:1"], "text Enth\u00e4lt"],
  ["Name", "contains", "T\u00dcR", ["m:3"], "umlaut upper-case input matches lower-case value"],
  ["Name", "contains", "<img src=x", ["m:5"], "HTML text is matched literally"],
  // number display text (German format as in the table)
  ["Vol", "eq", "0,3", ["m:1"], "number Gleich 0,3 (displayed 0,3)"],
  ["Vol", "eq", "0.3", [], "number Gleich 0.3: the display text has a comma"],
  ["Vol", "starts", "0,", ["m:1"], "number Beginnt mit 0,"],
  ["Vol", "ends", ",3", ["m:1"], "number Endet mit ,3"],
  ["Vol", "contains", "1", ["m:2", "m:4"], "number Enth\u00e4lt 1 (12, 1,5)"],
  ["Len", "eq", "1.234,5", ["m:1"], "number with thousands dot: Gleich 1.234,5"],
  ["Len", "eq", "1234,5", [], "number: Gleich without the thousands dot does not match"],
  ["Len", "eq", "0,333", ["m:2"], "number rounded to 3 decimals as displayed"],
  ["Len", "starts", "-", ["m:4"], "negative number Beginnt mit -"],
  // multi-valued: any value matches, each value on its own
  ["Mat", "eq", "putz", ["m:1", "m:2"], "multi Gleich: any value"],
  ["Mat", "eq", "beton, putz", [], "multi Gleich on the joined display text does not match"],
  ["Mat", "starts", "b", ["m:1"], "multi Beginnt mit"],
  ["Mat", "ends", "olz", ["m:4"], "multi column, single value row"],
  ["Mat", "contains", "t", ["m:1", "m:2"], "multi Enth\u00e4lt (Beton, Putz)"],
  // bool
  ["Tragend", "eq", "ja", ["m:1", "m:4"], "bool Gleich ja matches Ja"],
  ["Tragend", "eq", "NEIN", ["m:2"], "bool Gleich NEIN matches Nein"],
  // empty and missing never match
  [
    "Note",
    "contains",
    "w\u00e4rme",
    ["m:1", "m:4"],
    "umlauts: w\u00e4rme matches W\u00e4rmed\u00e4mmung and W\u00c4RME",
  ],
  ["Note", "contains", "a b", ["m:5"], "control character in a value compares as a space"],
  ["Note", "eq", "a", [], "a control character is no value separator"],
  ["Gibtsnicht", "contains", "a", [], "property no row has"],
];

for (const [key, op, value, match, why] of MATRIX) {
  test(`[unit] rule ${key} ${op} "${value}" x Isolieren / Ausblenden / Markieren: ${why}`, () => {
    // REQ-012-AC5 (logic): display text, case-insensitive, multi = any, empty/missing never match
    assert.deepEqual(run([rule("isolate", key, op, value)]), match, "Isolieren keeps exactly the matching rows");
    assert.deepEqual(run([rule("hide", key, op, value)]), minus(ALL, match), "Ausblenden removes exactly them");
    const store = createColumnStore(ROWS);
    const ev = evaluateFilters(store, [rule("mark", key, op, value)]);
    assert.equal(ev.filters.length, 0, "Markieren is no filter source");
    assert.deepEqual(keysOf(store, filterRows(ev)), ALL, "Markieren removes nothing");
    const marks = markRows(store, [{ mode: "mark", key, op, value }]);
    assert.deepEqual(keysOf(store, bitsToIndices(marks, store.size)), match, "Markieren marks exactly them");
  });
}

test("[unit] rule: a row without the property or with an empty value never matches, so Isolieren removes it and Ausblenden keeps it (DEC-19)", () => {
  // Vol: r3 and r5 have no Vol; Note: r2 has "" (empty), r3 none
  for (const op of ["eq", "starts", "ends", "contains"]) {
    assert.ok(!run([rule("isolate", "Vol", op, "0")]).includes("m:3"), op);
    assert.ok(run([rule("hide", "Vol", op, "0")]).includes("m:3"), op);
  }
  // "(leer)" is no matchable value
  assert.deepEqual(run([rule("isolate", "Note", "eq", "(leer)")]), []);
  // Enth\u00e4lt "" is no valid rule: nothing is filtered (the dialog marks the field invalid, REQ-012-AC11)
  assert.deepEqual(run([rule("isolate", "Note", "contains", "")]), ALL);
});

test("[unit] Freie Textsuche: some value of some property matches the comparison; property names are not matched", () => {
  // REQ-012-AC6 (logic)
  assert.deepEqual(run([rule("text", null, "eq", "ja")]), ["m:1", "m:4"], "Tragend = Ja");
  assert.deepEqual(run([rule("text", null, "eq", "putz")]), ["m:1", "m:2"], "a value of a multi-valued property");
  assert.deepEqual(run([rule("text", null, "starts", "1,")]), ["m:4"], "1,5 (Vol of r4)");
  assert.deepEqual(run([rule("text", null, "ends", "5")]), ["m:1", "m:4"], "1.234,5 and 1,5 / -0,25");
  assert.deepEqual(run([rule("text", null, "contains", "0,3")]), ["m:1", "m:2"], "0,3 and 0,333");
  assert.deepEqual(run([rule("text", null, "eq", "1.234,5")]), ["m:1"]);
  assert.deepEqual(run([rule("text", null, "contains", "name")]), [], "the property name Name is not searched");
  assert.deepEqual(run([rule("text", null, "eq", "beton, putz")]), [], "values are compared one by one");
  // the key of a text rule is ignored (null)
  assert.deepEqual(run([rule("text", "Name", "eq", "ja")]), ["m:1", "m:4"]);
});

test("[unit] search field: contains over every value of every property, case-insensitive, trimmed; blank = no filter", () => {
  // REQ-012-AC7 (logic), DEC-19
  const search = (text) => run([{ type: "search", text }]);
  assert.deepEqual(search("EXT-erdg"), ["m:1"]);
  assert.deepEqual(search("wand"), ["m:1", "m:2", "m:4"], "Name of r1, r2, r4");
  assert.deepEqual(search("w\u00e4rme"), ["m:1", "m:4"], "umlaut, lower-case input");
  assert.deepEqual(search("W\u00c4RME"), ["m:1", "m:4"], "umlaut, upper-case input");
  assert.deepEqual(search("  putz "), ["m:1", "m:2"], "surrounding blanks are trimmed (as ref)");
  assert.deepEqual(search("0,3"), ["m:1", "m:2"], "number display text");
  assert.deepEqual(search("0.3"), [], "display text has a comma");
  assert.deepEqual(search("tragend"), [], "property names are not searched");
  assert.deepEqual(search("<script>"), [], "no value contains it");
  assert.deepEqual(search("onerror=alert(1)>"), ["m:5"], "HTML text matched literally");
  assert.deepEqual(search(""), ALL);
  assert.deepEqual(search("   "), ALL);
  assert.equal(normaliseFilter({ type: "search", text: 5 }), null, "not a string: no filter");
  // Freie Textsuche vs search: the search is always `Enth\u00e4lt` and trims; Freie Textsuche follows its comparison
  assert.deepEqual(search("wand"), run([rule("text", null, "contains", "wand")]));
  assert.notDeepEqual(run([rule("text", null, "eq", "wand")]), search("wand"));
  assert.deepEqual(run([rule("text", null, "contains", " putz")]), [], "Freie Textsuche keeps the value as given");
});

test("[unit] display text (DEC-19): numbers as the table shows them, booleans Ja / Nein, multi-values per value", () => {
  assert.equal(displayText(0.3), "0,3");
  assert.equal(displayText(1234.5), "1.234,5");
  assert.equal(displayText(0.33333), "0,333");
  assert.equal(displayText(-0.25), "-0,25");
  assert.equal(displayText(1234567), "1.234.567");
  assert.equal(displayText(true), "Ja");
  assert.equal(displayText(false), "Nein");
  assert.equal(displayText("Ja", { kind: "bool" }), "Ja");
  assert.equal(displayText(["Beton", "Putz"]), "Beton, Putz");
  assert.equal(displayText([1.5, "x"]), "1,5, x");
  for (const empty of [undefined, null, "", [], NaN, Infinity]) assert.equal(displayText(empty), "");
  assert.deepEqual(valueTexts(["Beton", "", null, 2.5]), ["Beton", "2,5"]);
  assert.deepEqual(valueTexts(7), ["7"]);
  assert.deepEqual(valueTexts(null), []);
  assert.equal(matchText("W\u00c4RME\u0001x\u009fy"), "w\u00e4rme x y");
});

test("[unit] display-text index: one lower-cased string per row, values enclosed by the separator, built lazily", () => {
  const store = createColumnStore(ROWS);
  assert.equal(store.hasTextIndex(), false, "not built before a text source is used");
  filterRows(store, [rule("isolate", "Name", "contains", "wand")]);
  assert.equal(store.hasTextIndex(), false, "a property rule does not need the index");
  filterRows(store, [{ type: "search", text: "wand" }]);
  assert.equal(store.hasTextIndex(), true, "built on the first search");
  const S = TEXT_SEPARATOR;
  assert.equal(S, "\u0001");
  const index = store.textIndex();
  assert.equal(
    index[0],
    [S, "wand-ext-erdg-1", "0,3", "1.234,5", "beton", "putz", "ja", "w\u00e4rmed\u00e4mmung", S].join(S).slice(1, -1),
  );
  assert.equal(index[2], S + "t\u00fcr" + S, "empty and missing values are left out");
  assert.equal(index[4], S + "<img src=x onerror=alert(1)>" + S + "a b" + S, "control characters become a space");
  // a new row set gets a new store, so the index is dropped (spec 4.3)
  assert.equal(createColumnStore(ROWS).hasTextIndex(), false);
});

test("[unit] display-text index: chunked build with pause(fraction) per chunk; concurrent calls share one build", async () => {
  const rows = Array.from({ length: 25 }, (_, i) => ({ key: "k" + i, values: { Name: "N" + i, V: i / 4 } }));
  const store = createColumnStore(rows);
  const fractions = [];
  const pause = async (f) => {
    fractions.push(f);
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  const a = store.buildTextIndex({ chunkRows: 10, pause });
  const b = store.buildTextIndex({ chunkRows: 3 });
  assert.equal(a, b, "one build in progress");
  assert.equal(store.hasTextIndex(), false, "not done before the first pause returns");
  const index = await a;
  assert.deepEqual(fractions, [10 / 25, 20 / 25, 1]);
  assert.equal(store.hasTextIndex(), true);
  assert.deepEqual(index, createColumnStore(rows).textIndex(), "equals the synchronous build");
  assert.equal(await store.buildTextIndex(), index, "kept once built");
  // a synchronous build while the chunked build runs: the chunked build stops and returns the same index
  const other = createColumnStore(rows);
  const pending = other.buildTextIndex({ chunkRows: 5, pause: () => new Promise((r) => setTimeout(r, 0)) });
  const sync = other.textIndex();
  assert.equal(await pending, sync);
});

test("[unit] key sets (DEC-18): exclude = hidden set, include = isolated set; shown = isolated minus hidden, AND with every filter", () => {
  // REQ-013 key-set logic (REQ-013-AC2..AC4 logic)
  const hidden = (keys) => ({ type: "keys", mode: "exclude", keys });
  const isolated = (keys) => ({ type: "keys", mode: "include", keys });
  assert.deepEqual(run([hidden(new Set(["m:2", "m:4"]))]), ["m:1", "m:3", "m:5"]);
  assert.deepEqual(run([isolated(["m:4", "m:2"])]), ["m:2", "m:4"], "any iterable; row order kept");
  assert.deepEqual(run([isolated(["m:1", "m:2"]), hidden(["m:2"])]), ["m:1"], "isolated minus hidden");
  assert.deepEqual(run([isolated(["m:1", "m:2", "m:3"]), rule("isolate", "Name", "starts", "wand")]), ["m:1", "m:2"]);
  assert.deepEqual(
    run([isolated(["m:1", "m:2"]), { key: "Tragend", type: "values", values: ["Nein"] }]),
    ["m:2"],
    "a filter-set value that excludes one isolated element",
  );
  assert.deepEqual(run([isolated(null)]), ALL, "no isolation");
  assert.deepEqual(run([hidden([])]), ALL, "an empty hidden set is no filter");
  assert.equal(normaliseFilter(hidden([])), null);
  assert.deepEqual(run([isolated([])]), [], "an empty isolated set keeps nothing (cv-app ends it instead)");
  assert.deepEqual(run([hidden(["x:9"]), isolated(["m:3", "x:8"])]), ["m:3"], "unknown keys are ignored");
  assert.equal(normaliseFilter({ type: "keys", mode: "other", keys: ["m:1"] }), null);
});

test("[unit] rules combine with AND with each other and with filter sets, column filters and key sets", () => {
  // REQ-012-AC8 (logic): filter set, column filter, two rules -> exactly one row
  const filters = [
    { key: "Tragend", type: "values", values: ["Ja", "Nein"] },
    { id: "col:Name", key: "Name", type: "values", values: ["Wand-Ext-ERDG-1", "Wand-Int"] },
    rule("isolate", "Name", "contains", "wand"),
    rule("hide", "Name", "ends", "-1"),
  ];
  assert.deepEqual(run(filters), ["m:2"]);
  assert.deepEqual(run([...filters, { type: "search", text: "int" }]), ["m:2"]);
  assert.deepEqual(run([...filters, { type: "search", text: "ext" }]), []);
  // the same rule twice is the same filter (AND is idempotent)
  assert.deepEqual(run([rule("isolate", "Mat", "eq", "putz"), rule("isolate", "Mat", "eq", "putz")]), ["m:1", "m:2"]);
});

test("[unit] mark mask: rows matching ANY mark rule, restricted to the shown rows; colour constant", () => {
  // REQ-012-AC9 (logic)
  const store = createColumnStore(ROWS);
  const marks = (rules, within) => keysOf(store, bitsToIndices(markRows(store, rules, within), store.size));
  const putz = { mode: "mark", key: "Mat", op: "eq", value: "putz" };
  const holz = { type: "rule", mode: "mark", key: "Mat", op: "contains", value: "HOLZ" };
  assert.deepEqual(marks([putz, holz]), ["m:1", "m:2", "m:4"], "OR over the mark rules");
  const ev = evaluateFilters(store, [rule("hide", "Name", "eq", "wand-int"), putz, holz]);
  assert.deepEqual(keysOf(store, filterRows(ev)), ["m:1", "m:3", "m:4", "m:5"], "mark rules do not filter");
  assert.deepEqual(marks([putz, holz], ev.pass), ["m:1", "m:4"], "only shown rows are marked");
  assert.deepEqual(marks([rule("isolate", "Mat", "eq", "putz"), { mode: "mark" }]), [], "other actions, invalid");
  assert.deepEqual(marks([]), []);
  assert.equal(MARK_COLOUR, "#f08a87");
});

test("[unit] rule validity (DEC-20 rule shape): mode, op, non-empty string value, key except for Freie Textsuche", () => {
  assert.deepEqual(normaliseRule({ mode: "isolate", key: "Name", op: "eq", value: "x" }), {
    mode: "isolate",
    key: "Name",
    op: "eq",
    value: "x",
  });
  assert.deepEqual(normaliseRule({ mode: "text", key: "Name", op: "contains", value: "x" }), {
    mode: "text",
    key: null,
    op: "contains",
    value: "x",
  });
  for (const bad of [
    null,
    "rule",
    { mode: "select", key: "Name", op: "eq", value: "x" },
    { mode: "isolate", key: "Name", op: "ne", value: "x" },
    { mode: "isolate", key: "Name", op: "eq", value: "" },
    { mode: "isolate", key: "Name", op: "eq", value: 3 },
    { mode: "isolate", key: "", op: "eq", value: "x" },
    { mode: "hide", op: "eq", value: "x" },
  ])
    assert.equal(normaliseRule(bad), null, JSON.stringify(bad));
  assert.equal(normaliseFilter({ type: "rule", mode: "mark", key: "Name", op: "eq", value: "x" }), null);
  assert.equal(normaliseFilter({ type: "rule", mode: "isolate", key: "Name", op: "eq", value: "x" }).type, "rule");
});

test("[unit] rule labels and row text: the four actions and comparisons of the reference; describeRule", () => {
  // REQ-012-AC2 option lists and REQ-012-AC3 / AC6 row texts (logic)
  assert.deepEqual(
    RULE_MODES.map(([, label]) => label),
    ["Isolieren", "Ausblenden", "Markieren", "Freie Textsuche"],
  );
  assert.deepEqual(
    RULE_OPS.map(([, label]) => label),
    ["Gleich", "Beginnt mit", "Endet mit", "Enth\u00e4lt"],
  );
  const catalog = new Map([["Pset.Breite", { key: "Pset.Breite", label: "Pset.Breite" }]]);
  assert.deepEqual(describeRule({ mode: "isolate", key: "Kategorie", op: "contains", value: "wall" }, catalog), {
    mode: "Isolieren",
    text: "Kategorie enth\u00e4lt \u201ewall\u201c",
  });
  assert.deepEqual(describeRule({ mode: "text", key: null, op: "eq", value: "3rPX" }, catalog), {
    mode: "Freie Textsuche",
    text: "Beliebige Eigenschaft gleich \u201e3rPX\u201c",
  });
  assert.equal(
    describeRule({ mode: "mark", key: "Pset.Breite", op: "starts", value: "1" }, catalog).text,
    "Pset.Breite beginnt mit \u201e1\u201c",
  );
  assert.equal(
    describeRule({ mode: "hide", key: "x", op: "ends", value: "<b>" }, null).text,
    "x endet mit \u201e<b>\u201c",
  );
});

// ---------------------------------------------------------------------------------------------------------------
// AC20-FZK-Haus: counts from reference-values.json (STEP text)
// ---------------------------------------------------------------------------------------------------------------

const WALLS = REF.elementsInStepTextByKategorie.IfcWallStandardCase; // 13
const valueMap = (facet) =>
  Object.fromEntries(facet.values.map((e) => [e.value === null ? "(leer)" : e.value, e.count]));

test("[unit] FZK-Haus: rule Isolieren Kategorie enth\u00e4lt wall keeps the walls; facet counts and DEC-14 under rules and key sets", () => {
  // REQ-012-AC3 and REQ-004-AC5 (logic)
  assert.equal(WALLS, 13);
  const store = createColumnStore(FZK_ROWS);
  const wallRule = rule("isolate", "Kategorie", "contains", "wall");
  const walls = filterRows(store, [wallRule]);
  assert.equal(walls.length, WALLS);
  // the walls are the REQ-004-AC1 key set (walls OR slabs) without the slabs (reference counts)
  const ac1 = new Set(REF.filters["REQ-004-AC1"].expectedGlobalIds);
  const wallGuids = [...walls].map((i) => FZK_ROWS[i].guid);
  assert.ok(wallGuids.every((g) => ac1.has(g)));
  assert.equal(ac1.size - wallGuids.length, REF.elementsInStepTextByKategorie.IfcSlab);

  let facets = facetCounts(store, [wallRule], ["Kategorie"]);
  assert.deepEqual(valueMap(facets.get("Kategorie")), { IfcWallStandardCase: WALLS });

  const oneWall = FZK_ROWS[walls[0]].key;
  const hideOne = { type: "keys", mode: "exclude", keys: [oneWall] };
  facets = facetCounts(store, [wallRule, hideOne], ["Kategorie"]);
  assert.deepEqual(valueMap(facets.get("Kategorie")), { IfcWallStandardCase: WALLS - 1 });

  // IfcSlab checked before the rule: stays visible, checked, count 0; the set's own selection is not applied to it
  const slabSet = { key: "Kategorie", type: "values", values: ["IfcSlab"] };
  const ev = evaluateFilters(store, [slabSet, wallRule]);
  assert.equal(filterRows(ev).length, 0);
  const kat = facetCounts(ev, null, ["Kategorie"]).get("Kategorie");
  assert.deepEqual(
    kat.values.map((e) => [e.value, e.count, e.checked]),
    [
      ["IfcSlab", 0, true],
      ["IfcWallStandardCase", WALLS, false],
    ],
  );
  assert.equal(kat.checkedCount, 1);

  // Geschoss counts under the rule and an isolated set of two walls follow the reference storeys
  const byStorey = REF.elementsByGeschossAndKategorie;
  facets = facetCounts(store, [wallRule], ["Geschoss"]);
  assert.deepEqual(valueMap(facets.get("Geschoss")), {
    Dachgeschoss: byStorey.Dachgeschoss.IfcWallStandardCase,
    Erdgeschoss: byStorey.Erdgeschoss.IfcWallStandardCase,
  });
  const isolateTwo = { type: "keys", mode: "include", keys: [FZK_ROWS[walls[0]].key, FZK_ROWS[walls[1]].key] };
  const two = facetCounts(store, [isolateTwo], ["Kategorie"]).get("Kategorie");
  assert.deepEqual(valueMap(two), { IfcWallStandardCase: 2 });
});

test("[unit] FZK-Haus: Markieren Kategorie gleich IfcSlab marks the slabs and changes no row", () => {
  // REQ-012-AC9 (logic)
  const store = createColumnStore(FZK_ROWS);
  const mark = { type: "rule", mode: "mark", key: "Kategorie", op: "eq", value: "IfcSlab" };
  assert.equal(filterRows(store, [mark]).length, FZK_ROWS.length);
  const marked = bitsToIndices(markRows(store, [mark]), store.size);
  assert.equal(marked.length, REF.elementsInStepTextByKategorie.IfcSlab);
  assert.ok([...marked].every((i) => FZK_ROWS[i].values.Kategorie === "IfcSlab"));
});

// Independent oracle: the DEC-19 rule written naively per row and value (toLocaleString, no index, no column store).
function oracleText(v) {
  if (typeof v === "number") return v.toLocaleString("de-DE", { maximumFractionDigits: 3 });
  return String(v);
}
function oracleValues(value) {
  const list = Array.isArray(value) ? value : [value];
  return list.filter((v) => v !== null && v !== undefined && v !== "").map((v) => oracleText(v).toLowerCase());
}
function oracleCompare(text, op, needle) {
  if (op === "eq") return text === needle;
  if (op === "starts") return text.startsWith(needle);
  if (op === "ends") return text.endsWith(needle);
  return text.includes(needle);
}
function oracle(rows, r) {
  const needle = r.value.toLowerCase();
  return rows
    .filter((row) => {
      const keys = r.mode === "text" ? Object.keys(row.values) : [r.key];
      const hit = keys.some((k) => oracleValues(row.values[k]).some((t) => oracleCompare(t, r.op, needle)));
      return r.mode === "hide" ? !hit : hit;
    })
    .map((row) => row.key);
}

test("[unit] FZK-Haus: every action x comparison on Name, Material, Geschoss, Kategorie and Freie Textsuche equals a naive oracle", () => {
  const needles = { Name: ["wand", "-1", "ext-erdg", "Fenster"], Material: ["holz", "beton", "Leichtbeton 102890359"] };
  needles.Geschoss = ["Erdgeschoss", "dach", "geschoss"];
  needles.Kategorie = ["IfcWall", "slab", "ifcslab"];
  const store = createColumnStore(FZK_ROWS);
  let checked = 0;
  for (const [key, list] of Object.entries(needles)) {
    for (const value of list) {
      for (const [op] of RULE_OPS) {
        for (const mode of ["isolate", "hide", "text"]) {
          const r = { mode, key: mode === "text" ? null : key, op, value };
          const got = keysOf(store, filterRows(store, [{ type: "rule", ...r }]));
          assert.deepEqual(got, oracle(FZK_ROWS, r), JSON.stringify(r));
          checked++;
        }
      }
      const search = keysOf(store, filterRows(store, [{ type: "search", text: value }]));
      assert.deepEqual(search, oracle(FZK_ROWS, { mode: "text", op: "contains", value }), "search " + value);
    }
  }
  assert.equal(checked, 13 * 4 * 3);
  // the search for ext-erdg finds the ground-floor exterior walls of the reference elements
  const ext = keysOf(store, filterRows(store, [{ type: "search", text: "ext-erdg" }]));
  const reference = REF.elements.filter((e) => /ext-erdg/i.test(e.Name)).map((e) => "fzk:" + e.GlobalId);
  assert.ok(reference.length > 0 && reference.every((k) => ext.includes(k)));
});
