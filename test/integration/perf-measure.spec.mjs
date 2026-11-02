// Regression test of the TASK-006b fix pass (verification finding: test/perf/table.spec.mjs measured 600-690 ms for a
// column-filter click whose table update takes about 5 ms). Cause: the measurement read performance.now() after a
// requestAnimationFrame poll, so a long frame drawn after the input (a 3D redraw) was counted as table time. The
// shared helper test/support/perf-measure.mjs takes window.__calc.table.at, stamped by the table update itself.
// Here a 400 ms busy task is queued right after the click (it runs before the measurement's poll, as a long 3D frame
// does): the table is updated before the busy task, and the measured table time must stay below the busy time (the
// old poll read performance.now() only after it). The second test keeps every perf spec on the shared helper.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test, expect } from "../support/network-guard.mjs";
import { fixture, loadFiles, openBuilder } from "../support/builder.mjs";
import { measureInput } from "../support/perf-measure.mjs";

const BUSY_MS = 400;

test("@integration TASK-006b perf measurement: a long frame after the input does not count as table time", async ({
  page,
}) => {
  await openBuilder(page);
  await loadFiles(page, fixture("AC20-FZK-Haus.ifc"));
  for (const name of ["Gruppiert", "Einzelelemente"]) {
    await page.evaluate((busy) => {
      document.addEventListener(
        "click",
        () =>
          setTimeout(() => {
            window.__busyStart = performance.now();
            while (performance.now() < window.__busyStart + busy);
            window.__busyEnd = performance.now();
          }, 0),
        { capture: true, once: true },
      );
    }, BUSY_MS);
    const m = await measureInput(page, () => page.getByRole("radio", { name, exact: true }).click());
    const busy = await page.evaluate(() => ({ start: window.__busyStart - window.__t0, end: window.__busyEnd }));
    expect(busy.end, `${name}: the busy task ran`).toBeGreaterThan(0);
    expect(busy.start, `${name}: the busy task starts after the table update`).toBeGreaterThanOrEqual(m.updated);
    expect(m.updated, `${name}: table time is the update itself`).toBeGreaterThanOrEqual(m.table);
    expect(m.updated, `${name}: table time excludes the busy frame`).toBeLessThan(BUSY_MS);
  }
});

test("@integration TASK-006b every perf spec measures inputs with the shared helper", () => {
  const dir = fileURLToPath(new URL("../perf/", import.meta.url));
  const specs = readdirSync(dir).filter((f) => f.endsWith(".spec.mjs"));
  for (const f of specs) {
    const src = readFileSync(dir + f, "utf8");
    // a spec measuring table updates (window.__calc.table.updates) uses the shared helper, not its own poll
    expect(src, f).not.toMatch(/__calc\.table\.updates/);
    expect(src, f).not.toMatch(/updatedAt\s*=\s*performance\.now\(\)/);
    if (/__calc\.table/.test(src) && /\bmeasure\(/.test(src))
      expect(src, f).toContain('from "../support/perf-measure.mjs"');
  }
});
