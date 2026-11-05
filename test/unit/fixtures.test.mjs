// Test-data tooling (spec Testing -> Test data): committed fixtures match their manifest, error fixtures are
// reproducible, and the synthetic large-IFC generator renumbers, re-identifies and offsets copies correctly.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { ifc4x3Header, minimalPdf, truncatedIfc } from "../../scripts/make-error-fixtures.mjs";
import {
  compatConfigFixtures,
  configErrorFixtures,
  configText,
  logoPng,
  logoSvg,
} from "../../scripts/make-config-fixtures.mjs";
import { ifcGuidFromSeed, splitRecords, synthesize, validateStep } from "../../scripts/lib/ifc-synth.mjs";

const dir = new URL("../fixtures/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", dir), "utf8"));
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

test("[unit] every committed fixture matches the sha256 in its manifest and names source and licence", () => {
  for (const f of manifest.committed) {
    assert.equal(sha256(readFileSync(new URL(f.file, dir))), f.sha256, f.file);
    assert.ok(f.source && f.licence, `${f.file}: source and licence required`);
  }
  for (const f of [...manifest.fetched, ...manifest.generated]) assert.match(f.sha256, /^[0-9a-f]{64}$/, f.file);
});

test("[unit] error fixtures are reproduced byte-identically by scripts/make-error-fixtures.mjs", () => {
  const fzk = readFileSync(new URL("AC20-FZK-Haus.ifc", dir));
  assert.deepEqual(readFileSync(new URL("error-empty.ifc", dir)), Buffer.alloc(0));
  assert.equal(readFileSync(new URL("error-renamed-pdf.ifc", dir), "latin1"), minimalPdf());
  assert.equal(readFileSync(new URL("error-ifc4x3-header.ifc", dir), "latin1"), ifc4x3Header());
  assert.deepEqual(readFileSync(new URL("error-truncated.ifc", dir)), truncatedIfc(fzk));
  assert.ok(minimalPdf().startsWith("%PDF-1.4\n") && minimalPdf().endsWith("%%EOF\n"));
  assert.match(ifc4x3Header(), /FILE_SCHEMA\(\('IFC4X3_ADD2'\)\);/);
  assert.doesNotMatch(truncatedIfc(fzk).toString("latin1"), /ENDSEC;\s*END-ISO/);
});

test("[unit] configuration and logo fixtures are reproduced byte-identically by scripts/make-config-fixtures.mjs", () => {
  const configs = configErrorFixtures();
  assert.deepEqual(
    Object.values(configs)
      .map((c) => c.errorClass)
      .sort(),
    ["invalid-json", "not-a-config", "not-a-config", "unsupported-version"],
  );
  for (const [name, { text }] of Object.entries(configs))
    assert.equal(readFileSync(new URL(name, dir), "utf8"), text, name);
  assert.throws(() => JSON.parse(configs["config-invalid-json.json"].text));
  assert.equal(JSON.parse(configs["config-no-schema.json"].text).schema, undefined);
  assert.equal(JSON.parse(configs["config-unsupported-version.json"].text).schema, "calc-viewer-config/2");
  assert.deepEqual(readFileSync(new URL("logo-test.png", dir)), logoPng());
  assert.equal(readFileSync(new URL("logo-test.svg", dir), "utf8"), logoSvg());
  assert.deepEqual([...logoPng().subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
});

test("[unit] CR-002 compatibility configurations are reproduced byte-identically and listed in the manifest", () => {
  const compat = compatConfigFixtures();
  const listed = new Set(manifest.committed.map((f) => f.file));
  assert.deepEqual(Object.keys(compat).sort(), [
    "config-1.0.0-axis-section-flipped.json",
    "config-1.0.0-axis-section.json",
    "config-1.1.0-full.json",
    "config-1.1.0-rules-skipped.json",
  ]);
  for (const [name, { config }] of Object.entries(compat)) {
    assert.ok(listed.has(name), name + " in manifest.json");
    assert.equal(readFileSync(new URL(name, dir), "utf8"), configText(config), name);
  }
  // the 1.0.0 files have exactly the 1.0.0 fields (tag v1.0.0 buildConfig), the 1.1.0 files the DEC-20 fields
  const old = compat["config-1.0.0-axis-section.json"].config;
  assert.deepEqual(Object.keys(old), ["schema", "header", "filterSets", "table", "display"]);
  assert.deepEqual(Object.keys(old.display), ["mode", "colourBy", "section"]);
  assert.deepEqual(old.display.section, { axis: "Z", offset: 3, flipped: false });
  assert.equal(compat["config-1.0.0-axis-section-flipped.json"].config.display.section.flipped, true);
  const full = compat["config-1.1.0-full.json"].config;
  assert.deepEqual(Object.keys(full), ["schema", "header", "filterSets", "filterRules", "search", "table", "display"]);
  assert.deepEqual(Object.keys(full.display), ["mode", "colourBy", "colourMode", "scaleColour", "sectionPlane"]);
});

test("[unit] ifcGuidFromSeed gives deterministic, distinct 22-char IFC GlobalIds", () => {
  const a = ifcGuidFromSeed("a");
  assert.match(a, /^[0-3][0-9A-Za-z_$]{21}$/);
  assert.equal(ifcGuidFromSeed("a"), a);
  assert.notEqual(ifcGuidFromSeed("b"), a);
});

test("[unit] splitRecords ignores ';' and quotes inside STEP strings", () => {
  const recs = splitRecords("\n#1=IFCLABEL('a;b');\n#2=IFCTEXT('it''s;');#3=IFCLABEL($);\n");
  assert.deepEqual(recs, ["#1=IFCLABEL('a;b');", "#2=IFCTEXT('it''s;');", "#3=IFCLABEL($);"]);
});

const SMALL = [
  "ISO-10303-21;",
  "HEADER;FILE_DESCRIPTION((''),'2;1');",
  "FILE_NAME('orig.ifc','2020-01-01T00:00:00',(''),(''),'','','');",
  "FILE_SCHEMA(('IFC2X3'));",
  "ENDSEC;",
  "DATA;",
  "#1= IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.);",
  "#2= IFCOWNERHISTORY($,$,$,.ADDED.,$,$,$,0);",
  "#3= IFCPROJECT('0YvctVUKr0kugbFTf53O9L',#2,'P',$,$,$,$,$,$);",
  "#4= IFCCARTESIANPOINT((0.,0.,0.));",
  "#5= IFCAXIS2PLACEMENT3D(#4,$,$);",
  "#6= IFCLOCALPLACEMENT($,#5);",
  "#7= IFCSITE('1aBcDeFgHiJkLmNoPqRsTu',#2,'Site; #99 in text',$,$,#6,$,$,.ELEMENT.,$,$,$,$,$);",
  "#8= IFCRELAGGREGATES('2aBcDeFgHiJkLmNoPqRsTu',#2,$,$,#3,(#7));",
  "#9= IFCPROPERTYSINGLEVALUE('ThermalTransmittance12',$,IFCREAL(1.),$);",
  "ENDSEC;",
  "END-ISO-10303-21;",
  "",
].join("\n");

test("[unit] synthesize: copies renumbered and offset, project shared, fresh GlobalIds, structure valid", () => {
  const out = [...synthesize(SMALL, { copies: 3, offsetMetres: 500, fileName: "syn.ifc", seed: "t" })].join("");
  assert.equal(out, [...synthesize(SMALL, { copies: 3, offsetMetres: 500, fileName: "syn.ifc", seed: "t" })].join(""));
  assert.match(out, /FILE_NAME\('syn\.ifc','2020-01-01T00:00:00'/);
  const v = validateStep(out);
  assert.deepEqual(v, {
    entities: 9 + 2 * 8 + 2 * 3,
    projects: 1,
    rooted: 3 + 2 * 2,
    duplicateGuids: 0,
    dangling: [],
    danglingCount: 0,
  });
  // copy 2: ids shifted by 2 * 9, project reference kept, text inside strings untouched
  assert.match(out, /#25= IFCSITE\('[0-3][0-9A-Za-z_$]{21}',#20,'Site; #99 in text',\$,\$,#24,/);
  assert.match(out, /#26= IFCRELAGGREGATES\('[0-3][0-9A-Za-z_$]{21}',#20,\$,\$,#3,\(#25\)\);/);
  // copy 2 top-level placement re-based on an offset of 2 * 500 m = 1,000,000 mm
  const base = /#(\d+)=IFCLOCALPLACEMENT\(\$,#(\d+)\);\n(?=[\s\S]*#24= IFCLOCALPLACEMENT\(#\1,#23\))/.exec(out);
  assert.ok(base, "copy 2 placement references its offset base placement");
  assert.match(out, /IFCCARTESIANPOINT\(\(1000000\.0,0\.,0\.\)\)/);
  // names that merely look like GUIDs (22 chars, no OwnerHistory pattern / wrong first char) stay unchanged
  assert.equal(out.split("IFCPROPERTYSINGLEVALUE('ThermalTransmittance12'").length - 1, 3);
  assert.equal(out.split("'1aBcDeFgHiJkLmNoPqRsTu'").length - 1, 1);
});
