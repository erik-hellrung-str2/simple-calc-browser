// Extracts <script type="text/plain" id="cv-core-src"> from calc-viewer-builder.html into .cache/cv-core.mjs,
// padded with blank lines so that coverage and stack-trace line numbers equal the HTML file's line numbers,
// then imports it. cv-core is pure (no DOM, no imports), so it runs unchanged in Node (spec §4.2, Testing T1).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

export const BUILDER_HTML = fileURLToPath(new URL("../calc-viewer-builder.html", import.meta.url));
const OUT_DIR = fileURLToPath(new URL("../.cache/", import.meta.url));

/** Returns the text of the <script> element with the given id, prefixed by one "\n" per line before it. */
export function extractScript(html, id) {
  const re = new RegExp(`<script\\b[^>]*\\bid="${id}"[^>]*>([\\s\\S]*?)</script>`);
  const m = re.exec(html);
  if (!m) throw new Error(`no <script id="${id}"> found`);
  const start = m.index + m[0].indexOf(">") + 1;
  const linesBefore = html.slice(0, start).split("\n").length - 1;
  return "\n".repeat(linesBefore) + m[1];
}

export async function loadCore(htmlPath = BUILDER_HTML) {
  mkdirSync(OUT_DIR, { recursive: true });
  const out = OUT_DIR + "cv-core.mjs";
  writeFileSync(out, extractScript(readFileSync(htmlPath, "utf8"), "cv-core-src"));
  return import(pathToFileURL(out).href);
}
