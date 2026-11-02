// Extracts <script type="text/plain" id="cv-core-src"> from calc-viewer-builder.html into .cache/cv-core-<hash>.mjs,
// padded with blank lines so that coverage and stack-trace line numbers equal the HTML file's line numbers,
// then imports it. cv-core is pure (no DOM, no imports), so it runs unchanged in Node (spec §4.2, Testing T1).
//
// Parallel test runs (TASK-004): the file name carries the sha256 of the extracted text, and the text is written to a
// per-process temporary file first and then renamed into place (atomic on one file system). A run therefore never
// imports a half-written file or a file another run wrote from a different HTML version. Equal text gives the same
// name, so c8 merges the coverage of all test processes into one cv-core entry (a per-process name would split it).
// Temporary files are removed on exit; extracted files of other versions older than one hour are pruned.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

export const BUILDER_HTML = fileURLToPath(new URL("../calc-viewer-builder.html", import.meta.url));
const OUT_DIR = fileURLToPath(new URL("../.cache/", import.meta.url));
const PRUNE_AFTER_MS = 60 * 60 * 1000;

/** Returns the text of the <script> element with the given id, prefixed by one "\n" per line before it. */
export function extractScript(html, id) {
  const re = new RegExp(`<script\\b[^>]*\\bid="${id}"[^>]*>([\\s\\S]*?)</script>`);
  const m = re.exec(html);
  if (!m) throw new Error(`no <script id="${id}"> found`);
  const start = m.index + m[0].indexOf(">") + 1;
  const linesBefore = html.slice(0, start).split("\n").length - 1;
  return "\n".repeat(linesBefore) + m[1];
}

/** Path of the extracted cv-core file for the given builder HTML text (content-addressed). */
export function corePath(html = readFileSync(BUILDER_HTML, "utf8")) {
  const text = extractScript(html, "cv-core-src");
  const hash = createHash("sha256").update(text).digest("hex").slice(0, 16);
  return { path: `${OUT_DIR}cv-core-${hash}.mjs`, text };
}

function prune(keep) {
  let names = [];
  try {
    names = readdirSync(OUT_DIR);
  } catch {
    return;
  }
  const now = Date.now();
  for (const name of names) {
    if (!/^cv-core(-[0-9a-f]{16})?\.mjs$/.test(name) || OUT_DIR + name === keep) continue;
    try {
      if (now - statSync(OUT_DIR + name).mtimeMs > PRUNE_AFTER_MS) rmSync(OUT_DIR + name, { force: true });
    } catch {
      // another run removed it meanwhile
    }
  }
}

export async function loadCore(htmlPath = BUILDER_HTML) {
  mkdirSync(OUT_DIR, { recursive: true });
  const { path, text } = corePath(readFileSync(htmlPath, "utf8"));
  const tmp = `${OUT_DIR}.cv-core-${process.pid}-${Math.random().toString(36).slice(2)}.tmp`;
  const cleanup = () => rmSync(tmp, { force: true });
  process.once("exit", cleanup);
  try {
    writeFileSync(tmp, text);
    renameSync(tmp, path);
  } finally {
    cleanup();
  }
  prune(path);
  return import(pathToFileURL(path).href);
}
