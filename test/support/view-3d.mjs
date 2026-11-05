// Helpers for browser tests of the 3D view (TASK-005): CalcView.state() (spec 4.4) as plain data, waiting until the
// queued engine calls are done and drawn, canvas screenshots and pixel comparison.
import { expect } from "./network-guard.mjs";

/** Waits until every queued engine call is done and a frame showing the result has been drawn. */
export function idle(page) {
  return page.evaluate(() => window.CalcView.whenIdle());
}

/**
 * CalcView.state() as plain data: { mode, opaque, ghost, hidden, toolHidden, marked, selected (sorted key arrays),
 * colours ({ key -> hex }), section ({ point, normal } | null, spec 4.4 since CR-002) }.
 */
export async function viewState(page) {
  await idle(page);
  return page.evaluate(() => {
    const s = window.CalcView.state();
    const sorted = (set) => [...set].sort();
    return {
      mode: s.mode,
      opaque: sorted(s.opaque),
      ghost: sorted(s.ghost),
      hidden: sorted(s.hidden),
      toolHidden: sorted(s.toolHidden),
      marked: sorted(s.marked),
      selected: sorted(s.selected),
      colours: Object.fromEntries(s.colours),
      section: s.section,
    };
  });
}

/** { key -> row } for the rows of window.__calc (plain objects). */
export async function rowsByKey(page) {
  const rows = await page.evaluate(() => window.__calc.rows);
  return new Map(rows.map((r) => [r.key, r]));
}

/** Keys of the rows with the given GlobalIds, in the order of guids. */
export async function keysOfGuids(page, guids) {
  return page.evaluate((list) => list.map((g) => window.__calc.rows.find((r) => r.guid === g)?.key ?? null), guids);
}

// the floating properties panel, the click menu, the section handle, the toolbar, hint, title chip, panels and pills
// (CR-002) are overlays like the view bar
const CANVAS_ONLY = {
  style:
    "#cv-overlay, #cv-view-bar, #cv-legend, #cv-props, #cv-pick, #cv-section-handle, #cv-title-chip, #cv-hint, #cv-toolbar, #cv-filter-panel, #cv-colour-panel, #cv-pills { visibility: hidden !important; }",
};

/** PNG screenshot of the 3D canvas only (controls and legend hidden), after the view is idle. */
export async function canvasShot(page) {
  await idle(page);
  return page.locator("#cv-viewport canvas").screenshot(CANVAS_ONLY);
}

/**
 * Share of pixels that differ (sum of the channel differences > 12; a ghost at 12 % opacity changes the background by
 * about 25) between two PNG screenshots.
 */
export function pixelDifference(page, a, b) {
  return page.evaluate(
    async ([pa, pb]) => {
      const decode = async (b64) => {
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(bitmap, 0, 0);
        return ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
      };
      const [da, db] = await Promise.all([decode(pa), decode(pb)]);
      if (da.length !== db.length) return 1;
      let differing = 0;
      for (let i = 0; i < da.length; i += 4) {
        const d = Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
        if (d > 12) differing++;
      }
      return differing / (da.length / 4);
    },
    [a.toString("base64"), b.toString("base64")],
  );
}

export const colourPanel = (page) => page.getByRole("region", { name: "Färben", exact: true });
export const colourTool = (page) =>
  page.getByRole("toolbar", { name: "3D-Werkzeuge" }).getByRole("button", { name: "Färben", exact: true });

/** Opens the colouring panel (toolbar `Färben`) if it is closed. */
export async function openColourPanel(page) {
  if (!(await colourPanel(page).isVisible())) await colourTool(page).click();
  await expect(colourPanel(page)).toBeVisible();
}

/**
 * Colours by property `key` through the colouring panel (REQ-005, CR-002; TASK-016): toolbar `Färben`, `Ändern` when
 * a property is already chosen, search `Parameter suchen` for `query`, pick the entry; the panel then shows the chosen
 * property and its legend. keepOpen: false (default) closes the panel again with `Färben`, so the 3D view is free.
 */
export async function colourBy(page, query, key, options) {
  await openColourPanel(page);
  const panel = colourPanel(page);
  const change = panel.locator("#cv-colour-param");
  if (await change.isVisible()) await change.click();
  await panel.getByRole("searchbox", { name: "Parameter suchen" }).fill(query);
  await panel.locator(`.cv-colour-item[data-key="${key}"]`).click();
  await expect(change).toBeVisible();
  await expect(change.locator(".cv-suggest-label")).toHaveText(new RegExp(`^${key.replace(/[.()]/g, "\\$&")}`));
  await expect(page.locator("#cv-pill-colour")).toBeVisible();
  if (!(options && options.keepOpen)) {
    await colourTool(page).click();
    await expect(panel).toBeHidden();
  }
}

/** Legend entries of the colouring panel as rendered (the panel is opened if closed): [{ label, colour, count, kind }]. */
export async function legendEntries(page) {
  await openColourPanel(page);
  return page.locator("#cv-legend .cv-legend-row").evaluateAll((items) =>
    items.map((row) => ({
      label: row.querySelector(".cv-legend-value").textContent,
      colour: row.dataset.colour,
      count: Number(row.querySelector(".cv-legend-count").textContent.replace(/\./g, "")),
      kind: row.dataset.kind,
    })),
  );
}

/** Removes the colouring with the pill `Einfärbung entfernen` (REQ-005-AC9); the pill disappears. */
export async function clearColouring(page) {
  await page.locator("#cv-pill-colour").getByRole("button", { name: "Einfärbung entfernen", exact: true }).click();
  await expect(page.locator("#cv-pill-colour")).toBeHidden();
}

/** Colour dots of the rendered value rows of a filter set: { label -> colour ('' if none) } (CSS rgb -> hex). */
export function setDots(page, key) {
  return page.evaluate((k) => {
    const hex = (css) => {
      const m = /rgb\((\d+), (\d+), (\d+)\)/.exec(css);
      return m
        ? "#" +
            m
              .slice(1)
              .map((x) => Number(x).toString(16).padStart(2, "0"))
              .join("")
        : "";
    };
    const out = {};
    for (const row of document.querySelectorAll(`.cv-fs[data-key="${k}"] .cv-fs-value`)) {
      if (row.hidden) continue;
      const dot = row.querySelector(".cv-dot");
      out[row.querySelector(".cv-fs-label").textContent] = dot.classList.contains("cv-dot-on")
        ? hex(dot.style.background)
        : "";
    }
    return out;
  }, key);
}

/**
 * Sets the ghost toggle in the pill `Filter entfernen` (REQ-005-AC1, CR-002; TASK-015a): ghosts on = pressed
 * `Ausgeblendete verbergen`, off = `Ausgeblendete anzeigen`. The pill is shown only while a filter source is active.
 */
export async function setGhosts(page, on) {
  const toggle = page.locator("#cv-ghost-toggle");
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute("aria-pressed")) !== String(on)) await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", String(on));
  await expect(toggle).toHaveAccessibleName(on ? "Ausgeblendete verbergen" : "Ausgeblendete anzeigen");
}
