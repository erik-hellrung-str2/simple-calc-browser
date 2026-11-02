// Shared measurement of one input for the perf specs (NFR-001, TASK-006a / TASK-006b): waits until the 3D view is
// idle (no redraw of an earlier action pending), runs the input and measures in the page from its click event
// (timeStamp) until the table is updated and until the next frame. The table time is window.__calc.table.at, stamped
// by the table update itself, so a long 3D frame drawn before the poll notices the update does not inflate it
// (TASK-006b fix pass: table.spec.mjs read performance.now() after a requestAnimationFrame poll and measured 600 ms
// for a 5 ms update).
import { idle } from "./view-3d.mjs";

/** { table (render ms), updated (click -> table updated), frame (click -> next frame), rows (rows shown) } */
export async function measureInput(page, action) {
  await idle(page);
  await page.evaluate(() => {
    window.__t0 = null;
    document.addEventListener("click", (e) => (window.__t0 = e.timeStamp), { capture: true, once: true });
    window.__tableUpdates = window.__calc.table.updates;
  });
  await action();
  return page.evaluate(async () => {
    await new Promise((resolve) => {
      const tick = () =>
        window.__calc.table.updates > window.__tableUpdates ? resolve() : requestAnimationFrame(tick);
      tick();
    });
    const updatedAt = window.__calc.table.at;
    const r1 = (x) => Math.round(x * 10) / 10;
    const frameAt = await new Promise((r) => requestAnimationFrame((t) => r(t)));
    return {
      table: r1(window.__calc.table.lastMs),
      updated: r1(updatedAt - window.__t0),
      frame: r1(Math.max(frameAt, updatedAt) - window.__t0),
      rows: window.__calc.table.count,
    };
  });
}
