// ONE fail-fast check (AGENTS.md §4 `check`, run by .githooks/pre-commit): runs check_sequence in order, names the
// failing step and exits non-zero on the first failure.
//
//   node scripts/check.mjs         format, lint, typecheck (n/a), build (n/a), test_fast
//   node scripts/check.mjs --all   the same, then every suite (AGENTS.md §4 `test_all`, regression): all Playwright
//                                  tests in both projects (file, http) and the Node perf tests
//
// Parallel-safe (TASK-004 A1): each run gets its own c8 temp and report directories (coverage/tmp-<pid>,
// coverage/run-<pid>), its own Playwright output directory (test-results/run-<pid>) and, unless CV_TEST_PORT is set,
// a free port for the test server. The per-run directories are removed afterwards (the Playwright output only when
// the run is green, so failure traces stay).
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { createServer } from "node:net";

const RUN = `${process.pid}`;
const C8_TMP = `coverage/tmp-${RUN}`;
const C8_REPORT = `coverage/run-${RUN}`;
const PW_OUT = `test-results/run-${RUN}`;

/** A port the OS reports free right now (the test server binds it moments later). */
function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}
const env = {
  ...process.env,
  CV_TEST_PORT: process.env.CV_TEST_PORT ?? String(await freePort()),
  CV_TEST_OUTPUT: process.env.CV_TEST_OUTPUT ?? PW_OUT,
};

const STEPS = [
  ["format", "npx prettier --check ."],
  ["lint", "npx eslint --max-warnings 0 ."],
  ["typecheck", null], // n/a: plain JavaScript, no type checker (spec §4.1)
  ["build", null], // n/a: no build step (CON-001)
  ["cdn-cache", "node scripts/vendor-cdn.mjs"], // hash-verified jsDelivr cache the browser tests are served from
  [
    "test_fast",
    `npx c8 --temp-directory=${C8_TMP} --report-dir=${C8_REPORT} --include='.cache/**' --check-coverage` +
      " --lines 70 node --test 'test/unit/**/*.test.mjs'" +
      " && npx playwright test --grep @integration --project=http",
  ],
];
if (process.argv.includes("--all")) {
  STEPS.push(["test_all: playwright (all tags, projects file + http)", "npx playwright test"]);
  STEPS.push(["test_all: node perf", "node --test 'test/perf/**/*.test.mjs'"]);
}

function cleanup(green) {
  for (const dir of [C8_TMP, C8_REPORT, ...(green ? [PW_OUT] : [])]) rmSync(dir, { recursive: true, force: true });
}

const started = Date.now();
console.log(`check: run ${RUN} (test server port ${env.CV_TEST_PORT}, c8 ${C8_TMP})`);
for (const [name, cmd] of STEPS) {
  if (!cmd) {
    console.log(`check: ${name} n/a`);
    continue;
  }
  const t0 = Date.now();
  console.log(`check: ${name} -> ${cmd}`);
  const r = spawnSync(cmd, { shell: true, stdio: "inherit", env });
  if (r.status !== 0) {
    cleanup(false);
    console.error(`\ncheck FAILED at step: ${name} (exit ${r.status ?? r.signal})\n  ${cmd}`);
    process.exit(1);
  }
  console.log(`check: ${name} ok (${Date.now() - t0} ms)`);
}
cleanup(true);
console.log(`check: all steps green (${Date.now() - started} ms)`);
