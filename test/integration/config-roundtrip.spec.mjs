// T2 integration (spec Testing: "config save -> load round trip", TASK-007, REQ-009): in-page, without the file
// dialogs. Fixture IFC -> conversion -> extraction -> a state set through the seams -> CalcConfig.state() as JSON ->
// a fresh page with the same IFC -> CalcConfig.loadText -> the same configuration and the same filter result.
import { test, expect } from "../support/network-guard.mjs";
import { REF, fixture, loadFiles, openBuilder } from "../support/builder.mjs";
import { idle } from "../support/view-3d.mjs";

const FZK = fixture("AC20-FZK-Haus.ifc");
const SEL = REF["REQ-007-selection"];
const VOLUME = REF["REQ-006-grouping-fzk"].column;

test.describe.configure({ timeout: 180_000 });

test("@integration @REQ-009-AC1 configuration state -> JSON -> load in a fresh page gives the same configuration and filter result", async ({
  page,
}) => {
  const errors = await openBuilder(page);
  await loadFiles(page, FZK);
  await idle(page);
  await page.evaluate(
    ({ volume, wall }) => {
      window.CalcTable.setState({
        columns: [{ key: "Kategorie", width: 210 }, { key: "Name" }, { key: volume, width: 133 }],
        sort: { key: volume, dir: "asc" },
        columnFilters: [
          { key: "Kategorie", type: "values", values: [wall] },
          { key: volume, type: "range", min: 0.1, max: 100 },
        ],
      });
      window.CalcTable.setGrouping({ view: "grouped", groupBy: ["Geschoss"] });
    },
    { volume: VOLUME, wall: SEL.group.Kategorie },
  );
  const config = await page.evaluate(() => window.CalcConfig.state());
  const result = await page.evaluate(() => ({ count: window.__calc.filter.count, keys: window.__calc.filter.keys }));
  expect(config.table.columnFilters).toEqual([
    { key: "Kategorie", type: "values", values: [SEL.group.Kategorie] },
    { key: VOLUME, type: "range", min: 0.1, max: 100 },
  ]);

  await page.reload();
  await page.waitForFunction(() => window.__calc && window.__calc.phase === "ready", null, { timeout: 60_000 });
  // before a model is loaded a configuration is refused with a message (nothing to apply it to)
  const early = await page.evaluate((text) => window.CalcConfig.loadText(text), JSON.stringify(config));
  expect(early).toMatchObject({ ok: false, errorClass: "no-model" });
  await loadFiles(page, FZK);
  await idle(page);
  const loaded = await page.evaluate((text) => window.CalcConfig.loadText(text, "x.json"), JSON.stringify(config));
  expect(loaded).toMatchObject({ ok: true, notice: null });
  expect(await page.evaluate(() => window.CalcConfig.state())).toEqual(config);
  expect(await page.evaluate(() => ({ count: window.__calc.filter.count, keys: window.__calc.filter.keys }))).toEqual(
    result,
  );
  expect(errors).toEqual([]);
});
