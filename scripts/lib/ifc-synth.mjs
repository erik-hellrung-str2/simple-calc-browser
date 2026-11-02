// Reproducible synthetic large IFC (spec Testing -> Test data): K copies of one STEP file in one IfcProject.
// Copy 0 is the source unchanged; copy k >= 1 has every STEP id renumbered (id + k * stride), a fresh deterministic
// GlobalId on every rooted entity, and every top-level IfcLocalPlacement re-based on an offset placement (k * dx).
// The IfcProject is shared: references to it from copies point to the original, so the file keeps one project.
import { createHash } from "node:crypto";

const IFC_GUID_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";
const STRING_RE = /('(?:[^']|'')*')/; // STEP string literal ('' escapes a quote)
const RECORD_HEAD_RE = /^\s*#(\d+)\s*=\s*([A-Z0-9_]+)\s*\(/;
const GUID_LITERAL_RE = /^'[0-3][0-9A-Za-z_$]{21}'$/;

/** True if the record's first attribute is an IfcRoot GlobalId (22-char GUID followed by OwnerHistory #ref or $). */
function hasGlobalId(parts) {
  return (
    parts.length > 2 && /\(\s*$/.test(parts[0]) && GUID_LITERAL_RE.test(parts[1]) && /^\s*,\s*(#\d+|\$)/.test(parts[2])
  );
}

/** Deterministic IFC GlobalId (22 chars, 128 bits) from a seed string. */
export function ifcGuidFromSeed(seed) {
  let n = BigInt("0x" + createHash("sha256").update(seed).digest("hex").slice(0, 32));
  let out = "";
  for (let i = 0; i < 21; i++) {
    out = IFC_GUID_CHARS[Number(n & 63n)] + out;
    n >>= 6n;
  }
  return IFC_GUID_CHARS[Number(n & 3n)] + out;
}

/** Splits a STEP DATA section into entity records (each ending with ';'), ignoring ';' inside strings. */
export function splitRecords(data) {
  const records = [];
  const re = /'(?:[^']|'')*'|;/g;
  let start = 0;
  for (let m; (m = re.exec(data));) {
    if (m[0] !== ";") continue;
    const rec = data.slice(start, re.lastIndex);
    if (rec.trim()) records.push(rec.trim());
    start = re.lastIndex;
  }
  return records;
}

/** Splits a STEP file into header (up to and including "DATA;"), data records and trailer. */
export function splitStep(text) {
  const dataStart = text.search(/\bDATA\s*;/);
  if (dataStart < 0) throw new Error("no DATA section");
  const headEnd = text.indexOf(";", dataStart) + 1;
  const dataEnd = text.lastIndexOf("ENDSEC");
  if (dataEnd < headEnd) throw new Error("no ENDSEC after DATA");
  return {
    header: text.slice(0, headEnd),
    records: splitRecords(text.slice(headEnd, dataEnd)),
    trailer: text.slice(dataEnd),
  };
}

function lengthUnitScale(records) {
  for (const r of records)
    if (/IFCSIUNIT\s*\(\s*\*\s*,\s*\.LENGTHUNIT\.\s*,\s*\.MILLI\.\s*,\s*\.METRE\.\s*\)/.test(r)) return 1000;
  return 1;
}

/**
 * Generates the synthetic STEP text in chunks.
 * @param {string} text source IFC (STEP) text
 * @param {{copies: number, offsetMetres: number, fileName: string, seed: string}} opts
 * @returns {Generator<string>}
 */
export function* synthesize(text, { copies, offsetMetres, fileName, seed }) {
  const { header, records } = splitStep(text);
  const parsed = records.map((r) => {
    const m = RECORD_HEAD_RE.exec(r);
    if (!m) throw new Error(`unexpected record: ${r.slice(0, 80)}`);
    return { id: Number(m[1]), type: m[2], text: r };
  });
  const stride = parsed.reduce((max, p) => Math.max(max, p.id), 0);
  const shared = new Set(parsed.filter((p) => p.type === "IFCPROJECT").map((p) => p.id));
  if (shared.size !== 1) throw new Error(`expected one IFCPROJECT, found ${shared.size}`);
  const dx = offsetMetres * lengthUnitScale(records);

  yield header.replace(/FILE_NAME\s*\(\s*'(?:[^']|'')*'/, (m) => m.slice(0, m.indexOf("'")) + `'${fileName}'`) + "\n";
  for (const p of parsed) yield p.text + "\n";
  let extra = copies * stride;
  for (let k = 1; k < copies; k++) {
    const shift = (id) => (shared.has(id) ? id : id + k * stride);
    const pt = ++extra;
    const axis = ++extra;
    const base = ++extra;
    yield `#${pt}=IFCCARTESIANPOINT((${(k * dx).toFixed(1)},0.,0.));\n`;
    yield `#${axis}=IFCAXIS2PLACEMENT3D(#${pt},$,$);\n`;
    yield `#${base}=IFCLOCALPLACEMENT($,#${axis});\n`;
    for (const p of parsed) {
      if (shared.has(p.id)) continue;
      const parts = p.text.split(STRING_RE);
      for (let i = 0; i < parts.length; i += 2)
        parts[i] = parts[i].replace(/#(\d+)/g, (_, id) => `#${shift(Number(id))}`);
      // Rooted entity: first attribute is a 22-char GlobalId, second the OwnerHistory (#ref or $).
      if (hasGlobalId(parts)) parts[1] = `'${ifcGuidFromSeed(`${seed}:${k}:${parts[1]}`)}'`;
      let out = parts.join("");
      if (p.type === "IFCLOCALPLACEMENT")
        out = out.replace(/IFCLOCALPLACEMENT\s*\(\s*\$/, `IFCLOCALPLACEMENT(#${base}`);
      yield out + "\n";
    }
  }
  yield "ENDSEC;\nEND-ISO-10303-21;\n";
}

/** Structural check of a STEP text: unique ids, no dangling references, one project, unique GlobalIds. */
export function validateStep(text) {
  const { records } = splitStep(text);
  const ids = new Set();
  const refs = new Set();
  const guids = new Set();
  let projects = 0;
  let duplicateGuids = 0;
  for (const r of records) {
    const m = RECORD_HEAD_RE.exec(r);
    if (!m) throw new Error(`unexpected record: ${r.slice(0, 80)}`);
    const id = Number(m[1]);
    if (ids.has(id)) throw new Error(`duplicate id #${id}`);
    ids.add(id);
    if (m[2] === "IFCPROJECT") projects++;
    const parts = r.split(STRING_RE);
    for (let i = 0; i < parts.length; i += 2)
      for (const x of parts[i].slice(m[0].length * (i === 0)).matchAll(/#(\d+)/g)) refs.add(Number(x[1]));
    if (hasGlobalId(parts)) {
      if (guids.has(parts[1])) duplicateGuids++;
      guids.add(parts[1]);
    }
  }
  const dangling = [...refs].filter((id) => !ids.has(id));
  return {
    entities: ids.size,
    projects,
    rooted: guids.size,
    duplicateGuids,
    dangling: dangling.slice(0, 10),
    danglingCount: dangling.length,
  };
}
