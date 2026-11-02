---
id: TASK-001b
title: Walking skeleton (builder links modules, converts one IFC, shows it in 3D)
type: feature
status: done
implements: [CON-002, REQ-001]
relates_to: [CON-001, CON-002, REQ-001, DEC-10, DEC-13, R-1]
depends_on: [TASK-001a]
touches: [calc-viewer-builder.html, test/e2e/smoke.spec.mjs, test/unit/drift-guard.test.mjs]
---
# TASK-001b: Walking skeleton (builder links modules, converts one IFC, shows it in 3D)

## What was built
- `calc-viewer-builder.html` now has the spec §4.2 block structure with working content:
  - `cv-css`: light layout using the reference colours: a 56 px header with a red left border, filter area 280 px, centre split 55/45 between the 3D view and the table, details panel 320 px, and a status line. Below 1280 px the side panels collapse.
  - `cv-core-src`: `EXPECTED_THREE = "0.185.1"`, `EXPECTED_WEBIFC = "0.0.77"`, and the pure functions `packageVersions(keys, pkg)` and `checkLibraryVersions(keys, expected?)`.
    - The drift guard requires exactly one three version and one web-ifc version, and both must match the expected ones.
    - Otherwise it throws `Unerwartete Bibliotheksversion von jsDelivr: <lib> <found> statt <expected>.`. `<found>` is comma-separated when there are several versions and `keine` when none is found.
  - `cv-ui-src`: `renderLayout(root, {mode, title})` builds the whole screen in the DOM (needed later for the viewer file).
    - Header: title, date, `IFC laden` with the hidden `#cv-file-input`, and disabled placeholders `Konfiguration speichern`, `Konfiguration laden`, `HTML exportieren`.
    - Placeholders for filters, table and details, the overlay, and the status line.
  - `cv-3d-src`: `createEngine(container, workerUrl)` starts three, OrbitControls and `FragmentsModels(workerUrl, {classicWorker: true})` with the reference's polygon offset (ref L760-816).
    - `loadModel(bytes, modelId)` loads the model, fits the camera and returns the count of items with geometry.
  - `cv-app-src`: `start({mode, root, workerUrl, convert})` connects UI, 3D and file input, and maintains the test hook `window.__calc`.
    - The hook holds `{phase, models:[{id,name,elements}], modelCount, elementCount, error, versions}`.
    - A failing file is reported in the overlay, and the next file continues.
  - `cv-viewer-bootstrap`: empty (TASK-009).
  - `cv-builder` (real inline module):
    - `tovLinkModules` is copied from ref L163-192.
    - The crawler and `toClassicWorkerSource` are copied from ref L2042-2068. The fragments `+esm` graph is crawled, then the drift guard runs (from cv-core, linked as `calc-core`).
    - OrbitControls is crawled from the three key that was found, and the drift guard runs again so that OrbitControls cannot pull in a second three.
    - Aliases: `three`, `@thatopen/fragments`, `three/addons/controls/OrbitControls.js`, `calc-core`, `calc-ui` and `calc-3d`.
    - The classic conversion Blob worker is built as `tovLinkModules.toString()` plus `convertWorkerMain.toString()` (ref L1940-1981). It runs `IfcImporter` with the absolute web-ifc wasm path and without IfcSpace (DEC-13 default).
    - One worker per file, terminated afterwards (ref L2186-2205).
- `test/e2e/smoke.spec.mjs` (`@smoke @REQ-001`) runs in projects `file` and `http` with the network guard active. It checks:
  - start without page errors, the versions `{3.4.7, 0.185.1, 0.0.77}`, and that the layout regions are visible;
  - after `setInputFiles` with `AC20-FZK-Haus.ifc`: `modelCount === 1`, `elementCount > 0`, the status line, and that the overlay is hidden;
  - the canvas pixel sample (screenshot decoded in the page): under 1 % non-background before loading, over 5 % after;
  - that the wasm and the fragments worker were served from the cache, and that no request was blocked.
- `test/unit/drift-guard.test.mjs`: 7 `[unit]` tests covering:
  - accepted graph;
  - wrong three version and wrong web-ifc version, each giving the exact German message;
  - two three versions, a missing library (`keine`) and explicitly passed expected versions;
  - package prefix isolation.

## R-1 (FragmentsModels.load under file://): resolved
- With the reference pattern (`FragmentsModels(blobUrl, {classicWorker: true})`, the worker source converted to a classic script, every module linked to Blob URLs), the FZK house loads and renders under `file://`, the same as under http.
- **Root cause of the spike hang:** I ran a probe with a copy of the builder changed only to `classicWorker: false`, opened via `file://`.
  - Fragments then creates a *module* worker from a `blob:null/...` URL. It does not start, and no error event or page error appears.
  - `FragmentsModels.load` waits forever (`phase` stayed `loading`, `modelCount` 0 after 25 s).
  - This matches spec §4.8 ("module workers from Blob URLs fail under file://"). The spike page had not used `classicWorker: true`.
  - The probe was in the scratchpad (`r1-probe/`) and was not committed.
- No srcdoc fallback is needed.

## Files
- `calc-viewer-builder.html` (rewritten from the TASK-001a placeholder)
- `test/e2e/smoke.spec.mjs` (replaces the placeholder smoke test)
- `test/unit/drift-guard.test.mjs` (new)
- `docs/tasks/TASK-001b.md` (this record)

## Commands run and results
- `npx prettier --write calc-viewer-builder.html test/e2e/smoke.spec.mjs test/unit/drift-guard.test.mjs`: ok.
- `npx eslint --max-warnings 0 .`: exit 0.
- `node --test 'test/unit/**/*.test.mjs'`: 16/16 pass.
- `npx playwright test --grep @smoke`: 2/2 pass (file 4.4 s, http 4.5 s).
  - 83 elements with geometry.
  - Canvas non-background share 0.102 after loading (0.000 before).
- `npx playwright test --grep @smoke --repeat-each=3`: 6/6 pass.
- R-1 probe (`classicWorker: false`, `file://`): load timed out after 25 s with no error. This confirms the root cause above.
- `node scripts/check.mjs --all`: all steps green.
  - Format, lint and cdn-cache all pass.
  - Unit 16/16, cv-core line coverage 100 %.
  - `@integration` on http 2/2.
  - Playwright 6/6 across `file` and `http`.
  - Node perf: 0 tests.

## Deviations
- `tovLinkModules` and the conversion worker body live as functions inside `cv-builder`; the worker source is generated with `Function.prototype.toString()`. There is no separate `tov-runtime-lib` or `tov-convert-worker-src` text block as in the reference. TASK-009 can serialise `tovLinkModules` into the viewer file the same way. This is a refinement that stays within §4.2 ("cv-builder: linking via tovLinkModules, conversion worker").
- Additional internal aliases `calc-ui` and `calc-3d` (keys `cv-ui` and `cv-3d`) let `cv-app` import its siblings.
- `elementCount` is currently the number of items with geometry in the fragments model (`getItemsIdsWithGeometry`). TASK-002 replaces it with the real element extraction (including elements without geometry).
- The layout is built by `cv-ui` in JavaScript, not written as static HTML in `<body>`, because the viewer file is generated from a fixed skeleton and not from the live DOM (spec §4.2).

## Open points
- If a module worker cannot start, `FragmentsModels.load` hangs with no error. The builder always uses `classicWorker: true`, but a load watchdog (timeout leading to a classified error) could be added in TASK-002 or TASK-010 as robustness (T7).
- Progress is shown as plain overlay text (phase, percentage). The stage-labelled progress overlay and the classified load errors come in TASK-002.
