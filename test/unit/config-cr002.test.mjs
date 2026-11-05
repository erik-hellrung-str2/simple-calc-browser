// [unit] tests of the CR-002 configuration fields in cv-core (TASK-012; spec REQ-009, DEC-20 field table):
// filterRules, search, display.colourMode, display.scaleColour, display.sectionPlane and the 1.0.0 display.section
// (read and converted, never written): buildConfig writes, applyConfig validates and applies, absence defaults, the
// axis-section conversion, `sectionPlane` wins over `section`, every invalid case of the DEC-20 field table.
// Expected values come from the DEC-20 field table and REQ-009 text (labels, defaults, conversions); input files are the
// committed fixtures of scripts/make-config-fixtures.mjs (the 1.0.0 one is byte-identical to what tag v1.0.0's
// buildConfig writes for the same state, docs/tasks/TASK-012.md); the AC20-FZK-Haus rows snapshot is INPUT only.
// UI-level ACs whose logic is covered here are cited in comments only (spec Testing T5): REQ-009-AC4, AC5, AC6, AC7,
// AC8; their notices in the UI are verified end to end in TASK-018.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCore } from "../load-core.mjs";
import {
  AXIS_SECTION_OFFSET,
  FZK_VOLUME,
  config110,
  configText,
  dec20InvalidCases,
} from "../../scripts/make-config-fixtures.mjs";

const core = await loadCore();
const { applyConfig, buildConfig, configNotice, configSkippedAnything, createColumnStore, parseConfig } = core;
const { planeFromAxisSection, normaliseSectionPlane } = core;

const fixtures = new URL("../fixtures/", import.meta.url);
const REF = JSON.parse(readFileSync(new URL("reference-values.json", fixtures), "utf8"));
const FZK_ROWS = JSON.parse(readFileSync(new URL("fzk-rows.snapshot.json", fixtures), "utf8")).rows;
const ABSENT = REF["REQ-009-config"].absentProperty; // a Duplex property AC20-FZK-Haus does not have
const fixture = (name) => parseConfig(readFileSync(new URL(name, fixtures), "utf8"));

/** ctx of applyConfig over plain rows (as the app: has, hasValue, isNumber from the values, hasGeometry). */
function ctxOf(rows, { geometry = true } = {}) {
  const store = createColumnStore(rows);
  const keys = new Set(rows.flatMap((r) => Object.keys(r.values)));
  const numeric = new Set(
    [...keys].filter(
      (k) =>
        rows.some((r) => typeof r.values[k] === "number") &&
        rows.every((r) => !(k in r.values) || typeof r.values[k] === "number"),
    ),
  );
  return {
    has: (key) => keys.has(key),
    hasValue(key, value) {
      const col = store.column(key);
      return value === null ? col.empties : col.index.get(value) !== undefined;
    },
    columns: [],
    isNumber: (key) => numeric.has(key),
    hasGeometry: () => geometry,
  };
}
const FZK = ctxOf(FZK_ROWS);
const NOTHING_SKIPPED = { properties: [], values: [], invalid: [], unknown: [] };

const row = (key, values) => ({ key, guid: key, values });
const ROWS = [
  row("m1:1", { Kategorie: "IfcWall", Name: "Wand-1", Material: ["Beton", "Putz"], Vol: 2 }),
  row("m1:2", { Kategorie: "IfcSlab", Name: "Decke-1", Material: "Beton", Vol: 5 }),
];
const base = (extra) => ({ schema: "calc-viewer-config/1", ...extra });

test("[unit] DEC-20 buildConfig writes the five new fields: rules in order, search, mode, colour, plane", () => {
  const config = buildConfig({
    header: { date: "2026-08-12" },
    filterRules: [
      { mode: "hide", key: "Name", op: "ends", value: "-1" },
      { mode: "bogus", key: "Name", op: "eq", value: "x" }, // invalid: left out
      { mode: "text", key: "Name", op: "contains", value: "wand" }, // text: key written as null
      { mode: "isolate", key: "Name", op: "eq", value: "" }, // empty value: left out
      { mode: "mark", key: "Kategorie", op: "starts", value: "IfcS" },
    ],
    search: "Beton",
    display: { mode: "ghost", colourKey: null, colourMode: "scale", scaleColour: "#7B3FB5", section: null },
  });
  assert.deepEqual(config.filterRules, [
    { mode: "hide", key: "Name", op: "ends", value: "-1" },
    { mode: "text", key: null, op: "contains", value: "wand" },
    { mode: "mark", key: "Kategorie", op: "starts", value: "IfcS" },
  ]);
  for (const rule of config.filterRules) assert.deepEqual(Object.keys(rule), ["mode", "key", "op", "value"]);
  assert.equal(config.search, "Beton");
  // the last chosen mode and colour are written also while nothing is coloured; the colour in lower case
  assert.deepEqual(config.display, {
    mode: "ghost",
    colourBy: null,
    colourMode: "scale",
    scaleColour: "#7b3fb5",
    sectionPlane: null,
  });
  // invalid mode / colour / search in the state fall back to the start values
  const odd = buildConfig({ search: 5, display: { colourMode: "rainbow", scaleColour: "red" } });
  assert.equal(odd.search, "");
  assert.equal(odd.display.colourMode, "distinct");
  assert.equal(odd.display.scaleColour, "#d72622");
});

test("[unit] DEC-20 buildConfig: a plane is saved normalised, a 1.0.0 axis section converted; never `section`", () => {
  const plane = (section) => buildConfig({ display: { section } }).display;
  assert.deepEqual(plane({ point: [1, 2, 3], normal: [0, 0, -1] }).sectionPlane, {
    point: [1, 2, 3],
    normal: [0, 0, -1],
  });
  assert.deepEqual(plane({ point: [1, 2, 3], normal: [0, 3, 4] }).sectionPlane, {
    point: [1, 2, 3],
    normal: [0, 0.6, 0.8],
  });
  // the axis section of the 1.0.0 3D view (until TASK-014 replaces it) is saved as the plane it equals
  assert.deepEqual(plane({ axis: "Z", offset: 1.25, flipped: false }).sectionPlane, {
    point: [0, 0, 1.25],
    normal: [0, 0, -1],
  });
  assert.deepEqual(plane({ axis: "X", offset: -4, flipped: true }).sectionPlane, {
    point: [-4, 0, 0],
    normal: [1, 0, 0],
  });
  for (const section of [
    { point: [0, 0, 0], normal: [0, 0, 0] },
    { axis: "W", offset: 1 },
  ])
    assert.equal(plane(section).sectionPlane, null, JSON.stringify(section));
  for (const s of [null, { axis: "Z", offset: 1 }, { point: [0, 0, 1], normal: [0, 0, 1] }])
    assert.ok(!("section" in plane(s)), "display.section is never written");
});

test("[unit] DEC-20 buildConfig: hidden and isolated elements are never saved", () => {
  // REQ-009-AC7 (logic)
  const keys = ["0:4711", "0:4712", "1:99"];
  const config = buildConfig({
    header: { date: "2026-08-12" },
    hidden: new Set(keys),
    isolated: new Set(keys.slice(0, 1)),
    hiddenKeys: keys,
    isolatedKeys: keys,
    display: { mode: "ghost", hidden: keys, isolated: keys },
  });
  const text = JSON.stringify(config);
  for (const key of keys) assert.ok(!text.includes(key), `${key} not in the configuration`);
  assert.doesNotMatch(text, /hidden|isolated|ausgeblendet|isoliert/i);
  assert.deepEqual(Object.keys(config), [
    "schema",
    "header",
    "filterSets",
    "filterRules",
    "search",
    "table",
    "display",
  ]);
  assert.deepEqual(Object.keys(config.display), ["mode", "colourBy", "colourMode", "scaleColour", "sectionPlane"]);
});

test("[unit] DEC-20 applyConfig filterRules: valid rules in file order, text key ignored, missing key named", () => {
  const { apply, skipped } = applyConfig(
    base({
      filterRules: [
        { mode: "isolate", key: "Kategorie", op: "contains", value: "wall" },
        { mode: "text", key: "Gibtsnicht", op: "eq", value: "Beton" }, // key of a text rule ignored
        { mode: "hide", key: "Fehlt.X", op: "eq", value: "1" }, // property absent: named, skipped
        { mode: "mark", key: "Name", op: "starts", value: "Wand", extra: 1 },
        { mode: "hide", key: "Fehlt.X", op: "starts", value: "2" }, // named once
      ],
    }),
    ctxOf(ROWS),
  );
  assert.deepEqual(apply.filterRules, [
    { mode: "isolate", key: "Kategorie", op: "contains", value: "wall" },
    { mode: "text", key: null, op: "eq", value: "Beton" },
    { mode: "mark", key: "Name", op: "starts", value: "Wand" },
  ]);
  assert.deepEqual(skipped, { ...NOTHING_SKIPPED, properties: ["Fehlt.X"] });
  // every action and comparison of spec 4.3 is accepted
  for (const mode of ["isolate", "hide", "mark", "text"])
    for (const op of ["eq", "starts", "ends", "contains"]) {
      const r = applyConfig(base({ filterRules: [{ mode, key: "Name", op, value: "v" }] }), ctxOf(ROWS));
      assert.deepEqual(r.apply.filterRules, [{ mode, key: mode === "text" ? null : "Name", op, value: "v" }]);
      assert.equal(configSkippedAnything(r.skipped), false);
    }
});

test("[unit] DEC-20 applyConfig: a rule on an absent property and a malformed rule are skipped", () => {
  // REQ-009-AC6 (logic)
  const { apply, skipped } = applyConfig(fixture("config-1.1.0-rules-skipped.json"), FZK);
  assert.deepEqual(apply.filterRules, [
    { mode: "isolate", key: "Kategorie", op: "contains", value: "wall" },
    { mode: "hide", key: "Name", op: "ends", value: "-1" },
  ]);
  assert.deepEqual(skipped.properties, [ABSENT]);
  assert.deepEqual(skipped.invalid, ["Filterregel"]);
  const notice = configNotice(skipped);
  assert.ok(notice.includes(ABSENT), notice);
  assert.ok(notice.includes("Filterregel"), notice);
});

test("[unit] DEC-20 absent filterRules and search clear them; a 1.0.0 file gives no rules and no search", () => {
  // REQ-009-AC5 (logic)
  const { apply, skipped } = applyConfig(fixture("config-1.0.0-axis-section.json"), FZK);
  assert.deepEqual(apply.filterRules, []);
  assert.equal(apply.search, "");
  assert.deepEqual(skipped, NOTHING_SKIPPED, "a 1.0.0 file loads without notice");
  // also a file without any part: rules and search are cleared, nothing else is defined
  assert.deepEqual(applyConfig(base({}), FZK).apply, { filterRules: [], search: "" });
  // search: text as saved (also blank or with HTML), else `Suche` and treated as ""
  assert.equal(applyConfig(base({ search: "  <b>x</b> " }), FZK).apply.search, "  <b>x</b> ");
  for (const search of [null, 3, ["wand"], { text: "x" }, true]) {
    const r = applyConfig(base({ search }), FZK);
    assert.equal(r.apply.search, "", JSON.stringify(search));
    assert.deepEqual(r.skipped.invalid, ["Suche"], JSON.stringify(search));
  }
});

test("[unit] DEC-20 1.0.0 axis section converts to a plane, both flips; numeric colourBy -> Farbskala Blau", () => {
  // REQ-009-AC4 (logic)
  const h = AXIS_SECTION_OFFSET;
  const plain = applyConfig(fixture("config-1.0.0-axis-section.json"), FZK);
  assert.deepEqual(plain.skipped, NOTHING_SKIPPED, "no notice names display.section");
  assert.deepEqual(plain.apply.display, {
    mode: "ghost",
    colourBy: FZK_VOLUME,
    colourMode: "scale",
    scaleColour: "#1f6fd1",
    sectionPlane: { point: [0, 0, h], normal: [0, 0, -1] },
  });
  const flipped = applyConfig(fixture("config-1.0.0-axis-section-flipped.json"), FZK);
  assert.deepEqual(flipped.apply.display.sectionPlane, { point: [0, 0, h], normal: [0, 0, 1] });
  // saving the applied state writes sectionPlane and no section
  const saved = buildConfig({
    display: {
      mode: plain.apply.display.mode,
      colourKey: plain.apply.display.colourBy,
      colourMode: plain.apply.display.colourMode,
      scaleColour: plain.apply.display.scaleColour,
      section: plain.apply.display.sectionPlane,
    },
  });
  assert.deepEqual(saved.display, {
    mode: "ghost",
    colourBy: FZK_VOLUME,
    colourMode: "scale",
    scaleColour: "#1f6fd1",
    sectionPlane: { point: [0, 0, h], normal: [0, 0, -1] },
  });
  // the other axes, flipped missing (= false); point 0 except the axis component
  const axis = (section) => applyConfig(base({ display: { section } }), FZK).apply.display.sectionPlane;
  assert.deepEqual(axis({ axis: "X", offset: 2.5 }), { point: [2.5, 0, 0], normal: [-1, 0, 0] });
  assert.deepEqual(axis({ axis: "Y", offset: -1, flipped: true }), { point: [0, -1, 0], normal: [0, 1, 0] });
  assert.deepEqual(planeFromAxisSection({ axis: "Z", offset: 0.5, flipped: false }), {
    point: [0, 0, 0.5],
    normal: [0, 0, -1],
  });
  for (const bad of [null, {}, { axis: "W", offset: 1 }, { axis: "Z", offset: "1" }, { axis: "Z", offset: Infinity }])
    assert.equal(planeFromAxisSection(bad), null, JSON.stringify(bad));
  // invalid as 1.0.0 -> `Schnitt`; `section: null` -> no section
  for (const section of [{ axis: "W", offset: 1 }, { axis: "Z" }, { axis: "Z", offset: 1, flipped: "ja" }, 3]) {
    const r = applyConfig(base({ display: { section } }), FZK);
    assert.deepEqual(r.skipped.invalid, ["Schnitt"], JSON.stringify(section));
    assert.ok(!("sectionPlane" in r.apply.display), "skipped: the current section stays");
  }
  assert.equal(axis(null), null);
});

test("[unit] DEC-20 colourMode / scaleColour absence defaults and accepted values", () => {
  const display = (d) => applyConfig(base({ display: d }), FZK).apply.display;
  // absent mode and colour: the 1.0.0 look (numeric -> scale, else distinct; Blau)
  assert.deepEqual(display({ colourBy: FZK_VOLUME }), {
    colourBy: FZK_VOLUME,
    colourMode: "scale",
    scaleColour: "#1f6fd1",
    sectionPlane: null,
  });
  assert.equal(display({ colourBy: "Material" }).colourMode, "distinct");
  assert.equal(display({ colourBy: null }).colourMode, "distinct");
  assert.equal(display({}).colourMode, "distinct");
  assert.equal(display({ colourBy: "Fehlt.X" }).colourMode, "distinct", "a missing property is not numeric");
  assert.equal(display({}).scaleColour, "#1f6fd1");
  // mode present, colour absent -> Rot (the start colour); colour present -> kept, upper case accepted
  assert.deepEqual(display({ colourBy: "Material", colourMode: "scale" }).scaleColour, "#d72622");
  assert.deepEqual(display({ colourBy: FZK_VOLUME, colourMode: "distinct" }), {
    colourBy: FZK_VOLUME,
    colourMode: "distinct",
    scaleColour: "#d72622",
    sectionPlane: null,
  });
  assert.equal(display({ colourMode: "distinct", scaleColour: "#2E9B4F" }).scaleColour, "#2e9b4f");
  assert.equal(display({ scaleColour: "#123456" }).scaleColour, "#123456");
  assert.equal(display({ scaleColour: "#123456" }).colourMode, "distinct");
});

test("[unit] DEC-20 sectionPlane: valid, normalised, null; wins over section; no geometry -> `Schnitt`", () => {
  const load = (d, ctx = FZK) => applyConfig(base({ display: d }), ctx);
  const p = { point: [1, 2, 3], normal: [0, 0, -1] };
  assert.deepEqual(load({ sectionPlane: p }).apply.display.sectionPlane, p);
  assert.deepEqual(load({ sectionPlane: { point: [1, 2, 3], normal: [0, 0, -2] } }).apply.display.sectionPlane, p);
  assert.deepEqual(load({ sectionPlane: { point: [1, 2, 3], normal: [3, 4, 0] } }).apply.display.sectionPlane, {
    point: [1, 2, 3],
    normal: [0.6, 0.8, 0],
  });
  assert.equal(load({ sectionPlane: null }).apply.display.sectionPlane, null);
  // a plane far outside every model is applied as given (REQ-013)
  assert.deepEqual(load({ sectionPlane: { point: [1e6, -1e6, 1e6], normal: [1, 0, 0] } }).apply.display.sectionPlane, {
    point: [1e6, -1e6, 1e6],
    normal: [1, 0, 0],
  });
  // sectionPlane present: section ignored silently, whatever it holds
  for (const section of [{ axis: "X", offset: 9, flipped: true }, { axis: "W" }, "kaputt"]) {
    const r = load({ sectionPlane: p, section });
    assert.deepEqual(r.apply.display.sectionPlane, p, JSON.stringify(section));
    assert.deepEqual(r.skipped, NOTHING_SKIPPED, JSON.stringify(section));
    assert.equal(load({ sectionPlane: null, section }).apply.display.sectionPlane, null);
  }
  // an invalid sectionPlane is skipped (`Schnitt`), and a valid section next to it is not used either
  const bad = load({ sectionPlane: { point: [0, 0, 1], normal: [0, 0, 0] }, section: { axis: "Z", offset: 1 } });
  assert.deepEqual(bad.skipped.invalid, ["Schnitt"]);
  assert.ok(!("sectionPlane" in bad.apply.display));
  // no model with geometry loaded: a plane (also a converted axis section) is skipped and named; null still applies
  const flat = ctxOf(FZK_ROWS, { geometry: false });
  for (const d of [{ sectionPlane: p }, { section: { axis: "Z", offset: 1, flipped: false } }]) {
    const r = load(d, flat);
    assert.deepEqual(r.skipped.invalid, ["Schnitt"], JSON.stringify(d));
    assert.ok(!("sectionPlane" in r.apply.display), JSON.stringify(d));
  }
  assert.equal(load({ sectionPlane: null }, flat).apply.display.sectionPlane, null);
  // normaliseSectionPlane: -0 becomes 0; a unit normal is kept bit for bit (JSON-stable)
  assert.deepEqual(normaliseSectionPlane({ point: [-0, 0, 1], normal: [0, -0, 1] }), {
    point: [0, 0, 1],
    normal: [0, 0, 1],
  });
  const unit = [0.6000000000000001, 0.8, 0];
  assert.deepEqual(normaliseSectionPlane({ point: [0, 0, 0], normal: unit }).normal, unit);
});

test("[unit] DEC-20 field table: every invalid case is named with its label and skipped, the rest applies", () => {
  // REQ-009-AC8 (logic)
  const cases = dec20InvalidCases();
  assert.deepEqual(
    cases.map((c) => c.name),
    [
      "filterRules-not-a-list",
      "rule-unknown-mode",
      "rule-unknown-op",
      "rule-empty-value",
      "rule-non-text-value",
      "rule-missing-key",
      "search-not-text",
      "colourMode-rainbow",
      "scaleColour-red",
      "sectionPlane-zero-normal",
      "sectionPlane-nan-point",
      "sectionPlane-missing-point",
      "sectionPlane-non-unit-normal",
    ],
  );
  const valid = config110();
  const VALID_RULES = valid.filterRules.map((r) => ({ ...r }));
  for (const c of cases) {
    // loaded as the file text, as `Konfiguration laden` reads it (NaN becomes null in JSON)
    const { apply, skipped } = applyConfig(parseConfig(configText(c.config)), FZK);
    assert.deepEqual(skipped.invalid, c.label ? [c.label] : [], c.name);
    assert.deepEqual(skipped.properties, [], c.name);
    assert.deepEqual(skipped.unknown, [], c.name);
    // the rest of the file is applied
    assert.equal(apply.header.title, valid.header.title, c.name);
    assert.deepEqual(
      apply.filterSets.map((s) => s.key),
      ["Kategorie", "Geschoss", "Material"],
      c.name,
    );
    assert.equal(apply.table.columns.length, 5, c.name);
    assert.equal(apply.display.colourBy, FZK_VOLUME, c.name);
    // the field itself as DEC-20 says
    const field = {
      filterRules: c.name === "filterRules-not-a-list" ? [] : VALID_RULES,
      search: c.name === "search-not-text" ? "" : valid.search,
      colourMode: "scale", // rainbow: treated as absent -> numeric colourBy -> scale
      scaleColour: c.name === "scaleColour-red" ? "#d72622" : valid.display.scaleColour,
    };
    assert.deepEqual(apply.filterRules, field.filterRules, c.name);
    assert.equal(apply.search, field.search, c.name);
    assert.equal(apply.display.colourMode, field.colourMode, c.name);
    assert.equal(apply.display.scaleColour, field.scaleColour, c.name);
    if (c.name === "sectionPlane-non-unit-normal")
      assert.deepEqual(apply.display.sectionPlane, { point: [0, 0, 1.502], normal: [0, 0, -1] }, c.name);
    else if (c.field === "display.sectionPlane") assert.ok(!("sectionPlane" in apply.display), c.name);
    else assert.deepEqual(apply.display.sectionPlane, valid.display.sectionPlane, c.name);
    if (c.label) assert.ok(configNotice(skipped).includes(c.label), c.name);
  }
  // the colourMode case with a text colouring property: treated as absent -> distinct; scaleColour then stays given
  const textColour = config110();
  textColour.display.colourBy = "Material";
  textColour.display.colourMode = "rainbow";
  const r = applyConfig(textColour, FZK);
  assert.deepEqual([r.apply.display.colourMode, r.apply.display.scaleColour], ["distinct", "#2e9b4f"]);
  // NaN directly in the object (not through JSON) is invalid as well
  const nan = applyConfig(base({ display: { sectionPlane: { point: [0, NaN, 1], normal: [0, 0, -1] } } }), FZK);
  assert.deepEqual(nan.skipped.invalid, ["Schnitt"]);
  // the valid 1.1.0 file itself loads without notice and round-trips byte for byte through buildConfig
  const full = applyConfig(fixture("config-1.1.0-full.json"), FZK);
  assert.deepEqual(full.skipped, NOTHING_SKIPPED);
  const again = buildConfig({
    header: full.apply.header,
    filterSets: full.apply.filterSets,
    filterRules: full.apply.filterRules,
    search: full.apply.search,
    table: full.apply.table,
    grouping: { view: full.apply.table.view, groupBy: full.apply.table.groupBy },
    display: {
      ...full.apply.display,
      colourKey: full.apply.display.colourBy,
      section: full.apply.display.sectionPlane,
    },
  });
  assert.equal(configText(again), readFileSync(new URL("config-1.1.0-full.json", fixtures), "utf8"));
});
