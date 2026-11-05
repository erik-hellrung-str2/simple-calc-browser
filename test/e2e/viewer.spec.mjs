// TASK-009 offline viewer file (spec REQ-010-AC1..AC3, REQ-011-AC1 viewer part, NFR-005, T3 system, T4 "build ->
// export HTML -> colleague adjusts and exports CSV", T7 robustness of the export). The builder exports through
// `HTML exportieren` (download); the downloaded file is opened via file:// in a NEW browser context that is offline and
// aborts every routable request, and every request the page makes is logged (test/support/viewer.mjs). Expected
// counts come from test/fixtures/reference-values.json (REQ-008-export, REQ-006-grouping-fzk; STEP-text derivation);
// "the exported state" and "the builder's CSV" (REQ-010) are the builder's own state and files for the same actions.
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { test, expect } from "../support/network-guard.mjs";
import { REF, fixture, loadFiles, openBuilder, removeModel } from "../support/builder.mjs";
import { addFilterSet, filterSet, toggleValue } from "../support/filter-area.mjs";
import { colourBy, idle, setGhosts } from "../support/view-3d.mjs";
import { addColumn, clickSort, headerKeys } from "../support/table.mjs";
import { pickGroup, setView, toggleGroup } from "../support/grouping.mjs";
import { chooseLogo, configuredState, openHeaderDialog } from "../support/config.mjs";
import { exportFile, readExport } from "../support/export.mjs";
import { exportViewer, nonBackgroundShare, openViewerFile, withoutExportTime } from "../support/viewer.mjs";
import { anyPickable, cutAt } from "../support/tools.mjs";

const FZK = fixture("AC20-FZK-Haus.ifc");
const DUPLEX = fixture("Ifc2x3_Duplex_Architecture.ifc");
const EXPORT_IFC = fixture("fzk-export.ifc");
const LOGO_SVG = fixture("logo-test.svg");
const EXP = REF["REQ-008-export"].single;
const NUMBER = EXP.properties.number; // CalcTest_Export.Zahl
const TEXT = EXP.properties.text; // CalcTest_Export.Text
const fzkGroups = REF["REQ-006-grouping-fzk"];
const WALL = "IfcWallStandardCase";
// the floating properties panel (CR-002) is an overlay like the view bar
const CANVAS_ONLY = {
  style:
    "#cv-overlay, #cv-view-bar, #cv-legend, #cv-props, #cv-pick, #cv-section-handle, #cv-title-chip, #cv-hint, #cv-toolbar, #cv-filter-panel, #cv-colour-panel, #cv-pills { visibility: hidden !important; }",
};
const modell = (path) => basename(path).replace(/\.[^.]*$/, "");
const deDate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("de-DE", { timeZone: "UTC" });
};
const dataUrl = (path, mime) => `data:${mime};base64,${readFileSync(path).toString("base64")}`;

test.describe.configure({ timeout: 300_000 });

/** Sets title and date (and optionally a logo file) through the header dialog `Titel, Datum und Logo`. */
async function editHeader(page, { title, date, logo }) {
  const dialog = await openHeaderDialog(page);
  if (title !== undefined) await dialog.locator("#cv-hdr-title").fill(title);
  if (date !== undefined) await dialog.locator("#cv-hdr-date").fill(date);
  if (logo) await chooseLogo(page, dialog, logo);
  await dialog.getByRole("button", { name: "Übernehmen" }).click();
  await expect(dialog).toBeHidden();
}

/** Everything a viewer must reproduce from the builder: configured state, rows, catalogue, table order, header. */
async function shownState(page) {
  await idle(page);
  const state = await configuredState(page);
  const extra = await page.evaluate(() => ({
    models: window.__calc.models.map((m) => ({ id: m.id, name: m.name, modell: m.modell, elements: m.elements })),
    modelCount: window.__calc.modelCount,
    rows: window.__calc.rows,
    catalog: window.__calc.catalog,
    tableKeys: window.__calc.table.keys,
    tableCount: window.__calc.table.count,
    groups: window.__calc.table.groups,
    config: window.CalcConfig.state(),
    status: document.getElementById("cv-status").textContent,
    title: document.getElementById("cv-title").textContent,
    date: document.getElementById("cv-date").textContent,
    logo: document.querySelector("#cv-logo img")?.getAttribute("src") ?? null,
    sets: [...document.querySelectorAll("#cv-filtersets .cv-fs-title")].map((n) => n.textContent),
    headers: [...document.querySelectorAll(".cv-th")].map((n) => n.dataset.key),
  }));
  return { ...state, ...extra };
}

/** The same view in the builder and in the viewer: fzk-export + Duplex, filtered, configured, header set. */
async function configureView(page) {
  await loadFiles(page, [EXPORT_IFC, DUPLEX]);
  await idle(page);
  await editHeader(page, { title: "The M Bouwkundig", date: "2026-08-12", logo: LOGO_SVG });
  // a section: `Schneiden` in the click menu of an element (TASK-017c; was the interim 1.0.0 `Schnitt Z`); Esc then
  // clears the selection the click made, so builder and viewer show the same canvas
  await cutAt(page, await anyPickable(page));
  await page.keyboard.press("Escape");
  // filter sets: one added and moved up, Material collapsed, Kategorie = IfcWallStandardCase
  await addFilterSet(page, "Typ", "Typ");
  await page.getByRole("button", { name: "Filtersatz nach oben: Typ" }).click();
  await page.getByRole("button", { name: "Filtersatz einklappen: Material" }).click();
  for (const v of EXP.filter.Kategorie) await toggleValue(page, "Kategorie", v);
  // columns, sort, model display (hide, colour by Geschoss; the section is set above)
  await addColumn(page, "Material", "Material");
  await addColumn(page, "CalcTest_Export", NUMBER);
  await clickSort(page, NUMBER);
  await setGhosts(page, false);
  await colourBy(page, "Geschoss", "Geschoss");
  await idle(page);
}

test("@acceptance @system @e2e @REQ-010-AC1 @REQ-011-AC1 @NFR-005 exported viewer file opens via file:// with all network blocked in the exported state and makes no request", async ({
  page,
  browser,
}, info) => {
  const errors = await openBuilder(page);
  await configureView(page);
  const builder = await shownState(page);
  expect(builder.filterCount).toBe(EXP.rows.length); // 69 walls of fzk-export + Duplex (reference)
  const builderCanvas = await page.locator("#cv-viewport canvas").screenshot(CANVAS_ONLY);

  const file = await exportViewer(page, info.outputPath("viewer.html"));
  expect(file.fileName).toBe("The M Bouwkundig_2026-08-12.html");
  expect(file.last).toMatchObject({ ok: true, fileName: file.fileName, models: 2, bytes: file.bytes.length });
  // one self-contained file: no external resource reference, generator meta with the library versions
  const html = file.bytes.toString("utf8");
  expect(html).toContain(
    '<meta name="generator" content="Calc Viewer Builder (That Open Fragments 3.4.7, three 0.185.1, web-ifc 0.0.77)">',
  );
  expect(html).toContain("<title>The M Bouwkundig</title>");
  expect(html).not.toMatch(/\b(src|href)\s*=\s*["']?(https?:|\/\/)/i);
  expect(html).not.toMatch(/https?:\/\/cdn\.jsdelivr/);
  // the builder state is unchanged by the export
  expect(await shownState(page)).toEqual(builder);

  const viewer = await openViewerFile(browser, file.path);
  try {
    const v = viewer.page;
    expect(new URL(v.url()).protocol).toBe("file:");
    expect(await v.evaluate(() => window.__calc.error)).toBeNull();
    expect(await v.evaluate(() => window.__calc.mode)).toBe("viewer");
    expect(await v.evaluate(() => window.__calc.versions)).toEqual({
      fragments: "3.4.7",
      three: "0.185.1",
      webIfc: "0.0.77",
    });
    await expect(v).toHaveTitle("The M Bouwkundig");
    // model, filter sets and table in the exported state (every configured part, rows, catalogue, 3D state)
    const shown = await shownState(v);
    expect(shown).toEqual(builder);
    expect(shown.sets).toEqual(["Kategorie", "Geschoss", "Typ", "Material"]);
    expect(shown.tableCount).toBe(EXP.rows.length);
    await expect(filterSet(v, "Material").locator(".cv-fs-body")).toBeHidden();
    await expect(filterSet(v, "Kategorie").getByRole("checkbox", { name: WALL, exact: true })).toBeChecked();
    await expect(v.locator("#cv-status")).toHaveText(
      `${EXP.rows.length} von ${builder.rows.length.toLocaleString("de-DE")} Elementen`,
    );
    await expect(v.locator(".cv-tr:not([hidden])").first()).toBeVisible();
    await expect(v.locator("#cv-overlay")).toBeHidden();
    // REQ-011-AC1 viewer part: title, date and logo in the header
    await expect(v.locator("#cv-title")).toHaveText("The M Bouwkundig");
    await expect(v.locator("#cv-date")).toHaveText(deDate("2026-08-12"));
    await expect(v.locator("#cv-logo img")).toHaveAttribute("src", dataUrl(LOGO_SVG, "image/svg+xml"));
    // the model is drawn: the canvas shows geometry, as the builder's does
    const viewerCanvas = await v.locator("#cv-viewport canvas").screenshot(CANVAS_ONLY);
    expect(await nonBackgroundShare(v, viewerCanvas)).toBeGreaterThan(0.01);
    expect(await nonBackgroundShare(page, builderCanvas)).toBeGreaterThan(0.01);
    // NFR-005: no network request at all
    expect(viewer.requests).toEqual([]);
    expect(viewer.blocked).toEqual([]);
    expect(viewer.errors).toEqual([]);
    console.log(
      `[viewer] ${file.fileName}: ${file.bytes.length} bytes, export ${file.last.ms.toFixed(0)} ms, open ${viewer.loadMs} ms`,
    );
  } finally {
    await viewer.context.close();
  }
  expect(errors).toEqual([]);
});

test("@acceptance @e2e @REQ-010-AC2 @REQ-011-AC1 colleague changes filters, filter sets, columns, grouping and model display in the viewer file and exports: CSV and Excel equal the builder's", async ({
  page,
  browser,
}, info) => {
  const errors = await openBuilder(page);
  await loadFiles(page, [EXPORT_IFC, DUPLEX]);
  await idle(page);
  await editHeader(page, { title: "The M Bouwkundig", date: "2026-08-12" });
  const exported = await shownState(page);
  const file = await exportViewer(page, info.outputPath("viewer.html"));
  const viewer = await openViewerFile(browser, file.path);
  try {
    const v = viewer.page;
    expect(await shownState(v)).toEqual(exported);

    /** The same actions in builder and viewer; returns the files of both exports and the state. */
    const steps = {
      async filters(p) {
        for (const value of EXP.filter.Kategorie) await toggleValue(p, "Kategorie", value);
        await addFilterSet(p, "Typ", "Typ");
        await p.getByRole("button", { name: "Filtersatz nach oben: Typ" }).click();
        await p.getByRole("button", { name: "Filtersatz entfernen: Material" }).click();
      },
      async columns(p) {
        await addColumn(p, "Material", "Material");
        await addColumn(p, "CalcTest_Export", NUMBER);
        await addColumn(p, "CalcTest_Export", TEXT);
        await p.locator("#cv-columns").click();
        const dialog = p.getByRole("dialog", { name: "Spalten" });
        await dialog.getByRole("button", { name: "Spalte nach links: Material" }).click();
        await dialog.getByRole("button", { name: "Schließen" }).click();
        await clickSort(p, NUMBER);
        await clickSort(p, NUMBER);
      },
      async grouping(p) {
        await setView(p, "Gruppiert");
        await pickGroup(p, 2, "Geschoss", "Geschoss");
        await toggleGroup(p, [WALL], true);
      },
      async display(p) {
        await setGhosts(p, false); // CR-002: ghost toggle in the pill `Filter entfernen` (TASK-015a)
        await colourBy(p, "Material", "Material");
        await idle(p);
      },
    };
    const results = {};
    for (const [name, p] of [
      ["builder", page],
      ["viewer", v],
    ]) {
      await steps.filters(p);
      await steps.columns(p);
      const single = await exportFile(p, "csv", info.outputPath(`${name}-single.csv`));
      await steps.grouping(p);
      await steps.display(p);
      const csv = await exportFile(p, "csv", info.outputPath(`${name}-grouped.csv`));
      const xlsx = await exportFile(p, "xlsx", info.outputPath(`${name}-grouped.xlsx`));
      results[name] = { single, csv, xlsx, state: await shownState(p) };
    }
    const { builder, viewer: colleague } = results;
    // the viewer followed every action as the builder did
    expect(colleague.state).toEqual(builder.state);
    expect(colleague.state.sets).toEqual(["Kategorie", "Geschoss", "Typ"]);
    expect(await headerKeys(v)).toEqual(await headerKeys(page));
    expect(colleague.state.grouping).toEqual({ view: "grouped", groupBy: ["Kategorie", "Geschoss"] });
    expect(colleague.state.view.mode).toBe("hide");
    // files: same names (REQ-011-AC1: `<Titel>_<Datum>.csv`), same bytes
    expect(colleague.single.fileName).toBe("The M Bouwkundig_2026-08-12.csv");
    expect(colleague.csv.fileName).toBe("The M Bouwkundig_2026-08-12.csv");
    expect(colleague.xlsx.fileName).toBe("The M Bouwkundig_2026-08-12.xlsx");
    expect(colleague.single.bytes.equals(builder.single.bytes)).toBe(true);
    expect(colleague.csv.bytes.equals(builder.csv.bytes)).toBe(true);
    expect(colleague.xlsx.bytes.equals(builder.xlsx.bytes)).toBe(true);
    // and the content is the expected one (independent reader; counts from the reference)
    const single = readExport("csv", colleague.single.path);
    expect(single.records.length - 1).toBe(EXP.rows.length);
    const grouped = readExport("csv", colleague.csv.path);
    const wallRow = grouped.records.find((r) => r[0] === "1" && r[1] === WALL);
    const fzkWalls = fzkGroups.byKategorie[WALL].count;
    expect(Number(wallRow[2])).toBe(EXP.rows.length);
    expect(fzkWalls).toBeLessThan(EXP.rows.length);
    expect(grouped.records.at(-1).slice(0, 3)).toEqual(["Summe", "", String(EXP.rows.length)]);
    const book = readExport("xlsx", colleague.xlsx.path);
    expect(book.rows.length).toBe(grouped.records.length);

    // changes are not persisted: reopening shows the exported state (REQ-010)
    await v.reload();
    await v.waitForFunction(() => window.__calc && window.__calc.phase === "ready");
    expect(await shownState(v)).toEqual(exported);
    expect(viewer.requests).toEqual([]);
    expect(viewer.errors).toEqual([]);
  } finally {
    await viewer.context.close();
  }
  expect(errors).toEqual([]);
});

test("@acceptance @e2e @REQ-010-AC3 the viewer file has no controls for loading IFC, saving / loading configuration or exporting HTML", async ({
  page,
  browser,
}, info) => {
  const errors = await openBuilder(page);
  await loadFiles(page, FZK);
  await idle(page);
  // the builder has them
  for (const name of ["IFC laden", "Konfiguration speichern", "Konfiguration laden", "HTML exportieren"])
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  const file = await exportViewer(page, info.outputPath("viewer.html"));
  const viewer = await openViewerFile(browser, file.path);
  try {
    const v = viewer.page;
    for (const name of [
      "IFC laden",
      "Konfiguration speichern",
      "Konfiguration laden",
      "HTML exportieren",
      "Titel, Datum und Logo bearbeiten",
      `Modell entfernen: ${modell(FZK)}`,
    ])
      await expect(v.getByRole("button", { name, exact: true })).toHaveCount(0);
    await expect(v.locator("input[type=file]")).toHaveCount(0);
    await expect(v.getByRole("checkbox", { name: "Räume (IfcSpace) einbeziehen" })).toHaveCount(0);
    expect(await v.evaluate(() => typeof window.CalcConfig.loadText)).toBe("undefined");
    // what the viewer offers (REQ-003..REQ-008): filter sets, columns, grouping, model display, CSV / Excel
    for (const name of ["Export CSV", "Export Excel"])
      await expect(v.getByRole("button", { name, exact: true })).toBeEnabled();
    await expect(v.locator("#cv-add-filterset")).toBeEnabled();
    await expect(v.locator("#cv-columns")).toBeEnabled();
    await expect(v.getByRole("radio", { name: "Gruppiert", exact: true })).toBeEnabled();
    // CR-002 (TASK-015a): the model display is the 3D toolbar `Fokus` / `Filter` / `Färben` and the pill ghost toggle
    for (const name of ["Fokus", "Filter", "Färben"])
      await expect(
        v.getByRole("toolbar", { name: "3D-Werkzeuge" }).getByRole("button", { name, exact: true }),
      ).toBeEnabled();
    // selection and properties panel (REQ-007): a table row click selects the element in 3D and shows its GlobalId
    const row = v.locator(".cv-tbl-body .cv-tr[data-key]:not([hidden])").first();
    const key = await row.getAttribute("data-key");
    await row.click();
    await expect.poll(() => v.evaluate(() => window.__calc.view.selected)).toBe(key);
    const guid = await v.evaluate((k) => window.__calc.rows.find((r) => r.key === k).guid, key);
    await expect(v.locator("#cv-props")).toContainText(guid);
    expect(await v.evaluate(() => [...window.CalcView.state().selected])).toEqual([key]);
    // a file dropped on the viewer is ignored (no IFC or configuration loading)
    const before = await v.evaluate(() => ({ loads: window.__calc.loads, models: window.__calc.modelCount }));
    await v.evaluate(() => {
      const dt = new DataTransfer();
      dt.items.add(new File(["ISO-10303-21;"], "neu.ifc"));
      dt.items.add(new File(['{"schema":"calc-viewer-config/1"}'], "k.json"));
      const app = document.querySelector(".cv-app");
      app.dispatchEvent(new DragEvent("dragover", { dataTransfer: dt, bubbles: true, cancelable: true }));
      app.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
    });
    await v.waitForTimeout(500);
    expect(await v.evaluate(() => ({ loads: window.__calc.loads, models: window.__calc.modelCount }))).toEqual(before);
    expect(await v.evaluate(() => window.__calc.config.loads)).toBe(0);
    expect(viewer.requests).toEqual([]);
    expect(viewer.errors).toEqual([]);
  } finally {
    await viewer.context.close();
  }
  expect(errors).toEqual([]);
});

test("@robustness @e2e @REQ-010 `HTML exportieren` needs a model: disabled before the first and after the last model is removed", async ({
  page,
}) => {
  const errors = await openBuilder(page);
  const button = page.getByRole("button", { name: "HTML exportieren", exact: true });
  await expect(button).toBeDisabled();
  await expect(button).toHaveAttribute("title", "Zuerst ein IFC-Modell laden.");
  await loadFiles(page, FZK);
  await expect(button).toBeEnabled();
  await expect(button).toHaveAttribute(
    "title",
    "Modelle, Daten und aktuelle Ansicht als Offline-Viewer (HTML) exportieren",
  );
  await removeModel(page, modell(FZK));
  await expect(button).toBeDisabled();
  // the seam refuses as well: no file without a model
  expect(await page.evaluate(() => window.__calc.viewerExport)).toEqual({ count: 0, last: null });
  expect(errors).toEqual([]);
});

test("@robustness @e2e @REQ-010 viewer starts in the grouping view with filters active; two exports in a row are equal except the export time", async ({
  page,
  browser,
}, info) => {
  const errors = await openBuilder(page);
  await loadFiles(page, FZK);
  await idle(page);
  await toggleValue(page, "Geschoss", "Erdgeschoss");
  await setView(page, "Gruppiert");
  await pickGroup(page, 2, "Geschoss", "Geschoss");
  await toggleGroup(page, [WALL], true); // the expanded state is not part of the view (REQ-009)
  await idle(page);
  const builder = await shownState(page);
  const a = await exportViewer(page, info.outputPath("a.html"));
  const b = await exportViewer(page, info.outputPath("b.html"));
  const ta = a.bytes.toString("utf8");
  const tb = b.bytes.toString("utf8");
  expect(ta).toMatch(/<meta name="cv-exported" content="\d{4}-\d{2}-\d{2}T[^"]+">/);
  expect(withoutExportTime(ta)).toBe(withoutExportTime(tb));
  expect(a.fileName).toBe(b.fileName);

  const viewer = await openViewerFile(browser, a.path);
  try {
    const v = viewer.page;
    const shown = await shownState(v);
    // expanded groups are not exported: compare everything else, and the groups start collapsed
    const strip = (s) => ({ ...s, tableKeys: undefined, tableCount: undefined });
    expect(strip(shown)).toEqual(strip(builder));
    expect(shown.grouping).toEqual({ view: "grouped", groupBy: ["Kategorie", "Geschoss"] });
    expect(shown.sets[0]).toBe("Kategorie");
    const groundWalls = fzkGroups.byKategorie[WALL].byGeschoss.Erdgeschoss.count;
    const wallGroup = await v.evaluate(
      (w) => window.__calc.table.display.find((r) => r.type === "group" && r.level === 1 && r.value === w),
      WALL,
    );
    expect(wallGroup).toMatchObject({ count: groundWalls, expanded: false });
    expect(viewer.requests).toEqual([]);
    expect(viewer.errors).toEqual([]);
  } finally {
    await viewer.context.close();
  }
  expect(errors).toEqual([]);
});

test("@robustness @e2e @REQ-010 @REQ-011 very long title with HTML characters and an SVG logo with script: file name, <title> and header safe, the script never runs", async ({
  page,
  browser,
}, info) => {
  const errors = await openBuilder(page);
  await loadFiles(page, FZK);
  await idle(page);
  // 200 characters (the title limit), with markup, quotes and a closing script tag. ASCII only: headless Chromium
  // reports any download name with a non-ASCII character as "download" (TASK-009 open point), whatever the product
  // offers; non-ASCII text in the header is covered by the TASK-007 tests.
  const title = ('Mengen </script><b onmouseover="x">&amp; "Ausbau" ' + "x".repeat(200)).slice(0, 200);
  const svg = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20" onload="window.parent.__svgRan=1">' +
      '<script>window.__svgRan = 1; top.__svgRan = 1;</script><rect width="40" height="20" fill="#d72622"/></svg>',
  );
  const dialog = await openHeaderDialog(page);
  await dialog.locator("#cv-hdr-title").fill(title);
  await dialog.locator("#cv-hdr-date").fill("2026-08-12");
  await chooseLogo(page, dialog, { name: "script.svg", mimeType: "image/svg+xml", buffer: svg });
  await dialog.getByRole("button", { name: "Übernehmen" }).click();
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => window.__calc.header.title)).toBe(title);

  const file = await exportViewer(page, info.outputPath("viewer.html"));
  expect(file.fileName).toBe(file.last.fileName);
  expect(file.fileName).toMatch(/_2026-08-12\.html$/);
  expect(file.fileName).not.toMatch(/[<>:"/\\|?*]/);
  const html = file.bytes.toString("utf8");
  // the title appears only escaped: one closing script tag per script element, no injected element
  const scripts = (html.match(/<script\b/g) || []).length;
  expect((html.match(/<\/script>/g) || []).length).toBe(scripts);
  expect(html).not.toContain("<b onmouseover");
  expect(html).toContain("<title>Mengen &#60;/script&#62;&#60;b onmouseover=&#34;x&#34;&#62;&#38;amp;");

  const viewer = await openViewerFile(browser, file.path);
  try {
    const v = viewer.page;
    await expect(v).toHaveTitle(title);
    await expect(v.locator("#cv-title")).toHaveText(title);
    await expect(v.locator("#cv-title b")).toHaveCount(0);
    await expect(v.locator("#cv-logo img")).toHaveAttribute(
      "src",
      `data:image/svg+xml;base64,${svg.toString("base64")}`,
    );
    await expect
      .poll(() => v.locator("#cv-logo img").evaluate((img) => img.complete && img.naturalWidth > 0))
      .toBe(true);
    expect(await v.evaluate(() => window.__svgRan)).toBeUndefined();
    // CSV export of the viewer is named after the title (characters not allowed in file names replaced)
    const csv = await exportFile(v, "csv", info.outputPath("viewer.csv"));
    expect(csv.fileName).toBe(file.fileName.replace(/\.html$/, ".csv"));
    expect(viewer.requests).toEqual([]);
    expect(viewer.errors).toEqual([]);
  } finally {
    await viewer.context.close();
  }
  expect(await page.evaluate(() => window.__svgRan)).toBeUndefined();
  expect(errors).toEqual([]);
});

test("@e2e @REQ-010 @REQ-011 while the viewer starts it shows the exported title, no empty filter sets or model list, no .ifc file name", async ({
  page,
  browser,
}, info) => {
  // verification INC-1 UX minor 3: the start showed `Calc Viewer Builder`, "Keine Modelle geladen.", empty default
  // filter sets and the progress `AC20-FZK-Haus.ifc - Anzeige`
  const errors = await openBuilder(page);
  await loadFiles(page, FZK);
  await idle(page);
  const file = await exportViewer(page, info.outputPath("viewer.html"));
  const viewer = await openViewerFile(browser, file.path, {
    initScript: () => {
      window.__startLog = [];
      new MutationObserver(() => {
        const calc = window.__calc;
        // the start: before the payload's models are published (modelCount still 0)
        if (!calc || calc.phase === "ready" || calc.modelCount > 0) return;
        const title = document.getElementById("cv-title");
        const area = document.getElementById("cv-filter-area");
        const models = document.getElementById("cv-models");
        window.__startLog.push({
          title: title ? title.textContent : null,
          filtersShown: area ? getComputedStyle(area).visibility === "visible" : false,
          modelsShown: models ? getComputedStyle(models).visibility === "visible" : false,
          progress: calc.progress ? calc.progress.file : null,
        });
      }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
    },
  });
  try {
    const v = viewer.page;
    const log = await v.evaluate(() => window.__startLog);
    expect(log.length, "states recorded during the start").toBeGreaterThan(0);
    for (const entry of log) {
      if (entry.title !== null) expect(entry.title).toBe(modell(FZK));
      expect(entry.filtersShown).toBe(false);
      expect(entry.modelsShown).toBe(false);
      if (entry.progress !== null) expect(entry.progress).toBe(modell(FZK));
    }
    // ready: everything shown
    await expect(v.locator("#cv-title")).toHaveText(modell(FZK));
    await expect(v.locator("#cv-filter-area")).toBeVisible();
    await expect(v.locator("#cv-models")).toBeVisible();
    expect(viewer.errors).toEqual([]);
  } finally {
    await viewer.context.close();
  }
  expect(errors).toEqual([]);
});
