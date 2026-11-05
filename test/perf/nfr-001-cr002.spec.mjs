// NFR-001 interaction speed, CR-002 part (TASK-020, spec NFR-001 "CR-002 (target unchanged, re-measured for 1.1.0
// with the table at full width)" and Testing T6 "CR-002: NFR-001 for rules (`Enthält` on `Name`, `Freie Textsuche`),
// search (index build <= 2 s and <= 150 MB extra heap on the volume set, time and peak heap recorded on the
// 6,859-property model), hide/isolate clicks, reset, table at full width").
// Volume set (Testing -> Test data): four copies of the fetched Revit MEP model plus SampleCastle, >= 30,000 rows; the
// builder at 1440 x 900, so the table spans to the window's right edge (no details column since CR-002).
// Measured in the page (test/support/perf-measure.mjs), median of 3 per action, asserted <= 500 ms:
//   rule Name          `Anwenden` of `Isolieren` . `Name` . `Enthält` . NEEDLE_NAME, and x `Filter entfernen`
//   rule Freie Textsuche  `Anwenden` of `Freie Textsuche` . `Enthält` . NEEDLE_TEXT, and x (index already built)
//   search             `Suchen nach Objekten` = NEEDLE_SEARCH and cleared, from the end of the 250 ms debounce
//   Ausblenden / Isolieren   properties-panel buttons on one element (table row click before, not measured)
//   Ausblendung entfernen / Isolierung entfernen   the pills
//   Alle Filter zuruecksetzen   with every source active: filter-set tick, column filter, rule, search, hidden and
//                      isolated element
// Each click is measured from its click event until filter sets, table and the last changed 3D frame (Q-002) are
// done (measureInteraction). Index target (NFR-001: the first text source after a model change builds the index
// once; excluded from the 500 ms; <= 2 s and <= 150 MB extra heap on the volume set, with progress): opening the
// filter panel builds it (as ref L1435-1449); measured from the `Filter` click until the progress text is replaced by
// the result; extra heap = retained heap after a forced GC, after minus before. The IfcSpace option switched while a
// search is active (new column store: the index is rebuilt synchronously, TASK-015a follow-up) is recorded and must
// stay within the index target (2 s, build included).
// A second test records the index build time and peak heap on SampleCastle alone (TASK-011 decision 1: "the
// 6,859-property model" is SampleCastle, 6,106 distinct properties today) and asserts no crash (NFR-002 threshold).
// Expected counts come from an independent scan of the extracted values (window.__calc.rows), not from the filter
// code: the needles are letters only and not part of `ja` / `nein`, so the display text of numbers and booleans can
// never contain them and the raw strings decide (DEC-19).
// Runs in the `file` project only, never at the same time as another perf spec (perf-lock).
import { test, expect } from "../support/perf-lock.mjs";
import { fetched, loadFiles, openBuilder } from "../support/builder.mjs";
import { filterSet } from "../support/filter-area.mjs";
import { idle } from "../support/view-3d.mjs";
import {
  measureIndexBuild,
  measureInteraction,
  measureSearch,
  summariseInteractions,
} from "../support/perf-measure.mjs";
import { openColumnFilter } from "../support/table.mjs";
import { clickRow } from "../support/selection.mjs";
import { perfEnvironment, sampleMemory } from "../support/perf-memory.mjs";
import {
  addRule,
  dialogFields,
  fillDialog,
  filterPanel,
  openFilterPanel,
  addRuleLink,
  ruleDialog,
  ruleRows,
  toolbar,
} from "../support/rules.mjs";

const BUDGET_MS = 500; // NFR-001
const INDEX_MS = 2000; // NFR-001 index target
const INDEX_MB = 150; // NFR-001 index target
const RUNS = 3;
const NEEDLE_NAME = "pipe"; // Revit MEP pipe segments and fittings (STEP text)
const NEEDLE_TEXT = "fitting";
const NEEDLE_SEARCH = "duct";
const MB = 1e6;

/** Rows with a string value containing needle (any letter case): in property key, or in any property (key null). */
const scanCount = (page, key, needle) =>
  page.evaluate(
    ({ key, needle }) => {
      const has = (v) => (Array.isArray(v) ? v.some(has) : typeof v === "string" && v.toLowerCase().includes(needle));
      return window.__calc.rows.filter((r) => (key ? has(r.values[key]) : Object.values(r.values).some(has))).length;
    },
    { key, needle },
  );

/** Retained page heap in bytes after a forced GC (CDP). */
async function retainedHeap(cdp) {
  await cdp.send("HeapProfiler.collectGarbage");
  return (await cdp.send("Runtime.getHeapUsage")).usedSize;
}

/** Opens `Filter bearbeiten` from the panel and fills it (not measured). */
async function prepareRule(page, rule) {
  await openFilterPanel(page);
  await addRuleLink(page).click();
  await expect(ruleDialog(page)).toBeVisible();
  await fillDialog(page, rule);
}

/** The table row keys shown now, with 3D geometry, at about 10 %, 50 % and 90 % of the table. */
const spreadKeys = (page) =>
  page.evaluate(() => {
    const geometry = new Set(window.__calc.rows.filter((r) => r.geometry).map((r) => r.key));
    const k = window.__calc.table.keys.filter((key) => geometry.has(key));
    return [k[Math.floor(k.length * 0.1)], k[Math.floor(k.length * 0.5)], k[Math.floor(k.length * 0.9)]];
  });

test("@perf @NFR-001 CR-002 volume set (>= 30,000 elements, table at full width): rules, search, Ausblenden / Isolieren, their pills and `Alle Filter zurücksetzen` within 500 ms (median of 3); index build within 2 s and 150 MB", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "file", "one run is enough; the file project is the user's path");
  test.setTimeout(1_500_000);
  const errors = await openBuilder(page);
  const environment = await perfEnvironment(page);
  for (let i = 0; i < 4; i++) await loadFiles(page, fetched("Ifc4_Revit_MEP.ifc"), 300_000);
  await loadFiles(page, fetched("Ifc2x3_SampleCastle.ifc"), 300_000);
  await idle(page);
  const total = await page.evaluate(() => window.__calc.rows.length);
  expect(total).toBeGreaterThanOrEqual(30_000);
  // table at full width (REQ-006-AC12 layout): its right edge is the window's right edge
  const width = await page.evaluate(() => window.innerWidth);
  const tableBox = await page.locator("#cv-table").boundingBox();
  expect(Math.abs(tableBox.x + tableBox.width - width), "table right edge = window right edge").toBeLessThanOrEqual(1);
  expect(await page.locator("#cv-details").count()).toBe(0);

  const results = {};
  const keep = (name, m) => {
    (results[name] = results[name] || []).push(m);
    return m;
  };
  const measure = (name, action) => measureInteraction(page, action).then((m) => keep(name, m));

  // ---- index target: opening the filter panel builds the display-text index (first text source) ----
  const cdp = await page.context().newCDPSession(page);
  const heapBefore = await retainedHeap(cdp);
  const memory = await sampleMemory(page);
  const index = await measureIndexBuild(page, () =>
    toolbar(page).getByRole("button", { name: "Filter", exact: true }).click(),
  );
  const { pageHeapMB } = await memory.stop();
  const heapAfter = await retainedHeap(cdp);
  await expect(filterPanel(page)).toBeVisible();
  await expect(page.locator("#cv-filter-status")).toHaveText(/ von .* Objekten sichtbar$/);
  index.extraHeapMB = Math.round(((heapAfter - heapBefore) / MB) * 10) / 10;
  index.peakPageHeapMB = pageHeapMB;
  index.heapBeforeMB = Math.round(heapBefore / MB);

  // ---- search field: from the end of the 250 ms debounce ----
  const search = page.getByRole("searchbox", { name: "Suchen nach Objekten" });
  const searchCount = await scanCount(page, null, NEEDLE_SEARCH);
  expect(searchCount).toBeGreaterThan(0);
  expect(searchCount).toBeLessThan(total);
  for (let i = 0; i < RUNS; i++) {
    expect(keep("search set", await measureSearch(page, search, NEEDLE_SEARCH)).count).toBe(searchCount);
    expect(keep("search clear", await measureSearch(page, search, "")).count).toBe(total);
  }

  // ---- rule `Isolieren` . `Name` . `Enthält` ----
  const nameCount = await scanCount(page, "Name", NEEDLE_NAME);
  expect(nameCount).toBeGreaterThan(0);
  expect(nameCount).toBeLessThan(total);
  for (let i = 0; i < RUNS; i++) {
    await prepareRule(page, { mode: "isolate", key: "Name", op: "contains", value: NEEDLE_NAME });
    expect((await measure("rule Name apply", () => dialogFields(page).apply.click())).count).toBe(nameCount);
    await expect(ruleDialog(page)).toBeHidden();
    const remove = ruleRows(page).nth(0).getByRole("button", { name: "Filter entfernen" });
    expect((await measure("rule Name remove", () => remove.click())).count).toBe(total);
    await expect(ruleRows(page)).toHaveCount(0);
  }

  // ---- rule `Freie Textsuche` . `Enthält` (all properties) ----
  const textCount = await scanCount(page, null, NEEDLE_TEXT);
  expect(textCount).toBeGreaterThan(0);
  expect(textCount).toBeLessThan(total);
  for (let i = 0; i < RUNS; i++) {
    await prepareRule(page, { mode: "text", op: "contains", value: NEEDLE_TEXT });
    expect((await measure("rule Freie Textsuche apply", () => dialogFields(page).apply.click())).count).toBe(textCount);
    await expect(ruleDialog(page)).toBeHidden();
    const remove = ruleRows(page).nth(0).getByRole("button", { name: "Filter entfernen" });
    expect((await measure("rule Freie Textsuche remove", () => remove.click())).count).toBe(total);
  }

  // ---- Ausblenden / Isolieren (properties panel) and their pills ----
  for (const key of await spreadKeys(page)) {
    await clickRow(page, key);
    await expect(page.locator("#cv-props")).toBeVisible();
    expect((await measure("Ausblenden", () => page.locator("#cv-props-hide").click())).count).toBe(total - 1);
    expect(await page.evaluate(() => window.__calc.tools.hidden.length)).toBe(1);
    expect((await measure("Ausblendung entfernen", () => page.locator("#cv-pill-hidden-reset").click())).count).toBe(
      total,
    );
    await clickRow(page, key);
    await expect(page.locator("#cv-props")).toBeVisible();
    expect((await measure("Isolieren", () => page.locator("#cv-props-isolate").click())).count).toBe(1);
    expect(await page.evaluate(() => [...window.__calc.tools.isolated])).toEqual([key]);
    expect((await measure("Isolierung entfernen", () => page.locator("#cv-pill-isolate-reset").click())).count).toBe(
      total,
    );
    await page.keyboard.press("Escape");
    await idle(page);
  }

  // ---- `Alle Filter zurücksetzen` with every source active ----
  const resetAll = page.getByRole("button", { name: "Alle Filter zurücksetzen", exact: true });
  for (let i = 0; i < RUNS; i++) {
    await addRule(page, { mode: "isolate", key: "Name", op: "contains", value: NEEDLE_NAME });
    await search.fill(NEEDLE_TEXT);
    await page.waitForFunction(() => window.__calc.filter.active.some((f) => f.type === "search"));
    await idle(page);
    // a Kategorie of the shown rows: ticked in the filter set and in the column filter
    const kat = await page.evaluate(() => {
      const key = window.__calc.filter.keys[0];
      return window.__calc.rows.find((r) => r.key === key).values.Kategorie;
    });
    await filterSet(page, "Kategorie").getByRole("searchbox").fill(kat);
    await filterSet(page, "Kategorie").getByRole("checkbox", { name: kat, exact: true }).click();
    await filterSet(page, "Kategorie").getByRole("searchbox").fill("");
    const popup = await openColumnFilter(page, "Kategorie");
    await popup.getByRole("searchbox").fill(kat);
    await popup.getByRole("checkbox", { name: kat, exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(popup).toBeHidden();
    await idle(page);
    const shownKeys = await page.evaluate(() => [...window.__calc.table.keys]);
    expect(shownKeys.length, "at least two rows under rule, search and Kategorie").toBeGreaterThanOrEqual(2);
    await clickRow(page, shownKeys[0]);
    await page.locator("#cv-props-hide").click();
    await page.waitForFunction(() => window.__calc.tools.hidden.length === 1);
    await idle(page);
    const second = await page.evaluate(() => window.__calc.table.keys[0]);
    await clickRow(page, second);
    await page.locator("#cv-props-isolate").click();
    await page.waitForFunction(() => window.__calc.tools.isolated !== null);
    await page.keyboard.press("Escape");
    await idle(page);
    const active = await page.evaluate(() => ({
      types: [...new Set(window.__calc.filter.active.map((f) => f.type))].sort(),
      rules: window.__calc.filter.rules.length,
      count: window.__calc.filter.count,
    }));
    expect(active.rules).toBe(1);
    expect(active.count).toBe(1);
    expect((await measure("Alle Filter zurücksetzen", () => resetAll.click())).count).toBe(total);
    const after = await page.evaluate(() => ({
      active: window.__calc.filter.active.length,
      rules: window.__calc.filter.rules.length,
      hidden: window.__calc.tools.hidden.length,
      isolated: window.__calc.tools.isolated,
    }));
    expect(after).toEqual({ active: 0, rules: 0, hidden: 0, isolated: null });
    await expect(search).toHaveValue("");
    if (i === 0) results.activeSources = active.types;
  }
  const activeSources = results.activeSources;
  delete results.activeSources;

  // ---- IfcSpace option switched while a search is active: new column store, index rebuilt synchronously ----
  const spaces = page.getByRole("checkbox", { name: "Räume (IfcSpace) einbeziehen" });
  await openFilterPanel(page);
  await measureSearch(page, search, NEEDLE_SEARCH);
  const spaceSwitch = [];
  for (let i = 0; i < 2; i++) {
    const m = await measureInteraction(page, () => spaces.click());
    spaceSwitch.push(m);
  }
  await measureSearch(page, search, "");

  const summary = Object.fromEntries(Object.entries(results).map(([k, runs]) => [k, summariseInteractions(runs)]));
  const heapMB = await page.evaluate(() =>
    performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null,
  );
  const report = {
    total,
    tableRight: Math.round(tableBox.x + tableBox.width),
    width,
    index,
    activeSources,
    spaceSwitch: spaceSwitch.map((m) => ({ done: m.done, filter: m.filter, frame: m.frame, count: m.count })),
    environment,
    heapMB,
    summary,
  };
  console.log(`[perf NFR-001 CR-002] ${JSON.stringify(report)}`);
  info.annotations.push({ type: "nfr-001-cr002", description: JSON.stringify(report) });

  expect(activeSources).toEqual(expect.arrayContaining(["keys", "rule", "search", "values"]));
  expect(index.progressMs, "progress shown while the index builds").not.toBeNull();
  expect(index.indexMs, "index build, volume set (click -> result)").toBeLessThanOrEqual(INDEX_MS);
  expect(index.extraHeapMB, "index extra heap, volume set").toBeLessThanOrEqual(INDEX_MB);
  for (const m of spaceSwitch)
    expect(m.done, "IfcSpace switch with an active search (index rebuilt)").toBeLessThanOrEqual(INDEX_MS);
  for (const [k, s] of Object.entries(summary))
    expect(s.done, `${k}: input -> filter sets, table and 3D done (median of ${RUNS})`).toBeLessThanOrEqual(BUDGET_MS);
  expect(errors).toEqual([]);
});

test("@perf @NFR-001 display-text index on SampleCastle (the model with the most properties): build time and peak heap through the filter panel recorded, no crash", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "file", "one run is enough; the file project is the user's path");
  test.setTimeout(600_000);
  const errors = await openBuilder(page);
  await loadFiles(page, fetched("Ifc2x3_SampleCastle.ifc"), 300_000);
  await idle(page);
  const rows = await page.evaluate(() => window.__calc.rows.length);
  const properties = await page.evaluate(() => {
    const keys = new Set();
    for (const r of window.__calc.rows) for (const k in r.values) keys.add(k);
    return keys.size;
  });
  const cdp = await page.context().newCDPSession(page);
  const heapBefore = await retainedHeap(cdp);
  const memory = await sampleMemory(page);
  const index = await measureIndexBuild(page, () =>
    toolbar(page).getByRole("button", { name: "Filter", exact: true }).click(),
  );
  const { pageHeapMB, rssMB } = await memory.stop();
  const heapAfter = await retainedHeap(cdp);
  // a search over the built index works
  const search = page.getByRole("searchbox", { name: "Suchen nach Objekten" });
  const wallCount = await scanCount(page, null, "wall");
  const m = await measureSearch(page, search, "wall");
  expect(m.count).toBe(wallCount);
  const report = {
    rows,
    properties,
    index,
    extraHeapMB: Math.round(((heapAfter - heapBefore) / MB) * 10) / 10,
    peakPageHeapMB: pageHeapMB,
    peakRssMB: rssMB,
    search: m,
    environment: await perfEnvironment(page),
  };
  console.log(`[perf NFR-001 index SampleCastle] ${JSON.stringify(report)}`);
  info.annotations.push({ type: "nfr-001-index-castle", description: JSON.stringify(report) });
  expect(properties, "thousands of properties").toBeGreaterThanOrEqual(1000);
  expect(index.indexMs, "the index was built (progress shown and replaced)").not.toBeNull();
  expect(await page.evaluate(() => window.__calc.error)).toBeNull();
  expect(errors, "no page error or crash").toEqual([]);
});
