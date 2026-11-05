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
import { readStep } from "./step.mjs";
import { EXPORT_PROPERTY, MASS_PROPERTY, MASS_TARGET, RANGE_PROPERTY } from "../make-unit-fixtures.mjs";

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

  // REQ-006-AC4: column filter Name = the name of reference wall #21966; REQ-006-AC5: NetVolume per element
  const acName = m.element(21966).Name;
  const nameHits = els.filter((e) => e.Name === acName);
  const countBy = (list, key) => {
    const c = {};
    for (const e of list) c[e[key] ?? "(leer)"] = (c[e[key] ?? "(leer)"] ?? 0) + 1;
    return Object.fromEntries(Object.entries(c).sort(([a], [b]) => a.localeCompare(b)));
  };
  const VOLUME = "BaseQuantities.NetVolume";
  const volumes = {};
  for (const e of els)
    if (typeof e.props[VOLUME]?.value === "number") volumes[e.GlobalId] = round(e.props[VOLUME].value);
  const spaces = m
    .all("IFCSPACE")
    .map((sp) => sp.args[0])
    .sort();

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
    spaces: {
      note: "IfcSpace instances of the STEP text: rows only with the option `R\u00e4ume (IfcSpace) einbeziehen` (DEC-13, REQ-001-AC4)",
      count: spaces.length,
      GlobalIds: spaces,
    },
    columnValues: {
      note: "Values per GlobalId of the elements that carry the property (others have no value: empty cells, sorted last)",
      [VOLUME]: { unit: "m\u00b3", carriers: Object.keys(volumes).length, byGlobalId: volumes },
    },
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
      "REQ-006-AC4": {
        column: "Name",
        values: [acName],
        expectedCount: nameHits.length,
        expectedGlobalIds: nameHits.map((e) => e.GlobalId).sort(),
        byKategorie: countBy(nameHits, "Kategorie"),
        byGeschoss: countBy(nameHits, "Geschoss"),
        note: "Column filter on Name with the name of reference element #21966; every element with exactly this Name",
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

/**
 * REQ-006-AC9 (TASK-006a): fzk-range.ifc carries CalcTest_Range.Wert on six walls. Expected rows of the numeric column
 * filter for the spec bounds `von` 2 `bis` 5 (inclusive, DEC-17) and for the decimal comma input `2,5` (TASK-003 D2).
 */
function rangeSection() {
  const m = read(FIX + "fzk-range.ifc");
  const key = `${RANGE_PROPERTY.pset}.${RANGE_PROPERTY.name}`;
  const els = m.elements.map((id) => m.element(id));
  const values = {};
  for (const e of els) if (typeof e.props[key]?.value === "number") values[e.GlobalId] = round(e.props[key].value);
  const within = (lo, hi) =>
    Object.entries(values)
      .filter(([, v]) => v >= lo && v <= hi)
      .map(([g]) => g)
      .sort();
  return {
    file: "fzk-range.ifc",
    property: key,
    byGlobalId: values,
    elementsWithoutValue: els.length - Object.keys(values).length,
    "von 2 bis 5": { min: 2, max: 5, expectedGlobalIds: within(2, 5) },
    "von 2,5": { input: "2,5", min: 2.5, max: null, expectedGlobalIds: within(2.5, Infinity) },
    note: "Bounds inclusive; elements without a value are excluded while a bound is set (DEC-17)",
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

/** Neumaier sum of numbers (rounded like every reference value); null if there is none. */
function refSum(values) {
  let sum = 0;
  let comp = 0;
  let any = false;
  for (const v of values) {
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    any = true;
    const t = sum + v;
    comp += Math.abs(sum) >= Math.abs(v) ? sum - t + v : v - t + sum;
    sum = t;
  }
  return any ? round(sum + comp) : null;
}

/** The value of a text attribute if every element has the same non-empty one, else null (REQ-006-AC7). */
function commonText(list, get) {
  const token = (v) =>
    v === null || v === undefined || v === "" ? "" : Array.isArray(v) ? JSON.stringify(v) : String(v);
  if (!list.length || token(get(list[0])) === "") return null;
  const first = token(get(list[0]));
  return list.every((e) => token(get(e)) === first) ? get(list[0]) : null;
}

/**
 * REQ-006-AC2/AC3/AC7/AC8 (TASK-006b): AC20-FZK-Haus grouped by Kategorie, then Geschoss, with the numeric column
 * BaseQuantities.NetVolume. Per Kategorie: element count, volume sum (null = no element has a volume), the common
 * Geschoss / Name / Typ (REQ-006-AC7: value if equal in every element of the group, else null) and the same per
 * Geschoss sub-group ("(leer)" = no storey). All STEP elements are listed by Kategorie; tests leave out the classes
 * the extractor does not list as rows.
 */
function groupingFzkSection() {
  const m = read(FIX + "AC20-FZK-Haus.ifc");
  const els = m.elements.map((id) => m.element(id));
  const VOLUME = "BaseQuantities.NetVolume";
  const volume = (e) => (typeof e.props[VOLUME]?.value === "number" ? e.props[VOLUME].value : null);
  const typ = (e) => e.Typ;
  const byKat = new Map();
  for (const e of els) (byKat.get(e.Kategorie) ?? byKat.set(e.Kategorie, []).get(e.Kategorie)).push(e);
  const groups = {};
  for (const kat of [...byKat.keys()].sort()) {
    const list = byKat.get(kat);
    const byGeschoss = new Map();
    for (const e of list) {
      const g = e.Geschoss ?? "(leer)";
      (byGeschoss.get(g) ?? byGeschoss.set(g, []).get(g)).push(e);
    }
    groups[kat] = {
      count: list.length,
      volume: refSum(list.map(volume)),
      common: {
        Geschoss: commonText(list, (e) => e.Geschoss),
        Name: commonText(list, (e) => e.Name),
        Typ: commonText(list, typ),
      },
      byGeschoss: Object.fromEntries(
        [...byGeschoss.keys()].sort().map((g) => [
          g,
          {
            count: byGeschoss.get(g).length,
            volume: refSum(byGeschoss.get(g).map(volume)),
            common: { Typ: commonText(byGeschoss.get(g), typ) },
          },
        ]),
      ),
    };
  }
  return {
    file: "AC20-FZK-Haus.ifc",
    levels: ["Kategorie", "Geschoss"],
    column: VOLUME,
    unit: "m\u00b3",
    byKategorie: groups,
    note: "Every STEP element by Kategorie (sorted) then Geschoss ('(leer)' = no storey): count, sum of BaseQuantities.NetVolume (Neumaier sum of the unrounded values, then rounded to 12 significant digits; null = no element of the group has a volume) and the common value of the text columns Geschoss / Name / Typ (null = differs or empty). Group rows of the product exist only for the classes it lists as rows; the total row is the sum over those classes.",
  };
}

/**
 * REQ-006-AC10 (TASK-006b): the committed Duplex fixture grouped by Material (multi-valued, DEC-16, ASM-008). Per
 * material ("(leer)" = no material) the elements by Kategorie with count and sum of PSet_Revit_Dimensions.Volume; an
 * element with several materials is in each of its groups. Plus the number of elements with several materials and
 * the totals (each element once).
 */
function groupingDuplexSection() {
  const m = read(FIX + "Ifc2x3_Duplex_Architecture.ifc");
  const els = m.elements.map((id) => ({ id, e: m.element(id) }));
  const VOLUME = "PSet_Revit_Dimensions.Volume";
  const volume = (e) => (typeof e.props[VOLUME]?.value === "number" ? e.props[VOLUME].value : null);
  const groups = new Map();
  for (const { e } of els)
    for (const mat of e.Material.length ? e.Material : ["(leer)"]) {
      const g = groups.get(mat) ?? groups.set(mat, new Map()).get(mat);
      (g.get(e.Kategorie) ?? g.set(e.Kategorie, []).get(e.Kategorie)).push(e);
    }
  const perKategorie = (byKat) =>
    Object.fromEntries(
      [...byKat.keys()]
        .sort()
        .map((k) => [k, { count: byKat.get(k).length, volume: refSum(byKat.get(k).map(volume)) }]),
    );
  const all = new Map();
  for (const { e } of els) (all.get(e.Kategorie) ?? all.set(e.Kategorie, []).get(e.Kategorie)).push(e);
  const multi = els.filter(({ e }) => e.Material.length > 1);
  return {
    file: "Ifc2x3_Duplex_Architecture.ifc",
    level: "Material",
    column: VOLUME,
    byMaterial: Object.fromEntries([...groups.keys()].sort().map((mat) => [mat, perKategorie(groups.get(mat))])),
    totalByKategorie: perKategorie(all),
    elementsWithSeveralMaterials: multi.length,
    severalMaterialsByKategorie: countByKategorie(multi.map(({ e }) => e)),
    note: "Material = sorted distinct IfcMaterial names (REQ-002). Each material group lists its elements by Kategorie with count and sum of PSet_Revit_Dimensions.Volume (m\u00b3; Neumaier sum, rounded to 12 significant digits; null = none has a volume). An element with n materials is in n groups; totalByKategorie counts and sums each element once. Tests leave out the classes the extractor does not list as rows.",
  };
}

/**
 * REQ-007-AC1/AC2/AC3 (TASK-006c): AC20-FZK-Haus grouped by Kategorie then Geschoss; the group rows used for group
 * selection: all IfcWallStandardCase elements and those on the ground floor (level-2 group), with their GlobalIds and
 * whether the STEP text gives them a representation (only those can be highlighted in 3D). The reference wall #21966
 * with its groups (expanded for a 3D pick in the grouping view).
 */
function selectionSection() {
  const m = read(FIX + "AC20-FZK-Haus.ifc");
  const els = m.elements.map((id) => ({ id, e: m.element(id) }));
  const ground = m.storeys.map((s) => s.args).find((a) => a[9] === 0)[2];
  const KAT = "IfcWallStandardCase";
  const walls = els.filter(({ e }) => e.Kategorie === KAT);
  const ids = (list) => list.map(({ e }) => e.GlobalId).sort();
  const withRep = (list) => ids(list.filter(({ e }) => e.hasRepresentation));
  const groundWalls = walls.filter(({ e }) => e.Geschoss === ground);
  const wall = m.element(21966);
  return {
    file: "AC20-FZK-Haus.ifc",
    levels: ["Kategorie", "Geschoss"],
    group: { Kategorie: KAT, count: walls.length, globalIds: ids(walls), withRepresentation: withRep(walls) },
    subGroup: {
      Kategorie: KAT,
      Geschoss: ground,
      count: groundWalls.length,
      globalIds: ids(groundWalls),
      withRepresentation: withRep(groundWalls),
    },
    wall: {
      stepId: 21966,
      GlobalId: wall.GlobalId,
      Kategorie: wall.Kategorie,
      Geschoss: wall.Geschoss,
      Name: wall.Name,
    },
    note: "Group selection (REQ-007): a group row selects every element of the group inside the filter; 3D highlights those with geometry. Kategorie = IFC class, Geschoss = nearest IfcBuildingStorey name (REQ-002 rules).",
  };
}

/**
 * REQ-009-AC2 and the configuration robustness tests (TASK-007): which properties and filter values of the Duplex
 * fixture are absent from AC20-FZK-Haus, so a configuration saved with both models (or hand-written) and loaded with
 * FZK alone must skip and name them. Only classes the extractor always lists as rows count (CONDITIONAL left out).
 * absentProperty: the Duplex-only property with the most elements (ties: name order); absentKategorie: the first
 * Duplex-only Kategorie in name order; present: a Kategorie of FZK with its element count (the part that is applied).
 */
function configSection() {
  const load = (file) => {
    const m = read(FIX + file);
    return m.elements.map((id) => m.element(id)).filter((e) => !CONDITIONAL.includes(e.Kategorie));
  };
  const fzk = load("AC20-FZK-Haus.ifc");
  const duplex = load("Ifc2x3_Duplex_Architecture.ifc");
  const fzkKeys = new Set(fzk.flatMap((e) => Object.keys(e.props)));
  const counts = new Map();
  for (const e of duplex)
    for (const k of Object.keys(e.props)) if (!fzkKeys.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
  const [absentProperty, absentPropertyElements] = [...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0];
  const fzkKategorien = new Set(fzk.map((e) => e.Kategorie));
  const duplexOnly = [...new Set(duplex.map((e) => e.Kategorie))].filter((k) => !fzkKategorien.has(k)).sort();
  const present = "IfcWallStandardCase";
  return {
    files: ["AC20-FZK-Haus.ifc", "Ifc2x3_Duplex_Architecture.ifc"],
    absentProperty,
    absentPropertyElementsInDuplex: absentPropertyElements,
    absentKategorie: duplexOnly[0],
    absentKategorieElementsInDuplex: duplex.filter((e) => e.Kategorie === duplexOnly[0]).length,
    present: { Kategorie: present, elementsInFzk: fzk.filter((e) => e.Kategorie === present).length },
    note: "Property keys '<Pset>.<Property>' (occurrence over type) of elements of row classes (IfcAnnotation, IfcOpeningElement, IfcVirtualElement, IfcDistributionPort, IfcSpace left out). absentProperty and absentKategorie exist in the Duplex fixture and not in AC20-FZK-Haus.",
  };
}

/**
 * REQ-008 (TASK-008): the CSV / Excel export. Single-element view of fzk-export.ifc plus the Duplex fixture with
 * Kategorie = IfcWallStandardCase: every wall with Modell (file name without .ifc, REQ-001), Name, Geschoss, Material
 * (sorted distinct names, REQ-002) and the CalcTest_Export values. Zahl carries the IfcReal literal of the STEP text
 * and its expected CSV text (the literal with a decimal comma, a trailing "." dropped: unrounded, no exponent).
 * Grouping view of AC20-FZK-Haus by Kategorie with IfcWallStandardCase expanded: the walls with Name, Geschoss and
 * BaseQuantities.NetVolume (group rows and the total come from REQ-006-grouping-fzk).
 */
function exportSection() {
  const KAT = "IfcWallStandardCase";
  const modell = (file) => file.replace(/\.ifc$/i, "");
  const literals = (text) => {
    // element STEP id -> { Zahl literal, Text } of the CalcTest_Export property set, straight from the records
    const { entities } = readStep(text);
    const out = new Map();
    for (const rel of entities.values()) {
      if (rel.type !== "IFCRELDEFINESBYPROPERTIES") continue;
      const pset = entities.get(rel.args[5].ref);
      if (pset.type !== "IFCPROPERTYSET" || pset.args[2] !== EXPORT_PROPERTY.pset) continue;
      const values = {};
      for (const ref of pset.args[4]) {
        const prop = entities.get(ref.ref);
        const lit = /IFCREAL\(([^)]*)\)/.exec(prop.raw);
        if (prop.args[0] === EXPORT_PROPERTY.number) values.literal = lit[1];
        if (prop.args[0] === EXPORT_PROPERTY.text) values.text = prop.args[2].value;
      }
      for (const el of rel.args[4]) out.set(el.ref, values);
    }
    return out;
  };
  const walls = (file) => {
    const text = readFileSync(FIX + file, "latin1");
    const m = loadIfc(text);
    const lit = literals(text);
    return m.elements
      .filter((id) => m.element(id).Kategorie === KAT)
      .sort((a, b) => a - b)
      .map((id) => {
        const e = m.element(id);
        const v = lit.get(id) ?? {};
        const zahl = e.props[EXPORT_PROPERTY.pset + "." + EXPORT_PROPERTY.number];
        const textValue = e.props[EXPORT_PROPERTY.pset + "." + EXPORT_PROPERTY.text];
        return {
          stepId: id,
          GlobalId: e.GlobalId,
          Modell: modell(file),
          Kategorie: e.Kategorie,
          Name: e.Name,
          Geschoss: e.Geschoss,
          Material: e.Material,
          Zahl: zahl
            ? { value: zahl.value, literal: v.literal, csv: v.literal.replace(/\.$/, "").replace(".", ",") }
            : null,
          Text: textValue ? textValue.value : null,
        };
      });
  };
  const fzkText = readFileSync(FIX + "AC20-FZK-Haus.ifc", "latin1");
  const fzk = loadIfc(fzkText);
  const VOLUME = "BaseQuantities.NetVolume";
  const fzkWalls = fzk.elements
    .filter((id) => fzk.element(id).Kategorie === KAT)
    .sort((a, b) => a - b)
    .map((id) => {
      const e = fzk.element(id);
      const vol = e.props[VOLUME];
      return {
        GlobalId: e.GlobalId,
        Name: e.Name,
        Geschoss: e.Geschoss,
        [VOLUME]: typeof vol?.value === "number" ? round(vol.value) : null,
      };
    });
  return {
    single: {
      files: ["fzk-export.ifc", "Ifc2x3_Duplex_Architecture.ifc"],
      filter: { Kategorie: [KAT] },
      properties: {
        number: EXPORT_PROPERTY.pset + "." + EXPORT_PROPERTY.number,
        text: EXPORT_PROPERTY.pset + "." + EXPORT_PROPERTY.text,
      },
      rows: [...walls("fzk-export.ifc"), ...walls("Ifc2x3_Duplex_Architecture.ifc")],
    },
    grouped: {
      file: "AC20-FZK-Haus.ifc",
      level: "Kategorie",
      expanded: KAT,
      column: VOLUME,
      walls: fzkWalls,
    },
    note: "Single view: every IfcWallStandardCase of both files (STEP id order per file). Zahl.csv is the IfcReal literal of the STEP text with a decimal comma (expected CSV cell); Text is the decoded IfcText (STEP \\X2\\ escapes). Material = sorted distinct names, joined with ', ' in the export. Grouped: the walls of AC20-FZK-Haus (element rows under the expanded IfcWallStandardCase group) with NetVolume rounded to 12 significant digits; group rows and the total row from REQ-006-grouping-fzk.",
  };
}

/**
 * REQ-012 rules (TASK-015b, CR-002): expected key sets of the rule acceptance tests (AC2-AC6, AC8), derived from the
 * STEP text with the DEC-19 matching written here independently of the product: a value's display text is the
 * table text (numbers German with "." thousands, "," decimals, at most 3 decimals - toLocaleString("de-DE"); IFC
 * booleans `Ja` / `Nein`; text as stored), compared lower-cased; Gleich = equal, Beginnt mit = prefix, Endet mit =
 * suffix, Enthaelt = substring; a multi-valued property (Material) matches if any value matches; an element without
 * the property never matches. Rows: STEP elements except IfcOpeningElement (not a row class, TASK-002) and IfcSpace
 * (option off by default, DEC-13).
 */
function ruleSection() {
  const NOT_ROWS = ["IfcOpeningElement", "IfcSpace"];
  const rowsOf = (file) => {
    const m = read(FIX + file);
    return m.elements.map((id) => m.element(id)).filter((e) => !NOT_ROWS.includes(e.Kategorie));
  };
  const text = (v) => {
    if (typeof v === "number") return v.toLocaleString("de-DE", { maximumFractionDigits: 3 });
    if (v && typeof v === "object" && "enum" in v) return v.enum === "T" ? "Ja" : v.enum === "F" ? "Nein" : v.enum;
    return String(v);
  };
  const texts = (e, key) => {
    if (key === "Material") return e.Material;
    if (["Kategorie", "Name", "GlobalId", "Geschoss", "Typ", "ObjectType", "Tag", "Description"].includes(key))
      return e[key] == null || e[key] === "" ? [] : [e[key]];
    const p = e.props[key];
    return p && p.value != null && p.value !== "" ? [text(p.value)] : [];
  };
  const test = (t, op, needle) => {
    const a = t.toLowerCase();
    const b = needle.toLowerCase();
    return op === "eq" ? a === b : op === "starts" ? a.startsWith(b) : op === "ends" ? a.endsWith(b) : a.includes(b);
  };
  const matches = (e, key, op, value) => texts(e, key).some((t) => test(t, op, value));
  const guids = (list) => list.map((e) => e.GlobalId).sort();
  const fzk = rowsOf("AC20-FZK-Haus.ifc");
  const kategorien = [...new Set(fzk.map((e) => e.Kategorie))].sort(new Intl.Collator("de").compare);

  // AC3: Isolieren Kategorie enthaelt "wall"
  const ac3 = fzk.filter((e) => matches(e, "Kategorie", "contains", "wall"));
  // AC4: Material enthaelt "holz" (the material `Holz`); elements without Material
  const MATERIAL_TEXT = "holz";
  const withMaterialText = fzk.filter((e) => matches(e, "Material", "contains", MATERIAL_TEXT));
  const withoutMaterial = fzk.filter((e) => !e.Material.length);
  // AC5: numeric BaseQuantities.Width shown `0,3`; boolean Pset_BeamCommon.LoadBearing `Ja`
  const NUM = "BaseQuantities.Width";
  const BOOL = "Pset_BeamCommon.LoadBearing";
  const numCases = [
    ["eq", "0,3"],
    ["eq", "0.3"],
    ["starts", "0,"],
    ["ends", ",3"],
  ].map(([op, value]) => ({ op, value, globalIds: guids(fzk.filter((e) => matches(e, NUM, op, value))) }));
  const boolJa = fzk.filter((e) => matches(e, BOOL, "eq", "ja"));
  const boolNein = fzk.filter((e) => matches(e, BOOL, "eq", "nein"));
  // AC5 multi-valued: Duplex element with two materials (REQ-005-AC4), Material gleich "plasterboard"
  const duplex = rowsOf("Ifc2x3_Duplex_Architecture.ifc");
  const MULTI_VALUE = "plasterboard";
  const multiMatch = duplex.filter((e) => matches(e, "Material", "eq", MULTI_VALUE));
  // AC6: Freie Textsuche gleich <GlobalId of the reference wall #21966>: elements with any value equal to it
  const wall = fzk.find((e) => e.stepId === 21966);
  const anyKeys = (e) =>
    ["Kategorie", "Name", "GlobalId", "Geschoss", "Typ", "ObjectType", "Tag", "Description", "Material"].concat(
      Object.keys(e.props),
    );
  const ac6 = fzk.filter((e) => anyKeys(e).some((k) => matches(e, k, "eq", wall.GlobalId)));
  // AC8: Geschoss = Erdgeschoss, column filter Name on two walls, Isolieren Kategorie enthaelt "wall", Ausblenden Name
  // endet mit "ERDG-2"
  const ground = "Erdgeschoss";
  const names = ["Wand-Ext-ERDG-1", "Wand-Ext-ERDG-2"];
  const suffix = "ERDG-2";
  const ac8 = fzk.filter(
    (e) =>
      e.Geschoss === ground &&
      names.includes(e.Name) &&
      matches(e, "Kategorie", "contains", "wall") &&
      !matches(e, "Name", "ends", suffix),
  );
  return {
    file: "AC20-FZK-Haus.ifc",
    rows: fzk.length,
    kategorien,
    "REQ-012-AC3": {
      rule: { mode: "isolate", key: "Kategorie", op: "contains", value: "wall" },
      matchingKategorien: kategorien.filter((k) => k.toLowerCase().includes("wall")),
      count: ac3.length,
      globalIds: guids(ac3),
    },
    "REQ-012-AC4": {
      property: "Material",
      value: MATERIAL_TEXT,
      materials: [...new Set(withMaterialText.flatMap((e) => e.Material))].sort(),
      matching: { count: withMaterialText.length, globalIds: guids(withMaterialText) },
      withoutMaterial: { count: withoutMaterial.length, globalIds: guids(withoutMaterial) },
    },
    "REQ-012-AC5": {
      number: {
        property: NUM,
        valuesShown0_3: fzk.filter((e) => texts(e, NUM)[0] === "0,3").length,
        withoutValue: fzk.filter((e) => !texts(e, NUM).length).length,
        cases: numCases,
      },
      boolean: {
        property: BOOL,
        ja: { count: boolJa.length, globalIds: guids(boolJa) },
        nein: { count: boolNein.length },
      },
      multi: {
        file: "Ifc2x3_Duplex_Architecture.ifc",
        rows: duplex.length,
        element: { stepId: 4131, GlobalId: duplex.find((e) => e.stepId === 4131).GlobalId },
        elementMaterial: duplex.find((e) => e.stepId === 4131).Material,
        rule: { mode: "isolate", key: "Material", op: "eq", value: MULTI_VALUE },
        count: multiMatch.length,
        globalIds: guids(multiMatch),
        multiValued: multiMatch.filter((e) => e.Material.length > 1).length,
      },
    },
    "REQ-012-AC6": {
      stepId: 21966,
      GlobalId: wall.GlobalId,
      Name: wall.Name,
      count: ac6.length,
      globalIds: guids(ac6),
    },
    "REQ-012-AC8": {
      Geschoss: ground,
      names,
      rules: [
        { mode: "isolate", key: "Kategorie", op: "contains", value: "wall" },
        { mode: "hide", key: "Name", op: "ends", value: suffix },
      ],
      count: ac8.length,
      globalIds: guids(ac8),
      Name: ac8.map((e) => e.Name),
    },
    note: "DEC-19 matching re-implemented here on the STEP text (toLocaleString de-DE, at most 3 decimals; IFC booleans Ja/Nein; lower-case comparison; multi-valued Material per value). AC6 checks every attribute, Typ, Geschoss, Material and every pset/qto value of every row for the GlobalId (Modell and Geometrie are not GlobalIds).",
  };
}

/**
 * REQ-013 / REQ-004-AC5 / REQ-012-AC14 (TASK-017a): expected element sets, counts and sums of the element tools
 * `Ausblenden` / `Isolieren` (DEC-18: shown = passes the other filter sources and not hidden and, while isolating,
 * isolated). Rows as ruleSection (no IfcOpeningElement, no IfcSpace). AC5: grouping by Kategorie with the column
 * BaseQuantities.NetVolume; two named ground-floor walls hidden, or the same two isolated. REQ-004-AC5: the Kategorie
 * values of the rows matching `Isolieren` Kategorie enthaelt "wall", before and after hiding one of them.
 * REQ-012-AC14: a text property of the Duplex model that no FZK element has, one of its values, and the Duplex rows
 * matching `Isolieren` <property> enthaelt <value> (lower-case substring of the value as written).
 */
function toolSection() {
  const NOT_ROWS = ["IfcOpeningElement", "IfcSpace"];
  const rowsOf = (file) => {
    const m = read(FIX + file);
    return m.elements.map((id) => m.element(id)).filter((e) => !NOT_ROWS.includes(e.Kategorie));
  };
  const fzk = rowsOf("AC20-FZK-Haus.ifc");
  const VOLUME = "BaseQuantities.NetVolume";
  const volume = (e) => (typeof e.props[VOLUME]?.value === "number" ? e.props[VOLUME].value : null);
  const guids = (list) => list.map((e) => e.GlobalId).sort();
  const walls = fzk.filter((e) => e.Kategorie === "IfcWallStandardCase");
  const TOOL_WALLS = ["Wand-Ext-ERDG-1", "Wand-Ext-ERDG-2"];
  const chosen = TOOL_WALLS.map((name) => walls.find((e) => e.Name === name));
  const isChosen = (e) => chosen.includes(e);
  const groupCase = (shown) => {
    const byKat = {};
    for (const e of shown) (byKat[e.Kategorie] ??= []).push(e);
    return {
      count: shown.length,
      volume: refSum(shown.map(volume)),
      byKategorie: Object.fromEntries(
        Object.keys(byKat)
          .sort()
          .map((k) => [k, { count: byKat[k].length, volume: refSum(byKat[k].map(volume)) }]),
      ),
    };
  };
  const kategorieCounts = (list) => {
    const out = {};
    for (const e of list) out[e.Kategorie] = (out[e.Kategorie] ?? 0) + 1;
    return out;
  };
  const wallRule = fzk.filter((e) => e.Kategorie.toLowerCase().includes("wall"));
  const firstWall = chosen[0];

  // REQ-012-AC14: Duplex-only text property (occurrence pset) and one of its values
  const duplex = rowsOf("Ifc2x3_Duplex_Architecture.ifc");
  const fzkKeys = new Set(fzk.flatMap((e) => Object.keys(e.props)));
  const PROPERTY = "PSet_Revit_Constraints.Base Constraint";
  const VALUE = "Level 1";
  const ruleMatch = duplex.filter(
    (e) =>
      typeof e.props[PROPERTY]?.value === "string" &&
      e.props[PROPERTY].value.toLowerCase().includes(VALUE.toLowerCase()),
  );
  return {
    file: "AC20-FZK-Haus.ifc",
    rows: fzk.length,
    walls: walls
      .map((e) => ({
        stepId: e.stepId,
        Name: e.Name,
        GlobalId: e.GlobalId,
        Geschoss: e.Geschoss,
        volume: round(volume(e)),
      }))
      .sort((a, b) => a.stepId - b.stepId),
    toolWalls: chosen.map((e) => ({ Name: e.Name, GlobalId: e.GlobalId, volume: round(volume(e)) })),
    "REQ-013-AC5": {
      column: VOLUME,
      unit: "m\u00b3",
      hidden: groupCase(fzk.filter((e) => !isChosen(e))),
      isolated: groupCase(fzk.filter(isChosen)),
    },
    "REQ-004-AC5": {
      rule: { mode: "isolate", key: "Kategorie", op: "contains", value: "wall" },
      kategorieCounts: kategorieCounts(wallRule),
      afterHiding: {
        GlobalId: firstWall.GlobalId,
        kategorieCounts: kategorieCounts(wallRule.filter((e) => e !== firstWall)),
      },
      slabs: fzk.filter((e) => e.Kategorie === "IfcSlab").length,
    },
    "REQ-012-AC14": {
      file: "Ifc2x3_Duplex_Architecture.ifc",
      rows: duplex.length,
      property: PROPERTY,
      fzkHasProperty: fzkKeys.has(PROPERTY),
      rule: { mode: "isolate", key: PROPERTY, op: "contains", value: VALUE },
      count: ruleMatch.length,
      globalIds: guids(ruleMatch),
    },
    note: "DEC-18 shown sets on the STEP text: AC5 = all FZK rows minus the two toolWalls (hidden) or exactly them (isolated), grouped by Kategorie with Neumaier sums of BaseQuantities.NetVolume (null = no value). REQ-004-AC5 = Kategorie counts of the rows whose Kategorie contains 'wall' (lower case), then without afterHiding.GlobalId. REQ-012-AC14 = Duplex rows whose occurrence/type value of the property contains the value (lower case); fzkHasProperty false = the rule's property is gone once the Duplex model is removed.",
  };
}

const existing = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
const fzk = fzkSection();
const out = {
  meta: {
    purpose:
      "Reference values for REQ-001-AC1 (Duplex), REQ-002-AC1/AC6/AC7, REQ-003-AC1, REQ-004-AC1/AC2/AC3, REQ-005-AC4, REQ-006-AC1/AC2/AC4/AC5/AC7/AC8/AC9/AC10, REQ-007-AC1/AC2/AC3, REQ-008-AC1/AC3/AC4, REQ-009-AC2, REQ-012-AC2..AC6/AC8/AC14, REQ-013-AC5, REQ-004-AC5 and NFR-001 (spec Testing -> Test data)",
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
  "REQ-006-AC9": rangeSection(),
  "REQ-006-grouping-fzk": groupingFzkSection(),
  "REQ-006-grouping-duplex": groupingDuplexSection(),
  "REQ-007-selection": selectionSection(),
  "REQ-009-config": configSection(),
  "REQ-008-export": exportSection(),
  "REQ-012-rules": ruleSection(),
  "REQ-013-tools": toolSection(),
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
