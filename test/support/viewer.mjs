// Helpers for tests of the viewer file (TASK-009; REQ-010, NFR-003, NFR-005): `HTML exportieren` (#cv-html-export) in
// the builder as a download, and opening the downloaded file via file:// in a NEW browser context with every network
// access blocked (context offline, every routable request aborted) and every request the page makes logged.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { expect } from "./network-guard.mjs";

/**
 * Clicks `HTML exportieren`, waits for the download and the finished export; saves the file to path. Returns
 * { fileName, path, bytes (Buffer), last (window.__calc.viewerExport.last), ms (click -> download, Node clock) }.
 */
export async function exportViewer(page, path) {
  const button = page.getByRole("button", { name: "HTML exportieren", exact: true });
  await expect(button).toBeEnabled();
  const before = await page.evaluate(() => window.__calc.viewerExport.count);
  const t0 = Date.now();
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 300_000 }), button.click()]);
  const ms = Date.now() - t0;
  await download.saveAs(path);
  await page.waitForFunction((n) => window.__calc.viewerExport.count > n, before);
  return {
    fileName: download.suggestedFilename(),
    path,
    bytes: readFileSync(path),
    last: await page.evaluate(() => window.__calc.viewerExport.last),
    ms,
  };
}

/**
 * Opens the viewer file at path via file:// in a new context of browser with all network blocked: the context is
 * offline and every request Playwright can route is aborted. requests lists every request the page made (URL), except
 * the navigation to the file itself; blocked lists the aborted ones. Waits until the viewer is ready (or failed).
 * Returns { context, page, requests, blocked, errors, loadMs (navigation start -> phase ready, Node clock) }.
 */
export async function openViewerFile(browser, path, { timeout = 120_000 } = {}) {
  const context = await browser.newContext({ offline: true, acceptDownloads: true });
  const requests = [];
  const blocked = [];
  const fileUrl = pathToFileURL(path).href;
  await context.route("**/*", (route) => {
    const url = route.request().url();
    if (url === fileUrl) return route.continue();
    blocked.push(url);
    return route.abort("blockedbyclient");
  });
  context.on("request", (request) => {
    if (request.url() !== fileUrl) requests.push(request.url());
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  const t0 = Date.now();
  await page.goto(fileUrl);
  await page.waitForFunction(
    () => window.__calc && (window.__calc.phase === "ready" || window.__calc.phase === "error"),
    null,
    {
      timeout,
    },
  );
  const loadMs = Date.now() - t0;
  return { context, page, requests, blocked, errors, loadMs };
}

/** The `<meta name="cv-exported">` line (export time) removed: two exports of one state must then be equal. */
export const withoutExportTime = (text) => text.replace(/<meta name="cv-exported" content="[^"]*">\n/, "");

const BACKGROUND = [0xec, 0xee, 0xf0]; // --cv-bg-3d behind the transparent WebGL canvas (as test/e2e/smoke.spec.mjs)

/** Share of pixels in a PNG screenshot that differ clearly from the empty 3D background (decoded in the page). */
export function nonBackgroundShare(page, png) {
  return page.evaluate(
    async ({ b64, bg }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(bitmap, 0, 0);
      const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
      let differing = 0;
      for (let i = 0; i < data.length; i += 4) {
        const d = Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]);
        if (d > 24) differing++;
      }
      return differing / (data.length / 4);
    },
    { b64: png.toString("base64"), bg: BACKGROUND },
  );
}
