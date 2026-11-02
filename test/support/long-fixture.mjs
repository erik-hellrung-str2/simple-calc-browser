// Crafted fixture for the "very long values" robustness tests (spec Testing T7; TASK-006a table, TASK-004 F1 filter
// panel): a copy of AC20-FZK-Haus.ifc whose wall `Wand-Ext-ERDG-1` gets a ~3,200-character Name and whose only
// IfcIdentifier `Reference` (in Pset_BeamCommon) gets a 4,000-character text. Built in memory from the committed FZK
// file (deterministic, no extra committed binary).
import { readFileSync } from "node:fs";
import { fixture } from "./builder.mjs";

export const LONG_NAME = "Wand mit sehr langem Namen " + "Abschnitt-0123456789 ".repeat(150);
export const LONG_PSET_KEY = "Pset_BeamCommon.Reference";
export const LONG_PSET_VALUE = "Langer Text " + "x".repeat(4000);
export const LONG_WALL = "3rPX_Juz59peXXY6wDJl18";

/** { name, mimeType, buffer } for Playwright setInputFiles. */
export function longFixture() {
  let text = readFileSync(fixture("AC20-FZK-Haus.ifc"), "latin1");
  const re = new RegExp(`(IFCWALLSTANDARDCASE\\('${LONG_WALL}',#\\d+,)'[^']*'`);
  if (!re.test(text)) throw new Error("wall not found");
  text = text.replace(re, (_, head) => `${head}'${LONG_NAME}'`);
  const ref = /IFCPROPERTYSINGLEVALUE\('Reference',\$,IFCIDENTIFIER\('[^']*'\),\$\)/;
  if (!ref.test(text)) throw new Error("Reference property not found");
  text = text.replace(ref, `IFCPROPERTYSINGLEVALUE('Reference',$,IFCIDENTIFIER('${LONG_PSET_VALUE}'),$)`);
  return { name: "fzk-lang.ifc", mimeType: "application/octet-stream", buffer: Buffer.from(text, "latin1") };
}
