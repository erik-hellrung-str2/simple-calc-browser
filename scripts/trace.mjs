// Traceability table (TASK-010; process/kernel.md §5 verification "traceability updated", spec Testing T5 "every
// REQ-...-AC and NFR has >= 1 test tagged with its ID"): generated from the test titles, so it stays current.
//
//   node scripts/trace.mjs           writes docs/testing/traceability.md
//   node scripts/trace.mjs --check   exits 1 if docs/testing/traceability.md is not what the tests give now
//
// Sources: the acceptance criteria (REQ-###-AC#) and NFR-### defined in docs/spec.md (lines "- REQ-...-AC#:" and
// headings "### NFR-###"), and the titles of every test in test/ (Playwright `test("...")` in *.spec.mjs, node:test
// `test("...")` in *.test.mjs). A test verifies an ID when its title names it: as a tag (`@REQ-004-AC2`) or in the text
// (`REQ-004-AC2`, also with underscores, kernel §2 IDs). A requirement-level tag (`@REQ-004`) is listed separately and
// does not count as covering an AC. Test types (spec Testing T1-T14) come from the title tags (`[unit]`, `[perf]`,
// `@integration`, `@system`, `@e2e`, `@acceptance`, `@perf`, `@robustness`, `@smoke`, `@T10`).
// Deterministic output (sorted, no dates): equal tests give an equal file.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(ROOT, "docs/testing/traceability.md");

/** Test files under dir (recursive), repo-relative, sorted. */
function testFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...testFiles(path));
    else if (/\.(spec|test)\.mjs$/.test(entry.name)) out.push(relative(ROOT, path));
  }
  return out.sort();
}

/** Titles of the test(...) calls of one file (string or template literal as first argument). */
export function testTitles(text) {
  const titles = [];
  const re = /\btest\(\s*(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g;
  for (const m of text.matchAll(re)) titles.push(m[2].replace(/\s+/g, " ").trim());
  return titles;
}

/** IDs named in a title: { acs: Set, nfrs: Set, reqs: Set (requirement-level tags), types: Set }. */
export function idsOf(title) {
  const norm = title.replace(/(REQ|NFR)_(\d{3})(?:_(AC\d+))?/g, (m, p, n, ac) => `${p}-${n}${ac ? "-" + ac : ""}`);
  const acs = new Set(norm.match(/REQ-\d{3}-AC\d+/g) || []);
  const nfrs = new Set(norm.match(/NFR-\d{3}/g) || []);
  const reqs = new Set((norm.match(/@REQ-\d{3}(?![-\d])/g) || []).map((t) => t.slice(1)));
  const types = new Set();
  if (/^\[unit\]/.test(title)) types.add("T1");
  if (/^\[perf\]/.test(title)) types.add("T6");
  const tags = { integration: "T2", system: "T3", e2e: "T4", acceptance: "T5", perf: "T6", robustness: "T7" };
  for (const [tag, type] of Object.entries(tags)) if (new RegExp(`@${tag}\\b`).test(title)) types.add(type);
  if (/@smoke\b/.test(title)) types.add("T9");
  if (/@T10\b/.test(title)) types.add("T10");
  return { acs, nfrs, reqs, types };
}

/** IDs defined by the spec: { acs: [id, text], nfrs: [id, title], reqs: [id, title] } in spec order. */
export function specIds(spec) {
  const acs = [...spec.matchAll(/^- (REQ-\d{3}-AC\d+): (.*)$/gm)].map((m) => [m[1], m[2]]);
  const nfrs = [...spec.matchAll(/^### (NFR-\d{3}): (.*)$/gm)].map((m) => [m[1], m[2]]);
  const reqs = [...spec.matchAll(/^### (REQ-\d{3}): (.*)$/gm)].map((m) => [m[1], m[2]]);
  return { acs, nfrs, reqs };
}

const TYPES = [
  ["T1", "Unit", "`[unit]` node:test"],
  ["T2", "Integration", "`@integration`"],
  ["T3", "System", "`@system`"],
  ["T4", "End-to-end", "`@e2e`"],
  ["T5", "Acceptance", "`@acceptance`"],
  ["T6", "Performance", "`@perf`, `[perf]`"],
  ["T7", "Robustness", "`@robustness`"],
  ["T8", "Regression", "all automated suites: `node scripts/check.mjs --all`"],
  ["T9", "Smoke", "`@smoke`"],
  ["T10", "Security", "`@T10` (plus REQ-008-AC4 and NFR-005)"],
  ["T11", "Usability", "manual: heuristic review"],
  ["T12", "Compatibility", "Chromium automated (every Playwright test); Chrome/Edge/Firefox manual"],
  ["T13", "Migration", "none (spec: no data migration; config versioning in T7)"],
  ["T14", "Exploratory", "manual: 2 charters"],
];

const cell = (s) => s.replace(/\|/g, "\\|");

/** The traceability Markdown for the current spec and tests. */
export function buildTraceability(root = ROOT) {
  const spec = readFileSync(join(root, "docs/spec.md"), "utf8");
  const ids = specIds(spec);
  const tests = [];
  for (const file of testFiles(join(root, "test"))) {
    for (const title of testTitles(readFileSync(join(root, file), "utf8")))
      tests.push({ file, title, ...idsOf(title) });
  }
  const ref = (t) => `\`${t.file}\`: ${cell(t.title)}`;
  const lines = [];
  lines.push("---");
  lines.push("status: draft");
  lines.push(
    "relates_to: [" +
      [...ids.acs.map(([id]) => id), ...ids.nfrs.map(([id]) => id)].join(", ") +
      ", T1, T2, T3, T4, T5, T6, T7, T9, T10]",
  );
  lines.push("---");
  lines.push("# Traceability: acceptance criteria and NFRs to tests");
  lines.push("");
  lines.push(
    "Generated by `node scripts/trace.mjs` from the test titles in `test/` and the IDs defined in `docs/spec.md` " +
      "(do not edit by hand; `node scripts/trace.mjs --check` fails when it is stale). A test verifies an ID when its " +
      "title names it (`@REQ-004-AC2`, `REQ-004-AC2` or `REQ_004_AC2`). Requirement-level tags (`@REQ-004`) are listed " +
      "under each requirement but do not count as covering an acceptance criterion.",
  );
  lines.push("");

  const acGaps = ids.acs.filter(([id]) => !tests.some((t) => t.acs.has(id))).map(([id]) => id);
  const nfrGaps = ids.nfrs.filter(([id]) => !tests.some((t) => t.nfrs.has(id))).map(([id]) => id);
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Tests found: ${tests.length} in ${new Set(tests.map((t) => t.file)).size} files.`);
  lines.push(
    `- Acceptance criteria: ${ids.acs.length - acGaps.length} of ${ids.acs.length} with a test` +
      (acGaps.length ? `; without a test: ${acGaps.join(", ")}.` : "; none without a test."),
  );
  lines.push(
    `- NFRs: ${ids.nfrs.length - nfrGaps.length} of ${ids.nfrs.length} with a test` +
      (nfrGaps.length ? `; without a test: ${nfrGaps.join(", ")}.` : "; none without a test."),
  );
  lines.push("");

  lines.push("## Acceptance criteria");
  lines.push("");
  lines.push("| ID | Tests (file: title) |");
  lines.push("|---|---|");
  for (const [id] of ids.acs) {
    const hits = tests.filter((t) => t.acs.has(id));
    lines.push(`| ${id} | ${hits.length ? hits.map(ref).join("<br>") : "**gap: no test**"} |`);
  }
  lines.push("");
  lines.push("## Non-functional requirements");
  lines.push("");
  lines.push("| ID | Tests (file: title) |");
  lines.push("|---|---|");
  for (const [id, title] of ids.nfrs) {
    const hits = tests.filter((t) => t.nfrs.has(id));
    lines.push(`| ${id} ${cell(title)} | ${hits.length ? hits.map(ref).join("<br>") : "**gap: no test**"} |`);
  }
  lines.push("");
  lines.push("## Requirement-level tags");
  lines.push("");
  lines.push("| Requirement | Tests tagged with the requirement only |");
  lines.push("|---|---|");
  for (const [id, title] of ids.reqs) {
    const hits = tests.filter((t) => t.reqs.has(id));
    lines.push(
      `| ${id} ${cell(title)} | ${hits.length} test(s)` + (hits.length ? ": " + hits.map(ref).join("<br>") : "") + " |",
    );
  }
  lines.push("");
  lines.push("## Test types (spec Testing T1-T14)");
  lines.push("");
  lines.push("| Type | Selected by | Tests | Files |");
  lines.push("|---|---|---|---|");
  for (const [type, name, how] of TYPES) {
    const hits = tests.filter((t) => t.types.has(type));
    const files = [...new Set(hits.map((t) => t.file))];
    const count = type === "T8" ? tests.length : hits.length;
    const fileText = type === "T8" ? "all" : files.length ? files.map((f) => `\`${f}\``).join(", ") : "–";
    lines.push(`| ${type} ${name} | ${how} | ${count} | ${fileText} |`);
  }
  lines.push("");
  return lines.join("\n");
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const text = buildTraceability();
  if (process.argv.includes("--check")) {
    let current = "";
    try {
      current = readFileSync(OUT, "utf8");
    } catch {
      // missing file: stale
    }
    if (current !== text) {
      console.error(`trace: ${relative(ROOT, OUT)} is stale; run node scripts/trace.mjs`);
      process.exit(1);
    }
    console.log(`trace: ${relative(ROOT, OUT)} is current`);
  } else {
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, text);
    console.log(`trace: wrote ${relative(ROOT, OUT)}`);
  }
}
