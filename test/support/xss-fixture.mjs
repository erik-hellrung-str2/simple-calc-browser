// Crafted fixture for the "model strings are rendered as text" robustness tests (spec Testing T7, T10): a copy of
// AC20-FZK-Haus.ifc whose wall names and one pset name are HTML/script strings. Built in memory from the committed
// FZK file (deterministic, no extra committed binary); STEP strings only need `'` doubled, which these avoid.
import { readFileSync } from "node:fs";
import { fixture } from "./builder.mjs";

export const XSS_NAMES = {
  "2XPyKWY018sA1ygZKgQPtU": '<img src=x onerror="window.__xss=1">',
  "3PfS__Y_DBAfq5naM6zD2Z": "<script>window.__xss=2</script>",
  "2ptk1k7qn8_Qk22vjh$0DE": 'Wand & <b>fett</b> &amp; "Zitat"',
};
export const XSS_PSET = "<b onmouseover=window.__xss=3>Pset_WallCommon</b>";
export const XSS_FILE_NAME = "fzk-<img src=x onerror=alert(4)>.ifc"; // no "/" in a file name

/** { name, mimeType, buffer } for Playwright setInputFiles. */
export function xssFixture() {
  let text = readFileSync(fixture("AC20-FZK-Haus.ifc"), "latin1");
  for (const [guid, name] of Object.entries(XSS_NAMES)) {
    const re = new RegExp(`(IFCWALLSTANDARDCASE\\('${guid.replace(/\$/g, "\\$")}',#\\d+,)'[^']*'`);
    if (!re.test(text)) throw new Error(`wall ${guid} not found in AC20-FZK-Haus.ifc`);
    text = text.replace(re, (_, head) => `${head}'${name}'`);
  }
  const before = text;
  text = text.replaceAll("'Pset_WallCommon'", `'${XSS_PSET}'`);
  if (text === before) throw new Error("Pset_WallCommon not found in AC20-FZK-Haus.ifc");
  return { name: XSS_FILE_NAME, mimeType: "application/octet-stream", buffer: Buffer.from(text, "latin1") };
}
