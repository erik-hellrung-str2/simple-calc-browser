// Helpers for tests of the table exports (TASK-008, REQ-008): `Export CSV` (#cv-export-csv) and `Export Excel`
// (#cv-export-xlsx) as downloads, read back by an independent reader (test/support/read-export.py: Python's csv
// module and openpyxl, never the product's code), and the expected cell texts of the spec rules.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect } from "./network-guard.mjs";

const READER = fileURLToPath(new URL("./read-export.py", import.meta.url));

/**
 * Clicks `Export CSV` (format 'csv') or `Export Excel` ('xlsx'), waits for the download and the finished export;
 * the file is saved to path. Returns { fileName, path, bytes (Buffer), last (window.__calc.export.last) }.
 */
export async function exportFile(page, format, path) {
  const name = format === "csv" ? "Export CSV" : "Export Excel";
  const button = page.getByRole("button", { name, exact: true });
  await expect(button).toBeEnabled();
  const before = await page.evaluate(() => window.__calc.export.count);
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 120_000 }), button.click()]);
  await download.saveAs(path);
  await page.waitForFunction((n) => window.__calc.export.count > n, before);
  return {
    fileName: download.suggestedFilename(),
    path,
    bytes: readFileSync(path),
    last: await page.evaluate(() => window.__calc.export.last),
  };
}

/** Runs the Python reader (mode 'csv' | 'xlsx' | 'xlsx-summary') on a file and returns its JSON. */
export function readExport(mode, path) {
  const out = execFileSync("python3", ["-I", READER, mode, path], { maxBuffer: 1 << 30, encoding: "utf8" });
  return JSON.parse(out);
}

/** Expected CSV text of a text cell (REQ-008, DEC-6): "'" before = + - @. Quoting is undone by the CSV reader. */
export const csvText = (s) => (/^[=+\-@]/.test(s) ? "'" + s : s);

/** Number of a CSV cell in German notation ("1234,5", no thousands separator) or null for "". */
export function csvNumber(text) {
  if (text === "") return null;
  expect(text, `CSV number ${text}`).toMatch(/^-?\d+(,\d+)?$/);
  return Number(text.replace(",", "."));
}
