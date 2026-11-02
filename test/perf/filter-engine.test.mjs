// [perf] Node micro-benchmark of the TASK-003 filter engine (spec §5 TASK-003 acceptance, Testing T6):
// 30,000 synthetic rows, 6 filter sets including one with ~30,000 distinct values (Name-like) and a multi-valued
// one (Material), plus a numeric column filter. A "facet pass" = evaluate all filters, filtered row indices and the
// values/counts of all 6 filter sets. Target: <= 50 ms, median of 9 (3 stores x 3 selections), for the pass on the column store (warm: columns
// cached, selection changed each time so the filter bitsets are rebuilt). Also reported and guarded: the cold pass,
// which first builds the 7 columns from the rows (one-off when a property comes into use), median of 3.
import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import { performance } from "node:perf_hooks";
import { loadCore } from "../load-core.mjs";

const core = await loadCore();
const N = 30_000;
const TARGET_MS = 50;
const COLD_GUARD_MS = 250; // generous: shared CI machines vary 2-4x on cold runs (JIT, GC)

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
  const rand = rng(42);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const kategorien = Array.from({ length: 40 }, (_, i) => "IfcClass" + i);
  const geschosse = Array.from({ length: 12 }, (_, i) => "Geschoss " + i);
  const materialien = Array.from({ length: 150 }, (_, i) => "Material " + i);
  const modelle = ["ARC", "TWP", "HKL", "SAN", "ELT"];
  const typen = Array.from({ length: 800 }, (_, i) => "Typ " + i);
  const rows = new Array(N);
  for (let i = 0; i < N; i++) {
    const values = {
      Modell: pick(modelle),
      Kategorie: pick(kategorien),
      Name: "Element " + i, // one value per element (Name/GlobalId-like)
      Geschoss: rand() < 0.95 ? pick(geschosse) : undefined,
      Material: Array.from({ length: Math.floor(rand() * 3) }, () => pick(materialien)).sort(),
      Typ: pick(typen),
      "BaseQuantities.NetVolume": rand() < 0.8 ? Math.round(rand() * 10000) / 1000 : undefined,
    };
    rows[i] = { key: "m:" + i, guid: "g" + i, values };
  }
  return rows;
}

const median = (list) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
const SETS = ["Modell", "Kategorie", "Name", "Geschoss", "Material", "Typ"];

function pass(store, variant) {
  const filters = [
    { key: "Kategorie", type: "values", values: ["IfcClass" + variant, "IfcClass" + (variant + 7)] },
    { key: "Geschoss", type: "values", values: ["Geschoss 1", "Geschoss " + (variant + 2), null] },
    { key: "Material", type: "values", values: ["Material " + variant, "Material 99"] },
    { key: "Name", type: "values", values: Array.from({ length: 2000 }, (_, i) => "Element " + (i * 7 + variant)) },
    { id: "col:Vol", key: "BaseQuantities.NetVolume", type: "range", min: 0.5 + variant / 10, max: 9 },
  ];
  const t0 = performance.now();
  const ev = core.evaluateFilters(store, filters);
  const rows = core.filterRows(ev);
  const facets = core.facetCounts(ev, null, SETS);
  const ms = performance.now() - t0;
  return { ms, rows: rows.length, facets };
}

test("[perf] TASK-003 facet pass at 30k rows with 6 filter sets (incl. ~30k-value Name set) <= 50 ms, median of 9 warm passes (3 stores x 3 selections)", () => {
  const rows = syntheticRows();
  const cold = [];
  const warm = [];
  let last;
  for (let run = 0; run < 3; run++) {
    const store = core.createColumnStore(rows);
    cold.push(pass(store, run).ms);
    for (let v = 1; v <= 3; v++) {
      last = pass(store, run * 3 + v);
      warm.push(last.ms);
    }
  }
  // sanity: the Name set lists ~30k values when no Name filter is active
  const store = core.createColumnStore(rows);
  const names = core.facetCounts(store, [], ["Name"]).get("Name");
  assert.equal(names.values.length, N);
  assert.ok(last.facets.get("Name").values.length > 0);
  const sortStart = performance.now();
  core.sortRows(store, core.filterRows(store, []), { key: "BaseQuantities.NetVolume", dir: "desc" });
  const sortMs = performance.now() - sortStart;
  const report = {
    rows: N,
    filterSets: SETS.length,
    coldMedianMs: +median(cold).toFixed(2),
    warmMedianMs: +median(warm).toFixed(2),
    cold: cold.map((x) => +x.toFixed(2)),
    warm: warm.map((x) => +x.toFixed(2)),
    coldSortMs: +sortMs.toFixed(2),
    heapUsedMB: +(process.memoryUsage().heapUsed / 1048576).toFixed(1),
    node: process.version,
    cpu: os.cpus()[0] && os.cpus()[0].model,
  };
  console.log("[perf] TASK-003 filter engine " + JSON.stringify(report));
  // Acceptance (TASK-003): the facet pass on the column store, median of 9 warm passes (3 stores x 3 selections).
  assert.ok(median(warm) <= TARGET_MS, `facet pass median ${median(warm)} ms > ${TARGET_MS} ms`);
  // Regression guard, not the acceptance target: the cold pass also builds all 7 columns from the rows (one-off when
  // a property first comes into use; part of the NFR-001 500 ms budget, measured end to end in TASK-010).
  assert.ok(median(cold) <= COLD_GUARD_MS, `cold pass incl. column build ${median(cold)} ms > ${COLD_GUARD_MS} ms`);
});
