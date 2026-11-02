// Helpers for browser tests of the header and the configuration (TASK-007; REQ-009, REQ-011): `Konfiguration speichern`
// (#cv-config-save, a JSON download), `Konfiguration laden` (#cv-config-input, waits on window.__calc.config.loads),
// the dialog `Titel, Datum und Logo` (#cv-header-edit) and the configuration-relevant state of the page.
import { expect } from "./network-guard.mjs";

/** Clicks `Konfiguration speichern` and returns { fileName, text, json } of the download. */
export async function saveConfig(page) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Konfiguration speichern", exact: true }).click(),
  ]);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return { fileName: download.suggestedFilename(), text, json: JSON.parse(text) };
}

/**
 * Loads a configuration file through the hidden input of `Konfiguration laden` ({ name, buffer } or a path) and
 * waits until it was processed; returns window.__calc.config.last.
 */
export async function loadConfig(page, file) {
  await expect(page.getByRole("button", { name: "Konfiguration laden", exact: true })).toBeEnabled();
  const before = await page.evaluate(() => window.__calc.config.loads);
  await page.locator("#cv-config-input").setInputFiles(file);
  await page.waitForFunction((n) => window.__calc.config.loads > n, before, { timeout: 60_000 });
  return page.evaluate(() => window.__calc.config.last);
}

/** A configuration object as a file for setInputFiles. */
export const configFile = (config, name = "konfiguration.json") => ({
  name,
  mimeType: "application/json",
  buffer: Buffer.from(typeof config === "string" ? config : JSON.stringify(config, null, 2), "utf8"),
});

/**
 * Everything a configuration covers, as the page reports it (independent of the saved JSON): table and grouping
 * seams, filter sets with collapsed state and checked values, column filters, model display, header, and the
 * resulting filter (count and row keys) and 3D state (opaque / hidden / colours / section).
 */
export function configuredState(page) {
  return page.evaluate(() => {
    const hook = window.__calc;
    const state = window.CalcView.state();
    return {
      table: window.CalcTable.state(),
      grouping: window.CalcTable.grouping(),
      sets: hook.filter.sets.map((s) => ({ key: s.key, collapsed: s.collapsed, selected: s.selected })),
      view: { mode: hook.view.mode, colourKey: hook.view.colourKey, section: hook.view.section },
      header: window.CalcConfig.header(),
      filterCount: hook.filter.count,
      filterKeys: hook.filter.keys.slice(),
      threeD: {
        mode: state.mode,
        opaque: [...state.opaque].sort(),
        ghost: [...state.ghost].sort(),
        hidden: [...state.hidden].sort(),
        colours: [...state.colours].sort(),
        section: state.section,
      },
    };
  });
}

/** Opens the dialog `Titel, Datum und Logo`. */
export async function openHeaderDialog(page) {
  await page.getByRole("button", { name: "Titel, Datum und Logo bearbeiten" }).click();
  const dialog = page.getByRole("dialog", { name: "Titel, Datum und Logo" });
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Chooses a logo file in the open header dialog and waits until it was read (preview or error). */
export async function chooseLogo(page, dialog, file) {
  await dialog.locator("#cv-hdr-logo").setInputFiles(file);
  await expect(dialog.locator("#cv-hdr-apply")).toBeEnabled();
}
