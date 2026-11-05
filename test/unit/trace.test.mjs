// T1 / T5 (TASK-010): scripts/trace.mjs builds docs/testing/traceability.md from the test titles; the committed file
// must be current, and every acceptance criterion and NFR of the spec must have a test (spec Testing T5).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildTraceability, idsOf, specIds, testTitles } from "../../scripts/trace.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

// INC-2 (CR-002, TASK-011a; docs/process-log.md 2026-11-04 "traceability check during INC-2"): the acceptance criteria
// of the CR-002 delta that have no test yet. The "every AC has a test" check skips exactly these IDs and fails when a
// listed ID is not an AC of the spec or already has a test, so each INC-2 task removes the IDs it covers in the same
// change. TASK-020 requires this list to be empty. Changed ACs (REQ-004-AC4, REQ-005-AC1/AC2/AC4, REQ-007-AC1/AC3/
// AC4/AC5, REQ-009-AC1, REQ-010-AC2) are not listed: their 1.0.0 tests still name them and are updated by the INC-2
// task that changes the behaviour (CR-002 §6).
const INC2_PENDING = [
  // REQ-003 Configure filter sets (new CR-002)
  "REQ-003-AC4",
  "REQ-003-AC5",
  // REQ-004 Filter with filter sets (new CR-002; AC5, AC6 covered by TASK-017a)
  // REQ-005 3D model view (new CR-002; AC10 covered by TASK-015a; AC5, AC8, AC9 by TASK-016). AC7: TASK-016 tests it
  // without the AC ID in the title except its `Schnitt X` part (the interim axis section bar stays until TASK-017c,
  // which removes it and tags the AC)
  "REQ-005-AC6",
  "REQ-005-AC7",
  "REQ-005-AC11",
  "REQ-005-AC12",
  // REQ-006 Table (new CR-002; AC12 covered by TASK-013)
  "REQ-006-AC11",
  // REQ-007 Selection and properties panel (AC6 covered by TASK-013; AC7, AC8 new CR-002). AC4 (changed CR-002): the
  // panel part is tested since TASK-013 without the AC ID in the title (T5: the whole AC includes the buttons
  // `Ausblenden` / `Isolieren`), TASK-017b tags it
  "REQ-007-AC4",
  "REQ-007-AC7",
  "REQ-007-AC8",
  // REQ-008 Export (new CR-002)
  "REQ-008-AC6",
  // REQ-009 Configuration (new CR-002)
  "REQ-009-AC4",
  "REQ-009-AC5",
  "REQ-009-AC6",
  "REQ-009-AC7",
  "REQ-009-AC8",
  // REQ-010 Viewer file (new CR-002)
  "REQ-010-AC4",
  // REQ-012 In-viewer rule filter (new requirement, CR-002): AC1, AC7 covered by TASK-015a; AC2-AC6, AC8, AC10, AC11
  // by TASK-015b; AC9 by TASK-016; AC12-AC14 by TASK-017a. All covered.
  // REQ-013 Element tools (new requirement, CR-002; AC2, AC4, AC5, AC6, AC8 covered by TASK-017a). AC3: TASK-017a tests
  // its first part without the AC ID in the title; its second part (a second wall selected in the table while only the
  // isolated wall is a table row) is an open question to the user (docs/tasks/TASK-017a.md, Open points)
  "REQ-013-AC1",
  "REQ-013-AC3",
  "REQ-013-AC7",
  "REQ-013-AC9",
  "REQ-013-AC10",
  "REQ-013-AC11",
  "REQ-013-AC12",
  "REQ-013-AC13",
];

/** IDs whose row in the generated traceability table says "gap: no test". */
function gapRows(text) {
  return [...text.matchAll(/^\| ((?:REQ|NFR)-\d{3}(?:-AC\d+)?)\b[^|]*\| \*\*gap: no test\*\* \|$/gm)].map((m) => m[1]);
}

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
  const gaps = gapRows(text);
  assert.equal(gaps.length, (text.match(/gap: no test/g) || []).length, "every gap row is recognised");
  assert.deepEqual(
    gaps.filter((id) => !INC2_PENDING.includes(id)),
    [],
    "an acceptance criterion or NFR without a test",
  );
  // INC2_PENDING itself: no duplicates, only ACs of the spec, and none that already has a test
  assert.equal(new Set(INC2_PENDING).size, INC2_PENDING.length, "INC2_PENDING has no duplicates");
  const acIds = spec.acs.map(([id]) => id);
  assert.deepEqual(
    INC2_PENDING.filter((id) => !acIds.includes(id)),
    [],
    "INC2_PENDING lists an ID that is not an acceptance criterion of docs/spec.md",
  );
  assert.deepEqual(
    INC2_PENDING.filter((id) => !gaps.includes(id)),
    [],
    "INC2_PENDING lists an AC that has a test now: remove it from the list",
  );
  assert.equal(
    readFileSync(ROOT + "docs/testing/traceability.md", "utf8"),
    text,
    "docs/testing/traceability.md is stale: run node scripts/trace.mjs",
  );
});

test("[unit] trace: retired acceptance criteria (~~ID~~) are not ACs of the spec; the INC-2 gap rows are recognised", () => {
  const text = readFileSync(ROOT + "docs/spec.md", "utf8");
  const retired = [...text.matchAll(/^- ~~(REQ-\d{3}-AC\d+)~~/gm)].map((m) => m[1]);
  assert.ok(retired.includes("REQ-005-AC3"), "REQ-005-AC3 is listed as retired (CR-002)");
  const acIds = specIds(text).acs.map(([id]) => id);
  for (const id of retired) assert.ok(!acIds.includes(id), id + " is retired and must not count as an AC");
  // retired line shape, and a line with the active shape, read from a fixture (not from the spec)
  const fixture = "- ~~REQ-001-AC9~~ retired by CR-999: was ...\n- REQ-001-AC8: Given x, Then y.\n";
  assert.deepEqual(
    specIds(fixture).acs.map(([id]) => id),
    ["REQ-001-AC8"],
  );
  // gap rows of the generated table, for an AC and an NFR row; covered rows are not gaps
  const table = [
    "| REQ-012-AC1 | **gap: no test** |",
    "| REQ-001-AC1 | `test/e2e/x.spec.mjs`: t |",
    "| NFR-002 Model size | **gap: no test** |",
  ].join("\n");
  assert.deepEqual(gapRows(table), ["REQ-012-AC1", "NFR-002"]);
});
