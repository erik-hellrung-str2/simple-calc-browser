// [perf] Node micro-benchmarks of the TASK-011 filter sources in cv-core (spec §5 TASK-011 acceptance, Testing T6;
// NFR-001 CR-002 part, measured end to end in the browser by TASK-020): 30,000 synthetic rows shaped like the volume
// set (special properties plus 40 pset properties per row, one Name and one GlobalId per element, multi-valued
// Material, numbers and booleans). Targets (median of 9, distinct needles so no cached mask is reused):
//   rule `Enthält` on Name                     <= 50 ms   (Name column in use; its one-off build is reported)
//   search over all properties (index built)   <= 100 ms  (also `Freie Textsuche`, same path)
//   display-text index build                   <= 2 s and <= 150 MB extra heap (retained, after GC)
// Reported: cold rule incl. the Name column build, peak heap during the build, environment.
import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import v8 from "node:v8";
import vm from "node:vm";
import { performance } from "node:perf_hooks";
import { loadCore } from "../load-core.mjs";

v8.setFlagsFromString("--expose-gc");
const gc = vm.runInNewContext("gc");

const core = await loadCore();
const N = 30_000;
const PSET_PROPERTIES = 40;
const RULE_MS = 50;
const SEARCH_MS = 100;
const INDEX_MS = 2000;
const INDEX_MB = 150;
const COLD_GUARD_MS = 250; // generous guard for the one-off Name column build (TASK-003 uses the same)
const MB = 1024 * 1024;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function syntheticRows() {
  const rand = rng(11);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const kategorien = Array.from({ length: 40 }, (_, i) => "IfcClass" + i);
  const geschosse = Array.from({ length: 12 }, (_, i) => "Geschoss " + i);
  const materialien = Array.from({ length: 150 }, (_, i) => "Material " + i);
  const typen = Array.from({ length: 800 }, (_, i) => "Typ " + i + " Standard");
  const texts = Array.from({ length: 300 }, (_, i) => "Wert " + i + (i % 3 ? " Beschreibung" : ""));
  const rows = new Array(N);
  for (let i = 0; i < N; i++) {
    const values = {
      Modell: "Modell " + (i % 5),
      Kategorie: pick(kategorien),
      Name: "Element " + i + " " + pick(["Wand", "Decke", "Rohr", "Kanal"]),
      GlobalId: (i * 2654435761).toString(36).padStart(22, "0"),
      Geschoss: rand() < 0.95 ? pick(geschosse) : undefined,
      Material: Array.from({ length: Math.floor(rand() * 3) }, () => pick(materialien)).sort(),
      Typ: pick(typen),
      Geometrie: rand() < 0.98 ? "Ja" : "Nein",
    };
    for (let p = 0; p < PSET_PROPERTIES; p++) {
      if (rand() < 0.15) continue; // sparse, as real psets
      const key = "Pset_" + (p % 8) + ".Eigenschaft " + p;
      values[key] = p % 3 === 0 ? Math.round(rand() * 1e6) / 1000 : p % 7 === 0 ? pick(["Ja", "Nein"]) : pick(texts);
    }
    rows[i] = { key: "m:" + i, guid: values.GlobalId, values };
  }
  return rows;
}

const median = (list) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
const round = (x) => +x.toFixed(2);

test("[perf] TASK-011 at 30k rows: rule Enthält on Name <= 50 ms, search and Freie Textsuche <= 100 ms after the index, index build <= 2 s and <= 150 MB extra heap", () => {
  const rows = syntheticRows();

  // rule Enthält on Name: cold (first use builds the Name column), then warm with a new needle each time
  const coldStore = core.createColumnStore(rows);
  let t0 = performance.now();
  const cold = core.filterRows(coldStore, [
    { type: "rule", mode: "isolate", key: "Name", op: "contains", value: "wand" },
  ]);
  const coldRuleMs = performance.now() - t0;
  assert.ok(cold.length > 0 && cold.length < N);
  const ruleTimes = [];
  for (let k = 0; k < 9; k++) {
    const value = "element " + (k + 1) + "2"; // e.g. "element 12": many partial matches
    t0 = performance.now();
    const ev = core.evaluateFilters(coldStore, [{ type: "rule", mode: "isolate", key: "Name", op: "contains", value }]);
    const hits = core.filterRows(ev);
    ruleTimes.push(performance.now() - t0);
    assert.ok(hits.length > 0, value);
  }

  // display-text index: time and retained heap of a synchronous build; peak heap seen right after it (before GC)
  const store = core.createColumnStore(rows);
  gc();
  const heapBefore = process.memoryUsage().heapUsed;
  t0 = performance.now();
  const index = store.textIndex();
  const indexMs = performance.now() - t0;
  const heapPeak = process.memoryUsage().heapUsed;
  gc();
  const heapAfter = process.memoryUsage().heapUsed;
  const extraMB = (heapAfter - heapBefore) / MB;
  assert.equal(index.length, N);
  // index build times of 3 more fresh stores (median of 4 with the first)
  const buildTimes = [indexMs];
  for (let k = 0; k < 3; k++) {
    const s = core.createColumnStore(rows);
    t0 = performance.now();
    s.textIndex();
    buildTimes.push(performance.now() - t0);
  }

  // search and Freie Textsuche over all properties, index built, new text each time
  const searchTimes = [];
  const textRuleTimes = [];
  for (let k = 0; k < 9; k++) {
    let text = "wert " + (k * 30 + 1) + " b"; // i % 3 != 0: "Wert <i> Beschreibung"
    t0 = performance.now();
    const found = core.filterRows(store, [{ type: "search", text }]);
    searchTimes.push(performance.now() - t0);
    assert.ok(found.length > 0, text);
    text = "Typ " + (k * 11 + 5) + " Standard";
    t0 = performance.now();
    const eq = core.filterRows(store, [{ type: "rule", mode: "text", key: null, op: "eq", value: text }]);
    textRuleTimes.push(performance.now() - t0);
    assert.ok(eq.length > 0, text);
  }

  const report = {
    rows: N,
    psetPropertiesPerRow: PSET_PROPERTIES,
    ruleContainsNameMedianMs: round(median(ruleTimes)),
    ruleContainsNameColdMs: round(coldRuleMs),
    searchMedianMs: round(median(searchTimes)),
    freeTextEqMedianMs: round(median(textRuleTimes)),
    indexBuildMedianMs: round(median(buildTimes)),
    indexBuildMs: buildTimes.map(round),
    indexExtraHeapMB: round(extraMB),
    heapPeakDuringBuildMB: round((heapPeak - heapBefore) / MB),
    indexChars: index.reduce((sum, s) => sum + s.length, 0),
    node: process.version,
    cpu: os.cpus()[0] && os.cpus()[0].model,
  };
  console.log("[perf] TASK-011 rules/search/index " + JSON.stringify(report));
  assert.ok(median(ruleTimes) <= RULE_MS, `rule Enthält on Name ${median(ruleTimes)} ms > ${RULE_MS} ms`);
  assert.ok(coldRuleMs <= COLD_GUARD_MS, `cold rule incl. Name column ${coldRuleMs} ms > ${COLD_GUARD_MS} ms`);
  assert.ok(median(searchTimes) <= SEARCH_MS, `search ${median(searchTimes)} ms > ${SEARCH_MS} ms`);
  assert.ok(median(textRuleTimes) <= SEARCH_MS, `Freie Textsuche ${median(textRuleTimes)} ms > ${SEARCH_MS} ms`);
  assert.ok(median(buildTimes) <= INDEX_MS, `index build ${median(buildTimes)} ms > ${INDEX_MS} ms`);
  assert.ok(extraMB <= INDEX_MB, `index extra heap ${extraMB} MB > ${INDEX_MB} MB`);
});
