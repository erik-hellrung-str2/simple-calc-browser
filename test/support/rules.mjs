// Helpers for browser tests of the in-viewer rule filter (TASK-015b, spec REQ-012): the filter panel (toolbar
// `Filter`), the dialog `Filter bearbeiten` (fields by their accessible names, the `Eigenschaft` suggestions as
// `option`s of the listbox `Eigenschaften`), the rule rows `#cv-rules .cv-rule` and the test hook
// window.__calc.filter (updates, rules, keys).
import { expect } from "./network-guard.mjs";

const MODE_LABELS = { isolate: "Isolieren", hide: "Ausblenden", mark: "Markieren", text: "Freie Textsuche" };
const OP_LABELS = { eq: "Gleich", starts: "Beginnt mit", ends: "Endet mit", contains: "Enthält" };

export const toolbar = (page) => page.getByRole("toolbar", { name: "3D-Werkzeuge" });
export const filterPanel = (page) => page.getByRole("region", { name: "Filter", exact: true });
export const ruleDialog = (page) => page.getByRole("dialog", { name: "Filter bearbeiten" });
export const ruleRows = (page) => page.locator("#cv-rules .cv-rule");
export const addRuleLink = (page) => filterPanel(page).getByRole("button", { name: "Filter hinzufügen" });

/** The dialog's fields: Aktion / Vergleich (select), Eigenschaft (combobox), Wert, and the suggestion list. */
export function dialogFields(page) {
  const dialog = ruleDialog(page);
  return {
    dialog,
    mode: dialog.getByRole("combobox", { name: "Aktion" }),
    property: dialog.getByRole("combobox", { name: "Eigenschaft" }),
    op: dialog.getByRole("combobox", { name: "Vergleich" }),
    // an input with a datalist has the role combobox
    value: dialog.getByRole("combobox", { name: "Wert" }),
    suggestions: dialog.getByRole("listbox", { name: "Eigenschaften" }),
    apply: dialog.getByRole("button", { name: "Anwenden", exact: true }),
    cancel: dialog.getByRole("button", { name: "Abbrechen", exact: true }),
  };
}

/** Opens the filter panel (toolbar `Filter`) if it is closed. */
export async function openFilterPanel(page) {
  if (!(await filterPanel(page).isVisible())) {
    await toolbar(page).getByRole("button", { name: "Filter", exact: true }).click();
  }
  await expect(filterPanel(page)).toBeVisible();
}

export function filterUpdates(page) {
  return page.evaluate(() => window.__calc.filter.updates);
}

export function waitFilterUpdate(page, before) {
  return page.waitForFunction((n) => window.__calc.filter.updates > n, before);
}

/**
 * Fills the open dialog: rule { mode, key (property key, picked from the suggestion list after typing `query` or the
 * key), op, value }; only the given fields change.
 */
export async function fillDialog(page, rule) {
  const f = dialogFields(page);
  if (rule.mode) await f.mode.selectOption({ label: MODE_LABELS[rule.mode] });
  if (rule.key) {
    await f.property.fill(rule.query ?? rule.key);
    await f.suggestions.locator(`[role=option][data-key="${rule.key}"]`).click();
    await expect(f.suggestions).toBeHidden();
  }
  if (rule.op) await f.op.selectOption({ label: OP_LABELS[rule.op] });
  if (rule.value !== undefined) await f.value.fill(rule.value);
}

/** `+ Filter hinzufügen`, fills the dialog, `Anwenden`; waits until the filters are evaluated. */
export async function addRule(page, rule) {
  await openFilterPanel(page);
  await addRuleLink(page).click();
  await expect(ruleDialog(page)).toBeVisible();
  await fillDialog(page, rule);
  const before = await filterUpdates(page);
  await dialogFields(page).apply.click();
  await expect(ruleDialog(page)).toBeHidden();
  await waitFilterUpdate(page, before);
}

/** Clicks the text of rule row `index`, changes the given fields, `Anwenden`; waits for the evaluation. */
export async function editRule(page, index, changes) {
  await ruleRows(page).nth(index).locator(".cv-rule-text").click();
  await expect(ruleDialog(page)).toBeVisible();
  await fillDialog(page, changes);
  const before = await filterUpdates(page);
  await dialogFields(page).apply.click();
  await expect(ruleDialog(page)).toBeHidden();
  await waitFilterUpdate(page, before);
}

/** Clicks x `Filter entfernen` of rule row `index`; waits for the evaluation. */
export async function removeRule(page, index) {
  const before = await filterUpdates(page);
  await ruleRows(page).nth(index).getByRole("button", { name: "Filter entfernen" }).click();
  await waitFilterUpdate(page, before);
}

/** Texts of the rule rows (incl. the action label). */
export function ruleTexts(page) {
  return ruleRows(page).locator(".cv-rule-text").allTextContents();
}

/** window.__calc.filter.rules (the rule list as data). */
export function hookRules(page) {
  return page.evaluate(() => window.__calc.filter.rules);
}

/** Keys of the rows with the given GlobalIds (sorted), all must exist. */
export async function keysOf(page, guids) {
  const keys = await page.evaluate(
    (list) => list.map((g) => window.__calc.rows.find((r) => r.guid === g)?.key ?? null),
    guids,
  );
  expect(keys.every(Boolean), "every GlobalId is a row").toBe(true);
  return keys.sort();
}

/** Keys passing all filters (window.__calc.filter.keys), sorted. */
export function filterKeys(page) {
  return page.evaluate(() => [...window.__calc.filter.keys].sort());
}

/** All row keys, sorted. */
export function allKeys(page) {
  return page.evaluate(() => window.__calc.rows.map((r) => r.key).sort());
}
