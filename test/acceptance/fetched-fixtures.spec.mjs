// TASK-002 acceptance tests on fetched fixtures (scripts/fetch-fixtures.mjs -> test-cache/fixtures/, sha256-checked).
// Not in test_fast (spec Testing: test_fast = committed fixtures only); part of test_all and `--grep @acceptance`.
// Expected values come from reference-values.json or, where it has none, from the independent STEP reader in
// scripts/ref (no product code).
import { readFileSync } from "node:fs";
import { test, expect } from "../support/network-guard.mjs";
import {
  REF,
  catalogEntry,
  countBy,
  expectClose,
  fetched,
  loadFiles,
  openBuilder,
  rowsByGuid,
} from "../support/builder.mjs";
import { loadIfc } from "../../scripts/ref/ifc-model.mjs";

test.describe.configure({ timeout: 300_000 });

test("@acceptance @REQ-002-AC2 Revit MEP (mm): Qto_WallBaseQuantities.Length is shown in m with header (m)", async ({
  page,
}) => {
  const file = fetched("Ifc4_Revit_MEP.ifc");
  const ref = loadIfc(readFileSync(file, "latin1"));
  expect([ref.units.LENGTHUNIT.prefix, ref.units.LENGTHUNIT.name]).toEqual(["MILLI", "METRE"]);
  const key = "Qto_WallBaseQuantities.Length";
  const walls = ref.elements
    .map((id) => ref.element(id))
    .filter((e) => /^IfcWall/.test(e.Kategorie) && e.props[key] && typeof e.props[key].raw === "number");
  expect(walls.length).toBeGreaterThan(0);

  const errors = await openBuilder(page);
  await loadFiles(page, file, 240_000);
  const rows = await rowsByGuid(
    page,
    walls.map((w) => w.GlobalId),
  );
  expect(rows.length).toBe(walls.length);
  for (const wall of walls) {
    const row = rows.find((r) => r.guid === wall.GlobalId);
    expectClose(row.values[key], wall.props[key].raw / 1000, `${wall.GlobalId} ${key}`);
  }
  expect(await catalogEntry(page, key)).toMatchObject({ kind: "number", unit: "m", header: `${key} (m)` });

  // Data basis of REQ-006-AC1 (2,000-element filter): the four category counts of reference-values.json.
  const ac1 = REF["REQ-006-AC1"];
  const byKategorie = await countBy(page, "Kategorie");
  for (const [kategorie, count] of Object.entries(ac1.perKategorie))
    expect(byKategorie[kategorie], kategorie).toBe(count);
  expect(errors).toEqual([]);
});

test("@acceptance @REQ-002-AC3 Revit ARC: occurrence value wins over the type value; a type-only value is shown", async ({
  page,
}) => {
  const file = fetched("Ifc4_Revit_ARC.ifc");
  const ref = loadIfc(readFileSync(file, "latin1"));
  // Found with the STEP reader: wall with Pset_WallCommon.IsExternal = T on the occurrence and F on its type;
  // curtain wall whose Pset_CurtainWallCommon.Reference exists only on its type.
  const both = { guid: "3lLx0gNe59vvExhby0Bfew", key: "Pset_WallCommon.IsExternal", expected: "Ja" };
  const typeOnly = {
    guid: "3Yxgiuz3TDpeHhosGP5bD6",
    key: "Pset_CurtainWallCommon.Reference",
    expected: "SH_Curtain wall",
  };
  const id = (guid) => ref.elements.find((i) => ref.element(i).GlobalId === guid);
  const refBoth = ref.element(id(both.guid)).props[both.key];
  expect([refBoth.source, refBoth.raw]).toEqual(["occurrence", { enum: "T" }]);
  const refType = ref.element(id(typeOnly.guid)).props[typeOnly.key];
  expect([refType.source, refType.raw]).toEqual(["type", typeOnly.expected]);

  await openBuilder(page);
  await loadFiles(page, file, 240_000);
  const rows = await rowsByGuid(page, [both.guid, typeOnly.guid]);
  expect(rows.find((r) => r.guid === both.guid).values[both.key]).toBe(both.expected);
  expect(rows.find((r) => r.guid === typeOnly.guid).values[typeOnly.key]).toBe(typeOnly.expected);
});

test("@acceptance @REQ-002-AC7 SampleCastle: an element that loses its geometry is a row with Geometrie = Nein", async ({
  page,
}) => {
  const ac7 = REF["REQ-002-AC7"];
  await openBuilder(page);
  await loadFiles(page, fetched(ac7.file), 240_000);
  const [row] = await rowsByGuid(page, [ac7.element.GlobalId]);
  expect(row).toBeTruthy();
  expect(row.values).toMatchObject({
    Kategorie: ac7.element.Kategorie,
    Name: ac7.element.Name,
    Tag: ac7.element.Tag,
    Geschoss: ac7.element.Geschoss,
    Geometrie: ac7.expected.Geometrie,
  });
  expect(row.geometry).toBe(false);
  expect(row.localId).toBe(ac7.element.stepId);
});
