// [unit] tests of the TASK-005 colouring in cv-core (spec REQ-005 `Faerben nach`, DEC-15): distinct text colours up to
// 120 values then `Sonstige`, numeric 24-step scale with ranges, `mehrere Werte` for several values, grey `(leer)`,
// legend over the rows inside the filter, filter-set dot colours. Real-data checks use the AC20-FZK-Haus rows snapshot
// as INPUT only; expected counts come from test/fixtures/reference-values.json (STEP-text derivation).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCore } from "../load-core.mjs";

const core = await loadCore();
const {
  colourScheme,
  colourLegend,
  createColumnStore,
  distinctColour,
  scaleColour,
  filterRows,
  COLOUR_DISTINCT_COUNT,
  COLOUR_SCALE_STEPS,
  COLOUR_EMPTY,
  COLOUR_MULTI,
  COLOUR_OTHER,
  MULTI_LABEL,
  OTHER_LABEL,
} = core;

const fixtures = new URL("../fixtures/", import.meta.url);
const REF = JSON.parse(readFileSync(new URL("reference-values.json", fixtures), "utf8"))["AC20-FZK-Haus"];
const FZK_ROWS = JSON.parse(readFileSync(new URL("fzk-rows.snapshot.json", fixtures), "utf8")).rows;
const NOT_ROWS = ["IfcOpeningElement"]; // classes of the STEP text the extractor does not list as rows (TASK-002)
const HEX = /^#[0-9a-f]{6}$/;
const row = (key, values) => ({ key, guid: key, values });
const all = (n) => Uint32Array.from({ length: n }, (_, i) => i);

test("[unit] DEC-15 constants: 120 distinct colours, 24 scale steps (as the reference app)", () => {
  assert.equal(COLOUR_DISTINCT_COUNT, 120);
  assert.equal(COLOUR_SCALE_STEPS, 24);
  const colours = Array.from({ length: COLOUR_DISTINCT_COUNT }, (_, i) => distinctColour(i));
  for (const c of colours) assert.match(c, HEX);
  assert.equal(new Set(colours).size, COLOUR_DISTINCT_COUNT, "120 different colours");
  assert.equal(distinctColour(COLOUR_DISTINCT_COUNT), distinctColour(0), "repeats after 120");
  for (const special of [COLOUR_EMPTY, COLOUR_MULTI, COLOUR_OTHER]) {
    assert.match(special, HEX);
    assert.ok(!colours.includes(special), `${special} differs from the distinct colours`);
  }
  // scale: light -> dark (sum of channels falls), all different
  const scale = Array.from({ length: COLOUR_SCALE_STEPS }, (_, i) => scaleColour(i));
  assert.equal(new Set(scale).size, COLOUR_SCALE_STEPS);
  const lum = (hex) => [1, 3, 5].reduce((sum, at) => sum + parseInt(hex.slice(at, at + 2), 16), 0);
  for (let i = 1; i < scale.length; i++) assert.ok(lum(scale[i]) < lum(scale[i - 1]), `step ${i} darker`);
});

test("[unit] REQ-005-AC2 Kategorie on AC20-FZK-Haus: one colour per category, legend counts equal the reference", () => {
  const store = createColumnStore(FZK_ROWS);
  const scheme = colourScheme(store, "Kategorie");
  assert.equal(scheme.numeric, false);
  const byKategorie = new Map();
  FZK_ROWS.forEach((r, i) => {
    const c = scheme.rowColour(i);
    const k = r.values.Kategorie;
    if (byKategorie.has(k)) assert.equal(c, byKategorie.get(k), `${k}: one colour`);
    byKategorie.set(k, c);
    assert.equal(scheme.valueColour(k), c, `${k}: filter-set dot colour equals the element colour`);
  });
  assert.equal(new Set(byKategorie.values()).size, byKategorie.size, "different categories, different colours");
  const expected = Object.fromEntries(
    Object.entries(REF.elementsInStepTextByKategorie).filter(([k]) => !NOT_ROWS.includes(k)),
  );
  const legend = colourLegend(scheme, all(FZK_ROWS.length));
  assert.deepEqual(Object.fromEntries(legend.map((e) => [e.label, e.count])), expected);
  for (const e of legend) assert.equal(e.colour, byKategorie.get(e.label));
});

test("[unit] REQ-005 legend lists only the rows inside the filter (REQ-004-AC2 ground floor), colours stay stable", () => {
  const ac = REF.filters["REQ-004-AC2"];
  const store = createColumnStore(FZK_ROWS);
  const scheme = colourScheme(store, "Kategorie");
  const inside = filterRows(store, [{ key: "Geschoss", type: "values", values: ac.filter.Geschoss }]);
  const legend = colourLegend(scheme, inside);
  const expected = { ...ac.kategorieCountsOnGroundFloor };
  for (const [k, n] of Object.entries(ac.kategorieCountsOnGroundFloorConditional))
    if (FZK_ROWS.some((r) => r.values.Kategorie === k)) expected[k] = n;
  assert.deepEqual(Object.fromEntries(legend.map((e) => [e.label, e.count])), expected);
  const full = colourLegend(scheme, all(FZK_ROWS.length));
  for (const e of legend)
    assert.equal(e.colour, full.find((f) => f.label === e.label).colour, "same colour as unfiltered");
});

test("[unit] DEC-15 more than 120 text values: the rest share `Sonstige`; values sorted as in the filter sets", () => {
  const rows = Array.from({ length: 130 }, (_, i) => row("r" + i, { T: "v" + String(i).padStart(3, "0") }));
  const scheme = colourScheme(rows, "T");
  const legend = colourLegend(scheme, all(rows.length));
  assert.equal(legend.length, COLOUR_DISTINCT_COUNT + 1);
  assert.equal(legend[0].label, "v000");
  assert.equal(legend[119].label, "v119");
  assert.deepEqual(
    { label: legend[120].label, kind: legend[120].kind, colour: legend[120].colour, count: legend[120].count },
    { label: OTHER_LABEL, kind: "other", colour: COLOUR_OTHER, count: 10 },
  );
  assert.equal(scheme.rowColour(125), COLOUR_OTHER);
  assert.equal(scheme.valueColour("v125"), COLOUR_OTHER);
  assert.equal(scheme.rowColour(3), distinctColour(3));
  assert.equal(new Set(legend.slice(0, 120).map((e) => e.colour)).size, 120);
});

test("[unit] DEC-15 numeric property: 24 equal ranges min -> max, last range closed, ranges in the legend", () => {
  // values 0 .. 48 step 2 plus an empty and a multi-valued row
  const rows = Array.from({ length: 25 }, (_, i) => row("n" + i, { V: i * 2 }));
  rows.push(row("e", {}), row("m", { V: [1, 3] }));
  const scheme = colourScheme(rows, "V");
  assert.equal(scheme.numeric, true);
  const ranges = scheme.entries.filter((e) => e.kind === "range");
  assert.equal(ranges.length, COLOUR_SCALE_STEPS);
  assert.equal(ranges[0].min, 0);
  assert.equal(ranges[23].max, 48);
  assert.equal(ranges[0].label, "0 – 2");
  assert.equal(ranges[23].label, "46 – 48");
  assert.equal(scheme.rowColour(0), scaleColour(0), "min -> first step");
  assert.equal(scheme.rowColour(24), scaleColour(23), "max -> last step");
  assert.equal(scheme.rowColour(1), scaleColour(1), "2 starts the second range");
  assert.equal(scheme.rowColour(25), COLOUR_EMPTY, "empty -> (leer)");
  assert.equal(scheme.rowColour(26), COLOUR_MULTI, "two numbers -> mehrere Werte");
  const legend = colourLegend(scheme, all(rows.length));
  assert.deepEqual(
    legend.slice(-2).map((e) => [e.label, e.count]),
    [
      [MULTI_LABEL, 1],
      ["(leer)", 1],
    ],
  );
  assert.equal(
    legend.slice(0, -2).reduce((s, e) => s + e.count, 0),
    25,
  );
  // German number format with up to 3 decimals
  const frac = colourScheme([row("a", { V: 0.5 }), row("b", { V: 1234.56789 })], "V");
  assert.equal(frac.entries[0].label, "0,5 – 51,919");
  assert.equal(frac.entries[23].label.endsWith("1.234,568"), true);
});

test("[unit] DEC-15 one numeric value only: one entry, full colour; empty and multi rows of a text property", () => {
  const one = colourScheme([row("a", { V: 7 }), row("b", { V: 7 })], "V");
  const ranges = one.entries.filter((e) => e.kind === "range");
  assert.equal(ranges.length, 1);
  assert.equal(ranges[0].label, "7");
  assert.equal(one.rowColour(0), scaleColour(COLOUR_SCALE_STEPS - 1));

  const rows = [
    row("a", { Material: ["Holz"] }),
    row("b", { Material: ["Beton", "Holz"] }),
    row("c", { Material: [] }),
    row("d", { Material: ["Holz", "Holz"] }), // repeated value = one distinct value
    row("e", {}),
  ];
  const scheme = colourScheme(rows, "Material");
  assert.equal(scheme.rowColour(1), COLOUR_MULTI);
  assert.equal(scheme.rowColour(2), COLOUR_EMPTY);
  assert.equal(scheme.rowColour(3), scheme.valueColour("Holz"));
  assert.equal(scheme.rowColour(4), COLOUR_EMPTY);
  assert.equal(scheme.valueColour(null), COLOUR_EMPTY);
  assert.equal(scheme.valueColour("unbekannt"), undefined);
  const legend = colourLegend(scheme, all(rows.length));
  assert.deepEqual(
    legend.map((e) => [e.label, e.count, e.kind]),
    [
      ["Holz", 2, "value"],
      [MULTI_LABEL, 1, "multi"],
      ["(leer)", 2, "empty"],
    ],
  );
  // a property no row has: only (leer)
  const none = colourScheme(rows, "Fehlt");
  assert.equal(none.numeric, false);
  assert.deepEqual(
    colourLegend(none, all(rows.length)).map((e) => [e.label, e.count]),
    [["(leer)", 5]],
  );
});
