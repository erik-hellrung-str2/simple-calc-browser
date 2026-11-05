// NFR-005 for 1.1.0 viewer files (TASK-020; spec NFR-005 "CR-002: re-verified for 1.1.0 viewer files while using
// filter panel, rules, colouring panel, element tools and section (no icon, font or library is fetched)", Testing T3).
// The builder exports AC20-FZK-Haus through `HTML exportieren`; the downloaded file is opened via file:// in a new
// context that is offline and aborts every routable request, and every request is logged (test/support/viewer.mjs).
// In the viewer the test uses every CR-002 feature through the UI: toolbar `Filter` (panel, search, a rule through
// `Filter bearbeiten`, `Zurücksetzen`), `Färben` (property list, `Farbskala`, a swatch, the pill), the click menu
// (`Ausblenden`, `Schneiden`), the properties-panel button `Isolieren`, the section handle (arrow
// keys), every pill, the ghost toggle and `Fokus`. Asserted: no request at all, no blocked request, no page error.
import { test, expect } from "../support/network-guard.mjs";
import { fixture, loadFiles, openBuilder } from "../support/builder.mjs";
import { exportViewer, openViewerFile } from "../support/viewer.mjs";
import { afterUpdate, anyPickable, cutAt, menuAction, panelAction, shownPills } from "../support/tools.mjs";
import { addRule, filterPanel, openFilterPanel, ruleRows, toolbar } from "../support/rules.mjs";
import { colourBy, colourPanel, colourTool, idle } from "../support/view-3d.mjs";

const FZK = fixture("AC20-FZK-Haus.ifc");

test.describe.configure({ timeout: 300_000 });

test("@system @acceptance @NFR-005 a 1.1.0 viewer file makes no request while filter panel, rules, search, colouring panel, element tools, properties panel, section and `Fokus` are used", async ({
  page,
  browser,
}, info) => {
  const errors = await openBuilder(page);
  await loadFiles(page, FZK);
  await idle(page);
  const total = await page.evaluate(() => window.__calc.rows.length);
  const file = await exportViewer(page, info.outputPath("viewer.html"));
  expect(file.last.ok).toBe(true);
  const viewer = await openViewerFile(browser, file.path);
  try {
    const v = viewer.page;
    await idle(v);
    expect(await v.evaluate(() => window.__calc.rows.length)).toBe(total);
    const count = () => v.evaluate(() => window.__calc.filter.count);

    // filter panel: search (index built on opening), a rule through the dialog, panel `Zurücksetzen`
    await openFilterPanel(v);
    await expect(v.locator("#cv-filter-status")).toHaveText(/ von .* Objekten sichtbar$/);
    await afterUpdate(v, () => v.getByRole("searchbox", { name: "Suchen nach Objekten" }).fill("wand"));
    expect(await count()).toBeLessThan(total);
    // the ghost toggle of the pill `Filter entfernen`, off and on again
    const ghost = v.getByRole("button", { name: /^Ausgeblendete (anzeigen|verbergen)$/ });
    await ghost.click();
    await idle(v);
    await ghost.click();
    await idle(v);
    await addRule(v, { mode: "isolate", key: "Kategorie", op: "contains", value: "wall" });
    await addRule(v, { mode: "mark", key: "Name", op: "starts", value: "Wand-Ext" });
    await expect(ruleRows(v)).toHaveCount(2);
    await afterUpdate(v, () => filterPanel(v).getByRole("button", { name: "Zurücksetzen" }).click());
    expect(await count()).toBe(total);
    await toolbar(v).getByRole("button", { name: "Filter", exact: true }).click();
    await expect(filterPanel(v)).toBeHidden();

    // colouring panel: a property, `Farbskala`, a swatch, then the pill removes it
    await colourBy(v, "Geschoss", "Geschoss", { keepOpen: true });
    await colourPanel(v).getByRole("button", { name: "Farbskala", exact: true }).click();
    await colourPanel(v).getByRole("button", { name: "Grün", exact: true }).click();
    await colourTool(v).click();
    await expect(colourPanel(v)).toBeHidden();
    await idle(v);
    await v.locator("#cv-pill-colour").getByRole("button", { name: "Einfärbung entfernen", exact: true }).click();
    await expect(v.locator("#cv-pill-colour")).toBeHidden();

    // element tools: click menu `Ausblenden`, properties panel `Isolieren`, both pills
    await menuAction(v, await anyPickable(v), "Ausblenden");
    expect(await count()).toBe(total - 1);
    const shownKey = await v.evaluate(() => window.__calc.table.keys[0]);
    await panelAction(v, shownKey, "isolate");
    expect(await count()).toBe(1);
    await v.keyboard.press("Escape");
    expect(await shownPills(v)).toEqual(expect.arrayContaining(["Isolierung entfernen", "Ausblendung entfernen"]));
    await afterUpdate(v, () => v.locator("#cv-pill-isolate-reset").click());
    await afterUpdate(v, () => v.locator("#cv-pill-hidden-reset").click());
    expect(await count()).toBe(total);

    // section: `Schneiden` in the click menu, the handle moved with the arrow keys, pill `Schnitt entfernen`
    const plane = await cutAt(v, await anyPickable(v));
    expect(plane).not.toBeNull();
    await v.keyboard.press("Escape"); // the selection the click made
    const handle = v.getByRole("button", { name: "Schnitt verschieben" });
    await handle.focus();
    await v.keyboard.press("ArrowUp");
    await v.keyboard.press("ArrowDown");
    await idle(v);
    await v.locator("#cv-pill-section-reset").click();
    await expect(v.locator("#cv-pill-section")).toBeHidden();
    expect(await v.evaluate(() => window.__calc.view.section)).toBeNull();

    // `Fokus`
    await toolbar(v).getByRole("button", { name: "Fokus", exact: true }).click();
    await idle(v);

    expect(viewer.requests, "NFR-005: no request").toEqual([]);
    expect(viewer.blocked).toEqual([]);
    expect(viewer.errors).toEqual([]);
  } finally {
    await viewer.context.close();
  }
  expect(errors).toEqual([]);
});
