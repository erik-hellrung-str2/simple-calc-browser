// T2 integration (spec Testing: "config save -> load round trip", TASK-007, REQ-009): in-page, without the file
// dialogs. Fixture IFC -> conversion -> extraction -> a state set through the seams -> CalcConfig.state() as JSON ->
// a fresh page with the same IFC -> CalcConfig.loadText -> the same configuration and the same filter result.
import { readFileSync } from "node:fs";
import { test, expect } from "../support/network-guard.mjs";
import { REF, fixture, loadFiles, openBuilder } from "../support/builder.mjs";
import { idle, legendEntries, viewState } from "../support/view-3d.mjs";

const FZK = fixture("AC20-FZK-Haus.ifc");
const SEL = REF["REQ-007-selection"];
const VOLUME = REF["REQ-006-grouping-fzk"].column;

test.describe.configure({ timeout: 180_000 });

// REQ-009-AC1 in part (columns, sort, column filters, grouping; no rules, search, Farbskala or section): the AC ID is
// cited here, not in the title (spec Testing T5; verification INC-2 SYNC-4). Whole AC: test/e2e/config.spec.mjs.
test("@integration @REQ-009 configuration state -> JSON -> load in a fresh page gives the same configuration and filter result", async ({
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

// TASK-012 / TASK-018 (CR-002, DEC-20): configuration files of 1.0.0 and 1.1.0 through the real builder, in-page
// (CalcConfig.loadText / state()). Expected values from the DEC-20 field table, the DEC-15 scale formula (spec) and
// reference-values.json REQ-009-rules (STEP-text derivation), not from the code under test. REQ-009-AC4..AC8 through
// the UI: test/e2e/config-compat.spec.mjs (TASK-018).
/** The 25 colours of a DEC-15 scale of base (12 % tint .. full colour), lower-case hex. */
function scaleColours(base) {
  const rgb = [1, 3, 5].map((at) => parseInt(base.slice(at, at + 2), 16));
  return Array.from({ length: 25 }, (_, k) => {
    const a = 0.12 + (0.88 * k) / 24;
    return (
      "#" +
      rgb
        .map((c) =>
          Math.round(255 + (c - 255) * a)
            .toString(16)
            .padStart(2, "0"),
        )
        .join("")
    );
  });
}
const EMPTY = "#c4c7ca";
const MULTI = "#6e6259";

for (const [file, flipped] of [
  ["config-1.0.0-axis-section.json", false],
  ["config-1.0.0-axis-section-flipped.json", true],
]) {
  test(`@integration @robustness 1.0.0 configuration ${file}: no notice, Farbskala Blau for the numeric colouring, section kept, saved as sectionPlane`, async ({
    page,
  }) => {
    const errors = await openBuilder(page);
    await loadFiles(page, FZK);
    await idle(page);
    const text = readFileSync(fixture(file), "utf8");
    const old = JSON.parse(text);
    const loaded = await page.evaluate(([t, name]) => window.CalcConfig.loadText(t, name), [text, file]);
    expect(loaded).toMatchObject({ ok: true, notice: null });
    await idle(page);
    const view = await viewState(page);
    // the 1.0.0 axis section is converted (DEC-20): point 0 except Z = offset, normal -Z (not flipped, keeps <= offset)
    // or +Z (flipped); cv-3d reports the plane (spec 4.4, TASK-014; was the axis section itself)
    expect(view.section).toEqual({ point: [0, 0, old.display.section.offset], normal: [0, 0, flipped ? 1 : -1] });
    // Farbskala in Blau (#1F6FD1): every coloured element has a scale colour, (leer) or mehrere Werte; the smallest
    // volume the 12 % tint #e4eef9, the largest the full colour
    const blue = scaleColours("#1f6fd1");
    expect(blue[0]).toBe("#e4eef9");
    const colours = Object.values(view.colours).map((c) => c.toLowerCase());
    expect(colours.length).toBeGreaterThan(0);
    for (const c of colours) expect([...blue, EMPTY, MULTI]).toContain(c);
    expect(colours).toContain("#e4eef9");
    expect(colours).toContain("#1f6fd1");
    const legend = (await legendEntries(page)).filter((e) => e.kind === "value");
    expect(legend[0].colour.toLowerCase()).toBe("#e4eef9");
    expect(legend[legend.length - 1].colour.toLowerCase()).toBe("#1f6fd1");
    // saving again writes the DEC-20 fields: sectionPlane (no section), mode and colour of the 1.0.0 look
    const saved = await page.evaluate(() => window.CalcConfig.state());
    expect(saved.display).toEqual({
      mode: "ghost",
      colourBy: old.display.colourBy,
      colourMode: "scale",
      scaleColour: "#1f6fd1",
      sectionPlane: { point: [0, 0, old.display.section.offset], normal: [0, 0, flipped ? 1 : -1] },
    });
    expect(saved.filterRules).toEqual([]);
    expect(saved.search).toBe("");
    expect(errors).toEqual([]);
  });
}

test("@integration @robustness 1.1.0 configuration: rules, search text, Farbskala Gruen and the section plane apply; the whole file is saved unchanged", async ({
  page,
}) => {
  const errors = await openBuilder(page);
  await loadFiles(page, FZK);
  await idle(page);
  const text = readFileSync(fixture("config-1.1.0-full.json"), "utf8");
  const file = JSON.parse(text);
  const loaded = await page.evaluate((t) => window.CalcConfig.loadText(t, "neu.json"), text);
  expect(loaded).toMatchObject({ ok: true, notice: null });
  await idle(page);
  const view = await viewState(page);
  // plane { point [0, 0, z], normal [0, 0, -1] } (= the 1.0.0 axis section Z at z, not flipped, keeps <= z); cv-3d
  // reports the plane as given (spec 4.4, TASK-014; was the axis section)
  expect(view.section).toEqual(file.display.sectionPlane);
  const green = scaleColours("#2e9b4f");
  const colours = Object.values(view.colours).map((c) => c.toLowerCase());
  for (const c of colours) expect([...green, EMPTY, MULTI]).toContain(c);
  // TASK-018 (changed expectation): the file's rules and search now apply, so only the 9 ground-floor walls are shown
  // and coloured, and the largest volume of the model (a slab, outside the rules) is not among them; was: the full
  // colour #2e9b4f among the colours while the rules were not applied yet. Each shown element has the DEC-15 step of
  // its volume between the model's smallest and largest volume (numbers by value min -> max over all rows).
  const rows = await page.evaluate(
    (key) => window.__calc.rows.map((r) => [r.key, r.values[key]]),
    file.display.colourBy,
  );
  const volumes = rows.map(([, v]) => v).filter((v) => typeof v === "number");
  const [min, max] = [Math.min(...volumes), Math.max(...volumes)];
  const byKey = new Map(rows);
  expect(Object.keys(view.colours).length).toBe(REF["REQ-009-rules"]["config-1.1.0-full"].count);
  for (const [key, hex] of Object.entries(view.colours)) {
    const v = byKey.get(key);
    const want = typeof v === "number" ? green[Math.round(((v - min) / (max - min)) * 24)] : EMPTY;
    expect(hex.toLowerCase(), key).toBe(want);
  }
  const saved = await page.evaluate(() => window.CalcConfig.state());
  expect(saved.display).toEqual(file.display);
  // TASK-018: the rules (in order, the `Freie Textsuche` rule with key null) and the search text apply and are saved
  // again, so the whole file round-trips (was: display only, rules and search were validated but not applied)
  expect(saved).toEqual(file);
  expect(JSON.stringify(saved, null, 2) + "\n").toBe(text);
  const full = REF["REQ-009-rules"]["config-1.1.0-full"];
  expect([full.rules, full.search]).toEqual([file.filterRules, file.search]);
  const shown = await page.evaluate(() => ({
    rules: window.__calc.filter.rules,
    search: window.__calc.filter.search,
    guids: window.__calc.filter.keys.map((k) => window.__calc.rows.find((r) => r.key === k).guid).sort(),
  }));
  expect(shown).toEqual({ rules: file.filterRules, search: file.search, guids: full.globalIds });
  expect(errors).toEqual([]);
});
