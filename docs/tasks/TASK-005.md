---
id: TASK-005
title: 3D coupling (ghost / hide, colouring with legend, section, CalcView.state(), picking and details panel); render on demand (TASK-004 P1)
type: feature
status: done (verification pending)
implements: [REQ-005, REQ-007-AC1, REQ-007-AC4, REQ-007-AC5, spec §4.4 CalcView.state() and fragments mapping, DEC-15]
relates_to: [REQ-001-AC4 (3D side, process-log 2026-11-02), NFR-001, UI-02, TASK-004 P1]
depends_on: [TASK-004]
touches: [calc-viewer-builder.html (cv-css, cv-core-src, cv-ui-src, cv-3d-src, cv-app-src), scripts/ref/derive-reference.mjs, test/fixtures/reference-values.json, test/unit/colouring.test.mjs, test/e2e/view-3d.spec.mjs, test/e2e/smoke.spec.mjs, test/perf/view-3d.spec.mjs, test/support/view-3d.mjs]
---
# TASK-005: 3D coupling

## What was built

### cv-core: colouring (REQ-005 `Färben nach`, DEC-15)
- **`colourScheme(store, key)`** builds the colour of every row for one property. It reads the lazy column of TASK-003 (dictionary codes in value order).
  - **Text values (or mixed text and numbers).** Each value gets its own distinct colour, in value order, up to `COLOUR_DISTINCT_COUNT` = 120. The colours are golden-angle hues with alternating lightness, as in the reference app's `distinctHex`. Further values share `COLOUR_OTHER`, shown as `Sonstige`.
  - **Numbers only.** `COLOUR_SCALE_STEPS` = 24 equal ranges from min to max; the last range is closed. The colour is a tint of `COLOUR_SCALE_BASE` (#1f6fd1), from 12 % for small values to full for large ones, as the reference `scaleHex`. The legend shows each range as `a – b` in German number format with up to 3 decimals. If there is only one value, there is one entry.
  - **Several distinct values in one row** get `COLOUR_MULTI`, shown as `mehrere Werte`.
  - **Empty values** get `COLOUR_EMPTY` (grey), shown as `(leer)`.
- **`colourLegend(scheme, indices)`** lists the entries that occur among the rows inside the filter, with their counts. The order is the scheme order, with `mehrere Werte` and `(leer)` last.
- **Stable colours.** Colours are computed over **all** rows of the row set, not only the filtered ones. A filter change therefore never recolours anything, and the legend and the filter-set dots always agree. The scheme is rebuilt when the row set changes (load, remove, IfcSpace option). The colouring column is kept by `store.retain` (`keysInUse()`).
- **Scale colour is blue.** The accent red `#d72622` stays reserved for the selection highlight (ref `HIGHLIGHT_COLOR`).

### cv-3d: display, selection, section, picking, `CalcView.state()` (spec §4.4)
- **Display mirror.** cv-3d keeps a mirror of every call it makes to Fragments, per element: `vis` (from `setVisible`) and `paint` (`ghost` or `#rrggbb`, from `highlight` / `resetHighlight`), plus the selection.
  - `state()` is derived from this mirror only, never from cv-core's filter result, as the spec requires.
  - The mapping follows ref L1180-1265 and §4.4:
    - **Ghost** = `highlight` with a transparent material (`#a4a8ac`, opacity 0.12, `depthWrite` false, one face).
    - **Hide** = `setVisible(false)`.
    - **Colouring** = one `highlight` call per colour bucket and model.
    - **Selection** = `highlight` with `#d72622`, applied last.
  - Precedence: selection > colour > ghost / hide.
    - While an element is selected, changes to its paint are recorded in the mirror but not sent to the engine.
    - On deselection the element's current paint is applied again.
- **`display(plan)`** takes `{ rows, inside (Uint8Array), mode, colourOf(i), context, filterActive }`.
  - It sends only the differences to the mirror: one `setVisible` per direction, one `resetHighlight`, and one `highlight` per paint and model.
  - All engine calls go through one serial queue. A plan that is still waiting in the queue is replaced by a newer one, so rapid clicks are coalesced.
- **Managed elements.** Only rows with geometry are managed. Rows with `Geometrie = Nein` have nothing in 3D, so they are never in `opaque` / `ghost` / `hidden` / `selected`.
- **IfcSpace (process-log 2026-11-02).**
  - While the option is off, spaces are not rows. cv-3d therefore never calls `setVisible(true)` on them, and they never appear in `state()`.
  - When the option is switched off, the spaces leave the row set: their paint is reset, their visibility stays `false` as set by the option, and they leave the mirror.
  - `setItemsVisible` (the option) also runs through the queue, so it is never interleaved with a display plan.
- **Context geometry.** This is Fragments geometry that is no element row, e.g. the IfcSite terrain of AC20-FZK-Haus (`withGeometry` minus the model's row localIds; spaces are rows, so they are not included).
  - While a filter is active, context geometry follows the mode: ghost, or hidden.
  - Without a filter it is shown as loaded.
  - It is not in `state()` (it is not an element) and it is not pickable. Without this, the green terrain stayed opaque in ghost and hide mode (screenshot check).
- **Section (`Schnitt`).** Axes are in IFC terms; Fragments shows the Z-up model Y-up, so IFC X = three x, IFC Y = −three z, IFC Z = three y.
  - `offset` is the coordinate along the axis in model metres.
  - Not flipped keeps the part with coordinate ≤ offset (for Z: everything below the cut). Flipped keeps the other part.
  - Implemented with `renderer.clippingPlanes`. `model.getClippingPlanesEvent` is set, as in the reference, so the worker respects the plane in culling and raycasting.
  - `axisRange(axis)` gives the slider range: the extent of all models along the axis. Choosing an axis puts the cut at the middle.
- **Picking (REQ-007).**
  - A canvas click is a `pointerup` within 4 px of its `pointerdown` (ref `CLICK_TOLERANCE_PX`); a larger move is an orbit drag.
  - It runs `raycastAll` on every model and takes the nearest hit that is a managed, visible, non-ghost element. Ghosts are skipped, so elements behind them stay pickable (ref).
  - No hit means `onPick(null)`, which clears the selection.
- **Render on demand (TASK-004 verification P1).** There is no animation loop. A frame is drawn only:
  - on camera / controls changes (`change`, including damping),
  - on resize,
  - on section changes (clipping is renderer state),
  - when the view really changed.
- **Detecting a real view change.** Fragments refreshes its view on its own timer, about every 100 ms and also when idle, and reports each refresh with `onViewUpdated`. Tile updates (highlight, visibility, LOD) change the tile meshes in place without an event. So after each refresh cv-3d compares a signature of the model's tiles (visibility, material ids, draw range, groups, index and attribute buffer versions) with the last one, and draws only if it changed. New or removed tiles always draw.
- **Coalescing.** A changed view is drawn once every model has finished its refresh (`isBusy`), waiting at most 150 ms. This gives one complete frame instead of one per model.
- **Explicit updates.** `updateView()` (after engine calls) bypasses `fragments.settings.maxUpdateRate` for its own `fragments.update` call. The limit is read synchronously at the call and restored immediately. Without this, an update within 100 ms of Fragments' own timer is silently skipped.
- **No early frame.** `updateView()` itself requests no frame. A frame drawn before the refresh shows nothing new and, at about 280 ms in headless software WebGL, held back the refresh results (measured: first changed frame 300 → 90 ms).
- **Test seams.**
  - `whenIdle()` resolves when the queue is empty, every model has finished two more view refreshes (the second one started after the calls) and a frame has been drawn.
  - `frames()`, `lastAppliedAt()` and `changeFrames()` are for the render-on-demand and perf tests.
  - `screenBox(key)` is the projected bounding box via `model.getBoxes`.
  - `engineVisible(modelId, ids)` returns `model.getVisible`, so a test can check the engine itself and not only the mirror.

### cv-ui: controls, legend, details
- **3D view controls, top right of the model (`#cv-view-bar`).**
  - `Elemente außerhalb des Filters:` `Geist | Ausblenden`: a radio group, default `Geist`.
  - `Färben nach` / `Färben nach: <Eigenschaft>`: opens the property catalogue dialog of TASK-004, titled `Färben nach`. `Färbung entfernen` (×) appears while a colouring is active.
  - `Schnitt` with axis radios `Schnitt X` / `Schnitt Y` / `Schnitt Z`. While a section is active, it also shows the slider `Schnittposition`, `Schnitt umkehren` and `Schnitt entfernen`.
  - `Ansicht einpassen`.
- **Legend under the model (`#cv-legend`, bottom left of the 3D view).**
  - Title: the property header with its unit.
  - Entries: dot, label, count. Each entry has `data-colour` and `data-kind` (`value` / `range` / `other` / `multi` / `empty`).
  - Without elements in the filter it shows `Keine Elemente im Filter.`.
- **Dots in the filter set.** In the filter set of the colouring property, each value row's `.cv-dot` gets the value's colour (TASK-004 placeholder `item.colour`). Other sets have no dots.
- **Details panel `Element-Details` (REQ-007).**
  - Head: Kategorie (kicker), Name (or Kategorie), and a close button `Auswahl aufheben`.
  - For `Geometrie = Nein`: the note `Dieses Element hat keine 3D-Geometrie.`.
  - Groups:
    - `Allgemein` first (attributes and special properties in catalogue order).
    - Then the psets (in catalogue order).
    - Then the type-only psets (`Typ: <pset>`).
  - Properties are shown without their pset prefix; the full key is the tooltip. Numbers are in German format with up to 3 decimals plus their unit; multi-values are joined with `, `.
  - Groups are collapsible (`aria-expanded`), and the collapsed state is kept per group name across selections.
  - All model values are set with `textContent`.
- **Escape in the catalogue dialog** now marks the event `defaultPrevented`. An Escape that closes a dialog does not clear the 3D selection.
- **Styles** follow UI-02 (white panels with a light shadow, accent for active states, calt/liga disabled on data text as in TASK-004 V1). All embedded sources stay ASCII (`\u` escapes).

### cv-app: wiring
- `refresh()` builds `inside` from the filter result, sets the dot colours, and sends the display plan (`sync3d`). The legend is updated in the same call.
- **`select(key)`** (exposed as `start().select`, `CalcView.select`; the hook for the table in TASK-006c):
  - highlights an element that has geometry,
  - shows the details panel (also for `Geometrie = Nein`),
  - with `null`, clears the selection and the details.
- **When the selection is cleared automatically:** a 3D click on empty space, Escape, or the selected element leaving the filter or the row set.
- **`window.CalcView`** = `{ state, select, whenIdle, frames, lastFrameAt, lastAppliedAt, changeFrames, screenBox, engineVisible, axisRange }`.
  - `state()` returns `{ mode, opaque: Set, ghost: Set, hidden: Set, colours: Map, selected: Set, section }` (spec §4.4).
  - `window.__calc.view` = `{ mode, colourKey, selected, section }`.
  - `window.__calc.models[i].spaceIds` is new (for the IfcSpace test).

## Tests

| AC / NFR | Test | Type | Result (file + http) |
|---|---|---|---|
| REQ-005-AC1 | `test/e2e/view-3d.spec.mjs` `@REQ-005-AC1`. No filter: every element with geometry is opaque, mode `ghost`. Filter `REQ-004-AC1` (IfcWallStandardCase OR IfcSlab): `opaque` equals the 17 reference keys exactly, `ghost` = all other elements with geometry. `Ausblenden`: the same set is `hidden`, cross-checked with the engine (`model.getVisible`). Back to `Geist`; reset makes everything opaque again. | e2e, acceptance | pass |
| REQ-005-AC2 | `@REQ-005-AC2`. Filter Geschoss = Erdgeschoss, `Färben nach` Kategorie. `state().colours` covers exactly the opaque elements (ghosts are uncoloured), with one colour per Kategorie and different colours across categories. The legend equals `kategorieCountsOnGroundFloor` (+ the conditional IfcAnnotation), with the elements' colours. The Kategorie filter-set dots equal the legend colours; other sets have no dots. Precedence: a selected coloured element keeps its colour layer and has it again after Escape. `Färbung entfernen`: no colours, no legend, no dots. | e2e, acceptance | pass |
| REQ-005-AC3 | `@REQ-005-AC3`. `Schnitt Z`: `state().section` = `{ axis Z, offset (min+max)/2 of the Z range, flipped false }`. The canvas differs from the uncut view (> 1 % of the pixels). Flip: `flipped true` and a different canvas. The slider moves the offset. `Schnitt X`: mid of the X range. Remove: `null`, and the canvas equals the uncut view again (< 0.5 %). | e2e, acceptance | pass |
| REQ-005-AC4 | `@REQ-005-AC4`. Duplex, `Färben nach` Material: the reference element `2O2Fr$t4X7Zf8NOew3FNld` (two materials) has the `mehrere Werte` colour in `state()`. The legend lists `mehrere Werte` with count 80 = `elementsWithSeveralMaterials` (new reference section `REQ-005-AC4`, STEP-derived), and its colour differs from all value colours. The Material dots equal the legend. | e2e, acceptance | pass |
| REQ-007-AC1, REQ-007-AC5 | `@REQ-007-AC1 @REQ-007-AC5`. The reference wall `3rPX_Juz59peXXY6wDJl18` is isolated with a GlobalId filter set (all others are ghosts and not pickable). A real `page.mouse.click` at the projected centre of its engine bounding box (`getBoxes` + camera projection; further points inside the box as fallback; the centre hit) makes `state().selected` = [wall]. The details show kicker, title, the GlobalId row, and `BaseQuantities` Length / GrossSideArea / NetVolume with the reference values in German format with units. Groups: Allgemein first, type psets last, collapsible. A click on empty canvas clears the selection and shows the placeholder. Escape in the catalogue dialog keeps the selection; Escape then clears it. With the wall as a ghost, the same click does not select it. | e2e, acceptance | pass |
| REQ-007-AC4 | `@REQ-007-AC4`. The IfcVirtualElement `2O1epMSyD6ol5XOFRviRIZ` (`Geometrie = Nein`, reference `conditionalElements`) selected via `CalcView.select`: details with the hint `Dieses Element hat keine 3D-Geometrie.`, kicker and GlobalId. `__calc.view.selected` = key, `state().selected` empty (nothing to highlight), no page error. Escape clears. | e2e, acceptance | pass |
| Render smoke (T4) + P1 | `@e2e @smoke render smoke`: with a wall filter, ghost and hide give different canvases (7.99 % of the pixels). Render on demand: 0 frames in 1.5 s while idle; a mode switch draws; an orbit drag draws and selects nothing. | e2e, smoke | pass |
| REQ-001-AC4 3D side (process-log) | `@REQ-001-AC4 IfcSpace stays hidden`. FZK (7 IfcSpace items). Option off: no space key in `state()`, and `model.getVisible` is false for every space through filter / ghost / hide / ghost / reset / colouring. Option on: the spaces are opaque elements and visible; in hide mode with a wall filter they are hidden. Option off again: out of `state()` and invisible through hide → ghost → reset. | e2e, acceptance | pass |
| DEC-15 logic | `test/unit/colouring.test.mjs` (6 `[unit]` tests). 120 distinct colours, repeating after 120, special colours different from them. The scale gets darker step by step. Kategorie on the FZK snapshot: one colour per category, legend counts = reference `elementsInStepTextByKategorie` minus IfcOpeningElement. Legend inside the REQ-004-AC2 filter = reference, with stable colours. 130 text values → 120 + `Sonstige` (10). Numeric: 24 ranges, first and last bounds, range labels `0 – 2` / `46 – 48`, multi and empty rows, German format. A single numeric value gives one entry; multi / repeated / empty / missing values. | unit | pass |
| NFR-001 (3D part) | `test/perf/view-3d.spec.mjs` `@perf @NFR-001` (file project; numbers below) | perf | pass |

### NFR-001 measurement (3D part; T6 on the volume set)
- **Setup.**
  - Fetched Revit MEP + SampleCastle: 10,459 rows, 10,291 with geometry, 2 models.
  - The clicked value is Kategorie `IfcMember` (1,459 elements), so 8,832 elements change between opaque and ghost / hidden per click.
  - Chromium headless with software WebGL, where one frame takes about 200–280 ms of GPU time, 1440×900.
  - Times are measured in the page from the click event's `timeStamp`. Each value is the median of 3.
- **Columns of the tables.**
  - *state()*: the engine calls of the new display plan are done (`lastAppliedAt`).
  - *first frame*: the first frame drawn because the tiles changed after the click.
  - *complete frame*: the last such frame before the view is idle. This is the asserted "next drawn frame shows the result".
  - *idle*: `whenIdle()`, which waits for two more Fragments refreshes plus a frame; an upper bound.

Final run, inside the full file-project suite:

| Action | filter (ms) | state() (ms) | first frame (ms) | complete frame (ms) | idle (ms) | complete frame per run (ms) |
|---|---|---|---|---|---|---|
| check (ghost) | 2.3 | 28 | 86 | 333 | 727 | 468 / 330 / 333 |
| uncheck (ghost) | 3.1 | 16 | 191 | 196 | 482 | 191 / 348 / 196 |
| check (hide) | 1.6 | 22 | 191 | 196 | 388 | 196 / 265 / 191 |
| check (ghost, coloured by Kategorie) | 2.1 | 31 | 97 | 364 | 631 | 396 / 209 / 364 |

A separate run of the spec alone:

| Action | filter (ms) | state() (ms) | first frame (ms) | complete frame (ms) |
|---|---|---|---|---|
| check (ghost) | 2.6 | 34 | 87 | 382 |
| uncheck (ghost) | 4.3 | 20 | 204 | 204 |
| check (hide) | 1.9 | 29 | 92 | 280 |
| check (ghost, coloured) | 2.2 | 37 | 92 | 362 |

All are within NFR-001 (≤ 500 ms). The test asserts `state()`, the first frame and the complete frame < 500 ms for every action. Before the render-on-demand fixes (an early frame after the calls, no change detection, the rate-limited update), the same test measured 870–1,330 ms; see "Deviations / interpretations".

The TASK-004 robustness test (`click-to-frame`, Name filter on the same set) now measures 18 ms (before: 274–403 ms). The 3D view no longer draws a frame on every animation frame.

## Commands run and results
- `node scripts/check.mjs`: all steps green.
  - format, lint, cdn-cache.
  - test_fast: 69 unit tests pass (63 + 6 new); c8 cv-core 100 % lines / 93.29 % branches; 17 `@integration` on http.
- `npx playwright test --project=http`: 40 passed, 2 skipped (the two perf specs run in `file` only) (1.9 min).
- `npx playwright test --project=file`: 42 passed (2.7 min), including the 100 MB smoke and the new NFR-001 3D perf test.
- `node --test 'test/perf/**/*.test.mjs'`: pass.
- `node scripts/ref/derive-reference.mjs --check`: up to date (after adding the section `REQ-005-AC4`).
- Screenshots for the verifier at 1280×800 and 1920×1080 are in `/tmp/claude-0/-home-user/b4080e59-f4c4-52f1-9269-192eeef60a44/scratchpad/task005-shots/`:
  - `01-loaded`
  - `02-ghost-colour-kategorie` (ground-floor filter, legend, dots)
  - `03-selected-details`
  - `04-hide-section` (Ausblenden + Schnitt Z)
  - `05-numeric-scale` (BaseQuantities.NetVolume ranges, `(leer)`)

## Changes to existing tests and reference data
- `test/e2e/smoke.spec.mjs`: the canvas screenshot style now also hides `#cv-view-bar` and `#cv-legend`, which are drawn over the canvas (it already hid `#cv-overlay`). Without that, the empty-canvas check saw the new toolbar (6.6 % non-background). The assertions are unchanged.
- `scripts/ref/derive-reference.mjs` + `test/fixtures/reference-values.json`: new section `REQ-005-AC4`. It is derived from the Duplex STEP text by `multiMaterialSection()`: the element with exactly two materials and the lowest STEP id with a representation, plus the number of elements with several materials (80). No value was typed by hand.

## Deviations / interpretations
- **`state()` covers elements with 3D geometry only.** Rows with `Geometrie = Nein` have nothing in the engine, so they are in none of the sets. AC1 therefore compares against the rows with geometry; every key of the AC1 filter has geometry, which the test asserts.
- **`state().selected` for an element without geometry** is empty: no highlight call is made. The selection itself is in `__calc.view.selected`, and the details show the hint.
- **Context geometry** (e.g. the IfcSite terrain) is ghosted or hidden while a filter is active. It is not part of `state()` because it is not an element. The spec does not mention it; leaving it opaque contradicts "elements outside the filter are ghosts / hidden" visually.
- **Colours are stable over the row set,** not recomputed per filter. The legend lists only the entries inside the filter, as AC2 requires.
- **Section offset** is in model metres along the IFC axis. "Not flipped" keeps the part below or before the cut.
- **The selection is cleared when the selected element leaves the filter,** as in the reference app's `applyVisibility`.
- **REQ-007-AC1 isolates the wall with a GlobalId filter set** before the real canvas click. Ghosts are not pickable, so the click cannot hit a wall in front of it. The click position is computed from the engine's bounding box (`getBoxes` projected with the camera). In both projects the projected centre hits the wall on the first try.
- **REQ-007-AC4 uses `CalcView.select(key)`**, as the task says. Table row clicks come in TASK-006c and will call the same `select`.
- **Render on demand relies on Fragments internals visible through public members.**
  - `model.tiles` (a DataMap of the tile meshes): used for the change signature.
  - `model.onViewUpdated`, `model.isBusy`, `fragments.settings.maxUpdateRate`.
  - If a later Fragments version changes these, frames could be missed. The render smoke and P1 test would catch a canvas that does not change.
- **`antialias` stays `true`,** as in the reference look (UI-02). Without MSAA, frames in software WebGL are about 30 % cheaper (measured 450–480 ms complete frame before the early-frame fix). The budget is met with antialiasing, so it was not changed.

## Open points
- **TASK-006a:** the table follows `filterView()` and the same `inside` set. Column filters must call `refresh()`, which already drives `sync3d`.
- **TASK-006c:** table row click → `start().select(key)` / `CalcView.select(key)`. A 3D pick must also highlight and scroll to the table row. The hook is `select`; cv-app has no table listener yet.
- **TASK-007:** save and restore `__calc.view.mode`, `colourKey` and `section` with the configuration if wanted. REQ-009 lists the filter / table state; whether the view mode and colouring belong to the configuration is not specified.
- **TASK-010:** NFR-001 at ≥ 30k elements. The 3D part here was measured at 10k: complete frame 196–382 ms.

## Orchestrator verification
- Independent verification in fresh context: PASS, 14/14 items (REQ-005-AC1..AC4, REQ-007-AC1/AC4/AC5, `CalcView.state()` derived from engine calls only, IfcSpace hidden at 10/10 checkpoints, 0 frames while idle, 10k filter click to last changed frame 196-497 ms).
- Accepted decisions not in the spec: geometry-only `state()`, context geometry (IfcSite terrain) follows ghost/hide, colours stable across filter changes, blue numeric scale, selection cleared when the element leaves the filter.
- Follow-ups (non-blocking), assigned:
  - L1 legend is an overlay over the bottom of the 3D view and `Ansicht einpassen` ignores it; the spec says "legend under the model" -> place it below the canvas (TASK-006a, layout pass).
  - L2 legend text 12 px; UI-02 asks for 13-14 px (TASK-006a).
  - L3 terrain keeps its green while colouring is on and resembles a legend colour -> render context geometry neutral grey while `Färben nach` is active (TASK-006a).
  - L4 toolbar wraps to two rows at 1280 px with colouring or section active (TASK-006a).
  - P2 thin margin (497 ms at 10k); NFR-001 at 30k in TASK-010, consider antialias off or cheaper frames there.
- TASK-005 done.

## Verification INC-1 (2026-11-03)
- **CODE F1, fixed:** removed Fragments models were kept alive by two Maps keyed by the model (`signatures`, `refreshCount`), one model per load/remove cycle. Both are `WeakMap`s now and `removeModel` deletes the entries. New test seam `CalcView.liveModels()` (WeakRef per loaded model). Test: `@robustness @REQ-001 repeated load and remove of a model frees every removed model` (`test/e2e/memory-robustness.spec.mjs`, fails before the fix with 1 retained model).

## Verification INC-2 (2026-11-05)
- **As built after CR-002 (SYNC-7):** the follow-up L1 above (legend overlay, `Ansicht einpassen` ignoring it) is superseded. CR-002 removed the legend under the model and the button `Ansicht einpassen`: the legend is in the colouring panel (`Färben`, TASK-016) and `Fokus` fits the elements shown opaque (TASK-014 / TASK-015a). L2 (legend text size) carries over to the panel legend (13 px, TASK-016 decision 3); L3 (terrain colour) is unchanged.
