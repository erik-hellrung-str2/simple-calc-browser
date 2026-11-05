// TASK-015a in-viewer tools (spec REQ-005 toolbar, hint and title chip, REQ-012 filter panel, search and pill
// `Filter entfernen`; CR-002; reference app ref L865-876, L1306-1376, L1394-1430, CSS L1739-1766, L1796-1861):
// toolbar `Fokus` / `Filter` / `Färben`, navigation hint, title chip, filter panel with search and status, pill
// `Filter entfernen` with ghost toggle and chevron, pill stack. Expected counts and key sets come from
// test/fixtures/reference-values.json and the IFC STEP text, not from the product.
import { readFileSync } from "node:fs";
import { test, expect } from "../support/network-guard.mjs";
import { REF, fixture, loadFiles, openBuilder } from "../support/builder.mjs";
import { openHeaderDialog } from "../support/config.mjs";
import { toggleValue } from "../support/filter-area.mjs";
import { idle, keysOfGuids, viewState } from "../support/view-3d.mjs";

test.describe.configure({ timeout: 180_000 });

const FZK = fixture("AC20-FZK-Haus.ifc");
const DUPLEX = fixture("Ifc2x3_Duplex_Architecture.ifc");
const fzkRef = REF["AC20-FZK-Haus"];
// every STEP element is a row except IfcOpeningElement (not an importer element class; TASK-002, as filter-area.spec)
const NOT_ROWS = ["IfcOpeningElement"];
const FZK_TOTAL = Object.entries(fzkRef.elementsInStepTextByKategorie)
  .filter(([k]) => !NOT_ROWS.includes(k))
  .reduce((sum, [, n]) => sum + n, 0);
const HINT = "Ziehen: drehen · Rechts ziehen: verschieben · Mausrad: zoomen · Klick: Eigenschaften und Werkzeuge";
const de = (n) => n.toLocaleString("de-DE");

const toolbar = (page) => page.getByRole("toolbar", { name: "3D-Werkzeuge" });
const tool = (page, name) => toolbar(page).getByRole("button", { name, exact: true });
const panel = (page) => page.getByRole("region", { name: "Filter", exact: true });
const search = (page) => page.getByRole("searchbox", { name: "Suchen nach Objekten" });
const status = (page) => page.locator("#cv-status");
const panelStatus = (page) => page.locator("#cv-filter-status");

/**
 * GlobalIds of the IfcProduct instances whose own STEP line contains `text` in any letter case (their Name), derived
 * from the STEP text: the search value of REQ-012-AC7 occurs only in element names and in property values of the same
 * elements (Pset `Name`, `Komplette Element-ID`, `Kompakte Element-ID`), checked below.
 */
function guidsWithText(file, text) {
  const lines = readFileSync(file, "latin1").split(/;\r?\n/);
  const needle = text.toLowerCase();
  const products = [];
  let other = 0;
  for (const line of lines) {
    if (!line.toLowerCase().includes(needle)) continue;
    const m =
      /^#\d+=\s*IFC(WALLSTANDARDCASE|WALL|SLAB|DOOR|WINDOW|ROOF|BEAM|COLUMN|MEMBER|STAIR|RAILING|COVERING|PLATE|FOOTING|BUILDINGELEMENTPROXY)\('([^']{22})'/i.exec(
        line.trim(),
      );
    if (m) products.push(m[2]);
    else if (/IFCPROPERTYSINGLEVALUE\('(Name|Komplette Element-ID|Kompakte Element-ID)'/.test(line)) other++;
    else throw new Error("unexpected STEP line with the search text: " + line.slice(0, 120));
  }
  return { products: products.sort(), propertyLines: other };
}

async function openWith(page, files) {
  const errors = await openBuilder(page);
  await loadFiles(page, files);
  await idle(page);
  return errors;
}

test("@e2e @acceptance @REQ-012-AC1 `Filter` opens the filter panel with kicker, search, `+ Filter hinzufügen` and status; a second click closes it", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  await expect(panel(page)).toBeHidden();
  await tool(page, "Filter").click();
  await expect(panel(page)).toBeVisible();
  await expect(tool(page, "Filter")).toHaveAttribute("aria-pressed", "true");
  // kicker `Filter` (red, upper case as the reference)
  const kicker = panel(page).locator(".cv-float-kicker");
  await expect(kicker).toHaveText("Filter");
  expect(await kicker.evaluate((n) => [getComputedStyle(n).textTransform, getComputedStyle(n).color])).toEqual([
    "uppercase",
    "rgb(215, 38, 34)",
  ]);
  await expect(search(page)).toBeVisible();
  await expect(search(page)).toHaveAttribute("placeholder", "Suchen nach Objekten");
  const add = panel(page).getByRole("button", { name: "Filter hinzufügen" });
  await expect(add).toBeVisible();
  await expect(add).toHaveText("Filter hinzufügen");
  expect(await add.locator("svg path").first().getAttribute("d"), "the `+` icon before the text").toBe(
    "M12 5v14M5 12h14",
  );
  // status: the same Y as the status line (all elements, nothing filtered)
  await expect(panelStatus(page)).toHaveText(`${de(FZK_TOTAL)} von ${de(FZK_TOTAL)} Objekten sichtbar`);
  await expect(status(page)).toHaveText(`${de(FZK_TOTAL)} von ${de(FZK_TOTAL)} Elementen`);
  await expect(panel(page).getByRole("button", { name: "Zurücksetzen" })).toBeHidden();
  // order top to bottom: head (kicker), search, `+ Filter hinzufügen`, status
  const tops = await Promise.all(
    [kicker, search(page), add, panelStatus(page)].map(async (l) => (await l.boundingBox()).y),
  );
  expect([...tops].sort((a, b) => a - b)).toEqual(tops);
  // no `Kategorie` / `Datei` chips (CR-002 8)
  await expect(panel(page).getByRole("button", { name: /^(Kategorie|Datei)/ })).toHaveCount(0);
  // second click closes
  await tool(page, "Filter").click();
  await expect(panel(page)).toBeHidden();
  await expect(tool(page, "Filter")).toHaveAttribute("aria-pressed", "false");
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-012-AC7 the search filters 250 ms after the last keystroke to the elements with a value containing the text in any letter case; clearing returns all", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  const TEXT = "ext-erdg";
  const ref = guidsWithText(FZK, TEXT);
  expect(ref.products, "the four ground-floor exterior walls").toHaveLength(4);
  expect(ref.propertyLines).toBe(12);
  const expected = (await keysOfGuids(page, ref.products)).sort();
  expect(expected.every(Boolean)).toBe(true);
  // the walls' Pset values with the text belong to the same walls: an independent scan of the extracted values
  const scanned = await page.evaluate((needle) => {
    const has = (v) => (Array.isArray(v) ? v.some(has) : typeof v === "string" && v.toLowerCase().includes(needle));
    return window.__calc.rows
      .filter((r) => Object.values(r.values).some(has))
      .map((r) => r.key)
      .sort();
  }, TEXT);
  expect(scanned).toEqual(expected);

  await tool(page, "Filter").click();
  await expect(panelStatus(page)).toHaveText(`${de(FZK_TOTAL)} von ${de(FZK_TOTAL)} Objekten sichtbar`);
  // record the time of every keystroke (input event) in the page
  await search(page).evaluate((input) => {
    window.__lastInput = 0;
    input.addEventListener("input", () => (window.__lastInput = performance.now()));
  });
  const before = await page.evaluate(() => ({
    updates: window.__calc.filter.updates,
    table: window.__calc.table.updates,
  }));
  await search(page).pressSequentially(TEXT, { delay: 40 });
  // 200 ms after the last keystroke: table and status line unchanged
  const at200 = await page.evaluate(async () => {
    while (performance.now() < window.__lastInput + 200) await new Promise((r) => setTimeout(r, 5));
    return {
      late: performance.now() - window.__lastInput,
      updates: window.__calc.filter.updates,
      table: window.__calc.table.updates,
      status: document.getElementById("cv-status").textContent,
    };
  });
  expect(at200.late, "sampled before the debounce ends").toBeLessThan(250);
  expect(at200.updates).toBe(before.updates);
  expect(at200.table).toBe(before.table);
  expect(at200.status).toBe(`${de(FZK_TOTAL)} von ${de(FZK_TOTAL)} Elementen`);
  // within 750 ms after it: exactly the four walls in table, status line and 3D
  await page.waitForFunction((n) => window.__calc.filter.updates > n, before.updates);
  await idle(page);
  const timing = await page.evaluate(() => ({
    filter: window.__calc.filter.at - window.__lastInput,
    table: window.__calc.table.at - window.__lastInput,
    view: window.CalcView.lastAppliedAt() - window.__lastInput,
  }));
  console.log(
    `[REQ-012-AC7] last keystroke -> filter ${timing.filter.toFixed(0)} ms, table ${timing.table.toFixed(0)} ms, 3D ${timing.view.toFixed(0)} ms`,
  );
  expect(timing.filter).toBeGreaterThanOrEqual(250);
  for (const [what, ms] of Object.entries(timing)) expect(ms, what).toBeLessThanOrEqual(750);
  expect(await page.evaluate(() => [...window.__calc.filter.keys].sort())).toEqual(expected);
  expect(await page.evaluate(() => [...window.__calc.table.keys].sort())).toEqual(expected);
  await expect(status(page)).toHaveText(`4 von ${de(FZK_TOTAL)} Elementen`);
  await expect(panelStatus(page)).toHaveText(`4 von ${de(FZK_TOTAL)} Objekten sichtbar`);
  expect((await viewState(page)).opaque).toEqual(expected);
  // upper case finds the same elements
  await search(page).fill(TEXT.toUpperCase());
  await expect(status(page)).toHaveText(`4 von ${de(FZK_TOTAL)} Elementen`);
  expect(await page.evaluate(() => [...window.__calc.filter.keys].sort())).toEqual(expected);
  // cleared: all elements return
  await search(page).fill("");
  await expect(status(page)).toHaveText(`${de(FZK_TOTAL)} von ${de(FZK_TOTAL)} Elementen`);
  await expect(panelStatus(page)).toHaveText(`${de(FZK_TOTAL)} von ${de(FZK_TOTAL)} Objekten sichtbar`);
  expect(await page.evaluate(() => window.__calc.table.count)).toBe(FZK_TOTAL);
  expect((await viewState(page)).ghost).toEqual([]);
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-005-AC10 hint pill for 6 s after loading (or until the first press on the canvas); title chip `Haus`, with a second model `2 Modelle`", async ({
  page,
}) => {
  const errors = await openBuilder(page);
  const dialog = await openHeaderDialog(page);
  await dialog.locator("#cv-hdr-title").fill("Haus");
  await dialog.getByRole("button", { name: "Übernehmen" }).click();
  await expect(dialog).toBeHidden();
  const hint = page.locator("#cv-hint");
  const chip = page.locator("#cv-title-chip");
  await expect(hint).toBeHidden(); // no model yet
  await loadFiles(page, FZK);
  const loadedAt = Date.now(); // the hint starts when the load finishes, at or before this point
  await expect(hint).toBeVisible();
  await expect(hint).toHaveText(HINT);
  // the hint sits above the toolbar, centred
  const [h, bar] = await Promise.all([hint.boundingBox(), toolbar(page).boundingBox()]);
  expect(h.y + h.height).toBeLessThanOrEqual(bar.y);
  expect(Math.abs(h.x + h.width / 2 - (bar.x + bar.width / 2))).toBeLessThanOrEqual(1);
  // title chip at the top left of the 3D view: the title only, no `Modelle`
  await expect(chip).toBeVisible();
  await expect(chip).toHaveText("Haus");
  await expect(chip).not.toContainText("Modelle");
  const [c, box] = await Promise.all([chip.boundingBox(), page.locator("#cv-canvas-box").boundingBox()]);
  expect(Math.round(c.x - box.x)).toBe(16);
  expect(Math.round(c.y - box.y)).toBe(16);
  // still shown 5 s after the load, gone 6 s (+ 0.6 s fade) after it
  await page.waitForTimeout(Math.max(0, loadedAt + 5000 - Date.now()));
  await expect(hint).toBeVisible();
  await page.waitForTimeout(Math.max(0, loadedAt + 6800 - Date.now()));
  await expect(hint).toBeHidden();
  // a second model: `2 Modelle`
  await loadFiles(page, DUPLEX);
  await expect(chip).toContainText("Haus");
  await expect(chip.locator(".cv-title-chip-sub")).toHaveText("2 Modelle");
  await expect(hint).toBeHidden(); // shown once only
  expect(errors).toEqual([]);

  // the first pointer press on the canvas hides it before the 6 s
  await page.reload();
  await page.waitForFunction(() => window.__calc && window.__calc.phase === "ready", null, { timeout: 60_000 });
  await loadFiles(page, FZK);
  await expect(hint).toBeVisible();
  const canvas = await page.locator("#cv-viewport canvas").boundingBox();
  await page.mouse.move(canvas.x + 30, canvas.y + 30);
  await page.mouse.down();
  await page.mouse.up();
  await expect(hint).toBeHidden({ timeout: 1500 });
  // the default title (first model's Modell) is shown when none is set
  await expect(chip).toHaveText("AC20-FZK-Haus");
});

test("@e2e toolbar `Fokus` / `Filter` / `Färben` as the reference: round glass bar bottom centre, panels exclude each other, `Filter` dot while a search is active", async ({
  page,
}) => {
  const errors = await openBuilder(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(toolbar(page)).toBeHidden(); // no model
  await loadFiles(page, FZK);
  await idle(page);
  // exactly three buttons, each with title and aria-label
  const buttons = await toolbar(page)
    .getByRole("button")
    .evaluateAll((list) => list.map((b) => [b.title, b.getAttribute("aria-label"), b.offsetWidth, b.offsetHeight]));
  expect(buttons).toEqual([
    ["Fokus", "Fokus", 40, 40],
    ["Filter", "Filter", 40, 40],
    ["Färben", "Färben", 40, 40],
  ]);
  // bottom centre of the 3D view, 20 px from the bottom, round glass
  const [bar, box] = await Promise.all([toolbar(page).boundingBox(), page.locator("#cv-canvas-box").boundingBox()]);
  expect(Math.round(box.y + box.height - (bar.y + bar.height))).toBe(20);
  expect(Math.abs(bar.x + bar.width / 2 - (box.x + box.width / 2))).toBeLessThanOrEqual(1);
  expect(Math.round(bar.height)).toBe(54);
  const look = await toolbar(page).evaluate((n) => {
    const s = getComputedStyle(n);
    return [s.backgroundColor, s.borderTopLeftRadius];
  });
  expect(look).toEqual(["rgba(255, 255, 255, 0.86)", "999px"]);
  // `Filter` then `Färben`: the filter panel closes, `Färben` is pressed; the panel is 380 px wide above the bar
  await tool(page, "Filter").click();
  const p = await panel(page).boundingBox();
  expect(Math.round(p.width)).toBe(380);
  expect(Math.round(box.y + box.height - (p.y + p.height))).toBe(80);
  await tool(page, "Färben").click();
  await expect(panel(page)).toBeHidden();
  await expect(page.locator("#cv-colour-panel")).toBeVisible();
  await expect(page.locator("#cv-colour-panel .cv-float-kicker")).toHaveText("Färben");
  await expect(tool(page, "Färben")).toHaveAttribute("aria-pressed", "true");
  await expect(tool(page, "Filter")).toHaveAttribute("aria-pressed", "false");
  // pressed: red fill, white icon (after the 0.15 s transition)
  await page.mouse.move(0, 0);
  await expect
    .poll(() => tool(page, "Färben").evaluate((n) => [getComputedStyle(n).backgroundColor, getComputedStyle(n).color]))
    .toEqual(["rgb(215, 38, 34)", "rgb(255, 255, 255)"]);
  await tool(page, "Färben").click();
  await expect(page.locator("#cv-colour-panel")).toBeHidden();
  // the `Filter` dot and the panel `Zurücksetzen` exist exactly while a search text is active
  const dot = () =>
    tool(page, "Filter").evaluate(
      (n) => getComputedStyle(n, "::after").content !== "none" && getComputedStyle(n, "::after").content !== "",
    );
  expect(await dot()).toBe(false);
  await tool(page, "Filter").click();
  await search(page).fill("wand");
  await expect(panel(page).getByRole("button", { name: "Zurücksetzen" })).toBeVisible();
  expect(await dot()).toBe(true);
  // panel `Zurücksetzen` clears the search text only: a checked filter-set value stays
  await toggleValue(page, "Kategorie", "IfcWallStandardCase");
  await panel(page).getByRole("button", { name: "Zurücksetzen" }).click();
  await expect(search(page)).toHaveValue("");
  await expect(panel(page).getByRole("button", { name: "Zurücksetzen" })).toBeHidden();
  expect(await dot()).toBe(false);
  expect(await page.evaluate(() => window.__calc.filter.search)).toBe("");
  expect(await page.evaluate(() => window.__calc.filter.active.map((f) => f.id))).toEqual(["Kategorie"]);
  // `Esc` with nothing selected closes the panel and returns the focus to `Filter`
  await search(page).focus();
  await page.keyboard.press("Escape");
  await expect(panel(page)).toBeHidden();
  await expect(tool(page, "Filter")).toBeFocused();
  expect(errors).toEqual([]);
});

test("@e2e pill `Filter entfernen`: shown while a filter source is active, first in the pill stack; it resets everything; `Filter anzeigen` opens the panel; the properties panel ends above it", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  const pill = page.locator("#cv-pill-filter");
  await expect(pill).toBeHidden();
  // a left filter-set value is a filter source (REQ-004): the pill appears
  await toggleValue(page, "Kategorie", "IfcWallStandardCase");
  await expect(pill).toBeVisible();
  expect(await page.locator("#cv-pills > :not([hidden])").first().getAttribute("id")).toBe("cv-pill-filter");
  const main = pill.getByRole("button", { name: "Filter entfernen" });
  await expect(main).toHaveAttribute("title", "Alle Filter entfernen");
  // bottom right of the 3D view (16 px from the right, 20 px from the bottom)
  const [pb, box] = await Promise.all([
    page.locator("#cv-pills").boundingBox(),
    page.locator("#cv-canvas-box").boundingBox(),
  ]);
  expect(Math.round(box.x + box.width - (pb.x + pb.width))).toBe(16);
  expect(Math.round(box.y + box.height - (pb.y + pb.height))).toBe(20);
  // the properties panel's height limit follows the pill stack (--cv-pills-h)
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.getElementById("cv-canvas-box")).getPropertyValue("--cv-pills-h").trim(),
    ),
  ).toBe(`${Math.round(pb.height)}px`);
  // `Filter anzeigen` opens the panel (closed before)
  await expect(panel(page)).toBeHidden();
  await pill.getByRole("button", { name: "Filter anzeigen" }).click();
  await expect(panel(page)).toBeVisible();
  // a search, a checked filter-set value and hide mode: the main button clears every source like
  // `Alle Filter zurücksetzen` (User answer Q9); the ghost toggle is unchanged
  await search(page).fill("erdg");
  await expect(status(page)).not.toHaveText(`${de(FZK_TOTAL)} von ${de(FZK_TOTAL)} Elementen`);
  await pill.locator("#cv-ghost-toggle").click();
  await main.click();
  await expect(status(page)).toHaveText(`${de(FZK_TOTAL)} von ${de(FZK_TOTAL)} Elementen`);
  await expect(search(page)).toHaveValue("");
  expect(await page.evaluate(() => window.__calc.filter.active)).toEqual([]);
  await expect(pill).toBeHidden();
  expect(await page.evaluate(() => window.__calc.view.mode)).toBe("hide");
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.getElementById("cv-canvas-box")).getPropertyValue("--cv-pills-h").trim(),
    ),
  ).toBe("0px");
  // a search alone shows the pill too
  await search(page).fill("erdg");
  await expect(pill).toBeVisible();
  expect(errors).toEqual([]);
});

test("@e2e @robustness search text with HTML is text only: nothing is added to the DOM or run, umlauts match in any case", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  await page.evaluate(() => (window.__xss = 0));
  await tool(page, "Filter").click();
  for (const text of ["<img src=x onerror=window.__xss++>", "<script>window.__xss++</script>"]) {
    await search(page).fill(text);
    await expect(status(page)).toHaveText(`0 von ${de(FZK_TOTAL)} Elementen`);
    await expect(panelStatus(page)).toHaveText(`0 von ${de(FZK_TOTAL)} Objekten sichtbar`);
    expect(await page.locator("#cv-canvas-box img, #cv-canvas-box script").count()).toBe(0);
  }
  expect(await page.evaluate(() => window.__xss)).toBe(0);
  // umlauts: the rows with a value containing `ö` (any case) are found with `Ö` too (expected from the rows, scanned here)
  const expected = await page.evaluate(() => {
    const has = (v) => (Array.isArray(v) ? v.some(has) : typeof v === "string" && v.toLowerCase().includes("ö"));
    return window.__calc.rows.filter((r) => Object.values(r.values).some(has)).length;
  });
  expect(expected).toBeGreaterThan(0);
  await search(page).fill("Ö");
  await expect(status(page)).toHaveText(`${de(expected)} von ${de(FZK_TOTAL)} Elementen`);
  await search(page).fill("ö");
  await expect(status(page)).toHaveText(`${de(expected)} von ${de(FZK_TOTAL)} Elementen`);
  expect(errors).toEqual([]);
});
