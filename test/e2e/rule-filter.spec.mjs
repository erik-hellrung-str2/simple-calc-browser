// TASK-015b in-viewer rule filter (spec REQ-012, DEC-19, DEC-21; CR-002; reference app ref L654-740, L1394-1430,
// L1498-1503, screenshots ref-04..07): dialog `Filter bearbeiten`, rule rows (edit, x), panel `Zurücksetzen`, pill
// `Filter entfernen` with rules. Expected key sets come from test/fixtures/reference-values.json section
// `REQ-012-rules` (derived from the IFC STEP text by scripts/ref/derive-reference.mjs with the DEC-19 matching written
// there independently of the product), never from the code under test.
import { readFileSync } from "node:fs";
import { test, expect } from "../support/network-guard.mjs";
import { REF, fixture, loadFiles, openBuilder, removeModel } from "../support/builder.mjs";
import { shownValues, toggleValue } from "../support/filter-area.mjs";
import { configFile, loadConfig } from "../support/config.mjs";
import { checkColumnValue, tableGuids } from "../support/table.mjs";
import { idle, viewState } from "../support/view-3d.mjs";
import { XSS_NAMES, xssFixture } from "../support/xss-fixture.mjs";
import { afterUpdate, sourceEntries } from "../support/tools.mjs";
import {
  addRule,
  addRuleLink,
  allKeys,
  dialogFields,
  editRule,
  filterKeys,
  filterPanel,
  filterUpdates,
  hookRules,
  keysOf,
  openFilterPanel,
  removeRule,
  ruleRows,
  ruleTexts,
  toolbar,
  waitFilterUpdate,
} from "../support/rules.mjs";

test.describe.configure({ timeout: 180_000 });

const FZK = fixture("AC20-FZK-Haus.ifc");
const DUPLEX = fixture("Ifc2x3_Duplex_Architecture.ifc");
const R = REF["REQ-012-rules"];
const de = (n) => n.toLocaleString("de-DE");
const status = (page) => page.locator("#cv-status");
const panelStatus = (page) => page.locator("#cv-filter-status");
const pill = (page) => page.locator("#cv-pill-filter");

// every STEP element of AC20-FZK-Haus is a row except IfcOpeningElement (as view-tools.spec / filter-area.spec)
const FZK_TOTAL = Object.entries(REF["AC20-FZK-Haus"].elementsInStepTextByKategorie)
  .filter(([k]) => k !== "IfcOpeningElement")
  .reduce((sum, [, n]) => sum + n, 0);

async function openWith(page, files) {
  const errors = await openBuilder(page);
  await loadFiles(page, files);
  await idle(page);
  return errors;
}

/** Keys of all rows except those with the given GlobalIds, sorted. */
async function allBut(page, guids) {
  const removed = new Set(await keysOf(page, guids));
  return (await allKeys(page)).filter((k) => !removed.has(k));
}

test("@e2e @acceptance @REQ-012-AC2 `+ Filter hinzufügen` opens `Filter bearbeiten` with the reference's actions and comparisons; `Eigenschaft` suggests catalogue properties with their group; `Wert` suggests the property's values", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  expect(R.rows).toBe(FZK_TOTAL);
  await openFilterPanel(page);
  await addRuleLink(page).click();
  const f = dialogFields(page);
  await expect(f.dialog).toBeVisible();
  await expect(f.dialog.locator(".cv-dialog-title")).toHaveText("Filter bearbeiten");
  // Aktion: exactly the four actions, `Isolieren` selected
  expect(await f.mode.locator("option").allTextContents()).toEqual([
    "Isolieren",
    "Ausblenden",
    "Markieren",
    "Freie Textsuche",
  ]);
  expect(await f.mode.evaluate((s) => s.selectedOptions[0].textContent)).toBe("Isolieren");
  // Vergleich: exactly the four comparisons, `Enthält` selected
  expect(await f.op.locator("option").allTextContents()).toEqual(["Gleich", "Beginnt mit", "Endet mit", "Enthält"]);
  expect(await f.op.evaluate((s) => s.selectedOptions[0].textContent)).toBe("Enthält");
  await expect(f.property).toHaveAttribute("placeholder", "Eigenschaft");
  await expect(f.value).toHaveAttribute("placeholder", "Wert");
  await expect(f.property).toHaveValue("");
  await expect(f.value).toHaveValue("");
  await expect(f.cancel).toBeVisible();
  await expect(f.apply).toBeVisible();
  // one row of four fields in the reference's order (Aktion, Eigenschaft, Vergleich, Wert), 860 px wide dialog
  const boxes = await Promise.all([f.mode, f.property, f.op, f.value].map((l) => l.boundingBox()));
  expect(new Set(boxes.map((b) => Math.round(b.y))).size, "one row").toBe(1);
  expect(boxes.map((b) => b.x)).toEqual([...boxes.map((b) => b.x)].sort((a, b) => a - b));
  expect(Math.round((await f.dialog.boundingBox()).width)).toBe(860);
  // `Anwenden` is the red primary button
  expect(await f.apply.evaluate((b) => getComputedStyle(b).backgroundColor)).toBe("rgb(215, 38, 34)");

  // typing `Length` lists BaseQuantities.Length with its group (grey, below the label)
  await f.property.fill("Length");
  await expect(f.suggestions).toBeVisible();
  const option = f.suggestions.getByRole("option").filter({ hasText: /^BaseQuantities\.Length/ });
  await expect(option).toHaveCount(1);
  await expect(option.locator(".cv-suggest-label")).toHaveText("BaseQuantities.Length");
  await expect(option.locator(".cv-suggest-group")).toHaveText("BaseQuantities");
  const [labelBox, groupBox] = await Promise.all([
    option.locator(".cv-suggest-label").boundingBox(),
    option.locator(".cv-suggest-group").boundingBox(),
  ]);
  expect(groupBox.y).toBeGreaterThan(labelBox.y);
  expect(await option.locator(".cv-suggest-group").evaluate((n) => getComputedStyle(n).color)).toBe(
    "rgb(107, 111, 115)",
  );
  // every suggestion contains `length` in its label or group
  for (const text of await f.suggestions.getByRole("option").allTextContents())
    expect(text.toLowerCase()).toContain("length");

  // choosing `Kategorie`: the `Wert` suggestions are the Kategorie values of the model
  await f.property.fill("Kategorie");
  await f.suggestions.locator('[role=option][data-key="Kategorie"]').click();
  await expect(f.suggestions).toBeHidden();
  await expect(f.property).toHaveValue("Kategorie");
  const listId = await f.value.getAttribute("list");
  const values = await page.locator(`datalist#${listId} option`).evaluateAll((os) => os.map((o) => o.value));
  expect(values).toEqual(R.kategorien);

  // `Esc` closes the dialog without a rule; focus returns to `+ Filter hinzufügen`
  await page.keyboard.press("Escape");
  await expect(f.dialog).toBeHidden();
  await expect(addRuleLink(page)).toBeFocused();
  await expect(filterPanel(page)).toBeVisible();
  expect(await hookRules(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test("@e2e `Eigenschaft` lists at most 50 suggestions then `+<n> mehr`; arrow keys and Enter pick a suggestion; the backdrop closes the dialog", async ({
  page,
}) => {
  await openWith(page, FZK);
  await openFilterPanel(page);
  await addRuleLink(page).click();
  const f = dialogFields(page);
  await f.property.focus();
  await expect(f.suggestions).toBeVisible();
  // the empty query lists the catalogue: 50 entries, the rest as `+<n> mehr`
  const size = await page.evaluate(() => window.__calc.catalog.length);
  expect(size).toBeGreaterThan(50);
  await expect(f.suggestions.getByRole("option")).toHaveCount(50);
  await expect(f.suggestions.locator(".cv-suggest-more")).toHaveText(`+${de(size - 50)} mehr`);
  // keyboard: ArrowDown highlights the first `Allgemein` entry (Kategorie), Enter picks it without applying
  await f.property.fill("Kategorie");
  await f.property.press("ArrowDown");
  await expect(f.suggestions.locator('[role=option][aria-selected="true"]')).toHaveAttribute("data-key", "Kategorie");
  await f.property.press("Enter");
  await expect(f.suggestions).toBeHidden();
  await expect(f.property).toHaveValue("Kategorie");
  await expect(f.dialog).toBeVisible();
  // a text without a matching property
  await f.property.fill("gibtsnicht");
  await expect(f.suggestions).toBeHidden(); // no match: no list (as the reference)
  await expect(f.property).toHaveAttribute("aria-expanded", "false");
  // a press on the backdrop closes the dialog without a rule
  await page.mouse.click(5, 5);
  await expect(f.dialog).toBeHidden();
  expect(await hookRules(page)).toEqual([]);
});

test("@e2e @acceptance @REQ-012-AC3 `Isolieren` · `Kategorie` · `Enthält` · `wall` keeps exactly the 13 walls in table, 3D, status line and panel status; the rule row reads `Isolieren: Kategorie enthält „wall“`", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  const ac3 = R["REQ-012-AC3"];
  expect(ac3.count).toBe(13);
  expect(ac3.matchingKategorien).toEqual(["IfcWallStandardCase"]);
  const expected = await keysOf(page, ac3.globalIds);
  await addRule(page, { mode: "isolate", key: "Kategorie", op: "contains", value: "wall" });
  expect(await filterKeys(page)).toEqual(expected);
  expect((await tableGuids(page)).sort()).toEqual(ac3.globalIds);
  const state = await viewState(page);
  expect(state.opaque).toEqual(expected);
  await expect(status(page)).toHaveText(`13 von ${de(FZK_TOTAL)} Elementen`);
  await expect(panelStatus(page)).toHaveText(`13 von ${de(FZK_TOTAL)} Objekten sichtbar`);
  await expect(ruleRows(page)).toHaveCount(1);
  expect(await ruleTexts(page)).toEqual(["Isolieren: Kategorie enthält „wall“"]);
  // action in red (bold), the rest in ink, as the reference
  const mode = ruleRows(page).first().locator(".cv-rule-mode");
  await expect(mode).toHaveText("Isolieren: ");
  expect(await mode.evaluate((n) => getComputedStyle(n).color)).toBe("rgb(215, 38, 34)");
  expect(await hookRules(page)).toEqual([{ mode: "isolate", key: "Kategorie", op: "contains", value: "wall" }]);
  // a rule makes the panel `Zurücksetzen`, the `Filter` dot and the pill `Filter entfernen` appear
  await expect(filterPanel(page).getByRole("button", { name: "Zurücksetzen" })).toBeVisible();
  await expect(toolbar(page).getByRole("button", { name: "Filter", exact: true })).toHaveClass(/cv-has-dot/);
  await expect(pill(page)).toBeVisible();
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-012-AC4 `Ausblenden` · `Material` · `Enthält` removes the elements with that material and keeps those without `Material`; as `Isolieren` only they remain", async ({
  page,
}) => {
  await openWith(page, FZK);
  const ac4 = R["REQ-012-AC4"];
  expect(ac4.withoutMaterial.count).toBeGreaterThan(0);
  const matching = await keysOf(page, ac4.matching.globalIds);
  const noMaterial = await keysOf(page, ac4.withoutMaterial.globalIds);
  await addRule(page, { mode: "hide", key: "Material", op: "contains", value: ac4.value });
  const kept = await filterKeys(page);
  expect(kept).toEqual(await allBut(page, ac4.matching.globalIds));
  expect(
    noMaterial.every((k) => kept.includes(k)),
    "elements without Material stay",
  ).toBe(true);
  await expect(status(page)).toHaveText(`${de(FZK_TOTAL - ac4.matching.count)} von ${de(FZK_TOTAL)} Elementen`);
  expect(await ruleTexts(page)).toEqual([`Ausblenden: Material enthält „${ac4.value}“`]);
  // the action changed to `Isolieren` (edit the rule): only the elements with the material remain
  await editRule(page, 0, { mode: "isolate" });
  const isolated = await filterKeys(page);
  expect(isolated).toEqual(matching);
  expect(
    noMaterial.some((k) => isolated.includes(k)),
    "elements without Material are removed",
  ).toBe(false);
  expect((await viewState(page)).opaque).toEqual(matching);
  expect(await ruleTexts(page)).toEqual([`Isolieren: Material enthält „${ac4.value}“`]);
});

test("@e2e @acceptance @REQ-012-AC5 rules compare the display text: `Gleich` `0,3` matches and `0.3` does not, `Beginnt mit` `0,` and `Endet mit` `,3` match, `Gleich` `ja` matches `Ja`, an empty value matches no rule", async ({
  page,
}) => {
  await openWith(page, FZK);
  const ac5 = R["REQ-012-AC5"];
  const num = ac5.number;
  expect(num.valuesShown0_3).toBeGreaterThan(0);
  const byCase = (op, value) => num.cases.find((c) => c.op === op && c.value === value).globalIds;
  expect(byCase("eq", "0.3")).toEqual([]);
  // displayed `0,3` in the table for one of those elements (the same text the rule compares)
  const shown = await page.evaluate(({ guid, key }) => window.__calc.rows.find((r) => r.guid === guid).values[key], {
    guid: byCase("eq", "0,3")[0],
    key: num.property,
  });
  expect(shown.toLocaleString("de-DE", { maximumFractionDigits: 3 })).toBe("0,3");

  await addRule(page, { mode: "isolate", key: num.property, query: "Width", op: "eq", value: "0,3" });
  expect(await filterKeys(page)).toEqual(await keysOf(page, byCase("eq", "0,3")));
  await editRule(page, 0, { value: "0.3" });
  expect(await filterKeys(page)).toEqual([]);
  await expect(status(page)).toHaveText(`0 von ${de(FZK_TOTAL)} Elementen`);
  await editRule(page, 0, { op: "starts", value: "0," });
  expect(await filterKeys(page)).toEqual(await keysOf(page, byCase("starts", "0,")));
  await editRule(page, 0, { op: "ends", value: ",3" });
  expect(await filterKeys(page)).toEqual(await keysOf(page, byCase("ends", ",3")));
  // empty value: `Ausblenden` keeps every element without the property (it matches no rule)
  await editRule(page, 0, { mode: "hide", op: "starts", value: "0," });
  const kept = await filterKeys(page);
  expect(kept).toEqual(await allBut(page, byCase("starts", "0,")));
  const withoutWidth = await page.evaluate(
    (key) => window.__calc.rows.filter((r) => r.values[key] === undefined || r.values[key] === null).map((r) => r.key),
    num.property,
  );
  expect(withoutWidth).toHaveLength(num.withoutValue);
  expect(withoutWidth.every((k) => kept.includes(k))).toBe(true);
  // a boolean shown `Ja`: `Gleich` `ja` matches it
  await removeRule(page, 0);
  expect(await ruleRows(page).count()).toBe(0);
  await addRule(page, { mode: "isolate", key: ac5.boolean.property, query: "LoadBearing", op: "eq", value: "ja" });
  expect(ac5.boolean.ja.count).toBeGreaterThan(0);
  expect(await filterKeys(page)).toEqual(await keysOf(page, ac5.boolean.ja.globalIds));
});

test("@e2e @acceptance @REQ-012-AC5 a multi-valued property matches when any of its values matches", async ({
  page,
}) => {
  await openWith(page, DUPLEX);
  const multi = R["REQ-012-AC5"].multi;
  expect(multi.elementMaterial.length).toBeGreaterThan(1);
  expect(multi.multiValued).toBeGreaterThan(0);
  await addRule(page, multi.rule);
  const keys = await filterKeys(page);
  expect(keys).toEqual(await keysOf(page, multi.globalIds));
  const [element] = await keysOf(page, [multi.element.GlobalId]);
  expect(keys).toContain(element);
  const material = await page.evaluate((k) => window.__calc.rows.find((r) => r.key === k).values.Material, element);
  expect(material.length, "the element has several materials").toBeGreaterThan(1);
});

test("@e2e @acceptance @REQ-012-AC6 `Freie Textsuche` · `Gleich` · <GlobalId> disables `Eigenschaft` and keeps exactly that wall; the row reads `Freie Textsuche: Beliebige Eigenschaft gleich „<GlobalId>“`", async ({
  page,
}) => {
  await openWith(page, FZK);
  const ac6 = R["REQ-012-AC6"];
  expect(ac6.count).toBe(1);
  await openFilterPanel(page);
  await addRuleLink(page).click();
  const f = dialogFields(page);
  await expect(f.property).toBeEnabled();
  await f.mode.selectOption({ label: "Freie Textsuche" });
  await expect(f.property).toBeDisabled();
  await f.op.selectOption({ label: "Gleich" });
  await f.value.fill(ac6.GlobalId);
  const before = await filterUpdates(page);
  await f.apply.click();
  await expect(f.dialog).toBeHidden();
  await waitFilterUpdate(page, before);
  expect(await filterKeys(page)).toEqual(await keysOf(page, ac6.globalIds));
  await expect(status(page)).toHaveText(`1 von ${de(FZK_TOTAL)} Elementen`);
  expect(await ruleTexts(page)).toEqual([`Freie Textsuche: Beliebige Eigenschaft gleich „${ac6.GlobalId}“`]);
  expect(await hookRules(page)).toEqual([{ mode: "text", key: null, op: "eq", value: ac6.GlobalId }]);
  // reopened: the property stays disabled and empty
  await ruleRows(page).first().locator(".cv-rule-text").click();
  await expect(f.property).toBeDisabled();
  await expect(f.property).toHaveValue("");
  await expect(f.value).toHaveValue(ac6.GlobalId);
  await f.cancel.click();
});

test("@e2e @acceptance @REQ-012-AC8 filter set, column filter and two rules combine with AND: exactly the other wall remains", async ({
  page,
}) => {
  await openWith(page, FZK);
  const ac8 = R["REQ-012-AC8"];
  await toggleValue(page, "Geschoss", ac8.Geschoss);
  for (const name of ac8.names) await checkColumnValue(page, "Name", name, name);
  await page.keyboard.press("Escape"); // close the column filter popup
  for (const rule of ac8.rules) await addRule(page, rule);
  expect(ac8.count).toBe(1);
  expect(await filterKeys(page)).toEqual(await keysOf(page, ac8.globalIds));
  expect(await tableGuids(page)).toEqual(ac8.globalIds);
  await expect(status(page)).toHaveText(`1 von ${de(FZK_TOTAL)} Elementen`);
  expect(await ruleTexts(page)).toEqual([
    "Isolieren: Kategorie enthält „wall“",
    `Ausblenden: Name endet mit „${ac8.rules[1].value}“`,
  ]);
});

test("@e2e @acceptance @REQ-012-AC10 a rule row's text edits the rule in place, its × removes it, panel `Zurücksetzen` clears rules and search but keeps filter-set values and column filters", async ({
  page,
}) => {
  await openWith(page, FZK);
  const ac8 = R["REQ-012-AC8"];
  await toggleValue(page, "Geschoss", ac8.Geschoss);
  await checkColumnValue(page, "Name", ac8.names[0], ac8.names[0]);
  await page.keyboard.press("Escape");
  const first = { mode: "isolate", key: "Kategorie", op: "contains", value: "wall" };
  const second = { mode: "hide", key: "Name", op: "ends", value: "ERDG-2" };
  await addRule(page, first);
  await addRule(page, second);
  expect(await hookRules(page)).toEqual([first, second]);
  // the first rule's text reopens the dialog with its values
  await ruleRows(page).first().locator(".cv-rule-text").click();
  const f = dialogFields(page);
  await expect(f.dialog).toBeVisible();
  expect(await f.mode.evaluate((s) => s.selectedOptions[0].textContent)).toBe("Isolieren");
  await expect(f.property).toHaveValue("Kategorie");
  expect(await f.op.evaluate((s) => s.selectedOptions[0].textContent)).toBe("Enthält");
  await expect(f.value).toHaveValue("wall");
  await f.value.fill("ifcwallstandard");
  let before = await filterUpdates(page);
  await f.apply.click();
  await waitFilterUpdate(page, before);
  // replaced in place: still two rules, the first one changed
  expect(await hookRules(page)).toEqual([{ ...first, value: "ifcwallstandard" }, second]);
  expect(await ruleTexts(page)).toEqual([
    "Isolieren: Kategorie enthält „ifcwallstandard“",
    "Ausblenden: Name endet mit „ERDG-2“",
  ]);
  expect(await filterKeys(page)).toEqual(await keysOf(page, ac8.globalIds)); // Wand-Ext-ERDG-1 (same AND result)
  // x removes the first rule
  await removeRule(page, 0);
  expect(await hookRules(page)).toEqual([second]);
  expect(await ruleTexts(page)).toEqual(["Ausblenden: Name endet mit „ERDG-2“"]);
  // a search text, then panel `Zurücksetzen`
  const searchbox = page.getByRole("searchbox", { name: "Suchen nach Objekten" });
  before = await filterUpdates(page);
  await searchbox.fill("wand");
  await waitFilterUpdate(page, before);
  expect(await page.evaluate(() => window.__calc.filter.search)).toBe("wand");
  before = await filterUpdates(page);
  await filterPanel(page).getByRole("button", { name: "Zurücksetzen" }).click();
  await waitFilterUpdate(page, before);
  expect(await hookRules(page)).toEqual([]);
  await expect(ruleRows(page)).toHaveCount(0);
  await expect(searchbox).toHaveValue("");
  expect(await page.evaluate(() => window.__calc.filter.search)).toBe("");
  await expect(filterPanel(page).getByRole("button", { name: "Zurücksetzen" })).toBeHidden();
  // filter-set value and column filter stay
  const active = await page.evaluate(() => window.__calc.filter.active.map((f) => [f.id, f.values]));
  expect(active).toEqual([
    ["Geschoss", [ac8.Geschoss]],
    ["col:Name", [ac8.names[0]]],
  ]);
  expect(await filterKeys(page)).toEqual(await keysOf(page, ac8.globalIds));
});

test("@e2e @acceptance @REQ-012-AC11 `Anwenden` with an empty or unknown `Eigenschaft` or an empty `Wert` marks the field and keeps the dialog open; the exact label `Name` is accepted; `Abbrechen` and `Esc` change nothing", async ({
  page,
}) => {
  await openWith(page, FZK);
  await openFilterPanel(page);
  await addRuleLink(page).click();
  const f = dialogFields(page);
  const invalid = async (locator, yes) => {
    if (yes) {
      await expect(locator).toHaveClass(/cv-invalid/);
      await expect(locator).toHaveAttribute("aria-invalid", "true");
      expect(
        await locator.evaluate((n) => [getComputedStyle(n).borderTopColor, getComputedStyle(n).backgroundColor]),
      ).toEqual(["rgb(215, 38, 34)", "rgb(253, 243, 242)"]);
    } else {
      await expect(locator).not.toHaveClass(/cv-invalid/);
      await expect(locator).not.toHaveAttribute("aria-invalid", "true");
    }
  };
  const updates = await filterUpdates(page);
  // empty Eigenschaft (action Isolieren), value given
  await f.value.fill("Wand");
  await f.apply.click();
  await expect(f.dialog).toBeVisible();
  await invalid(f.property, true);
  await invalid(f.value, false);
  // unknown label
  await f.property.fill("Gibtsnicht");
  await invalid(f.property, false); // typing clears the mark
  await f.apply.click();
  await expect(f.dialog).toBeVisible();
  await invalid(f.property, true);
  // exact label `Name`, empty value
  await f.property.fill("Name");
  await f.value.fill("");
  await f.apply.click();
  await expect(f.dialog).toBeVisible();
  await invalid(f.property, false);
  await invalid(f.value, true);
  expect(await filterUpdates(page)).toBe(updates);
  expect(await hookRules(page)).toEqual([]);
  // `Name` typed exactly (not picked) and a value: applied
  await f.value.fill("Wand");
  const before = await filterUpdates(page);
  await f.apply.click();
  await expect(f.dialog).toBeHidden();
  await waitFilterUpdate(page, before);
  expect(await hookRules(page)).toEqual([{ mode: "isolate", key: "Name", op: "contains", value: "Wand" }]);
  expect(await ruleTexts(page)).toEqual(["Isolieren: Name enthält „Wand“"]);

  // `Abbrechen` and `Esc` close without change (also when editing)
  const keys = await filterKeys(page);
  const after = await filterUpdates(page);
  await addRuleLink(page).click();
  await f.property.fill("Kategorie");
  await f.value.fill("slab");
  await f.cancel.click();
  await expect(f.dialog).toBeHidden();
  await addRuleLink(page).click();
  await f.property.fill("Kategorie");
  await f.value.fill("slab");
  await page.keyboard.press("Escape");
  await expect(f.dialog).toBeHidden();
  await expect(filterPanel(page)).toBeVisible(); // Esc closed only the dialog
  await ruleRows(page).first().locator(".cv-rule-text").click();
  await f.value.fill("anders");
  await page.keyboard.press("Escape");
  await expect(f.dialog).toBeHidden();
  await expect(ruleRows(page).first().locator(".cv-rule-text")).toBeFocused();
  expect(await filterUpdates(page)).toBe(after);
  expect(await hookRules(page)).toEqual([{ mode: "isolate", key: "Name", op: "contains", value: "Wand" }]);
  expect(await filterKeys(page)).toEqual(keys);
});

test("@e2e pill `Filter entfernen` with rules: shown for a rule alone, its reset clears rules, search, filter-set values and column filters", async ({
  page,
}) => {
  await openWith(page, FZK);
  await expect(pill(page)).toBeHidden();
  // a `Markieren` rule is listed and shows the pill, but removes nothing (no filter source, DEC-19)
  await addRule(page, { mode: "mark", key: "Kategorie", op: "eq", value: "IfcSlab" });
  expect(await ruleTexts(page)).toEqual(["Markieren: Kategorie gleich „IfcSlab“"]);
  await expect(status(page)).toHaveText(`${de(FZK_TOTAL)} von ${de(FZK_TOTAL)} Elementen`);
  await expect(pill(page)).toBeVisible();
  await expect(filterPanel(page).getByRole("button", { name: "Zurücksetzen" })).toBeVisible();
  // more sources: a rule that filters, a filter-set value, a column filter, a search
  await addRule(page, { mode: "isolate", key: "Kategorie", op: "contains", value: "wall" });
  await toggleValue(page, "Geschoss", "Erdgeschoss");
  await checkColumnValue(page, "Name", "Wand-Ext-ERDG-1", "Wand-Ext-ERDG-1");
  await page.keyboard.press("Escape");
  let before = await filterUpdates(page);
  await page.getByRole("searchbox", { name: "Suchen nach Objekten" }).fill("wand");
  await waitFilterUpdate(page, before);
  before = await filterUpdates(page);
  await page.locator("#cv-pill-filter-reset").click();
  await waitFilterUpdate(page, before);
  expect(await hookRules(page)).toEqual([]);
  await expect(ruleRows(page)).toHaveCount(0);
  expect(await page.evaluate(() => window.__calc.filter.active)).toEqual([]);
  await expect(page.getByRole("searchbox", { name: "Suchen nach Objekten" })).toHaveValue("");
  await expect(status(page)).toHaveText(`${de(FZK_TOTAL)} von ${de(FZK_TOTAL)} Elementen`);
  await expect(pill(page)).toBeHidden();
  // `Alle Filter zurücksetzen` in the filter area clears rules too
  await addRule(page, { mode: "isolate", key: "Kategorie", op: "contains", value: "wall" });
  before = await filterUpdates(page);
  await page.locator("#cv-reset-all").click();
  await waitFilterUpdate(page, before);
  expect(await hookRules(page)).toEqual([]);
  await expect(status(page)).toHaveText(`${de(FZK_TOTAL)} von ${de(FZK_TOTAL)} Elementen`);
});

test("@e2e @robustness rule values and `Wert` suggestions with HTML are rendered as text: nothing is added to the DOM, no script runs", async ({
  page,
}) => {
  const errors = await openBuilder(page);
  await loadFiles(page, xssFixture());
  await idle(page);
  const imgs = () => page.evaluate(() => document.querySelectorAll("img").length);
  const scripts = () => page.evaluate(() => document.querySelectorAll("script").length);
  const [img0, script0] = [await imgs(), await scripts()];
  const html = "<img src=x onerror=window.__xss=9>";
  await addRule(page, { mode: "hide", key: "Name", op: "contains", value: html });
  expect(await ruleTexts(page)).toEqual([`Ausblenden: Name enthält „${html}“`]);
  // the `Wert` suggestions of `Name` include the HTML wall names as option values (text)
  await ruleRows(page).first().locator(".cv-rule-text").click();
  const f = dialogFields(page);
  const listId = await f.value.getAttribute("list");
  const values = await page.locator(`datalist#${listId} option`).evaluateAll((os) => os.map((o) => o.value));
  for (const name of Object.values(XSS_NAMES)) expect(values).toContain(name);
  // the `Eigenschaft` suggestions show the HTML pset name as text
  await f.property.fill("Pset_WallCommon");
  await expect(f.suggestions.getByRole("option").first()).toBeVisible();
  expect(await f.suggestions.locator("b").count()).toBe(0);
  await f.cancel.click();
  expect(await imgs()).toBe(img0);
  expect(await scripts()).toBe(script0);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  expect(errors).toEqual([]);
});

/**
 * A copy of AC20-FZK-Haus.ifc (in memory) whose wall Wand-Int-ERDG-4 is named `Wärme-Wand` (STEP \X2\ encoding as the
 * model's own umlauts); no other value of the original text contains `wärme` in any letter case, so exactly this wall
 * matches.
 */
function umlautFixture() {
  const text = readFileSync(FZK, "latin1");
  // the model's own `Wärme...` strings are property names with an empty IfcLabel value: DEC-19 searches values only
  // and never matches an empty value, so they match nothing
  const values = text.replace(/IFCPROPERTYSINGLEVALUE\('W\\X2\\00E4\\X0\\rme[^']*',\$,IFCLABEL\(''\),\$\)/g, "");
  expect(/\\X2\\00E4\\X0\\rme|\\X2\\00C4\\X0\\RME|waerme/i.test(values)).toBe(false);
  const re = new RegExp(`(IFCWALLSTANDARDCASE\\('${UMLAUT_WALL}',#\\d+,)'[^']*'`);
  expect(re.test(text)).toBe(true);
  const out = text.replace(re, (_, head) => `${head}'W\\X2\\00E4\\X0\\rme-Wand'`);
  return { name: "fzk-waerme.ifc", mimeType: "application/octet-stream", buffer: Buffer.from(out, "latin1") };
}
const UMLAUT_WALL = "2XPyKWY018sA1ygZKgQPtU"; // Wand-Int-ERDG-4

// TASK-017a completes REQ-012-AC13 (the literal rendering of rule rows and suggestions is also tested above without the
// AC ID): the filter-area entries `Filterregeln` / `Suche` and umlauts.
test("@e2e @robustness @acceptance @REQ-012-AC13 HTML / script rule values and search texts are shown literally in rule rows, entries and the dialog; nothing is added to the DOM, no script runs; `Wärme` matches `wärme` and `WÄRME`", async ({
  page,
}) => {
  const errors = await openBuilder(page);
  const dialogs = [];
  page.on("dialog", (d) => {
    dialogs.push(d.message());
    d.dismiss().catch(() => {});
  });
  await loadFiles(page, umlautFixture());
  await idle(page);
  const count = (sel) => page.evaluate((s) => document.querySelectorAll(s).length, sel);
  const [img0, script0] = [await count("img"), await count("script")];
  const imgValue = "<img src=x onerror=alert(1)>";
  const scriptText = "<script>window.__xss=5</script>";

  await addRule(page, { mode: "hide", key: "Name", op: "contains", value: imgValue });
  expect(await ruleTexts(page)).toEqual([`Ausblenden: Name enthält „${imgValue}“`]);
  await afterUpdate(page, () =>
    filterPanel(page).getByRole("searchbox", { name: "Suchen nach Objekten" }).fill(scriptText),
  );
  expect(await sourceEntries(page)).toEqual(["Filterregeln: 1", `Suche: „${scriptText}“`]);
  // the dialog shows the rule's value as it was typed
  await ruleRows(page).first().locator(".cv-rule-text").click();
  await expect(dialogFields(page).value).toHaveValue(imgValue);
  await dialogFields(page).cancel.click();
  expect(await count("img")).toBe(img0);
  expect(await count("script")).toBe(script0);
  expect(await count("#cv-fa-sources *:not(li):not(span):not(button):not(svg):not(path):not(rect):not(g)")).toBe(0);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  expect(dialogs).toEqual([]);

  // umlauts: `Wärme` matches case-insensitively
  await afterUpdate(page, () => page.getByRole("button", { name: "Alle Filter zurücksetzen" }).click());
  const [wall] = await keysOf(page, [UMLAUT_WALL]);
  expect(await page.evaluate((k) => window.__calc.rows.find((r) => r.key === k).values.Name, wall)).toBe("Wärme-Wand");
  for (const text of ["wärme", "WÄRME"]) {
    await afterUpdate(page, () =>
      filterPanel(page).getByRole("searchbox", { name: "Suchen nach Objekten" }).fill(text),
    );
    expect(await filterKeys(page), `search ${text}`).toEqual([wall]);
    expect(await sourceEntries(page)).toEqual([`Suche: „${text}“`]);
  }
  await afterUpdate(page, () => filterPanel(page).getByRole("searchbox", { name: "Suchen nach Objekten" }).fill(""));
  await addRule(page, { mode: "isolate", key: "Name", op: "contains", value: "WÄRME" });
  expect(await filterKeys(page)).toEqual([wall]);
  await editRule(page, 0, { value: "wärme-wand", op: "eq" });
  expect(await filterKeys(page)).toEqual([wall]);
  expect(await ruleTexts(page)).toEqual(["Isolieren: Name gleich „wärme-wand“"]);
  expect(errors).toEqual([]);
});

/**
 * Holds the display-text index build open (verification INC-2): the 0 ms timeout of the pause after the last chunk
 * (panel status `Eigenschaften werden gelesen ... 100 %`) is kept back once `window.__holdPause` is set, until the test
 * calls `window.__heldPause()`. The committed fixtures need one chunk, so this gives the window a model with more than
 * one chunk (> 2,000 rows) has naturally.
 */
async function holdIndexPause(page) {
  await page.addInitScript(() => {
    const original = window.setTimeout;
    window.__heldPause = null;
    window.__holdPause = false;
    window.setTimeout = function (fn, delay, ...rest) {
      const node = document.getElementById("cv-filter-status");
      if (
        window.__holdPause &&
        !delay &&
        node &&
        node.textContent === "Eigenschaften werden gelesen ... 100 %" &&
        typeof fn === "function"
      ) {
        window.__holdPause = false; // one-shot: only the pause of this build
        window.__heldPause = () => fn(...rest);
        return 0;
      }
      return original.call(this, fn, delay, ...rest);
    };
  });
}

// Verification INC-2 CODE-1: the panel opens and starts the display-text index build (status `Eigenschaften werden
// gelesen ... N %`); a model is removed before the build ends. The panel status must then show `X von Y Objekten
// sichtbar` of the remaining row set, also after the old build finishes. The committed fixtures need one chunk, so the
// build is held open: the 0 ms timeout of the pause after the last chunk (status at `... 100 %`) is kept back until
// the test releases it (the window a model with more than one chunk has naturally). Fails before the fix: the status
// stays `Eigenschaften werden gelesen ... 100 %`.
test("@e2e @robustness @REQ-012 a model removed while the filter panel builds the display-text index: the panel status shows the remaining row set (INC-2 CODE-1)", async ({
  page,
}) => {
  await holdIndexPause(page);
  const errors = await openBuilder(page);
  await loadFiles(page, [DUPLEX, FZK]);
  await idle(page);
  const both = await page.evaluate(() => window.__calc.rows.length);
  await page.evaluate(() => (window.__holdPause = true));
  await openFilterPanel(page);
  await expect(panelStatus(page)).toHaveText("Eigenschaften werden gelesen ... 100 %");
  await expect.poll(() => page.evaluate(() => typeof window.__heldPause)).toBe("function");
  await removeModel(page, "AC20-FZK-Haus");
  const left = await page.evaluate(() => window.__calc.rows.length);
  expect(left).toBeGreaterThan(0);
  expect(left).toBeLessThan(both); // the remaining row set (Duplex only)
  const want = `${de(left)} von ${de(left)} Objekten sichtbar`;
  await expect(panelStatus(page)).toHaveText(want);
  // the old build ends now: it must not bring the progress text back or leave it
  await page.evaluate(() => window.__heldPause());
  await page.waitForTimeout(300);
  await expect(panelStatus(page)).toHaveText(want);
  await expect(status(page)).toContainText(de(left));
  // the new row set builds its own index on first use: a search still works and the status follows it
  await page.getByRole("searchbox", { name: "Suchen nach Objekten" }).fill("zzz-kein-Treffer-zzz");
  await expect(panelStatus(page)).toHaveText(`0 von ${de(left)} Objekten sichtbar`);
  expect(errors).toEqual([]);
});

// Verification INC-2 CODE-2 (spec Testing T7: huge / odd configuration files): a configuration with 20,000 rules
// (`Ausblenden: Name ist gleich „x<N>“`, none matches) loads, every rule is listed, and a later filter interaction
// keeps the unchanged rule rows (fails before the fix: every refresh rebuilt all 20,000 rows). The evaluation itself
// stays linear in the rule count (known limitation, docs/tasks/TASK-018.md "Verification INC-2").
test("@e2e @robustness @REQ-012 a configuration with 20,000 filter rules: all applied and listed; an interaction does not rebuild the unchanged rule rows (INC-2 CODE-2)", async ({
  page,
}) => {
  const errors = await openBuilder(page);
  await loadFiles(page, FZK);
  await idle(page);
  const N = 20_000;
  const config = {
    schema: "calc-viewer-config/1",
    filterRules: Array.from({ length: N }, (_, i) => ({ mode: "hide", key: "Name", op: "eq", value: "x" + i })),
  };
  const last = await loadConfig(page, configFile(config, "viele-regeln.json"));
  expect(last.ok).toBe(true);
  expect(last.skipped.invalid).toEqual([]);
  expect(await hookRules(page).then((r) => r.length)).toBe(N);
  expect(await page.evaluate(() => window.__calc.filter.count)).toBe((await allKeys(page)).length);
  await expect(ruleRows(page)).toHaveCount(N);
  await expect(ruleRows(page).last()).toContainText("x" + (N - 1));
  // a filter interaction (one set value) with the rule list unchanged: the rule rows stay the same nodes
  await page.evaluate(() => (window.__ruleRow = document.querySelector("#cv-rules .cv-rule:last-child")));
  const [first] = await shownValues(page, "Kategorie");
  await toggleValue(page, "Kategorie", first.label);
  expect(await page.evaluate(() => window.__calc.filter.count)).toBe(first.count);
  expect(await page.evaluate(() => document.querySelector("#cv-rules .cv-rule:last-child") === window.__ruleRow)).toBe(
    true,
  );
  test.info().annotations.push({
    type: "filter ms (20,000 rules)",
    description: String(await page.evaluate(() => window.__calc.filter.lastMs)),
  });
  // changing the list still re-renders it: removing the last rule leaves N - 1 rows
  await openFilterPanel(page);
  const before = await filterUpdates(page);
  await page.locator("#cv-rules .cv-rule:last-child .cv-rule-remove").click(); // x `Filter entfernen`
  await waitFilterUpdate(page, before);
  await expect(ruleRows(page)).toHaveCount(N - 1);
  expect(await hookRules(page).then((r) => r.length)).toBe(N - 1);
  expect(errors).toEqual([]);
});

// Verification INC-2 SYNC-5 (spec Testing T7, CR-002 part): typing in the search field and applying a `Freie
// Textsuche` rule while the display-text index is building. The build is held open; meanwhile a search text with no
// hit is typed, a rule `Freie Textsuche` · `Gleich` · <GlobalId of Wand-Ext-ERDG-1> is applied, and the search text is
// replaced by `wand`. When the build ends, the latest text and the rule apply: exactly that wall (reference values
// REQ-012-AC6: the GlobalId is one row; its Name contains `Wand`), not the earlier text's empty result.
test("@e2e @robustness @REQ-012 search typed and `Freie Textsuche` applied while the display-text index builds: the latest text and the rule apply when the build ends (INC-2 SYNC-5)", async ({
  page,
}) => {
  await holdIndexPause(page);
  const errors = await openBuilder(page);
  await loadFiles(page, FZK);
  await idle(page);
  const ac6 = R["REQ-012-AC6"];
  await page.evaluate(() => (window.__holdPause = true));
  await openFilterPanel(page);
  await expect(panelStatus(page)).toHaveText("Eigenschaften werden gelesen ... 100 %");
  await expect.poll(() => page.evaluate(() => typeof window.__heldPause)).toBe("function");
  const updates = await filterUpdates(page);
  const search = page.getByRole("searchbox", { name: "Suchen nach Objekten" });
  await search.fill("zzz-kein-Treffer-zzz");
  await page.waitForTimeout(400); // past the 250 ms debounce: this text waits for the build
  await addRuleLink(page).click();
  const f = dialogFields(page);
  await f.mode.selectOption({ label: "Freie Textsuche" });
  await f.op.selectOption({ label: "Gleich" });
  await f.value.fill(ac6.GlobalId);
  await f.apply.click();
  await expect(f.dialog).toBeHidden();
  await search.fill("wand");
  await page.waitForTimeout(400);
  // still building: nothing was evaluated with a text source yet
  expect(await filterUpdates(page)).toBe(updates);
  await expect(panelStatus(page)).toHaveText(/^Eigenschaften werden gelesen/);
  await page.evaluate(() => window.__heldPause());
  await expect.poll(() => filterKeys(page)).toEqual(await keysOf(page, ac6.globalIds));
  await page.waitForTimeout(500); // no later evaluation of an older text
  expect(await filterKeys(page)).toEqual(await keysOf(page, ac6.globalIds));
  expect(await hookRules(page)).toEqual([{ mode: "text", key: null, op: "eq", value: ac6.GlobalId }]);
  await expect(search).toHaveValue("wand");
  await expect(panelStatus(page)).toHaveText(`1 von ${de(FZK_TOTAL)} Objekten sichtbar`);
  await expect(status(page)).toHaveText(`1 von ${de(FZK_TOTAL)} Elementen`);
  expect(errors).toEqual([]);
});
