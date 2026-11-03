// T3 system test of the builder (TASK-010; spec Testing T3 "builder from a clean checkout via file:// and via the
// static server in a fresh profile, CDN served from the hash-locked cache"). The builder is one file (CON-001): copied
// ALONE into an empty directory (nothing else of the repository next to it) and opened via file:// in a fresh browser
// context, it starts, links the libraries from the hash-locked jsDelivr cache (network guard: any other request fails
// the test), converts AC20-FZK-Haus.ifc and shows it. The static-server path is the `http` project of
// test/e2e/smoke.spec.mjs (@system @smoke). Expected counts from test/fixtures/reference-values.json.
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { test, expect } from "../support/network-guard.mjs";
import { REF, fixture, loadFiles } from "../support/builder.mjs";
import { BUILDER_HTML } from "../load-core.mjs";

const fzkRows = Object.entries(REF["AC20-FZK-Haus"].elementsInStepTextByKategorie)
  .filter(([k]) => k !== "IfcOpeningElement")
  .reduce((sum, [, n]) => sum + n, 0);

test("@system @REQ-001 the builder copied alone into an empty directory starts via file:// in a fresh context and loads an IFC", async ({
  browser,
}, info) => {
  test.skip(
    info.project.name !== "file",
    "the file:// path; the static server path is the http project of the smoke test",
  );
  test.setTimeout(120_000);
  const copy = info.outputPath("clean/calc-viewer-builder.html");
  mkdirSync(dirname(copy), { recursive: true });
  copyFileSync(BUILDER_HTML, copy);
  expect(readdirSync(dirname(copy))).toEqual(["calc-viewer-builder.html"]);

  // a fresh context (empty profile) with the same CDN-cache routes as the network guard fixture
  const context = await browser.newContext();
  const { CDN, cacheFileFor, contentTypeFor } = await import("../../scripts/lib/cdn-cache.mjs");
  const { readFile } = await import("node:fs/promises");
  const blocked = [];
  await context.route(`${CDN}/**`, async (route) => {
    try {
      const path = new URL(route.request().url()).pathname;
      return route.fulfill({
        body: await readFile(cacheFileFor(path)),
        contentType: contentTypeFor(path),
        headers: { "access-control-allow-origin": "*" },
      });
    } catch {
      blocked.push(route.request().url());
      return route.abort("blockedbyclient");
    }
  });
  await context.route(/^(https?|wss?):\/\/(?!cdn\.jsdelivr\.net\/)/, (route) => {
    blocked.push(route.request().url());
    return route.abort("blockedbyclient");
  });
  try {
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(pathToFileURL(copy).href);
    await page.waitForFunction(() => window.__calc && window.__calc.phase === "ready", null, { timeout: 60_000 });
    expect(await page.evaluate(() => [window.__calc.error, window.__calc.mode])).toEqual([null, "builder"]);
    expect(await page.evaluate(() => window.__calc.versions)).toEqual({
      fragments: "3.4.7",
      three: "0.185.1",
      webIfc: "0.0.77",
    });
    expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
    await loadFiles(page, fixture("AC20-FZK-Haus.ifc"));
    expect(await page.evaluate(() => window.__calc.models.map((m) => [m.modell, m.elements]))).toEqual([
      ["AC20-FZK-Haus", fzkRows],
    ]);
    await expect(page.locator("#cv-status")).toHaveText(`${fzkRows} von ${fzkRows} Elementen`);
    expect(errors).toEqual([]);
    expect(blocked).toEqual([]);
  } finally {
    await context.close();
  }
});
