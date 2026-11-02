// Crafted fixture for the grouping robustness test (spec Testing T7, TASK-006b): a copy of AC20-FZK-Haus.ifc plus
// GROUP_COUNT IfcBuildingElementProxy elements without geometry on the ground floor, each with its own value of
// CalcTest_Group.Nummer (IfcLabel, "G-00001" ...) and a number CalcTest_Group.Menge (IfcReal). Grouping by
// CalcTest_Group.Nummer gives GROUP_COUNT groups plus "(leer)" for the FZK elements. Built in memory (deterministic,
// no extra committed binary); expected values are read back from the text by the reference STEP parser.
import { readFileSync } from "node:fs";
import { ifcGuidFromSeed } from "../../scripts/lib/ifc-synth.mjs";
import { loadIfc } from "../../scripts/ref/ifc-model.mjs";
import { fixture } from "./builder.mjs";

export const GROUP_COUNT = 5000;
export const GROUP_KEY = "CalcTest_Group.Nummer";
export const AMOUNT_KEY = "CalcTest_Group.Menge";
export const FILE_NAME = "fzk-5000-gruppen.ifc";

/** The STEP text of the fixture. */
export function manyGroupsText() {
  const text = readFileSync(fixture("AC20-FZK-Haus.ifc"), "latin1");
  const ids = [...text.matchAll(/^#(\d+)=/gm)].map((m) => Number(m[1]));
  let next = Math.max(...ids) + 1;
  const storey = /^#(\d+)= IFCBUILDINGSTOREY\('[^']*',#\d+,'Erdgeschoss'/m.exec(text)[1];
  const owner = /^#(\d+)= IFCOWNERHISTORY\(/m.exec(text)[1];
  const lines = [];
  const proxies = [];
  for (let i = 1; i <= GROUP_COUNT; i++) {
    const n = String(i).padStart(5, "0");
    const proxy = next++;
    const label = next++;
    const amount = next++;
    const pset = next++;
    const rel = next++;
    lines.push(
      `#${proxy}= IFCBUILDINGELEMENTPROXY('${ifcGuidFromSeed("proxy" + i)}',#${owner},'Proxy ${n}',$,$,$,$,$,$);`,
      `#${label}= IFCPROPERTYSINGLEVALUE('Nummer',$,IFCLABEL('G-${n}'),$);`,
      `#${amount}= IFCPROPERTYSINGLEVALUE('Menge',$,IFCREAL(${i}.),$);`,
      `#${pset}= IFCPROPERTYSET('${ifcGuidFromSeed("pset" + i)}',#${owner},'CalcTest_Group',$,(#${label},#${amount}));`,
      `#${rel}= IFCRELDEFINESBYPROPERTIES('${ifcGuidFromSeed("rel" + i)}',#${owner},$,$,(#${proxy}),#${pset});`,
    );
    proxies.push(proxy);
  }
  lines.push(
    `#${next}= IFCRELCONTAINEDINSPATIALSTRUCTURE('${ifcGuidFromSeed("contained")}',#${owner},$,$,(${proxies
      .map((p) => "#" + p)
      .join(",")}),#${storey});`,
  );
  const end = text.lastIndexOf("ENDSEC;");
  return text.slice(0, end) + lines.join("\n") + "\n" + text.slice(end);
}

/** { name, mimeType, buffer } for Playwright setInputFiles, and the text. */
export function manyGroupsFixture() {
  const text = manyGroupsText();
  return { name: FILE_NAME, mimeType: "application/octet-stream", buffer: Buffer.from(text, "latin1"), text };
}

/**
 * Expected grouping by GROUP_KEY from the reference STEP parser (not the product): { groups: { value -> { count,
 * amount } }, empty: { byKategorie } (elements without the property), amountTotal }.
 */
export function manyGroupsExpected(text) {
  const m = loadIfc(text);
  const groups = {};
  const empty = {};
  let amountTotal = 0;
  for (const id of m.elements) {
    const e = m.element(id);
    const value = e.props[GROUP_KEY]?.value;
    const amount = e.props[AMOUNT_KEY]?.value;
    if (typeof amount === "number") amountTotal += amount;
    if (value === undefined) empty[e.Kategorie] = (empty[e.Kategorie] ?? 0) + 1;
    else {
      groups[value] ??= { count: 0, amount: 0 };
      groups[value].count++;
      groups[value].amount += amount;
    }
  }
  return { groups, empty, amountTotal };
}
