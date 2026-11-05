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
import { openHeaderDialog } from "../support/config.mjs";
import { openColumnFilter } from "../support/table.mjs";

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

// Verification INC-2 UX-1: the glass pill style belongs to the 3D navigation hint `#cv-hint` only. Every other help or
// empty-state text (class `cv-hint`) stays inline text inside its own container: in normal flow, wrapping, and inside
// the box of the dialog, popup or list it belongs to (fails before the fix: position absolute, bottom 82 px, nowrap).
test("@e2e @UI help and empty-state texts stay inline in their dialog, popup or list; only the 3D hint is a pill (INC-2 UX-1)", async ({
  page,
}) => {
  const errors = await openBuilder(page);
  const inside = (outer, inner) =>
    inner.x >= outer.x - 0.5 &&
    inner.y >= outer.y - 0.5 &&
    inner.x + inner.width <= outer.x + outer.width + 0.5 &&
    inner.y + inner.height <= outer.y + outer.height + 0.5;
  const style = (locator) =>
    locator.evaluate((node) => {
      const cs = getComputedStyle(node);
      return { position: cs.position, whiteSpace: cs.whiteSpace, radius: cs.borderTopLeftRadius };
    });
  const expectInline = async (container, hint, label) => {
    await expect(hint, label).toBeVisible();
    expect(await style(hint), label).toEqual(expect.objectContaining({ position: "static", whiteSpace: "normal" }));
    expect(inside(await container.boundingBox(), await hint.boundingBox()), label + ": inside its container").toBe(
      true,
    );
  };
  // no model: the model list says so, inline
  const modelList = page.locator(".cv-hint", { hasText: "Keine Modelle geladen." });
  await expectInline(modelList.locator("xpath=.."), modelList, "Keine Modelle geladen.");
  // header dialog: the three help texts inside the dialog, one below the other (no overlap)
  const dialog = await openHeaderDialog(page);
  const hints = dialog.locator(".cv-hint");
  const n = await hints.count();
  expect(n).toBeGreaterThanOrEqual(3);
  const boxes = [];
  for (let i = 0; i < n; i++) {
    const hint = hints.nth(i);
    await expectInline(dialog, hint, `header dialog hint ${i}: ${await hint.textContent()}`);
    boxes.push(await hint.boundingBox());
  }
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const [a, b] = [boxes[i], boxes[j]];
      const apart = a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
      expect(apart, `header dialog hints ${i} / ${j} overlap`).toBe(true);
    }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  // column filter popup: `Keine Treffer.` inside the popup, not over the sort buttons
  await loadFiles(page, FZK);
  const popup = await openColumnFilter(page, "Name");
  await popup.getByRole("searchbox").fill("zzz-kein-Wert-zzz");
  const empty = popup.locator(".cv-hint", { hasText: "Keine Treffer." });
  await expectInline(popup, empty, "column filter Keine Treffer.");
  const sort = popup.getByRole("button", { name: "Absteigend" });
  const [e, s] = [await empty.boundingBox(), await sort.boundingBox()];
  const apart = e.x + e.width <= s.x || s.x + s.width <= e.x || e.y + e.height <= s.y || s.y + s.height <= e.y;
  expect(apart, "Keine Treffer. does not cover Absteigend").toBe(true);
  // the 3D navigation hint keeps its pill
  const nav = await style(page.locator("#cv-hint"));
  expect(nav.position).toBe("absolute");
  expect(nav.whiteSpace).toBe("nowrap");
  expect(errors).toEqual([]);
});

// Verification INC-2 UX-6 (user answer Q4 `Genauso`; reference ref L1723-1727, docs/reviews/CR-002-reference-app.md
// "Background"): the 3D view's background is the reference radial gradient, white near the top centre and darker than
// `--cv-bg-3d` at the edges, behind the transparent canvas (fails before the fix: one flat #eceef0).
test("@e2e @UI the 3D background is the reference radial gradient: lightest at 50 % / 28 %, #eceef0 at 58 %, darker at the corners (INC-2 UX-6)", async ({
  page,
}) => {
  const errors = await openBuilder(page);
  const box = page.locator("#cv-canvas-box");
  const image = await box.evaluate((n) => getComputedStyle(n).backgroundImage);
  expect(image).toMatch(/^radial-gradient\(120% 95% at 50% 28%, rgb\(255, 255, 255\) 0%, /);
  expect(image).toContain("rgb(236, 238, 240) 58%");
  // the pixels behind the (hidden) canvas: centre-top white, corners darker than #eceef0 (82 % #eceef0 + 18 % #6b6f73)
  const png = await box.screenshot({
    style: "#cv-canvas-box > *:not(canvas), #cv-canvas-box canvas { visibility: hidden !important; }",
  });
  const sample = await page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    const at = (x, y) => [...ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data.slice(0, 3)];
    const [w, h] = [bitmap.width, bitmap.height];
    return { top: at(w / 2, h * 0.28), corner: at(1, h - 2) };
  }, png.toString("base64"));
  for (const c of sample.top) expect(c).toBeGreaterThanOrEqual(250);
  const sum = (rgb) => rgb[0] + rgb[1] + rgb[2];
  expect(sum(sample.corner)).toBeLessThan(sum([0xec, 0xee, 0xf0]) - 20);
  expect(errors).toEqual([]);
});
