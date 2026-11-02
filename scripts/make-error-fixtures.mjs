// Writes the committed error-class IFC fixtures (spec Testing -> Test data) deterministically into test/fixtures/.
// Re-run after changing this script, then update the sha256 values in test/fixtures/manifest.json
// (test/unit/fixtures.test.mjs fails until they match).
//
//   node scripts/make-error-fixtures.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DIR = fileURLToPath(new URL("../test/fixtures/", import.meta.url));

/** A minimal, valid one-page PDF (offsets in the xref table computed, not hand-typed). */
export function minimalPdf() {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return out;
}

/** A small, otherwise well-formed STEP file whose schema is IFC4X3_ADD2 (unsupported schema class). */
export function ifc4x3Header() {
  return [
    "ISO-10303-21;",
    "HEADER;",
    "FILE_DESCRIPTION(('ViewDefinition [ReferenceView]'),'2;1');",
    "FILE_NAME('error-ifc4x3-header.ifc','2026-11-02T00:00:00',(''),(''),'calc-viewer-builder test fixture','','');",
    "FILE_SCHEMA(('IFC4X3_ADD2'));",
    "ENDSEC;",
    "DATA;",
    "#1=IFCPROJECT('0YvctVUKr0kugbFTf53O9L',$,'IFC4X3 fixture',$,$,$,$,$,$);",
    "ENDSEC;",
    "END-ISO-10303-21;",
    "",
  ].join("\n");
}

/** The first 64 KiB of AC20-FZK-Haus.ifc: header intact, DATA cut mid-record, no ENDSEC/END-ISO. */
export function truncatedIfc(source) {
  return source.subarray(0, 64 * 1024);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(DIR + "error-empty.ifc", "");
  writeFileSync(DIR + "error-renamed-pdf.ifc", minimalPdf(), "latin1");
  writeFileSync(DIR + "error-ifc4x3-header.ifc", ifc4x3Header(), "latin1");
  writeFileSync(DIR + "error-truncated.ifc", truncatedIfc(readFileSync(DIR + "AC20-FZK-Haus.ifc")));
  console.log("make-error-fixtures: wrote 4 files to test/fixtures/");
}
