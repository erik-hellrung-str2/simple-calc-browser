// T1 (TASK-001b): drift guard of spec §4.1 / DEC-10 in cv-core (checkLibraryVersions, packageVersions).
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadCore } from "../load-core.mjs";

const core = await loadCore();
const GRAPH = [
  "/npm/@thatopen/fragments@3.4.7/+esm",
  "/npm/three@0.185.1/+esm",
  "/npm/three@0.185.1/examples/jsm/lines/Line2.js/+esm",
  "/npm/web-ifc@0.0.77/+esm",
];

test("[unit] drift guard accepts the expected graph and returns the versions", () => {
  assert.equal(core.EXPECTED_THREE, "0.185.1");
  assert.equal(core.EXPECTED_WEBIFC, "0.0.77");
  assert.deepEqual(core.checkLibraryVersions(GRAPH), { three: "0.185.1", webIfc: "0.0.77" });
});

test("[unit] drift guard: wrong three version -> exact German message", () => {
  const keys = GRAPH.map((k) => k.replace("three@0.185.1", "three@0.186.0"));
  assert.throws(() => core.checkLibraryVersions(keys), {
    message: "Unerwartete Bibliotheksversion von jsDelivr: three 0.186.0 statt 0.185.1.",
  });
});

test("[unit] drift guard: wrong web-ifc version -> exact German message", () => {
  const keys = GRAPH.map((k) => k.replace("web-ifc@0.0.77", "web-ifc@0.0.78"));
  assert.throws(() => core.checkLibraryVersions(keys), {
    message: "Unerwartete Bibliotheksversion von jsDelivr: web-ifc 0.0.78 statt 0.0.77.",
  });
});

test("[unit] drift guard: two three versions in the graph are rejected", () => {
  const keys = [...GRAPH, "/npm/three@0.170.0/+esm"];
  assert.throws(() => core.checkLibraryVersions(keys), {
    message: "Unerwartete Bibliotheksversion von jsDelivr: three 0.170.0, 0.185.1 statt 0.185.1.",
  });
});

test("[unit] drift guard: missing library is reported as 'keine'", () => {
  const keys = GRAPH.filter((k) => !k.includes("web-ifc"));
  assert.throws(() => core.checkLibraryVersions(keys), {
    message: "Unerwartete Bibliotheksversion von jsDelivr: web-ifc keine statt 0.0.77.",
  });
});

test("[unit] drift guard honours explicit expected versions", () => {
  assert.throws(() => core.checkLibraryVersions(GRAPH, { three: "0.185.1", webIfc: "0.0.80" }), {
    message: "Unerwartete Bibliotheksversion von jsDelivr: web-ifc 0.0.77 statt 0.0.80.",
  });
});

test("[unit] packageVersions ignores other packages with a common prefix", () => {
  const keys = ["/npm/three-mesh-bvh@0.9.0/+esm", "/npm/three@0.185.1/+esm", "/npm/@scope/three@1.0.0/+esm"];
  assert.deepEqual(core.packageVersions(keys, "three"), ["0.185.1"]);
});
