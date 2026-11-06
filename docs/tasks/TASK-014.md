---
id: TASK-014
title: "3D: pick point + face normal, click menu, display mirror with reasons, tool-hidden and mark paint classes, click section plane + handle (drag, keys), `Fokus`, `state()` extension"
type: feature
status: implemented (awaiting orchestrator verification)
implements: ["REQ-013-AC1 (3D side)", "REQ-013-AC9 (3D side)", "REQ-013-AC10 (3D side)", "REQ-005-AC6 (3D side)", "§4.4 CalcView.state()"]
relates_to: [CR-002, INC-2, REQ-005, REQ-013, DEC-15, DEC-18, DEC-20, DEC-21, TASK-005, TASK-013, TASK-015a, TASK-017a, TASK-017c, TASK-018]
depends_on: [TASK-011a]
touches: [calc-viewer-builder.html (cv-3d-src, cv-css own section "TASK-014 click menu and section handle"), test/e2e/element-tools-3d.spec.mjs (new), test/e2e/view-3d.spec.mjs, test/integration/config-roundtrip.spec.mjs, test/support/view-3d.mjs, test/e2e/smoke.spec.mjs, test/e2e/viewer.spec.mjs, docs/testing/traceability.md]
---
# TASK-014: 3D side of the element tools and `Fokus`

Spec §5 acceptance: the 3D side of REQ-013-AC1, AC9, AC10 (menu placement and following, plane from the face normal incl. the camera fallback, offset in `point`, handle drag and keys with direction, `state()` incl. the mirror reasons) and of REQ-005-AC6, verified through a cv-3d test hook, the AC IDs cited in comments only; `state()` returns `toolHidden`, `marked`, plane `section`; render smoke green; `view-3d.spec.mjs` section tests rewritten (REQ-005-AC3 retired).

## What was built (cv-3d)

### Display mirror with reasons (spec 4.4)
- Each mirror entry keeps `why` (visibility reason: `shown` | `filter` | `tool`) and `paintWhy` (`ghost` | `mark` | `colour` | null) next to the engine state `vis` / `paint`.
- The display plan accepts three new optional fields next to `inside`:
  - `toolRemoved` (Uint8Array, 1 = removed by `Ausblenden` / `Isolieren`);
  - `marked` (Uint8Array, 1 = matches a `Markieren` rule);
  - `isolating` (true while isolation is active).
- The class of a row is tool-removed (wins over every other source; always `setVisible(false)`, never a ghost), shown, or outside the filter (ghost or hidden by the ghost toggle).
- Paint precedence: selection > mark `#f08a87` > colour > ghost. Colours are stored lower-case.
- If a colouring colour equals the mark colour, no extra engine call is made; the reason alone tells them apart.
- While `isolating` is set, the context geometry (e.g. the IfcSite terrain) is hidden (`contextState().visible` = 0).
- `state()` now returns `{mode, opaque, ghost, hidden, toolHidden, marked, colours, selected, section}`:
  - `hidden` = filtered out with ghosts off; `toolHidden` = removed by the tools;
  - `marked` ⊆ `opaque`;
  - `section` = `{point, normal}` in the Z-up scene frame, or null.
- The plans cv-app sends today (only `inside`) behave exactly as before.

### Picking and click menu (REQ-013, ref L945-1003, CSS L1864-1877)
- `pickAt` returns the nearest non-ghost hit as `{key, modelId, localId, point, normal (world face normal or null), distance}`.
- A click (left button, ≤ 4 px) on an element opens the menu at the hit point:
  - `#cv-pick` is a zero-size anchor; the card `[role=menu]` (label `Elementwerkzeuge`) holds the `menuitem` buttons `Ausblenden`, `Isolieren`, `Schneiden` and `Menü schließen`; the red dot marks the point.
  - The card sits 20 px above the point, or below it (`.cv-pick-below`) when the point is less than 110 px from the top of the 3D view.
- The menu is placed after every drawn frame (`placeOverlays`), so it follows camera moves. It is `visibility: hidden` while its point is behind the camera.
- The menu closes:
  - on `Menü schließen`, on a click on empty space, or after a menu action;
  - when its element stops being shown (the next display plan does not show it);
  - when its element leaves the selection (e.g. another table row, `Esc` clearing the selection);
  - when its model is removed.
- `Ausblenden` / `Isolieren` call `options.onMenu(action, key)`. The default is a no-op stub until TASK-017a.
- `Schneiden` cuts with the pick the menu holds, queued after any pending display plan.

### Section plane and handle (REQ-013, ref L1079-1169, CSS L1880-1884)
- `cut(point, faceNormal | null)`:
  - Without a face normal, the direction to the camera is used.
  - |vertical component| ≥ 0.7 gives a horizontal plane; otherwise the plane is vertical and perpendicular to the face.
  - The camera half is removed. The stored point is the clicked point plus 2 mm towards the camera.
  - The stored normal points into the kept half.
- `setSection(next)` accepts three forms:
  - a plane `{point, normal}` (Z-up; a non-unit normal is normalised; non-finite values, wrong lengths or a zero normal are ignored, and the call resolves `false`);
  - the 1.0.0 axis section `{axis, offset, flipped}`, converted as DEC-20, so the interim 1.0.0 `Schnitt` X/Y/Z controls keep working;
  - null.
- A plane outside every model is applied as given.
- Section handle `#cv-section-handle`:
  - a `button` with `aria-label` `Schnitt verschieben`, 36 px, red border, scissors icon;
  - it sits on the plane at the projection of the centre of the models' bounding box;
  - it is `visibility: hidden` while that point is off-screen or behind the camera.
- Moving the plane:
  - Dragging moves the point along the normal and follows the pointer on screen (as the reference, with its minimum drag ratio).
  - `ArrowUp` / `ArrowRight` move it along +normal, `ArrowDown` / `ArrowLeft` along −normal.
  - Each key press moves 1 % of the models' extent along the normal (10 % with `Shift`), at least 1 mm.
- Removing the last model with geometry clears the section.
- `options.onSection(section | null)` reports every change cv-3d makes itself (cut, drag end, key, last model removed).

### `Fokus` (REQ-005)
- `engine.focus()` is queued after the pending display plan. It fits the camera to the merged engine box (`getMergedBox`) of the elements the mirror shows opaque. With no opaque element it fits all models.
- The fit is the reference's tight box fit (ref L820-847): view direction (1, 0.75, 1), padding 1.15. The fit after loading and the 1.0.0 `Ansicht einpassen` use the same fit (all models). See Decision 3.

### Test hook `window.CalcView3D` (cv-3d)
- Coordinates are Z-up; screen positions are page pixels.
- Members:
  - `display(changes)` re-applies the latest plan with changed fields; `lastPlan()`;
  - `focus()`, `menu()`, `pickAt(x, y)`, `cut(point, normal|null)`, `setSection(next)`;
  - `project(point)`, `box(key)`, `extent()`, `camera()`, `look(position, target)`.
- The hook exists in the builder and in the viewer file, like `CalcView`.

### cv-css
- Own section "TASK-014 click menu and section handle", copied from the reference with the `cv-` prefix and the `--cv-` tokens.

## Tests

Expected values: GlobalIds and storeys come from `reference-values.json`. Planes, offsets, steps and anchors are derived in the test from the REQ-013 rules and from engine geometry (element boxes, axis ranges, camera), not from the section code.

New `test/e2e/element-tools-3d.spec.mjs`. All tests pass on `http` and `file`. AC IDs appear in comments only (T5). TASK-017c tags the end-to-end tests.

| Test title | Covers (comment) |
|---|---|
| `@e2e a click on a wall opens the click menu at the clicked point; it follows an orbit and closes with \`Menü schließen\`, the selection stays` | REQ-013-AC1 3D side: marker ≤ 3 px from the click, card bottom ≤ 30 px above, exactly the four menuitems, panel open, follows a real orbit drag, close keeps the selection; the stub `Ausblenden` changes nothing; empty-space click closes |
| `@e2e the click menu opens below its point near the top of the 3D view and above it otherwise` | REQ-013-AC13 first part (3D side) |
| `@e2e \`Schneiden\` on the slab top gives a horizontal plane 2 mm above the point; on a wall's side face a vertical plane away from the camera; a second cut replaces it` | REQ-013-AC9 3D side: normal `[0, 0, -1]`, point +2 mm (±0.1 mm), canvas differs, handle shown; wall: vertical component 0, perpendicular to the face (thin box axis), away from the camera; a second cut replaces the plane; table count and selection unchanged |
| `@e2e \`Schneiden\` without a face normal uses the direction to the camera: vertical from the default view, horizontal from above` | REQ-013 camera fallback |
| `@e2e the section handle sits on the plane at the models' centre; arrow keys move the plane by 1 % / 10 % of the extent, dragging moves it along the normal only` | REQ-013-AC10 3D side: handle anchor, `ArrowUp` ×3 = +3 %, `ArrowDown` ×3 back, `Shift` 10 %, Left/Right, direction, drag along the normal only with the normal unchanged, handle hidden after removal |
| `@e2e \`Fokus\` fits the opaque elements: an isolated ground-floor wall fills the view; without an opaque element all models are fitted` | REQ-005-AC6 3D side: wall 67 % of the canvas width or height (≥ 25 %), opaque boxes inside the canvas, fit-all camera = camera after loading |
| `@e2e state() reports tool-hidden, marked and filtered-out elements by the reason of the engine call (display mirror)` | §4.4: toolHidden with ghosts on and off, engine `getVisible` false, marked ⊆ opaque, mark colour vs colouring colour, `hidden` in mode hide, context hidden while isolating |
| `@e2e @robustness click menu and section handle: menu closes when its element stops being shown or its model is removed, hides behind the camera; planes outside the models, invalid planes; last model removed` | T7 CR-002 items for the menu and the plane |

### Changed expectations (approved CR-002 delta; no assertion loosened)
- `test/e2e/view-3d.spec.mjs`:
  - `@e2e @acceptance @REQ-005-AC3 \`Schnitt\` Z at mid-height, flip and slider; the canvas changes` becomes `@e2e interim 1.0.0 \`Schnitt\` Z at mid-height, flip and slider set the equivalent section plane; the canvas changes`. REQ-005-AC3 is retired.
  - The same steps and canvas checks are kept. `state().section` is asserted as the DEC-20 plane: Z mid → `{point [0,0,mid], normal [0,0,-1]}`; flipped → normal `[0,0,1]`; the slider moves `point[2]`; X → `{point [mid,0,0], normal [-1,0,0]}`.
- `test/integration/config-roundtrip.spec.mjs` (2 assertions): `state().section` is the plane (spec 4.4 changed by CR-002), was the axis section. 1.0.0 files → `{point [0,0,offset], normal [0,0,±1]}`; 1.1.0 file → `display.sectionPlane` as given. The app-side `hook.view.section` (axis, interim) is unchanged.
- `test/support/view-3d.mjs`: `viewState` also returns `toolHidden` and `marked`.
- `CANVAS_ONLY` (`view-3d.mjs`, `smoke.spec.mjs`, `viewer.spec.mjs`) also hides `#cv-pick` and `#cv-section-handle`. They are overlays, not model pixels.

### Trace
- `INC2_PENDING` is unchanged. Spec §5 says this task cites REQ-013-AC1/AC9/AC10 and REQ-005-AC6 in comments only; TASK-017c tags them.
- `docs/testing/traceability.md` regenerated: 301 tests in 57 files. The `@acceptance` count drops by one because the retired AC3 test lost its tag.

## Results (2026-11-05, CV_TEST_PORT=4800)
- `node scripts/check.mjs`: green (format, lint, cdn-cache, test_fast with c8 and 29 integration tests on http).
- Playwright, both projects (`file` and `http`), all green:
  - `test/e2e`: element-tools-3d (8), view-3d, smoke, selection, properties-panel, config, layout-followups, viewer, filter-area, grouping, table, export, filter-/grouping-/table-/viewer-/memory-robustness, system;
  - `test/integration`; `test/acceptance`.
  - The `http` run of `system.spec` is the existing conditional skip; `properties-panel` was run on `file` only.
- `file` only: `volume-robustness` green; perf `view-3d`, `selection`, `nfr-001` (volume set) and `view-3d-volume`: 4 passed.
- Not run: perf `export`, `load-100mb`, `nfr-002`, `text-index`, `viewer` (NFR-003), `grouping`, `table`, `node --test test/perf`, and `node scripts/check.mjs --all` as one command.

## Decisions (for the release gate / orchestrator)
1. **Menu DOM and handle are built in cv-3d.** Spec §5 lists only cv-3d and cv-css for this task, and §4.2 gives cv-3d "click menu anchoring" and "section plane + handle".
   - `role="menu"` sits on the visible card, not the zero-size anchor, so the `[role=menu]:visible` check of `selection.spec.mjs` (TASK-013 contract) can bite.
   - The four entries are `<button role="menuitem">`.
   - The menu is pointer-only (DEC-21), so it has no arrow-key navigation.
2. **Display plan as masks.** The class per row (§4.4) is carried as `inside` + `toolRemoved` + `marked` + `isolating`, not one class array. This keeps cv-app's existing `inside` (0/1) untouched. It is a refinement inside cv-3d's interface; cv-app fills the new fields in TASK-017a / TASK-015b.
3. **One fit algorithm.** The load fit and the 1.0.0 `Ansicht einpassen` now use the reference's tight box fit (padding 1.15) instead of the 1.0.0 bounding-sphere fit (padding 1.2). The model fills more of the view after loading. `Fokus` without an opaque element "fits all models" with the same camera. All layout, selection and perf tests stay green.
4. **The engine accepts the 1.0.0 axis section** and converts it (DEC-20), so the interim X/Y/Z controls and the TASK-012 configuration path keep working until TASK-017c/018 remove them. The handle is shown for such a section as well.
5. **The menu closes when its element leaves the selection.** This follows the reference, where clearing the selection closes the menu. Today a single `Esc` (cv-app) clears both. The `Esc` order "menu before selection" (REQ-007) is TASK-017c: call `engine.closeMenu()` / `engine.menuOpen()` before `select(null)`.

## Open points / contracts for later tasks
- **TASK-017a:**
  - pass `onMenu(action, key)` to `createEngine`;
  - send `toolRemoved`, `isolating` and `marked` (TASK-015b rules) in `sync3d`;
  - the menu then closes by itself when its element is removed.
- **TASK-017c / TASK-018:**
  - pass `onSection(plane | null)` and keep cv-app's section state as the plane. Until then cv-app does not know a section made by `Schneiden`, so `Konfiguration speichern` writes the app's axis section (null after a click cut), and the 1.0.0 axis controls replace a click cut;
  - remove the axis controls;
  - add the pill `Schnitt entfernen`, calling `engine.setSection(null)`;
  - skip a configuration plane while no model with geometry is loaded (DEC-20: the engine applies any valid plane as given);
  - wire `Fokus` to `engine.focus()` (TASK-015a toolbar).
- **TASK-015a:** the toolbar `Fokus` calls `engine.focus()`.
- **Not tested here:**
  - the 1 mm minimum step (needs a model that is flat along the normal; the rule is in `keydown`);
  - `Schneiden` / `Fokus` while a display plan is queued. Both are queued after the pending plan by construction (`enqueue`), but no test forces the race.

## Verification INC-2 (2026-11-05)
- **CODE-3, fixed:** a `sectionPlane` normal with finite components whose length overflows (`Math.hypot` = Infinity, e.g. `[1.7e308, 1.7e308, 0]`) passed the length check and became `[0, 0, 0]`; the engine then dropped the section without a notice (also an existing one). `normaliseSectionPlane` now scales such a normal by its largest component before normalising, so the direction is kept, as for any other non-unit normal (DEC-20 "normal normalised"). Tests: `[unit] DEC-20 sectionPlane …` (three overflowing normals) and the new DEC-20 case `sectionPlane-overflowing-normal` (`scripts/make-config-fixtures.mjs`; unit and `test/e2e/config-compat.spec.mjs`, both fail before the fix).
- **UX-6, fixed:** the 3D view (`#cv-canvas-box`) has the reference background `radial-gradient(120% 95% at 50% 28%, #fff 0%, #eceef0 58%, color-mix(#eceef0 82%, #6b6f73) 100%)` (ref L1723-1727) behind the transparent canvas; `--cv-bg-3d` stays `#eceef0`. Test `@e2e @UI the 3D background is the reference radial gradient …` (`test/e2e/overlay-layout.spec.mjs`; fails before the fix). The canvas pixel checks (`smoke.spec.mjs`, `viewer.spec.mjs`) now compare each pixel with a screenshot of the same box with the canvas hidden (`canvasShots` in `test/support/viewer.mjs`) instead of one background colour; their thresholds are unchanged.
- **SYNC-5 (1) and (2), open for the testing phase (reason):** `Schneiden` / `Fokus` while a display plan is queued and the 1 mm minimum step on a flat extent are still without a test. (1) needs a hook that holds the display-plan queue open (the plan runs inside the engine; forcing the race from outside is not reliable); (2) needs a model that is flat along the section normal (no such fixture; the rule is `Math.max(SECTION_MIN_STEP, extent × 1 %)` in `keydown`). Both are by construction; the orchestrator assigns them to the testing phase (T7) or accepts the reason.

## Testing cycle 2 (2026-11-05): SYNC-5 (1) and (2) tested
- New `test/e2e/section-robustness.spec.mjs` (`@e2e @robustness`, both projects green, 5 repeats each without a failure), no product change:
  - `Fokus` clicked while display plans are queued: two isolation plans (wall A, then wall B replacing it) queued behind a busy engine call (`CalcView3D.box`), then the toolbar `Fokus` in the same task. At the click the applied plan still shows every element; afterwards opaque = [B], the camera target is the centre of B's box, B lies inside the canvas and fills ≥ 25 %, and a second `Fokus` on the settled plan keeps the camera (6 digits).
  - `Schneiden` clicked while display plans are queued (menu open on the slab top; a `marked` plan replaced by an isolation plan, both queued): plane = the menu's pick (normal `[0, 0, -1]`, point 2 mm above), the latest plan applies (opaque = slab + wall, nothing marked), menu closed, app plane equal.
  - Arrow keys on a flat single-element model (`test/support/flat-fixture.mjs`: one IfcSlab 4 × 3 m, 50 mm thick, built in memory): horizontal cut, each plain key press 1 mm (1 % = 0.5 mm is below `SECTION_MIN_STEP`), `Shift` 5 mm (10 %), along the normal only; a vertical plane (normal `[1, 0, 0]`) on the same model steps 1 % of the 4 m X size.
- Bite checks (mutated copy of the builder in the tester's scratch directory, product file untouched): `focus()` not queued → the `Fokus` test fails (target 4.85 m off B); a queued plan not replaced by a newer one → both queue tests fail; `SECTION_MIN_STEP = 0` → the flat-extent test fails (0.5 mm step).
- The "Not tested here" items above are closed.
- **X-5 (testing cycle 2), known limitation:** a configuration `display.sectionPlane` whose point lies far outside every model is applied as given (DEC-20 validation and this task's design; tests above). The view is then empty except for the pill `Schnitt entfernen`, which removes it in one click; the handle stays hidden (off-screen). A notice or clamping would change the DEC-20 field table (baseline). See `docs/process-log.md`.
