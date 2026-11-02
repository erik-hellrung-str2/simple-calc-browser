// TASK-004 robustness tests of the filter area (spec Testing T7, NFR-001 "render only the visible entries"):
// a filter set on `Name` (about one value per element) on a large fetched fixture stays responsive while searching and
// scrolling, and the catalogue stays virtualised; HTML/script strings from IFC values are rendered as text (no XSS).
import { test, expect } from "../support/network-guard.mjs";
import { REF, fetched, loadFiles, openBuilder } from "../support/builder.mjs";
import { addFilterSet, filterSet, filteredGuids, shownValues, toggleValue } from "../support/filter-area.mjs";
import { XSS_FILE_NAME, XSS_NAMES, XSS_PSET, xssFixture } from "../support/xss-fixture.mjs";

const MAX_POOL_ROWS = 10 + 2 * 6 + 2; // visible rows + overscan on both sides (+ rounding)
const RESPONSIVE_MS = 200; // one search keystroke / one scroll step, measured in the page (synchronous update)

test("@robustness @NFR-001 Name filter set on Revit MEP + SampleCastle (thousands of values and properties): virtualised, search and scroll stay fast", async ({
  page,
}) => {
  test.setTimeout(300_000);
  const errors = await openBuilder(page);
  await loadFiles(page, [fetched("Ifc4_Revit_MEP.ifc"), fetched("Ifc2x3_SampleCastle.ifc")], 240_000);
  const total = await page.evaluate(() => window.__calc.rows.length);
  expect(total).toBeGreaterThan(10_000);

  // catalogue: thousands of entries, only the visible ones are DOM nodes
  await page.locator("#cv-add-filterset").click();
  const dialog = page.getByRole("dialog", { name: "Filtersatz hinzufügen" });
  const catalogSize = await page.evaluate(() => window.__calc.catalog.length);
  expect(catalogSize).toBeGreaterThan(1000);
  expect(await dialog.locator(".cv-cat-row").count()).toBeLessThan(60);
  await dialog.locator(".cv-cat-list").evaluate((n) => {
    n.scrollTop = n.scrollHeight;
    n.dispatchEvent(new Event("scroll"));
  });
  await expect(dialog.locator(".cv-cat-row:not([hidden])").last()).toBeVisible();
  await page.keyboard.press("Escape");

  await addFilterSet(page, "Name", "Name");
  const set = filterSet(page, "Name");
  const values = await page.evaluate(() => window.__calc.filter.facets.Name.values.length);
  expect(values).toBeGreaterThan(1000);
  expect(await set.locator(".cv-fs-value").count()).toBeLessThanOrEqual(MAX_POOL_ROWS);

  // scroll to the end: the last value is rendered, still only a pool of rows
  const scroll = await set.locator(".cv-fs-values").evaluate((list) => {
    const t0 = performance.now();
    list.scrollTop = list.scrollHeight;
    list.dispatchEvent(new Event("scroll"));
    return { ms: performance.now() - t0 };
  });
  expect(scroll.ms).toBeLessThan(RESPONSIVE_MS);
  const lastValue = await page.evaluate(() => window.__calc.filter.facets.Name.values.at(-1).value);
  const rendered = await shownValues(page, "Name");
  expect(rendered.at(-1).label).toBe(lastValue === null ? "(leer)" : String(lastValue));
  expect(await set.locator(".cv-fs-value").count()).toBeLessThanOrEqual(MAX_POOL_ROWS);

  // search: a substring of a value in the middle of the list; the update is synchronous and fast
  const query = await page.evaluate(() => {
    const list = window.__calc.filter.facets.Name.values;
    const v = list[Math.floor(list.length / 2)].value;
    return String(v).slice(0, 8);
  });
  const search = await set.getByRole("searchbox").evaluate((input, q) => {
    const t0 = performance.now();
    input.value = q;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return { ms: performance.now() - t0 };
  }, query);
  expect(search.ms).toBeLessThan(RESPONSIVE_MS);
  const expectedMatches = await page.evaluate(
    (q) =>
      window.__calc.filter.facets.Name.values.filter((e) =>
        String(e.value ?? "(leer)")
          .toLowerCase()
          .includes(q),
      ).length,
    query.toLowerCase(),
  );
  expect(expectedMatches).toBeGreaterThan(0);
  const spacer = await set.locator(".cv-vspacer").evaluate((n) => parseFloat(n.style.height));
  expect(spacer / 26).toBe(expectedMatches);
  const found = await shownValues(page, "Name");
  expect(found.length).toBe(Math.min(expectedMatches, 10 + 6)); // 10 visible rows + overscan below the top
  for (const v of found) expect(v.label.toLowerCase()).toContain(query.toLowerCase());

  // check the reference Name value (scripts/ref, STEP text): count and GlobalIds equal the reference; the filter
  // applies within the NFR-001 budget, measured in the page from the click to the next drawn frame
  const ref = REF["NFR-001-name-filter"];
  const [name] = ref.filter.Name;
  await set.getByRole("searchbox").fill(name);
  const hit = (await shownValues(page, "Name")).find((v) => v.label === name);
  expect(hit).toEqual({ label: name, count: ref.expectedCount, checked: false });
  const before = await page.evaluate(() => window.__calc.filter.updates);
  const clickToFrame = await set.getByRole("checkbox", { name, exact: true }).evaluate(
    (box) =>
      new Promise((resolve) => {
        const t0 = performance.now();
        box.click(); // synchronous change handler: filters evaluated, lists and status line updated
        requestAnimationFrame(() => setTimeout(() => resolve(performance.now() - t0), 0));
      }),
  );
  expect(await page.evaluate(() => window.__calc.filter.updates)).toBeGreaterThan(before);
  expect(await page.evaluate(() => window.__calc.filter.count)).toBe(ref.expectedCount);
  expect(await filteredGuids(page)).toEqual(ref.expectedGlobalIds);
  await expect(page.locator("#cv-status")).toHaveText(
    `${ref.expectedCount.toLocaleString("de-DE")} von ${total.toLocaleString("de-DE")} Elementen`,
  );
  const filterMs = await page.evaluate(() => window.__calc.filter.lastMs);
  expect(filterMs).toBeLessThan(500);
  expect(clickToFrame).toBeLessThan(500);
  console.log(
    `[robustness] MEP+Castle rows=${total} catalogue=${catalogSize} Name values=${values} scroll=${scroll.ms.toFixed(1)} ms ` +
      `search=${search.ms.toFixed(1)} ms filter=${filterMs.toFixed(1)} ms click-to-frame=${clickToFrame.toFixed(1)} ms`,
  );
  expect(errors).toEqual([]);
});

test("@robustness @T10 HTML and script strings in IFC values, pset names and file names are rendered as text", async ({
  page,
}) => {
  const errors = await openBuilder(page);
  const dialogs = [];
  page.on("dialog", (d) => {
    dialogs.push(d.message());
    return d.dismiss();
  });
  await loadFiles(page, xssFixture());
  const modell = XSS_FILE_NAME.replace(/\.ifc$/, "");
  await expect(page.locator("#cv-models .cv-model-name")).toHaveText(modell);

  // Name values: shown verbatim as text
  await addFilterSet(page, "Name", "Name");
  const set = filterSet(page, "Name");
  for (const name of Object.values(XSS_NAMES)) {
    await set.getByRole("searchbox").fill(name);
    const shown = await shownValues(page, "Name");
    expect(shown.map((v) => v.label)).toEqual([name]);
    await expect(set.getByRole("checkbox", { name, exact: true })).toBeVisible();
  }
  await set.getByRole("searchbox").fill("<img");
  await toggleValue(page, "Name", XSS_NAMES["2XPyKWY018sA1ygZKgQPtU"]);
  expect(await page.evaluate(() => window.__calc.filter.count)).toBe(1);

  // Modell value and pset name (catalogue group header)
  await addFilterSet(page, "Modell", "Modell");
  expect((await shownValues(page, "Modell")).map((v) => v.label)).toEqual([modell]);
  await page.locator("#cv-add-filterset").click();
  const dialog = page.getByRole("dialog", { name: "Filtersatz hinzufügen" });
  await dialog.getByRole("searchbox", { name: "Eigenschaft suchen" }).fill("onmouseover");
  await expect(dialog.locator(".cv-cat-group:not([hidden])").first()).toHaveText(XSS_PSET);
  const entry = dialog.locator(".cv-cat-entry:not([hidden])").first();
  await entry.hover();
  await entry.click();
  await expect(dialog).toBeHidden();
  const added = await page.evaluate(() => window.__calc.filter.sets.at(-1));
  expect(added.key.startsWith(XSS_PSET + ".")).toBe(true);
  await expect(page.locator(".cv-fs-title").last()).toHaveText(added.title);

  // nothing was interpreted as markup: no injected elements, no script ran, no dialog opened
  const injected = await page.evaluate(
    () => document.querySelectorAll("#cv-root img, #cv-root script, #cv-root b, #cv-root i").length,
  );
  expect(injected).toBe(0);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  expect(dialogs).toEqual([]);
  expect(errors).toEqual([]);
});
