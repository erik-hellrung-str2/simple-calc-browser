// TASK-009 viewer file, pure parts of cv-core (spec 4.2, 4.4): encodeTable / decodeTable (element table of the viewer
// file), escapeHtml, bytesToBase64, gzipBytes and the fixed skeleton viewerHtmlParts. Real-data checks use the
// AC20-FZK-Haus rows snapshot as INPUT only (round trip: the decoded rows must equal the input); nothing here
// compares against values computed by the product. The skeleton is checked by parsing it with an independent reader
// (Node's zlib and Buffer for gzip / Base64; regular expressions for the HTML structure).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { BUILDER_HTML, extractScript, loadCore } from "../load-core.mjs";

const core = await loadCore();
const fixtures = new URL("../fixtures/", import.meta.url);
const FZK_ROWS = JSON.parse(readFileSync(new URL("fzk-rows.snapshot.json", fixtures), "utf8")).rows;
const html = readFileSync(BUILDER_HTML, "utf8");

/** A model as the builder keeps it, from snapshot rows (input data only). */
function snapshotModel(id) {
  const rows = FZK_ROWS.map((r, i) => ({
    key: `${id}:${100 + i}`,
    model: id,
    localId: 100 + i,
    guid: r.guid,
    geometry: r.values.Geometrie === "Ja",
    values: r.values,
  }));
  const properties = new Map([
    [
      "BaseQuantities.NetVolume",
      {
        pset: "BaseQuantities",
        name: "NetVolume",
        occurrence: true,
        type: false,
        kinds: new Set(["number"]),
        units: new Set(["m³"]),
      },
    ],
    [
      "Pset_X.Flag",
      {
        pset: "Pset_X",
        name: "Flag",
        occurrence: false,
        type: true,
        kinds: new Set(["bool", "text"]),
        units: new Set(),
      },
    ],
  ]);
  return {
    id,
    name: "AC20-FZK-Haus",
    fileName: "AC20-FZK-Haus.ifc",
    rows,
    properties,
    spaceProperties: new Map(),
    spaceIds: [7, 8],
    contextIds: [3],
  };
}

test("[unit] encodeTable / decodeTable round trip of the FZK rows snapshot (two models, catalogue input, ids)", () => {
  const models = [snapshotModel("m1"), { ...snapshotModel("m3"), name: "AC20-FZK-Haus (2)" }];
  const encoded = core.encodeTable(models);
  assert.equal(encoded.version, core.TABLE_VERSION);
  // plain JSON data: survives stringify / parse unchanged
  const decoded = core.decodeTable(JSON.parse(JSON.stringify(encoded)));
  assert.equal(decoded.length, 2);
  for (let m = 0; m < 2; m++) {
    assert.deepEqual(decoded[m].rows, models[m].rows);
    assert.deepEqual(decoded[m].properties, models[m].properties);
    assert.deepEqual(decoded[m].spaceProperties, models[m].spaceProperties);
    for (const k of ["id", "name", "fileName", "spaceIds", "contextIds"]) assert.deepEqual(decoded[m][k], models[m][k]);
  }
  // keys and texts are stored once: much smaller than the plain rows
  const plain = JSON.stringify(models.map((m) => m.rows)).length;
  assert.ok(JSON.stringify(encoded).length < plain / 2, "dictionary encoding at most half the plain JSON");
  // deterministic: equal input, equal output
  assert.equal(JSON.stringify(core.encodeTable(models)), JSON.stringify(encoded));
});

test("[unit] encodeTable keeps every value type: text, number (incl. -0, tiny, huge), multi, empty multi, odd values, no guid", () => {
  const values = {
    Name: 'Wand <b>&amp;</b> äöü 漢字 "q" ;\r\n',
    Zahl: 0.0000001,
    Gross: 2.5e21,
    Neg: -2.5,
    Zero: 0,
    NegZero: -0,
    Material: ["A", "B", "A"],
    Leer: [],
    Mixed: ["x", 3],
    Nix: null,
    Bool: true,
    "": "leerer Schluessel",
    "a.b.c": "Punkt",
    __proto__x: "proto-artig",
  };
  const model = {
    id: "m2",
    name: "M",
    fileName: "m.ifc",
    rows: [
      { key: "m2:5", model: "m2", localId: 5, guid: null, geometry: false, values },
      { key: "m2:6", model: "m2", localId: 6, guid: "g6", geometry: true, values: { Name: values.Name } },
    ],
    properties: new Map(),
    spaceProperties: new Map(),
    spaceIds: [],
    contextIds: [],
  };
  const [back] = core.decodeTable(JSON.parse(JSON.stringify(core.encodeTable([model]))));
  assert.deepEqual(back.rows, model.rows);
  assert.ok(Object.is(back.rows[0].values.NegZero, -0), "-0 stays -0");
  assert.equal(back.rows[0].guid, null);
  // undefined values are dropped (as JSON would)
  const [undef] = core.decodeTable(
    core.encodeTable([{ ...model, rows: [{ ...model.rows[1], values: { Name: "x", U: undefined } }] }]),
  );
  assert.deepEqual(undef.rows[0].values, { Name: "x" });
  // empty model list, unknown version
  assert.deepEqual(core.decodeTable(core.encodeTable([])), []);
  assert.throws(() => core.decodeTable({ version: 99 }), /Unbekanntes Tabellenformat/);
  assert.throws(() => core.decodeTable(null), /Unbekanntes Tabellenformat/);
});

test("[unit] escapeHtml, bytesToBase64 (against Buffer), gzipBytes (against zlib, deterministic)", async () => {
  assert.equal(core.escapeHtml(`<a href="x">&'`), "&#60;a href=&#34;x&#34;&#62;&#38;&#39;");
  assert.equal(core.escapeHtml(42), "42");
  for (const n of [0, 1, 2, 3, 0x8000 * 3 - 1, 0x8000 * 3, 0x8000 * 3 + 1, 200_001]) {
    const bytes = new Uint8Array(n);
    for (let i = 0; i < n; i++) bytes[i] = (i * 7919) & 0xff;
    assert.equal(core.bytesToBase64(bytes), Buffer.from(bytes).toString("base64"), `length ${n}`);
  }
  const text = new TextEncoder().encode("Calc Viewer ".repeat(5000));
  const a = await core.gzipBytes(text);
  const b = await core.gzipBytes(text);
  assert.deepEqual(a, b, "same input, same bytes (two exports in a row)");
  assert.ok(a.length < text.length / 10);
  assert.deepEqual(new Uint8Array(gunzipSync(a)), text);
});

/** A minimal skeleton input. */
const skeleton = (over = {}) => ({
  title: "T",
  generator: "Calc Viewer Builder (x)",
  exported: "2026-11-02T10:00:00.000Z",
  css: ".a{color:red}",
  helpers: "function tovLinkModules() {}",
  bootstrap: "(function () {})();",
  payloads: [
    { id: "cv-payload-runtime", base64: "QUJD" },
    { id: "cv-payload-model-0", base64: "" },
  ],
  ...over,
});

test("[unit] viewerHtmlParts: fixed skeleton, payload elements in order, title and metas escaped", () => {
  const text = core.viewerHtmlParts(skeleton({ title: 'A </script><b x="1">&', generator: 'g "q" <x>' })).join("");
  assert.ok(text.startsWith('<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8">'));
  assert.match(text, /<title>A &#60;\/script&#62;&#60;b x=&#34;1&#34;&#62;&#38;<\/title>/);
  assert.match(text, /<meta name="generator" content="g &#34;q&#34; &#60;x&#62;">/);
  assert.match(text, /<meta name="cv-exported" content="2026-11-02T10:00:00.000Z">\n/);
  assert.match(text, /<style id="cv-css">\.a\{color:red\}<\/style>/);
  const ids = [...text.matchAll(/<script\b[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids, ["cv-payload-runtime", "cv-payload-model-0", "cv-viewer-helpers", "cv-viewer-bootstrap"]);
  assert.match(text, /<script type="application\/octet-stream" id="cv-payload-runtime">QUJD<\/script>/);
  // every script element is closed exactly once, nothing after </html>
  assert.equal((text.match(/<script\b/g) || []).length, (text.match(/<\/script>/g) || []).length);
  assert.ok(text.endsWith("</body>\n</html>\n"));
  // the payload ids the bootstrap reads
  assert.equal(core.VIEWER_PAYLOAD.runtime, "cv-payload-runtime");
  assert.equal(core.VIEWER_PAYLOAD.table, "cv-payload-table");
  assert.equal(core.VIEWER_PAYLOAD.config, "cv-payload-config");
  assert.equal(core.VIEWER_PAYLOAD.model(3), "cv-payload-model-3");
});

test("[unit] viewerHtmlParts refuses parts that would break the skeleton", () => {
  assert.throws(() => core.viewerHtmlParts(skeleton({ css: "a{}</style><script>" })), /css/);
  assert.throws(() => core.viewerHtmlParts(skeleton({ helpers: "x = '</script>'" })), /helpers/);
  assert.throws(() => core.viewerHtmlParts(skeleton({ bootstrap: "x = '<!--'" })), /bootstrap/);
  assert.throws(
    () => core.viewerHtmlParts(skeleton({ payloads: [{ id: "p", base64: "AB<" }] })),
    /Nutzdaten p sind kein Base64/,
  );
});

test("[unit] the real skeleton parts are valid: cv-css, cv-viewer-bootstrap ASCII and free of closing tags; no storage APIs (CON-003)", () => {
  const css = /<style id="cv-css">([\s\S]*?)<\/style>/.exec(html)[1];
  const bootstrap = extractScript(html, "cv-viewer-bootstrap");
  const parts = core.viewerHtmlParts(skeleton({ css, bootstrap }));
  assert.ok(parts.length > 0);
  assert.ok(bootstrap.includes("cv-payload-runtime") && bootstrap.includes("cv-payload-table"));
  assert.ok(bootstrap.includes('mode: "viewer"'));
  for (const [name, text] of [
    ["cv-css", css],
    ["cv-viewer-bootstrap", bootstrap],
  ]) {
    assert.equal(
      [...text].findIndex((c) => c.charCodeAt(0) > 0x7f),
      -1,
      `${name} ASCII only`,
    );
    assert.doesNotMatch(text, /<\/script|<\/style|<!--/i, `${name} has no closing tag`);
  }
  // the viewer file uses no storage API and no network API (CON-003, NFR-005)
  for (const id of ["cv-core-src", "cv-ui-src", "cv-3d-src", "cv-app-src", "cv-viewer-bootstrap"]) {
    const src = extractScript(html, id);
    assert.doesNotMatch(
      src,
      /\b(localStorage|sessionStorage|indexedDB|fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon)\b/,
      id,
    );
  }
  // the text/plain blocks contain no literal script opener or comment opener (would change how the builder parses)
  for (const id of ["cv-core-src", "cv-ui-src", "cv-3d-src", "cv-app-src", "cv-viewer-bootstrap"])
    assert.doesNotMatch(extractScript(html, id), /<script|<!--/i, id);
});
