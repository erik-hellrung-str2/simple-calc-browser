// Derives test/fixtures/reference-values.json (spec Testing -> Test data) from the IFC STEP text, independently of
// the product's extraction code and of fragments: scripts/ref/step.mjs parses STEP, scripts/ref/ifc-model.mjs applies
// the REQ-002 rules (Kategorie, attributes, Typ, Geschoss via the spatial tree, Material incl. layer sets else the
// type's, psets with occurrence over type, length/area/volume to m/m2/m3 via IfcUnitAssignment).
//
//   node scripts/ref/derive-reference.mjs          needs test-cache/fixtures/ (node scripts/fetch-fixtures.mjs) for
//                                                   the SampleCastle and Revit MEP sections; without them those
//                                                   sections are kept from the existing JSON
//   node scripts/ref/derive-reference.mjs --check  exit 1 if the committed JSON differs from a fresh derivation
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadIfc } from "./ifc-model.mjs";
import { MASS_PROPERTY, MASS_TARGET } from "../make-unit-fixtures.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const FIX = ROOT + "test/fixtures/";
const CACHE = ROOT + "test-cache/fixtures/";
const OUT = FIX + "reference-values.json";
const read = (p) => loadIfc(readFileSync(p, "latin1"));
const round = (x) => (typeof x === "number" ? Number(x.toPrecision(12)) : x);

/** Classes whose presence as table rows depends on the importer's class set (not fixed by REQ-002). */
const CONDITIONAL = ["IfcAnnotation", "IfcOpeningElement", "IfcVirtualElement", "IfcDistributionPort", "IfcSpace"];

function unitText(u) {
  if (!u) return null;
  if (u.kind === "si") return `IfcSIUnit ${u.prefix ? u.prefix + " " : ""}${u.name}`;
  if (u.kind === "conversion")
    return `IfcConversionBasedUnit '${u.name}' = ${u.valueComponent} x (${unitText(u.base)})`;
  if (u.kind === "derived")
    return `IfcDerivedUnit ${u.elements.map((e) => `${unitText(e.unit)}^${e.exponent}`).join(" * ")}`;
  if (u.kind === "monetary") return `IfcMonetaryUnit ${u.name}`;
  return u.kind;
}
const unitsOf = (m) => Object.fromEntries(Object.entries(m.units).map(([k, u]) => [k, unitText(u)]));

function refElement(m, stepId, why, quantityKeys) {
  const e = m.element(stepId);
  if (e.conflicts.length) throw new Error(`#${stepId}: conflicting property values ${e.conflicts}`);
  const quantities = {};
  for (const k of quantityKeys) {
    const p = e.props[k];
    if (!p || typeof p.raw !== "number") throw new Error(`#${stepId} ${e.Name}: no numeric ${k}`);
    quantities[k] = { value: round(p.value), unit: p.siUnit ?? null, raw: p.raw, measure: p.measure, source: p.source };
  }
  return {
    why,
    stepId,
    GlobalId: e.GlobalId,
    Kategorie: e.Kategorie,
    Name: e.Name,
    Typ: e.Typ,
    typeClass: e.typeClass,
    Geschoss: e.Geschoss,
    Material: e.Material,
    materialSource: e.materialSource,
    materialAssociation: e.materialEntities,
    hasRepresentationInIfc: e.hasRepresentation,
    quantities,
  };
}

function fzkSection() {
  const m = read(FIX + "AC20-FZK-Haus.ifc");
  const els = m.elements.map((id) => m.element(id));
  const byKat = (e, ks) => ks.includes(e.Kategorie);
  const ground = m.storeys.map((s) => s.args).find((a) => a[9] === 0);
  const groundName = ground[2];
  const ac1 = els.filter((e) => byKat(e, ["IfcWallStandardCase", "IfcSlab"]));
  const ac2 = ac1.filter((e) => e.Geschoss === groundName);
  const onGround = els.filter((e) => e.Geschoss === groundName);
  const count = (list) => {
    const c = {};
    for (const e of list) c[e.Kategorie] = (c[e.Kategorie] ?? 0) + 1;
    return Object.fromEntries(Object.entries(c).sort(([a], [b]) => a.localeCompare(b)));
  };
  const core = count(onGround.filter((e) => !CONDITIONAL.includes(e.Kategorie)));
  const conditional = count(onGround.filter((e) => CONDITIONAL.includes(e.Kategorie)));
  const virtual = els.filter((e) => e.Kategorie === "IfcVirtualElement");
  const byGeschoss = {};
  for (const e of els) if (e.Geschoss !== null) (byGeschoss[e.Geschoss] ??= []).push(e);
  const carriers = (key) => {
    const list = els.filter((e) => key in e.props);
    return { count: list.length, byKategorie: count(list) };
  };

  const Q = (...k) => k;
  const elements = [
    refElement(
      m,
      21966,
      "wall, single-layer IfcMaterialLayerSetUsage, ground floor",
      Q("BaseQuantities.Length", "BaseQuantities.GrossSideArea", "BaseQuantities.NetVolume"),
    ),
    refElement(
      m,
      34509,
      "slab, IfcMaterialLayerSetUsage, ground floor",
      Q("BaseQuantities.Width", "BaseQuantities.GrossArea", "BaseQuantities.GrossVolume"),
    ),
    refElement(
      m,
      17468,
      "door with type and material",
      Q("BaseQuantities.Height", "BaseQuantities.Area", "BaseQuantities.Volume"),
    ),
    refElement(
      m,
      23024,
      "window with type and material",
      Q("BaseQuantities.Width", "BaseQuantities.Area", "BaseQuantities.Volume"),
    ),
    refElement(
      m,
      27013,
      "element without material (neither occurrence nor type 'Eingangstür' has one): Material empty",
      Q("BaseQuantities.Width", "BaseQuantities.Area"),
    ),
    refElement(m, 60012, "wall on the upper storey (storey via containment)", Q("BaseQuantities.Length")),
    refElement(m, 35169, "member whose type object has no Name (IfcMemberType #35265, Name $): Typ empty", []),
  ];
  return {
    file: "AC20-FZK-Haus.ifc",
    schema: m.schema,
    unitAssignment: unitsOf(m),
    unitNote:
      "length METRE, area SQUARE_METRE, volume CUBIC_METRE without prefix: expected values equal the raw IFC values",
    elementsInStepText: els.length,
    elementsInStepTextByKategorie: count(els),
    storeys: m.storeys.map((s) => ({ Name: s.args[2], GlobalId: s.args[0], elevation: s.args[9] })),
    elementsByGeschossAndKategorie: Object.fromEntries(
      Object.keys(byGeschoss)
        .sort()
        .map((g) => [g, count(byGeschoss[g])]),
    ),
    propertyCarriers: {
      note: "Elements whose properties contain the key (occurrence or type), per Kategorie; the catalogue count of a property is the sum over the classes the extractor lists as rows",
      "BaseQuantities.Length": carriers("BaseQuantities.Length"),
    },
    elements,
    conditionalElements: virtual.map((e) => ({
      why: "IfcVirtualElement: no storey, no material, no representation in the IFC. Assert only if the extractor lists IfcVirtualElement as rows; then Geschoss, Material empty and Geometrie = Nein",
      stepId: e.stepId,
      GlobalId: e.GlobalId,
      Kategorie: e.Kategorie,
      Name: e.Name,
      Typ: e.Typ,
      Geschoss: e.Geschoss,
      Material: e.Material,
      hasRepresentationInIfc: e.hasRepresentation,
    })),
    filters: {
      "REQ-004-AC1": {
        filter: { Kategorie: ["IfcWallStandardCase", "IfcSlab"] },
        expectedCount: ac1.length,
        expectedGlobalIds: ac1.map((e) => e.GlobalId).sort(),
      },
      "REQ-004-AC2": {
        filter: { Kategorie: ["IfcWallStandardCase", "IfcSlab"], Geschoss: [groundName] },
        groundFloorStorey: { Name: groundName, GlobalId: ground[0], elevation: ground[9] },
        expectedCount: ac2.length,
        expectedGlobalIds: ac2.map((e) => e.GlobalId).sort(),
        kategorieCountsOnGroundFloor: core,
        kategorieCountsOnGroundFloorConditional: conditional,
        note: "With Geschoss = ground floor checked, the Kategorie filter set lists exactly kategorieCountsOnGroundFloor, plus each class of kategorieCountsOnGroundFloorConditional that the extractor lists as rows (IfcSpace only with the IfcSpace option on; the ground floor aggregates 6 IfcSpace).",
      },
    },
  };
}

const countByKategorie = (list) => {
  const c = {};
  for (const e of list) c[e.Kategorie] = (c[e.Kategorie] ?? 0) + 1;
  return Object.fromEntries(Object.entries(c).sort(([a], [b]) => a.localeCompare(b)));
};

function duplexSection() {
  const m = read(FIX + "Ifc2x3_Duplex_Architecture.ifc");
  const els = m.elements.map((id) => m.element(id));
  return {
    file: "Ifc2x3_Duplex_Architecture.ifc",
    schema: m.schema,
    elementsInStepText: els.length,
    elementsInStepTextByKategorie: countByKategorie(els),
    note: "Row count of the model = elementsInStepText minus the classes of elementsInStepTextByKategorie the extractor does not list as rows (IfcOpeningElement; REQ-001-AC1 Modell set)",
  };
}

/**
 * REQ-005-AC4 (TASK-005): an element of the committed Duplex fixture with exactly two materials (lowest STEP id among
 * those with a representation), for `Faerben nach` = Material -> `mehrere Werte`.
 */
function multiMaterialSection() {
  const m = read(FIX + "Ifc2x3_Duplex_Architecture.ifc");
  const els = m.elements.map((id) => ({ id, e: m.element(id) }));
  const candidates = els.filter(({ e }) => e.Material.length === 2 && e.hasRepresentation).sort((a, b) => a.id - b.id);
  const { id, e } = candidates[0];
  return {
    file: "Ifc2x3_Duplex_Architecture.ifc",
    element: { stepId: id, GlobalId: e.GlobalId, Kategorie: e.Kategorie, Name: e.Name, Material: e.Material },
    elementsWithSeveralMaterials: els.filter(({ e }) => e.Material.length > 1).length,
    note: "Material = sorted distinct IfcMaterial names (layer set usage); this element has two, so colouring by Material gives it the `mehrere Werte` colour",
  };
}

/**
 * NFR-001 robustness (TASK-004): Revit MEP + SampleCastle loaded together. One Name value with a few elements, all of
 * them of a class the extractor always lists as rows; picked deterministically (median of the sorted candidates).
 */
function nameFilterSection() {
  const files = ["Ifc4_Revit_MEP.ifc", "Ifc2x3_SampleCastle.ifc"];
  if (!files.every((f) => existsSync(CACHE + f))) return null;
  const all = files.flatMap((f) => {
    const m = read(CACHE + f);
    return m.elements.map((id) => m.element(id));
  });
  const byName = new Map();
  for (const e of all) {
    if (!byName.has(e.Name)) byName.set(e.Name, []);
    byName.get(e.Name).push(e);
  }
  const candidates = [...byName]
    .filter(
      ([n, list]) =>
        typeof n === "string" &&
        n.trim() !== "" &&
        list.length >= 2 &&
        list.length <= 50 &&
        list.every((e) => !CONDITIONAL.includes(e.Kategorie)),
    )
    .map(([n]) => n)
    .sort();
  const name = candidates[Math.floor(candidates.length / 2)];
  const hits = byName.get(name);
  return {
    files,
    filter: { Name: [name] },
    expectedCount: hits.length,
    expectedGlobalIds: hits.map((e) => e.GlobalId).sort(),
    byKategorie: countByKategorie(hits),
    note: "Name value chosen as the median of the sorted Name values that have 2..50 elements, none of a conditional class",
  };
}

function feetSection(fzk) {
  const m = read(FIX + "fzk-feet.ifc");
  const FT = 0.3048;
  const wall = refElement(
    m,
    21966,
    "wall of fzk-feet.ifc: length quantities in feet -> m (x 0.3048); area/volume units unchanged (m2, m3)",
    ["BaseQuantities.Length", "BaseQuantities.Width", "BaseQuantities.GrossSideArea", "BaseQuantities.NetVolume"],
  );
  const src = fzk.elements.find((e) => e.stepId === 21966).quantities;
  for (const k of ["BaseQuantities.Length"]) {
    if (Math.abs(wall.quantities[k].value - src[k].raw * FT) > 1e-9) throw new Error("feet conversion mismatch " + k);
  }
  if (wall.quantities["BaseQuantities.GrossSideArea"].value !== src["BaseQuantities.GrossSideArea"].value)
    throw new Error("area must stay unchanged in fzk-feet.ifc");
  return {
    file: "fzk-feet.ifc",
    unitAssignment: unitsOf(m),
    lengthFactorToMetre: m.toSiFactor("LENGTHUNIT"),
    elements: [wall],
    headers: {
      "BaseQuantities.Length": "BaseQuantities.Length (m)",
      "BaseQuantities.GrossSideArea": "BaseQuantities.GrossSideArea (m²)",
    },
  };
}

function unitPairSection() {
  const key = `${MASS_PROPERTY.pset}.${MASS_PROPERTY.name}`;
  const one = (file) => {
    const m = read(FIX + file);
    const e = m.element(MASS_TARGET.stepId);
    const p = e.props[key];
    if (!p || p.raw !== MASS_PROPERTY.value || p.measure !== "IFCMASSMEASURE")
      throw new Error(`${file}: ${key} missing`);
    const carriers = m.elements.filter((id) => key in m.element(id).props).map((id) => m.element(id).GlobalId);
    return {
      file,
      massUnit: unitText(m.units.MASSUNIT),
      GlobalId: e.GlobalId,
      Name: e.Name,
      value: p.raw,
      measure: p.measure,
      carriers,
    };
  };
  const a = one("fzk-unit-a.ifc");
  const b = one("fzk-unit-b.ifc");
  return {
    property: key,
    a,
    b,
    expected: {
      singleModel:
        "each file alone: value 7857 unchanged (mass is not converted, DEC-2), unit = the file's project mass unit (a: kg, b: pound)",
      bothLoaded: `header '${key} (gemischt)', unit gemischt, no group/total sums for this column`,
    },
  };
}

function castleSection() {
  const p = CACHE + "Ifc2x3_SampleCastle.ifc";
  if (!existsSync(p)) return null;
  const m = read(p);
  const e = m.element(263912);
  return {
    file: "Ifc2x3_SampleCastle.ifc",
    schema: m.schema,
    element: {
      stepId: 263912,
      GlobalId: e.GlobalId,
      Kategorie: e.Kategorie,
      Name: e.Name,
      Tag: e.Tag,
      Geschoss: e.Geschoss,
      hasRepresentationInIfc: e.hasRepresentation,
    },
    expected: { Geometrie: "Nein" },
    evidence:
      "Has a representation in the IFC, but no geometry after fragments 3.4.7 conversion: spike scratchpad spike-extraction-check/miss.mjs (getItemsIdsWithGeometry) listed localIds 263912, 270253, 271891, 311100, 315576, 562146, 597457, 753581 among IfcWall/IfcWallStandardCase/IfcCovering/IfcBuildingElementProxy without geometry. GlobalId/class/name here are read from the STEP text.",
  };
}

function mep2000Section() {
  const p = CACHE + "Ifc4_Revit_MEP.ifc";
  if (!existsSync(p)) return null;
  const text = readFileSync(p, "latin1");
  const m = loadIfc(text);
  const kats = ["IfcDuctSegment", "IfcPipeSegment", "IfcPlate", "IfcCovering"];
  const els = m.elements.map((id) => m.element(id)).filter((e) => kats.includes(e.Kategorie));
  const perKategorie = Object.fromEntries(kats.map((k) => [k, els.filter((e) => e.Kategorie === k).length]));
  for (const k of kats) {
    const grep = text.match(new RegExp(`^#\\d+\\s*=\\s*${k.toUpperCase()}\\(`, "gm"))?.length ?? 0;
    if (grep !== perKategorie[k]) throw new Error(`MEP ${k}: parsed ${perKategorie[k]} vs grep ${grep}`);
  }
  if (els.length !== 2000) throw new Error(`MEP 2000 filter gives ${els.length}`);
  return {
    "REQ-006-AC1": {
      file: "Ifc4_Revit_MEP.ifc",
      filter: { Kategorie: kats },
      expectedCount: els.length,
      perKategorie,
      statusLine: "2.000 von <Y> Elementen",
      note: "Single Kategorie filter set with four checked values (OR). No single value or Kategorie x Geschoss/Material/Typ combination of the fetched fixtures gives exactly 2,000. The four counts equal the counts in the spike's fragments table (spike-extraction-check/out/mep.frag.table.json), so they do not depend on geometry. Y (all rows) depends on the extractor's class set and the IfcSpace option and is read from window.__calc at test time.",
    },
  };
}

const existing = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
const fzk = fzkSection();
const out = {
  meta: {
    purpose:
      "Reference values for REQ-001-AC1 (Duplex), REQ-002-AC1/AC6/AC7, REQ-003-AC1, REQ-004-AC1/AC2/AC3, REQ-005-AC4, REQ-006-AC1 and NFR-001 (spec Testing -> Test data)",
    generatedBy: "node scripts/ref/derive-reference.mjs",
    method:
      "Read directly from the IFC STEP text by a dependency-free STEP parser (scripts/ref/step.mjs) and the REQ-002 rules in scripts/ref/ifc-model.mjs; no web-ifc, no fragments, no product code. Elements = rooted IfcProduct instances except spatial structure, relations, type objects and property definitions. Kategorie = IFC class as spelled in the schema (IfcWallStandardCase). Typ = Name of the type object via IfcRelDefinesByType. Geschoss = Name of the nearest IfcBuildingStorey up the containment/aggregation tree. Material = sorted distinct IfcMaterial names of the element's IfcRelAssociatesMaterial (IfcMaterial, list, layer set (usage), constituent set, profile set (usage)), else of its type. Properties keyed '<Pset/Qto name>.<Property>', occurrence over type. Length/area/volume values converted to m/m²/m³ with the project IfcUnitAssignment (SI prefix or IfcConversionBasedUnit factor); other numeric values unconverted. Values rounded to 12 significant digits; compare numbers with a tolerance of 1e-9 relative.",
    reviewedBy: "fresh-context tester (not the TASK-002 implementer)",
    tolerance: { relative: 1e-9 },
  },
  "AC20-FZK-Haus": fzk,
  "fzk-feet": feetSection(fzk),
  "fzk-unit-a-b": unitPairSection(),
  Ifc2x3_Duplex_Architecture: duplexSection(),
  "REQ-005-AC4": multiMaterialSection(),
  "REQ-002-AC7": castleSection() ?? existing["REQ-002-AC7"] ?? null,
  "REQ-006-AC1": mep2000Section()?.["REQ-006-AC1"] ?? existing["REQ-006-AC1"] ?? null,
  "NFR-001-name-filter": nameFilterSection() ?? existing["NFR-001-name-filter"] ?? null,
};
const json = JSON.stringify(out, null, 2) + "\n";
if (process.argv.includes("--check")) {
  if (!existsSync(OUT) || readFileSync(OUT, "utf8") !== json) {
    console.error("derive-reference: test/fixtures/reference-values.json differs from a fresh derivation");
    process.exit(1);
  }
  console.log("derive-reference: reference-values.json up to date");
} else {
  writeFileSync(OUT, json);
  console.log(`derive-reference: wrote ${OUT}`);
}
