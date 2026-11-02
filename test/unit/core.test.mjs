import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BUILDER_HTML, extractScript, loadCore } from "../load-core.mjs";

const html = readFileSync(BUILDER_HTML, "utf8");
const core = await loadCore();

test("[unit] load-core imports cv-core from calc-viewer-builder.html (placeholder until TASK-002)", () => {
  assert.deepEqual(core.coreInfo(), { name: "calc-core", schemaVersion: 0 });
});

test("[unit] load-core keeps line numbers of the HTML file", () => {
  const extracted = readFileSync(new URL("../../.cache/cv-core.mjs", import.meta.url), "utf8").split("\n");
  const htmlLines = html.split("\n");
  const line = htmlLines.findIndex((l) => l.includes("export function coreInfo"));
  assert.ok(line > 0);
  assert.equal(extracted[line], htmlLines[line]);
});

test("[unit] extractScript reports a missing block", () => {
  assert.throws(() => extractScript("<p></p>", "cv-core-src"), /no <script id="cv-core-src"> found/);
});

test("[unit] embedded source blocks are ASCII only (spec §4.2)", () => {
  for (const id of ["cv-core-src", "cv-ui-src", "cv-3d-src", "cv-app-src", "cv-viewer-bootstrap"]) {
    const src = extractScript(html, id);
    const bad = [...src].findIndex((c) => c.charCodeAt(0) > 0x7f);
    assert.equal(bad, -1, `${id} contains a non-ASCII character; use a \\u escape`);
  }
});
