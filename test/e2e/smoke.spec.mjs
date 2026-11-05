// T9 smoke (TASK-001b, spec §5): the builder starts in both projects (file:// and http) under the network guard,
// links the jsDelivr graph from the hash-locked cache, converts AC20-FZK-Haus.ifc in the classic Blob worker and
// shows it in 3D. Risk R-1 (FragmentsModels.load under file://) is covered by the `file` project.
import { fileURLToPath } from "node:url";
import { test, expect } from "../support/network-guard.mjs";
// the 3D background is the reference gradient (verification INC-2 UX-6): pixels are compared with the empty box
import { canvasShots, nonBackgroundShare } from "../support/viewer.mjs";

const FZK = fileURLToPath(new URL("../fixtures/AC20-FZK-Haus.ifc", import.meta.url));

test("@smoke @system builder loads AC20-FZK-Haus.ifc and shows it in 3D @REQ-001", async ({ page, net }) => {
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
  for (const id of ["#cv-filters", "#cv-viewport", "#cv-table", "#cv-status"]) {
    await expect(page.locator(id)).toBeVisible();
  }
  // CR-002: no element-details column; the properties panel floats in the 3D view and opens on a selection only
  await expect(page.locator("#cv-details")).toHaveCount(0);
  await expect(page.locator("#cv-props")).toBeHidden();

  const share = async () => {
    const { shot, background } = await canvasShots(page);
    return nonBackgroundShare(page, shot, background);
  };
  const emptyShare = await share();

  await page.locator("#cv-file-input").setInputFiles(FZK);
  await page.waitForFunction(() => window.__calc.modelCount === 1 && window.__calc.phase === "ready", null, {
    timeout: 90_000,
  });
  const hook = await page.evaluate(() => window.__calc);
  expect(hook.error).toBeNull();
  expect(hook.models).toHaveLength(1);
  expect(hook.models[0].name).toBe("AC20-FZK-Haus.ifc");
  expect(hook.elementCount).toBeGreaterThan(0);
  const total = hook.elementCount.toLocaleString("de-DE");
  await expect(page.locator("#cv-status")).toHaveText(`${total} von ${total} Elementen`);
  await expect(page.locator("#cv-status-models")).toHaveText("1 Modell");
  await expect(page.locator("#cv-overlay")).toBeHidden();

  // Canvas non-empty: the rendered model covers a clear share of the view (the empty view is background only).
  expect(emptyShare).toBeLessThan(0.01);
  await expect.poll(share, { timeout: 15_000 }).toBeGreaterThan(0.05);
  console.log(
    `[smoke] elements=${hook.elementCount}, canvas non-background share=${(await share()).toFixed(
      3,
    )} (empty ${emptyShare.toFixed(3)})`,
  );

  // The importer's web-ifc wasm and the Fragments worker came from the cache, nothing else left the machine.
  expect(net.served).toContain("/npm/web-ifc@0.0.77/web-ifc.wasm");
  expect(net.served).toContain("/npm/@thatopen/fragments@3.4.7/dist/Worker/worker.min.mjs");
  expect(errors).toEqual([]);
});
