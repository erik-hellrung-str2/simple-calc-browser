// Writes the unit-conversion fixtures derived from AC20-FZK-Haus.ifc (spec Testing -> Test data, REQ-002-AC6)
// deterministically into test/fixtures/ and updates their sha256 in test/fixtures/manifest.json:
//
//   fzk-feet.ifc    the project length unit (#13, IfcSIUnit METRE) becomes IfcConversionBasedUnit 'FOOT' with
//                   IfcMeasureWithUnit(IfcLengthMeasure(0.3048), metre): every length value of the model is
//                   then a value in feet (area and volume units stay m2 / m3).
//   fzk-unit-a.ifc  property set 'CalcTest_Units' with 'Masse' = IfcMassMeasure(7857.) on wall 'Wand-Ext-ERDG-1';
//                   project mass unit (#24, IfcSIUnit GRAM) becomes KILO GRAM (kg).
//   fzk-unit-b.ifc  the same property and value; project mass unit becomes IfcConversionBasedUnit 'POUND'
//                   (0.45359237 kg). Mass is a non-converted unit (DEC-2), so a and b together give `gemischt`.
//   fzk-range.ifc   property set 'CalcTest_Range' with 'Wert' = IfcReal on six walls (1.9, 2, 2.5, 3.5, 5, 5.1;
//                   the other elements have no value): the bounds and neighbours of the numeric column filter
//                   `von` 2 `bis` 5 (REQ-006-AC9) and a value for the decimal comma input `2,5` (TASK-003 D2).
//   fzk-export.ifc  property set 'CalcTest_Export' on seven walls with 'Zahl' (IfcReal: 0.12345, a large, a tiny,
//                   a negative value, one beyond 1e21) and 'Text' (IfcText: values starting with = + - @, a line
//                   break with ';' and quotes, non-ASCII, 1,000 characters) for the CSV / Excel export (REQ-008-AC1,
//                   AC4, T7 robustness). Non-ASCII and control characters are written as STEP \X2\ escapes.
//
// Everything else is byte-identical to the source (CRLF line ends kept); new entities are appended to DATA with
// ids above the source's maximum and deterministic GlobalIds (scripts/lib/ifc-synth.mjs ifcGuidFromSeed).
//
//   node scripts/make-unit-fixtures.mjs
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ifcGuidFromSeed } from "./lib/ifc-synth.mjs";

const DIR = fileURLToPath(new URL("../test/fixtures/", import.meta.url));
const SOURCE_NOTE = "derived from AC20-FZK-Haus.ifc by scripts/make-unit-fixtures.mjs";

const LENGTH_UNIT = "#13= IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);";
const MASS_UNIT = "#24= IFCSIUNIT(*,.MASSUNIT.,$,.GRAM.);";
/** Wall 'Wand-Ext-ERDG-1' (GlobalId 3rPX_Juz59peXXY6wDJl18) and the owner history used by the source. */
export const MASS_TARGET = { stepId: 21966, globalId: "3rPX_Juz59peXXY6wDJl18", ownerHistory: 12 };
export const MASS_PROPERTY = { pset: "CalcTest_Units", name: "Masse", value: 7857 };

function replaceOnce(text, from, to) {
  const at = text.indexOf(from);
  if (at < 0 || text.indexOf(from, at + 1) >= 0) throw new Error(`expected exactly one '${from}'`);
  return text.slice(0, at) + to + text.slice(at + from.length);
}

function maxId(text) {
  let max = 0;
  for (const m of text.matchAll(/^#(\d+)\s*=/gm)) max = Math.max(max, Number(m[1]));
  return max;
}

/** Appends records (CRLF) right before the ENDSEC that closes DATA. */
function appendRecords(text, records) {
  const end = text.lastIndexOf("ENDSEC;");
  return text.slice(0, end) + records.map((r) => r + "\r\n").join("") + text.slice(end);
}

function renameFile(text, name) {
  return text.replace(/FILE_NAME\('[^']*'/, `FILE_NAME('${name}'`);
}

/** fzk-feet.ifc from the FZK-Haus source text (latin1 string). */
export function fzkFeet(source) {
  const n = maxId(source);
  let t = renameFile(source, "fzk-feet.ifc");
  t = replaceOnce(t, LENGTH_UNIT, `#13= IFCCONVERSIONBASEDUNIT(#${n + 1},.LENGTHUNIT.,'FOOT',#${n + 2});`);
  return appendRecords(t, [
    `#${n + 1}= IFCDIMENSIONALEXPONENTS(1,0,0,0,0,0,0);`,
    `#${n + 2}= IFCMEASUREWITHUNIT(IFCLENGTHMEASURE(0.3048),#${n + 3});`,
    `#${n + 3}= IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);`,
  ]);
}

function withMassProperty(source, name, n) {
  const { pset, name: prop, value } = MASS_PROPERTY;
  const oh = `#${MASS_TARGET.ownerHistory}`;
  let t = renameFile(source, name);
  t = appendRecords(t, [
    `#${n + 1}= IFCPROPERTYSINGLEVALUE('${prop}',$,IFCMASSMEASURE(${value}.),$);`,
    `#${n + 2}= IFCPROPERTYSET('${ifcGuidFromSeed("fzk-unit:pset")}',${oh},'${pset}',$,(#${n + 1}));`,
    `#${n + 3}= IFCRELDEFINESBYPROPERTIES('${ifcGuidFromSeed("fzk-unit:rel")}',${oh},$,$,(#${MASS_TARGET.stepId}),#${n + 2});`,
  ]);
  return t;
}

/** fzk-unit-a.ifc: mass unit kg (IfcSIUnit KILO GRAM). */
export function fzkUnitA(source) {
  const n = maxId(source);
  const t = withMassProperty(source, "fzk-unit-a.ifc", n);
  return replaceOnce(t, MASS_UNIT, "#24= IFCSIUNIT(*,.MASSUNIT.,.KILO.,.GRAM.);");
}

/** fzk-unit-b.ifc: mass unit pound (IfcConversionBasedUnit, 0.45359237 kg). */
export function fzkUnitB(source) {
  const n = maxId(source);
  let t = withMassProperty(source, "fzk-unit-b.ifc", n);
  t = replaceOnce(t, MASS_UNIT, `#24= IFCCONVERSIONBASEDUNIT(#${n + 4},.MASSUNIT.,'POUND',#${n + 5});`);
  return appendRecords(t, [
    `#${n + 4}= IFCDIMENSIONALEXPONENTS(0,1,0,0,0,0,0);`,
    `#${n + 5}= IFCMEASUREWITHUNIT(IFCMASSMEASURE(0.45359237),#${n + 6});`,
    `#${n + 6}= IFCSIUNIT(*,.MASSUNIT.,.KILO.,.GRAM.);`,
  ]);
}

/** Walls of the source (STEP id) and the CalcTest_Range.Wert value each gets in fzk-range.ifc (REQ-006-AC9). */
export const RANGE_PROPERTY = { pset: "CalcTest_Range", name: "Wert" };
export const RANGE_VALUES = [
  [15042, "1.9"],
  [17040, "2."],
  [18465, "2.5"],
  [18698, "3.5"],
  [20598, "5."],
  [21966, "5.1"],
];

/** fzk-range.ifc: one IfcPropertySingleValue (IfcReal) per wall in its own property set (REQ-006-AC9). */
export function fzkRange(source) {
  const n = maxId(source);
  const oh = `#${MASS_TARGET.ownerHistory}`;
  const records = [];
  RANGE_VALUES.forEach(([stepId, value], i) => {
    const id = n + 1 + i * 3;
    records.push(
      `#${id}= IFCPROPERTYSINGLEVALUE('${RANGE_PROPERTY.name}',$,IFCREAL(${value}),$);`,
      `#${id + 1}= IFCPROPERTYSET('${ifcGuidFromSeed("fzk-range:pset:" + stepId)}',${oh},'${RANGE_PROPERTY.pset}',$,(#${id}));`,
      `#${id + 2}= IFCRELDEFINESBYPROPERTIES('${ifcGuidFromSeed("fzk-range:rel:" + stepId)}',${oh},$,$,(#${stepId}),#${id + 1});`,
    );
  });
  return appendRecords(renameFile(source, "fzk-range.ifc"), records);
}

/** Encodes a JS string as STEP string content: '' for ', \\ for \, \X2\hhhh\X0\ for everything outside ASCII 32-126. */
export function stepString(text) {
  let out = "";
  let wide = "";
  const flush = () => {
    if (wide) out += "\\X2\\" + wide + "\\X0\\";
    wide = "";
  };
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 32 && code <= 126) {
      flush();
      out += text[i] === "'" ? "''" : text[i] === "\\" ? "\\\\" : text[i];
    } else wide += code.toString(16).toUpperCase().padStart(4, "0");
  }
  flush();
  return out;
}

/**
 * Walls of the source (STEP id) with the CalcTest_Export values of fzk-export.ifc (REQ-008): [stepId, Zahl as STEP
 * real literal or null, Text or null].
 */
export const EXPORT_PROPERTY = { pset: "CalcTest_Export", number: "Zahl", text: "Text" };
export const EXPORT_LONG_TEXT = ("Langer Wert " + "0123456789".repeat(100)).slice(0, 1000);
export const EXPORT_VALUES = [
  [21966, "0.12345", "=SUM(A1)"],
  [15042, "1234567.891", "+49 721 608-0"],
  [17040, "0.0000001", "-12 mm Fuge"],
  [18465, "-2.5", "@Wand"],
  [18698, "2500000000000000000000.", 'Zeile 1\nZeile 2; mit "Zitat" und Semikolon'],
  [20598, null, "Gr\u00f6\u00dfe \u00c4u\u00dfenwand \u2013 5 \u20ac \u6f22\u5b57"],
  [27421, null, EXPORT_LONG_TEXT],
];

/** fzk-export.ifc: one property set CalcTest_Export per wall of EXPORT_VALUES (REQ-008 export tests). */
export function fzkExport(source) {
  const n = maxId(source);
  const oh = `#${MASS_TARGET.ownerHistory}`;
  const records = [];
  let id = n + 1;
  for (const [stepId, number, text] of EXPORT_VALUES) {
    const props = [];
    if (number !== null) {
      records.push(`#${id}= IFCPROPERTYSINGLEVALUE('${EXPORT_PROPERTY.number}',$,IFCREAL(${number}),$);`);
      props.push(id++);
    }
    if (text !== null) {
      records.push(`#${id}= IFCPROPERTYSINGLEVALUE('${EXPORT_PROPERTY.text}',$,IFCTEXT('${stepString(text)}'),$);`);
      props.push(id++);
    }
    records.push(
      `#${id}= IFCPROPERTYSET('${ifcGuidFromSeed("fzk-export:pset:" + stepId)}',${oh},'${EXPORT_PROPERTY.pset}',$,(${props.map((p) => "#" + p).join(",")}));`,
      `#${id + 1}= IFCRELDEFINESBYPROPERTIES('${ifcGuidFromSeed("fzk-export:rel:" + stepId)}',${oh},$,$,(#${stepId}),#${id});`,
    );
    id += 2;
  }
  return appendRecords(renameFile(source, "fzk-export.ifc"), records);
}

export const UNIT_FIXTURES = {
  "fzk-feet.ifc": fzkFeet,
  "fzk-unit-a.ifc": fzkUnitA,
  "fzk-unit-b.ifc": fzkUnitB,
  "fzk-range.ifc": fzkRange,
  "fzk-export.ifc": fzkExport,
};

const PURPOSE = {
  "fzk-feet.ifc": "length unit IfcConversionBasedUnit FOOT (0.3048 m) (REQ-002-AC6)",
  "fzk-unit-a.ifc": `numeric non-length property ${MASS_PROPERTY.pset}.${MASS_PROPERTY.name} with mass unit kg (IfcSIUnit) (REQ-002-AC6 gemischt)`,
  "fzk-unit-b.ifc": `numeric non-length property ${MASS_PROPERTY.pset}.${MASS_PROPERTY.name} with mass unit pound (IfcConversionBasedUnit) (REQ-002-AC6 gemischt)`,
  "fzk-range.ifc": `numeric property ${RANGE_PROPERTY.pset}.${RANGE_PROPERTY.name} (IfcReal) on six walls: 1.9, 2, 2.5, 3.5, 5, 5.1 (REQ-006-AC9 range bounds, TASK-003 D2 decimal comma)`,
  "fzk-export.ifc": `property set ${EXPORT_PROPERTY.pset} on seven walls: ${EXPORT_PROPERTY.number} (IfcReal incl. 0.12345, 1e-7, 2.5e21) and ${EXPORT_PROPERTY.text} (IfcText starting with = + - @, line break, ';', quotes, non-ASCII, 1,000 characters) (REQ-008 CSV / Excel export)`,
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const source = readFileSync(DIR + "AC20-FZK-Haus.ifc", "latin1");
  const manifestPath = DIR + "manifest.json";
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  for (const [file, make] of Object.entries(UNIT_FIXTURES)) {
    const buf = Buffer.from(make(source), "latin1");
    writeFileSync(DIR + file, buf);
    const entry = {
      file,
      schema: "IFC4",
      purpose: PURPOSE[file],
      source: SOURCE_NOTE,
      licence: "as AC20-FZK-Haus.ifc",
      sha256: createHash("sha256").update(buf).digest("hex"),
    };
    const i = manifest.committed.findIndex((f) => f.file === file);
    if (i >= 0) manifest.committed[i] = entry;
    else manifest.committed.push(entry);
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`make-unit-fixtures: wrote ${Object.keys(UNIT_FIXTURES).join(", ")} and their manifest entries`);
}
