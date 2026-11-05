// [unit] tests of the colouring in cv-core (spec REQ-005 colouring, DEC-15 as changed by CR-002, TASK-012): modes
// `Unterschiedliche Farben` (golden-angle colours in value order, repeating after 120 values with a note) and
// `Farbskala` (swatches Rot / Blau / Gruen / Orange / Violett / Grau or an own colour; numbers by value, text by rank;
// 24 steps from the 12 % tint to the full colour), `mehrere Werte` and `(leer)` in both modes, legend over the shown
// rows with at most 200 rows, filter-set dot colours.
// Independent oracles: the literal colours of the spec (DEC-15 swatches, `#e4eef9` = 12 % tint of `#1F6FD1`,
// REQ-005-AC5), the reference app's own functions copied verbatim below (scaleHex, distinctHex with three's Color, ref
// L476-485 in html-modelviewer/ifc-viewer-builder.html) and counts from test/fixtures/reference-values.json. The
// AC20-FZK-Haus rows snapshot is INPUT only.
// UI-level ACs whose logic is covered here are cited in comments only (spec Testing T5): REQ-005-AC2/AC4/AC5/AC8.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadCore } from "../load-core.mjs";

const core = await loadCore();
const {
  colourScheme,
  colourLegend,
  legendRows,
  createColumnStore,
  distinctColour,
  scaleColour,
  normaliseHexColour,
  filterRows,
  COLOUR_DISTINCT_COUNT,
  COLOUR_SCALE_STEPS,
  COLOUR_MODES,
  SCALE_COLOURS,
  DEFAULT_COLOUR_MODE,
  DEFAULT_SCALE_COLOUR,
  LEGACY_SCALE_COLOUR,
  COLOUR_LEGEND_LIMIT,
  COLOUR_REPEAT_NOTE,
  COLOUR_EMPTY,
  COLOUR_MULTI,
  MULTI_LABEL,
} = core;

const fixtures = new URL("../fixtures/", import.meta.url);
const REF = JSON.parse(readFileSync(new URL("reference-values.json", fixtures), "utf8"))["AC20-FZK-Haus"];
const FZK_ROWS = JSON.parse(readFileSync(new URL("fzk-rows.snapshot.json", fixtures), "utf8")).rows;
const NOT_ROWS = ["IfcOpeningElement"]; // classes of the STEP text the extractor does not list as rows (TASK-002)
const HEX = /^#[0-9a-f]{6}$/;
const row = (key, values) => ({ key, guid: key, values });
const all = (n) => Uint32Array.from({ length: n }, (_, i) => i);

// --- reference oracle (html-modelviewer/ifc-viewer-builder.html L476-485, verbatim apart from the THREE import) ---
const THREE_FILE = fileURLToPath(new URL("../../test-cache/cdn/npm/three@0.185.1/_esm.js", import.meta.url));
assert.ok(existsSync(THREE_FILE), "three 0.185.1 from the CDN cache is needed (run the install command)");
const THREE = await import(THREE_FILE);
const SCALE_MIN_STRENGTH = 0.12;
const SCALE_STEPS = 24;
const DISTINCT_COLOR_COUNT = 120;
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function scaleHex(base, t) {
  const amount = SCALE_MIN_STRENGTH + (1 - SCALE_MIN_STRENGTH) * (Math.round(t * SCALE_STEPS) / SCALE_STEPS);
  return (
    "#" +
    hexToRgb(base)
      .map((c) =>
        Math.round(255 + (c - 255) * amount)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
function distinctHex(index) {
  const i = index % DISTINCT_COLOR_COUNT;
  const color = new THREE.Color().setHSL(((i * 137.508) % 360) / 360, 0.65, i % 2 ? 0.42 : 0.58, THREE.SRGBColorSpace);
  return "#" + color.getHexString();
}
// ------------------------------------------------------------------------------------------------------------------

/** DEC-15 swatches as the spec lists them (label -> colour). */
const SWATCHES = {
  Rot: "#D72622",
  Blau: "#1F6FD1",
  Grün: "#2E9B4F",
  Orange: "#E8890C",
  Violett: "#7B3FB5",
  Grau: "#4E5355",
};

test("[unit] DEC-15 constants: modes, swatches, start values, 120 distinct colours, 24 steps, 200 legend rows", () => {
  assert.equal(COLOUR_DISTINCT_COUNT, 120);
  assert.equal(COLOUR_SCALE_STEPS, 24);
  assert.equal(COLOUR_LEGEND_LIMIT, 200);
  assert.deepEqual(COLOUR_MODES, [
    ["distinct", "Unterschiedliche Farben"],
    ["scale", "Farbskala"],
  ]);
  assert.deepEqual(
    SCALE_COLOURS.map(([hex, label]) => [label, hex]),
    Object.entries(SWATCHES).map(([label, hex]) => [label, hex.toLowerCase()]),
  );
  assert.equal(DEFAULT_COLOUR_MODE, "distinct"); // start: Unterschiedliche Farben
  assert.equal(DEFAULT_SCALE_COLOUR, "#d72622"); // start: Rot
  assert.equal(LEGACY_SCALE_COLOUR, "#1f6fd1"); // DEC-20: absent colourMode and scaleColour = the 1.0.0 look
  assert.equal(COLOUR_REPEAT_NOTE, "Mehr als 120 Werte: Farben wiederholen sich.");
  assert.equal(COLOUR_MULTI, "#6e6259");
  assert.equal(COLOUR_EMPTY, "#c4c7ca");
  assert.equal(MULTI_LABEL, "mehrere Werte");
});

test("[unit] DEC-15 distinct colours equal the reference app's golden-angle colours and repeat after 120", () => {
  const colours = Array.from({ length: COLOUR_DISTINCT_COUNT }, (_, i) => distinctColour(i));
  for (let i = 0; i < 2 * COLOUR_DISTINCT_COUNT + 5; i++) assert.equal(distinctColour(i), distinctHex(i), `index ${i}`);
  for (const c of colours) assert.match(c, HEX);
  assert.equal(new Set(colours).size, COLOUR_DISTINCT_COUNT, "120 different colours");
  assert.equal(distinctColour(COLOUR_DISTINCT_COUNT), distinctColour(0), "repeats after 120");
  for (const special of [COLOUR_EMPTY, COLOUR_MULTI])
    assert.ok(!colours.includes(special), `${special} differs from the distinct colours`);
});

test("[unit] DEC-15 scale colours: 12 % tint to the full swatch colour in 24 steps, as the reference scaleHex", () => {
  // REQ-005-AC5 (logic): the smallest value of Blau is #e4eef9, the largest #1f6fd1; Gruen #2e9b4f; own #123456
  assert.equal(scaleColour("#1F6FD1", 0), "#e4eef9");
  assert.equal(scaleColour("#1F6FD1", 1), "#1f6fd1");
  assert.equal(scaleColour("#2E9B4F", 1), "#2e9b4f");
  assert.equal(scaleColour("#123456", 1), "#123456");
  for (const hex of [...Object.values(SWATCHES), "#123456", "#ffffff", "#000000"])
    for (let k = 0; k <= 48; k++) {
      const t = k / 48;
      assert.equal(scaleColour(hex, t), scaleHex(hex, t), `${hex} t=${t}`);
    }
  // quantised to 24 steps: 25 colours from t = 0 to 1, monotonically darker
  const blue = Array.from({ length: 1001 }, (_, k) => scaleColour("#1f6fd1", k / 1000));
  assert.equal(new Set(blue).size, COLOUR_SCALE_STEPS + 1);
  const lum = (hex) => [1, 3, 5].reduce((sum, at) => sum + parseInt(hex.slice(at, at + 2), 16), 0);
  for (let k = 1; k < blue.length; k++) assert.ok(lum(blue[k]) <= lum(blue[k - 1]), `t=${k / 1000} not lighter`);
  // positions outside [0, 1] are clamped; an invalid base uses the start colour Rot
  assert.equal(scaleColour("#1f6fd1", -3), "#e4eef9");
  assert.equal(scaleColour("#1f6fd1", 7), "#1f6fd1");
  assert.equal(scaleColour("rot", 1), "#d72622");
  assert.equal(normaliseHexColour("#ABCDEF"), "#abcdef");
  for (const bad of ["red", "#abc", "#abcdeg", "abcdef", "#abcdef0", null, 123])
    assert.equal(normaliseHexColour(bad), null);
});

// logic of REQ-005-AC2 (cited in a comment, spec Testing T5; verification INC-2 SYNC-4)
test("[unit] REQ-005 Kategorie on AC20-FZK-Haus: one colour per category, legend counts equal the reference", () => {
  const store = createColumnStore(FZK_ROWS);
  const scheme = colourScheme(store, "Kategorie");
  assert.equal(scheme.numeric, false);
  assert.equal(scheme.mode, "distinct", "no options: Unterschiedliche Farben");
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
  // colours in value order (as the filter sets): the n-th category alphabetically has distinct colour n
  const sorted = Object.keys(expected).sort();
  sorted.forEach((k, n) => assert.equal(byKategorie.get(k), distinctHex(n), k));
});

test("[unit] REQ-005 legend lists only the rows inside the filter (REQ-004-AC2 ground floor), colours stay stable", () => {
  const ac = REF.filters["REQ-004-AC2"];
  const store = createColumnStore(FZK_ROWS);
  for (const mode of ["distinct", "scale"]) {
    const scheme = colourScheme(store, "Kategorie", { mode, colour: "#1f6fd1" });
    const inside = filterRows(store, [{ key: "Geschoss", type: "values", values: ac.filter.Geschoss }]);
    const legend = colourLegend(scheme, inside);
    const expected = { ...ac.kategorieCountsOnGroundFloor };
    for (const [k, n] of Object.entries(ac.kategorieCountsOnGroundFloorConditional))
      if (FZK_ROWS.some((r) => r.values.Kategorie === k)) expected[k] = n;
    assert.deepEqual(Object.fromEntries(legend.map((e) => [e.label, e.count])), expected, mode);
    const full = colourLegend(scheme, all(FZK_ROWS.length));
    for (const e of legend)
      assert.equal(e.colour, full.find((f) => f.label === e.label).colour, `${mode}: same colour as unfiltered`);
  }
});

test("[unit] DEC-15 distinct mode with more than 120 values: colours repeat, `repeats` set; legend capped at 200 rows", () => {
  // REQ-005-AC8 (logic): value 121 has the colour of value 1; the note; more than 200 values -> 200 rows + `+<n>`
  const rows = Array.from({ length: 250 }, (_, i) => row("r" + i, { G: "g" + String(i).padStart(3, "0") }));
  rows.push(row("m", { G: ["g000", "g001"] }), row("e", {}));
  const scheme = colourScheme(rows, "G", { mode: "distinct" });
  assert.equal(scheme.count, 250);
  assert.equal(scheme.repeats, true);
  assert.equal(scheme.gradient, null);
  assert.equal(scheme.rowColour(120), scheme.rowColour(0), "value 121 = value 1");
  assert.equal(scheme.rowColour(239), scheme.rowColour(119));
  assert.equal(scheme.rowColour(0), distinctHex(0));
  assert.equal(scheme.valueColour("g121"), distinctHex(1));
  assert.equal(scheme.rowColour(250), COLOUR_MULTI);
  assert.equal(scheme.rowColour(251), COLOUR_EMPTY);
  const legend = colourLegend(scheme, all(rows.length));
  assert.equal(legend.length, 252, "one row per value plus `mehrere Werte` and `(leer)`");
  assert.deepEqual(
    legend.slice(0, 3).map((e) => [e.label, e.count, e.kind]),
    [
      ["g000", 1, "value"],
      ["g001", 1, "value"],
      ["g002", 1, "value"],
    ],
  );
  assert.deepEqual(
    legend.slice(-2).map((e) => [e.label, e.count, e.colour]),
    [
      [MULTI_LABEL, 1, COLOUR_MULTI],
      ["(leer)", 1, COLOUR_EMPTY],
    ],
  );
  const shown = legendRows(legend);
  assert.equal(shown.rows.length, 200);
  assert.equal(shown.more, 52);
  assert.deepEqual(shown.rows, legend.slice(0, 200));
  assert.deepEqual(legendRows(legend.slice(0, 120)), { rows: legend.slice(0, 120), more: 0 });
  // exactly 120 values: no repetition, no note; scale mode never repeats
  const exact = colourScheme(rows.slice(0, 120), "G");
  assert.equal(exact.repeats, false);
  assert.equal(new Set(exact.entries.filter((e) => e.kind === "value").map((e) => e.colour)).size, 120);
  assert.equal(colourScheme(rows, "G", { mode: "scale" }).repeats, false);
});

test("[unit] DEC-15 scale mode for numbers: by value from min (12 % tint) to max (full colour), gradient labels", () => {
  // REQ-005-AC5 (logic) on AC20-FZK-Haus BaseQuantities.NetVolume in Blau
  const key = "BaseQuantities.NetVolume";
  const store = createColumnStore(FZK_ROWS);
  const scheme = colourScheme(store, key, { mode: "scale", colour: "#1F6FD1" });
  assert.equal(scheme.mode, "scale");
  assert.equal(scheme.colour, "#1f6fd1");
  assert.equal(scheme.numeric, true);
  const volumes = FZK_ROWS.map((r) => r.values[key]).filter((v) => typeof v === "number");
  const min = Math.min(...volumes);
  const max = Math.max(...volumes);
  FZK_ROWS.forEach((r, i) => {
    const v = r.values[key];
    if (typeof v !== "number") assert.equal(scheme.rowColour(i), COLOUR_EMPTY, `${r.key} without volume: (leer)`);
    else assert.equal(scheme.rowColour(i), scaleHex("#1F6FD1", (v - min) / (max - min)), r.key);
    if (v === min) assert.equal(scheme.rowColour(i), "#e4eef9", "smallest value: 12 % tint");
    if (v === max) assert.equal(scheme.rowColour(i), "#1f6fd1", "largest value: full colour");
  });
  const de = (x) => x.toLocaleString("de-DE", { maximumFractionDigits: 3 });
  assert.deepEqual(scheme.gradient, { from: "#e4eef9", to: "#1f6fd1", first: de(min), last: de(max) });
  // another swatch and an own colour change the largest value's colour
  const iMax = FZK_ROWS.findIndex((r) => r.values[key] === max);
  assert.equal(colourScheme(store, key, { mode: "scale", colour: "#2E9B4F" }).rowColour(iMax), "#2e9b4f");
  assert.equal(colourScheme(store, key, { mode: "scale", colour: "#123456" }).rowColour(iMax), "#123456");
  // positions by value, not by rank: 0, 1, 10 -> t = 0, 0.1, 1
  const spread = colourScheme([row("a", { V: 0 }), row("b", { V: 1 }), row("c", { V: 10 })], "V", { mode: "scale" });
  assert.deepEqual(
    [0, 1, 2].map((i) => spread.rowColour(i)),
    [scaleHex("#D72622", 0), scaleHex("#D72622", 0.1), scaleHex("#D72622", 1)],
    "default scale colour Rot",
  );
  assert.equal(spread.rowColour(2), "#d72622");
  // one value only: full colour
  const one = colourScheme([row("a", { V: 7 }), row("b", { V: 7 })], "V", { mode: "scale", colour: "#7B3FB5" });
  assert.equal(one.rowColour(0), "#7b3fb5");
  assert.deepEqual(one.gradient, { from: scaleHex("#7B3FB5", 0), to: "#7b3fb5", first: "7", last: "7" });
});

test("[unit] DEC-15 scale mode for text (and mixed values): by rank from the tint to the full colour", () => {
  // REQ-005-AC5 (logic): a text property in Farbskala is coloured by rank
  const rows = ["c", "a", "e", "b", "d"].map((v, i) => row("t" + i, { T: v }));
  const scheme = colourScheme(rows, "T", { mode: "scale", colour: "#E8890C" });
  assert.equal(scheme.numeric, false);
  const rank = { a: 0, b: 1, c: 2, d: 3, e: 4 };
  rows.forEach((r, i) => assert.equal(scheme.rowColour(i), scaleHex("#E8890C", rank[r.values.T] / 4), r.values.T));
  assert.deepEqual(scheme.gradient, { from: scaleHex("#E8890C", 0), to: "#e8890c", first: "a", last: "e" });
  // numbers and text mixed: every value by rank (numbers first, as the filter sets sort them)
  const mixed = colourScheme([row("x", { M: "abc" }), row("y", { M: 100 }), row("z", { M: 2 })], "M", {
    mode: "scale",
  });
  assert.equal(mixed.numeric, false);
  assert.deepEqual(
    [2, 1, 0].map((i) => mixed.rowColour(i)),
    [0, 0.5, 1].map((t) => scaleHex("#D72622", t)),
  );
});

test("[unit] DEC-15 `mehrere Werte` and `(leer)` keep their colours in both modes; options are validated", () => {
  // REQ-005-AC4 (logic): two materials -> `mehrere Werte`, no material -> `(leer)`, in either mode
  const rows = [
    row("a", { Material: ["Holz"] }),
    row("b", { Material: ["Beton", "Holz"] }),
    row("c", { Material: [] }),
    row("d", { Material: ["Holz", "Holz"] }), // repeated value = one distinct value
    row("e", {}),
  ];
  for (const options of [undefined, { mode: "distinct" }, { mode: "scale", colour: "#4E5355" }]) {
    const scheme = colourScheme(rows, "Material", options);
    const what = JSON.stringify(options);
    assert.equal(scheme.rowColour(1), COLOUR_MULTI, what);
    assert.equal(scheme.rowColour(2), COLOUR_EMPTY, what);
    assert.equal(scheme.rowColour(3), scheme.valueColour("Holz"), what);
    assert.equal(scheme.rowColour(4), COLOUR_EMPTY, what);
    assert.equal(scheme.valueColour(null), COLOUR_EMPTY, what);
    assert.equal(scheme.valueColour("unbekannt"), undefined, what);
    assert.deepEqual(
      colourLegend(scheme, all(rows.length)).map((e) => [e.label, e.count, e.kind]),
      [
        ["Beton", 0, "value"],
        ["Holz", 2, "value"],
        [MULTI_LABEL, 1, "multi"],
        ["(leer)", 2, "empty"],
      ].filter((e) => e[1] > 0),
      what,
    );
  }
  // Beton exists only inside a multi-valued row: it is a value of the scheme, but no row has its colour
  assert.equal(colourScheme(rows, "Material", { mode: "scale" }).valueColour("Beton"), scaleHex("#D72622", 0));
  // a property no row has: only (leer), no gradient
  const none = colourScheme(rows, "Fehlt", { mode: "scale" });
  assert.equal(none.numeric, false);
  assert.equal(none.gradient, null);
  assert.deepEqual(
    colourLegend(none, all(rows.length)).map((e) => [e.label, e.count]),
    [["(leer)", 5]],
  );
  // unknown mode -> distinct; invalid colour -> Rot; the colour is reported in lower case
  const odd = colourScheme(rows, "Material", { mode: "rainbow", colour: "red" });
  assert.equal(odd.mode, "distinct");
  assert.equal(odd.colour, "#d72622");
  assert.equal(colourScheme(rows, "Material", { mode: "scale", colour: "#ABCDEF" }).colour, "#abcdef");
});

test("[unit] DEC-15 numbers in the legend use the table's German display text", () => {
  const scheme = colourScheme([row("a", { V: 0.5 }), row("b", { V: 1234.56789 }), row("c", { V: 0.3 })], "V");
  assert.deepEqual(
    scheme.entries.filter((e) => e.kind === "value").map((e) => [e.label, e.value]),
    [
      ["0,3", 0.3],
      ["0,5", 0.5],
      ["1.234,568", 1234.56789],
    ],
  );
  const bool = colourScheme([row("a", { B: true }), row("b", { B: false })], "B");
  assert.deepEqual(
    bool.entries
      .filter((e) => e.kind === "value")
      .map((e) => e.label)
      .sort(),
    ["Ja", "Nein"],
  );
});
