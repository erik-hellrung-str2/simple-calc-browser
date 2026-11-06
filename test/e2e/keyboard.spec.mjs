// TASK-019 (CR-002, INC-2): the keyboard pass of the 3D view (spec 2 User interface → Keyboard, REQ-005-AC11,
// REQ-007 `Esc` order, REQ-012-AC11 by keyboard). Tab reaches the toolbar, the panels with their rule rows, the pills,
// the properties panel with its row tools and the section handle; Enter / Space operate them; opening a panel moves
// the focus into it and closing returns it to the opener; `Esc` closes dialog → click menu → selection → panel. States
// are built through the UI; names and keys come from reference-values.json, never from the code under test.
import { test, expect } from "../support/network-guard.mjs";
import { REF, fixture, loadFiles, openBuilder } from "../support/builder.mjs";
import { colourPanel, colourTool, idle, keysOfGuids, viewState } from "../support/view-3d.mjs";
import { clickRow } from "../support/selection.mjs";
import {
  addRule,
  addRuleLink,
  dialogFields,
  filterPanel,
  filterKeys,
  filterUpdates,
  hookRules,
  ruleDialog,
  ruleRows,
  ruleTexts,
  toolbar,
  waitFilterUpdate,
} from "../support/rules.mjs";
import { appSection, cutAt, firstPickable, isolateTogether, panelAction, shownPills } from "../support/tools.mjs";

const FZK = fixture("AC20-FZK-Haus.ifc");
const TOOLS = REF["REQ-013-tools"];
const WALLS = TOOLS.walls;
const [ERDG1, ERDG2] = TOOLS.toolWalls; // Wand-Ext-ERDG-1, Wand-Ext-ERDG-2

test.describe.configure({ timeout: 240_000 });

const tool = (page, name) => toolbar(page).getByRole("button", { name, exact: true });
const props = (page) => page.locator("#cv-props");
const search = (page) => page.getByRole("searchbox", { name: "Suchen nach Objekten" });

async function openWith(page, width = 1280) {
  const errors = await openBuilder(page);
  await page.setViewportSize({ width, height: 800 });
  await loadFiles(page, FZK);
  await idle(page);
  return errors;
}

/** The focused element: { id, name (aria-label or text), area (id of the overlay it is in), row (property key) }. */
function focused(page) {
  return page.evaluate(() => {
    const a = document.activeElement;
    if (!a || a === document.body) return null;
    const area = a.closest(
      "#cv-toolbar, #cv-filter-panel, #cv-colour-panel, #cv-pills, #cv-props, #cv-section-handle, #cv-pick, #cv-filters, #cv-table, #cv-splitter, header",
    );
    return {
      id: a.id || "",
      name: (a.getAttribute("aria-label") || a.textContent || "").trim().slice(0, 80),
      area: area ? area.id || area.tagName.toLowerCase() : "",
      row: a.closest(".cv-prop-row") ? a.closest(".cv-prop-row").dataset.key : null,
      groupHead: a.classList.contains("cv-det-group-head"),
    };
  });
}

/** Presses Tab from the focused element until the focus is back on it; returns the focused elements in order. */
async function tabCycle(page, max = 1200) {
  await page.evaluate(() => (window.__tabStart = document.activeElement));
  const seq = [];
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    if (await page.evaluate(() => document.activeElement === window.__tabStart)) return seq;
    seq.push(await focused(page));
  }
  throw new Error("Tab did not come back to the start within " + max + " steps");
}

/** Presses Tab (or Shift+Tab) until the focused element matches pred (at most max presses); returns it. */
async function tabTo(page, pred, { back = false, max = 1200 } = {}) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press(back ? "Shift+Tab" : "Tab");
    const f = await focused(page);
    if (f && pred(f)) return f;
  }
  throw new Error("Tab did not reach the element");
}

const index = (seq, pred) => seq.findIndex((f) => f && pred(f));

test("@e2e @acceptance @REQ-005-AC11 with a selected element and an active rule, Tab reaches the toolbar buttons, the pills, the properties panel buttons and property rows; `Enter` on `Filter` puts the focus into the filter panel; `Esc` clears the selection and keeps the panel open; `Esc` again closes it and the focus is back on `Filter`", async ({
  page,
}) => {
  const errors = await openWith(page);
  await addRule(page, { mode: "isolate", key: "Kategorie", op: "contains", value: "wall" });
  await tool(page, "Filter").click(); // close the panel
  await expect(filterPanel(page)).toBeHidden();
  // a selected element, click menu closed: a table row click (focus on the table)
  const [wall] = await keysOfGuids(page, [ERDG2.GlobalId]);
  await clickRow(page, wall);
  await expect(props(page)).toHaveAttribute("data-key", wall);
  await expect(page.locator("#cv-pick")).toBeHidden();
  expect((await focused(page)).id).toBe("cv-tbl-scroll");

  const seq = await tabCycle(page);
  const reached = (area, name) => index(seq, (f) => f.area === area && f.name === name) !== -1;
  for (const name of ["Fokus", "Filter", "Färben"]) expect(reached("cv-toolbar", name), `toolbar ${name}`).toBe(true);
  // the pill `Filter entfernen` (the rule): ghost toggle, main button, chevron
  for (const name of ["Ausgeblendete verbergen", "Filter entfernen", "Filter anzeigen"])
    expect(reached("cv-pills", name), `pill ${name}`).toBe(true);
  // properties panel: `Schließen`, `Ausblenden`, `Isolieren`, group heads, the row tools of the property rows
  for (const id of ["cv-props-close", "cv-props-hide", "cv-props-isolate"])
    expect(
      index(seq, (f) => f.id === id),
      id,
    ).not.toBe(-1);
  expect(
    index(seq, (f) => f.area === "cv-props" && f.groupHead),
    "a group head",
  ).not.toBe(-1);
  for (const name of ["Nach Wert filtern", "Farbe nach Wert"])
    expect(
      index(seq, (f) => f.row === "Name" && f.name === name),
      `row tool ${name} of the Name row`,
    ).not.toBe(-1);
  // order: toolbar, pills, properties panel (spec 2 Keyboard; DOM order)
  const at = (pred) => index(seq, pred);
  expect(at((f) => f.area === "cv-toolbar")).toBeLessThan(at((f) => f.area === "cv-pills"));
  expect(at((f) => f.area === "cv-pills")).toBeLessThan(at((f) => f.area === "cv-props"));
  // Tab changed nothing
  expect((await viewState(page)).selected).toEqual([wall]);

  // `Enter` on `Filter`: the panel opens with the focus inside it (the search field), the rule row is reached next
  await tabTo(page, (f) => f.area === "cv-toolbar" && f.name === "Filter");
  await page.keyboard.press("Enter");
  await expect(filterPanel(page)).toBeVisible();
  await expect(tool(page, "Filter")).toHaveAttribute("aria-pressed", "true");
  await expect(search(page)).toBeFocused();
  await page.keyboard.press("Tab");
  expect(await focused(page)).toMatchObject({ area: "cv-filter-panel", name: "Isolieren: Kategorie enthält „wall“" });
  await page.keyboard.press("Tab");
  expect(await focused(page)).toMatchObject({ area: "cv-filter-panel", name: "Filter entfernen" });
  await page.keyboard.press("Tab");
  await expect(addRuleLink(page)).toBeFocused();

  // `Esc`: the selection is cleared and the properties panel closes; the filter panel stays open
  await page.keyboard.press("Escape");
  await expect(props(page)).toBeHidden();
  expect((await viewState(page)).selected).toEqual([]);
  await expect(filterPanel(page)).toBeVisible();
  // `Esc` again: the filter panel closes, the focus is back on `Filter`
  await page.keyboard.press("Escape");
  await expect(filterPanel(page)).toBeHidden();
  await expect(tool(page, "Filter")).toBeFocused();
  await expect(tool(page, "Filter")).toHaveAttribute("aria-pressed", "false");
  expect(await hookRules(page)).toHaveLength(1);
  expect(errors).toEqual([]);
});

test("@e2e keyboard pass: the colouring panel by keyboard; Tab reaches all five pills and the section handle (arrow keys); focus returns to the opener (toolbar button, pill chevron, filter-area entry); `Esc` in the search field clears only its text; a pill removed by keyboard passes the focus on; `Esc` order dialog → selection → panel; focus inside the closing properties panel returns to the table", async ({
  page,
}) => {
  const errors = await openWith(page);
  const wallKeys = await keysOfGuids(
    page,
    WALLS.map((w) => w.GlobalId),
  );
  // a section (pointer-only creation, DEC-21)
  await cutAt(page, await firstPickable(page, wallKeys));
  await page.keyboard.press("Escape");
  await expect(page.locator("#cv-section-handle")).toBeVisible();

  // colouring by keyboard: Space on `Färben` puts the focus into `Parameter suchen`; a list entry picked with Enter
  await colourTool(page).focus();
  await page.keyboard.press("Space");
  await expect(colourPanel(page)).toBeVisible();
  await expect(colourPanel(page).getByRole("searchbox", { name: "Parameter suchen" })).toBeFocused();
  await page.keyboard.type("Kategorie");
  await tabTo(page, (f) => f.area === "cv-colour-panel" && f.name.startsWith("Kategorie"));
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => window.__calc.view.colourKey)).toBe("Kategorie");
  await expect(page.locator("#cv-legend")).toBeVisible();
  // the list gave way to the legend: the focus stays in the panel, on the chosen property (`Ändern`)
  await expect(page.locator("#cv-colour-param")).toBeFocused();
  await page.keyboard.press("Tab");
  expect(await focused(page)).toMatchObject({ area: "cv-colour-panel", name: "Unterschiedliche Farben" });
  // `Esc` (nothing selected): the panel closes, the focus is back on `Färben`
  await page.keyboard.press("Escape");
  await expect(colourPanel(page)).toBeHidden();
  await expect(colourTool(page)).toBeFocused();

  // a rule, two isolated walls of which one is hidden: five pills
  await addRule(page, { mode: "mark", key: "Kategorie", op: "eq", value: "IfcSlab" });
  await page.keyboard.press("Escape"); // focus was on `+ Filter hinzufügen`: the panel closes
  await expect(filterPanel(page)).toBeHidden();
  await expect(tool(page, "Filter")).toBeFocused(); // its opener (the `Filter` click of addRule)
  await isolateTogether(page, [ERDG1.GlobalId, ERDG2.GlobalId]);
  const [hidden] = await keysOfGuids(page, [ERDG1.GlobalId]);
  const [shown] = await keysOfGuids(page, [ERDG2.GlobalId]);
  await panelAction(page, hidden, "hide");
  // `Ausblenden` removed the selected element: the focus inside the closed panel went back to the table
  await expect(props(page)).toBeHidden();
  await expect(page.locator("#cv-tbl-scroll")).toBeFocused();
  expect(await shownPills(page)).toEqual([
    "Filter entfernen",
    "Einfärbung entfernen",
    "Isolierung entfernen",
    "Ausblendung entfernen",
    "Schnitt entfernen",
  ]);

  // Tab from `Filter` reaches every pill button and the handle, in DOM order: toolbar, pills, handle
  await tool(page, "Filter").focus();
  const seq = await tabCycle(page);
  const pos = (area, name) => index(seq, (f) => f.area === area && f.name === name);
  const pillNames = [
    "Ausgeblendete verbergen",
    "Filter entfernen",
    "Filter anzeigen",
    "Einfärbung entfernen",
    "Färben anzeigen",
    "Isolierung entfernen",
    "Ausblendung entfernen",
    "Schnitt entfernen",
  ];
  const pillAt = pillNames.map((name) => pos("cv-pills", name));
  for (const [i, name] of pillNames.entries()) expect(pillAt[i], `pill button ${name}`).not.toBe(-1);
  expect(pillAt).toEqual([...pillAt].sort((a, b) => a - b));
  const handleAt = index(seq, (f) => f.id === "cv-section-handle");
  expect(handleAt, "section handle").toBeGreaterThan(Math.max(...pillAt));
  expect(pos("cv-toolbar", "Färben")).toBeLessThan(pillAt[0]);
  // closed panels are not in the Tab order
  expect(index(seq, (f) => f.area === "cv-filter-panel" || f.area === "cv-colour-panel")).toBe(-1);

  // the handle by keyboard: ArrowUp moves the plane along its normal
  const before = await appSection(page);
  await page.locator("#cv-section-handle").focus();
  await page.keyboard.press("ArrowUp");
  await expect.poll(async () => JSON.stringify((await appSection(page)).point)).not.toBe(JSON.stringify(before.point));
  expect((await appSection(page)).normal).toEqual(before.normal);

  // pill chevron `Filter anzeigen`: Enter opens the panel with the focus inside; `Esc` returns it to the chevron
  await page.locator("#cv-pill-filter-show").focus();
  await page.keyboard.press("Enter");
  await expect(filterPanel(page)).toBeVisible();
  await expect(search(page)).toBeFocused();
  // `Esc` in the search field with text clears only the text (REQ-007 `Esc` order), the next one closes the panel
  const searchText = () => page.evaluate(() => window.__calc.filter.search);
  await page.keyboard.type("Wand-Ext");
  await expect.poll(searchText).toBe("Wand-Ext");
  await page.keyboard.press("Escape");
  await expect(search(page)).toHaveValue("");
  await expect.poll(searchText).toBe("");
  await expect(filterPanel(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(filterPanel(page)).toBeHidden();
  await expect(page.locator("#cv-pill-filter-show")).toBeFocused();
  // pill chevron `Färben anzeigen`: the colouring panel at its legend, focus on the chosen property; back on `Esc`
  await page.locator("#cv-pill-colour-show").focus();
  await page.keyboard.press("Enter");
  await expect(colourPanel(page)).toBeVisible();
  await expect(page.locator("#cv-colour-param")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(colourPanel(page)).toBeHidden();
  await expect(page.locator("#cv-pill-colour-show")).toBeFocused();

  // a pill removed by keyboard passes the focus to the next shown pill, else the previous one
  await page.locator("#cv-pill-section-reset").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#cv-pill-section")).toBeHidden();
  expect(await appSection(page)).toBeNull();
  await expect(page.locator("#cv-pill-hidden-reset")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#cv-pill-hidden")).toBeHidden();
  await expect(page.locator("#cv-pill-isolate-reset")).toBeFocused();

  // filter-area entry `Filterregeln: 1`: its text opens the filter panel with the focus inside; `Esc` returns to it
  const entry = page.locator("#cv-fa-sources .cv-fa-source-text").filter({ hasText: "Filterregeln: 1" });
  await entry.focus();
  await page.keyboard.press("Enter");
  await expect(filterPanel(page)).toBeVisible();
  await expect(search(page)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(filterPanel(page)).toBeHidden();
  await expect(entry).toBeFocused();

  // `Esc` order with a dialog: dialog → selection → panel
  await clickRow(page, shown);
  await expect(props(page)).toHaveAttribute("data-key", shown);
  await tool(page, "Filter").focus();
  await page.keyboard.press("Enter");
  await addRuleLink(page).focus();
  await page.keyboard.press("Enter");
  await expect(ruleDialog(page)).toBeVisible();
  await expect(dialogFields(page).mode).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(ruleDialog(page)).toBeHidden();
  await expect(props(page)).toBeVisible();
  await expect(filterPanel(page)).toBeVisible();
  await expect(addRuleLink(page)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(props(page)).toBeHidden();
  await expect(filterPanel(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(filterPanel(page)).toBeHidden();
  await expect(tool(page, "Filter")).toBeFocused();

  // focus on a row tool of the properties panel, `Esc`: selection cleared, the focus returns to the table
  await clickRow(page, shown);
  await props(page).locator('.cv-prop-row[data-key="Name"] .cv-row-tool').first().focus();
  await page.keyboard.press("Escape");
  await expect(props(page)).toBeHidden();
  expect((await viewState(page)).selected).toEqual([]);
  await expect(page.locator("#cv-tbl-scroll")).toBeFocused();
  expect(errors).toEqual([]);
});

test("@e2e @acceptance @REQ-012-AC11 by keyboard only at 1024 px: `Anwenden` (Enter) with an empty or unknown `Eigenschaft` or an empty `Wert` marks the field and keeps the dialog open; the exact label `Name` is applied; `Abbrechen` (Space) and `Esc` change nothing; Tab stays in the dialog", async ({
  page,
}) => {
  const errors = await openWith(page, 1024);
  const f = dialogFields(page);
  const invalid = async (locator, yes) => {
    if (yes) await expect(locator).toHaveAttribute("aria-invalid", "true");
    else await expect(locator).not.toHaveAttribute("aria-invalid", "true");
    await expect(locator).toHaveClass(yes ? /cv-invalid/ : /^(?!.*cv-invalid)/);
  };
  // `Filter` by keyboard, Tab to `+ Filter hinzufügen`, Enter: the dialog with the focus on `Aktion`
  await tool(page, "Filter").focus();
  await page.keyboard.press("Enter");
  await expect(search(page)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(addRuleLink(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(f.dialog).toBeVisible();
  await expect(f.mode).toBeFocused();
  await expect(f.mode).toHaveValue("isolate");
  // the dialog fits the 1024 px window, its four fields in one row
  const boxes = await Promise.all([f.dialog, f.mode, f.property, f.op, f.value].map((l) => l.boundingBox()));
  expect(boxes[0].x).toBeGreaterThanOrEqual(0);
  expect(boxes[0].x + boxes[0].width).toBeLessThanOrEqual(1024);
  for (const b of boxes.slice(2)) expect(Math.abs(b.y - boxes[1].y)).toBeLessThanOrEqual(1);
  for (let i = 2; i < boxes.length; i++) expect(boxes[i].x).toBeGreaterThanOrEqual(boxes[i - 1].x + boxes[i - 1].width);

  const updates = await filterUpdates(page);
  // empty `Eigenschaft` (action Isolieren), `Wert` typed: Enter in `Wert` applies → `Eigenschaft` invalid, focused
  await page.keyboard.press("Tab");
  await expect(f.property).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(f.op).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(f.value).toBeFocused();
  await page.keyboard.type("Wand");
  await page.keyboard.press("Enter");
  await expect(f.dialog).toBeVisible();
  await invalid(f.property, true);
  await invalid(f.value, false);
  await expect(f.property).toBeFocused();
  // unknown label `Gibtsnicht`
  await page.keyboard.type("Gibtsnicht");
  await invalid(f.property, false); // typing clears the mark
  await page.keyboard.press("Enter");
  await expect(f.dialog).toBeVisible();
  await invalid(f.property, true);
  // the exact label `Name` typed, `Wert` emptied: `Wert` invalid
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("Name");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(f.value).toBeFocused();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Enter");
  await expect(f.dialog).toBeVisible();
  await invalid(f.property, false);
  await invalid(f.value, true);
  await expect(f.value).toBeFocused();
  expect(await filterUpdates(page)).toBe(updates);
  expect(await hookRules(page)).toEqual([]);
  // a value: Enter applies `Name` typed exactly (not picked); the focus returns to `+ Filter hinzufügen`
  await page.keyboard.type("Wand");
  const before = await filterUpdates(page);
  await page.keyboard.press("Enter");
  await expect(f.dialog).toBeHidden();
  await waitFilterUpdate(page, before);
  expect(await hookRules(page)).toEqual([{ mode: "isolate", key: "Name", op: "contains", value: "Wand" }]);
  expect(await ruleTexts(page)).toEqual(["Isolieren: Name enthält „Wand“"]);
  await expect(addRuleLink(page)).toBeFocused();

  // `Abbrechen` (Space) and `Esc` close without change
  const keys = await filterKeys(page);
  const after = await filterUpdates(page);
  await page.keyboard.press("Enter");
  await expect(f.mode).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.type("Kategorie");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.type("slab");
  await page.keyboard.press("Tab");
  await expect(f.cancel).toBeFocused();
  await page.keyboard.press("Space");
  await expect(f.dialog).toBeHidden();
  await expect(addRuleLink(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await page.keyboard.type("Kategorie");
  // the typed text opened the suggestion list: the first `Esc` closes only that popup (REQ-007 `Esc` order; testing
  // cycle 2 X-4), the second closes the dialog without change
  await expect(f.suggestions).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(f.suggestions).toBeHidden();
  await expect(f.dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(f.dialog).toBeHidden();
  await expect(filterPanel(page)).toBeVisible(); // Esc closed only the dialog
  await expect(addRuleLink(page)).toBeFocused();
  // editing: Shift+Tab to the rule text, Enter, a changed `Wert`, `Esc`: unchanged, focus back on the rule text
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(ruleRows(page).first().locator(".cv-rule-text")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(f.dialog).toBeVisible();
  await expect(f.value).toHaveValue("Wand");
  await f.value.focus();
  await page.keyboard.type(" anders");
  await page.keyboard.press("Escape");
  await expect(f.dialog).toBeHidden();
  await expect(ruleRows(page).first().locator(".cv-rule-text")).toBeFocused();
  expect(await filterUpdates(page)).toBe(after);
  expect(await hookRules(page)).toEqual([{ mode: "isolate", key: "Name", op: "contains", value: "Wand" }]);
  expect(await filterKeys(page)).toEqual(keys);

  // Tab and Shift+Tab stay in the (modal) dialog
  await addRuleLink(page).focus();
  await page.keyboard.press("Enter");
  await expect(f.mode).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(f.dialog.getByRole("button", { name: "Schließen" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(f.apply).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(f.dialog.getByRole("button", { name: "Schließen" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(f.dialog).toBeHidden();
  // the dialog also fits a 1100 px window
  await page.setViewportSize({ width: 1100, height: 800 });
  await page.keyboard.press("Enter");
  const d = await f.dialog.boundingBox();
  expect(d.x).toBeGreaterThanOrEqual(0);
  expect(d.x + d.width).toBeLessThanOrEqual(1100);
  await page.keyboard.press("Escape");
  expect(errors).toEqual([]);
});
