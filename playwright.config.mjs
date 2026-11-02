// Browser tests (spec Testing): projects `file` (builder opened via file://) and `http` (via scripts/serve.mjs).
// Select a test type with --grep @<tag>; every spec imports { test } from test/support/network-guard.mjs.
import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.CV_TEST_PORT ?? 4173); // override for parallel runs (scripts/check.mjs picks a free one)
const OUTPUT = process.env.CV_TEST_OUTPUT ?? "test-results"; // per-run output directory (scripts/check.mjs)
export default defineConfig({
  testDir: "test",
  testMatch: "**/*.spec.mjs",
  outputDir: OUTPUT,
  timeout: 60_000,
  forbidOnly: true,
  retries: 0, // a flaky test is a bug (process/calibration/testing.md §4)
  reporter: [["list"]],
  use: { acceptDownloads: true, browserName: "chromium" },
  webServer: {
    command: "node scripts/serve.mjs",
    env: { PORT: String(PORT) },
    url: `http://127.0.0.1:${PORT}/calc-viewer-builder.html`,
    reuseExistingServer: false,
  },
  projects: [
    { name: "file", use: { baseURL: new URL("./", import.meta.url).href } },
    { name: "http", use: { baseURL: `http://127.0.0.1:${PORT}/` } },
  ],
});
