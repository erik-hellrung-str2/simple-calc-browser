// Small IFC semantic layer over scripts/ref/step.mjs for deriving test reference values
// (spec REQ-002 rules: Kategorie, attributes, Typ, Geschoss, Material, psets with occurrence-over-type, units).
// Independent of the product's extraction code and of fragments. Supports IFC2X3 and IFC4 attribute layouts
// for the entities used here (IfcRoot/IfcObject/IfcProduct prefix attributes are identical in both).
import { readStep } from "./step.mjs";

const SPATIAL = new Set(["IFCPROJECT", "IFCSITE", "IFCBUILDING", "IFCBUILDINGSTOREY", "IFCSPACE"]);
const PREFIX = {
  EXA: 1e18,
  PETA: 1e15,
  TERA: 1e12,
  GIGA: 1e9,
  MEGA: 1e6,
  KILO: 1e3,
  HECTO: 1e2,
  DECA: 1e1,
  DECI: 1e-1,
  CENTI: 1e-2,
  MILLI: 1e-3,
  MICRO: 1e-6,
  NANO: 1e-9,
  PICO: 1e-12,
  FEMTO: 1e-15,
  ATTO: 1e-18,
};

/** IFC class names as the schema spells them (STEP text is upper case). */
const CLASS_NAMES = [
  "IfcWall",
  "IfcWallStandardCase",
  "IfcSlab",
  "IfcDoor",
  "IfcWindow",
  "IfcBeam",
  "IfcColumn",
  "IfcMember",
  "IfcStair",
  "IfcStairFlight",
  "IfcRailing",
  "IfcRoof",
  "IfcCovering",
  "IfcPlate",
  "IfcCurtainWall",
  "IfcBuildingElementProxy",
  "IfcFurnishingElement",
  "IfcFlowTerminal",
  "IfcFlowSegment",
  "IfcFlowFitting",
  "IfcOpeningElement",
  "IfcVirtualElement",
  "IfcAnnotation",
  "IfcSpace",
  "IfcFooting",
  "IfcRamp",
  "IfcRampFlight",
  "IfcDistributionPort",
  "IfcFlowController",
  "IfcEnergyConversionDevice",
  "IfcFlowMovingDevice",
  "IfcDistributionControlElement",
  "IfcFlowStorageDevice",
  "IfcFlowTreatmentDevice",
  "IfcSlabStandardCase",
  "IfcGrid",
  "IfcSite",
  "IfcBuildingElementPart",
  "IfcDistributionElement",
  "IfcDuctFitting",
  "IfcDuctSegment",
  "IfcPipeFitting",
  "IfcPipeSegment",
  "IfcLightFixture",
  "IfcAirTerminal",
  "IfcCableCarrierSegment",
  "IfcCableCarrierFitting",
  "IfcFireSuppressionTerminal",
  "IfcCableSegment",
  "IfcCableFitting",
  "IfcSanitaryTerminal",
  "IfcValve",
  "IfcPump",
  "IfcFan",
  "IfcDamper",
  "IfcUnitaryEquipment",
  "IfcOutlet",
  "IfcSwitchingDevice",
  "IfcElectricAppliance",
  "IfcDuctSilencer",
  "IfcBuilding",
  "IfcBuildingStorey",
  "IfcProject",
  "IfcFurniture",
  "IfcSystemFurnitureElement",
];
const PASCAL = new Map(CLASS_NAMES.map((n) => [n.toUpperCase(), n]));
export const pascal = (t) => PASCAL.get(t) ?? t;

const isRef = (v) => v && typeof v === "object" && "ref" in v;
const refs = (v) => (Array.isArray(v) ? v.filter(isRef).map((x) => x.ref) : isRef(v) ? [v.ref] : []);
const GUID_RE = /^[0-3][0-9A-Za-z_$]{21}$/;

export function loadIfc(text) {
  const { entities: E, schema } = readStep(text);
  const get = (id) => E.get(id);
  const byType = new Map();
  for (const e of E.values()) {
    if (!byType.has(e.type)) byType.set(e.type, []);
    byType.get(e.type).push(e);
  }
  const all = (t) => byType.get(t) ?? [];

  // ---- units (IfcUnitAssignment of the IfcProject) ----
  const units = {};
  function unitInfo(id) {
    const u = get(id);
    if (!u) return null;
    if (u.type === "IFCSIUNIT") {
      const [, unitType, prefix, name] = u.args;
      return {
        kind: "si",
        unitType: unitType.enum,
        prefix: prefix?.enum ?? null,
        name: name.enum,
        id,
        factor: prefix ? PREFIX[prefix.enum] : 1,
      };
    }
    if (u.type === "IFCCONVERSIONBASEDUNIT") {
      const [, unitType, name, conv] = u.args;
      const mwu = get(conv.ref).args; // IfcMeasureWithUnit(ValueComponent, UnitComponent)
      const val = typeof mwu[0] === "object" ? mwu[0].value : mwu[0];
      const base = unitInfo(mwu[1].ref);
      return {
        kind: "conversion",
        unitType: unitType.enum,
        name,
        id,
        factor: val * (base?.factor ?? 1),
        valueComponent: val,
        base,
      };
    }
    if (u.type === "IFCDERIVEDUNIT") {
      const [elems, unitType] = u.args;
      return {
        kind: "derived",
        unitType: unitType.enum,
        id,
        elements: refs(elems).map((r) => {
          const de = get(r).args;
          return { unit: unitInfo(de[0].ref), exponent: de[1] };
        }),
      };
    }
    if (u.type === "IFCMONETARYUNIT") return { kind: "monetary", unitType: "MONETARYUNIT", name: u.args[0], id };
    return { kind: u.type, id };
  }
  const project = all("IFCPROJECT")[0];
  const uaId = project.args[8]?.ref;
  for (const r of refs(get(uaId)?.args[0])) {
    const info = unitInfo(r);
    if (info?.unitType) units[info.unitType] = info;
  }
  // factor to SI base (m, m2, m3): SI prefix applies to the base unit, area/volume prefixes are squared/cubed
  function toSiFactor(unitType, info = units[unitType]) {
    if (!info) return 1;
    if (info.kind === "si") {
      const p = info.prefix ? PREFIX[info.prefix] : 1;
      return unitType === "AREAUNIT" ? p ** 2 : unitType === "VOLUMEUNIT" ? p ** 3 : p;
    }
    if (info.kind === "conversion") {
      // ValueComponent is expressed in UnitComponent, which is an SI unit of the same dimension
      return info.valueComponent * toSiFactor(unitType, info.base);
    }
    return 1;
  }

  // ---- relations ----
  const parentOf = new Map(); // child -> parent (aggregation / containment / nesting)
  const containedIn = new Map();
  const typeOf = new Map();
  const occPsets = new Map();
  const matOf = new Map();
  const push = (m, k, v) => (m.has(k) ? m.get(k).push(v) : m.set(k, [v]));
  for (const r of all("IFCRELAGGREGATES")) for (const c of refs(r.args[5])) parentOf.set(c, r.args[4].ref);
  for (const r of all("IFCRELNESTS"))
    for (const c of refs(r.args[5])) if (!parentOf.has(c)) parentOf.set(c, r.args[4].ref);
  for (const r of all("IFCRELCONTAINEDINSPATIALSTRUCTURE"))
    for (const c of refs(r.args[4])) containedIn.set(c, r.args[5].ref);
  for (const r of all("IFCRELDEFINESBYTYPE")) for (const c of refs(r.args[4])) typeOf.set(c, r.args[5].ref);
  for (const r of all("IFCRELDEFINESBYPROPERTIES")) {
    const def = r.args[5].ref;
    // IFC2X3: IfcRelDefinesByType is a subtype of IfcRelDefinesByProperties; handled above by its own type name
    for (const c of refs(r.args[4])) push(occPsets, c, def);
  }
  for (const r of all("IFCRELASSOCIATESMATERIAL")) for (const c of refs(r.args[4])) push(matOf, c, r.args[5].ref);

  function materialNames(id) {
    const m = get(id);
    if (!m) return [];
    const a = m.args;
    switch (m.type) {
      case "IFCMATERIAL":
        return [a[0]];
      case "IFCMATERIALLIST":
        return refs(a[0]).flatMap(materialNames);
      case "IFCMATERIALLAYERSETUSAGE":
        return materialNames(a[0].ref);
      case "IFCMATERIALLAYERSET":
        return refs(a[0]).flatMap(materialNames);
      case "IFCMATERIALLAYER":
        return a[0] ? materialNames(a[0].ref) : [];
      case "IFCMATERIALCONSTITUENTSET":
        return refs(a[2]).flatMap(materialNames);
      case "IFCMATERIALCONSTITUENT":
        return materialNames(a[2].ref);
      case "IFCMATERIALPROFILESETUSAGE":
      case "IFCMATERIALPROFILESETUSAGETAPERING":
        return materialNames(a[0].ref);
      case "IFCMATERIALPROFILESET":
        return refs(a[2]).flatMap(materialNames);
      case "IFCMATERIALPROFILE":
        return a[2] ? materialNames(a[2].ref) : [];
      default:
        return [];
    }
  }
  const matSet = (id) => [...new Set((matOf.get(id) ?? []).flatMap(materialNames))].sort();

  function storeyOf(id) {
    let cur = containedIn.get(id) ?? parentOf.get(id);
    const seen = new Set();
    while (cur != null && !seen.has(cur)) {
      seen.add(cur);
      const e = get(cur);
      if (e.type === "IFCBUILDINGSTOREY") return e;
      cur = containedIn.get(cur) ?? parentOf.get(cur);
    }
    return null;
  }

  // property definitions -> { "Pset.Prop": {value, measure, unitType?} }
  const MEASURE_UNIT = {
    IFCLENGTHMEASURE: "LENGTHUNIT",
    IFCPOSITIVELENGTHMEASURE: "LENGTHUNIT",
    IFCNONNEGATIVELENGTHMEASURE: "LENGTHUNIT",
    IFCAREAMEASURE: "AREAUNIT",
    IFCVOLUMEMEASURE: "VOLUMEUNIT",
  };
  const QTY = {
    IFCQUANTITYLENGTH: "LENGTHUNIT",
    IFCQUANTITYAREA: "AREAUNIT",
    IFCQUANTITYVOLUME: "VOLUMEUNIT",
    IFCQUANTITYCOUNT: null,
    IFCQUANTITYWEIGHT: "MASSUNIT",
    IFCQUANTITYTIME: "TIMEUNIT",
  };
  function propsOf(defId) {
    const d = get(defId);
    const out = {};
    if (!d) return out;
    const psetName = d.args[2];
    if (d.type === "IFCPROPERTYSET") {
      for (const p of refs(d.args[4])) {
        const pe = get(p);
        if (pe.type !== "IFCPROPERTYSINGLEVALUE") continue;
        const v = pe.args[2];
        const unitType = v ? MEASURE_UNIT[v.type] : undefined;
        out[`${psetName}.${pe.args[0]}`] = {
          raw: v?.value ?? null,
          measure: v?.type ?? null,
          unitType,
          ownUnit: pe.args[3]?.ref ?? null,
        };
      }
    } else if (d.type === "IFCELEMENTQUANTITY") {
      for (const q of refs(d.args[5])) {
        const qe = get(q);
        if (!(qe.type in QTY)) continue;
        out[`${psetName}.${qe.args[0]}`] = {
          raw: qe.args[3],
          measure: qe.type,
          unitType: QTY[qe.type],
          ownUnit: qe.args[2]?.ref ?? null,
        };
      }
    }
    for (const k in out) {
      const p = out[k];
      p.value = p.raw;
      if (typeof p.raw === "number" && ["LENGTHUNIT", "AREAUNIT", "VOLUMEUNIT"].includes(p.unitType)) {
        const f = p.ownUnit ? toSiFactor(p.unitType, unitInfo(p.ownUnit)) : toSiFactor(p.unitType);
        p.value = p.raw * f;
        p.siUnit = { LENGTHUNIT: "m", AREAUNIT: "m²", VOLUMEUNIT: "m³" }[p.unitType];
      }
    }
    return out;
  }

  function element(id) {
    const e = get(id);
    const a = e.args;
    const typeId = typeOf.get(id);
    const t = typeId ? get(typeId) : null;
    const props = {};
    const conflicts = [];
    const merge = (defs, source) => {
      const seen = {};
      for (const ps of defs)
        for (const [k, v] of Object.entries(propsOf(ps))) {
          if (k in seen && seen[k] !== v.raw) conflicts.push(`${source}:${k}`);
          seen[k] = v.raw;
          props[k] = { ...v, source };
        }
    };
    if (t) merge(refs(t.args[5]), "type");
    merge(occPsets.get(id) ?? [], "occurrence"); // occurrence wins (DEC-1)
    let mats = matSet(id);
    let materialSource = "occurrence";
    if (!mats.length && typeId) {
      mats = matSet(typeId);
      materialSource = mats.length ? "type" : "none";
    } else if (!mats.length) materialSource = "none";
    const st = storeyOf(id);
    return {
      stepId: id,
      ifcType: e.type,
      Kategorie: pascal(e.type),
      GlobalId: a[0],
      Name: a[2] ?? null,
      Description: a[3] ?? null,
      ObjectType: a[4] ?? null,
      Tag: a[7] ?? null,
      Typ: t ? (t.args[2] ?? null) : null,
      typeClass: t ? pascal(t.type) : null,
      Geschoss: st ? st.args[2] : null,
      storeyGlobalId: st ? st.args[0] : null,
      Material: mats,
      materialSource,
      materialEntities: (matOf.get(materialSource === "type" ? typeId : id) ?? []).map((r) => get(r).type),
      hasRepresentation: a[6] != null,
      props,
      conflicts,
    };
  }

  // elements: rooted products with a placement slot, excluding spatial structure, relations and type objects
  const elements = [];
  for (const e of E.values()) {
    if (
      e.type.startsWith("IFCREL") ||
      SPATIAL.has(e.type) ||
      /TYPE$|STYLE$|PROPERTIES$|PROPERTYSET$|QUANTITY$/.test(e.type)
    )
      continue;
    if (!/^\s*\(\s*'/.test(e.raw)) continue;
    const a = e.args;
    if (typeof a[0] !== "string" || !GUID_RE.test(a[0]) || a.length < 7) continue;
    const pl = a[5];
    if (!(pl === null || (isRef(pl) && /PLACEMENT$/.test(get(pl.ref).type)))) continue;
    if (!(a[6] === null || (isRef(a[6]) && /PRODUCTDEFINITIONSHAPE|PRODUCTREPRESENTATION/.test(get(a[6].ref).type))))
      continue;
    elements.push(e.id);
  }
  return { schema, E, get, all, units, toSiFactor, element, elements, storeys: all("IFCBUILDINGSTOREY") };
}
