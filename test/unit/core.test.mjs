import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BUILDER_HTML, corePath, extractScript, loadCore } from "../load-core.mjs";

const html = readFileSync(BUILDER_HTML, "utf8");
const core = await loadCore();

test("[unit] load-core imports cv-core from calc-viewer-builder.html (placeholder until TASK-002)", () => {
  assert.deepEqual(core.coreInfo(), { name: "calc-core", schemaVersion: 0 });
});

test("[unit] load-core keeps line numbers of the HTML file", () => {
  const extracted = readFileSync(corePath(html).path, "utf8").split("\n");
  const htmlLines = html.split("\n");
  const line = htmlLines.findIndex((l) => l.includes("export function coreInfo"));
  assert.ok(line > 0);
  assert.equal(extracted[line], htmlLines[line]);
});

test("[unit] load-core names the extracted file by its content (parallel runs never share a half-written file)", () => {
  const a = corePath(html);
  assert.match(a.path, /[\\/]\.cache[\\/]cv-core-[0-9a-f]{16}\.mjs$/);
  assert.equal(corePath(html).path, a.path, "same HTML, same file (c8 merges coverage across test processes)");
  const changed = html.replace("export function coreInfo", "export function coreInfo2");
  assert.notEqual(corePath(changed).path, a.path, "another HTML version writes another file");
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
