// REQ-006-AC1 (TASK-006a) on a fetched fixture (scripts/fetch-fixtures.mjs): the Revit MEP filter of
// reference-values.json leaves exactly 2,000 elements; all of them are rows of the virtualised single-element view,
// reachable by scrolling, and the status line reads `2.000 von <Y> Elementen` (Y = all rows, read at test time as the
// reference notes).
import { test, expect } from "../support/network-guard.mjs";
import { REF, fetched, loadFiles, openBuilder } from "../support/builder.mjs";
import { filterSet, toggleValue } from "../support/filter-area.mjs";
import { allTableRows } from "../support/table.mjs";

test.describe.configure({ timeout: 300_000 });

test("@acceptance @REQ-006-AC1 a filter with exactly 2,000 elements: 2,000 rows reachable by scrolling, status `2.000 von Y Elementen`", async ({
  page,
}) => {
  const ac1 = REF["REQ-006-AC1"];
  const errors = await openBuilder(page);
  await loadFiles(page, fetched(ac1.file), 240_000);
  const total = await page.evaluate(() => window.__calc.rows.length);
  for (const value of ac1.filter.Kategorie) {
    await filterSet(page, "Kategorie").getByRole("searchbox").fill(value); // virtualised list: bring it into view
    await toggleValue(page, "Kategorie", value);
  }
  await filterSet(page, "Kategorie").getByRole("searchbox").fill("");
  const de = (n) => n.toLocaleString("de-DE");
  await expect(page.locator("#cv-status")).toHaveText(ac1.statusLine.replace("<Y>", de(total)));
  expect(ac1.statusLine.startsWith("2.000 von")).toBe(true);

  // the scroll box holds 2,000 rows; only a few row nodes exist at a time
  const geometry = await page.evaluate(() => {
    const box = document.getElementById("cv-tbl-scroll");
    return {
      scrollHeight: box.scrollHeight,
      rows: box.getAttribute("aria-rowcount"),
      nodes: box.querySelectorAll(".cv-tr").length,
    };
  });
  expect(geometry.rows).toBe(String(ac1.expectedCount + 1)); // + header row
  expect(geometry.nodes).toBeLessThan(60);
  expect(geometry.scrollHeight).toBeGreaterThanOrEqual(ac1.expectedCount * 28);

  // scroll through: every row is reached once, in a continuous index range, with the reference categories
  const rows = await allTableRows(page);
  expect(rows.length).toBe(ac1.expectedCount);
  expect(rows.map((r) => r.index)).toEqual(Array.from({ length: ac1.expectedCount }, (_, i) => i));
  expect(new Set(rows.map((r) => r.key)).size).toBe(ac1.expectedCount);
  const perKategorie = {};
  for (const r of rows) perKategorie[r.cells.Kategorie] = (perKategorie[r.cells.Kategorie] || 0) + 1;
  expect(perKategorie).toEqual(ac1.perKategorie);
  // the table rows are exactly the filter result that 3D follows
  const filterKeys = await page.evaluate(() => window.__calc.filter.keys);
  expect(new Set(rows.map((r) => r.key))).toEqual(new Set(filterKeys));
  // the last row is reachable: scrolled to the end, row 2,000 is rendered inside the visible box
  const last = await page.evaluate(async () => {
    const box = document.getElementById("cv-tbl-scroll");
    box.scrollTop = box.scrollHeight;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const node = [...box.querySelectorAll(".cv-tr")].find(
      (r) => !r.hidden && r.getAttribute("aria-rowindex") === "2001",
    );
    if (!node) return null;
    const a = node.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    return { inside: a.top >= b.top && a.bottom <= b.bottom + 0.5 };
  });
  expect(last).toEqual({ inside: true });
  expect(errors).toEqual([]);
});
