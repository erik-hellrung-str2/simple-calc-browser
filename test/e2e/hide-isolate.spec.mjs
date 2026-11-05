// TASK-017a (CR-002, INC-2): the element tools `Ausblenden` / `Isolieren` as filter sources (spec REQ-013, DEC-18),
// their filter-area entries and pills (REQ-004-AC5/AC6), the pill `Filter entfernen` (REQ-012-AC12) and rules on
// properties no longer loaded (REQ-012-AC14). The 3D side is read from CalcView.state() (spec 4.4), the table from the
// DOM, the sets from window.__calc.tools. Expected keys, counts and the Duplex-only property come from
// test/fixtures/reference-values.json (section REQ-013-tools, derived from the STEP text by
// scripts/ref/derive-reference.mjs), never from the code under test.
import { test, expect } from "../support/network-guard.mjs";
import { REF, fixture, loadFiles, openBuilder, removeModel } from "../support/builder.mjs";
import { shownCounts, shownValues, toggleValue } from "../support/filter-area.mjs";
import { colourBy, idle, keysOfGuids, rowsByKey, setGhosts, viewState } from "../support/view-3d.mjs";
import { allTableRows, checkColumnValue } from "../support/table.mjs";
import { setView } from "../support/grouping.mjs";
import { addRule, filterPanel, openFilterPanel, ruleTexts, toolbar } from "../support/rules.mjs";
import {
  afterUpdate,
  clickMenu,
  cutAt,
  firstPickable,
  isolateTogether,
  menuAction,
  panelAction,
  selectGroupOf,
  shownPills,
  sourceEntries,
  sourceEntry,
  toolSets,
} from "../support/tools.mjs";

const FZK = fixture("AC20-FZK-Haus.ifc");
const DUPLEX = fixture("Ifc2x3_Duplex_Architecture.ifc");
const TOOLS = REF["REQ-013-tools"];
const Y = TOOLS.rows; // FZK element rows (99)
const WALLS = TOOLS.walls; // the 13 IfcWallStandardCase walls
const wallGuid = (name) => WALLS.find((w) => w.Name === name).GlobalId;
const ERDG1 = wallGuid("Wand-Ext-ERDG-1");
const ERDG2 = wallGuid("Wand-Ext-ERDG-2");
const OG1 = wallGuid("Wand-Ext-OG-1");
const GROUND = "Erdgeschoss";

test.describe.configure({ timeout: 240_000 });

const status = (page) => page.locator("#cv-status");
const de = (n) => n.toLocaleString("de-DE");
const sorted = (a) => [...a].sort();

async function openWith(page, files) {
  const errors = await openBuilder(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await loadFiles(page, files);
  await idle(page);
  return errors;
}

/** Keys of the rows with geometry, sorted. */
async function geometryKeys(page) {
  return sorted([...(await rowsByKey(page)).values()].filter((r) => r.geometry).map((r) => r.key));
}

test("@e2e @acceptance @REQ-013-AC2 `Ausblenden` in the click menu removes the wall from 3D (tool-hidden, also with ghosts on), table and status line; entry `Ausgeblendet: 1 Element`, pill shown, selection cleared; a second wall gives `Ausgeblendet: 2 Elemente`", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  const wallKeys = await keysOfGuids(
    page,
    WALLS.map((w) => w.GlobalId),
  );
  expect(wallKeys.every(Boolean)).toBe(true);
  await expect(page.locator("#cv-pill-hidden")).toBeHidden();
  expect(await sourceEntries(page)).toEqual([]);

  const first = await firstPickable(page, wallKeys);
  await menuAction(page, first, "Ausblenden");
  let s = await viewState(page);
  expect(s.mode).toBe("ghost"); // ghosts on: the hidden wall is still no ghost
  expect(s.toolHidden).toEqual([first.key]);
  expect(s.opaque).not.toContain(first.key);
  expect(s.ghost).not.toContain(first.key);
  expect(s.ghost).toEqual([]);
  const rows = await allTableRows(page);
  expect(rows.length).toBe(Y - 1);
  expect(rows.map((r) => r.key)).not.toContain(first.key);
  await expect(status(page)).toHaveText(`${de(Y - 1)} von ${de(Y)} Elementen`);
  expect(await sourceEntries(page)).toEqual(["Ausgeblendet: 1 Element"]);
  await expect(page.locator("#cv-pill-hidden")).toBeVisible();
  await expect(page.locator("#cv-pill-hidden-reset")).toHaveAttribute(
    "title",
    "Ausgeblendete Elemente wieder anzeigen",
  );
  expect(await shownPills(page)).toEqual(["Filter entfernen", "Ausblendung entfernen"]);
  expect(s.selected).toEqual([]);
  await expect(page.locator("#cv-props")).toBeHidden();
  expect(await page.evaluate(() => window.__calc.view.selected)).toBeNull();

  const second = await firstPickable(
    page,
    wallKeys.filter((k) => k !== first.key),
  );
  await menuAction(page, second, "Ausblenden");
  s = await viewState(page);
  expect(s.toolHidden).toEqual(sorted([first.key, second.key]));
  expect(await sourceEntries(page)).toEqual(["Ausgeblendet: 2 Elemente"]);
  await expect(status(page)).toHaveText(`${de(Y - 2)} von ${de(Y)} Elementen`);
  expect((await toolSets(page)).hidden).toEqual(sorted([first.key, second.key]));
  expect(errors).toEqual([]);
});

// REQ-013-AC3 (corrected 2026-11-05, Q-004 `Über Gruppe`): `Isolieren` in the click menu of a wall; then, with no
// isolation active, a group row with two walls and `Isolieren` in the properties panel. The DEC-18 adding semantics
// (a further `Isolieren` adds) is checked in between through the selection seam CalcView.select, which can select an
// element the table no longer shows (no UI path, see docs/tasks/TASK-017a.md).
test("@e2e @acceptance @REQ-013-AC3 `Isolieren` in the click menu: only that wall is opaque, every other element with geometry tool-hidden, context hidden, one table row, entry `Isoliert: 1 Element`, pill shown, selection and panel stay; with no isolation active, a group row with two walls and `Isolieren` in the panel show both walls, entry `Isoliert: 2 Elemente`", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  const wallKeys = await keysOfGuids(
    page,
    WALLS.map((w) => w.GlobalId),
  );
  const geometry = await geometryKeys(page);
  expect((await page.evaluate(() => window.CalcView.contextState())).visible).toBeGreaterThan(0);
  const first = await firstPickable(page, wallKeys);
  await menuAction(page, first, "Isolieren");
  let s = await viewState(page);
  expect(s.opaque).toEqual([first.key]);
  expect(s.ghost).toEqual([]);
  expect(s.hidden).toEqual([]);
  expect(s.toolHidden).toEqual(geometry.filter((k) => k !== first.key));
  expect((await page.evaluate(() => window.CalcView.contextState())).visible).toBe(0);
  expect((await allTableRows(page)).map((r) => r.key)).toEqual([first.key]);
  await expect(status(page)).toHaveText(`1 von ${de(Y)} Elementen`);
  expect(await sourceEntries(page)).toEqual(["Isoliert: 1 Element"]);
  await expect(page.locator("#cv-pill-isolate")).toBeVisible();
  await expect(page.locator("#cv-pill-isolate-reset")).toHaveAttribute("title", "Alle Elemente wieder anzeigen");
  expect(s.selected).toEqual([first.key]);
  await expect(page.locator("#cv-props")).toBeVisible();
  await expect(clickMenu(page)).toBeHidden();

  // a further `Isolieren` adds to the set (DEC-18): the second wall, selected through the seam, isolated in the panel
  const second = wallKeys.find((k) => k !== first.key);
  await page.evaluate((k) => window.CalcView.select(k), second);
  await afterUpdate(page, () => page.locator("#cv-props-isolate").click());
  s = await viewState(page);
  expect(s.opaque).toEqual(sorted([first.key, second]));
  expect(await sourceEntries(page)).toEqual(["Isoliert: 2 Elemente"]);
  expect(sorted((await allTableRows(page)).map((r) => r.key))).toEqual(sorted([first.key, second]));

  // after `Isolierung entfernen` the next `Isolieren` starts a new set
  await afterUpdate(page, () => page.locator("#cv-pill-isolate-reset").click());
  expect((await toolSets(page)).isolated).toBeNull();
  expect((await page.evaluate(() => window.CalcView.contextState())).visible).toBeGreaterThan(0);
  await panelAction(page, second, "isolate");
  expect((await viewState(page)).opaque).toEqual([second]);
  expect(await sourceEntries(page)).toEqual(["Isoliert: 1 Element"]);

  // AC3 second part: no isolation active, a group row with two walls selected, `Isolieren` in the properties panel
  await afterUpdate(page, () => page.locator("#cv-pill-isolate-reset").click());
  expect((await toolSets(page)).isolated).toBeNull();
  expect(await sourceEntries(page)).toEqual([]);
  const pair = WALLS.map((w, i) => ({ guid: w.GlobalId, key: wallKeys[i] }))
    .filter((w) => w.key !== first.key && w.key !== second)
    .slice(0, 2);
  const pairKeys = sorted(pair.map((w) => w.key));
  const group = await selectGroupOf(
    page,
    pair.map((w) => w.guid),
  );
  const groupRow = await page.evaluate((id) => window.__calc.table.display.find((r) => r.id === id), group);
  expect(groupRow.type).toBe("group");
  expect(groupRow.count).toBe(2);
  expect((await viewState(page)).selected).toEqual(pairKeys);
  expect((await toolSets(page)).isolated).toBeNull();
  await afterUpdate(page, () => page.locator("#cv-props-isolate").click());
  expect((await toolSets(page)).isolated).toEqual(pairKeys);
  expect(await sourceEntries(page)).toEqual(["Isoliert: 2 Elemente"]);
  await expect(page.locator("#cv-pill-isolate")).toBeVisible();
  // both walls shown, independent of the GlobalId ticks used to form the group: clear them, back to single elements
  await afterUpdate(page, () => page.getByRole("button", { name: "Auswahl zurücksetzen: GlobalId" }).click());
  await setView(page, "Einzelelemente");
  await idle(page);
  s = await viewState(page);
  expect(s.opaque).toEqual(pairKeys);
  expect(s.ghost).toEqual([]);
  expect(s.toolHidden).toEqual(geometry.filter((k) => !pairKeys.includes(k)));
  expect(sorted((await allTableRows(page)).map((r) => r.key))).toEqual(pairKeys);
  await expect(status(page)).toHaveText(`2 von ${de(Y)} Elementen`);
  expect(await sourceEntries(page)).toEqual(["Isoliert: 2 Elemente"]);
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-013-AC4 two isolated walls with one hidden show only the other; with a filter-set value excluding one, that one is a ghost (ghosts on) or hidden (ghosts off) and the status line counts 1", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  const [ground, upper] = await keysOfGuids(page, [ERDG1, OG1]);
  await isolateTogether(page, [ERDG1, OG1]);
  expect((await toolSets(page)).isolated).toEqual(sorted([ground, upper]));
  expect((await viewState(page)).opaque).toEqual(sorted([ground, upper]));
  await expect(status(page)).toHaveText(`2 von ${de(Y)} Elementen`);

  // one of them hidden: only the other is shown
  await panelAction(page, upper, "hide");
  let s = await viewState(page);
  expect(s.opaque).toEqual([ground]);
  expect(s.toolHidden).toContain(upper);
  expect((await allTableRows(page)).map((r) => r.key)).toEqual([ground]);
  await expect(status(page)).toHaveText(`1 von ${de(Y)} Elementen`);
  await afterUpdate(page, () => page.locator("#cv-pill-hidden-reset").click());
  expect((await viewState(page)).opaque).toEqual(sorted([ground, upper]));

  // a filter-set value excluding the upper wall: ghost with ghosts on, hidden with ghosts off; status counts 1
  await toggleValue(page, "Geschoss", GROUND);
  s = await viewState(page);
  expect(s.opaque).toEqual([ground]);
  expect(s.ghost).toEqual([upper]);
  expect(s.toolHidden).not.toContain(upper);
  await expect(status(page)).toHaveText(`1 von ${de(Y)} Elementen`);
  await setGhosts(page, false);
  s = await viewState(page);
  expect(s.mode).toBe("hide");
  expect(s.opaque).toEqual([ground]);
  expect(s.hidden).toEqual([upper]);
  expect(s.ghost).toEqual([]);
  await expect(status(page)).toHaveText(`1 von ${de(Y)} Elementen`);
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-013-AC6 `Ausblendung entfernen` returns the hidden elements and keeps the isolation; `Isolierung entfernen` ends it; `Alle Filter zurücksetzen` and the pill `Filter entfernen` clear both sets, pills and entries", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  const [a, b] = await keysOfGuids(page, [ERDG1, ERDG2]);
  const setBoth = async () => {
    await isolateTogether(page, [ERDG1, ERDG2]);
    await panelAction(page, b, "hide");
    expect(await toolSets(page)).toEqual({ hidden: [b], isolated: sorted([a, b]) });
    expect(await sourceEntries(page)).toEqual(["Ausgeblendet: 1 Element", "Isoliert: 2 Elemente"]);
    expect(await shownPills(page)).toEqual(["Filter entfernen", "Isolierung entfernen", "Ausblendung entfernen"]);
    await expect(status(page)).toHaveText(`1 von ${de(Y)} Elementen`);
  };
  const cleared = async () => {
    expect(await toolSets(page)).toEqual({ hidden: [], isolated: null });
    expect(await sourceEntries(page)).toEqual([]);
    await expect(page.locator("#cv-pill-hidden")).toBeHidden();
    await expect(page.locator("#cv-pill-isolate")).toBeHidden();
    await expect(status(page)).toHaveText(`${de(Y)} von ${de(Y)} Elementen`);
    const s = await viewState(page);
    expect(s.toolHidden).toEqual([]);
    expect(s.opaque).toEqual(await geometryKeys(page));
  };

  await setBoth();
  await afterUpdate(page, () => page.locator("#cv-pill-hidden-reset").click());
  expect(await toolSets(page)).toEqual({ hidden: [], isolated: sorted([a, b]) });
  expect((await viewState(page)).opaque).toEqual(sorted([a, b]));
  expect(await sourceEntries(page)).toEqual(["Isoliert: 2 Elemente"]);
  await expect(page.locator("#cv-pill-hidden")).toBeHidden();
  await expect(page.locator("#cv-pill-isolate")).toBeVisible();
  await afterUpdate(page, () => page.locator("#cv-pill-isolate-reset").click());
  await cleared();

  await setBoth();
  await afterUpdate(page, () => page.getByRole("button", { name: "Alle Filter zurücksetzen" }).click());
  await cleared();

  await setBoth();
  await afterUpdate(page, () => page.locator("#cv-pill-filter-reset").click());
  await cleared();
  await expect(page.locator("#cv-pill-filter")).toBeHidden();
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-013-AC8 removing a model drops its elements from the hidden and isolated sets (isolation of only its elements ends); with IfcSpace off no space appears in 3D through hide, isolate, the pills, `Fokus` and the ghost toggle", async ({
  page,
}) => {
  const errors = await openWith(page, [FZK, DUPLEX]);
  const rows = await rowsByKey(page);
  const byGuid = new Map([...rows.values()].map((r) => [r.guid, r]));
  const duplexGuids = REF["REQ-012-rules"]["REQ-012-AC5"].multi.globalIds.filter(
    (g) => byGuid.get(g) && byGuid.get(g).geometry,
  );
  expect(duplexGuids.length).toBeGreaterThan(3);
  const [dHide, dIso1, dIso2] = duplexGuids;
  const fzkHide = byGuid.get(ERDG2).key;
  const fzkIso = byGuid.get(ERDG1).key;
  const total = rows.size;

  // hidden and isolated elements in both models
  await panelAction(page, fzkHide, "hide");
  await panelAction(page, byGuid.get(dHide).key, "hide");
  await isolateTogether(page, [ERDG1, dIso1, dIso2]);
  expect(await toolSets(page)).toEqual({
    hidden: sorted([fzkHide, byGuid.get(dHide).key]),
    isolated: sorted([fzkIso, byGuid.get(dIso1).key, byGuid.get(dIso2).key]),
  });
  expect(await sourceEntries(page)).toEqual(["Ausgeblendet: 2 Elemente", "Isoliert: 3 Elemente"]);
  await expect(status(page)).toHaveText(`3 von ${de(total)} Elementen`);

  await removeModel(page, "Ifc2x3_Duplex_Architecture");
  await idle(page);
  expect(await toolSets(page)).toEqual({ hidden: [fzkHide], isolated: [fzkIso] });
  expect(await sourceEntries(page)).toEqual(["Ausgeblendet: 1 Element", "Isoliert: 1 Element"]);
  await expect(status(page)).toHaveText(`1 von ${de(Y)} Elementen`);
  expect((await viewState(page)).opaque).toEqual([fzkIso]);

  // only Duplex elements isolated: removing the model ends the isolation
  await afterUpdate(page, () => page.getByRole("button", { name: "Alle Filter zurücksetzen" }).click());
  await loadFiles(page, DUPLEX);
  await idle(page);
  await isolateTogether(page, [dIso1, dIso2]);
  expect((await toolSets(page)).isolated).toHaveLength(2);
  await removeModel(page, "Ifc2x3_Duplex_Architecture");
  await idle(page);
  expect(await toolSets(page)).toEqual({ hidden: [], isolated: null });
  expect(await sourceEntries(page)).toEqual([]);
  await expect(page.locator("#cv-pill-isolate")).toBeHidden();
  await expect(status(page)).toHaveText(`${de(Y)} von ${de(Y)} Elementen`);
  expect((await viewState(page)).opaque).toEqual(await geometryKeys(page));

  // IfcSpace with the option off (process-log 2026-11-02, DEC-18): never opaque or ghost, never visible in the engine
  const fzk = await page.evaluate(() => window.__calc.models.find((m) => m.modell === "AC20-FZK-Haus"));
  expect(fzk.spaceIds.length).toBe(REF["AC20-FZK-Haus"].spaces.count);
  const spaceKeys = fzk.spaceIds.map((id) => fzk.id + ":" + id);
  const noSpaces = async (step) => {
    const s = await viewState(page);
    for (const k of spaceKeys) {
      expect(s.opaque, step).not.toContain(k);
      expect(s.ghost, step).not.toContain(k);
    }
    const visible = await page.evaluate(([m, ids]) => window.CalcView.engineVisible(m, ids), [fzk.id, fzk.spaceIds]);
    expect(
      visible.every((v) => v === false),
      `${step}: no IfcSpace visible in the engine`,
    ).toBe(true);
  };
  await expect(page.locator("#cv-opt-spaces")).not.toBeChecked();
  await noSpaces("start");
  await panelAction(page, fzkHide, "hide");
  await noSpaces("hide");
  await panelAction(page, fzkIso, "isolate");
  await noSpaces("isolate");
  await afterUpdate(page, () => page.locator("#cv-pill-hidden-reset").click());
  await noSpaces("Ausblendung entfernen");
  await toolbar(page).getByRole("button", { name: "Fokus", exact: true }).click();
  await idle(page);
  await noSpaces("Fokus (isolated)");
  await afterUpdate(page, () => page.locator("#cv-pill-isolate-reset").click());
  await noSpaces("Isolierung entfernen");
  await toolbar(page).getByRole("button", { name: "Fokus", exact: true }).click();
  await idle(page);
  await noSpaces("Fokus");
  await toggleValue(page, "Geschoss", GROUND); // the ghost toggle is in the pill, shown while a filter is active
  await setGhosts(page, false);
  await noSpaces("ghosts off");
  await setGhosts(page, true);
  await noSpaces("ghosts on");
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-004-AC5 the rule `Isolieren` · `Kategorie` · `Enthält` · `wall` leaves only `IfcWallStandardCase` (13) in the Kategorie set, 12 after hiding one wall; a checked `IfcSlab` stays visible and checked with count 0", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  const ac5 = TOOLS["REQ-004-AC5"];
  await addRule(page, ac5.rule);
  expect(await shownCounts(page, "Kategorie")).toEqual(ac5.kategorieCounts);
  const [hidden] = await keysOfGuids(page, [ac5.afterHiding.GlobalId]);
  await panelAction(page, hidden, "hide");
  expect(await shownCounts(page, "Kategorie")).toEqual(ac5.afterHiding.kategorieCounts);

  // IfcSlab checked before the rule is applied: after it, IfcSlab stays visible, checked, with count 0 (DEC-14)
  await afterUpdate(page, () => page.getByRole("button", { name: "Alle Filter zurücksetzen" }).click());
  await toggleValue(page, "Kategorie", "IfcSlab");
  expect((await shownValues(page, "Kategorie")).find((v) => v.label === "IfcSlab")).toEqual({
    label: "IfcSlab",
    count: ac5.slabs,
    checked: true,
  });
  await addRule(page, ac5.rule);
  const values = await shownValues(page, "Kategorie");
  expect(values).toEqual([
    { label: "IfcSlab", count: 0, checked: true },
    { label: "IfcWallStandardCase", count: ac5.kategorieCounts.IfcWallStandardCase, checked: false },
  ]);
  await expect(status(page)).toHaveText(`0 von ${de(Y)} Elementen`);
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-004-AC6 the filter area lists `Ausgeblendet: 3 Elemente`, `Isoliert: 2 Elemente`, `Filterregeln: 2`, `Suche: „wand“`; × on `Ausgeblendet` returns only the hidden elements; one hidden element reads `Ausgeblendet: 1 Element`", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  const rows = [...(await rowsByKey(page)).values()];
  const windows = rows.filter((r) => r.values.Kategorie === "IfcWindow").map((r) => r.key);
  const [a, b] = await keysOfGuids(page, [ERDG1, ERDG2]);
  for (const key of windows.slice(0, 3)) await panelAction(page, key, "hide");
  await isolateTogether(page, [ERDG1, ERDG2]);
  await addRule(page, { mode: "mark", key: "Kategorie", op: "eq", value: "IfcSlab" });
  await addRule(page, { mode: "isolate", key: "Kategorie", op: "contains", value: "wall" });
  await afterUpdate(page, () =>
    filterPanel(page).getByRole("searchbox", { name: "Suchen nach Objekten" }).fill("wand"),
  );
  const all = ["Ausgeblendet: 3 Elemente", "Isoliert: 2 Elemente", "Filterregeln: 2", "Suche: „wand“"];
  expect(await sourceEntries(page)).toEqual(all);
  await expect(status(page)).toHaveText(`2 von ${de(Y)} Elementen`);

  // × on `Ausgeblendet: 3 Elemente`: only the hidden elements return; the other three entries stay
  await afterUpdate(page, () =>
    sourceEntry(page, "Ausgeblendet: 3 Elemente")
      .getByRole("button", { name: "Ausgeblendet: 3 Elemente entfernen" })
      .click(),
  );
  expect(await toolSets(page)).toEqual({ hidden: [], isolated: sorted([a, b]) });
  expect(await sourceEntries(page)).toEqual(all.slice(1));
  expect(await ruleTexts(page)).toHaveLength(2);
  expect(await page.evaluate(() => window.__calc.filter.search)).toBe("wand");

  // one hidden element: singular
  await panelAction(page, b, "hide");
  expect(await sourceEntries(page)).toEqual(["Ausgeblendet: 1 Element", ...all.slice(1)]);

  // the `Filterregeln` / `Suche` entry text opens the in-viewer filter panel; × clears only that source
  await toolbar(page).getByRole("button", { name: "Filter", exact: true }).click();
  await expect(filterPanel(page)).toBeHidden();
  await sourceEntry(page, "Filterregeln: 2").getByRole("button", { name: "Filterregeln: 2", exact: true }).click();
  await expect(filterPanel(page)).toBeVisible();
  await afterUpdate(page, () =>
    sourceEntry(page, "Suche: „wand“").getByRole("button", { name: "Suche: „wand“ entfernen" }).click(),
  );
  expect(await sourceEntries(page)).toEqual(["Ausgeblendet: 1 Element", "Isoliert: 2 Elemente", "Filterregeln: 2"]);
  await expect(filterPanel(page).getByRole("searchbox", { name: "Suchen nach Objekten" })).toHaveValue("");
  await afterUpdate(page, () =>
    sourceEntry(page, "Filterregeln: 2").getByRole("button", { name: "Filterregeln: 2 entfernen" }).click(),
  );
  expect(await sourceEntries(page)).toEqual(["Ausgeblendet: 1 Element", "Isoliert: 2 Elemente"]);
  expect(await ruleTexts(page)).toEqual([]);
  expect(errors).toEqual([]);
});

/**
 * Builds the state of REQ-004-AC4 on FZK: one hidden and one isolated wall, checked filter values, a column filter, two
 * rules (one `Markieren`), a search text, plus colouring, a section and ghosts off (which a reset must keep).
 */
async function ac4State(page) {
  const [isolated, hidden] = await keysOfGuids(page, [ERDG1, ERDG2]);
  await panelAction(page, hidden, "hide");
  await panelAction(page, isolated, "isolate");
  await toggleValue(page, "Kategorie", "IfcWallStandardCase");
  await checkColumnValue(page, "Geschoss", GROUND);
  await page.keyboard.press("Escape");
  await addRule(page, { mode: "mark", key: "Kategorie", op: "eq", value: "IfcSlab" });
  await addRule(page, { mode: "isolate", key: "Name", op: "starts", value: "Wand" });
  await afterUpdate(page, () =>
    filterPanel(page).getByRole("searchbox", { name: "Suchen nach Objekten" }).fill("erdg"),
  );
  await toolbar(page).getByRole("button", { name: "Filter", exact: true }).click(); // close the panel
  expect(await sourceEntries(page)).toEqual([
    "Ausgeblendet: 1 Element",
    "Isoliert: 1 Element",
    "Filterregeln: 2",
    "Suche: „erdg“",
  ]);
  await expect(status(page)).toHaveText(`1 von ${de(Y)} Elementen`);
}

/** Everything a reset must clear or keep, as data. */
async function resetSnapshot(page) {
  const s = await viewState(page);
  return {
    status: await page.locator("#cv-status").textContent(),
    entries: await sourceEntries(page),
    pills: await shownPills(page),
    active: await page.evaluate(() => window.__calc.filter.active),
    rules: await page.evaluate(() => window.__calc.filter.rules),
    search: await page.evaluate(() => window.__calc.filter.search),
    searchField: await page.locator("#cv-object-search").inputValue(),
    tools: await toolSets(page),
    columnFilters: await page.evaluate(() => window.CalcTable.state().columnFilters),
    tableRows: (await allTableRows(page)).length,
    kategorie: await shownValues(page, "Kategorie"),
    opaque: s.opaque,
    ghost: s.ghost,
    hidden: s.hidden,
    toolHidden: s.toolHidden,
    marked: s.marked,
    colours: s.colours,
    section: s.section,
    mode: s.mode,
    colourKey: await page.evaluate(() => window.__calc.view.colourKey),
  };
}

test("@e2e @acceptance @REQ-012-AC12 pill `Filter entfernen`: hidden without filter sources and rules; with only a `Markieren` rule entry `Filterregeln: 1`, the `Filter` dot and the pill first in the stack with the ghost toggle left and `Filter anzeigen` right, which opens the panel; in the REQ-004-AC4 state it equals `Alle Filter zurücksetzen`", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  await expect(page.locator("#cv-pill-filter")).toBeHidden();
  await addRule(page, { mode: "mark", key: "Kategorie", op: "eq", value: "IfcSlab" });
  expect(await page.evaluate(() => window.__calc.filter.active)).toEqual([]); // no filter source active
  expect(await sourceEntries(page)).toEqual(["Filterregeln: 1"]);
  await expect(toolbar(page).getByRole("button", { name: "Filter", exact: true })).toHaveClass(/cv-has-dot/);
  // colour the model so a second pill shows: `Filter entfernen` is the first in the stack
  await colourBy(page, "Kategorie", "Kategorie");
  expect(await shownPills(page)).toEqual(["Filter entfernen", "Einfärbung entfernen"]);
  const box = async (sel) => page.locator(sel).boundingBox();
  const [ghost, main, show] = [
    await box("#cv-ghost-toggle"),
    await box("#cv-pill-filter-reset"),
    await box("#cv-pill-filter-show"),
  ];
  expect(ghost.x + ghost.width).toBeLessThanOrEqual(main.x + 1);
  expect(main.x + main.width).toBeLessThanOrEqual(show.x + 1);
  await expect(page.locator("#cv-pill-filter-show")).toHaveAccessibleName("Filter anzeigen");
  await expect(filterPanel(page)).toBeHidden();
  await page.locator("#cv-pill-filter-show").click();
  await expect(filterPanel(page)).toBeVisible();
  await toolbar(page).getByRole("button", { name: "Filter", exact: true }).click();
  await expect(filterPanel(page)).toBeHidden();
  await afterUpdate(page, () => page.getByRole("button", { name: "Alle Filter zurücksetzen" }).click());

  // the state of REQ-004-AC4, reset once by `Alle Filter zurücksetzen` and once by the pill: the same result
  // a section: `Schneiden` in the click menu of a wall (TASK-017c; was the interim `Schnitt Z`)
  await cutAt(
    page,
    await firstPickable(
      page,
      await keysOfGuids(
        page,
        TOOLS.walls.map((w) => w.GlobalId),
      ),
    ),
  );
  await ac4State(page);
  await setGhosts(page, false);
  await afterUpdate(page, () => page.getByRole("button", { name: "Alle Filter zurücksetzen" }).click());
  const byButton = await resetSnapshot(page);
  await ac4State(page);
  await setGhosts(page, false);
  await afterUpdate(page, () => page.locator("#cv-pill-filter-reset").click());
  const byPill = await resetSnapshot(page);
  expect(byPill).toEqual(byButton);
  expect(byPill.entries).toEqual([]);
  expect(byPill.tools).toEqual({ hidden: [], isolated: null });
  expect(byPill.rules).toEqual([]);
  expect(byPill.status).toBe(`${de(Y)} von ${de(Y)} Elementen`);
  expect(byPill.section).not.toBeNull();
  expect(byPill.colourKey).toBe("Kategorie");
  expect(byPill.mode).toBe("hide");
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-012-AC14 a rule on a property only the removed Duplex model has shows `Eigenschaft nicht geladen` and is not applied; `Filterregeln: 1` stays; loading the model again applies it", async ({
  page,
}) => {
  const errors = await openWith(page, [FZK, DUPLEX]);
  const ac14 = TOOLS["REQ-012-AC14"];
  expect(ac14.fzkHasProperty).toBe(false);
  const total = await page.evaluate(() => window.__calc.rows.length);
  await addRule(page, { ...ac14.rule, query: ac14.property });
  const matched = async () =>
    page.evaluate(() => {
      const byKey = new Map(window.__calc.rows.map((r) => [r.key, r.guid]));
      return window.__calc.filter.keys.map((k) => byKey.get(k)).sort();
    });
  expect(await matched()).toEqual(ac14.globalIds);
  await expect(status(page)).toHaveText(`${de(ac14.count)} von ${de(total)} Elementen`);
  expect(await ruleTexts(page)).toEqual([`Isolieren: ${ac14.property} enthält „${ac14.rule.value}“`]);

  await removeModel(page, "Ifc2x3_Duplex_Architecture");
  await idle(page);
  await openFilterPanel(page);
  await expect(page.locator("#cv-rules .cv-rule-note")).toHaveText("Eigenschaft nicht geladen");
  await expect(status(page)).toHaveText(`${de(Y)} von ${de(Y)} Elementen`);
  expect((await viewState(page)).opaque).toEqual(await geometryKeys(page));
  expect(await sourceEntries(page)).toEqual(["Filterregeln: 1"]);

  await loadFiles(page, DUPLEX);
  await idle(page);
  await expect(page.locator("#cv-rules .cv-rule-note")).toHaveCount(0);
  expect(await matched()).toEqual(ac14.globalIds);
  await expect(status(page)).toHaveText(`${de(ac14.count)} von ${de(total)} Elementen`);
  expect(errors).toEqual([]);
});
