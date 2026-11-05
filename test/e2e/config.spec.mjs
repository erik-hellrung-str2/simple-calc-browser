// TASK-007 header and configuration (spec REQ-011 title / date / logo, REQ-009 save and load, REQ-009-AC1..AC3, T7
// robustness of configuration files). Everything goes through the UI: the header dialog `Titel, Datum und Logo`,
// `Konfiguration speichern` (download) and `Konfiguration laden` (file input); the state is read from the seams
// (CalcTable, CalcView.state(), window.__calc). Expected properties and values come from
// test/fixtures/reference-values.json (sections REQ-007-selection and REQ-009-config, STEP-text derivation); the
// error-class files and logos are the committed fixtures of scripts/make-config-fixtures.mjs.
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { test, expect } from "../support/network-guard.mjs";
import { REF, fixture, loadFiles, openBuilder, removeModel } from "../support/builder.mjs";
import { addFilterSet, filterSet, setTitles, toggleValue } from "../support/filter-area.mjs";
import { colourBy, colourPanel, colourTool, idle, openColourPanel, setGhosts } from "../support/view-3d.mjs";
import { addColumn, checkColumnValue, clickSort, header, typeBound } from "../support/table.mjs";
import { pickGroup, setView } from "../support/grouping.mjs";
import {
  chooseLogo,
  configFile,
  configuredState,
  loadConfig,
  openHeaderDialog,
  saveConfig,
} from "../support/config.mjs";
import { anyPickable, cutAt } from "../support/tools.mjs";
import { configErrorFixtures } from "../../scripts/make-config-fixtures.mjs";

const FZK = fixture("AC20-FZK-Haus.ifc");
const DUPLEX = fixture("Ifc2x3_Duplex_Architecture.ifc");
const LOGO_PNG = fixture("logo-test.png");
const LOGO_SVG = fixture("logo-test.svg");
const SEL = REF["REQ-007-selection"];
const CFG = REF["REQ-009-config"];
const VOLUME = REF["REQ-006-grouping-fzk"].column; // BaseQuantities.NetVolume
const GROUND = SEL.subGroup.Geschoss;
/** Modell = file name without extension (REQ-001). */
const modell = (path) => basename(path).replace(/\.[^.]*$/, "");
/** German date as the UI shows dates (de-DE). */
const deDate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("de-DE", { timeZone: "UTC" });
};
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const dataUrl = (path, mime) => `data:${mime};base64,${readFileSync(path).toString("base64")}`;
const MESSAGES = {
  "invalid-json": "Die Datei ist kein gültiges JSON.",
  "not-a-config": "Die Datei ist keine Calc-Viewer-Konfiguration.",
  "unsupported-version": (n) => `Konfigurationsversion ${n} wird nicht unterstützt.`,
};

test.describe.configure({ timeout: 240_000 });

async function openWith(page, files) {
  const errors = await openBuilder(page);
  await loadFiles(page, files);
  await idle(page);
  return errors;
}

/** Sets title and date (and optionally a logo file) through the header dialog. */
async function editHeader(page, { title, date, logo }) {
  const dialog = await openHeaderDialog(page);
  if (title !== undefined) await dialog.locator("#cv-hdr-title").fill(title);
  if (date !== undefined) await dialog.locator("#cv-hdr-date").fill(date);
  if (logo) await chooseLogo(page, dialog, logo);
  await dialog.getByRole("button", { name: "Übernehmen" }).click();
  await expect(dialog).toBeHidden();
}

const notices = (page) => page.locator("#cv-messages .cv-message.cv-notice .cv-message-text");
const errorMessages = (page) => page.locator("#cv-messages .cv-message:not(.cv-notice):not(.cv-ok) .cv-message-text");
const okMessages = (page) => page.locator("#cv-messages .cv-message.cv-ok .cv-message-text");

test("@e2e @acceptance @REQ-011-AC1 header: default title and date, title / date / PNG and SVG logo set in the dialog, wrong and too large logos refused", async ({
  page,
}, testInfo) => {
  const errors = await openBuilder(page);
  // before a model: the app name, today; `Konfiguration laden` needs a model
  await expect(page.locator("#cv-title")).toHaveText("Calc Viewer Builder");
  await expect(page.locator("#cv-date")).toHaveText(deDate(todayIso()));
  await expect(page.getByRole("button", { name: "Konfiguration laden", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "HTML exportieren", exact: true })).toBeDisabled();
  await loadFiles(page, FZK);
  // REQ-011 default title: the first model's Modell value
  await expect(page.locator("#cv-title")).toHaveText(modell(FZK));
  await expect(page.getByRole("button", { name: "Konfiguration laden", exact: true })).toBeEnabled();

  await editHeader(page, { title: "The M Bouwkundig", date: "2026-08-12", logo: LOGO_PNG });
  await expect(page.locator("#cv-title")).toHaveText("The M Bouwkundig");
  await expect(page.locator("#cv-date")).toHaveText(deDate("2026-08-12"));
  const logo = page.locator("#cv-logo img");
  await expect(logo).toHaveAttribute("src", dataUrl(LOGO_PNG, "image/png"));
  // the image is embedded and decoded (48 x 24 fixture), shown at header height
  expect(await logo.evaluate((img) => [img.complete, img.naturalWidth, img.naturalHeight])).toEqual([true, 48, 24]);
  expect((await logo.boundingBox()).height).toBeLessThanOrEqual(36);
  expect(await page.evaluate(() => window.CalcConfig.header())).toEqual({
    title: "The M Bouwkundig",
    date: "2026-08-12",
    logo: dataUrl(LOGO_PNG, "image/png"),
  });
  // the saved configuration carries all three; its file name follows the export rule (REQ-008, REQ-011)
  const saved = await saveConfig(page);
  expect(saved.fileName).toBe("The M Bouwkundig_2026-08-12_Konfiguration.json");
  expect(saved.json.header).toEqual({
    title: "The M Bouwkundig",
    date: "2026-08-12",
    logo: dataUrl(LOGO_PNG, "image/png"),
  });

  // SVG logo (XML declaration and comment before <svg>)
  await editHeader(page, { logo: LOGO_SVG });
  await expect(logo).toHaveAttribute("src", dataUrl(LOGO_SVG, "image/svg+xml"));
  expect(await logo.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);

  // refused: a PDF named .png, a PNG over the size limit; the logo stays, the dialog names the file
  let dialog = await openHeaderDialog(page);
  await chooseLogo(page, dialog, {
    name: "plan.png",
    mimeType: "image/png",
    buffer: readFileSync(fixture("error-renamed-pdf.ifc")),
  });
  await expect(dialog.locator("#cv-hdr-error")).toHaveText("plan.png ist kein PNG-, JPG- oder SVG-Bild.");
  const big = Buffer.concat([readFileSync(LOGO_PNG), Buffer.alloc(1024 * 1024 + 1)]);
  const bigPath = testInfo.outputPath("gross.png");
  writeFileSync(bigPath, big);
  await chooseLogo(page, dialog, bigPath);
  await expect(dialog.locator("#cv-hdr-error")).toContainText("Das Logo gross.png ist zu groß");
  await expect(dialog.locator("#cv-hdr-error")).toContainText("Erlaubt sind höchstens 1 MB.");
  // a cancelled file dialog changes nothing
  await dialog.locator("#cv-hdr-logo").setInputFiles([]);
  await dialog.getByRole("button", { name: "Übernehmen" }).click();
  await expect(logo).toHaveAttribute("src", dataUrl(LOGO_SVG, "image/svg+xml"));

  // Abbrechen keeps everything; `Logo entfernen` and empty fields return to the defaults
  dialog = await openHeaderDialog(page);
  await dialog.locator("#cv-hdr-title").fill("Verworfen");
  await dialog.getByRole("button", { name: "Abbrechen" }).click();
  await expect(page.locator("#cv-title")).toHaveText("The M Bouwkundig");
  dialog = await openHeaderDialog(page);
  await dialog.locator("#cv-hdr-title").fill("");
  await dialog.locator("#cv-hdr-date").fill("");
  await dialog.getByRole("button", { name: "Logo entfernen" }).click();
  await dialog.getByRole("button", { name: "Übernehmen" }).click();
  await expect(page.locator("#cv-title")).toHaveText(modell(FZK));
  await expect(page.locator("#cv-date")).toHaveText(deDate(todayIso()));
  await expect(page.locator("#cv-logo img")).toHaveCount(0);
  await expect(page.locator("#cv-logo svg")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-009-AC1 @REQ-003-AC2 @REQ-006-AC6 save, reload, load the same IFC and the configuration, save again: equal JSON covering every field", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  // section: `Schneiden` in the click menu of an element (TASK-017c; was the 1.0.0 `Schnitt Z` flipped); Esc clears
  // the selection the click made
  await cutAt(page, await anyPickable(page));
  await page.keyboard.press("Escape");
  // header
  await editHeader(page, { title: 'Mengen <Rohbau> & "Ausbau"', date: "2026-08-12", logo: LOGO_SVG });
  // filter sets: add one, move Material up, collapse Geschoss, check values (OR within, AND across)
  await addFilterSet(page, "Typ", "Typ");
  await filterSet(page, "Material").locator(".cv-fs-up").click();
  await toggleValue(page, "Kategorie", SEL.group.Kategorie);
  await toggleValue(page, "Kategorie", "IfcSlab");
  await toggleValue(page, "Geschoss", GROUND);
  await filterSet(page, "Geschoss").locator(".cv-fs-toggle").click();
  // columns: add the volume, move it, resize Name; column filters: Name values, volume range; sort descending
  await addColumn(page, "NetVolume", VOLUME);
  await addColumn(page, "Typ", "Typ");
  const handle = header(page, "Name").locator(".cv-th-resize");
  await handle.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await checkColumnValue(page, "Name", SEL.wall.Name);
  await page.keyboard.press("Escape");
  await typeBound(page, VOLUME, "min", "0,5");
  await page.keyboard.press("Escape");
  await clickSort(page, VOLUME);
  await clickSort(page, VOLUME);
  // grouping: Kategorie, then Geschoss
  await setView(page, "Gruppiert");
  await pickGroup(page, 2, "Geschoss", "Geschoss");
  // model display: hide, colour by Material (the section is set above)
  await setGhosts(page, false);
  await colourBy(page, "Material", "Material");
  await idle(page);

  const before = await configuredState(page);
  const first = await saveConfig(page);
  // the configuration covers every REQ-009 field, none of them at its default
  const c = first.json;
  expect(c.schema).toBe("calc-viewer-config/1");
  expect(c.header).toEqual({
    title: 'Mengen <Rohbau> & "Ausbau"',
    date: "2026-08-12",
    logo: dataUrl(LOGO_SVG, "image/svg+xml"),
  });
  expect(c.filterSets.map((s) => s.key)).toEqual(["Kategorie", "Material", "Geschoss", "Typ"]);
  expect(c.filterSets.find((s) => s.key === "Geschoss")).toEqual({
    key: "Geschoss",
    collapsed: true,
    selected: [GROUND],
  });
  expect(c.filterSets.find((s) => s.key === "Kategorie").selected).toEqual([SEL.group.Kategorie, "IfcSlab"]);
  expect(c.table.columns.map((col) => col.key)).toEqual(["Modell", "Kategorie", "Name", "Geschoss", VOLUME, "Typ"]);
  expect(c.table.columns).toEqual(before.table.columns);
  expect(c.table.sort).toEqual({ key: VOLUME, dir: "desc" });
  expect(c.table.columnFilters).toEqual(before.table.columnFilters);
  expect(c.table.columnFilters.map((f) => [f.key, f.type])).toEqual([
    ["Name", "values"],
    [VOLUME, "range"],
  ]);
  expect(c.table.columnFilters[1]).toEqual({ key: VOLUME, type: "range", min: 0.5, max: null });
  expect([c.table.view, c.table.groupBy]).toEqual(["grouped", ["Kategorie", "Geschoss"]]);
  expect(c.display.mode).toBe("hide");
  expect(c.display.colourBy).toBe("Material");
  // TASK-012 / TASK-017c (CR-002, DEC-20): the section is saved as `display.sectionPlane` = the click section's plane
  // as state().section reports it (spec 4.4), never as `display.section` (was: display.section equal to the 1.0.0
  // axis section, then the plane of the flipped Z section)
  expect(before.threeD.section).not.toBeNull();
  expect(before.view.section).toEqual(before.threeD.section);
  expect(c.display.sectionPlane).toEqual(before.threeD.section);
  expect("section" in c.display).toBe(false);
  // no element references, no expanded state, no selection (REQ-009)
  expect(first.text).not.toMatch(/"m\d+:\d+"|expanded|selected(Key|Group)/);

  // reload, load the same IFC: the defaults are back
  await page.reload();
  await page.waitForFunction(() => window.__calc && window.__calc.phase === "ready", null, { timeout: 60_000 });
  await loadFiles(page, FZK);
  await idle(page);
  expect(await setTitles(page)).toEqual(["Kategorie", "Geschoss", "Material"]);
  const result = await loadConfig(page, configFile(first.text, first.fileName));
  expect(result).toMatchObject({ ok: true, notice: null });
  await idle(page);
  await expect(notices(page)).toHaveCount(0);
  await expect(errorMessages(page)).toHaveCount(0);
  await expect(okMessages(page)).toHaveText([`Konfiguration ${first.fileName} geladen.`]);
  const after = await configuredState(page);
  expect(after).toEqual(before);
  // the UI follows: header, set order and collapsed state, grouping controls, display controls
  await expect(page.locator("#cv-title")).toHaveText('Mengen <Rohbau> & "Ausbau"');
  await expect(page.locator("#cv-date")).toHaveText(deDate("2026-08-12"));
  await expect(page.locator("#cv-logo img")).toHaveAttribute("src", dataUrl(LOGO_SVG, "image/svg+xml"));
  expect(await setTitles(page)).toEqual(["Kategorie", "Material", "Geschoss", "Typ"]);
  // CR-002 (TASK-015a): the display mode is the ghost toggle in the pill `Filter entfernen` (REQ-005-AC1)
  await expect(page.locator("#cv-ghost-toggle")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#cv-ghost-toggle")).toHaveAccessibleName("Ausgeblendete anzeigen");
  await expect(page.getByRole("radio", { name: "Gruppiert" })).toHaveAttribute("aria-checked", "true");
  // CR-002 (TASK-016): colouring is shown by the pill `Einfärbung entfernen` and the colouring panel (was: the 1.0.0
  // control `Färben nach: Material`)
  await expect(page.locator("#cv-pill-colour")).toBeVisible();
  await openColourPanel(page);
  await expect(colourPanel(page).locator("#cv-colour-param .cv-suggest-label")).toHaveText("Material");
  await colourTool(page).click();
  // the section: the pill `Schnitt entfernen` and the handle (CR-002, TASK-017c; was the radio `Schnitt Z`)
  await expect(page.locator("#cv-pill-section")).toBeVisible();
  await expect(page.getByRole("button", { name: "Schnitt verschieben" })).toBeVisible();
  const second = await saveConfig(page);
  expect(second.text).toBe(first.text);
  expect(second.fileName).toBe(first.fileName);
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-009-AC2 @robustness configuration saved with two models, loaded with one: values and properties of the missing model are named, the rest applied", async ({
  page,
}) => {
  const errors = await openWith(page, [FZK, DUPLEX]);
  await addFilterSet(page, "Modell", "Modell");
  await toggleValue(page, "Modell", modell(FZK));
  await toggleValue(page, "Modell", modell(DUPLEX));
  await toggleValue(page, "Kategorie", CFG.present.Kategorie);
  await toggleValue(page, "Kategorie", CFG.absentKategorie);
  await addFilterSet(page, CFG.absentProperty.split(".")[1], CFG.absentProperty);
  await addColumn(page, CFG.absentProperty.split(".")[1], CFG.absentProperty);
  await setView(page, "Gruppiert");
  await pickGroup(page, 2, CFG.absentProperty.split(".")[1], CFG.absentProperty);
  const saved = await saveConfig(page);
  expect(saved.json.filterSets.map((s) => s.key)).toContain(CFG.absentProperty);

  await page.reload();
  await page.waitForFunction(() => window.__calc && window.__calc.phase === "ready", null, { timeout: 60_000 });
  await loadFiles(page, FZK);
  await idle(page);
  const result = await loadConfig(page, configFile(saved.text));
  expect(result.ok).toBe(true);
  expect(result.skipped.properties).toEqual([CFG.absentProperty]);
  // in the order of the filter sets (Kategorie is a default set, Modell was added)
  expect(result.skipped.values).toEqual([
    { key: "Kategorie", value: CFG.absentKategorie },
    { key: "Modell", value: modell(DUPLEX) },
  ]);
  // the notice names the property and both values
  await expect(notices(page)).toHaveCount(1);
  const text = await notices(page).textContent();
  expect(text).toContain("Konfiguration geladen. Nicht angewendet:");
  expect(text).toContain(CFG.absentProperty);
  expect(text).toContain(`Kategorie = ${CFG.absentKategorie}`);
  expect(text).toContain(`Modell = ${modell(DUPLEX)}`);
  // the rest is applied: Modell and Kategorie sets with the present values, grouping level 1, the other columns
  const state = await configuredState(page);
  expect(state.sets.map((s) => s.key)).toEqual(["Kategorie", "Geschoss", "Material", "Modell"]);
  expect(state.sets.find((s) => s.key === "Kategorie").selected).toEqual([CFG.present.Kategorie]);
  expect(state.sets.find((s) => s.key === "Modell").selected).toEqual([modell(FZK)]);
  expect(state.filterCount).toBe(CFG.present.elementsInFzk);
  expect(state.grouping).toEqual({ view: "grouped", groupBy: ["Kategorie"] });
  expect(state.table.columns.map((c) => c.key)).toEqual(["Modell", "Kategorie", "Name", "Geschoss"]);
  // the notice can be closed
  await page.locator("#cv-messages .cv-notice .cv-message-close").click();
  await expect(notices(page)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-009-AC3 @robustness one file per error class: its message, the view unchanged, a later save equals the earlier one", async ({
  page,
}, testInfo) => {
  const errors = await openWith(page, FZK);
  await toggleValue(page, "Kategorie", SEL.group.Kategorie);
  await setView(page, "Gruppiert");
  await editHeader(page, { title: "Vorher", date: "2026-01-31" });
  const before = await saveConfig(page);
  const stateBefore = await configuredState(page);

  const cases = Object.entries(configErrorFixtures()).map(([name, meta]) => ({
    file: fixture(name),
    errorClass: meta.errorClass,
    message:
      typeof MESSAGES[meta.errorClass] === "function"
        ? MESSAGES[meta.errorClass](meta.version)
        : MESSAGES[meta.errorClass],
  }));
  // robustness: a file over the size limit is not read at all
  const huge = testInfo.outputPath("riesig.json");
  writeFileSync(huge, Buffer.alloc(25 * 1024 * 1024, 0x20));
  cases.push({ file: huge, errorClass: "too-large", message: /^Die Datei ist zu groß für eine Konfiguration/ });
  // robustness: empty file and a JSON array
  cases.push({ file: configFile("", "leer.json"), errorClass: "invalid-json", message: MESSAGES["invalid-json"] });
  cases.push({
    file: configFile("[1,2]", "array.json"),
    errorClass: "not-a-config",
    message: MESSAGES["not-a-config"],
  });

  for (const c of cases) {
    const result = await loadConfig(page, c.file);
    expect(result.ok, String(c.file.name || c.file)).toBe(false);
    expect(result.errorClass).toBe(c.errorClass);
    // each load replaces the messages of the one before (verification INC-1 UX minor 1): one message, this one
    await expect(errorMessages(page)).toHaveCount(1);
    await expect(errorMessages(page)).toHaveText(c.message);
    expect(await configuredState(page)).toEqual(stateBefore);
  }
  await expect(notices(page)).toHaveCount(0);
  const after = await saveConfig(page);
  expect(after.text).toBe(before.text);
  // a cancelled file dialog does nothing
  const loads = await page.evaluate(() => window.__calc.config.loads);
  await page.locator("#cv-config-input").setInputFiles([]);
  expect(await page.evaluate(() => window.__calc.config.loads)).toBe(loads);
  expect(errors).toEqual([]);
});

test("@e2e @robustness tolerant load: 100,000 missing property keys in filter sets, columns and column filters apply in linear time", async ({
  page,
}) => {
  // verification INC-1 CODE F2: each missing key was looked up in a list (quadratic): 160,000 keys took 17 s
  const errors = await openWith(page, FZK);
  const N = 100_000;
  const keys = (prefix) => Array.from({ length: N }, (_, i) => `${prefix}-${i}`);
  const config = {
    schema: "calc-viewer-config/1",
    filterSets: [...keys("satz-fehlt").map((key) => ({ key, collapsed: false, selected: [] })), { key: "Kategorie" }],
    table: {
      columns: [...keys("spalte-fehlt"), "Name"],
      columnFilters: keys("filter-fehlt").map((key) => ({ key, type: "values", values: ["x"] })),
    },
  };
  const text = JSON.stringify(config); // compact: about 9 MB, under CONFIG_MAX_BYTES
  expect(text.length).toBeLessThan(20 * 1024 * 1024);
  const result = await loadConfig(page, configFile(text));
  const ms = await page.evaluate(() => window.__calc.config.last.ms);
  expect(result.ok).toBe(true);
  expect(ms, "parse and apply of 300,000 missing property keys (ms)").toBeLessThan(5_000);
  expect(result.skipped.properties.length).toBe(3 * N);
  expect(result.skipped.properties.slice(0, 2)).toEqual(["satz-fehlt-0", "satz-fehlt-1"]);
  expect(result.skipped.properties.at(-1)).toBe(`filter-fehlt-${N - 1}`);
  const state = await configuredState(page);
  expect(state.sets.map((s) => s.key)).toEqual(["Kategorie"]);
  expect(state.table.columns.map((c) => c.key)).toEqual(["Name"]);
  await expect(notices(page)).toContainText("und " + (3 * N - 20).toLocaleString("de-DE") + " weitere");
  expect(errors).toEqual([]);
});

test("@e2e @robustness tolerant load: many missing values (notice capped), malformed and unknown entries, script strings as text, SVG logo without script, drop of a .json", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  const missing = Array.from({ length: 60000 }, (_, i) => `fehlt-${i}`);
  const svgWithScript =
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><script>window.__xss = 1</script>' +
    '<rect width="40" height="20" fill="#d72622" onload="window.__xss = 2"/></svg>';
  const config = {
    schema: "calc-viewer-config/1",
    zusatz: true,
    header: {
      title: '<img src=x onerror="window.__xss=3">',
      date: "2026-02-30",
      logo: "data:image/svg+xml;base64," + Buffer.from(svgWithScript).toString("base64"),
    },
    filterSets: [
      { key: "GlobalId", collapsed: false, selected: missing },
      { key: "Kategorie", collapsed: "nein", selected: [SEL.group.Kategorie, { x: 1 }] },
    ],
    table: { view: "kacheln", columns: [{ key: "Name", width: -5 }], sort: { key: "Name", dir: "auf" } },
    display: { mode: "hide", colourBy: 7, section: { axis: "Q", offset: 0 } },
  };
  const result = await loadConfig(page, configFile(config));
  const ms = await page.evaluate(() => window.__calc.config.last.ms);
  expect(result.ok).toBe(true);
  expect(ms, "parse and apply of a 60,000-value configuration (ms)").toBeLessThan(5_000);
  expect(result.skipped.values.length).toBe(missing.length);
  expect(result.skipped.unknown).toEqual(["zusatz"]);
  expect(result.skipped.invalid).toEqual([
    "Datum",
    "Filtersatz Kategorie",
    "Tabellenansicht",
    "Sortierung",
    "Färben nach",
    "Schnitt",
  ]);
  const text = await notices(page).textContent();
  expect(text).toContain("und 59.980 weitere");
  expect(text).toContain("GlobalId = fehlt-0");
  expect(text).not.toContain("fehlt-20;");
  // valid parts applied
  const state = await configuredState(page);
  expect(state.sets.map((s) => [s.key, s.selected])).toEqual([
    ["GlobalId", []],
    ["Kategorie", [SEL.group.Kategorie]],
  ]);
  expect(state.filterCount).toBe(SEL.group.count);
  expect(state.view.mode).toBe("hide");
  expect(state.table.columns).toEqual([{ key: "Name", width: 60 }]);
  // strings from the file are text; the SVG logo is an <img> and runs no script
  await expect(page.locator("#cv-title")).toHaveText('<img src=x onerror="window.__xss=3">');
  await expect(page.locator(".cv-header img")).toHaveCount(1);
  await expect(page.locator("#cv-logo img")).toHaveAttribute("src", config.header.logo);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();

  // a dropped .json is loaded as configuration
  const before = await page.evaluate(() => window.__calc.config.loads);
  await page.evaluate(
    (json) => {
      const dt = new DataTransfer();
      dt.items.add(new File([json], "abgelegt.json", { type: "application/json" }));
      const target = document.querySelector(".cv-app");
      for (const type of ["dragover", "drop"])
        target.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }));
    },
    JSON.stringify({ schema: "calc-viewer-config/1", header: { title: "Abgelegt" } }),
  );
  await page.waitForFunction((n) => window.__calc.config.loads > n, before);
  await expect(page.locator("#cv-title")).toHaveText("Abgelegt");
  expect(await page.evaluate(() => window.__calc.loadErrors.length)).toBe(0);
  expect(errors).toEqual([]);
});

test("@robustness @REQ-009-AC2 loaded configuration: a range filter on a text column and grouping keys beyond two levels are named in the notice and skipped (TASK-007 C1, C2)", async ({
  page,
}) => {
  const errors = await openWith(page, [FZK]);
  const config = {
    schema: "calc-viewer-config/1",
    table: {
      view: "grouped",
      groupBy: ["Kategorie", "Geschoss", "Material", "Name"],
      columns: [
        { key: "Kategorie", width: 160 },
        { key: "Name", width: 240 },
        { key: VOLUME, width: 150 },
      ],
      sort: null,
      columnFilters: [
        { key: "Name", type: "range", min: 1, max: 2 },
        { key: VOLUME, type: "range", min: 0.5, max: null },
      ],
    },
  };
  const last = await loadConfig(page, configFile(config));
  expect(last.ok).toBe(true);
  expect(last.skipped.invalid).toEqual([
    "Gruppierung Material (höchstens 2 Ebenen)",
    "Gruppierung Name (höchstens 2 Ebenen)",
    "Spaltenfilter Name (Bereich auf einer Textspalte)",
  ]);
  await expect(notices(page)).toHaveCount(1);
  const notice = await notices(page).first().textContent();
  expect(notice).toContain("Ungültige Angaben: Gruppierung Material (höchstens 2 Ebenen); Gruppierung Name");
  expect(notice).toContain("Spaltenfilter Name (Bereich auf einer Textspalte)");
  // the valid parts are applied: two grouping levels, the numeric range filter only
  expect(await page.evaluate(() => window.CalcTable.grouping())).toEqual({
    view: "grouped",
    groupBy: ["Kategorie", "Geschoss"],
  });
  expect((await page.evaluate(() => window.CalcTable.state())).columnFilters).toEqual([
    { key: VOLUME, type: "range", min: 0.5, max: null },
  ]);
  expect(errors).toEqual([]);
});

test("@e2e @REQ-009 `Konfiguration speichern` is disabled without a model, like `Konfiguration laden` (TASK-007 C3)", async ({
  page,
}) => {
  const errors = await openBuilder(page);
  const save = page.getByRole("button", { name: "Konfiguration speichern", exact: true });
  const load = page.getByRole("button", { name: "Konfiguration laden", exact: true });
  for (const button of [save, load]) {
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute("title", "Zuerst ein IFC-Modell laden.");
  }
  await loadFiles(page, FZK);
  await idle(page);
  await expect(save).toBeEnabled();
  await expect(load).toBeEnabled();
  expect((await saveConfig(page)).fileName).toMatch(/_Konfiguration\.json$/);
  await removeModel(page, "AC20-FZK-Haus");
  await expect(save).toBeDisabled();
  await expect(load).toBeDisabled();
  expect(errors).toEqual([]);
});

/** Drops files ({ name, b64 } or { name, text }) on the builder as one drop. */
function dropFiles(page, files) {
  return page.evaluate((list) => {
    const dt = new DataTransfer();
    for (const f of list) {
      const body = f.b64 ? Uint8Array.from(atob(f.b64), (c) => c.charCodeAt(0)) : f.text;
      dt.items.add(new File([body], f.name));
    }
    const target = document.querySelector(".cv-app");
    for (const type of ["dragover", "drop"])
      target.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }));
  }, files);
}

test("@e2e @robustness @REQ-009 a configuration dropped during a load waits for every model of the load and of its own drop", async ({
  page,
}) => {
  // verification INC-1 CODE F3: while a load ran, the dropped IFC files were only queued and the configuration was
  // applied at once (refused with no model loaded, or checked against an incomplete model set)
  const errors = await openBuilder(page);
  const cfg = (title) =>
    JSON.stringify({
      schema: "calc-viewer-config/1",
      header: { title },
      filterSets: [{ key: "Modell", collapsed: false, selected: [modell(DUPLEX)] }],
    });
  // 1) IFC + configuration in one drop while another load runs
  await page.locator("#cv-file-input").setInputFiles(FZK);
  await page.waitForFunction(() => window.__calc.phase === "loading");
  await dropFiles(page, [
    { name: basename(DUPLEX), b64: readFileSync(DUPLEX).toString("base64") },
    { name: "abgelegt.json", text: cfg("Abgelegt") },
  ]);
  await page.waitForFunction(() => window.__calc.config.loads > 0, null, { timeout: 120_000 });
  const first = await page.evaluate(() => ({
    models: window.__calc.models.map((m) => m.name ?? m),
    modelCount: window.__calc.modelCount,
    last: window.__calc.config.last,
  }));
  expect(first.modelCount, "both models loaded when the configuration is applied").toBe(2);
  expect(first.last).toMatchObject({ ok: true, fileName: "abgelegt.json", notice: null });
  await expect(page.locator("#cv-title")).toHaveText("Abgelegt");
  expect((await configuredState(page)).sets.find((s) => s.key === "Modell").selected).toEqual([modell(DUPLEX)]);

  // 2) a configuration alone dropped while a load runs: applied after it (not refused for lack of a model)
  await page.locator("#cv-file-input").setInputFiles(fixture("fzk-feet.ifc"));
  await page.waitForFunction(() => window.__calc.phase === "loading");
  await dropFiles(page, [{ name: "zweite.json", text: cfg("Zweite") }]);
  await page.waitForFunction(() => window.__calc.config.loads > 1, null, { timeout: 120_000 });
  const second = await page.evaluate(() => ({ modelCount: window.__calc.modelCount, last: window.__calc.config.last }));
  expect(second.modelCount).toBe(3);
  expect(second.last).toMatchObject({ ok: true, fileName: "zweite.json" });
  await expect(page.locator("#cv-title")).toHaveText("Zweite");
  expect(errors).toEqual([]);
});

test("@e2e @REQ-009 configuration messages: a success notice; outdated messages go with the next load or the first model", async ({
  page,
}) => {
  // verification INC-1 UX minor 1: messages stayed after their cause was gone; a successful load gave no feedback
  const errors = await openBuilder(page);
  const cfg = (title) => JSON.stringify({ schema: "calc-viewer-config/1", header: { title } });
  await dropFiles(page, [{ name: "frueh.json", text: cfg("Früh") }]);
  await page.waitForFunction(() => window.__calc.config.loads > 0);
  await expect(errorMessages(page)).toHaveText(["Zum Laden einer Konfiguration zuerst ein IFC-Modell laden."]);
  await loadFiles(page, FZK);
  await expect(errorMessages(page)).toHaveCount(0);
  await loadConfig(page, configFile(cfg("Erste"), "erste.json"));
  await expect(okMessages(page)).toHaveText(["Konfiguration erste.json geladen."]);
  await loadConfig(page, configFile("{", "kaputt.json"));
  await expect(okMessages(page)).toHaveCount(0);
  await expect(errorMessages(page)).toHaveText([MESSAGES["invalid-json"]]);
  const withMissing = JSON.stringify({ schema: "calc-viewer-config/1", filterSets: [{ key: "Fehlt.Nicht" }] });
  await loadConfig(page, configFile(withMissing, "dritte.json"));
  await expect(errorMessages(page)).toHaveCount(0);
  await expect(notices(page)).toHaveCount(1);
  await expect(okMessages(page)).toHaveCount(0);
  await expect(page.locator("#cv-messages")).toHaveAttribute("role", "alert");
  expect(errors).toEqual([]);
});
