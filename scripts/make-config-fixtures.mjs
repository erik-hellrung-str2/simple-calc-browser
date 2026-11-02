// Writes the committed configuration and logo fixtures of TASK-007 (spec Testing -> Test data: "configuration files
// per error class"; REQ-011 logo) deterministically into test/fixtures/. Re-run after changing this script, then
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
  writeFileSync(DIR + "logo-test.png", logoPng());
  writeFileSync(DIR + "logo-test.svg", logoSvg());
  console.log(`make-config-fixtures: wrote ${Object.keys(configs).length + 2} files to test/fixtures/`);
}
