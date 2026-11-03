// T1 / T5 (TASK-010): scripts/trace.mjs builds docs/testing/traceability.md from the test titles; the committed file
// must be current, and every acceptance criterion and NFR of the spec must have a test (spec Testing T5).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildTraceability, idsOf, specIds, testTitles } from "../../scripts/trace.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

test("[unit] trace: titles of test() calls, IDs as tags, in text and with underscores", () => {
  // the source text is assembled from parts so that the generator, which scans this file too, does not read these
  // fixture calls as tests of this file (verification INC-1 SYNC F5)
  const call = "te" + "st(";
  const titles = testTitles(
    `${call}"@e2e @REQ-004-AC2 a", () => {});\n${call}\n  \`@perf @NFR-001 \${x} b\`,\n);\n${call}"[unit] REQ_006_AC9 c \\" d", f);`,
  );
  assert.deepEqual(titles, ["@e2e @REQ-004-AC2 a", "@perf @NFR-001 ${x} b", '[unit] REQ_006_AC9 c \\" d']);
  const a = idsOf(titles[0]);
  assert.deepEqual([[...a.acs], [...a.nfrs], [...a.reqs], [...a.types]], [["REQ-004-AC2"], [], [], ["T4"]]);
  const b = idsOf("@integration @robustness @REQ-001 x NFR-002");
  assert.deepEqual(
    [[...b.acs], [...b.nfrs], [...b.reqs], [...b.types].sort()],
    [[], ["NFR-002"], ["REQ-001"], ["T2", "T7"]],
  );
  assert.deepEqual([...idsOf(titles[2]).acs], ["REQ-006-AC9"]);
  assert.deepEqual([...idsOf(titles[2]).types], ["T1"]);
});

test("[unit] trace: no test file is credited with an ID it names only inside a string (SYNC F5)", () => {
  const own = testTitles(readFileSync(ROOT + "test/unit/trace.test.mjs", "utf8"));
  assert.ok(own.length >= 3, "the titles of this file are found");
  for (const title of own) {
    assert.match(title, /^\[unit\] trace: /, "only the real test titles of this file: " + title);
    assert.deepEqual([...idsOf(title).acs], [], title);
  }
  assert.doesNotMatch(buildTraceability(), /`test\/unit\/trace\.test\.mjs`: @/);
});

test("[unit] trace: every acceptance criterion and NFR of the spec has a test; docs/testing/traceability.md is current", () => {
  const spec = specIds(readFileSync(ROOT + "docs/spec.md", "utf8"));
  assert.ok(spec.acs.length >= 50, "acceptance criteria found in the spec");
  assert.deepEqual(
    spec.nfrs.map(([id]) => id),
    ["NFR-001", "NFR-002", "NFR-003", "NFR-004", "NFR-005"],
  );
  const text = buildTraceability();
  assert.doesNotMatch(text, /gap: no test/, "an acceptance criterion or NFR without a test");
  assert.equal(
    readFileSync(ROOT + "docs/testing/traceability.md", "utf8"),
    text,
    "docs/testing/traceability.md is stale: run node scripts/trace.mjs",
  );
});
