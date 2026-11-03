---
id: TASK-009
title: Viewer file export (skeleton, payloads, bootstrap, viewer mode, offline start)
type: feature
status: done (verification pending)
implements: [REQ-010, REQ-010-AC1, REQ-010-AC2, REQ-010-AC3, REQ-011-AC1 (viewer part), NFR-003, NFR-005, CON-003, DEC-7]
relates_to: [REQ-003, REQ-004, REQ-005, REQ-006, REQ-007, REQ-008, REQ-009, REQ-011, NFR-002, TASK-007, TASK-008, TASK-010]
depends_on: [TASK-006c, TASK-008]
touches: [calc-viewer-builder.html (cv-core-src, cv-ui-src, cv-app-src, cv-viewer-bootstrap, cv-builder), test/support/viewer.mjs, test/unit/viewer.test.mjs, test/e2e/viewer.spec.mjs, test/perf/viewer.spec.mjs]
---
# TASK-009: Viewer file export

## What was built

### cv-core (pure, unit-tested; spec 4.2, 4.4 `encodeTable` / `decodeTable`)
- **`encodeTable(models)` / `decodeTable(table)`** (`TABLE_VERSION` = 1): the element table of the viewer file.
  - Property keys and text values are stored once, in dictionaries in order of first use. Equal input gives equal output.
  - Every row is `[localId, guid index | -1, geometry 0 | 1, [key * 4 + code, payload, ...]]`. The codes are text, number, multi (string list) and other (`{ v }` as JSON, `{ z: 1 }` for -0, which JSON cannot carry).
  - Per model: `id`, `name` (Modell), `fileName`, `spaceIds`, `contextIds`, `properties` and `spaceProperties` (the createExtractor metadata with `kinds` / `units` sets). The viewer rebuilds the catalogue with the same `buildCatalog`, so kinds, units, `gemischt` and groups match the builder.
  - The row key `<modelId>:<localId>` and `model` are rebuilt from the model id, so keys equal the builder's keys.
  - On FZK the encoded table is less than half the plain rows JSON; for the volume set (30,931 rows) the gzip payload is part of the 23.5 MiB file below.
- **`viewerHtmlParts(input)`**: the fixed skeleton (spec 4.2, never the live DOM) as Blob text parts:
  `<!doctype html>`, `meta charset`, viewport, `meta generator` (`Calc Viewer Builder (That Open Fragments 3.4.7, three 0.185.1, web-ifc 0.0.77)`, spec 4.1), `meta cv-exported` (ISO export time), `<title>`, `<style id="cv-css">`, the payload elements `<script type="application/octet-stream" id="cv-payload-…">` (Base64), the helpers script (`tovLinkModules`) and `cv-viewer-bootstrap`.
  - Title and meta values are HTML-escaped (`escapeHtml`: `& < > " '` as numeric references).
  - It refuses a css part with `</style`, a script part with `</script` or `<!--`, and a payload that is not Base64 (error names the part).
  - The source never contains a literal `<script` or `<!--`: inside the builder's `text/plain` block that would switch the HTML parser into the escaped script states.
- **`bytesToBase64`** (chunked, multiple of 3), **`gzipBytes`** (`CompressionStream('gzip')`, deterministic), **`VIEWER_PAYLOAD`** (payload ids).

### cv-builder (spec 4.2: HTML export is builder-only)
- **`buildViewer(lib, data, pause)`** assembles the file from gzip + Base64 payloads:
  - `cv-payload-runtime`: `{ sources, aliases, worker, versions }`. The sources are every crawled library module, with web-ifc (3.5 MB) replaced by a stub (`makeWebIfcStub`, ref L2070-2084: constants keep their values, functions throw), plus cv-core / cv-ui / cv-3d / cv-app. The aliases are the builder's (`calc-core`, `calc-ui`, `calc-3d`, `@thatopen/fragments`, `three`, OrbitControls). `worker` is the classic Fragments worker source. Built once per session and reused, so two exports share the same bytes.
  - `cv-payload-table`: `encodeTable` of the loaded models.
  - `cv-payload-config`: `{ config: CalcConfig.state(), includeSpaces }`. The configuration includes the header (title, date and logo as shown).
  - `cv-payload-model-<i>`: the `.frag` bytes of each model.
  - Progress: `<Dateiname> – HTML exportieren: n %` (runtime 20 %, table 40 %, models up to 90 %).
- **Kept `.frag` bytes.** Fragments transfers the bytes it loads to its worker, so `fragBytes` was detached after `engine.loadModel` (the first export failed with `Modelldaten fehlen`). `loadOne` now gives the engine a copy (`converted.bytes.slice()`) and keeps the original for the export. Cost: one `.frag` copy per model (spec 4.8: 7–16 % of the IFC size). The 100 MB load smoke still passes (see below).

### cv-viewer-bootstrap (classic script; ASCII, no closing tag)
- Reads the payloads (`atob` → `DecompressionStream('gzip')`), frees each payload text after decoding, links the runtime with `tovLinkModules`, makes the Fragments worker a classic Blob worker and calls `start({ mode: "viewer", root, workerUrl, viewer: { models: decodeTable(table), frags, config, includeSpaces } })`.
- Without `DecompressionStream`: `Dieser Browser wird nicht unterstützt. Bitte einen aktuellen Browser verwenden.`. Any start error: `Die Viewer-Datei konnte nicht gestartet werden: <Grund>` (hook `phase: "error"`).
- No `fetch`, no storage API, no network URL: every module, the worker, the models and the data are in the file (NFR-005, CON-003).

### cv-app / cv-ui
- **`HTML exportieren`** (`#cv-html-export`, builder only) calls `exportViewerFile()`:
  - A busy action (`phase: "exporting"`) with the progress overlay; loads, configuration, table exports and the button itself are disabled while it runs.
  - File name `safeFileName(title, date, ".html")` → `<Titel>_<YYYY-MM-DD>.html`; MIME `text/html;charset=utf-8`.
  - Enabled only with a loaded model and no running action, like the other exports. Tooltip `Modelle, Daten und aktuelle Ansicht als Offline-Viewer (HTML) exportieren`, without a model `Zuerst ein IFC-Modell laden.`
  - Error: `Der HTML-Export ist fehlgeschlagen (<Grund>).`
  - Seam `window.__calc.viewerExport` = `{ count, last { ok, fileName, bytes, models, rows, ms } | { ok: false, fileName, message, ms } }`; `start()` returns `exportViewerFile`.
- **Viewer mode** (`start({ mode: "viewer", viewer })`, `openViewer`):
  - Loads each embedded `.frag` with the same model id as in the builder, hides the IfcSpace items unless the builder showed them, takes the embedded rows (no extraction, DEC-7), publishes, then applies the exported configuration with `applyConfiguration` (its notice is shown if anything were skipped). `phase` becomes `ready` only after that.
  - The existing mode switch of cv-ui already leaves out `IFC laden`, the file inputs, `Konfiguration speichern` / `laden`, `HTML exportieren`, the header edit button, the remove buttons of the model list and the IfcSpace option; files dropped on the page are ignored (drop handler builder only). `CalcConfig.loadText` is `undefined` in the viewer.
  - Offered: filter sets (add, move, collapse, remove, values), column filters, columns (add, move, width, remove), sort, grouping (view, levels, expand), model display (ghost / hide, colouring, section), selection and details, `Export CSV` / `Export Excel` (the TASK-008 code, so the files equal the builder's).
  - Nothing is persisted: reopening shows the exported state.
  - Seams: `__calc.mode` (`builder` | `viewer`), `__calc.viewer.startMs` (navigation start → ready), `__calc.versions` from the runtime.

## Tests

| AC / item | Test | Type | Result (file + http) |
|---|---|---|---|
| REQ-010-AC1, REQ-011-AC1 (viewer header), NFR-005, T3 | `test/e2e/viewer.spec.mjs` `@acceptance @system @e2e @REQ-010-AC1 …`. **Builder:** fzk-export + Duplex; title `The M Bouwkundig`, date 2026-08-12, SVG logo; filter set `Typ` added and moved up, `Material` collapsed, Kategorie = IfcWallStandardCase (69 elements, `REQ-008-export`); columns Material and Zahl, sorted by Zahl; `Ausblenden`, `Färben nach: Geschoss`, `Schnitt Z`. **File:** `The M Bouwkundig_2026-08-12.html`; generator meta with the versions; `<title>`; no `src`/`href` to `http(s):` or `//`, no jsDelivr URL; the builder state unchanged by the export. **Viewer** (file://, new offline context, every request aborted and logged): no error, `mode: "viewer"`, versions; title; everything a viewer shows equals the builder: `configuredState` (table, grouping, filter sets with checked values and collapsed state, column filters, display, header, filter result, `CalcView.state()` opaque / ghost / hidden / colours / section), models, rows, catalogue, table order and count, `CalcConfig.state()`, status line, filter-set titles, header keys; Material body hidden; the wall value checked; status `69 von <n> Elementen`; table rows shown; overlay hidden; header title, German date and the logo `<img>` data URL; canvas shows geometry (> 1 % non-background pixels). **Request log empty, nothing blocked, no page error.** | acceptance, system, e2e | pass |
| REQ-010-AC2, REQ-011-AC1 (viewer CSV name), T4 colleague flow | `@acceptance @e2e @REQ-010-AC2 …`. Builder and viewer (exported from the default view of fzk-export + Duplex) get the same actions: Kategorie = IfcWallStandardCase, add / move up `Typ`, remove `Material`; add Material / Zahl / Text, move Material left, sort Zahl descending; CSV of the single view; `Gruppiert` with level 2 Geschoss, expand IfcWallStandardCase; `Ausblenden`, `Färben nach: Material`; CSV and Excel. **Asserted:** viewer state equals builder state after the actions; file names `The M Bouwkundig_2026-08-12.csv` / `.xlsx`; **all three files byte-equal** to the builder's; independent reader (`read-export.py`): 69 data records in the single CSV, the IfcWallStandardCase group row with count 69, `Summe;;69` last, Excel row count = CSV record count. **Reload:** the viewer shows the exported state again (not persisted); no request. | acceptance, e2e | pass |
| REQ-010-AC3 | `@acceptance @e2e @REQ-010-AC3 …`: the builder has the four buttons; the viewer has none of `IFC laden`, `Konfiguration speichern`, `Konfiguration laden`, `HTML exportieren`, `Titel, Datum und Logo bearbeiten`, `Modell entfernen: …`, no `input[type=file]`, no IfcSpace checkbox, `CalcConfig.loadText` undefined. Offered and enabled: `Export CSV`, `Export Excel`, `+ Filtersatz`, `Spalten`, `Gruppiert`, `Ausblenden`. A row click selects the element (hook, `CalcView.state().selected`, details show its GlobalId). An IFC and a configuration file dropped on the page change nothing (`loads`, model count, `config.loads` 0). | acceptance, e2e | pass |
| T7 export with 0 models | `@robustness … needs a model`: disabled with tooltip `Zuerst ein IFC-Modell laden.` before the first model, enabled with the export tooltip after FZK, disabled again after removing it; `viewerExport` count stays 0. | robustness, e2e | pass |
| T7 filter + grouping active; two exports in a row | `@robustness … grouping view with filters active …`: FZK, Geschoss = Erdgeschoss, `Gruppiert` Kategorie / Geschoss, IfcWallStandardCase expanded. Two exports: equal file name, the texts equal after removing the `cv-exported` meta line (which matches an ISO time). The viewer starts in the grouping view with the filter: state equal to the builder except the expanded rows (not part of a view, REQ-009); the IfcWallStandardCase group shows the reference count of ground-floor walls (`REQ-006-grouping-fzk`) and is collapsed. | robustness, e2e | pass |
| T7 very long title, SVG logo with script | `@robustness … very long title …`: a 200-character title (the dialog limit) with `</script><b onmouseover="x">&amp; "…"`, and an SVG logo with `<script>` and `onload`. **File:** download name = the product's name, ends `_2026-08-12.html`, no characters forbidden in file names; one `</script>` per `<script`; no `<b onmouseover`; `<title>` escaped. **Viewer:** page title and `#cv-title` show the exact text, no `<b>` element; the logo `<img>` decodes; `window.__svgRan` stays undefined in viewer and builder; the viewer's CSV is named like the HTML file with `.csv`. | robustness, e2e | pass |
| cv-core | `test/unit/viewer.test.mjs` (6 tests): `encodeTable` / `decodeTable` round trip of the FZK rows snapshot as two models (rows, properties, ids; at most half the plain JSON; deterministic); every value type (texts with markup / quotes / CR LF / non-ASCII, tiny / huge / negative numbers, 0 and -0, multi incl. empty and mixed, null, boolean, odd keys, no guid, undefined dropped); unknown version refused. `escapeHtml`; `bytesToBase64` against `Buffer` at chunk boundaries; `gzipBytes` deterministic and inflated by Node zlib. `viewerHtmlParts`: skeleton order, escaped title and metas, payload ids, one closing tag per script; refuses `</style`, `</script`, `<!--` and non-Base64. The real `cv-css` and `cv-viewer-bootstrap` are ASCII and free of closing tags; the five embedded blocks use no `localStorage` / `sessionStorage` / `indexedDB` / `fetch(` / `XMLHttpRequest` / `WebSocket` / `sendBeacon` (CON-003, NFR-005) and contain no literal `<script` / `<!--`. | unit | pass |
| NFR-003, NFR-005 (large) | `test/perf/viewer.spec.mjs` `@perf @NFR-003 @NFR-005 @REQ-010` (file project), per set: export, then 3 offline opens; each open asserts rows, `CalcConfig.state()` and filter count equal to the builder, request log empty. Results below. | perf | pass |
| Request logger | Probe (not committed): `fetch('https://cdn.jsdelivr.net/…')` and an `<img>` to `http://127.0.0.1:9/` in an opened viewer were both logged and blocked, so an empty log is meaningful. | – | done |

### NFR-003 measurements (Chromium headless, software WebGL, file project, 1440×900; Node 22.23.4)

*ready* = navigation start → `phase: ready` (models shown, table and filters), page clock. *usable* = ready and the 3D view idle (complete frame drawn). Median of 3 opens.

| Set | IFC | Rows | Viewer file | Ratio | Export (click → download) | ready | usable (median / max) | Peak JS heap |
|---|---|---|---|---|---|---|---|---|
| AC20-FZK-Haus | 2.5 MiB | 99 | 1.3 MiB | 54.7 % | 188 ms | 0.90 s | 1.25 / 1.28 s | 31.6 MB |
| Duplex Architecture | 2.3 MiB | 218 | 1.3 MiB | 58.6 % | 218 ms | 0.82 s | 1.14 / 1.15 s | 29.8 MB |
| Volume set (4 × Revit MEP + SampleCastle) | 158.3 MiB | 30,931 | 23.5 MiB | **14.8 %** | 1,320 ms | 6.85 s | **8.90** / 10.93 s | 77.6 MB |

- Budgets (NFR-003, viewer file from ≥ 100 MB of IFC): ≤ 40 % of the IFC size, usable ≤ 15 s. Both met on the volume set.
- The small models are above 40 %: the embedded runtime is fixed at about 1.0 MB Base64 (three, Fragments, the classic worker, OrbitControls, the web-ifc stub, the app). FZK file: runtime 1,017,072 B, table 54,236 B, configuration 404 B, model 287,692 B. Recorded, not asserted (the NFR names ≥ 100 MB).
- Export in the builder of the volume set: 1.3 s.

## Commands run and results
- `node scripts/check.mjs`: green (format, lint, cdn-cache, 115 unit tests with the cv-core coverage gate, 21 `@integration` tests on http).
- `npx playwright test test/e2e/viewer.spec.mjs test/e2e/smoke.spec.mjs test/e2e/export.spec.mjs --workers=3` (both projects): 28 passed.
- `npx playwright test test/e2e/config.spec.mjs test/e2e/selection.spec.mjs test/e2e/view-3d.spec.mjs test/e2e/filter-area.spec.mjs test/e2e/layout-followups.spec.mjs --workers=3`: 70 passed.
- `npx playwright test test/e2e/table.spec.mjs test/e2e/grouping.spec.mjs test/e2e/table-robustness.spec.mjs test/e2e/grouping-robustness.spec.mjs test/e2e/filter-robustness.spec.mjs --workers=3`: 48 passed.
- `npx playwright test test/acceptance test/integration --workers=3`: 50 passed.
- `npx playwright test test/perf/viewer.spec.mjs --project=file`: 3 passed (FZK, Duplex, volume set; numbers above).
- `npx playwright test test/perf/load-100mb.spec.mjs --project=file`: passed (127.7 MB set, 37.3 s, peak heap 181 MB), after the `.frag` copy change in `loadOne`.
- Not run: the other perf specs (table, grouping, view-3d, view-3d-volume, selection, export). The change touches no code they measure besides the `.frag` copy at load.

## Changes to existing tests and reference data
- None. No existing test, fixture or reference section changed. Expected counts in the new tests come from `reference-values.json` (`REQ-008-export`, `REQ-006-grouping-fzk`); everything else compares the viewer with the builder, which is how REQ-010-AC1/AC2 are worded.

## Deviations / interpretations
- **The viewer offers no configuration save / load.** The spec says so (REQ-010, §3 Out of scope); the task text allowed it only "if the spec allows". Colleagues can still reorder filter sets and columns and change the grouping (REQ-003, REQ-006 in the viewer).
- **"Two exports identical except date"** is met as: the files differ only in `<meta name="cv-exported">` (the export time). Everything else is byte-identical (deterministic gzip, dictionaries in order of first use, runtime built once per session).
- **The export time meta** is the only time in the file; the header date is the configuration's date.
- **Payloads are gzip + Base64 in `application/octet-stream` script elements** (as the reference app); the configuration is gzip'ed too, so no JSON text of the user's data is in the HTML (no `</script>` escaping needed).
- **Start in the viewer:** `phase: "ready"` only after the models, rows and configuration are in place; the overlay shows `Anzeige` per model meanwhile.

## Decisions to confirm
- **The viewer shows the header date of the export.** When the builder's date was the default (today), the viewer shows the export day, not the colleague's today (conservative reading of "exported state", REQ-010). The title is frozen the same way (it equals the first model's Modell anyway).
- **The IfcSpace option travels with the file.** The viewer shows spaces only if the builder showed them at export; the viewer has no IfcSpace option (it is a builder control, like loading). The space rows are in the file either way.
- **Expanded groups and the selection are not exported** (REQ-009 leaves the expanded state out; the viewer starts with groups collapsed). Layout split and collapsed details panel are not exported either (not part of the configuration).
- **Files dropped on the viewer are ignored** (no IFC or configuration loading in the viewer, REQ-010-AC3).
- **NFR-003's size target is applied to viewer files from ≥ 100 MB of IFC only**, as written. Small models give 55–59 % because of the fixed ~1 MB runtime.
- **`HTML exportieren` needs a loaded model** (like `Konfiguration speichern` and the table exports): a viewer without a model would show nothing.

## Open points
- **Non-ASCII download names in headless Chromium.** A blob download whose `download` name contains any non-ASCII character (e.g. `ä`) is reported by headless Chromium as `download` (probe: 5 × `ä` already). This affects every export (CSV, Excel, JSON, HTML) with an umlaut title, not only TASK-009; the product's intended name is correct in the hooks (`export.last.fileName`, `viewerExport.last.fileName`). The long-title robustness test therefore uses an ASCII title. To check manually in Chrome / Edge at release (T12); if real Chrome does the same, a later change could transliterate or percent-encode the name.
- **Builder memory:** one extra `.frag` copy per model (7–16 % of the IFC size) for the export (TASK-010, NFR-002 peak heap).
- **Viewer start of the volume set:** 6.7–9.6 s to ready, one open 10.9 s usable. Most of it is the Fragments model load of 5 models; TASK-010 can measure the split (decode vs load vs first frame) if the margin to 15 s must grow, and measure the synthetic 151 MB single IFC.
- **Firefox** not tested (DEC-8, ASM-007). The viewer needs `DecompressionStream` and classic Blob workers.
- **Spec §5/§6** (status of TASK-009, testing results) are for the orchestrator to update.

## Orchestrator verification
- Independent verification in fresh context (resumed after a container restart): VERDICT PASS (REQ-010-AC1..AC3, NFR-005 zero requests with all network blocked, NFR-003 volume set 14.8 % / 8.9 s median, break attempts, XSS in names/title/logo inert, visual review).
- Decisions to confirm (release gate): header date is the export date; IfcSpace setting travels with the file without a switch; expanded groups, selection and panel layout not exported; dropped files ignored in the viewer; `HTML exportieren` needs a model.
- Follow-ups (TASK-010): V1 a truncated viewer file stays at `Viewer wird geladen ...` forever -> timeout with a German error; V2 a corrupted payload shows English browser text (`Failed to fetch`) -> German message; V3 unused external URLs inside the bundled libraries (never requested) -> strip or document for NFR-005; small models give 55-59 % file ratio (fixed ~1 MB runtime; NFR-003 applies to >= 100 MB).
- TASK-009 done.

## Verification INC-1 (2026-11-03)
- **UX minor 3, fixed:** while the viewer file starts it shows the exported header (title from the configuration, else the first model's name; the exported date) instead of `Calc Viewer Builder`; the model list and the filter sets stay hidden until the payload is applied (`cv-starting`); the progress names the model (`AC20-FZK-Haus`), not an `.ifc` file the viewer does not contain. Test: `@e2e @REQ-010 @REQ-011 while the viewer starts ...` (`test/e2e/viewer.spec.mjs`).
