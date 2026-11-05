// [unit] tests of the TASK-007 configuration and header logic in cv-core (spec REQ-009 save / load with schema,
// error classes and tolerant apply; REQ-011 title / date / logo; REQ-008 file names): parseConfig / validateConfig,
// buildConfig, applyConfig (missing properties and values skipped and named, "" -> null = TASK-003 D3, malformed and
// unknown entries), configNotice, safeFileName, dates, logo checks. Error-class inputs are the committed fixtures of
// scripts/make-config-fixtures.mjs; real-data checks use the AC20-FZK-Haus rows snapshot as INPUT only, expected values
// come from test/fixtures/reference-values.json (STEP-text derivation).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCore } from "../load-core.mjs";
import { configErrorFixtures, logoPng, logoSvg } from "../../scripts/make-config-fixtures.mjs";

const core = await loadCore();
const {
  CONFIG_ERROR_CLASSES,
  CONFIG_MAX_BYTES,
  ConfigError,
  LOGO_MAX_BYTES,
  NOTICE_LIST_LIMIT,
  TITLE_MAX_LENGTH,
  applyConfig,
  buildConfig,
  classifyLogo,
  configErrorMessage,
  configNotice,
  configSkippedAnything,
  createColumnStore,
  formatBytes,
  germanDate,
  isIsoDate,
  isLogoDataUrl,
  isoDate,
  parseConfig,
  safeFileName,
  validateConfig,
} = core;

const fixtures = new URL("../fixtures/", import.meta.url);
const REF = JSON.parse(readFileSync(new URL("reference-values.json", fixtures), "utf8"));
const FZK_ROWS = JSON.parse(readFileSync(new URL("fzk-rows.snapshot.json", fixtures), "utf8")).rows;
const CFG = REF["REQ-009-config"];

/** Spec REQ-009 messages (baseline text). */
const MESSAGES = {
  "invalid-json": "Die Datei ist kein gültiges JSON.",
  "not-a-config": "Die Datei ist keine Calc-Viewer-Konfiguration.",
  "unsupported-version": (n) => `Konfigurationsversion ${n} wird nicht unterstützt.`,
};

/** ctx of applyConfig over plain rows: properties and values that occur in the rows (null = some row empty). */
function ctxOf(rows, columns = []) {
  const store = createColumnStore(rows);
  const keys = new Set(rows.flatMap((r) => Object.keys(r.values)));
  return {
    has: (key) => keys.has(key),
    hasValue(key, value) {
      const col = store.column(key);
      return value === null ? col.empties : col.index.get(value) !== undefined;
    },
    columns,
  };
}

const row = (key, values) => ({ key, guid: key, values });
const ROWS = [
  row("m1:1", { Kategorie: "IfcWall", Geschoss: "EG", Material: ["Beton", "Putz"], Vol: 2 }),
  row("m1:2", { Kategorie: "IfcSlab", Geschoss: "OG", Material: "Beton", Vol: 5 }),
  row("m1:3", { Kategorie: "IfcDoor", Vol: 1.5 }),
];

const STATE = {
  header: { title: "The M Bouwkundig", date: "2026-08-12", logo: null },
  filterSets: [
    { key: "Geschoss", collapsed: true, selected: ["EG", null] },
    { key: "Kategorie", collapsed: false, selected: [] },
  ],
  table: {
    columns: [
      { key: "Kategorie", width: 170 },
      { key: "Vol", width: 150 },
    ],
    sort: { key: "Vol", dir: "desc" },
    columnFilters: [
      { key: "Vol", type: "range", min: 1, max: null },
      { key: "Kategorie", type: "values", values: ["IfcWall"] },
    ],
  },
  grouping: { view: "grouped", groupBy: ["Kategorie", "Geschoss"] },
  // CR-002 fields (DEC-20): rules in order (one `Freie Textsuche`), search text, colouring mode and scale colour,
  // section plane { point, normal }
  filterRules: [
    { mode: "isolate", key: "Kategorie", op: "contains", value: "Ifc" },
    { mode: "text", key: null, op: "eq", value: "Beton" },
    { mode: "mark", key: "Geschoss", op: "starts", value: "E" },
  ],
  search: "beton",
  display: {
    mode: "hide",
    colourKey: "Material",
    colourMode: "scale",
    scaleColour: "#2e9b4f",
    section: { point: [1, -2, 1.25], normal: [0, 0, 1] },
  },
};
/** STATE.display as saved (DEC-20 field names). */
const SAVED_DISPLAY = {
  mode: "hide",
  colourBy: "Material",
  colourMode: "scale",
  scaleColour: "#2e9b4f",
  sectionPlane: { point: [1, -2, 1.25], normal: [0, 0, 1] },
};

test("[unit] parseConfig: one committed fixture per error class gives that class and the spec message (REQ-009-AC3)", () => {
  const fixtureSet = configErrorFixtures();
  for (const [name, meta] of Object.entries(fixtureSet)) {
    const text = readFileSync(new URL(name, fixtures), "utf8");
    assert.throws(
      () => parseConfig(text),
      (error) => {
        assert.ok(error instanceof ConfigError, name);
        assert.equal(error.configClass, meta.errorClass, name);
        const expected = MESSAGES[meta.errorClass];
        assert.equal(error.message, typeof expected === "function" ? expected(meta.version) : expected, name);
        return true;
      },
    );
  }
  assert.deepEqual(CONFIG_ERROR_CLASSES, ["invalid-json", "not-a-config", "unsupported-version", "too-large"]);
});

test("[unit] validateConfig: schema missing, foreign, empty version, non-object JSON, other versions", () => {
  for (const value of [null, 1, "x", [], [{ schema: "calc-viewer-config/1" }], {}, { schema: 1 }])
    assert.deepEqual(validateConfig(value), { configClass: "not-a-config" }, JSON.stringify(value));
  for (const schema of ["calc-viewer-config", "calc-viewer-config/", "Calc-Viewer-Config/1", "x/calc-viewer-config/1"])
    assert.deepEqual(validateConfig({ schema }), { configClass: "not-a-config" }, schema);
  assert.equal(validateConfig({ schema: "calc-viewer-config/1" }), null);
  assert.deepEqual(validateConfig({ schema: "calc-viewer-config/1.0" }), {
    configClass: "unsupported-version",
    detail: "1.0",
  });
  const long = validateConfig({ schema: "calc-viewer-config/" + "9".repeat(50) });
  assert.equal(long.configClass, "unsupported-version");
  assert.equal(long.detail, "9".repeat(20) + "…");
  // a byte order mark (editors on Windows) is accepted
  assert.deepEqual(parseConfig('﻿{"schema":"calc-viewer-config/1"}'), { schema: "calc-viewer-config/1" });
  assert.equal(configErrorMessage("unsupported-version", "7"), MESSAGES["unsupported-version"]("7"));
  assert.match(configErrorMessage("too-large"), new RegExp(formatBytes(CONFIG_MAX_BYTES)));
});

test("[unit] buildConfig: schema, every REQ-009 field in a fixed order, values unchanged, JSON-stable", () => {
  const config = buildConfig(STATE);
  // TASK-012 (CR-002, DEC-20): filterRules and search added after filterSets; display carries colourMode,
  // scaleColour and sectionPlane instead of the 1.0.0 section
  assert.deepEqual(Object.keys(config), [
    "schema",
    "header",
    "filterSets",
    "filterRules",
    "search",
    "table",
    "display",
  ]);
  assert.equal(config.schema, "calc-viewer-config/1");
  assert.deepEqual(config.header, STATE.header);
  assert.deepEqual(config.filterSets, STATE.filterSets);
  assert.deepEqual(Object.keys(config.table), ["view", "groupBy", "columns", "sort", "columnFilters"]);
  assert.deepEqual(config.table.columns, STATE.table.columns);
  assert.deepEqual(config.table.sort, STATE.table.sort);
  assert.deepEqual(config.table.columnFilters, STATE.table.columnFilters);
  assert.equal(config.table.view, "grouped");
  assert.deepEqual(config.table.groupBy, ["Kategorie", "Geschoss"]);
  assert.deepEqual(config.filterRules, STATE.filterRules);
  assert.equal(config.search, "beton");
  assert.deepEqual(Object.keys(config.display), ["mode", "colourBy", "colourMode", "scaleColour", "sectionPlane"]);
  assert.deepEqual(config.display, SAVED_DISPLAY);
  // equal states give equal text; the result is plain data (no shared references with the state)
  assert.equal(JSON.stringify(buildConfig(STATE)), JSON.stringify(config));
  config.filterSets[0].selected.push("x");
  assert.deepEqual(STATE.filterSets[0].selected, ["EG", null]);
  // defaults: empty state
  assert.deepEqual(buildConfig({ header: { date: "2026-01-02" } }), {
    schema: "calc-viewer-config/1",
    header: { title: "", date: "2026-01-02", logo: null },
    filterSets: [],
    filterRules: [],
    search: "",
    table: { view: "single", groupBy: [], columns: [], sort: null, columnFilters: [] },
    // DEC-20 "written by 1.1.0": the start mode and colour also while nothing is coloured, null = no section
    display: { mode: "ghost", colourBy: null, colourMode: "distinct", scaleColour: "#d72622", sectionPlane: null },
  });
});

// logic of REQ-009-AC1 (spec Testing T5: cited in a comment, not in the title; verification INC-2 SYNC-4)
test("[unit] applyConfig: a saved configuration applies unchanged to the same rows (REQ-009 round trip)", () => {
  const config = JSON.parse(JSON.stringify(buildConfig(STATE)));
  const { apply, skipped } = applyConfig(config, ctxOf(ROWS));
  assert.equal(configSkippedAnything(skipped), false, JSON.stringify(skipped));
  assert.equal(configNotice(skipped), null);
  assert.deepEqual(apply.header, STATE.header);
  assert.deepEqual(apply.filterSets, STATE.filterSets);
  assert.deepEqual(apply.table, { ...STATE.table, ...STATE.grouping });
  assert.deepEqual(apply.display, SAVED_DISPLAY);
  assert.deepEqual(apply.filterRules, STATE.filterRules);
  assert.equal(apply.search, STATE.search);
  // applying the result and saving again gives the same configuration
  const again = buildConfig({
    header: apply.header,
    filterSets: apply.filterSets,
    filterRules: apply.filterRules,
    search: apply.search,
    table: apply.table,
    grouping: { view: apply.table.view, groupBy: apply.table.groupBy },
    display: {
      mode: apply.display.mode,
      colourKey: apply.display.colourBy,
      colourMode: apply.display.colourMode,
      scaleColour: apply.display.scaleColour,
      section: apply.display.sectionPlane,
    },
  });
  assert.deepEqual(again, config);
});

test("[unit] applyConfig: properties and filter values missing from the loaded rows are skipped and named (REQ-009-AC2)", () => {
  const config = {
    schema: "calc-viewer-config/1",
    filterSets: [
      { key: "Kategorie", collapsed: false, selected: ["IfcWall", "IfcRoof", null] },
      { key: "Fehlt.A", collapsed: false, selected: ["x"] },
      { key: "Geschoss", collapsed: false, selected: [""] },
    ],
    table: {
      view: "grouped",
      groupBy: ["Fehlt.B", "Geschoss"],
      columns: [{ key: "Kategorie", width: 160 }, { key: "Fehlt.C", width: 100 }, "Vol"],
      sort: { key: "Fehlt.C", dir: "asc" },
      columnFilters: [
        { key: "Kategorie", type: "values", values: ["IfcRoof"] },
        { key: "Fehlt.C", type: "values", values: ["y"] },
        { key: "Vol", type: "range", min: 1, max: 4 },
      ],
    },
    display: { mode: "ghost", colourBy: "Fehlt.D", section: null },
  };
  const { apply, skipped } = applyConfig(config, ctxOf(ROWS));
  assert.deepEqual(skipped.properties, ["Fehlt.A", "Fehlt.B", "Fehlt.C", "Fehlt.D"]);
  assert.deepEqual(skipped.values, [
    { key: "Kategorie", value: "IfcRoof" },
    { key: "Kategorie", value: null },
  ]);
  assert.deepEqual(skipped.invalid, []);
  assert.deepEqual(
    apply.filterSets.map((s) => [s.key, s.selected]),
    [
      ["Kategorie", ["IfcWall"]],
      // TASK-003 D3: "" in a saved selection is the empty value (leer); a row without Geschoss exists
      ["Geschoss", [null]],
    ],
  );
  assert.deepEqual(apply.table.groupBy, ["Geschoss"]);
  assert.deepEqual(
    apply.table.columns.map((c) => c.key),
    ["Kategorie", "Vol"],
  );
  assert.equal(apply.table.sort, undefined); // the sort of a missing property is not applied
  // a values filter left without values is dropped; the range filter stays
  assert.deepEqual(apply.table.columnFilters, [{ key: "Vol", type: "range", min: 1, max: 4 }]);
  assert.equal(apply.display.colourBy, undefined);
  // TASK-012 (DEC-20): a 1.0.0 `section: null` gives no section plane (was apply.display.section = null)
  assert.equal(apply.display.sectionPlane, null);

  const notice = configNotice(skipped, (key) => (key === "Kategorie" ? "Kategorie" : key));
  assert.match(notice, /^Konfiguration geladen\. Nicht angewendet:/);
  for (const key of skipped.properties) assert.ok(notice.includes(key), key);
  assert.ok(notice.includes("Kategorie = IfcRoof"), notice);
  assert.ok(notice.includes("Kategorie = (leer)"), notice);
});

test("[unit] applyConfig: malformed and unknown entries are reported, valid parts applied, missing parts left out", () => {
  const big = "A".repeat(Math.ceil(((LOGO_MAX_BYTES + 3) / 3) * 4));
  const config = {
    schema: "calc-viewer-config/1",
    extra: 1,
    header: {
      title: "T".repeat(TITLE_MAX_LENGTH + 50),
      date: "2026-02-30",
      logo: "data:image/png;base64," + big,
      x: 1,
    },
    filterSets: [
      { key: "Kategorie", collapsed: "ja", selected: [{ a: 1 }, ["IfcWall"], "IfcWall", "IfcWall", true] },
      "Geschoss",
      { key: "" },
      { key: "Kategorie", selected: ["IfcSlab"] }, // duplicate: the first wins
    ],
    table: {
      view: "tabelle",
      groupBy: "Kategorie",
      columns: [{ key: "Kategorie" }, { key: "Kategorie", width: 300 }, 5, { key: "Vol", width: 99999 }],
      sort: { key: "Geschoss", dir: "asc" }, // not a column
      columnFilters: [
        { key: "Vol", type: "range", min: "1", max: null },
        { key: "Vol", type: "range", min: null, max: null },
        { key: "Kategorie", type: "between", values: [] },
        { key: "Geschoss", type: "values", values: ["EG"] }, // not a column
        null,
      ],
      y: true,
    },
    display: { mode: "x-ray", colourBy: 3, section: { axis: "W", offset: 1 }, z: 0 },
  };
  const { apply, skipped } = applyConfig(config, ctxOf(ROWS));
  assert.deepEqual(skipped.unknown, ["extra", "header.x", "table.y", "display.z"]);
  assert.deepEqual(skipped.properties, []);
  assert.deepEqual(skipped.values, []);
  assert.deepEqual(skipped.invalid, [
    "Datum",
    "Logo",
    "Filtersatz Kategorie",
    "Filtersätze",
    "Tabellenansicht",
    "Gruppierung",
    "Spalten",
    "Sortierung",
    "Spaltenfilter Vol",
    "Spaltenfilter Kategorie",
    "Spaltenfilter Geschoss",
    "Spaltenfilter",
    "Elemente außerhalb des Filters",
    "Färben nach",
    "Schnitt",
  ]);
  assert.equal(apply.header.title.length, TITLE_MAX_LENGTH);
  assert.ok(!("date" in apply.header) && !("logo" in apply.header));
  assert.deepEqual(apply.filterSets, [{ key: "Kategorie", collapsed: false, selected: ["IfcWall"] }]);
  assert.deepEqual(apply.table.columns, [
    { key: "Kategorie", width: 160 },
    { key: "Vol", width: 800 },
  ]);
  assert.ok(!("view" in apply.table) && !("groupBy" in apply.table) && !("sort" in apply.table));
  assert.deepEqual(apply.table.columnFilters, []);
  // TASK-012 (DEC-20 field table): colourMode and scaleColour are absent, so the 1.0.0 look applies (was {})
  assert.deepEqual(apply.display, { colourMode: "distinct", scaleColour: "#1f6fd1" });

  // a file with only some parts leaves the others out (they keep the current state); TASK-012 (DEC-20): absent
  // filterRules and search mean none, so they are always part of the result (was { header } only)
  const partial = applyConfig({ schema: "calc-viewer-config/1", header: { title: "Nur Titel" } }, ctxOf(ROWS));
  assert.deepEqual(partial.apply, { header: { title: "Nur Titel" }, filterRules: [], search: "" });
  // sort / column filters without a columns list are checked against the current columns
  const current = applyConfig(
    { schema: "calc-viewer-config/1", table: { sort: { key: "Vol", dir: "asc" } } },
    ctxOf(ROWS, ["Vol"]),
  );
  assert.deepEqual(current.apply.table.sort, { key: "Vol", dir: "asc" });
  // non-object parts are invalid as a whole
  const wrong = applyConfig(
    { schema: "calc-viewer-config/1", header: [], filterSets: {}, table: 1, display: "x" },
    ctxOf(ROWS),
  );
  assert.deepEqual(wrong.skipped.invalid, ["Kopfzeile", "Filtersätze", "Tabelle", "Modelldarstellung"]);
});

test("[unit] configNotice: lists are capped with a count of the rest", () => {
  const values = Array.from({ length: NOTICE_LIST_LIMIT + 7 }, (_, i) => ({ key: "GlobalId", value: "g" + i }));
  const notice = configNotice({ properties: ["P"], values, invalid: ["Datum"], unknown: ["foo"] });
  const lines = notice.split("\n");
  assert.equal(lines.length, 5);
  assert.ok(lines[2].endsWith(" und 7 weitere."), lines[2]);
  assert.ok(lines[2].includes("GlobalId = g" + (NOTICE_LIST_LIMIT - 1)));
  assert.ok(!lines[2].includes("GlobalId = g" + NOTICE_LIST_LIMIT + ";"));
  assert.equal(lines[3], "Ungültige Angaben: Datum.");
  assert.equal(lines[4], "Unbekannte Angaben: foo.");
  // numbers in German format
  assert.ok(
    configNotice({ properties: [], values: [{ key: "V", value: 1234.5 }], invalid: [], unknown: [] }).includes(
      "V = 1.234,5",
    ),
  );
});

test("[unit] applyConfig on AC20-FZK-Haus rows: Duplex-only property and Kategorie skipped, the FZK value applied", () => {
  const config = {
    schema: "calc-viewer-config/1",
    filterSets: [
      { key: "Kategorie", collapsed: false, selected: [CFG.present.Kategorie, CFG.absentKategorie] },
      { key: CFG.absentProperty, collapsed: false, selected: [] },
    ],
  };
  const ctx = ctxOf(FZK_ROWS);
  const { apply, skipped } = applyConfig(config, ctx);
  assert.deepEqual(skipped.properties, [CFG.absentProperty]);
  assert.deepEqual(skipped.values, [{ key: "Kategorie", value: CFG.absentKategorie }]);
  assert.deepEqual(apply.filterSets, [{ key: "Kategorie", collapsed: false, selected: [CFG.present.Kategorie] }]);
  const matching = FZK_ROWS.filter((r) => r.values.Kategorie === CFG.present.Kategorie);
  assert.equal(matching.length, CFG.present.elementsInFzk);
});

test("[unit] safeFileName (REQ-008 rule, REQ-008-AC5 example), dates", () => {
  assert.equal(safeFileName("A/B: C?", "2026-08-12", ".csv"), "A_B_ C__2026-08-12.csv");
  assert.equal(safeFileName("The M Bouwkundig", "2026-08-12", ".csv"), "The M Bouwkundig_2026-08-12.csv");
  assert.equal(safeFileName("", "2026-08-12", ".csv"), "Export_2026-08-12.csv");
  assert.equal(safeFileName("   ", "2026-08-12"), "Export_2026-08-12");
  assert.equal(safeFileName(null, "2026-08-12", ".json"), "Export_2026-08-12.json");
  assert.equal(safeFileName('a\\b*c"d<e>f|g\u0001h\u007fi', "2026-01-01", ".x"), "a_b_c_d_e_f_g_h_i_2026-01-01.x");
  for (const ok of ["2026-08-12", "2024-02-29", "1000-01-01", "9999-12-31"]) assert.ok(isIsoDate(ok), ok);
  for (const bad of [
    "2026-02-29",
    "2026-13-01",
    "2026-00-10",
    "2026-01-00",
    "2026-1-1",
    "999-01-01",
    "",
    null,
    20260812,
  ])
    assert.ok(!isIsoDate(bad), String(bad));
  assert.equal(isoDate(new Date(2026, 7, 2, 23, 59)), "2026-08-02");
  assert.equal(
    germanDate("2026-08-12"),
    new Date(Date.UTC(2026, 7, 12)).toLocaleDateString("de-DE", { timeZone: "UTC" }),
  );
  assert.equal(germanDate("kein Datum"), "kein Datum");
});

test("[unit] classifyLogo / isLogoDataUrl: PNG, JPG, SVG by content, size limit, other files refused (REQ-011)", () => {
  const png = logoPng();
  const svg = Buffer.from(logoSvg(), "utf8");
  assert.deepEqual(classifyLogo("logo.png", png.length, png), { mime: "image/png" });
  assert.deepEqual(classifyLogo("logo.bin", png.length, png), { mime: "image/png" }); // content, not the name
  assert.deepEqual(classifyLogo("logo.svg", svg.length, svg), { mime: "image/svg+xml" });
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46]);
  assert.deepEqual(classifyLogo("foto.jpg", jpg.length, jpg), { mime: "image/jpeg" });
  const pdf = Buffer.from("%PDF-1.4\n", "latin1");
  assert.equal(classifyLogo("plan.png", pdf.length, pdf).error, "plan.png ist kein PNG-, JPG- oder SVG-Bild.");
  assert.ok(classifyLogo("leer.png", 0, Buffer.alloc(0)).error);
  const tooBig = classifyLogo("gross.png", LOGO_MAX_BYTES + 1, png);
  assert.ok(tooBig.error.startsWith("Das Logo gross.png ist zu groß ("), tooBig.error);
  assert.ok(tooBig.error.endsWith("Erlaubt sind höchstens " + formatBytes(LOGO_MAX_BYTES) + "."), tooBig.error);
  assert.ok(!classifyLogo("max.png", LOGO_MAX_BYTES, png).error);

  assert.ok(isLogoDataUrl("data:image/png;base64," + png.toString("base64")));
  assert.ok(isLogoDataUrl("data:image/svg+xml;base64," + svg.toString("base64")));
  for (const bad of [
    "data:image/gif;base64,R0lGODlh",
    "data:text/html;base64,PGgxPg==",
    "data:image/png;base64,",
    "data:image/png;base64,abc",
    "data:image/png,rawtext",
    "https://example.org/logo.png",
    "data:image/png;base64," + Buffer.alloc(LOGO_MAX_BYTES + 1).toString("base64"),
    42,
  ])
    assert.ok(!isLogoDataUrl(bad), String(bad).slice(0, 40));
  assert.ok(isLogoDataUrl("data:image/png;base64," + Buffer.alloc(LOGO_MAX_BYTES).toString("base64")));
});

test("[unit] applyConfig: a range column filter on a non-numeric column is reported and skipped (TASK-007 C1)", () => {
  const config = {
    schema: "calc-viewer-config/1",
    table: {
      columns: ["Kategorie", "Vol"],
      columnFilters: [
        { key: "Kategorie", type: "range", min: 1, max: 2 },
        { key: "Vol", type: "range", min: 1, max: 4 },
      ],
    },
  };
  const ctx = { ...ctxOf(ROWS), isNumber: (key) => key === "Vol" };
  const { apply, skipped } = applyConfig(config, ctx);
  assert.deepEqual(apply.table.columnFilters, [{ key: "Vol", type: "range", min: 1, max: 4 }]);
  assert.deepEqual(skipped.invalid, ["Spaltenfilter Kategorie (Bereich auf einer Textspalte)"]);
  assert.match(configNotice(skipped), /Ungültige Angaben: Spaltenfilter Kategorie \(Bereich auf einer Textspalte\)\./);
  // without isNumber in the context the range filter is kept (callers that cannot tell the kind)
  assert.equal(applyConfig(config, ctxOf(ROWS)).apply.table.columnFilters.length, 2);
});

test("[unit] applyConfig: groupBy keys beyond two levels are named in the notice (TASK-007 C2)", () => {
  const config = {
    schema: "calc-viewer-config/1",
    table: { view: "grouped", groupBy: ["Kategorie", "Kategorie", "Geschoss", "Material", "Fehlt.X", "Vol"] },
  };
  const { apply, skipped } = applyConfig(config, ctxOf(ROWS));
  assert.deepEqual(apply.table.groupBy, ["Kategorie", "Geschoss"]);
  assert.deepEqual(skipped.properties, ["Fehlt.X"]);
  assert.deepEqual(skipped.invalid, [
    "Gruppierung Material (höchstens 2 Ebenen)",
    "Gruppierung Vol (höchstens 2 Ebenen)",
  ]);
  const notice = configNotice(skipped);
  assert.ok(notice.includes("Gruppierung Material (höchstens 2 Ebenen); Gruppierung Vol (höchstens 2 Ebenen)"), notice);
});
