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

/**
 * Runs action (a Playwright input that changes the filter) and measures in the page from its click event (timeStamp,
 * performance clock) until the 3D view shows the result (NFR-001 3D part, TASK-005 / TASK-010):
 *   filterMs  filter pass of the click (window.__calc.filter.lastMs)
 *   applied   the engine calls of the new display plan are done (CalcView.lastAppliedAt; state() derives from them)
 *   first     the first frame drawn because the view changed after the click (CalcView.changeFrames)
 *   frame     the last such frame before the view is idle: the complete frame (last changed frame drawn)
 *   changed   the number of changed frames the click drew (R-4: one is the goal)
 *   shown     the first animation frame after the last changed frame: pixels on screen (Q-002, recorded only)
 *   idle      CalcView.whenIdle() (upper bound)
 * Times are NaN when the click drew no changed frame.
 */
export async function measureViewClick(page, action) {
  await idle(page);
  const updates = await page.evaluate(() => {
    window.__t0 = null;
    document.addEventListener("click", (e) => (window.__t0 = e.timeStamp), { capture: true, once: true });
    return window.__calc.filter.updates;
  });
  await action();
  return page.evaluate(async (n) => {
    await new Promise((resolve) => {
      const tick = () => (window.__calc.filter.updates >= n + 1 ? resolve() : requestAnimationFrame(tick));
      tick();
    });
    const idleAt = await window.CalcView.whenIdle();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); // the shown mark of the last frame
    const t0 = window.__t0;
    const changes = window.CalcView.changeFrames().filter((t) => t > t0);
    const last = changes.length ? changes[changes.length - 1] : NaN;
    const shown = window.CalcView.shownFrames().find((t) => t > last);
    return {
      filterMs: window.__calc.filter.lastMs,
      applied: window.CalcView.lastAppliedAt() - t0,
      first: changes.length ? changes[0] - t0 : NaN,
      frame: last - t0,
      changed: changes.length,
      shown: shown === undefined ? NaN : shown - t0,
      idle: idleAt - t0,
    };
  }, updates);
}

/**
 * Medians of measureViewClick runs per action, rounded to 0.1 ms: { filterMs, appliedMs, firstFrameMs, frameMs,
 * shownMs, idleMs, oneFrameRuns, frames (changed frames per run), runs (complete frame per run) }.
 */
export function summariseViewClicks(results) {
  const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const r1 = (x) => Math.round(x * 10) / 10;
  return Object.fromEntries(
    Object.entries(results).map(([k, runs]) => [
      k,
      {
        filterMs: r1(median(runs.map((r) => r.filterMs))),
        appliedMs: r1(median(runs.map((r) => r.applied))),
        firstFrameMs: r1(median(runs.map((r) => r.first))),
        frameMs: r1(median(runs.map((r) => r.frame))),
        shownMs: r1(median(runs.map((r) => r.shown))),
        idleMs: r1(median(runs.map((r) => r.idle))),
        oneFrameRuns: runs.filter((r) => r.changed === 1).length,
        frames: runs.map((r) => r.changed),
        runs: runs.map((r) => Math.round(r.frame)),
      },
    ]),
  );
}

/**
 * NFR-001 end to end (TASK-010): runs action (a Playwright click) and measures in the page from its click event
 * (timeStamp, performance clock) until filter sets, table and 3D all show the new result:
 *   filter    filter sets updated (window.__calc.filter.at; null when the input changed no filter)
 *   table     table rendered (window.__calc.table.at; null when the table was not updated)
 *   frame     the last changed 3D frame drawn (CalcView.changeFrames; null when the 3D view did not change) - the
 *             complete frame; Q-002: "interaction done" for the 3D part is this frame
 *   selected  the selection's engine calls done (CalcView.lastSelectedAt; null when the input selected nothing)
 *   done      max(filter, table, frame, selected): the NFR-001 time
 *   changed   number of changed 3D frames
 *   shown     the first animation frame after done: pixels on screen (software WebGL: recorded only, Q-002)
 * Waits until the input reacted (filter evaluation, table update or selection), then for CalcView.whenIdle().
 */
export async function measureInteraction(page, action) {
  await idle(page);
  const before = await page.evaluate(() => {
    window.__t0 = null;
    document.addEventListener("click", (e) => (window.__t0 = e.timeStamp), { capture: true, once: true });
    return {
      filter: window.__calc.filter.updates,
      table: window.__calc.table.updates,
      selected: window.CalcView.lastSelectedAt(),
    };
  });
  await action();
  return page.evaluate(async (b) => {
    await new Promise((resolve) => {
      const reacted = () =>
        window.__calc.filter.updates > b.filter ||
        window.__calc.table.updates > b.table ||
        window.CalcView.lastSelectedAt() > b.selected;
      const tick = () => (reacted() ? resolve() : requestAnimationFrame(tick));
      tick();
    });
    await window.CalcView.whenIdle();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const t0 = window.__t0;
    const rel = (t) => (t === null ? null : Math.round((t - t0) * 10) / 10);
    const filterAt = window.__calc.filter.updates > b.filter ? window.__calc.filter.at : null;
    const tableAt = window.__calc.table.updates > b.table ? window.__calc.table.at : null;
    const changes = window.CalcView.changeFrames().filter((t) => t > t0);
    const frameAt = changes.length ? changes[changes.length - 1] : null;
    const selectedAt = window.CalcView.lastSelectedAt() > b.selected ? window.CalcView.lastSelectedAt() : null;
    const doneAt = Math.max(...[filterAt, tableAt, frameAt, selectedAt].filter((t) => t !== null));
    const shown = window.CalcView.shownFrames().find((t) => t > doneAt);
    return {
      filter: rel(filterAt),
      table: rel(tableAt),
      frame: rel(frameAt),
      selected: rel(selectedAt),
      done: rel(doneAt),
      changed: changes.length,
      shown: shown === undefined ? null : rel(shown),
      count: window.__calc.filter.count,
    };
  }, before);
}

/** Medians (and max) of measureInteraction runs: { done, doneMax, filter, table, frame, shown, changed, runs }. */
export function summariseInteractions(runs) {
  const med = (xs) => {
    const v = xs.filter((x) => x !== null).sort((a, b) => a - b);
    return v.length ? v[Math.floor(v.length / 2)] : null;
  };
  return {
    done: med(runs.map((r) => r.done)),
    doneMax: Math.max(...runs.map((r) => r.done)),
    filter: med(runs.map((r) => r.filter)),
    table: med(runs.map((r) => r.table)),
    frame: med(runs.map((r) => r.frame)),
    shown: med(runs.map((r) => r.shown)),
    changed: runs.map((r) => r.changed),
    selected: med(runs.map((r) => r.selected ?? null)),
    runs: runs.map((r) => Math.round(r.done)),
  };
}
