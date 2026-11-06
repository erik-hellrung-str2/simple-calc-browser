// Helpers for the `Fokus` free-area checks (TASK-021, user decision Q-005 for BUG-T11; design detail inside
// REQ-005-AC6): the open overlays covering the 3D view are read from the DOM (filter / colouring panel, properties
// panel, pill stack: the overlays Q-005 names), and the projected boxes of elements are checked against them. The
// expected geometry is derived here from the DOM rects and the engine's projection (CalcView.screenBox); nothing is
// taken from the product's free-area computation.

/** Page rects { left, top, right, bottom } of the canvas and of the shown overlays named in Q-005. */
export function overlayRects(page) {
  return page.evaluate(() => {
    const rect = (node) => {
      const r = node.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, id: node.id };
    };
    const covering = [];
    for (const id of ["cv-filter-panel", "cv-colour-panel", "cv-props", "cv-pills"]) {
      const node = document.getElementById(id);
      if (!node || node.hidden || !node.getClientRects().length) continue;
      const r = rect(node);
      if (r.right - r.left > 0 && r.bottom - r.top > 0) covering.push(r);
    }
    return { canvas: rect(document.querySelector("#cv-viewport canvas")), covering };
  });
}

/** Union of the projected boxes (CalcView.screenBox) of the keys: { left, top, right, bottom }. */
export async function unionBox(page, keys) {
  const boxes = await page.evaluate((list) => Promise.all(list.map((k) => window.CalcView.screenBox(k))), keys);
  const out = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  for (const b of boxes) {
    out.left = Math.min(out.left, b.left);
    out.top = Math.min(out.top, b.top);
    out.right = Math.max(out.right, b.right);
    out.bottom = Math.max(out.bottom, b.bottom);
  }
  return out;
}

const overlaps = (a, b, tol) =>
  a.left < b.right - tol && a.right > b.left + tol && a.top < b.bottom - tol && a.bottom > b.top + tol;

/**
 * Checks a projected box against the free area: { inside (in the canvas, tolerance tol px), hits (ids of overlays it
 * overlaps by more than tol px), fill, room }. room = the free span around the box: horizontally from the nearest
 * overlay edge (or canvas edge) left of it to the nearest one right of it, among the overlays beside its rows;
 * vertically the same among the overlays above / below its columns. fill = max(box width / room width, box height /
 * room height): how much of the free span the box takes in its tighter direction (a tight fit is near 1 / 1.15).
 */
export function freeAreaCheck(box, rects, tol = 2) {
  const { canvas, covering } = rects;
  const inside =
    box.left >= canvas.left - tol &&
    box.top >= canvas.top - tol &&
    box.right <= canvas.right + tol &&
    box.bottom <= canvas.bottom + tol;
  const hits = covering.filter((o) => overlaps(box, o, tol)).map((o) => o.id);
  let left = canvas.left;
  let right = canvas.right;
  let top = canvas.top;
  let bottom = canvas.bottom;
  for (const o of covering) {
    if (o.top < box.bottom && o.bottom > box.top) {
      if (o.right <= box.left + tol) left = Math.max(left, o.right);
      if (o.left >= box.right - tol) right = Math.min(right, o.left);
    }
    if (o.left < box.right && o.right > box.left) {
      if (o.bottom <= box.top + tol) top = Math.max(top, o.bottom);
      if (o.top >= box.bottom - tol) bottom = Math.min(bottom, o.top);
    }
  }
  const room = { width: right - left, height: bottom - top };
  const fill = Math.max((box.right - box.left) / room.width, (box.bottom - box.top) / room.height);
  return { inside, hits, fill, room };
}
