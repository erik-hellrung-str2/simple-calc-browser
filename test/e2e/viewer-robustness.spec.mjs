// T7 robustness of the viewer file (TASK-010, follow-ups V1-V3 of the TASK-009 verification; REQ-010, NFR-005, CON-003):
//   V1  a truncated viewer file (cut in a payload, between the payloads and the bootstrap, inside the bootstrap) shows
//       a German error at once instead of `Viewer wird geladen ...` forever; a start that hangs shows a German error
//       after the start timeout (test hook window.__cvViewerTest, shortened);
//   V2  a damaged payload (Base64 broken, gzip data broken, payload not JSON) shows a German message that names the
//       payload and contains no English browser text;
//   V3  the runtime embedded in the viewer file contains no external URL except the documented ones that cannot cause
//       a request (XML namespace identifiers, comments); the request log of the viewer stays empty (NFR-005).
// The viewer file is exported once per test from AC20-FZK-Haus and opened via file:// in a new offline context that
// blocks and logs every request (test/support/viewer.mjs). The broken copies are made in Node from the exported bytes.
import { writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { test, expect } from "../support/network-guard.mjs";
import { fixture, loadFiles, openBuilder } from "../support/builder.mjs";
import { idle } from "../support/view-3d.mjs";
import { exportViewer, openViewerFile } from "../support/viewer.mjs";

const FZK = fixture("AC20-FZK-Haus.ifc");
const PREFIX = "Die Viewer-Datei konnte nicht gestartet werden: ";
const TRUNCATED =
  PREFIX +
  "Die Datei ist unvollständig oder beschädigt. Bitte die Viewer-Datei erneut exportieren oder vollständig kopieren.";
const damaged = (id) =>
  PREFIX +
  `Die Datei ist beschädigt (eingebettete Daten „${id}“ nicht lesbar). Bitte die Viewer-Datei erneut exportieren.`;
// words of the browser's own (English) error texts, e.g. "Failed to fetch", "InvalidCharacterError", "Unexpected token"
const ENGLISH = /\b(failed|fetch|error|invalid|unexpected|token|undefined|null|atob|decode|incorrect)\b/i;

test.describe.configure({ timeout: 300_000 });

/** Exports the FZK viewer file and returns its text (latin1 = byte-exact) and path. */
async function exportFzkViewer(page, info) {
  await openBuilder(page);
  await loadFiles(page, FZK);
  await idle(page);
  const file = await exportViewer(page, info.outputPath("fzk.html"));
  expect(file.last.ok).toBe(true);
  return { path: file.path, text: file.bytes.toString("latin1") };
}

/** Range [start, end) of the Base64 text of payload id inside the viewer file text. */
function payloadRange(text, id) {
  const open = `id="${id}">`;
  const start = text.indexOf(open) + open.length;
  expect(start, id).toBeGreaterThan(open.length);
  return [start, text.indexOf("<", start)];
}

/** Opens a broken copy (text written as latin1) and returns the viewer result after it settled. */
async function openBroken(browser, info, name, text, options = {}) {
  const path = info.outputPath(name);
  writeFileSync(path, Buffer.from(text, "latin1"));
  const viewer = await openViewerFile(browser, path, { timeout: 60_000, ...options });
  const shown = await viewer.page.locator("#cv-root").innerText();
  const hook = await viewer.page.evaluate(() => ({ phase: window.__calc.phase, error: window.__calc.error }));
  return { viewer, shown, hook };
}

test("@robustness @e2e @REQ-010 a truncated viewer file shows a German error at once instead of loading forever (V1)", async ({
  page,
  browser,
}, info) => {
  const { text } = await exportFzkViewer(page, info);
  const bootstrapAt = text.indexOf('<script id="cv-viewer-bootstrap">');
  const helpersAt = text.indexOf('<script id="cv-viewer-helpers">');
  const [modelStart, modelEnd] = payloadRange(text, "cv-payload-model-0");
  const cuts = {
    "half of the file (inside a payload)": Math.floor(text.length / 2),
    "inside the model payload": Math.floor((modelStart + modelEnd) / 2),
    "after the payloads, before the helpers": helpersAt,
    "before the bootstrap": bootstrapAt,
    "inside the bootstrap": bootstrapAt + 400,
    "last 40 bytes missing (bootstrap cut before its end)": text.length - 40,
  };
  for (const [label, at] of Object.entries(cuts)) {
    const t0 = Date.now();
    const { viewer, shown, hook } = await openBroken(browser, info, `cut-${at}.html`, text.slice(0, at));
    try {
      expect(shown, label).toBe(TRUNCATED);
      expect(hook, label).toEqual({ phase: "error", error: TRUNCATED });
      expect(Date.now() - t0, `${label}: at once, not after the start timeout`).toBeLessThan(30_000);
      expect(viewer.requests, label).toEqual([]);
      await expect(viewer.page.locator("#cv-root")).toHaveAttribute("role", "alert");
    } finally {
      await viewer.context.close();
    }
  }
});

test("@robustness @e2e @REQ-010 a viewer start that hangs shows a German error after the start timeout (V1)", async ({
  page,
  browser,
}, info) => {
  const { text } = await exportFzkViewer(page, info);
  const message =
    PREFIX +
    "keine Antwort nach 2 s. Die Datei ist möglicherweise beschädigt oder zu groß für den Arbeitsspeicher des Browsers.";
  const { viewer, shown, hook } = await openBroken(browser, info, "hang.html", text, {
    viewerTest: { startTimeoutMs: 1500, holdStart: true },
  });
  try {
    expect(shown).toBe(message);
    expect(hook).toEqual({ phase: "error", error: message });
    expect(viewer.requests).toEqual([]);
    expect(viewer.errors).toEqual([]);
  } finally {
    await viewer.context.close();
  }
  // the same file without the hook starts normally (the guard does not fire on a healthy start)
  const healthy = await openBroken(browser, info, "healthy.html", text);
  try {
    expect(healthy.hook).toEqual({ phase: "ready", error: null });
    expect(await healthy.viewer.page.evaluate(() => window.__calc.rows.length)).toBeGreaterThan(0);
    await healthy.viewer.page.waitForTimeout(500);
    expect(await healthy.viewer.page.evaluate(() => window.__cvViewerGuard.failed)).toBe(false);
    expect(healthy.viewer.errors).toEqual([]);
  } finally {
    await healthy.viewer.context.close();
  }
});

test("@robustness @e2e @REQ-010 a damaged payload shows a German message naming it, without English browser text (V2)", async ({
  page,
  browser,
}, info) => {
  const { text } = await exportFzkViewer(page, info);
  const replace = (id, fn) => {
    const [start, end] = payloadRange(text, id);
    return text.slice(0, start) + fn(text.slice(start, end)) + text.slice(end);
  };
  const middle = (b64, by) => {
    const at = Math.floor(b64.length / 2);
    return b64.slice(0, at) + by + b64.slice(at + by.length);
  };
  const notJson = gzipSync(Buffer.from("kein JSON {", "utf8")).toString("base64");
  const cases = [
    ["Base64 broken (runtime)", "cv-payload-runtime", (b) => middle(b, "!!!!")],
    ["gzip data broken (model)", "cv-payload-model-0", (b) => middle(b, "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")],
    ["gzip data broken (table)", "cv-payload-table", (b) => middle(b, "////////////////////////////////")],
    ["not JSON (configuration)", "cv-payload-config", () => notJson],
    ["payload empty (table)", "cv-payload-table", () => ""],
  ];
  for (const [label, id, fn] of cases) {
    const { viewer, shown, hook } = await openBroken(browser, info, `${id}.html`, replace(id, fn));
    try {
      expect(shown, label).toBe(damaged(id));
      expect(hook, label).toEqual({ phase: "error", error: damaged(id) });
      expect(shown.replace(PREFIX, ""), `${label}: no English browser text`).not.toMatch(ENGLISH);
      expect(viewer.requests, label).toEqual([]);
      expect(viewer.errors, label).toEqual([]);
    } finally {
      await viewer.context.close();
    }
  }
});

// Every http(s) URL left in the embedded runtime, with the reason it cannot cause a request (TASK-010 V3).
const KEPT_URLS = {
  "http://www.w3.org/1999/xhtml": "XML namespace identifier for document.createElementNS (three, Fragments worker)",
  "http://schemas.openxmlformats.org/spreadsheetml/2006/main": "XML namespace written into the .xlsx (cv-core writer)",
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships": "XML namespace written into the .xlsx",
  "http://schemas.openxmlformats.org/package/2006/relationships": "XML namespace written into the .xlsx",
  "http://schemas.openxmlformats.org/package/2006/content-types": "XML namespace written into the .xlsx",
  "https://jcgt.org/published/0007/04/01/": "paper reference inside a GLSL comment of three",
  "https://github.com/nodeca/pako": "licence comment of pako in the Fragments worker (kept: licence notice)",
};

test("@robustness @system @REQ-010 @NFR-005 the embedded runtime has no unused external URL; the viewer makes no request (V3)", async ({
  page,
  browser,
}, info) => {
  const { path, text } = await exportFzkViewer(page, info);
  const [start, end] = payloadRange(text, "cv-payload-runtime");
  const runtime = JSON.parse(gunzipSync(Buffer.from(text.slice(start, end), "base64")).toString("utf8"));
  const found = new Map();
  for (const [key, source] of [...Object.entries(runtime.sources), ["worker", runtime.worker]])
    for (const m of source.matchAll(/https?:\/\/[^\s"'`)\\<>]+/g)) {
      const url = m[0].replace(/[.,;]+$/, "");
      if (!found.has(url)) found.set(url, new Set());
      found.get(url).add(key);
    }
  const urls = [...found.keys()].sort();
  console.log(
    "[V3] URLs left in the runtime: " + JSON.stringify(Object.fromEntries([...found].map(([u, k]) => [u, [...k]]))),
  );
  expect(urls, "every URL left is documented in KEPT_URLS").toEqual(
    urls.filter((u) => Object.prototype.hasOwnProperty.call(KEPT_URLS, u)),
  );
  // the stripped ones: the jsDelivr SRI banner line and Fragments' unpkg fallback worker URL
  for (const source of [...Object.values(runtime.sources), runtime.worker]) {
    expect(source).not.toMatch(/unpkg\.com|jsdelivr\.com|cdn\.jsdelivr\.net/);
  }

  const viewer = await openViewerFile(browser, path);
  try {
    expect(await viewer.page.evaluate(() => window.__calc.phase)).toBe("ready");
    await viewer.page.evaluate(() => window.CalcView.whenIdle());
    expect(viewer.requests).toEqual([]);
    expect(viewer.blocked).toEqual([]);
    expect(viewer.errors).toEqual([]);
  } finally {
    await viewer.context.close();
  }
});
