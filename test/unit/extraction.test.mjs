// [unit] tests of the pure TASK-002 logic in cv-core (spec REQ-001, REQ-002, §4.3): load-error classes and messages,
// model names, row classes, units (SI prefix, conversion-based, mixed), storeys, materials, value rules,
// occurrence-over-type merge and the property catalogue. Item data objects mimic fragments' getItemsData output
// ({ _category: { value }, Name: { value, type }, Relation: [items] }).
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadCore } from "../load-core.mjs";

const core = await loadCore();

// ---- helpers building fragments-shaped item data ----
const a = (value, type) => ({ value, type });
const item = (category, attrs = {}, rels = {}) => {
  const out = { _category: { value: category } };
  for (const [k, v] of Object.entries(attrs)) out[k] = v && typeof v === "object" && "value" in v ? v : { value: v };
  return Object.assign(out, rels);
};
const prop = (name, value, type) => item("IFCPROPERTYSINGLEVALUE", { Name: name, NominalValue: a(value, type) });
const pset = (name, props) => item("IFCPROPERTYSET", { Name: name }, { HasProperties: props });
const qto = (name, quantities) => item("IFCELEMENTQUANTITY", { Name: name }, { Quantities: quantities });
const qLength = (name, v) => item("IFCQUANTITYLENGTH", { Name: name, LengthValue: a(v, "IFCLENGTHMEASURE") });
const qArea = (name, v) => item("IFCQUANTITYAREA", { Name: name, AreaValue: a(v, "IFCAREAMEASURE") });
const qVolume = (name, v) => item("IFCQUANTITYVOLUME", { Name: name, VolumeValue: a(v, "IFCVOLUMEMEASURE") });
const material = (name) => item("IFCMATERIAL", { Name: name });
const siUnit = (unitType, name, prefix) =>
  item("IFCSIUNIT", { UnitType: unitType, Name: name, ...(prefix ? { Prefix: prefix } : {}) });
const conversionUnit = (unitType, name, factor, base) =>
  item(
    "IFCCONVERSIONBASEDUNIT",
    { UnitType: unitType, Name: name },
    {
      ConversionFactor: [item("IFCMEASUREWITHUNIT", { ValueComponent: factor }, { UnitComponent: [base] })],
    },
  );
const element = (localId, category, attrs, rels) =>
  item(category, { _localId: localId, _guid: "guid-" + localId, ...attrs }, rels);

// ---------------------------------------------------------------------------------------------------------------
// REQ-001: load errors and model names
// ---------------------------------------------------------------------------------------------------------------
const HEAD_OK = "ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION((''),'2;1');\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\n";
const TAIL_OK = "#1=IFCWALL($);\nENDSEC;\nEND-ISO-10303-21;\n";

test("[unit] REQ-001 classifyIfcFile: valid IFC2X3 and IFC4 files pass", () => {
  assert.equal(core.classifyIfcFile(100, HEAD_OK, TAIL_OK), null);
  assert.equal(core.classifyIfcFile(100, HEAD_OK.replace("IFC4", "IFC2X3"), TAIL_OK), null);
  assert.equal(core.classifyIfcFile(100, "\u00ef\u00bb\u00bf  \r\n" + HEAD_OK, TAIL_OK + "\r\n\u0000"), null);
  assert.equal(core.classifyIfcFile(100, HEAD_OK.replace("'IFC4'", "'ifc4'"), TAIL_OK), null);
});

test("[unit] REQ-001 classifyIfcFile: each error class", () => {
  assert.deepEqual(core.classifyIfcFile(0, "", ""), { loadClass: "empty", detail: null });
  assert.deepEqual(core.classifyIfcFile(10, "%PDF-1.4\n", "%%EOF"), { loadClass: "not-ifc", detail: null });
  assert.deepEqual(core.classifyIfcFile(10, HEAD_OK.replace("IFC4", "IFC4X3_ADD2"), TAIL_OK), {
    loadClass: "unsupported-schema",
    detail: "IFC4X3_ADD2",
  });
  assert.equal(core.classifyIfcFile(10, HEAD_OK, "#99=IFCWALL('2O2Fr$t4X7Zf8NOew3FNld',#").loadClass, "unreadable");
  assert.match(core.classifyIfcFile(10, HEAD_OK, "#99=IFCW").detail, /END-ISO-10303-21 fehlt/);
  assert.deepEqual(core.classifyIfcFile(10, "ISO-10303-21;\nHEADER;\nENDSEC;", TAIL_OK), {
    loadClass: "unreadable",
    detail: "FILE_SCHEMA fehlt im Dateikopf",
  });
});

test("[unit] REQ-001 loadErrorMessage: German text with file name per class", () => {
  assert.equal(core.loadErrorMessage("empty", "a.ifc"), "a.ifc ist leer.");
  assert.equal(core.loadErrorMessage("not-ifc", "a.ifc"), "a.ifc ist keine IFC-Datei.");
  assert.equal(
    core.loadErrorMessage("unsupported-schema", "a.ifc", "IFC4X3_ADD2"),
    "a.ifc verwendet das nicht unterst\u00fctzte Schema IFC4X3_ADD2.",
  );
  assert.equal(core.loadErrorMessage("unreadable", "a.ifc", "kaputt."), "a.ifc konnte nicht gelesen werden: kaputt.");
  assert.equal(core.loadErrorMessage("unreadable", "a.ifc"), "a.ifc konnte nicht gelesen werden: unbekannte Ursache.");
  assert.equal(
    core.loadErrorMessage("too-large", "a.ifc"),
    "a.ifc ist m\u00f6glicherweise zu gro\u00df f\u00fcr den Arbeitsspeicher des Browsers.",
  );
  assert.throws(() => core.loadErrorMessage("other", "a.ifc"), /Unbekannte Fehlerklasse/);
  const error = new core.LoadError("empty", "x.ifc");
  assert.ok(error instanceof Error);
  assert.deepEqual(
    [error.loadClass, error.fileName, error.detail, error.message],
    ["empty", "x.ifc", null, "x.ifc ist leer."],
  );
  assert.deepEqual(core.LOAD_ERROR_CLASSES, ["empty", "not-ifc", "unsupported-schema", "unreadable", "too-large"]);
});

test("[unit] REQ-001 model names: file name without extension, duplicates get (2), (3)", () => {
  assert.equal(core.modelNameFromFile("AC20-FZK-Haus.ifc"), "AC20-FZK-Haus");
  assert.equal(core.modelNameFromFile("C:\\x\\a.b.ifc"), "a.b");
  assert.equal(core.modelNameFromFile(".ifc"), ".ifc");
  assert.equal(core.modelNameFromFile("noext"), "noext");
  assert.equal(core.uniqueModelName("A", []), "A");
  assert.equal(core.uniqueModelName("A", ["A"]), "A (2)");
  assert.equal(core.uniqueModelName("A", ["A", "A (2)"]), "A (3)");
  assert.equal(core.uniqueModelName("A", ["A (2)"]), "A");
});

// ---------------------------------------------------------------------------------------------------------------
// REQ-002 / spec 4.3: importer config, row classes, data configs
// ---------------------------------------------------------------------------------------------------------------
test("[unit] spec 4.3 importer extra classes and relation config", () => {
  assert.deepEqual(core.IMPORTER_EXTRA_CLASSES, [
    "IFCDOORSTYLE",
    "IFCWINDOWSTYLE",
    "IFCCONVERSIONBASEDUNIT",
    "IFCMEASUREWITHUNIT",
  ]);
  assert.equal(core.INDEX_CHUNK_SIZE, 2000);
  const on = { attributes: true, relations: true };
  const off = { attributes: false, relations: false };
  const rel = core.ITEM_DATA_CONFIG.relations;
  for (const name of ["IsDefinedBy", "HasAssociations", "HasPropertySets"]) assert.deepEqual(rel[name], on, name);
  for (const name of ["DefinesOccurrence", "ObjectTypeOf", "AssociatedTo", "ContainsElements", "IsDecomposedBy"])
    assert.deepEqual(rel[name], off, name);
  assert.deepEqual(core.ITEM_DATA_CONFIG.relationsDefault, off);
});

test("[unit] REQ-002 rowClasses drops spatial structure and type objects; IfcSpace only by option", () => {
  const classes = ["IFCPROJECT", "IFCSITE", "IFCBUILDING", "IFCBUILDINGSTOREY", "IFCSPACE", "IFCWALL", "IFCDOOR"];
  assert.deepEqual(core.rowClasses([...classes, "IFCWALLTYPE", "IFCDOORSTYLE", "IFCWALL"], false), [
    "IFCDOOR",
    "IFCWALL",
  ]);
  assert.deepEqual(core.rowClasses(classes, true), ["IFCDOOR", "IFCSPACE", "IFCWALL"]);
  const re = core.categoryPattern(["IFCWALL", "IFCDOOR"]);
  assert.ok(re.test("IFCWALL") && re.test("IFCDOOR"));
  assert.ok(!re.test("IFCWALLSTANDARDCASE") && !re.test("XIFCWALL"));
});

test("[unit] REQ-002 classNameMap gives the schema spelling of a category", () => {
  const map = core.classNameMap([
    ["IfcWall", "IfcWallStandardCase", "IfcLabel"],
    ["IfcDoorStyle", "notAClass"],
  ]);
  assert.equal(map.get("IFCWALLSTANDARDCASE"), "IfcWallStandardCase");
  assert.equal(map.get("IFCDOORSTYLE"), "IfcDoorStyle");
  assert.equal(map.has("NOTACLASS"), false);
});

// ---------------------------------------------------------------------------------------------------------------
// Units (DEC-2)
// ---------------------------------------------------------------------------------------------------------------
test("[unit] DEC-2 describeUnit: SI with prefix, conversion-based, derived, monetary", () => {
  assert.deepEqual(core.describeUnit(siUnit("LENGTHUNIT", "METRE", "MILLI")), {
    unitType: "LENGTHUNIT",
    kind: "si",
    exponent: -3,
    factor: 0.001,
    label: "mm",
  });
  const area = core.describeUnit(siUnit("AREAUNIT", "SQUARE_METRE", "CENTI"));
  assert.ok(Math.abs(area.factor - 1e-4) < 1e-18);
  assert.equal(area.label, "cm\u00b2");
  const volume = core.describeUnit(siUnit("VOLUMEUNIT", "CUBIC_METRE", "MILLI"));
  assert.ok(Math.abs(volume.factor - 1e-9) < 1e-21);
  assert.equal(core.describeUnit(siUnit("MASSUNIT", "GRAM", "KILO")).label, "kg");
  const foot = core.describeUnit(conversionUnit("LENGTHUNIT", "FOOT", 0.3048, siUnit("LENGTHUNIT", "METRE")));
  assert.deepEqual(foot, { unitType: "LENGTHUNIT", kind: "conversion", factor: 0.3048, label: "ft" });
  const inchInMm = core.describeUnit(
    conversionUnit("LENGTHUNIT", "inch", 25.4, siUnit("LENGTHUNIT", "METRE", "MILLI")),
  );
  assert.ok(Math.abs(inchInMm.factor - 0.0254) < 1e-15);
  assert.equal(inchInMm.label, "in");
  const pound = core.describeUnit(conversionUnit("MASSUNIT", "POUND", 0.45359237, siUnit("MASSUNIT", "GRAM", "KILO")));
  assert.equal(pound.label, "lb");
  assert.equal(core.describeUnit(conversionUnit("MASSUNIT", "Stone", 6.35, null)).factor, null);
  assert.equal(core.describeUnit(conversionUnit("MASSUNIT", "Stone", 6.35, null)).label, "stone");
  assert.equal(
    core.describeUnit(item("IFCDERIVEDUNIT", { UnitType: "THERMALTRANSMITTANCEUNIT" })).label,
    "W/(m\u00b2\u00b7K)",
  );
  assert.equal(
    core.describeUnit(item("IFCDERIVEDUNIT", { UnitType: "USERDEFINED", UserDefinedType: "kWh/a" })).label,
    "kWh/a",
  );
  assert.deepEqual(core.describeUnit(item("IFCMONETARYUNIT", { Currency: "EUR" })), {
    unitType: "MONETARYUNIT",
    kind: "monetary",
    factor: null,
    label: "EUR",
  });
  assert.equal(core.describeUnit(null), null);
  assert.equal(core.describeUnit(item("IFCSOMETHING")), null);
});

test("[unit] DEC-2 parseUnits + convertUnit: lengths/areas/volumes to m, m2, m3; other units unchanged", () => {
  const units = core.parseUnits([
    item(
      "IFCUNITASSIGNMENT",
      {},
      {
        Units: [
          siUnit("LENGTHUNIT", "METRE", "MILLI"),
          siUnit("AREAUNIT", "SQUARE_METRE"),
          conversionUnit("VOLUMEUNIT", "CUBIC FOOT", 0.028316846592, siUnit("VOLUMEUNIT", "CUBIC_METRE")),
          siUnit("MASSUNIT", "GRAM", "KILO"),
          siUnit("LENGTHUNIT", "METRE"), // a second LENGTHUNIT is ignored: the first wins
        ],
      },
    ),
  ]);
  assert.deepEqual(core.convertUnit(9700, "IFCLENGTHMEASURE", units), { value: 9.7, unit: "m" });
  assert.deepEqual(core.convertUnit(300, "IFCPOSITIVELENGTHMEASURE", units), { value: 0.3, unit: "m" });
  assert.deepEqual(core.convertUnit(25.59, "IFCAREAMEASURE", units), { value: 25.59, unit: "m\u00b2" });
  const v = core.convertUnit(10, "IFCVOLUMEMEASURE", units);
  assert.ok(Math.abs(v.value - 0.28316846592) < 1e-12);
  assert.equal(v.unit, "m\u00b3");
  assert.deepEqual(core.convertUnit(7857, "IFCMASSMEASURE", units), { value: 7857, unit: "kg" });
  assert.deepEqual(core.convertUnit(3, "IFCCOUNTMEASURE", units), { value: 3, unit: null });
  assert.deepEqual(core.convertUnit(0.4, "IFCTHERMALTRANSMITTANCEMEASURE", units), { value: 0.4, unit: null });
  // no unit assignment: lengths are taken as metres
  assert.deepEqual(core.convertUnit(2, "IFCLENGTHMEASURE", {}), { value: 2, unit: "m" });
  assert.deepEqual(core.convertUnit(2, undefined, units), { value: 2, unit: null });
});

test("[unit] REQ-002-AC6 a length in feet is shown in m", () => {
  const units = core.parseUnits([
    item(
      "IFCUNITASSIGNMENT",
      {},
      {
        Units: [conversionUnit("LENGTHUNIT", "FOOT", 0.3048, siUnit("LENGTHUNIT", "METRE"))],
      },
    ),
  ]);
  const r = core.convertUnit(9.7, "IFCLENGTHMEASURE", units);
  assert.equal(r.unit, "m");
  assert.ok(Math.abs(r.value - 2.95656) < 1e-12);
});

// ---------------------------------------------------------------------------------------------------------------
// Storeys and materials
// ---------------------------------------------------------------------------------------------------------------
const TREE = {
  category: "IFCPROJECT",
  localId: null,
  children: [
    {
      category: null,
      localId: 1,
      children: [
        {
          category: "IFCBUILDINGSTOREY",
          localId: null,
          children: [
            {
              category: null,
              localId: 10,
              children: [
                { category: "IFCWALL", localId: null, children: [{ category: null, localId: 100, children: [] }] },
                {
                  category: "IFCSTAIR",
                  localId: null,
                  children: [
                    {
                      category: null,
                      localId: 101,
                      children: [{ category: "IFCSTAIRFLIGHT", localId: null, children: [{ localId: 102 }] }],
                    },
                  ],
                },
              ],
            },
            { category: null, localId: 11, children: [{ category: "IFCSLAB", children: [{ localId: 110 }] }] },
          ],
        },
        { category: "IFCWALL", localId: null, children: [{ category: null, localId: 200, children: [] }] },
      ],
    },
  ],
};

test("[unit] REQ-002 Geschoss = nearest storey ancestor, also through aggregation; empty if none", () => {
  const index = core.spatialIndex(TREE);
  assert.deepEqual(index.storeyIds, [10, 11]);
  assert.equal(index.storeyOf.get(100), 10);
  assert.equal(index.storeyOf.get(102), 10); // stair flight aggregated in a stair on storey 10
  assert.equal(index.storeyOf.get(110), 11);
  assert.equal(index.storeyOf.has(200), false);
  assert.equal(index.storeyOf.has(10), false);
  const names = core.storeyNames(index, [
    item("IFCBUILDINGSTOREY", { _localId: 10, Name: "Erdgeschoss" }),
    item("IFCBUILDINGSTOREY", { _localId: 11, Name: "" }),
  ]);
  assert.equal(names.get(100), "Erdgeschoss");
  assert.equal(names.has(110), false); // storey without a name: empty
  assert.deepEqual(core.spatialIndex(null), { storeyOf: new Map(), storeyIds: [] });
});

test("[unit] REQ-002-AC4 Material: every layer material once, sorted; lists, constituents, profiles", () => {
  const plaster = material("Plasterboard");
  const layerSetUsage = item(
    "IFCMATERIALLAYERSETUSAGE",
    {},
    {
      ForLayerSet: [
        item(
          "IFCMATERIALLAYERSET",
          {},
          {
            MaterialLayers: [
              item("IFCMATERIALLAYER", {}, { Material: [plaster] }),
              item("IFCMATERIALLAYER", {}, { Material: [material("Metal - Stud Layer")] }),
              item("IFCMATERIALLAYER", {}, { Material: [plaster] }),
            ],
          },
        ),
      ],
    },
  );
  assert.deepEqual(core.materialNames([layerSetUsage]), ["Metal - Stud Layer", "Plasterboard"]);
  assert.deepEqual(
    core.materialNames([item("IFCMATERIALLIST", {}, { Materials: [material("Holz"), material("Glas")] })]),
    ["Glas", "Holz"],
  );
  const constituents = item(
    "IFCMATERIALCONSTITUENTSET",
    {},
    {
      MaterialConstituents: [item("IFCMATERIALCONSTITUENT", {}, { Material: [material("Beton")] })],
    },
  );
  const profiles = item(
    "IFCMATERIALPROFILESETUSAGE",
    {},
    {
      ForProfileSet: [
        item(
          "IFCMATERIALPROFILESET",
          {},
          {
            MaterialProfiles: [item("IFCMATERIALPROFILE", {}, { Material: [material("Stahl")] })],
          },
        ),
      ],
    },
  );
  assert.deepEqual(core.materialNames([constituents, profiles, item("IFCCLASSIFICATIONREFERENCE", { Name: "x" })]), [
    "Beton",
    "Stahl",
  ]);
  assert.deepEqual(core.materialNames([material(""), material(null)]), []);
  assert.deepEqual(core.materialNames(undefined), []);
});

// ---------------------------------------------------------------------------------------------------------------
// Values and rows
// ---------------------------------------------------------------------------------------------------------------
test("[unit] REQ-002-AC5 an IfcLabel '1.5' stays text; numbers are numbers; booleans Ja/Nein (DEC-5)", () => {
  assert.deepEqual(core.normaliseValue(a("1.5", "IFCLABEL"), {}), { value: "1.5", kind: "text", unit: null });
  assert.deepEqual(core.normaliseValue(a(1.5, "IFCREAL"), {}), { value: 1.5, kind: "number", unit: null });
  assert.deepEqual(core.normaliseValue(a(true, "IFCBOOLEAN"), {}), { value: "Ja", kind: "bool", unit: null });
  assert.deepEqual(core.normaliseValue(a(false, "IFCBOOLEAN"), {}), { value: "Nein", kind: "bool", unit: null });
  assert.deepEqual(core.normaliseValue(a(".T.", "IFCLOGICAL"), {}), { value: "Ja", kind: "bool", unit: null });
  assert.deepEqual(core.normaliseValue(a("F", "IFCBOOLEAN"), {}), { value: "Nein", kind: "bool", unit: null });
  assert.deepEqual(core.normaliseValue(a("UNKNOWN", "IFCLOGICAL"), {}), { value: "UNKNOWN", kind: "text", unit: null });
  assert.equal(core.normaliseValue(a("", "IFCLABEL"), {}), null);
  assert.equal(core.normaliseValue(a(null, "IFCLABEL"), {}), null);
  assert.equal(core.normaliseValue(a(NaN, "IFCREAL"), {}), null);
  assert.equal(core.normaliseValue(undefined, {}), null);
  assert.equal(core.normaliseValue([], {}), null);
});

const FZK_UNITS = core.parseUnits([
  item(
    "IFCUNITASSIGNMENT",
    {},
    {
      Units: [siUnit("LENGTHUNIT", "METRE", "MILLI"), siUnit("MASSUNIT", "GRAM", "KILO")],
    },
  ),
]);

function wallWithType() {
  const type = item(
    "IFCWALLTYPE",
    { _localId: 50, Name: "Leichtbeton 300" },
    {
      HasPropertySets: [
        pset("Pset_WallCommon", [
          prop("IsExternal", false, "IFCBOOLEAN"),
          prop("FireRating", "F90", "IFCLABEL"),
          prop("Reference", "type ref", "IFCIDENTIFIER"),
        ]),
        item("IFCDOORLININGPROPERTIES", {}), // not a property set: ignored
      ],
      HasAssociations: [material("Typmaterial")],
    },
  );
  return element(
    1,
    "IFCWALLSTANDARDCASE",
    { Name: a("Wand-1", "IFCLABEL"), Tag: a("T1", "IFCIDENTIFIER") },
    {
      IsDefinedBy: [
        type,
        pset("Pset_WallCommon", [prop("IsExternal", true, "IFCBOOLEAN"), prop("Reference", "", "IFCIDENTIFIER")]),
        pset("ArchiCADProperties", [prop("Raumnummer", "6", "IFCLABEL")]),
        qto("BaseQuantities", [qLength("Length", 9700), qArea("GrossSideArea", 25.59), qVolume("NetVolume", 5.80797)]),
      ],
      HasAssociations: [item("IFCMATERIALLIST", {}, { Materials: [material("Holz")] })],
    },
  );
}

test("[unit] REQ-002-AC3 occurrence value wins over the type value; the type value fills gaps (DEC-1)", () => {
  const extractor = core.createExtractor({
    modelId: "m1",
    modelName: "Haus",
    units: FZK_UNITS,
    storeyOf: new Map([[1, "Erdgeschoss"]]),
    withGeometry: new Set([1]),
    className: (c) => ({ IFCWALLSTANDARDCASE: "IfcWallStandardCase" })[c] || c,
  });
  const row = extractor.add(wallWithType());
  assert.equal(row.values["Pset_WallCommon.IsExternal"], "Ja"); // occurrence true over type false
  assert.equal(row.values["Pset_WallCommon.FireRating"], "F90"); // type only
  assert.equal(row.values["Pset_WallCommon.Reference"], "type ref"); // empty occurrence value: type fills the gap
  const { properties } = extractor.result();
  assert.deepEqual(
    [properties.get("Pset_WallCommon.IsExternal").occurrence, properties.get("Pset_WallCommon.IsExternal").type],
    [true, true],
  );
  assert.deepEqual(
    [properties.get("Pset_WallCommon.FireRating").occurrence, properties.get("Pset_WallCommon.FireRating").type],
    [false, true],
  );
});

test("[unit] REQ-002 createExtractor: row key, attributes, Typ, Geschoss, Material, Geometrie, units", () => {
  const extractor = core.createExtractor({
    modelId: "m1",
    modelName: "Haus",
    units: FZK_UNITS,
    storeyOf: new Map([[1, "Erdgeschoss"]]),
    withGeometry: new Set([1]),
    className: (c) => ({ IFCWALLSTANDARDCASE: "IfcWallStandardCase", IFCMEMBER: "IfcMember" })[c] || c,
  });
  const row = extractor.add(wallWithType());
  assert.equal(row.key, "m1:1");
  assert.equal(row.model, "m1");
  assert.equal(row.localId, 1);
  assert.equal(row.guid, "guid-1");
  assert.equal(row.geometry, true);
  const v = row.values;
  assert.equal(v.Modell, "Haus");
  assert.equal(v.Kategorie, "IfcWallStandardCase");
  assert.equal(v.Name, "Wand-1");
  assert.equal(v.GlobalId, "guid-1");
  assert.equal(v.Tag, "T1");
  assert.equal(v.Typ, "Leichtbeton 300");
  assert.equal(v.Geschoss, "Erdgeschoss");
  assert.deepEqual(v.Material, ["Holz"]); // occurrence material wins over the type's
  assert.equal(v.Geometrie, "Ja");
  assert.equal(v["BaseQuantities.Length"], 9.7); // mm -> m
  assert.equal(v["BaseQuantities.GrossSideArea"], 25.59);
  assert.equal(v["ArchiCADProperties.Raumnummer"], "6");
  assert.equal("ObjectType" in v, false);

  // element without type, material, storey, geometry: Typ/Material/Geschoss empty, Geometrie Nein
  const member = extractor.add(element(2, "IFCMEMBER", { Name: "Sparren-1" }));
  assert.deepEqual(
    [member.values.Typ, member.values.Material, member.values.Geschoss, member.values.Geometrie, member.geometry],
    [undefined, undefined, undefined, "Nein", false],
  );
  // material from the type when the occurrence has none
  const typed = element(
    3,
    "IFCWINDOW",
    {},
    {
      IsDefinedBy: [item("IFCWINDOWSTYLE", { Name: "Fenster" }, { HasAssociations: [material("Glas")] })],
    },
  );
  const windowRow = extractor.add(typed);
  assert.deepEqual(windowRow.values.Material, ["Glas"]);
  assert.equal(windowRow.values.Kategorie, "IFCWINDOW"); // no schema spelling known: upper-case name
  assert.equal(extractor.result().rows.length, 3);
  // without optional context
  const bare = core.createExtractor({ modelId: "m2", modelName: "B" }).add(element(4, "IFCWALL"));
  assert.deepEqual([bare.values.Kategorie, bare.values.Geometrie], ["IFCWALL", "Nein"]);
  assert.equal(
    core.createExtractor({ modelId: "m3", modelName: "C" }).add(item("IFCWALL", { _localId: 5 })).guid,
    null,
  );
});

test("[unit] REQ-001-AC4 visibleRows hides IfcSpace unless the option is on (DEC-13)", () => {
  const rows = [{ values: { Kategorie: "IfcSpace" } }, { values: { Kategorie: "IfcWall" } }];
  assert.deepEqual(core.visibleRows(rows, false), [rows[1]]);
  assert.equal(core.visibleRows(rows, true), rows);
});

// ---------------------------------------------------------------------------------------------------------------
// Property catalogue (spec 4.3)
// ---------------------------------------------------------------------------------------------------------------
function extractModel(modelId, modelName, massUnit, elements) {
  const units = core.parseUnits([item("IFCUNITASSIGNMENT", {}, { Units: [massUnit, siUnit("LENGTHUNIT", "METRE")] })]);
  const extractor = core.createExtractor({ modelId, modelName, units });
  for (const e of elements) extractor.add(e);
  return { id: modelId, ...extractor.result() };
}

const massElement = (id, value, extra = []) =>
  element(
    id,
    "IFCWALL",
    {},
    {
      IsDefinedBy: [
        pset("CalcTest_Units", [prop("Masse", value, "IFCMASSMEASURE"), ...extra]),
        qto("BaseQuantities", [qLength("Length", 2)]),
      ],
    },
  );

test("[unit] spec 4.3 buildCatalog: Allgemein first, labels, groups, kinds, units, counts, headers", () => {
  const typeOnly = element(
    3,
    "IFCWALL",
    {},
    {
      IsDefinedBy: [
        item("IFCWALLTYPE", { Name: "T" }, { HasPropertySets: [pset("Pset_Type", [prop("Code", "X", "IFCLABEL")])] }),
      ],
      HasAssociations: [item("IFCMATERIALLIST", {}, { Materials: [material("A"), material("B")] })],
    },
  );
  const model = extractModel("m1", "A", siUnit("MASSUNIT", "GRAM", "KILO"), [
    massElement(1, 10, [prop("Flag", true, "IFCBOOLEAN"), prop("Mixed", 1, "IFCREAL")]),
    massElement(2, 20, [prop("Mixed", "x", "IFCLABEL")]),
    typeOnly,
  ]);
  const catalog = core.buildCatalog(model.rows, [model]);
  const keys = [...catalog.keys()];
  assert.deepEqual(
    keys.slice(0, 12),
    core.SPECIAL_PROPERTIES.map(([k]) => k),
  );
  assert.deepEqual(keys.slice(12), [
    "BaseQuantities.Length",
    "CalcTest_Units.Flag",
    "CalcTest_Units.Masse",
    "CalcTest_Units.Mixed",
    "Pset_Type.Code",
  ]);
  assert.deepEqual(catalog.get("Kategorie"), {
    key: "Kategorie",
    label: "Kategorie",
    group: "Allgemein",
    kind: "text",
    unit: null,
    count: 3,
    header: "Kategorie",
  });
  assert.equal(catalog.get("Material").kind, "multi");
  assert.equal(catalog.get("Material").count, 1);
  assert.equal(catalog.get("Geometrie").kind, "bool");
  assert.equal(catalog.get("Name").count, 0);
  assert.deepEqual(catalog.get("CalcTest_Units.Masse"), {
    key: "CalcTest_Units.Masse",
    label: "CalcTest_Units.Masse",
    group: "CalcTest_Units",
    kind: "number",
    unit: "kg",
    count: 2,
    header: "CalcTest_Units.Masse (kg)",
  });
  assert.equal(catalog.get("BaseQuantities.Length").header, "BaseQuantities.Length (m)");
  assert.equal(catalog.get("CalcTest_Units.Flag").kind, "bool");
  assert.equal(catalog.get("CalcTest_Units.Mixed").kind, "text"); // number in one row, text in another
  assert.equal(catalog.get("CalcTest_Units.Mixed").unit, null);
  assert.equal(catalog.get("Pset_Type.Code").group, "Typ: Pset_Type"); // type-only pset
});

test("[unit] REQ-002-AC6 the same numeric property with different units in two models is `gemischt`", () => {
  const a1 = extractModel("m1", "a", siUnit("MASSUNIT", "GRAM", "KILO"), [massElement(1, 7857)]);
  const b1 = extractModel(
    "m2",
    "b",
    conversionUnit("MASSUNIT", "POUND", 0.45359237, siUnit("MASSUNIT", "GRAM", "KILO")),
    [massElement(1, 7857)],
  );
  const both = core.buildCatalog([...a1.rows, ...b1.rows], [a1, b1]);
  assert.equal(both.get("CalcTest_Units.Masse").unit, "gemischt");
  assert.equal(both.get("CalcTest_Units.Masse").header, "CalcTest_Units.Masse (gemischt)");
  assert.equal(both.get("CalcTest_Units.Masse").count, 2);
  assert.equal(both.get("BaseQuantities.Length").unit, "m"); // converted lengths agree
  // only the rows of loaded models count: model b removed -> kg again
  assert.equal(core.buildCatalog(a1.rows, [a1, b1]).get("CalcTest_Units.Masse").unit, "kg");
  assert.equal(core.buildCatalog(b1.rows, [a1, b1]).get("CalcTest_Units.Masse").header, "CalcTest_Units.Masse (lb)");
  // a property without rows is not listed; a model whose unit is unknown counts as its own unit
  const none = extractModel("m3", "c", item("IFCDERIVEDUNIT", { UnitType: "LUMINOUSFLUXUNIT" }), [massElement(1, 1)]);
  assert.equal(core.buildCatalog([...a1.rows, ...none.rows], [a1, none]).get("CalcTest_Units.Masse").unit, "gemischt");
  assert.equal(core.buildCatalog([], [a1]).has("CalcTest_Units.Masse"), false);
});

test("[unit] spec 4.3 headerLabel shows units of numeric properties only", () => {
  assert.equal(core.headerLabel({ label: "A.L", kind: "number", unit: "m" }), "A.L (m)");
  assert.equal(core.headerLabel({ label: "A.N", kind: "number", unit: null }), "A.N");
  assert.equal(core.headerLabel({ label: "A.T", kind: "text", unit: "m" }), "A.T");
});
