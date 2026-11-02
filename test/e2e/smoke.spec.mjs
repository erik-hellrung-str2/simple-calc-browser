// T9 smoke (TASK-001b, spec §5): the builder starts in both projects (file:// and http) under the network guard,
// links the jsDelivr graph from the hash-locked cache, converts AC20-FZK-Haus.ifc in the classic Blob worker and
// shows it in 3D. Risk R-1 (FragmentsModels.load under file://) is covered by the `file` project.
import { fileURLToPath } from "node:url";
import { test, expect } from "../support/network-guard.mjs";

const FZK = fileURLToPath(new URL("../fixtures/AC20-FZK-Haus.ifc", import.meta.url));
const BACKGROUND = [0xec, 0xee, 0xf0]; // --cv-bg-3d behind the transparent WebGL canvas
const CANVAS_ONLY = { style: "#cv-overlay { visibility: hidden !important; }" }; // screenshot the canvas, not the hint box

/** Share of pixels in a PNG screenshot that differ clearly from the empty 3D background (decoded in the page). */
async function nonBackgroundShare(page, png) {
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

test("@smoke builder loads AC20-FZK-Haus.ifc and shows it in 3D @REQ-001", async ({ page, net }) => {
  test.setTimeout(120_000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("calc-viewer-builder.html");
  expect(new URL(page.url()).protocol).toBe(test.info().project.name === "file" ? "file:" : "http:");
  await expect(page).toHaveTitle("Calc Viewer Builder");
  await expect(page.locator("html")).toHaveAttribute("data-cv-ready", "builder", { timeout: 30_000 });
  expect(await page.evaluate(() => window.__calc.error)).toBeNull();
  expect(await page.evaluate(() => window.__calc.versions)).toEqual({
    fragments: "3.4.7",
    three: "0.185.1",
    webIfc: "0.0.77",
  });
  await expect(page.locator("#cv-title")).toHaveText("Calc Viewer Builder");
  for (const id of ["#cv-filters", "#cv-viewport", "#cv-details", "#cv-table", "#cv-status"]) {
    await expect(page.locator(id)).toBeVisible();
  }

  const canvas = page.locator("#cv-viewport canvas");
  const emptyShare = await nonBackgroundShare(page, await canvas.screenshot(CANVAS_ONLY));

  await page.locator("#cv-file-input").setInputFiles(FZK);
  await page.waitForFunction(() => window.__calc.modelCount === 1 && window.__calc.phase === "ready", null, {
    timeout: 90_000,
  });
  const hook = await page.evaluate(() => window.__calc);
  expect(hook.error).toBeNull();
  expect(hook.models).toHaveLength(1);
  expect(hook.models[0].name).toBe("AC20-FZK-Haus.ifc");
  expect(hook.elementCount).toBeGreaterThan(0);
  await expect(page.locator("#cv-status")).toContainText("Elemente in 1 Modell");
  await expect(page.locator("#cv-overlay")).toBeHidden();

  // Canvas non-empty: the rendered model covers a clear share of the view (the empty view is background only).
  expect(emptyShare).toBeLessThan(0.01);
  await expect
    .poll(async () => nonBackgroundShare(page, await canvas.screenshot(CANVAS_ONLY)), { timeout: 15_000 })
    .toBeGreaterThan(0.05);
  console.log(
    `[smoke] elements=${hook.elementCount}, canvas non-background share=${(
      await nonBackgroundShare(page, await canvas.screenshot(CANVAS_ONLY))
    ).toFixed(3)} (empty ${emptyShare.toFixed(3)})`,
  );

  // The importer's web-ifc wasm and the Fragments worker came from the cache, nothing else left the machine.
  expect(net.served).toContain("/npm/web-ifc@0.0.77/web-ifc.wasm");
  expect(net.served).toContain("/npm/@thatopen/fragments@3.4.7/dist/Worker/worker.min.mjs");
  expect(errors).toEqual([]);
});
