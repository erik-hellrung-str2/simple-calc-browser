// TASK-002 integration / acceptance tests on committed fixtures (spec Testing T2/T5): fixture IFC -> conversion
// worker -> extraction -> rows and catalogue in window.__calc, compared with test/fixtures/reference-values.json
// (derived independently from the STEP text) and the unit fixtures. Runs in test_fast (`@integration`, http).
import { readFileSync } from "node:fs";
import { test, expect } from "../support/network-guard.mjs";
import {
  REF,
  catalogEntry,
  countBy,
  expectClose,
  fixture,
  loadFiles,
  openBuilder,
  removeModel,
  rowsByGuid,
} from "../support/builder.mjs";
import { loadIfc } from "../../scripts/ref/ifc-model.mjs";

const FZK = fixture("AC20-FZK-Haus.ifc");
const DUPLEX = fixture("Ifc2x3_Duplex_Architecture.ifc");
const fzkRef = REF["AC20-FZK-Haus"];

test.describe.configure({ timeout: 180_000 });

/** Asserts one reference element (Kategorie, Name, GlobalId, Typ, Geschoss, Material, quantities). */
function expectReferenceRow(row, ref) {
  expect(row, `row for ${ref.GlobalId}`).toBeTruthy();
  const v = row.values;
  expect(v.Kategorie, `${ref.GlobalId} Kategorie`).toBe(ref.Kategorie);
  expect(v.Name ?? null, `${ref.GlobalId} Name`).toBe(ref.Name);
  expect(v.GlobalId, "GlobalId").toBe(ref.GlobalId);
  expect(v.Typ ?? null, `${ref.GlobalId} Typ`).toBe(ref.Typ);
  expect(v.Geschoss ?? null, `${ref.GlobalId} Geschoss`).toBe(ref.Geschoss);
  expect(v.Material ?? [], `${ref.GlobalId} Material`).toEqual(ref.Material);
  for (const [key, q] of Object.entries(ref.quantities || {})) expectClose(v[key], q.value, `${ref.GlobalId} ${key}`);
}

test("@integration @acceptance @REQ-002-AC1 AC20-FZK-Haus reference elements equal reference-values.json", async ({
  page,
}) => {
  const errors = await openBuilder(page);
  await loadFiles(page, FZK);
  const rows = await rowsByGuid(
    page,
    [...fzkRef.elements, ...fzkRef.conditionalElements].map((e) => e.GlobalId),
  );
  for (const ref of fzkRef.elements)
    expectReferenceRow(
      rows.find((r) => r.guid === ref.GlobalId),
      ref,
    );
  // IfcVirtualElement is listed as rows (importer default class), so the conditional elements apply.
  for (const ref of fzkRef.conditionalElements) {
    const row = rows.find((r) => r.guid === ref.GlobalId);
    expectReferenceRow(row, { ...ref, quantities: {} });
    expect(row.values.Geometrie).toBe("Nein");
  }

  // Data basis of the REQ-004 reference filters: the row sets and per-storey category counts match.
  const walls = await page.evaluate(() =>
    window.__calc.rows
      .filter((r) => ["IfcWallStandardCase", "IfcSlab"].includes(r.values.Kategorie))
      .map((r) => ({ guid: r.guid, storey: r.values.Geschoss })),
  );
  expect(walls.map((w) => w.guid).sort()).toEqual(fzkRef.filters["REQ-004-AC1"].expectedGlobalIds);
  expect(
    walls
      .filter((w) => w.storey === "Erdgeschoss")
      .map((w) => w.guid)
      .sort(),
  ).toEqual(fzkRef.filters["REQ-004-AC2"].expectedGlobalIds);
  const ac2 = fzkRef.filters["REQ-004-AC2"];
  expect(await countBy(page, "Kategorie", { Geschoss: "Erdgeschoss" })).toEqual({
    ...ac2.kategorieCountsOnGroundFloor,
    ...ac2.kategorieCountsOnGroundFloorConditional, // IfcAnnotation is an importer element class -> rows
  });

  // Catalogue: special properties first, pset properties with group, kind, unit, count and header.
  const catalog = await page.evaluate(() => window.__calc.catalog);
  expect(catalog.slice(0, 3).map((e) => e.key)).toEqual(["Modell", "Kategorie", "Name"]);
  const length = catalog.find((e) => e.key === "BaseQuantities.Length");
  const withLength = await page.evaluate(
    () => window.__calc.rows.filter((r) => r.values["BaseQuantities.Length"] !== undefined).length,
  );
  expect(length).toEqual({
    key: "BaseQuantities.Length",
    label: "BaseQuantities.Length",
    group: "BaseQuantities",
    kind: "number",
    unit: "m",
    count: withLength,
    header: "BaseQuantities.Length (m)",
  });
  expect(catalog.find((e) => e.key === "Material")).toMatchObject({ group: "Allgemein", kind: "multi" });
  expect(catalog.find((e) => e.key === "Modell").count).toBe(await page.evaluate(() => window.__calc.rows.length));
  expect(errors).toEqual([]);
});

test("@integration @acceptance @REQ-002-AC5 numeric-looking IfcLabel values stay text", async ({ page }) => {
  await openBuilder(page);
  await loadFiles(page, FZK);
  // ArchiCADProperties.Raumnummer is IFCLABEL '6' etc. in the STEP text.
  const values = await page.evaluate(() =>
    window.__calc.rows.map((r) => r.values["ArchiCADProperties.Raumnummer"]).filter((v) => v !== undefined),
  );
  expect(values.length).toBeGreaterThan(0);
  for (const value of values) expect(typeof value).toBe("string");
  expect(values).toContain("6");
  expect(await catalogEntry(page, "ArchiCADProperties.Raumnummer")).toMatchObject({ kind: "text", unit: null });
});

test("@integration @acceptance @REQ-002-AC6 length in feet is shown in m; different mass units are gemischt", async ({
  page,
}) => {
  await openBuilder(page);
  await loadFiles(page, fixture("fzk-feet.ifc"));
  const feet = REF["fzk-feet"];
  const [row] = await rowsByGuid(page, [feet.elements[0].GlobalId]);
  expectReferenceRow(row, feet.elements[0]);
  for (const [key, header] of Object.entries(feet.headers)) expect((await catalogEntry(page, key)).header).toBe(header);
  await removeModel(page, "fzk-feet");

  const ab = REF["fzk-unit-a-b"];
  await loadFiles(page, fixture(ab.a.file));
  const single = await catalogEntry(page, ab.property);
  expect(single).toMatchObject({ kind: "number", unit: "kg", header: `${ab.property} (kg)`, count: 1 });
  const [a] = await rowsByGuid(page, [ab.a.GlobalId]);
  expect(a.values[ab.property]).toBe(ab.a.value); // mass is not converted (DEC-2)

  await loadFiles(page, fixture(ab.b.file));
  const mixed = await catalogEntry(page, ab.property);
  expect(mixed).toMatchObject({ kind: "number", unit: "gemischt", header: `${ab.property} (gemischt)`, count: 2 });
  const both = await rowsByGuid(page, [ab.a.GlobalId]);
  expect(both.map((r) => [r.values.Modell, r.values[ab.property]]).sort()).toEqual([
    ["fzk-unit-a", 7857],
    ["fzk-unit-b", 7857],
  ]);
  // Lengths of both models are in m, so they are not mixed.
  expect((await catalogEntry(page, "BaseQuantities.Length")).unit).toBe("m");
  await removeModel(page, "fzk-unit-a");
  expect(await catalogEntry(page, ab.property)).toMatchObject({ unit: "lb", header: `${ab.property} (lb)` });
});

test("@integration @acceptance @REQ-002-AC4 layered material lists every layer material once", async ({ page }) => {
  await openBuilder(page);
  await loadFiles(page, DUPLEX);
  // Expected values from the independent STEP reader (scripts/ref), not from the product code.
  const ref = loadIfc(readFileSync(DUPLEX, "latin1"));
  const layered = ref.elements.map((id) => ref.element(id)).filter((e) => e.Material.length > 1);
  expect(layered.length).toBeGreaterThan(0);
  const rows = await rowsByGuid(
    page,
    layered.map((e) => e.GlobalId),
  );
  expect(rows.length).toBe(layered.length);
  for (const e of layered) {
    const row = rows.find((r) => r.guid === e.GlobalId);
    expect(row.values.Material, e.GlobalId).toEqual(e.Material);
    expect(new Set(row.values.Material).size).toBe(row.values.Material.length);
  }
  const wall = rows.find((r) => r.guid === "2O2Fr$t4X7Zf8NOew3FNld");
  expect(wall.values.Material).toEqual(["Metal - Stud Layer", "Plasterboard"]);
  expect((await catalogEntry(page, "Material")).kind).toBe("multi");
});

test("@integration @acceptance @REQ-001-AC5 the same file twice gets `A` and `A (2)`; removing one keeps the other", async ({
  page,
}) => {
  await openBuilder(page);
  await loadFiles(page, FZK);
  await loadFiles(page, FZK);
  const models = await page.evaluate(() => window.__calc.models);
  expect(models.map((m) => m.modell)).toEqual(["AC20-FZK-Haus", "AC20-FZK-Haus (2)"]);
  const counts = await countBy(page, "Modell");
  expect(counts["AC20-FZK-Haus"]).toBeGreaterThan(0);
  expect(counts).toEqual({ "AC20-FZK-Haus": models[0].elements, "AC20-FZK-Haus (2)": models[1].elements });
  expect(models[1].elements).toBe(models[0].elements);
  const keys = await page.evaluate(() => window.__calc.rows.map((r) => r.key));
  expect(new Set(keys).size).toBe(keys.length); // DEC-4: same GlobalId twice -> two rows with distinct keys
  await expect(page.locator("#cv-models li")).toHaveCount(2);

  await removeModel(page, "AC20-FZK-Haus");
  expect(await countBy(page, "Modell")).toEqual({ "AC20-FZK-Haus (2)": models[1].elements });
  expect(await page.evaluate(() => [window.__calc.modelCount, window.__calc.models.map((m) => m.modell)])).toEqual([
    1,
    ["AC20-FZK-Haus (2)"],
  ]);
  await expect(page.locator("#cv-models li")).toHaveCount(1);
});

test("@integration @acceptance @REQ-001-AC3 removing a model removes its rows and catalogue entries (data level)", async ({
  page,
}) => {
  await openBuilder(page);
  await loadFiles(page, [FZK, DUPLEX]);
  const before = await countBy(page, "Modell");
  expect(Object.keys(before).sort()).toEqual(["AC20-FZK-Haus", "Ifc2x3_Duplex_Architecture"]);
  // a property only the Duplex model has
  const duplexOnly = "PSet_Revit_Constraints.Level";
  expect((await catalogEntry(page, duplexOnly)).count).toBeGreaterThan(0);
  expect((await catalogEntry(page, "Modell")).count).toBe(before["AC20-FZK-Haus"] + before.Ifc2x3_Duplex_Architecture);

  await removeModel(page, "Ifc2x3_Duplex_Architecture");
  expect(await countBy(page, "Modell")).toEqual({ "AC20-FZK-Haus": before["AC20-FZK-Haus"] });
  expect(await catalogEntry(page, duplexOnly)).toBeNull();
  expect((await catalogEntry(page, "Modell")).count).toBe(before["AC20-FZK-Haus"]);
  expect(await page.evaluate(() => window.__calc.modelCount)).toBe(1);
});

test("@integration @acceptance @REQ-001-AC4 IfcSpace rows only with `Räume (IfcSpace) einbeziehen` (data level)", async ({
  page,
}) => {
  await openBuilder(page);
  const toggle = page.getByLabel("Räume (IfcSpace) einbeziehen");
  await expect(toggle).not.toBeChecked(); // DEC-13 default off
  await loadFiles(page, FZK);
  const spacesInStep = (readFileSync(FZK, "latin1").match(/=\s*IFCSPACE\s*\(/g) || []).length;
  expect(spacesInStep).toBeGreaterThan(0);
  const withoutSpaces = await page.evaluate(() => window.__calc.rows.length);
  expect((await countBy(page, "Kategorie")).IfcSpace).toBeUndefined();

  const before = await page.evaluate(() => window.__calc.loads);
  await toggle.check();
  await page.waitForFunction((n) => window.__calc.loads > n && window.__calc.phase === "ready", before);
  expect((await countBy(page, "Kategorie")).IfcSpace).toBe(spacesInStep);
  expect(await page.evaluate(() => window.__calc.rows.length)).toBe(withoutSpaces + spacesInStep);
  expect(await page.evaluate(() => window.__calc.options.includeSpaces)).toBe(true);

  const again = await page.evaluate(() => window.__calc.loads);
  await toggle.uncheck();
  await page.waitForFunction((n) => window.__calc.loads > n && window.__calc.phase === "ready", again);
  expect((await countBy(page, "Kategorie")).IfcSpace).toBeUndefined();
  expect(await page.evaluate(() => window.__calc.rows.length)).toBe(withoutSpaces);
});

test("@integration @acceptance @robustness @REQ-001-AC2 each load error class shows its message; the valid model stays", async ({
  page,
}) => {
  const errors = await openBuilder(page);
  await loadFiles(page, FZK);
  const rowsBefore = await page.evaluate(() => window.__calc.rows.length);
  // too-large: test hook makes the next conversion worker raise an `error` event
  await page.evaluate(() => {
    window.__calc.test.crashNextConversion = true;
  });
  await loadFiles(page, [
    fixture("error-empty.ifc"),
    fixture("error-renamed-pdf.ifc"),
    fixture("error-ifc4x3-header.ifc"),
    fixture("error-truncated.ifc"),
    { name: "zu-gross.ifc", mimeType: "application/octet-stream", buffer: readFileSync(FZK) },
  ]);
  const expected = [
    ["error-empty.ifc", "empty", "error-empty.ifc ist leer."],
    ["error-renamed-pdf.ifc", "not-ifc", "error-renamed-pdf.ifc ist keine IFC-Datei."],
    [
      "error-ifc4x3-header.ifc",
      "unsupported-schema",
      "error-ifc4x3-header.ifc verwendet das nicht unterstützte Schema IFC4X3_ADD2.",
    ],
    [
      "error-truncated.ifc",
      "unreadable",
      "error-truncated.ifc konnte nicht gelesen werden: die Datei ist unvollständig (END-ISO-10303-21 fehlt).",
    ],
    ["zu-gross.ifc", "too-large", "zu-gross.ifc ist möglicherweise zu groß für den Arbeitsspeicher des Browsers."],
  ];
  const loadErrors = await page.evaluate(() => window.__calc.loadErrors);
  expect(loadErrors.map((e) => [e.fileName, e.loadClass, e.message])).toEqual(expected);
  for (const [, , message] of expected) await expect(page.locator("#cv-messages")).toContainText(message);

  // The valid model stays loaded, nothing of the failed files was added, and the page remains usable.
  expect(await page.evaluate(() => window.__calc.models.map((m) => m.modell))).toEqual(["AC20-FZK-Haus"]);
  expect(await page.evaluate(() => [window.__calc.rows.length, window.__calc.modelCount])).toEqual([rowsBefore, 1]);
  await expect(page.locator("#cv-load")).toBeEnabled();
  await loadFiles(page, DUPLEX);
  expect(await page.evaluate(() => window.__calc.models.map((m) => m.modell))).toEqual([
    "AC20-FZK-Haus",
    "Ifc2x3_Duplex_Architecture",
  ]);
  expect(errors).toEqual([]);
});

test("@integration @robustness @REQ-001 a conversion worker that never starts becomes an `unreadable` error", async ({
  page,
}) => {
  await openBuilder(page);
  await page.evaluate(() => {
    window.__calc.test.neverStartNextConversion = true;
    window.__calc.test.startTimeoutMs = 1500;
  });
  await loadFiles(page, FZK);
  const [error] = await page.evaluate(() => window.__calc.loadErrors);
  expect(error).toEqual({
    fileName: "AC20-FZK-Haus.ifc",
    loadClass: "unreadable",
    message:
      "AC20-FZK-Haus.ifc konnte nicht gelesen werden: der Konverter ist nicht gestartet (keine Antwort nach 2 s).",
  });
  await expect(page.locator("#cv-messages")).toContainText(error.message);
  expect(await page.evaluate(() => window.__calc.models.length)).toBe(0);
  // the next load uses a normal worker again
  await page.evaluate(() => {
    window.__calc.test.startTimeoutMs = null;
  });
  await loadFiles(page, FZK);
  expect(await page.evaluate(() => window.__calc.models.map((m) => m.modell))).toEqual(["AC20-FZK-Haus"]);
});

test("@integration @REQ-001 progress overlay shows step and percentage while loading", async ({ page }) => {
  await openBuilder(page);
  await page.evaluate(() => {
    window.__seen = [];
    const record = () => {
      const text = document.getElementById("cv-overlay-text").textContent;
      if (text && window.__seen[window.__seen.length - 1] !== text) window.__seen.push(text);
    };
    new MutationObserver(record).observe(document.getElementById("cv-overlay"), {
      subtree: true,
      childList: true,
      characterData: true,
    });
  });
  await loadFiles(page, FZK);
  const seen = await page.evaluate(() => window.__seen);
  expect(
    seen.some((t) => /^AC20-FZK-Haus\.ifc – Konvertierung: \d+ %$/.test(t)),
    seen.join(" | "),
  ).toBe(true);
  expect(
    seen.some((t) => /^AC20-FZK-Haus\.ifc – Extraktion: \d+ %$/.test(t)),
    seen.join(" | "),
  ).toBe(true);
  expect(seen).toContain("AC20-FZK-Haus.ifc – Extraktion: 100 %");
  await expect(page.locator("#cv-overlay")).toBeHidden();
  expect(await page.evaluate(() => window.__calc.progress)).toBeNull();
});

test("@integration @robustness @REQ-001 removing the last model leaves an empty, usable builder (repeated)", async ({
  page,
}) => {
  // Regression: an update(true) after disposing the last model waited for a tile FINISH that never came.
  await openBuilder(page);
  for (let i = 0; i < 3; i++) {
    await loadFiles(page, FZK);
    await removeModel(page, "AC20-FZK-Haus");
    expect(
      await page.evaluate(() => [window.__calc.modelCount, window.__calc.rows.length, window.__calc.catalog[0].count]),
    ).toEqual([0, 0, 0]);
    await expect(page.locator("#cv-load")).toBeEnabled();
  }
});
