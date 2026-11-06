// Crafted fixture for the "arrow keys on a flat or single-element extent" robustness test (spec Testing T7, CR-002;
// TASK-014 section handle keys): a minimal IFC4 file with exactly one element with geometry, an IfcSlab extruded
// FLAT_THICKNESS along Z from a FLAT_SIZE_X x FLAT_SIZE_Y rectangle, on one storey at elevation 0. Its extent along a
// vertical normal is FLAT_THICKNESS, so 1 % of it (0.5 mm) and 10 % of it (5 mm) bracket the 1 mm minimum step
// (REQ-013). Built in memory (deterministic, no extra committed binary); all lengths in metres.
export const FLAT_THICKNESS = 0.05; // m
export const FLAT_SIZE_X = 4; // m
export const FLAT_SIZE_Y = 3; // m
export const FLAT_GUID = "1FlatSlabTestFixture01";
export const FLAT_FILE_NAME = "flache-platte.ifc";

/** The STEP text of the fixture. */
export function flatText() {
  return [
    "ISO-10303-21;",
    "HEADER;",
    "FILE_DESCRIPTION(('ViewDefinition [ReferenceView]'),'2;1');",
    `FILE_NAME('${FLAT_FILE_NAME}','2026-11-05T00:00:00',(''),(''),'calc-viewer-builder test fixture','','');`,
    "FILE_SCHEMA(('IFC4'));",
    "ENDSEC;",
    "DATA;",
    "#1=IFCPERSON($,'Test',$,$,$,$,$,$);",
    "#2=IFCORGANIZATION($,'Test',$,$,$);",
    "#3=IFCPERSONANDORGANIZATION(#1,#2,$);",
    "#4=IFCAPPLICATION(#2,'1','calc-viewer-builder test fixture','cvb');",
    "#5=IFCOWNERHISTORY(#3,#4,$,.ADDED.,$,$,$,1793836800);",
    "#10=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);",
    "#11=IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.);",
    "#12=IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.);",
    "#13=IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.);",
    "#14=IFCUNITASSIGNMENT((#10,#11,#12,#13));",
    "#20=IFCCARTESIANPOINT((0.,0.,0.));",
    "#21=IFCDIRECTION((0.,0.,1.));",
    "#22=IFCDIRECTION((1.,0.,0.));",
    "#23=IFCAXIS2PLACEMENT3D(#20,#21,#22);",
    "#24=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,#23,$);",
    "#25=IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,#24,$,.MODEL_VIEW.,$);",
    "#30=IFCPROJECT('1FlatProjectTestFixt01',#5,'Flache Platte',$,$,$,$,(#24),#14);",
    "#31=IFCLOCALPLACEMENT($,#23);",
    "#32=IFCSITE('1FlatSiteTestFixture01',#5,'Gelaende',$,$,#31,$,$,.ELEMENT.,$,$,$,$,$);",
    "#33=IFCLOCALPLACEMENT(#31,#23);",
    "#34=IFCBUILDING('1FlatBuildingTestFix01',#5,'Gebaeude',$,$,#33,$,$,.ELEMENT.,$,$,$);",
    "#35=IFCLOCALPLACEMENT(#33,#23);",
    "#36=IFCBUILDINGSTOREY('1FlatStoreyTestFixtu01',#5,'Erdgeschoss',$,$,#35,$,$,.ELEMENT.,0.);",
    "#37=IFCRELAGGREGATES('1FlatRelAggProject0001',#5,$,$,#30,(#32));",
    "#38=IFCRELAGGREGATES('1FlatRelAggSite0000001',#5,$,$,#32,(#34));",
    "#39=IFCRELAGGREGATES('1FlatRelAggBuilding001',#5,$,$,#34,(#36));",
    "#40=IFCCARTESIANPOINT((0.,0.));",
    "#41=IFCAXIS2PLACEMENT2D(#40,$);",
    `#42=IFCRECTANGLEPROFILEDEF(.AREA.,$,#41,${FLAT_SIZE_X.toFixed(1)},${FLAT_SIZE_Y.toFixed(1)});`,
    `#43=IFCEXTRUDEDAREASOLID(#42,#23,#21,${FLAT_THICKNESS});`,
    "#44=IFCSHAPEREPRESENTATION(#25,'Body','SweptSolid',(#43));",
    "#45=IFCPRODUCTDEFINITIONSHAPE($,$,(#44));",
    "#46=IFCLOCALPLACEMENT(#35,#23);",
    `#47=IFCSLAB('${FLAT_GUID}',#5,'Flache Platte',$,$,#46,#45,$,.FLOOR.);`,
    "#48=IFCRELCONTAINEDINSPATIALSTRUCTURE('1FlatRelContained00001',#5,$,$,(#47),#36);",
    "ENDSEC;",
    "END-ISO-10303-21;",
    "",
  ].join("\n");
}

/** { name, mimeType, buffer } for Playwright setInputFiles. */
export function flatFixture() {
  return { name: FLAT_FILE_NAME, mimeType: "application/octet-stream", buffer: Buffer.from(flatText(), "latin1") };
}
