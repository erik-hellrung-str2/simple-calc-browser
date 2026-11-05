// TASK-013 floating properties panel (spec REQ-007, CR-002; BUG-T2): layout of the panel inside the 3D view, long values
// wrapping inside it, its height limit above the pill stack / toolbar zone, the body scrolling inside, the header (model
// chip, `Ausblenden` / `Isolieren`, `Schließen`) and the row-tool slots. The element with the longest property value is
// chosen from the extracted rows; the GlobalIds and names asserted come from test/fixtures/reference-values.json.
import { test, expect } from "../support/network-guard.mjs";
import { REF, fixture, loadFiles, openBuilder } from "../support/builder.mjs";
import { idle, keysOfGuids, viewState } from "../support/view-3d.mjs";
import { clickRow, details } from "../support/selection.mjs";

const FZK = fixture("AC20-FZK-Haus.ifc");
const SEL = REF["REQ-007-selection"];

test.describe.configure({ timeout: 180_000 });

async function openWith(page, files) {
  const errors = await openBuilder(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await loadFiles(page, files);
  await idle(page);
  return errors;
}

/** Text of a value as long as it can get in the panel: multi-values joined with ", ". */
const valueLength = (v) => (Array.isArray(v) ? v.map(String).join(", ") : String(v)).length;

/**
 * Geometry of the open panel: panel and body boxes, scroll sizes, and every property name / value text that leaves
 * the body's content box or overflows itself.
 */
function panelGeometry(page) {
  return page.evaluate(() => {
    const panel = document.getElementById("cv-props");
    const body = document.getElementById("cv-props-body");
    const p = panel.getBoundingClientRect();
    const b = body.getBoundingClientRect();
    const style = getComputedStyle(body);
    const contentLeft = b.left + parseFloat(style.paddingLeft);
    const contentRight = b.right - parseFloat(style.paddingRight);
    const outside = [];
    for (const n of panel.querySelectorAll(".cv-det-name, .cv-prop-text, .cv-det-title, .cv-props-chip")) {
      const r = n.getBoundingClientRect();
      if (!r.width) continue;
      if (r.left < contentLeft - 0.5 || r.right > contentRight + 0.5 || n.scrollWidth > n.clientWidth + 0.5)
        outside.push(n.textContent);
    }
    return {
      panel: { top: p.top, bottom: p.bottom, left: p.left, right: p.right, height: p.height },
      panelScroll: { sw: panel.scrollWidth, cw: panel.clientWidth },
      body: { sw: body.scrollWidth, cw: body.clientWidth, sh: body.scrollHeight, ch: body.clientHeight },
      outside,
    };
  });
}

test("@e2e @acceptance @REQ-007-AC6 the element with the longest property value: no horizontal scrollbar, every value incl. GlobalId wraps in the panel, the panel ends above the pills, its body scrolls", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  // the fixture element with the longest single property value (text as the panel shows it)
  const rows = await page.evaluate(() => window.__calc.rows);
  let longest = null;
  for (const row of rows)
    for (const [key, value] of Object.entries(row.values)) {
      if (value === null || value === undefined) continue;
      const length = valueLength(value);
      if (!longest || length > longest.length) longest = { key: row.key, property: key, length };
    }
  expect(longest.length, "a long value exists").toBeGreaterThan(22);
  console.log(`[REQ-007-AC6] longest value: ${longest.property} (${longest.length} characters) of ${longest.key}`);

  await clickRow(page, longest.key);
  const d = await details(page);
  expect(d.open).toBe(true);
  expect(d.key).toBe(longest.key);
  const panel = page.locator("#cv-props");
  const longRow = panel.locator(`.cv-prop-row[data-key="${longest.property}"]`);
  await expect(longRow).toHaveCount(1);
  await longRow.scrollIntoViewIfNeeded();

  let g = await panelGeometry(page);
  expect(g.panelScroll.sw, "no horizontal scrollbar on the panel").toBeLessThanOrEqual(g.panelScroll.cw);
  expect(g.body.sw, "no horizontal scrollbar in the body").toBeLessThanOrEqual(g.body.cw);
  expect(g.outside, "every name and value stays within the panel width").toEqual([]);
  // the longest value really wraps (more than one line) inside the panel
  const longText = longRow.locator(".cv-prop-text");
  const longBox = await longText.boundingBox();
  const lineHeight = await longText.evaluate((n) => parseFloat(getComputedStyle(n).lineHeight));
  expect(longBox.height, "the longest value spans several lines").toBeGreaterThan(lineHeight * 1.5);
  expect(longBox.x + longBox.width).toBeLessThanOrEqual(g.panel.right);

  // the GlobalId (22 characters, unbroken; BUG-T2) is shown whole and wraps within the panel width, into at most two
  // lines next to the reserved row-tool slots (as the reference, ref CSS L1774-1777)
  const guidValue = panel.locator(
    '.cv-det-group[data-group="Allgemein"] .cv-prop-row[data-key="GlobalId"] .cv-prop-text',
  );
  const guid = (await page.evaluate((k) => window.__calc.rows.find((r) => r.key === k).guid, longest.key)) || "";
  await expect(guidValue).toHaveText(guid);
  const guidBox = await guidValue.boundingBox();
  expect(guidBox.x + guidBox.width).toBeLessThanOrEqual(g.panel.right);
  expect(guidBox.height, "GlobalId in at most two lines").toBeLessThan(lineHeight * 2.5);

  // height: the panel ends above the topmost pill (pill stack #cv-pills, TASK-015a) and at least 96 px above the
  // bottom of the 3D view (toolbar zone); content higher than the panel scrolls inside the body
  const view = await page.locator("#cv-canvas-box").boundingBox();
  expect(g.panel.top).toBeGreaterThanOrEqual(view.y);
  expect(g.panel.bottom, "above the toolbar zone").toBeLessThanOrEqual(view.y + view.height - 96 + 0.5);
  const pillTop = await page.evaluate(() => {
    const tops = [...document.querySelectorAll("#cv-pills > *")]
      .map((n) => n.getBoundingClientRect())
      .filter((r) => r.height > 0)
      .map((r) => r.top);
    return tops.length ? Math.min(...tops) : null;
  });
  if (pillTop !== null) expect(g.panel.bottom, "above the topmost pill").toBeLessThanOrEqual(pillTop);
  // the pill stack's height (--cv-pills-h on #cv-canvas-box, as the reference's --tov-pills-h) lowers the limit
  await page.evaluate(() => document.getElementById("cv-canvas-box").style.setProperty("--cv-pills-h", "150px"));
  g = await panelGeometry(page);
  expect(g.panel.bottom, "above a 150 px pill stack (+16 px gap)").toBeLessThanOrEqual(
    view.y + view.height - 150 - 32 + 0.5,
  );
  expect(g.body.sh, "content higher than the panel").toBeGreaterThan(g.body.ch);
  const scrolled = await page.evaluate(() => {
    const body = document.getElementById("cv-props-body");
    body.scrollTop = 120;
    return body.scrollTop;
  });
  expect(scrolled, "the body scrolls").toBeGreaterThan(0);
  expect(await page.evaluate(() => getComputedStyle(document.getElementById("cv-props-body")).overflowY)).toBe("auto");
  await page.evaluate(() => document.getElementById("cv-canvas-box").style.removeProperty("--cv-pills-h"));
  expect(errors).toEqual([]);
});

test("@e2e @REQ-007 properties panel header: kicker, title, model chip, `Ausblenden` / `Isolieren`, `Schließen`; row tools on every property row", async ({
  page,
}) => {
  const errors = await openWith(page, FZK);
  const [wall] = await keysOfGuids(page, [SEL.wall.GlobalId]);
  await clickRow(page, wall);
  const panel = page.locator("#cv-props");
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute("role", "region");
  // kicker in the accent red, upper case (as the reference); the text is the Kategorie value
  const kicker = panel.locator(".cv-det-kicker");
  await expect(kicker).toHaveText(SEL.wall.Kategorie);
  await expect(kicker).toHaveCSS("color", "rgb(215, 38, 34)");
  await expect(kicker).toHaveCSS("text-transform", "uppercase");
  await expect(panel.locator(".cv-det-title")).toHaveText(SEL.wall.Name);
  await expect(panel.locator(".cv-props-chip")).toHaveText("AC20-FZK-Haus");
  // glass panel, radius 14 px, width min(360px, 100% - 32px) (UI-02, ref CSS L1755-1765)
  await expect(panel).toHaveCSS("border-top-left-radius", "14px");
  await expect(panel).toHaveCSS("background-color", "rgba(255, 255, 255, 0.86)");
  expect(Math.round((await panel.boundingBox()).width)).toBe(360);
  for (const name of ["Ausblenden", "Isolieren", "Schließen"])
    await expect(panel.getByRole("button", { name, exact: true }), name).toBeVisible();
  // a click on a panel control does not reach the 3D view (the selection stays)
  await panel.locator(".cv-det-group-head").first().click();
  await panel.locator(".cv-det-group-head").first().click();
  expect((await viewState(page)).selected).toEqual([wall]);

  // every property row has the two row tools; hidden until hover or keyboard focus (REQ-007-AC7 is TASK-017b's)
  const rowCount = await panel.locator(".cv-prop-row").count();
  expect(rowCount).toBeGreaterThan(10);
  expect(await panel.getByRole("button", { name: "Nach Wert filtern", exact: true }).count()).toBe(rowCount);
  expect(await panel.getByRole("button", { name: "Farbe nach Wert", exact: true }).count()).toBe(rowCount);
  const guidRow = panel.locator('.cv-prop-row[data-key="GlobalId"]');
  const tools = guidRow.locator(".cv-row-tools");
  await page.mouse.move(0, 0);
  await expect(tools).toHaveCSS("opacity", "0");
  await guidRow.hover();
  await expect(tools).toHaveCSS("opacity", "1");
  await page.mouse.move(0, 0);
  await guidRow.getByRole("button", { name: "Nach Wert filtern" }).focus();
  await expect(tools).toHaveCSS("opacity", "1");

  // `Schließen` clears the selection and closes the panel
  await panel.getByRole("button", { name: "Schließen", exact: true }).click();
  await expect(panel).toBeHidden();
  expect((await viewState(page)).selected).toEqual([]);
  expect(await page.evaluate(() => window.__calc.view.selected)).toBeNull();

  // at 1024 px the panel stays inside the 3D view and limits its height to it (spec 2 Devices)
  await page.setViewportSize({ width: 1024, height: 700 });
  await clickRow(page, wall);
  await expect(panel).toBeVisible();
  const view = await page.locator("#cv-canvas-box").boundingBox();
  const box = await panel.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(view.x);
  expect(box.x + box.width).toBeLessThanOrEqual(view.x + view.width);
  expect(box.y).toBeGreaterThanOrEqual(view.y);
  expect(box.y + box.height).toBeLessThanOrEqual(view.y + view.height);
  expect(errors).toEqual([]);
});
