// ONE fail-fast check (AGENTS.md §4 `check`, run by .githooks/pre-commit): runs check_sequence in order, names the
// failing step and exits non-zero on the first failure.
//
//   node scripts/check.mjs         format, lint, typecheck (n/a), build (n/a), test_fast
//   node scripts/check.mjs --all   the same, then every suite (AGENTS.md §4 `test_all`, regression): all Playwright
//                                  tests in both projects (file, http) and the Node perf tests
import { spawnSync } from "node:child_process";

const STEPS = [
  ["format", "npx prettier --check ."],
  ["lint", "npx eslint --max-warnings 0 ."],
  ["typecheck", null], // n/a: plain JavaScript, no type checker (spec §4.1)
  ["build", null], // n/a: no build step (CON-001)
  ["cdn-cache", "node scripts/vendor-cdn.mjs"], // hash-verified jsDelivr cache the browser tests are served from
  [
    "test_fast",
    "npx c8 --include='.cache/**' --check-coverage --lines 70 node --test 'test/unit/**/*.test.mjs'" +
      " && npx playwright test --grep @integration --project=http",
  ],
];
if (process.argv.includes("--all")) {
  STEPS.push(["test_all: playwright (all tags, projects file + http)", "npx playwright test"]);
  STEPS.push(["test_all: node perf", "node --test 'test/perf/**/*.test.mjs'"]);
}

const started = Date.now();
for (const [name, cmd] of STEPS) {
  if (!cmd) {
    console.log(`check: ${name} n/a`);
    continue;
  }
  const t0 = Date.now();
  console.log(`check: ${name} -> ${cmd}`);
  const r = spawnSync(cmd, { shell: true, stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`\ncheck FAILED at step: ${name} (exit ${r.status ?? r.signal})\n  ${cmd}`);
    process.exit(1);
  }
  console.log(`check: ${name} ok (${Date.now() - t0} ms)`);
}
console.log(`check: all steps green (${Date.now() - started} ms)`);
