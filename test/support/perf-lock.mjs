// Timing-sensitive perf tests (test/perf/*.spec.mjs) must not overlap each other: two of them loading and measuring
// large model sets at the same time (two Playwright workers) slow each other down and distort the measured times
// (observed in TASK-006a: the 3D frame of test/perf/view-3d.spec.mjs went over 500 ms only while the table perf test
// loaded its 30,000-element set on the other worker). Every perf spec imports { test } from here: an automatic
// fixture holds an exclusive lock file (.cache/perf.lock, created with O_EXCL; a lock whose process is gone is taken
// over) for the whole test in the `file` project, where the perf tests run. Other tests still run in parallel.
import { mkdirSync, openSync, closeSync, readFileSync, unlinkSync, writeSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test as base, expect } from "./network-guard.mjs";

const DIR = fileURLToPath(new URL("../../.cache/", import.meta.url));
const LOCK = DIR + "perf.lock";
const WAIT_MS = 500;

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

async function acquire() {
  mkdirSync(DIR, { recursive: true });
  for (;;) {
    try {
      const fd = openSync(LOCK, "wx");
      writeSync(fd, String(process.pid));
      closeSync(fd);
      return;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      let holder = NaN;
      try {
        holder = Number(readFileSync(LOCK, "utf8"));
      } catch {
        continue; // released between open and read
      }
      if (!Number.isInteger(holder) || !alive(holder)) {
        try {
          unlinkSync(LOCK); // stale lock of a process that is gone
        } catch {
          // another waiter removed it first
        }
        continue;
      }
      await new Promise((r) => setTimeout(r, WAIT_MS));
    }
  }
}

function release() {
  try {
    if (Number(readFileSync(LOCK, "utf8")) === process.pid) unlinkSync(LOCK);
  } catch {
    // already gone
  }
}

export const test = base.extend({
  perfLock: [
    // eslint-disable-next-line no-empty-pattern -- Playwright fixtures take an object pattern as first argument
    async ({}, use, testInfo) => {
      if (testInfo.project.name !== "file") return use(false);
      await acquire();
      try {
        await use(true);
      } finally {
        release();
      }
    },
    { auto: true, timeout: 900_000 },
  ],
});
export { expect };
