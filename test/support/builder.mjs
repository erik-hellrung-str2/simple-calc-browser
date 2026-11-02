// Helpers for browser tests of the builder: open it, load files through the file input and wait on the test hook
// window.__calc (phase / loads), never on data-cv-ready.
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "./network-guard.mjs";

export const fixture = (name) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
export const fetched = (name) => fileURLToPath(new URL(`../../test-cache/fixtures/${name}`, import.meta.url));
export const REF = JSON.parse(readFileSync(fixture("reference-values.json"), "utf8"));

/** Opens the builder and waits until it is ready (libraries linked, engine started). */
export async function openBuilder(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("calc-viewer-builder.html");
  await page.waitForFunction(() => window.__calc && window.__calc.phase === "ready", null, { timeout: 60_000 });
  expect(await page.evaluate(() => window.__calc.error)).toBeNull();
  return errors;
}

/**
 * Loads files (paths or { name, mimeType, buffer }) in one batch via the file input and waits until the batch
 * has finished (window.__calc.loads incremented, phase ready).
 */
export async function loadFiles(page, files, timeout = 120_000) {
  const before = await page.evaluate(() => window.__calc.loads);
  const list = Array.isArray(files) ? files : [files];
  // Playwright cannot mix paths and buffers in one call: turn paths into buffers then.
  const mixed = list.some((f) => typeof f !== "string") && list.some((f) => typeof f === "string");
  const input = mixed
    ? list.map((f) =>
        typeof f === "string"
          ? { name: basename(f), mimeType: "application/octet-stream", buffer: readFileSync(f) }
          : f,
      )
    : files;
  await page.locator("#cv-file-input").setInputFiles(input);
  await page.waitForFunction((n) => window.__calc.loads > n && window.__calc.phase === "ready", before, { timeout });
}

/** Clicks the remove button of a model (by its Modell name) and waits until it is done. */
export async function removeModel(page, modell) {
  const before = await page.evaluate(() => window.__calc.loads);
  await page.getByRole("button", { name: `Modell entfernen: ${modell}`, exact: true }).click();
  await page.waitForFunction((n) => window.__calc.loads > n && window.__calc.phase === "ready", before);
}

/** Rows (spec 4.3) whose GlobalId is in guids, as plain objects. */
export function rowsByGuid(page, guids) {
  return page.evaluate((list) => window.__calc.rows.filter((r) => list.includes(r.guid)), guids);
}

/** { Modell value -> row count } of the visible rows. */
export function countBy(page, key, filter) {
  return page.evaluate(
    ({ key, filter }) => {
      const out = {};
      for (const row of window.__calc.rows) {
        if (filter && Object.entries(filter).some(([k, v]) => row.values[k] !== v)) continue;
        const value = row.values[key];
        out[value] = (out[value] || 0) + 1;
      }
      return out;
    },
    { key, filter },
  );
}

export function catalogEntry(page, key) {
  return page.evaluate((k) => window.__calc.catalog.find((e) => e.key === k) || null, key);
}

/** Relative comparison as recorded in reference-values.json meta.tolerance. */
export function expectClose(actual, expected, label) {
  const tol = REF.meta.tolerance.relative;
  expect(typeof actual, `${label}: number`).toBe("number");
  expect(Math.abs(actual - expected), `${label}: ${actual} vs ${expected}`).toBeLessThanOrEqual(
    tol * Math.max(Math.abs(expected), 1e-12),
  );
}
