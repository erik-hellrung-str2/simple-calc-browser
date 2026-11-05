// TASK-019 (CR-002, INC-2): the overlay layout of the 3D view (spec REQ-005 "Overlay layout", REQ-005-AC12, spec 2
// User interface → Devices: every width >= 1024 px). The states are built through the UI (click section, rules,
// colouring panel, properties-panel `Isolieren` / `Ausblenden`, table row selection). The expected geometry is derived
// here from the spec rules (16 px edges, 8 px gaps, properties panel body >= 120 px, no two overlays overlapping,
// panels inside the 3D view), never from the code under test. Element names come from reference-values.json.
import { test, expect } from "../support/network-guard.mjs";
import { REF, fixture, loadFiles, openBuilder } from "../support/builder.mjs";
import { colourBy, colourPanel, colourTool, idle, keysOfGuids } from "../support/view-3d.mjs";
import { clickRow } from "../support/selection.mjs";
import { addRule, filterPanel, openFilterPanel, toolbar } from "../support/rules.mjs";
import { cutAt, firstPickable, isolateTogether, panelAction, shownPills } from "../support/tools.mjs";

const FZK = fixture("AC20-FZK-Haus.ifc");
const TOOLS = REF["REQ-013-tools"];
const WALLS = TOOLS.walls;
const [ERDG1, ERDG2] = TOOLS.toolWalls; // Wand-Ext-ERDG-1, Wand-Ext-ERDG-2
const FIVE_PILLS = [
  "Filter entfernen",
  "Einfärbung entfernen",
  "Isolierung entfernen",
  "Ausblendung entfernen",
  "Schnitt entfernen",
];

test.describe.configure({ timeout: 240_000 });

/**
 * Boxes (page pixels) of the 3D view (#cv-canvas-box), the properties panel and its body, the open filter or colouring
 * panel and its body, the pill stack (union of the shown pills), the toolbar and the title chip, and per shown pill
 * whether its label is visible and its buttons' title / aria-label.
 */
function overlays(page) {
  return page.evaluate(() => {
    const box = (node) => {
      if (!node || node.hidden || !node.getClientRects().length) return null;
      const r = node.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
    };
    const body = (node) =>
      node && box(node)
        ? {
            clientHeight: node.clientHeight,
            scrollHeight: node.scrollHeight,
            overflowY: getComputedStyle(node).overflowY,
          }
        : null;
    const openPanel = [...document.querySelectorAll("#cv-filter-panel, #cv-colour-panel")].find((n) => !n.hidden);
    const shownPills = [...document.querySelectorAll("#cv-pills .cv-pill")].filter((p) => !p.hidden);
    const pillBoxes = shownPills.map((p) => box(p));
    const stack = pillBoxes.length
      ? {
          left: Math.min(...pillBoxes.map((b) => b.left)),
          right: Math.max(...pillBoxes.map((b) => b.right)),
          top: Math.min(...pillBoxes.map((b) => b.top)),
          bottom: Math.max(...pillBoxes.map((b) => b.bottom)),
        }
      : null;
    return {
      view: box(document.getElementById("cv-canvas-box")),
      props: box(document.getElementById("cv-props")),
      propsHead: box(document.querySelector("#cv-props .cv-props-head")),
      propsBody: body(document.getElementById("cv-props-body")),
      panel: openPanel ? { id: openPanel.id, ...box(openPanel) } : null,
      panelBody: openPanel ? body(openPanel.querySelector(".cv-float-body")) : null,
      stack,
      toolbar: box(document.getElementById("cv-toolbar")),
      chip: box(document.getElementById("cv-title-chip")),
      pills: shownPills.map((p) => ({
        label: p.querySelector(".cv-pill-label").textContent,
        labelShown: p.querySelector(".cv-pill-label").getClientRects().length > 0,
        buttons: [...p.querySelectorAll("button")].map((b) => ({
          title: b.getAttribute("title"),
          aria: b.getAttribute("aria-label"),
        })),
      })),
    };
  });
}

const overlap = (a, b) =>
  a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
const inside = (a, v) =>
  a.left >= v.left - 0.5 && a.right <= v.right + 0.5 && a.top >= v.top - 0.5 && a.bottom <= v.bottom + 0.5;

/**
 * A panel body "scrolls when its content is higher": then it is a scroll container (overflow-y auto / scroll) and a
 * scroll moves it. Returns whether the content was higher.
 */
async function expectScrollsWhenHigher(page, selector, label) {
  const info = await page.locator(selector).evaluate((n) => {
    const higher = n.scrollHeight > n.clientHeight + 1;
    const before = n.scrollTop;
    n.scrollTop = before + 40;
    const moved = n.scrollTop !== before;
    n.scrollTop = before;
    return { higher, moved, overflowY: getComputedStyle(n).overflowY };
  });
  if (info.higher) {
    expect(["auto", "scroll"], `${label}: scroll container`).toContain(info.overflowY);
    expect(info.moved, `${label}: scrolls`).toBe(true);
  }
  return info.higher;
}

/** The REQ-005-AC12 assertions in the current window (compact layout: five pills, properties panel open). */
async function expectCompactLayout(page, label) {
  // the layout follows a resize of the 3D view (ResizeObserver): poll until the properties panel is left of the stack
  await expect
    .poll(
      async () => {
        const o = await overlays(page);
        if (!(o.props && o.stack && o.panel && o.props.right <= o.stack.left - 7.5)) return false;
        // and the open panel centred in the width left of the properties panel (after the resize)
        const remaining = o.props.left - 8 - o.view.left;
        const w = Math.min(380, remaining - 16);
        return Math.abs(o.panel.left - o.view.left - Math.max(16, (remaining - w) / 2)) <= 1;
      },
      { message: `${label}: properties panel left of the pill stack, the panel centred left of it` },
    )
    .toBe(true);
  const o = await overlays(page);
  const at = `${label} (3D view ${Math.round(o.view.width)} x ${Math.round(o.view.height)})`;
  console.log(
    `[REQ-005-AC12] ${at}: props x ${Math.round(o.props.left - o.view.left)}-${Math.round(o.props.right - o.view.left)} y ${Math.round(o.props.top - o.view.top)}-${Math.round(o.props.bottom - o.view.top)}, ` +
      `body ${o.propsBody.clientHeight}; ${o.panel.id} x ${Math.round(o.panel.left - o.view.left)}-${Math.round(o.panel.right - o.view.left)}; ` +
      `stack x ${Math.round(o.stack.left - o.view.left)}-${Math.round(o.stack.right - o.view.left)} (${Math.round(o.stack.right - o.stack.left)} px wide)`,
  );
  // all five pills, icon only, each button with title and aria-label
  expect(o.pills.map((p) => p.label)).toEqual(FIVE_PILLS);
  for (const pill of o.pills) {
    expect(pill.labelShown, `${at}: ${pill.label} shows its icon only`).toBe(false);
    for (const button of pill.buttons) {
      expect(button.title, `${at}: ${pill.label} button title`).toBeTruthy();
      expect(button.aria, `${at}: ${pill.label} button aria-label`).toBeTruthy();
    }
  }
  // the main buttons keep the pill label as their accessible name
  for (const name of FIVE_PILLS)
    await expect(page.locator("#cv-pills").getByRole("button", { name, exact: true }), `${at}: ${name}`).toBeVisible();
  // the properties panel: left of the pill stack (8 px gap), its bottom >= 8 px above the toolbar's top edge
  expect(o.props.right, `${at}: 8 px gap to the pill stack`).toBeLessThanOrEqual(o.stack.left - 8 + 0.5);
  expect(o.props.bottom, `${at}: 8 px above the toolbar`).toBeLessThanOrEqual(o.toolbar.top - 8 + 0.5);
  expect(o.props.top - o.view.top, `${at}: 16 px from the top`).toBeCloseTo(16, 0);
  // the filter (or colouring) panel is left of the properties panel and at least 16 px from the left edge
  expect(o.panel.right, `${at}: panel left of the properties panel`).toBeLessThanOrEqual(o.props.left + 0.5);
  expect(o.panel.left - o.view.left, `${at}: panel 16 px from the left`).toBeGreaterThanOrEqual(16 - 0.5);
  // no two of panel, properties panel, pill stack, toolbar (and the title chip) overlap; all inside the 3D view
  const parts = { panel: o.panel, props: o.props, stack: o.stack, toolbar: o.toolbar, chip: o.chip };
  const names = Object.keys(parts).filter((k) => parts[k]);
  for (let i = 0; i < names.length; i++) {
    expect(inside(parts[names[i]], o.view), `${at}: ${names[i]} inside the 3D view`).toBe(true);
    for (let j = i + 1; j < names.length; j++)
      expect(overlap(parts[names[i]], parts[names[j]]), `${at}: ${names[i]} / ${names[j]} overlap`).toBe(false);
  }
  // the properties panel body keeps at least 120 px; every panel body scrolls when its content is higher
  expect(o.propsBody.clientHeight, `${at}: properties body height`).toBeGreaterThanOrEqual(120);
  expect(
    await expectScrollsWhenHigher(page, "#cv-props-body", `${at}: properties body`),
    "the wall's properties are higher than the body",
  ).toBe(true);
  await expectScrollsWhenHigher(page, `#${o.panel.id} .cv-float-body`, `${at}: ${o.panel.id} body`);
  return o;
}

test("@e2e @acceptance @REQ-005-AC12 at 1280 × 800 with a rule, colouring, two isolated walls (one hidden, the other selected) and a section: five icon-only pills, the properties panel left of the pill stack and above the toolbar, the filter panel with 5 rules left of it, no overlaps, properties body ≥ 120 px, panel bodies scroll", async ({
  page,
}) => {
  const errors = await openBuilder(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await loadFiles(page, FZK);
  await idle(page);
  const view = await page.locator("#cv-canvas-box").boundingBox();
  // spec REQ-005: at 1280 x 800 the 3D view is ~1000 x 390 px (window 800 - 56 - 28 - 6 = 710 px, 55 %)
  expect(Math.round(view.width)).toBe(1000);
  expect(Math.abs(view.height - 390)).toBeLessThanOrEqual(3);
  const wallKeys = await keysOfGuids(
    page,
    WALLS.map((w) => w.GlobalId),
  );
  // a section (click section on a wall); `Schneiden` keeps the selection, `Esc` clears it
  await cutAt(page, await firstPickable(page, wallKeys));
  await page.keyboard.press("Escape");
  // 5 rules that keep both ground-floor exterior walls ERDG-1 / ERDG-2 (names: reference-values.json)
  await addRule(page, { mode: "isolate", key: "Kategorie", op: "contains", value: "wall" });
  await addRule(page, { mode: "isolate", key: "Name", op: "starts", value: "Wand-Ext" });
  await addRule(page, { mode: "hide", key: "Name", op: "ends", value: "-OG-1" });
  await addRule(page, { mode: "mark", key: "Name", op: "eq", value: ERDG2.Name });
  await addRule(page, { mode: "mark", key: "Kategorie", op: "eq", value: "IfcSlab" });
  await toolbar(page).getByRole("button", { name: "Filter", exact: true }).click(); // close the panel
  await colourBy(page, "Kategorie", "Kategorie");
  await isolateTogether(page, [ERDG1.GlobalId, ERDG2.GlobalId]);
  const [hidden] = await keysOfGuids(page, [ERDG1.GlobalId]);
  const [selected] = await keysOfGuids(page, [ERDG2.GlobalId]);
  await panelAction(page, hidden, "hide");
  expect(await shownPills(page)).toEqual(FIVE_PILLS);
  // the other wall selected: the properties panel is open
  await clickRow(page, selected);
  await expect(page.locator("#cv-props")).toBeVisible();
  await expect(page.locator("#cv-props")).toHaveAttribute("data-key", selected);
  await openFilterPanel(page);
  await expect(filterPanel(page).locator(".cv-rule")).toHaveCount(5);

  const o = await expectCompactLayout(page, "1280 x 800");
  // spec example: the stack is ~128 px wide, the properties panel spans x ~488-848 and y 16 to <= ~308 (>= 280 high)
  expect(o.stack.right - o.stack.left).toBeLessThanOrEqual(140);
  expect(Math.abs(o.props.left - o.view.left - 488)).toBeLessThanOrEqual(12);
  expect(o.props.width).toBeCloseTo(360, 0);
  expect(o.props.bottom - o.view.top).toBeLessThanOrEqual(310);
  expect(o.props.height).toBeGreaterThanOrEqual(280);

  // closing the properties panel: the pills show their labels again, the filter panel is centred above the toolbar
  await page.keyboard.press("Escape");
  await expect(page.locator("#cv-props")).toBeHidden();
  await expect(filterPanel(page)).toBeVisible();
  await expect.poll(async () => (await overlays(page)).pills.every((p) => p.labelShown)).toBe(true);
  const c = await overlays(page);
  expect(Math.abs((c.panel.left + c.panel.right) / 2 - (c.view.left + c.view.right) / 2)).toBeLessThanOrEqual(1);
  expect(overlap(c.panel, c.stack)).toBe(false);
  expect(overlap(c.panel, c.toolbar)).toBe(false);
  expect(errors).toEqual([]);
});

test("@e2e the five-pill overlay check repeated at 1100 and 1024 px wide (filter area as a drawer): icon-only pills, properties panel left of the pill stack, filter and colouring panel left of it, no overlaps, panel bodies scroll", async ({
  page,
}) => {
  const errors = await openBuilder(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await loadFiles(page, FZK);
  await idle(page);
  const wallKeys = await keysOfGuids(
    page,
    WALLS.map((w) => w.GlobalId),
  );
  await cutAt(page, await firstPickable(page, wallKeys));
  await page.keyboard.press("Escape");
  await addRule(page, { mode: "isolate", key: "Kategorie", op: "contains", value: "wall" });
  await addRule(page, { mode: "isolate", key: "Name", op: "starts", value: "Wand-Ext" });
  await addRule(page, { mode: "hide", key: "Name", op: "ends", value: "-OG-1" });
  await addRule(page, { mode: "mark", key: "Name", op: "eq", value: ERDG2.Name });
  await addRule(page, { mode: "mark", key: "Kategorie", op: "eq", value: "IfcSlab" });
  await toolbar(page).getByRole("button", { name: "Filter", exact: true }).click();
  await colourBy(page, "Kategorie", "Kategorie");
  await isolateTogether(page, [ERDG1.GlobalId, ERDG2.GlobalId]);
  const [hidden] = await keysOfGuids(page, [ERDG1.GlobalId]);
  const [selected] = await keysOfGuids(page, [ERDG2.GlobalId]);
  await panelAction(page, hidden, "hide");
  expect(await shownPills(page)).toEqual(FIVE_PILLS);
  await clickRow(page, selected);
  await expect(page.locator("#cv-props")).toHaveAttribute("data-key", selected);
  await openFilterPanel(page);

  for (const width of [1100, 1024]) {
    await page.setViewportSize({ width, height: 800 });
    // below 1280 px the filter area is a closed drawer: the 3D view takes the full width
    await expect(page.locator("#cv-toggle-filters")).toBeVisible();
    await expect.poll(async () => Math.round((await overlays(page)).view.width)).toBe(width);
    await expect(filterPanel(page)).toBeVisible();
    await expect(page.locator("#cv-props")).toBeVisible();
    await expectCompactLayout(page, `${width} x 800, filter panel`);
  }
  // the colouring panel instead of the filter panel (1024 px): left of the properties panel as well
  await colourTool(page).click();
  await expect(colourPanel(page)).toBeVisible();
  await expect(filterPanel(page)).toBeHidden();
  await expectCompactLayout(page, "1024 x 800, colouring panel");
  expect(errors).toEqual([]);
});

test("@e2e overlay layout with room to spare (one pill): the properties panel stays top right above the labelled pill, the open filter panel moves left of it; at 1024 px the same", async ({
  page,
}) => {
  const errors = await openBuilder(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await loadFiles(page, FZK);
  await idle(page);
  await addRule(page, { mode: "isolate", key: "Kategorie", op: "contains", value: "wall" });
  const [wall] = await keysOfGuids(page, [ERDG1.GlobalId]);
  await clickRow(page, wall);
  await expect(page.locator("#cv-props")).toBeVisible();
  for (const width of [1280, 1024]) {
    await page.setViewportSize({ width, height: 800 });
    await expect.poll(async () => Math.round((await overlays(page)).view.width)).toBe(width === 1280 ? 1000 : width);
    await expect
      .poll(async () => {
        const o = await overlays(page);
        // the layout follows the resize (ResizeObserver): wait until the panel is centred left of the properties panel
        if (!(o.panel && o.props)) return false;
        const remaining = o.props.left - 8 - o.view.left;
        return Math.abs((o.panel.left + o.panel.right) / 2 - o.view.left - remaining / 2) <= 1;
      })
      .toBe(true);
    const o = await overlays(page);
    const at = `${width} x 800`;
    expect(o.pills.map((p) => [p.label, p.labelShown])).toEqual([["Filter entfernen", true]]);
    // properties panel at the reference place: 16 px from the top and right, ending >= 8 px above the pill
    expect(o.view.right - o.props.right, `${at}: right edge`).toBeCloseTo(16, 0);
    expect(o.props.top - o.view.top, `${at}: top edge`).toBeCloseTo(16, 0);
    expect(o.props.bottom, `${at}: above the pill`).toBeLessThanOrEqual(o.stack.top - 8 + 0.5);
    expect(o.propsBody.clientHeight, `${at}: body`).toBeGreaterThanOrEqual(120);
    // the filter panel left of it, centred in the remaining width (>= 16 px from the left)
    const remaining = o.props.left - 8 - o.view.left;
    expect(
      Math.abs((o.panel.left - o.view.left + o.panel.right - o.view.left) / 2 - remaining / 2),
      `${at}: centred`,
    ).toBeLessThanOrEqual(1);
    expect(o.panel.left - o.view.left).toBeGreaterThanOrEqual(16 - 0.5);
    const parts = { panel: o.panel, props: o.props, stack: o.stack, toolbar: o.toolbar, chip: o.chip };
    const names = Object.keys(parts).filter((k) => parts[k]);
    for (let i = 0; i < names.length; i++)
      for (let j = i + 1; j < names.length; j++)
        expect(overlap(parts[names[i]], parts[names[j]]), `${at}: ${names[i]} / ${names[j]} overlap`).toBe(false);
  }
  expect(errors).toEqual([]);
});
