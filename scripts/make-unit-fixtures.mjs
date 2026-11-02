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

export const UNIT_FIXTURES = { "fzk-feet.ifc": fzkFeet, "fzk-unit-a.ifc": fzkUnitA, "fzk-unit-b.ifc": fzkUnitB };

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
      purpose:
        file === "fzk-feet.ifc"
          ? "length unit IfcConversionBasedUnit FOOT (0.3048 m) (REQ-002-AC6)"
          : `numeric non-length property ${MASS_PROPERTY.pset}.${MASS_PROPERTY.name} with mass unit ${file === "fzk-unit-a.ifc" ? "kg (IfcSIUnit)" : "pound (IfcConversionBasedUnit)"} (REQ-002-AC6 gemischt)`,
      source: SOURCE_NOTE,
      licence: "as AC20-FZK-Haus.ifc",
      sha256: createHash("sha256").update(buf).digest("hex"),
    };
    const i = manifest.committed.findIndex((f) => f.file === file);
    if (i >= 0) manifest.committed[i] = entry;
    else manifest.committed.push(entry);
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log("make-unit-fixtures: wrote fzk-feet.ifc, fzk-unit-a.ifc, fzk-unit-b.ifc and their manifest entries");
}
