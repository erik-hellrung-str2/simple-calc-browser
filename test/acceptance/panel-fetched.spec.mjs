// TASK-017b acceptance test on a fetched fixture (SampleCastle, scripts/fetch-fixtures.mjs -> test-cache/fixtures/):
// REQ-007-AC8, the properties panel of a group selection. Not in test_fast (fetched fixture); part of test_all and
// `--grep @acceptance`. Expected values: the 13 walls and the element without geometry come from
// test/fixtures/reference-values.json (STEP text); n of `Davon ohne 3D-Geometrie` is the AC's own definition, the
// group's rows with `Geometrie` = `Nein` (extraction, verified by REQ-002-AC7), not the panel code.
import { test, expect } from "../support/network-guard.mjs";
import { REF, fetched, fixture, loadFiles, openBuilder, removeModel } from "../support/builder.mjs";
import { idle, keysOfGuids, rowsByKey, viewState } from "../support/view-3d.mjs";
import { groupingState, pickGroup, setView } from "../support/grouping.mjs";
import { clickRow, details } from "../support/selection.mjs";

const FZK = fixture("AC20-FZK-Haus.ifc");
const SEL = REF["REQ-007-selection"];
const AC7 = REF["REQ-002-AC7"];

test.describe.configure({ timeout: 420_000 });

/** Clicks the level-1 group row with this label; returns its id. */
async function clickGroup(page, label) {
  const id = await page.evaluate(
    (l) => window.__calc.table.display.find((r) => r.type === "group" && r.level === 1 && r.label === l)?.id ?? null,
    label,
  );
  expect(id, `group row ${label}`).not.toBeNull();
  await clickRow(page, id, { group: true });
  await idle(page);
  return id;
}

test("@acceptance @REQ-007-AC8 a group row selects all its elements: FZK IfcWallStandardCase reads `13 Elemente ausgewählt` with `Ausblenden` / `Isolieren`; on SampleCastle the group of the element without geometry also reads `Davon ohne 3D-Geometrie: <n>`", async ({
  page,
}) => {
  const errors = await openBuilder(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await loadFiles(page, FZK);
  await idle(page);
  await setView(page, "Gruppiert");
  if ((await groupingState(page)).groupBy[0] !== "Kategorie") await pickGroup(page, 1, "Kategorie", "Kategorie");

  const walls = (await keysOfGuids(page, SEL.group.globalIds)).sort();
  expect(walls.length).toBe(SEL.group.count);
  const groupId = await clickGroup(page, SEL.group.Kategorie);
  expect((await viewState(page)).selected).toEqual(walls);
  expect([...(await page.evaluate(() => window.__calc.view.selectedKeys))].sort()).toEqual(walls);
  let d = await details(page);
  expect(d.open).toBe(true);
  expect(d.group).toBe(groupId);
  expect(d.count).toBe("13 Elemente ausgewählt");
  expect(d.nogeo, "all 13 walls have geometry: no hint").toBeNull();
  const panel = page.locator("#cv-props");
  for (const name of ["Ausblenden", "Isolieren"])
    await expect(panel.getByRole("button", { name, exact: true }), name).toBeVisible();

  // SampleCastle: the group of the element without geometry (REQ-002-AC7)
  await page.keyboard.press("Escape");
  await removeModel(page, "AC20-FZK-Haus");
  await loadFiles(page, fetched(AC7.file), 300_000);
  await idle(page);
  if ((await groupingState(page)).groupBy[0] !== "Kategorie") await pickGroup(page, 1, "Kategorie", "Kategorie");
  const rows = [...(await rowsByKey(page)).values()];
  const element = rows.find((r) => r.guid === AC7.element.GlobalId);
  expect(element.values.Kategorie).toBe(AC7.element.Kategorie);
  expect(element.values.Geometrie).toBe("Nein");
  const group = rows.filter((r) => r.values.Kategorie === AC7.element.Kategorie);
  const n = group.filter((r) => r.values.Geometrie === "Nein").length;
  expect(n).toBeGreaterThanOrEqual(1);
  console.log(`[REQ-007-AC8] SampleCastle ${AC7.element.Kategorie}: ${group.length} elements, ${n} without geometry`);

  await clickGroup(page, AC7.element.Kategorie);
  d = await details(page);
  expect(d.open).toBe(true);
  const count = group.length;
  expect(d.count).toBe(`${count.toLocaleString("de-DE")} ${count === 1 ? "Element" : "Elemente"} ausgewählt`);
  expect(d.nogeo).toBe(`Davon ohne 3D-Geometrie: ${n.toLocaleString("de-DE")}`);
  expect([...(await page.evaluate(() => window.__calc.view.selectedKeys))].sort()).toEqual(
    group.map((r) => r.key).sort(),
  );
  for (const name of ["Ausblenden", "Isolieren"])
    await expect(panel.getByRole("button", { name, exact: true }), name).toBeVisible();
  expect(errors).toEqual([]);
});
