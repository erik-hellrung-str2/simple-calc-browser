// Unit-conversion fixtures (spec Testing -> Test data, REQ-002-AC6) are reproduced byte-identically by
// scripts/make-unit-fixtures.mjs, and the reference values derived from them stay consistent with the files.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { UNIT_FIXTURES } from "../../scripts/make-unit-fixtures.mjs";
import { loadIfc } from "../../scripts/ref/ifc-model.mjs";

const dir = new URL("../fixtures/", import.meta.url);
const fzk = readFileSync(new URL("AC20-FZK-Haus.ifc", dir), "latin1");
const ref = JSON.parse(readFileSync(new URL("reference-values.json", dir), "utf8"));
const manifest = JSON.parse(readFileSync(new URL("manifest.json", dir), "utf8"));

test("[unit] fzk-feet / fzk-unit-a / fzk-unit-b are reproduced byte-identically and listed in the manifest", () => {
  for (const [file, make] of Object.entries(UNIT_FIXTURES)) {
    assert.equal(readFileSync(new URL(file, dir), "latin1"), make(fzk), file);
    const entry = manifest.committed.find((f) => f.file === file);
    assert.ok(entry, `${file} in manifest`);
    assert.match(entry.source, /derived from AC20-FZK-Haus\.ifc by scripts\/make-unit-fixtures\.mjs/);
  }
});

test("[unit] fzk-feet.ifc declares FOOT = 0.3048 m and its reference lengths are the source values x 0.3048", () => {
  const m = loadIfc(readFileSync(new URL("fzk-feet.ifc", dir), "latin1"));
  assert.equal(m.units.LENGTHUNIT.kind, "conversion");
  assert.equal(m.units.LENGTHUNIT.name, "FOOT");
  assert.equal(m.toSiFactor("LENGTHUNIT"), 0.3048);
  assert.equal(m.toSiFactor("AREAUNIT"), 1);
  const src = ref["AC20-FZK-Haus"].elements.find((e) => e.stepId === 21966).quantities;
  const feet = ref["fzk-feet"].elements[0].quantities;
  assert.ok(Math.abs(feet["BaseQuantities.Length"].value - src["BaseQuantities.Length"].value * 0.3048) < 1e-12);
  assert.equal(feet["BaseQuantities.GrossSideArea"].value, src["BaseQuantities.GrossSideArea"].value);
});

test("[unit] fzk-unit-a/b carry the same mass property with different, non-converted mass units", () => {
  const a = loadIfc(readFileSync(new URL("fzk-unit-a.ifc", dir), "latin1"));
  const b = loadIfc(readFileSync(new URL("fzk-unit-b.ifc", dir), "latin1"));
  const key = ref["fzk-unit-a-b"].property;
  const pa = a.element(21966).props[key];
  const pb = b.element(21966).props[key];
  assert.equal(pa.raw, pb.raw);
  assert.equal(pa.measure, "IFCMASSMEASURE");
  assert.deepEqual([a.units.MASSUNIT.kind, a.units.MASSUNIT.prefix, a.units.MASSUNIT.name], ["si", "KILO", "GRAM"]);
  assert.deepEqual([b.units.MASSUNIT.kind, b.units.MASSUNIT.name], ["conversion", "POUND"]);
});
