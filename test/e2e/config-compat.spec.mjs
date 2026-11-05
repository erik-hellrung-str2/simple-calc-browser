// TASK-018 (CR-002, INC-2): configuration files of 1.0.0 and 1.1.0 end to end through the UI (spec REQ-009-AC4..AC8,
// REQ-013-AC12, DEC-20, T13 migration, T7 every invalid case of the DEC-20 field table). Everything goes through
// `Konfiguration laden` / `Konfiguration speichern` (test/support/config.mjs), the filter panel, the properties panel
// and the click menu; the state is read from the seams (window.__calc, CalcView.state()).
// Expected values come from the spec (DEC-20 labels, defaults and conversions, the DEC-15 scale colours) and from
// test/fixtures/reference-values.json (REQ-009-rules, REQ-013-tools: derived from the STEP text by
// scripts/ref/derive-reference.mjs with the DEC-19 matching written there), never from the code under test. The
// configuration files are the committed CR-002 fixtures and the in-memory cases of scripts/make-config-fixtures.mjs.
// REQ-009-AC7 opens the 1.0.0 builder of tag `v1.0.0` (git show into test-cache/v1.0.0/, which is git-ignored).
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test, expect } from "../support/network-guard.mjs";
import { REF, fixture, loadFiles, openBuilder } from "../support/builder.mjs";
import { colourPanel, colourTool, idle, openColourPanel, viewState } from "../support/view-3d.mjs";
import { configFile, configuredState, loadConfig, saveConfig } from "../support/config.mjs";
import { addRule, keysOf, toolbar } from "../support/rules.mjs";
import { panelAction, shownPills, sourceEntries } from "../support/tools.mjs";
import { config110, configText, dec20InvalidCases } from "../../scripts/make-config-fixtures.mjs";

const FZK = fixture("AC20-FZK-Haus.ifc");
const RULES = REF["REQ-009-rules"];
const TOOLS = REF["REQ-013-tools"];
const CFG = REF["REQ-009-config"];
const wallGuid = (name) => TOOLS.walls.find((w) => w.Name === name).GlobalId;
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
// DEC-15 swatches (lower-case as written, DEC-20)
const BLAU = "#1f6fd1";
const GRUEN = "#2e9b4f";
const ROT = "#d72622";
/** The 25 colours of a DEC-15 scale of base (12 % tint .. full colour), lower-case hex (spec formula). */
function scaleColours(base) {
  const rgb = [1, 3, 5].map((at) => parseInt(base.slice(at, at + 2), 16));
  return Array.from({ length: 25 }, (_, k) => {
    const a = 0.12 + (0.88 * k) / 24;
    return (
      "#" +
      rgb
        .map((c) =>
          Math.round(255 + (c - 255) * a)
            .toString(16)
            .padStart(2, "0"),
        )
        .join("")
    );
  });
}
const EMPTY = "#c4c7ca"; // `(leer)` (DEC-15)
const MULTI = "#6e6259"; // `mehrere Werte` (DEC-15)
const NOTICE_HEAD = "Konfiguration geladen. Nicht angewendet:";

const notices = (page) => page.locator("#cv-messages .cv-message.cv-notice .cv-message-text");
const errorMessages = (page) => page.locator("#cv-messages .cv-message:not(.cv-notice):not(.cv-ok) .cv-message-text");
const okMessages = (page) => page.locator("#cv-messages .cv-message.cv-ok .cv-message-text");

test.describe.configure({ timeout: 240_000 });

async function openWith(page, files) {
  const errors = await openBuilder(page);
  await loadFiles(page, files);
  await idle(page);
  return errors;
}

/** Keys of the rows passing all filters, sorted. */
const filterKeys = (page) => page.evaluate(() => [...window.__calc.filter.keys].sort());

/**
 * Given state of REQ-009-AC5 / AC7 / REQ-013-AC12: the rules `Isolieren` · `Kategorie` · `Enthält` · `wall` and
 * `Markieren` · `Name` · `Enthält` · `ext`, the search text `erdg` (REQ-009-rules REQ-010-AC4: the 9 ground-floor
 * walls), `Wand-Int-ERDG-1` hidden and `Wand-Ext-ERDG-1` isolated through the properties panel (DEC-18: shown =
 * isolated minus hidden = 1 wall). Returns { hidden, isolated } keys.
 */
async function rulesSearchAndTools(page) {
  const ac4 = RULES["REQ-010-AC4"];
  for (const rule of ac4.rules) await addRule(page, rule);
  await page.getByRole("searchbox", { name: "Suchen nach Objekten" }).fill(ac4.search);
  await page.waitForFunction(
    ([text, n]) => window.__calc.filter.search === text && window.__calc.filter.count === n,
    [ac4.search, ac4.count],
  );
  await toolbar(page).getByRole("button", { name: "Filter", exact: true }).click();
  expect(await filterKeys(page)).toEqual(await keysOf(page, ac4.globalIds));
  const [hidden] = await keysOf(page, [wallGuid("Wand-Int-ERDG-1")]);
  const [isolated] = await keysOf(page, [wallGuid("Wand-Ext-ERDG-1")]);
  await panelAction(page, hidden, "hide");
  await page.keyboard.press("Escape");
  await panelAction(page, isolated, "isolate");
  await page.keyboard.press("Escape");
  await idle(page);
  const state = await configuredState(page);
  expect(state.tools).toEqual({ hidden: [hidden], isolated: [isolated] });
  expect(state.filterKeys).toEqual([isolated]);
  expect(await sourceEntries(page)).toEqual(expect.arrayContaining(["Ausgeblendet: 1 Element", "Isoliert: 1 Element"]));
  return { hidden, isolated };
}

/** No element is hidden or isolated: app sets, 3D tool-hidden set, filter-area entries and pills (DEC-18). */
async function expectNoTools(page) {
  const state = await configuredState(page);
  expect(state.tools).toEqual({ hidden: [], isolated: null });
  expect(state.threeD.toolHidden).toEqual([]);
  const entries = await sourceEntries(page);
  expect(entries.filter((e) => /^(Ausgeblendet|Isoliert):/.test(e))).toEqual([]);
  const pills = await shownPills(page);
  expect(pills).not.toContain("Isolierung entfernen");
  expect(pills).not.toContain("Ausblendung entfernen");
}

test("@e2e @acceptance @REQ-009-AC4 @robustness 1.0.0 configurations with an axis section Z at h and a numeric `colourBy`: no notice, plane {[0, 0, h], [0, 0, -1]} (flipped: [0, 0, 1]), `Farbskala` in `#1F6FD1`, saved as `display.sectionPlane` without `display.section`", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  const blue = scaleColours(BLAU);
  expect(blue[0]).toBe("#e4eef9"); // the spec's example of the 12 % tint
  for (const [file, flipped] of [
    ["config-1.0.0-axis-section.json", false],
    ["config-1.0.0-axis-section-flipped.json", true],
  ]) {
    const old = JSON.parse(readFileSync(fixture(file), "utf8"));
    const h = old.display.section.offset;
    expect(old.display.section).toEqual({ axis: "Z", offset: h, flipped });
    const last = await loadConfig(page, fixture(file));
    // no notice at all, so none names `display.section`
    expect(last).toMatchObject({ ok: true, notice: null });
    expect(last.skipped).toEqual({ properties: [], values: [], invalid: [], unknown: [] });
    await idle(page);
    await expect(notices(page)).toHaveCount(0);
    await expect(errorMessages(page)).toHaveCount(0);
    await expect(okMessages(page)).toHaveText([`Konfiguration ${file} geladen.`]);
    // DEC-20: point = 0 except the axis component = offset, normal = -axis (not flipped) or +axis (flipped)
    const plane = { point: [0, 0, h], normal: [0, 0, flipped ? 1 : -1] };
    const view = await viewState(page);
    expect(view.section).toEqual(plane);
    expect(await page.evaluate(() => window.__calc.view.section)).toEqual(plane);
    await expect(page.locator("#cv-pill-section")).toBeVisible();
    await expect(page.getByRole("button", { name: "Schnitt verschieben" })).toBeVisible();
    // `Farbskala` with `#1F6FD1` (DEC-20 absence defaults for a numeric colourBy): every colour on the Blau scale, the
    // largest volume the full colour
    const hook = await page.evaluate(() => window.__calc.view);
    expect([hook.colourKey, hook.colourMode, hook.scaleColour]).toEqual([old.display.colourBy, "scale", BLAU]);
    const colours = Object.values(view.colours).map((c) => c.toLowerCase());
    expect(colours.length).toBeGreaterThan(0);
    for (const c of colours) expect([...blue, EMPTY, MULTI]).toContain(c);
    expect(colours).toContain(BLAU);
    expect(colours).toContain("#e4eef9");
    await openColourPanel(page);
    const panel = colourPanel(page);
    await expect(panel.getByRole("button", { name: "Farbskala", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(panel.getByRole("button", { name: "Blau", exact: true })).toHaveAttribute("aria-pressed", "true");
    await colourTool(page).click();
    // saving writes display.sectionPlane and no display.section (DEC-20), and the 1.0.0 look as mode and colour
    const saved = await saveConfig(page);
    expect(saved.json.display).toEqual({
      mode: old.display.mode,
      colourBy: old.display.colourBy,
      colourMode: "scale",
      scaleColour: BLAU,
      sectionPlane: plane,
    });
    expect("section" in saved.json.display).toBe(false);
    expect(saved.text).not.toContain('"section"');
    // the rest of the file is applied: header, filter sets, columns
    expect(saved.json.header).toEqual(old.header);
    expect(saved.json.filterSets).toEqual(old.filterSets);
    expect(saved.json.table).toEqual(old.table);
  }
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-009-AC5 loading a configuration without `filterRules` and `search` (saved by 1.0.0) clears active rules, the search text, hidden and isolated elements and applies the rest", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  await rulesSearchAndTools(page);
  const file = "config-1.0.0-axis-section.json";
  const old = JSON.parse(readFileSync(fixture(file), "utf8"));
  expect("filterRules" in old || "search" in old).toBe(false);
  const last = await loadConfig(page, fixture(file));
  expect(last).toMatchObject({ ok: true, notice: null });
  await idle(page);
  const state = await configuredState(page);
  // no rule, no search text (filter, field, rule rows, filter-area entries)
  expect(state.rules).toEqual([]);
  expect(state.ruleRows).toEqual([]);
  expect([state.search, state.searchField]).toEqual(["", ""]);
  const entries = await sourceEntries(page);
  expect(entries.filter((e) => /^(Filterregeln|Suche):/.test(e))).toEqual([]);
  expect(state.threeD.marked).toEqual([]);
  // hidden and isolated elements cleared (DEC-20)
  await expectNoTools(page);
  // the rest applied: every row of the model passes (the file has no checked values), header, display, section
  expect(state.filterCount).toBe(TOOLS.rows);
  expect(state.header.title).toBe(old.header.title);
  expect(state.view.colourKey).toBe(old.display.colourBy);
  expect(state.threeD.section).toEqual({ point: [0, 0, old.display.section.offset], normal: [0, 0, -1] });
  expect(state.table.columns).toEqual(old.table.columns);
  await expect(page.locator("#cv-status")).toHaveText(`${TOOLS.rows} von ${TOOLS.rows} Elementen`);
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-009-AC6 @robustness a rule on a property absent from the loaded model and a malformed rule are skipped; the notice names the property and `Filterregel`; the valid rules apply in their order", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  const file = "config-1.1.0-rules-skipped.json";
  const raw = JSON.parse(readFileSync(fixture(file), "utf8"));
  // the fixture: a rule on the Duplex-only property and a rule with the unknown action `select` between valid rules
  expect(raw.filterRules.map((r) => [r.mode, r.key])).toEqual([
    ["isolate", "Kategorie"],
    ["hide", CFG.absentProperty],
    ["select", "Name"],
    ["hide", "Name"],
  ]);
  const last = await loadConfig(page, fixture(file));
  expect(last.ok).toBe(true);
  expect(last.skipped).toEqual({ properties: [CFG.absentProperty], values: [], invalid: ["Filterregel"], unknown: [] });
  await idle(page);
  await expect(notices(page)).toHaveCount(1);
  await expect(notices(page)).toHaveText(
    [
      NOTICE_HEAD,
      `Eigenschaften, die in den geladenen Modellen fehlen: ${CFG.absentProperty}.`,
      "Ungültige Angaben: Filterregel.",
    ].join("\n"),
  );
  const state = await configuredState(page);
  const ac6 = RULES["REQ-009-AC6"];
  expect(state.rules).toEqual(ac6.appliedRules);
  expect(state.ruleRows).toEqual(["Isolieren: Kategorie enthält „wall“", "Ausblenden: Name endet mit „-1“"]);
  expect(state.filterKeys).toEqual(await keysOf(page, ac6.globalIds));
  expect(state.filterCount).toBe(ac6.count);
  // the rest is applied
  expect(state.header.title).toBe(raw.header.title);
  expect(await sourceEntries(page)).toContain("Filterregeln: 2");
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-009-AC7 @REQ-013-AC12 @robustness hidden and isolated elements are never saved and are gone after reload + IFC + configuration; a 1.1.0 configuration with rules and a section loads in the 1.0.0 builder (tag v1.0.0) with a notice naming the five new fields", async ({
  page,
  browser,
}) => {
  const errors = await openWith(page, FZK);
  // a configuration with rules, a search text and a section (`Schneiden` is not needed: the plane of the fixture)
  await loadConfig(page, fixture("config-1.1.0-full.json"));
  await idle(page);
  const { hidden, isolated } = await rulesSearchAndTools(page);
  const guids = [wallGuid("Wand-Int-ERDG-1"), wallGuid("Wand-Ext-ERDG-1")];
  const saved = await saveConfig(page);
  // REQ-009-AC7 first part: no element keys and no field for hidden or isolated elements
  for (const k of [hidden, isolated, ...guids]) expect(saved.text).not.toContain(k);
  const names = [];
  const walk = (value) => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object")
      for (const [k, v] of Object.entries(value)) {
        names.push(k);
        walk(v);
      }
  };
  walk(saved.json);
  expect(names.filter((n) => /hidden|isolat|tool|keys|element/i.test(n))).toEqual([]);
  expect(Object.keys(saved.json)).toEqual([
    "schema",
    "header",
    "filterSets",
    "filterRules",
    "search",
    "table",
    "display",
  ]);
  expect(Object.keys(saved.json.display)).toEqual(["mode", "colourBy", "colourMode", "scaleColour", "sectionPlane"]);
  // it is a 1.1.0 configuration with rules and a section (the Given of the second part)
  expect(saved.json.filterRules.length).toBeGreaterThan(0);
  expect(saved.json.display.sectionPlane).toEqual(config110().display.sectionPlane);
  expect([saved.json.display.colourMode, saved.json.display.scaleColour]).toEqual(["scale", GRUEN]);

  // REQ-013-AC12: reload, the same IFC, the saved configuration: nothing hidden or isolated, the rest as saved
  await page.reload();
  await page.waitForFunction(() => window.__calc && window.__calc.phase === "ready", null, { timeout: 60_000 });
  await loadFiles(page, FZK);
  await idle(page);
  const last = await loadConfig(page, configFile(saved.text, saved.fileName));
  expect(last).toMatchObject({ ok: true, notice: null });
  await idle(page);
  await expectNoTools(page);
  const after = await configuredState(page);
  expect(after.rules).toEqual(saved.json.filterRules);
  expect(after.search).toBe(saved.json.search);
  expect(after.filterKeys).toEqual(await keysOf(page, RULES["REQ-010-AC4"].globalIds));
  expect((await saveConfig(page)).text).toBe(saved.text);

  // REQ-009-AC7 second part: the 1.0.0 builder (tag v1.0.0) loads the saved 1.1.0 file and the committed fixture
  const old = await openBuilder100(browser);
  try {
    const p = old.page;
    await loadFiles(p, FZK);
    await p.evaluate(() => window.CalcView.whenIdle());
    const NEW_FIELDS = ["filterRules", "search", "display.colourMode", "display.scaleColour", "display.sectionPlane"];
    for (const file of [
      configFile(saved.text, saved.fileName),
      configFile(readFileSync(fixture("config-1.1.0-full.json"), "utf8"), "config-1.1.0-full.json"),
    ]) {
      const json = JSON.parse(file.buffer.toString("utf8"));
      const result = await loadConfig(p, file);
      expect(result.ok, file.name).toBe(true);
      expect(result.skipped).toEqual({ properties: [], values: [], invalid: [], unknown: NEW_FIELDS });
      await expect(notices(p)).toHaveCount(1);
      const text = await notices(p).textContent();
      expect(text).toContain("Unbekannte Angaben: " + NEW_FIELDS.join("; ") + ".");
      await expect(errorMessages(p)).toHaveCount(0);
      // the rest is applied without error: header, filter sets, columns, colouring property; no rule, so the
      // element set is broader (every row of the model)
      const s = await p.evaluate(() => ({
        title: document.getElementById("cv-title").textContent,
        sets: window.__calc.filter.sets.map((x) => x.key),
        columns: window.CalcTable.state().columns.map((c) => c.key),
        colourKey: window.__calc.view.colourKey,
        count: window.__calc.filter.count,
        error: window.__calc.error,
      }));
      expect(s).toEqual({
        title: json.header.title,
        sets: json.filterSets.map((x) => x.key),
        columns: json.table.columns.map((c) => c.key),
        colourKey: json.display.colourBy,
        count: TOOLS.rows,
        error: null,
      });
    }
    expect(old.errors).toEqual([]);
    expect(old.blocked).toEqual([]);
  } finally {
    await old.context.close();
  }
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------------------------------------------
// REQ-009-AC8: one case per invalid entry of the DEC-20 field table (scripts/make-config-fixtures.mjs
// dec20InvalidCases(), each one field of the valid 1.1.0 configuration config110() changed). Expected effects per
// field from the DEC-20 field table.
// ---------------------------------------------------------------------------------------------------------------
const BASE = config110();
const BASE_PLANE = BASE.display.sectionPlane;
/** What DEC-20 says each invalid field turns into (the other fields stay as in config110()). */
function expectedEffect(c) {
  const out = {
    rules: BASE.filterRules,
    search: BASE.search,
    colourMode: BASE.display.colourMode,
    scaleColour: BASE.display.scaleColour,
    section: BASE_PLANE,
  };
  if (c.name === "filterRules-not-a-list") out.rules = []; // no rule applied
  if (c.name === "search-not-text") out.search = ""; // treated as ""
  // colourMode invalid: treated as absent -> `scale` for the numeric colourBy; the given scale colour stays
  if (c.name === "colourMode-rainbow") out.colourMode = "scale";
  // scaleColour invalid: treated as absent while colourMode is given -> #d72622
  if (c.name === "scaleColour-red") out.scaleColour = ROT;
  // sectionPlane invalid: skipped, the current section (none after loading the model) stays
  if (c.field === "display.sectionPlane" && c.label) out.section = null;
  // a valid non-unit normal is normalised without a notice
  if (c.name === "sectionPlane-non-unit-normal") out.section = { point: [0, 0, 1.502], normal: [0, 0, -1] };
  // a normal whose length overflows keeps its direction (verification INC-2 CODE-3; before: section silently dropped)
  if (c.name === "sectionPlane-overflowing-normal")
    out.section = { point: [0, 0, 1.502], normal: [1 / Math.SQRT2, 1 / Math.SQRT2, 0] };
  return out;
}

for (const c of dec20InvalidCases()) {
  test(`@e2e @acceptance @REQ-009-AC8 @robustness DEC-20 invalid case ${c.name}: the notice names exactly ${c.label ? "`" + c.label + "`" : "nothing (no notice)"}, ${c.field} is handled as DEC-20 says, the rest is applied`, async ({
    page,
  }) => {
    const errors = await openWith(page, FZK);
    const name = c.name + ".json";
    const last = await loadConfig(page, configFile(configText(c.config), name));
    expect(last.ok).toBe(true);
    expect(last.skipped).toEqual({ properties: [], values: [], invalid: c.label ? [c.label] : [], unknown: [] });
    await idle(page);
    if (c.label) {
      await expect(notices(page)).toHaveText([`${NOTICE_HEAD}\nUngültige Angaben: ${c.label}.`]);
      await expect(okMessages(page)).toHaveCount(0);
    } else {
      await expect(notices(page)).toHaveCount(0);
      await expect(okMessages(page)).toHaveText([`Konfiguration ${name} geladen.`]);
    }
    await expect(errorMessages(page)).toHaveCount(0);
    const want = expectedEffect(c);
    const state = await configuredState(page);
    expect(state.rules).toEqual(want.rules);
    expect([state.search, state.searchField]).toEqual([want.search, want.search]);
    expect([state.view.colourMode, state.view.scaleColour]).toEqual([want.colourMode, want.scaleColour]);
    expect(state.view.section).toEqual(want.section);
    if (c.name === "sectionPlane-overflowing-normal") {
      // a diagonal normal: the 3D engine re-normalises it (last bit may differ); the saved plane is the exact one
      expect(state.threeD.section.point).toEqual(want.section.point);
      state.threeD.section.normal.forEach((x, i) => expect(x).toBeCloseTo(want.section.normal[i], 12));
    } else expect(state.threeD.section).toEqual(want.section);
    // the rest is applied: header, colouring property and colours on the chosen scale, filter result
    expect(state.header.title).toBe(BASE.header.title);
    expect(state.view.colourKey).toBe(BASE.display.colourBy);
    const scale = scaleColours(want.scaleColour);
    const colours = state.threeD.colours.map(([, hex]) => hex.toLowerCase());
    expect(colours.length).toBeGreaterThan(0);
    for (const hex of colours) expect([...scale, EMPTY, MULTI]).toContain(hex);
    if (want.rules === BASE.filterRules && want.search === BASE.search) {
      const full = RULES["config-1.1.0-full"];
      expect(state.filterKeys).toEqual(await keysOf(page, full.globalIds));
    }
    if (c.name === "sectionPlane-non-unit-normal" || c.name === "sectionPlane-overflowing-normal") {
      // saved normalised
      expect((await saveConfig(page)).json.display.sectionPlane).toEqual(want.section);
    }
    expect(errors).toEqual([]);
  });
}

// ---------------------------------------------------------------------------------------------------------------
// The 1.0.0 builder of tag v1.0.0 (REQ-009-AC7), written once into test-cache/v1.0.0/ (git-ignored, served by the
// test server and reachable via file://).
// ---------------------------------------------------------------------------------------------------------------
const V100_DIR = ROOT + "test-cache/v1.0.0/";
const V100_PATH = V100_DIR + "calc-viewer-builder.html";

function writeBuilder100() {
  const html = execFileSync("git", ["show", "v1.0.0:calc-viewer-builder.html"], {
    cwd: ROOT,
    maxBuffer: 64 * 1024 * 1024,
  });
  mkdirSync(V100_DIR, { recursive: true });
  let current = null;
  try {
    current = readFileSync(V100_PATH);
  } catch {
    current = null;
  }
  if (current && current.equals(html)) return;
  const tmp = `${V100_PATH}.${process.pid}.tmp`; // both Playwright projects may write it at once
  writeFileSync(tmp, html);
  renameSync(tmp, V100_PATH);
}

/**
 * Opens the 1.0.0 builder in a new page of the test's context setup (same network guard: CDN from the hash-locked
 * cache, everything else blocked) and waits until it is ready. Returns { context, page, errors }.
 */
async function openBuilder100(browser) {
  writeBuilder100();
  const project = test.info().project.use.baseURL;
  const context = await browser.newContext({ acceptDownloads: true });
  const { CDN, cacheFileFor, contentTypeFor } = await import("../../scripts/lib/cdn-cache.mjs");
  const blocked = [];
  await context.route(`${CDN}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    try {
      const body = readFileSync(cacheFileFor(path));
      return route.fulfill({
        body,
        contentType: contentTypeFor(path),
        headers: { "access-control-allow-origin": "*" },
      });
    } catch {
      blocked.push(route.request().url());
      return route.abort("blockedbyclient");
    }
  });
  await context.route(/^(https?|wss?):\/\/(?!127\.0\.0\.1[:/]|localhost[:/]|cdn\.jsdelivr\.net\/)/, (route) => {
    blocked.push(route.request().url());
    return route.abort("blockedbyclient");
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(new URL("test-cache/v1.0.0/calc-viewer-builder.html", project).href);
  await page.waitForFunction(() => window.__calc && window.__calc.phase === "ready", null, { timeout: 60_000 });
  expect(await page.evaluate(() => window.__calc.error)).toBeNull();
  // it is the 1.0.0 builder: no in-viewer filter panel (CR-002)
  await expect(page.locator("#cv-object-search")).toHaveCount(0);
  return {
    context,
    page,
    errors,
    get blocked() {
      return blocked;
    },
  };
}
