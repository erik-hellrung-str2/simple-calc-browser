// [unit] tests of the TASK-006b grouping logic in cv-core (spec REQ-006 grouping view, DEC-16, ASM-008): groups with
// count, sums and equal-or-empty text, "(leer)" last, multi-valued grouping properties, two levels, total row,
// sorting groups by their sums, display rows under the expanded state and the grouping configuration part.
// Real-data checks use the AC20-FZK-Haus rows snapshot as INPUT only; expected values come from
// test/fixtures/reference-values.json (STEP-text derivation).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCore } from "../load-core.mjs";

const core = await loadCore();
const {
  GROUP_LEVELS,
  allGroups,
  createColumnStore,
  groupDisplayRows,
  groupRows,
  groupsOfRow,
  normaliseGrouping,
  sortRows,
} = core;

const fixtures = new URL("../fixtures/", import.meta.url);
const REF = JSON.parse(readFileSync(new URL("reference-values.json", fixtures), "utf8"));
const FZK_ROWS = JSON.parse(readFileSync(new URL("fzk-rows.snapshot.json", fixtures), "utf8")).rows;
const row = (key, values) => ({ key, guid: key, values });
const all = (n) => Uint32Array.from({ length: n }, (_, i) => i);
const close = (a, b, label) =>
  assert.ok(Math.abs(a - b) <= REF.meta.tolerance.relative * Math.max(Math.abs(b), 1e-12), `${label}: ${a} vs ${b}`);

const ROWS = [
  row("a", { Kat: "Wand", Geschoss: "EG", Vol: 2, Mat: ["Beton", "Putz"], Name: "W1" }),
  row("b", { Kat: "Wand", Geschoss: "OG", Vol: 3.5, Mat: ["Beton"], Name: "W1" }),
  row("c", { Kat: "Decke", Geschoss: "EG", Vol: 10, Mat: ["Beton"], Name: "D1" }),
  row("d", { Kat: "Decke", Geschoss: "EG", Mat: [], Name: "D2" }),
  row("e", { Kat: "", Geschoss: "OG", Vol: 1, Name: "X" }),
  row("f", { Kat: "Tuer", Name: "T1" }),
];
const COLUMNS = [
  { key: "Vol", mode: "sum" },
  { key: "Name", mode: "same" },
  { key: "Geschoss", mode: "same" },
  { key: "Mixed", mode: "none" },
];

test("[unit] REQ-006-AC2/AC7/AC8 groups: count, sums (empty if no value), equal-or-empty text, (leer) last, total", () => {
  const store = createColumnStore(ROWS);
  const tree = groupRows(store, all(ROWS.length), { levels: ["Kat"], columns: COLUMNS });
  assert.deepEqual(
    tree.groups.map((g) => [g.value, g.count]),
    [
      ["Decke", 2],
      ["Tuer", 1],
      ["Wand", 2],
      [null, 1],
    ],
  );
  const [decke, tuer, wand, leer] = tree.groups;
  assert.deepEqual(decke.cells, { Vol: 10, Name: null, Geschoss: "EG", Mixed: null });
  assert.deepEqual(wand.cells, { Vol: 5.5, Name: "W1", Geschoss: null, Mixed: null });
  assert.deepEqual(tuer.cells, { Vol: null, Name: "T1", Geschoss: null, Mixed: null }); // no value: empty, not 0
  assert.equal(leer.value, null);
  assert.deepEqual(Array.from(wand.indices), [0, 1]);
  assert.equal(wand.level, 1);
  assert.equal(wand.children, null);
  // total: every element once; sums only (text cells stay empty)
  assert.deepEqual(tree.total, { count: 6, cells: { Vol: 16.5, Name: null, Geschoss: null, Mixed: null } });
});

test("[unit] REQ-006-AC10 DEC-16 multi-valued grouping: an element is in each of its groups, the total counts it once", () => {
  const store = createColumnStore(ROWS);
  const tree = groupRows(store, all(ROWS.length), { levels: ["Mat"], columns: COLUMNS });
  const byValue = Object.fromEntries(tree.groups.map((g) => [g.value, g]));
  assert.deepEqual(
    tree.groups.map((g) => g.value),
    ["Beton", "Putz", null],
  );
  assert.equal(byValue.Beton.count, 3); // a, b, c
  assert.equal(byValue.Putz.count, 1); // a
  assert.equal(byValue.Beton.cells.Vol, 15.5);
  assert.equal(byValue.Putz.cells.Vol, 2);
  assert.equal(byValue.null.count, 3); // d ([]), e, f (no value)
  assert.equal(tree.total.count, 6);
  assert.equal(tree.total.cells.Vol, 16.5);
  // equal-or-empty on a multi-valued text column: compared as displayed
  const byKat = groupRows(store, Uint32Array.from([0, 1]), {
    levels: ["Kat"],
    columns: [{ key: "Mat", mode: "same" }],
  });
  assert.equal(byKat.groups[0].cells.Mat, null); // [Beton, Putz] vs [Beton]
  const same = groupRows(
    createColumnStore([row("x", { K: 1, M: ["A", "B"] }), row("y", { K: 1, M: ["A", "B"] })]),
    all(2),
    { levels: ["K"], columns: [{ key: "M", mode: "same" }] },
  );
  assert.deepEqual(same.groups[0].cells.M, ["A", "B"]);
  assert.equal(same.groups[0].id, "#1"); // number values keep their own id space
});

test("[unit] REQ-006-AC2 two levels: sub-groups of single-valued properties add up to their parent; ids by path", () => {
  const store = createColumnStore(ROWS);
  const tree = groupRows(store, all(ROWS.length), { levels: ["Kat", "Geschoss"], columns: COLUMNS });
  for (const g of tree.groups) {
    assert.ok(Array.isArray(g.children));
    assert.equal(
      g.children.reduce((a, c) => a + c.count, 0),
      g.count,
    );
    for (const c of g.children) {
      assert.equal(c.level, 2);
      assert.ok(c.id.startsWith(g.id + "\u001f"));
    }
  }
  const wand = tree.groups.find((g) => g.value === "Wand");
  assert.deepEqual(
    wand.children.map((c) => [c.value, c.count, c.cells.Vol]),
    [
      ["EG", 1, 2],
      ["OG", 1, 3.5],
    ],
  );
  const tuer = tree.groups.find((g) => g.value === "Tuer");
  assert.deepEqual(
    tuer.children.map((c) => c.value),
    [null],
  );
  assert.equal(
    allGroups(tree).length,
    tree.groups.reduce((a, g) => a + 1 + g.children.length, 0),
  );
  // at most two levels; empty levels: no groups, total still counts
  assert.equal(GROUP_LEVELS, 2);
  assert.equal(groupRows(store, all(6), { levels: ["Kat", "Geschoss", "Name"], columns: [] }).levels.length, 2);
  const none = groupRows(store, all(6), { levels: [], columns: COLUMNS });
  assert.deepEqual(none.groups, []);
  assert.equal(none.total.count, 6);
  const empty = groupRows(store, new Uint32Array(0), { levels: ["Kat"], columns: COLUMNS });
  assert.deepEqual(empty.groups, []);
  assert.deepEqual(empty.total, { count: 0, cells: { Vol: null, Name: null, Geschoss: null, Mixed: null } });
});

test("[unit] REQ-006-AC5 groups sorted by their sums (empty sums last, (leer) last in both directions); elements keep the row order", () => {
  const store = createColumnStore(ROWS);
  const sort = (dir) => ({ key: "Vol", dir });
  const order = (dir) => sortRows(store, all(ROWS.length), sort(dir));
  const asc = groupRows(store, order("asc"), { levels: ["Kat"], columns: COLUMNS, sort: sort("asc") });
  assert.deepEqual(
    asc.groups.map((g) => g.value),
    ["Wand", "Decke", "Tuer", null],
  );
  const desc = groupRows(store, order("desc"), { levels: ["Kat"], columns: COLUMNS, sort: sort("desc") });
  assert.deepEqual(
    desc.groups.map((g) => g.value),
    ["Decke", "Wand", "Tuer", null],
  );
  // within a group the elements follow the given (sorted) row order
  assert.deepEqual(Array.from(desc.groups[1].indices), [1, 0]);
  // a text sort column orders groups by their common value (empty last)
  const byName = groupRows(store, all(6), { levels: ["Kat"], columns: COLUMNS, sort: { key: "Name", dir: "asc" } });
  assert.deepEqual(
    byName.groups.map((g) => g.value),
    ["Tuer", "Wand", "Decke", null],
  );
  // level-2 groups are sorted within their parent
  const two = groupRows(store, order("desc"), { levels: ["Mat", "Geschoss"], columns: COLUMNS, sort: sort("desc") });
  const beton = two.groups.find((g) => g.value === "Beton");
  assert.deepEqual(
    beton.children.map((c) => [c.value, c.cells.Vol]),
    [
      ["EG", 12],
      ["OG", 3.5],
    ],
  );
});

test("[unit] REQ-006-AC3 display rows: collapsed groups only; expanded level 1 shows level 2, expanded last level shows elements", () => {
  const store = createColumnStore(ROWS);
  const tree = groupRows(store, all(ROWS.length), { levels: ["Kat", "Geschoss"], columns: COLUMNS });
  const kinds = (rows) =>
    rows.map((r) => (r.type === "group" ? `${r.group.level}:${r.group.value}` : `e${r.depth}:${ROWS[r.index].key}`));
  assert.deepEqual(kinds(groupDisplayRows(tree, () => false)), ["1:Decke", "1:Tuer", "1:Wand", "1:null"]);
  const open = new Set(["$Wand", "$Wand\u001f$OG"]);
  assert.deepEqual(kinds(groupDisplayRows(tree, (g) => open.has(g.id))), [
    "1:Decke",
    "1:Tuer",
    "1:Wand",
    "2:EG",
    "2:OG",
    "e2:b",
    "1:null",
  ]);
  const everything = groupDisplayRows(tree, () => true);
  assert.equal(everything.filter((r) => r.type === "element").length, ROWS.length);
  const single = groupRows(store, all(ROWS.length), { levels: ["Kat"], columns: COLUMNS });
  assert.deepEqual(kinds(groupDisplayRows(single, (g) => g.value === "Wand")), [
    "1:Decke",
    "1:Tuer",
    "1:Wand",
    "e1:a",
    "e1:b",
    "1:null",
  ]);
  assert.deepEqual(
    groupDisplayRows(null, () => true),
    [],
  );
});

test("[unit] REQ-007-AC2 groupsOfRow: the groups to expand for a selected element (both levels, every group of a multi-value)", () => {
  const store = createColumnStore(ROWS);
  const ids = (tree, i) => groupsOfRow(tree, i).map((g) => [g.level, g.value]);
  const two = groupRows(store, all(ROWS.length), { levels: ["Kat", "Geschoss"], columns: COLUMNS });
  assert.deepEqual(ids(two, 2), [
    [1, "Decke"],
    [2, "EG"],
  ]);
  assert.deepEqual(ids(two, 5), [
    [1, "Tuer"],
    [2, null],
  ]);
  // multi-valued level 1 (DEC-16): row a is in Beton and Putz
  const mat = groupRows(store, all(ROWS.length), { levels: ["Mat", "Kat"], columns: COLUMNS });
  assert.deepEqual(ids(mat, 0), [
    [1, "Beton"],
    [2, "Wand"],
    [1, "Putz"],
    [2, "Wand"],
  ]);
  // a row outside the grouped rows (filtered out) and an empty tree: no groups
  const some = groupRows(store, Uint32Array.from([0, 1]), { levels: ["Kat"], columns: COLUMNS });
  assert.deepEqual(ids(some, 3), []);
  assert.deepEqual(groupsOfRow(null, 0), []);
  // the ids are those of allGroups, so the app can expand them
  const known = new Set(allGroups(two).map((g) => g.id));
  for (const g of groupsOfRow(two, 1)) assert.ok(known.has(g.id));
});

test("[unit] REQ-009 grouping configuration part: view and up to two distinct known keys", () => {
  const catalog = new Map([
    ["Kategorie", {}],
    ["Geschoss", {}],
    ["Material", {}],
  ]);
  assert.deepEqual(normaliseGrouping({ view: "grouped", groupBy: ["Kategorie", "Geschoss"] }, catalog), {
    view: "grouped",
    groupBy: ["Kategorie", "Geschoss"],
  });
  assert.deepEqual(
    normaliseGrouping(
      { view: "x", groupBy: ["Fehlt", "Geschoss", "Geschoss", "", 7, "Material", "Kategorie"] },
      catalog,
    ),
    {
      view: "single",
      groupBy: ["Geschoss", "Material"],
    },
  );
  assert.deepEqual(normaliseGrouping(null, catalog), { view: "single", groupBy: [] });
  // without a catalogue (no model loaded) keys are kept
  assert.deepEqual(normaliseGrouping({ view: "grouped", groupBy: ["Fehlt"] }, new Map()), {
    view: "grouped",
    groupBy: ["Fehlt"],
  });
});

test("[unit] REQ-006-AC2 AC20-FZK-Haus by Kategorie then Geschoss: counts and NetVolume sums equal the reference", () => {
  const ref = REF["REQ-006-grouping-fzk"];
  const store = createColumnStore(FZK_ROWS);
  const tree = groupRows(store, all(FZK_ROWS.length), {
    levels: ref.levels,
    columns: [
      { key: ref.column, mode: "sum" },
      { key: "Geschoss", mode: "same" },
      { key: "Name", mode: "same" },
    ],
  });
  const expected = Object.entries(ref.byKategorie).filter(([k]) => k !== "IfcOpeningElement");
  assert.deepEqual(
    tree.groups.map((g) => g.value),
    expected.map(([k]) => k),
  );
  for (const g of tree.groups) {
    const r = ref.byKategorie[g.value];
    assert.equal(g.count, r.count, g.value);
    if (r.volume === null) assert.equal(g.cells[ref.column], null, g.value);
    else close(g.cells[ref.column], r.volume, g.value);
    assert.equal(g.cells.Geschoss, r.common.Geschoss, g.value);
    assert.equal(g.cells.Name, r.common.Name, g.value);
    assert.deepEqual(
      g.children.map((c) => c.value ?? "(leer)"),
      Object.keys(r.byGeschoss).sort((a, b) => (a === "(leer)") - (b === "(leer)")),
    );
    for (const c of g.children) {
      const sub = r.byGeschoss[c.value ?? "(leer)"];
      assert.equal(c.count, sub.count);
      if (sub.volume === null) assert.equal(c.cells[ref.column], null);
      else close(c.cells[ref.column], sub.volume, `${g.value}/${c.value}`);
    }
  }
  assert.equal(tree.total.count, FZK_ROWS.length);
});
