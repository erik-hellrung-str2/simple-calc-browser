// Writes the committed configuration and logo fixtures of TASK-007 (spec Testing -> Test data: "configuration files
// per error class"; REQ-011 logo) and the CR-002 compatibility fixtures of TASK-012 (1.0.0 configuration with an axis
// section and a numeric colourBy, 1.1.0 configurations with rules, search, colouring mode and section plane; DEC-20)
// deterministically into test/fixtures/. Re-run after changing this script, then
// update the sha256 values in test/fixtures/manifest.json (test/unit/fixtures.test.mjs fails until they match).
//
//   node scripts/make-config-fixtures.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const DIR = fileURLToPath(new URL("../test/fixtures/", import.meta.url));

/** Configuration error-class fixtures (REQ-009 load errors): file name -> { errorClass, text }. */
export function configErrorFixtures() {
  return {
    // invalid-json: a configuration cut off in the middle (no closing braces)
    "config-invalid-json.json": {
      errorClass: "invalid-json",
      text: '{\n  "schema": "calc-viewer-config/1",\n  "header": {\n    "title": "Abgeschnitten",\n',
    },
    // not-a-config: valid JSON without a schema
    "config-no-schema.json": {
      errorClass: "not-a-config",
      text: JSON.stringify({ title: "Keine Konfiguration", filterSets: [] }, null, 2) + "\n",
    },
    // not-a-config: valid JSON with a foreign schema
    "config-foreign-schema.json": {
      errorClass: "not-a-config",
      text: JSON.stringify({ schema: "https://json-schema.org/draft/2020-12/schema", type: "object" }, null, 2) + "\n",
    },
    // unsupported-version: a later version of this configuration format
    "config-unsupported-version.json": {
      errorClass: "unsupported-version",
      version: "2",
      text:
        JSON.stringify(
          { schema: "calc-viewer-config/2", header: { title: "Neuere Version", date: "2026-08-12", logo: null } },
          null,
          2,
        ) + "\n",
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// CR-002 compatibility fixtures (TASK-012; spec Testing -> Test data "CR-002 additions", DEC-20, REQ-009-AC4..AC8).
// For AC20-FZK-Haus.ifc. Written as the builders write them: JSON.stringify(config, null, 2) + "\n".
// ---------------------------------------------------------------------------------------------------------------

/** Numeric colouring property of AC20-FZK-Haus (REQ-005-AC5, REQ-006-AC2). */
export const FZK_VOLUME = "BaseQuantities.NetVolume";
/** Offset (m, IFC Z) of the 1.0.0 axis section in the compatibility fixtures (inside the FZK-Haus storeys). */
export const AXIS_SECTION_OFFSET = 3;

const header = () => ({ title: "Haus", date: "2026-08-12", logo: null });
const defaultSets = () => [
  { key: "Kategorie", collapsed: false, selected: [] },
  { key: "Geschoss", collapsed: false, selected: [] },
  { key: "Material", collapsed: false, selected: [] },
];
const table = () => ({
  view: "single",
  groupBy: [],
  columns: [
    { key: "Modell", width: 160 },
    { key: "Kategorie", width: 160 },
    { key: "Name", width: 240 },
    { key: "Geschoss", width: 160 },
    { key: FZK_VOLUME, width: 150 },
  ],
  sort: null,
  columnFilters: [],
});

/**
 * A configuration as the 1.0.0 builder saves it (tag v1.0.0, cv-core buildConfig: fields schema, header, filterSets,
 * table, display { mode, colourBy, section { axis, offset, flipped } }), with an axis section on Z and the numeric
 * colouring property NetVolume (REQ-009-AC4).
 */
export function config100(flipped) {
  return {
    schema: "calc-viewer-config/1",
    header: header(),
    filterSets: defaultSets(),
    table: table(),
    display: {
      mode: "ghost",
      colourBy: FZK_VOLUME,
      section: { axis: "Z", offset: AXIS_SECTION_OFFSET, flipped },
    },
  };
}

/**
 * A configuration as the 1.1.0 builder saves it (DEC-20: all five new fields written; REQ-009-AC1 / AC7 content):
 * two rules (one `Freie Textsuche`), a search text, colouring in `Farbskala` with `Gruen`, a section plane (point with
 * the 2 mm offset, normal into the kept half).
 */
export function config110() {
  return {
    schema: "calc-viewer-config/1",
    header: header(),
    filterSets: defaultSets(),
    filterRules: [
      { mode: "isolate", key: "Kategorie", op: "contains", value: "wall" },
      { mode: "text", key: null, op: "contains", value: "erdg" },
    ],
    search: "wand",
    table: table(),
    display: {
      mode: "ghost",
      colourBy: FZK_VOLUME,
      colourMode: "scale",
      scaleColour: "#2e9b4f",
      sectionPlane: { point: [0, 0, 1.502], normal: [0, 0, -1] },
    },
  };
}

/**
 * REQ-009-AC6: a rule on a property absent from AC20-FZK-Haus (it exists in the Duplex fixture,
 * reference-values.json REQ-009-config.absentProperty) and a malformed rule (unknown action) between two valid rules.
 */
export function configRulesSkipped() {
  return {
    schema: "calc-viewer-config/1",
    header: header(),
    filterRules: [
      { mode: "isolate", key: "Kategorie", op: "contains", value: "wall" },
      { mode: "hide", key: "PSet_Revit_Other.AssetIdentifier", op: "eq", value: "x" },
      { mode: "select", key: "Name", op: "eq", value: "x" },
      { mode: "hide", key: "Name", op: "ends", value: "-1" },
    ],
  };
}

/** The file text of a configuration as both builders save it. */
export function configText(config) {
  return JSON.stringify(config, null, 2) + "\n";
}

/** The compatibility fixtures: file name -> { purpose, config }. */
export function compatConfigFixtures() {
  return {
    "config-1.0.0-axis-section.json": {
      purpose: "1.0.0 configuration: axis section Z (not flipped), numeric colourBy (REQ-009-AC4, DEC-20)",
      config: config100(false),
    },
    "config-1.0.0-axis-section-flipped.json": {
      purpose: "1.0.0 configuration: axis section Z flipped, numeric colourBy (REQ-009-AC4, DEC-20)",
      config: config100(true),
    },
    "config-1.1.0-full.json": {
      purpose: "1.1.0 configuration: rules, search, Farbskala Gruen, section plane (REQ-009-AC1, AC7, DEC-20)",
      config: config110(),
    },
    "config-1.1.0-rules-skipped.json": {
      purpose: "1.1.0 configuration: a rule on an absent property and a malformed rule (REQ-009-AC6)",
      config: configRulesSkipped(),
    },
  };
}

/**
 * One configuration per invalid case of the DEC-20 field table (REQ-009-AC8), each changing one field of a valid
 * 1.1.0 configuration (config110): { name, field, label (the notice label of the DEC-20 table, null = no notice),
 * config }. Not written to files (loaded as text in the tests).
 */
export function dec20InvalidCases() {
  const withField = (name, field, label, change) => {
    const config = config110();
    change(config);
    return { name, field, label, config };
  };
  const rule = (patch) => (c) =>
    c.filterRules.push({ ...{ mode: "hide", key: "Name", op: "eq", value: "x" }, ...patch });
  return [
    withField("filterRules-not-a-list", "filterRules", "Filterregeln", (c) => (c.filterRules = { mode: "isolate" })),
    withField("rule-unknown-mode", "filterRules", "Filterregel", rule({ mode: "select" })),
    withField("rule-unknown-op", "filterRules", "Filterregel", rule({ op: "ne" })),
    withField("rule-empty-value", "filterRules", "Filterregel", rule({ value: "" })),
    withField("rule-non-text-value", "filterRules", "Filterregel", rule({ value: 3 })),
    withField("rule-missing-key", "filterRules", "Filterregel", (c) =>
      c.filterRules.push({ mode: "isolate", op: "eq", value: "x" }),
    ),
    withField("search-not-text", "search", "Suche", (c) => (c.search = ["wand"])),
    withField("colourMode-rainbow", "display.colourMode", "Farbmodus", (c) => (c.display.colourMode = "rainbow")),
    withField("scaleColour-red", "display.scaleColour", "Skalenfarbe", (c) => (c.display.scaleColour = "red")),
    withField("sectionPlane-zero-normal", "display.sectionPlane", "Schnitt", (c) => {
      c.display.sectionPlane = { point: [0, 0, 1], normal: [0, 0, 0] };
    }),
    withField("sectionPlane-nan-point", "display.sectionPlane", "Schnitt", (c) => {
      // JSON has no NaN: JSON.stringify writes null, which is not a finite number either
      c.display.sectionPlane = { point: [0, NaN, 1], normal: [0, 0, -1] };
    }),
    withField("sectionPlane-missing-point", "display.sectionPlane", "Schnitt", (c) => {
      c.display.sectionPlane = { normal: [0, 0, -1] };
    }),
    withField("sectionPlane-non-unit-normal", "display.sectionPlane", null, (c) => {
      c.display.sectionPlane = { point: [0, 0, 1.502], normal: [0, 0, -2] };
    }),
  ];
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** A small RGB PNG (width x height, accent red with a white diagonal) built from its chunks. */
export function logoPng(width = 48, height = 24) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type RGB
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const row = y * (1 + width * 3);
    raw[row] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const white = Math.abs(x - 2 * y) < 2;
      raw.set(white ? [255, 255, 255] : [0xd7, 0x26, 0x22], row + 1 + x * 3);
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** A small SVG logo with an XML declaration and a comment before the <svg> element. */
export function logoSvg() {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<!-- calc-viewer-builder test logo -->",
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="32" viewBox="0 0 96 32">',
    '  <rect width="96" height="32" rx="6" fill="#35383a"/>',
    '  <circle cx="16" cy="16" r="9" fill="#d72622"/>',
    '  <rect x="32" y="12" width="52" height="8" rx="4" fill="#ffffff"/>',
    "</svg>",
    "",
  ].join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const configs = configErrorFixtures();
  for (const [name, { text }] of Object.entries(configs)) writeFileSync(DIR + name, text);
  const compat = compatConfigFixtures();
  for (const [name, { config }] of Object.entries(compat)) writeFileSync(DIR + name, configText(config));
  writeFileSync(DIR + "logo-test.png", logoPng());
  writeFileSync(DIR + "logo-test.svg", logoSvg());
  const count = Object.keys(configs).length + Object.keys(compat).length + 2;
  console.log(`make-config-fixtures: wrote ${count} files to test/fixtures/`);
}
