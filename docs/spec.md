---
status: draft
date: 2026-11-02
relates_to: [C01, C02, C03, C04, C05, C09, FUN-01, FUN-02, FUN-04, DAT-01, QLT-01, UI-01, UI-02, STK-01, ASM-001, ASM-002, ASM-003, ASM-004, ASM-005]
---
# Specification — Calc Viewer Builder

Lean track (tier S): requirements, design and tasks in one file.
**Baseline sections** (change via CR once approved): 1–4. **Working sections** (change freely): 5–7 and the change history.
Sources: `docs/intake/answers.md` (IDs in brackets), `docs/intake/modelviewer-analysis.md` (reference app), spike results in §4.8.

## 1. Goal

A browser tool for BIM specialists (BIM coordinators, cost estimators, project members) to explore one or more IFC models like a PowerBI report. Freely chosen filter sets narrow down the 3D model and a configurable quantity table. The table can be exported as CSV or Excel. The whole view can be saved as a configuration and handed to colleagues as one offline HTML file that they can still adjust (C01, C02, F-02).
**Success** (C09): real projects' quantity overviews are built with the tool and shared with colleagues. Long-lived tool, maintained by the user.

Terms used below:
- **Builder** — the HTML file the author opens to load IFC files, configure and export.
- **Viewer file** — the offline HTML file the builder exports for colleagues.
- **Element** — one IFC product occurrence (row in the single-element view).
- **Property** — any value of an element that can be a filter set or a column (§4.3).
- **Filter set** — a facet panel on the left listing the values of one property.

## 2. Requirements

Priorities from FUN-04: must = UC 1, 2, 3, 5, 7, 8, 9; should = UC 4, 6; ASM-002 (title/logo) = should.

### REQ-001: Load IFC models
- Priority: must · Source: UC 1, C05, DAT-01
- The builder shall load one or more IFC files (IFC2X3, IFC4) via a file picker and drag and drop, convert them in the browser, and show progress per file.
- Several models are combined into one view; the property `Modell` (file name without extension) identifies each element's model.
- More files can be added later; a model can be removed again.
- REQ-001-AC1: Given the builder is open, When the user selects two valid IFC files, Then both models are shown in 3D, the status shows the element count per model, and the filter set `Modell` (if configured) lists both file names with their element counts.
- REQ-001-AC2: Given a file that is not a valid IFC (e.g. a renamed PDF, a truncated IFC), When it is loaded, Then a German error message names the file and the reason, the other models stay loaded, and the page remains usable.
- REQ-001-AC3: Given a loaded model, When the user removes it, Then its elements disappear from 3D, filter sets and table.
- REQ-001-AC4: Given an option `Räume (IfcSpace) einbeziehen` (default off, as in the reference app), When it is off, Then IfcSpace elements are neither shown nor listed.

### REQ-002: Extract all IFC data per element
- Priority: must · Source: DAT-01, ASM-005
- For every element the builder shall extract: IFC class (`Kategorie`), direct attributes (`Name`, `GlobalId`, `ObjectType`, `Tag`, `PredefinedType`, `Description`), all property sets and quantity sets of the element, all property sets of its type object, the type name (`Typ`), the storey (`Geschoss`), the material(s) (`Material`) and the model (`Modell`).
- Elements are listed by IFC class (not only those with geometry); spatial structure elements (project, site, building, storey) and type objects are not rows.
- Rules:
  - Property identity is `<Pset name>.<Property name>`; for attributes and the special properties above it is the German label.
  - When the same property exists on the occurrence and its type, the occurrence value wins (IFC semantics); the type value fills gaps.
  - `Geschoss` = nearest IfcBuildingStorey ancestor in the spatial tree (also through aggregation); empty if none.
  - `Material` is multi-valued: all materials from IfcMaterial, layer sets, constituent sets, profile sets and lists of the element, else of its type.
  - Numeric IFC measure values (length, area, volume, count, weight, numeric ratio, …) are numbers; labels, texts and identifiers stay text even if they look numeric. Booleans are shown as `Ja` / `Nein`.
  - Length, area and volume values in SI units with prefixes (e.g. mm, cm²) are converted to m, m², m³ using the model's IfcUnitAssignment; the column header shows the unit (`(m)`, `(m²)`, `(m³)`). Other numeric values keep their project unit.
  - Elements without 3D geometry after conversion are rows like all others and carry the marker `ohne Geometrie` (visible in the details panel and as a filterable property `Geometrie` = `ja` / `nein`).
- REQ-002-AC1: Given the fixture `AC20-FZK-Haus.ifc`, When it is loaded, Then for the reference elements listed in the test data set (§4.7) Kategorie, Name, GlobalId, Typ, Geschoss, Material and at least one quantity have exactly the expected values.
- REQ-002-AC2: Given an element whose quantity `Qto_WallBaseQuantities.Length` is stored in mm, When it is shown, Then the value is in m and the column header reads `… (m)`.
- REQ-002-AC3: Given an element with a property on both occurrence and type, Then the occurrence value is shown; Given only the type has it, Then the type value is shown.
- REQ-002-AC4: Given an element with a layered material, Then `Material` lists every layer material once, and filtering by any one of them matches the element.
- REQ-002-AC5: Given an IfcLabel value `"1.5"`, Then it is text (left-aligned, not summed).

### REQ-003: Configure filter sets
- Priority: must · Source: UC 2, C00
- The user shall add a filter set for any property via a searchable property catalogue (grouped by pset, with the number of elements having a value), reorder filter sets by drag and drop or up/down buttons, collapse and remove them.
- Default for a new configuration: filter sets `Kategorie`, `Geschoss`, `Material`.
- REQ-003-AC1: Given a loaded model, When the user searches `Length` in the catalogue and adds `Qto_WallBaseQuantities.Length`, Then a new filter set with that title appears at the bottom of the filter area.
- REQ-003-AC2: When the user moves a filter set up/down or removes it, Then the order/removal is visible immediately and is part of the saved configuration (REQ-008).

### REQ-004: Filter with filter sets
- Priority: must · Source: UC 3, FUN-02, FUN-x1, C00
- Each filter set lists the distinct values of its property with a checkbox, a colour dot (when the model is coloured by that property) and the element count. Values are sorted alphabetically (numbers numerically); empty values appear as `(leer)` at the end.
- Several checked values within one filter set combine with OR; filter sets combine with AND. Column filters of the table (REQ-006) also combine with AND.
- After any change, every filter set shows only values that still have hits under all *other* active filters, with counts recomputed under those filters; its own checked values and their siblings stay visible.
- A filter set header shows the number of active values and a reset button; a global `Alle Filter zurücksetzen` clears all filters.
- Filters affect the 3D model (REQ-005) and the table (REQ-006) together.
- REQ-004-AC1: Given filter sets Kategorie and Geschoss, When the user checks Kategorie = IfcWall and IfcSlab, Then table and model contain exactly the elements that are IfcWall OR IfcSlab.
- REQ-004-AC2: When the user additionally checks Geschoss = `Erdgeschoss`, Then only IfcWall/IfcSlab elements on Erdgeschoss remain, and the Kategorie filter set still lists all categories that have elements on Erdgeschoss (with their counts on Erdgeschoss), while categories without elements there are hidden.
- REQ-004-AC3: Given a checked value that becomes impossible after another filter changes, Then it stays visible with count 0 and checked, so the user can uncheck it.
- REQ-004-AC4: When the user clicks `Alle Filter zurücksetzen`, Then all values are unchecked and every element is in the table again.

### REQ-005: 3D model view
- Priority: must (filter coupling, navigation); should (colouring, section) · Source: UC 4, FUN-x2
- The centre shows all models in 3D with orbit/pan/zoom and `Ansicht einpassen`, styled as the reference app.
- Elements outside the current filter are shown as ghosts (transparent, as the reference app's X-ray) by default; a switch `Elemente außerhalb des Filters: Geist | Ausblenden` changes this.
- Should: `Färben nach` <property> colours elements by the values of any property, with a legend (value, colour) under the model; `Schnitt` adds a section plane along X, Y or Z with a slider and a flip button.
- REQ-005-AC1: Given a filter that leaves 10 elements, Then exactly those 10 are drawn opaque and the others as ghosts; When the user switches to `Ausblenden`, Then the others are not drawn.
- REQ-005-AC2: Given `Färben nach` = Kategorie, Then each category has one colour, the legend lists every visible category with its colour, and the colour dots in the Kategorie filter set match.
- REQ-005-AC3: Given `Schnitt` on Z at mid-height, Then geometry above the plane is cut away; flipping cuts the other side.

### REQ-006: Table — single-element view and grouping view
- Priority: must · Source: UC 5, F-02, FUN-x3
- The table below the model shows the filtered elements in one of two views, switched with `Einzelelemente | Gruppiert`:
  - **Single-element view**: one row per element.
  - **Grouping view**: the user chooses one or two grouping properties (level 1, optional level 2). A group row shows the group value, the element count (`Anzahl`) and the sum of every numeric column; a text column shows its value if it is the same for all elements of the group, else stays empty. Groups can be expanded to level 2 groups and down to the single elements; `Alle aufklappen` / `Alle zuklappen`. A total row shows the totals of the filtered elements.
- Columns: chosen from the property catalogue (search, grouped by pset), reordered by drag and drop, removed; default columns `Modell`, `Kategorie`, `Name`, `Geschoss`. Column width adjustable.
- Each column header offers sorting (ascending/descending) and a column filter: text columns — value checklist with search (OR within the column); numeric columns — range `von`/`bis`. Column filters combine with AND with the filter sets and also update the filter set counts and the model.
- Numbers are right-aligned with German formatting (thousands `.`, decimal `,`, up to 3 decimals in the UI); empty cells stay empty.
- Large tables stay fluid (row virtualisation).
- REQ-006-AC1: Given the single-element view with 2,000 filtered elements, Then the table shows 2,000 rows (scrollable) and the footer reads `2.000 Elemente`.
- REQ-006-AC2: Given grouping by Kategorie then Geschoss and a numeric column `Qto_WallBaseQuantities.NetVolume (m³)`, Then each Kategorie row shows the count and the volume sum of its elements, each Geschoss sub-row the same for its subset, and the sum of the sub-rows equals the parent row.
- REQ-006-AC3: Given a group expanded to single elements, Then its element rows appear indented under it.
- REQ-006-AC4: Given a column filter `Name` = `Wand-Int-ERDG-4`, Then table, model and filter set counts reflect only matching elements.
- REQ-006-AC5: When the user sorts a numeric column descending, Then rows (or groups, by their sums) are ordered by value, empty values last.
- REQ-006-AC6: When the user adds, moves or removes a column, Then the table updates and the change is part of the saved configuration.

### REQ-007: Selection and element details
- Priority: must (details from model); should (both directions) · Source: UC 6
- Clicking an element in 3D highlights it, shows all its properties in the right panel (`Element-Details`: attributes, special properties, then psets and type psets, collapsible), and highlights and scrolls to its table row (in the grouping view the containing groups are expanded).
- Clicking a table row highlights the element in 3D and shows its details; clicking a group row highlights all its elements.
- Elements marked `ohne Geometrie` can be selected in the table; their details are shown and a hint says that they have no 3D geometry.
- REQ-007-AC1: When the user clicks a wall in 3D, Then the details panel shows its GlobalId and psets, and its table row is highlighted and visible.
- REQ-007-AC2: When the user clicks a table row, Then that element is highlighted in 3D.
- REQ-007-AC3: When the user clicks empty space in 3D or presses `Esc`, Then the selection is cleared.

### REQ-008: Export table as CSV and Excel
- Priority: must · Source: UC 7, FUN-x4
- `Export CSV` and `Export Excel` export exactly what the table currently shows: the visible columns in their order, the filtered rows in their sort order; in the grouping view the group rows (with `Anzahl` and sums), the element rows of expanded groups, and the total row, with a first column `Ebene` (1, 2, Element).
- CSV: UTF-8 with BOM, separator `;`, decimal comma, no thousands separator, CRLF, quoting per RFC 4180; text cells starting with `=`, `+`, `-` or `@` are prefixed with `'` (formula injection protection; numeric cells unaffected).
- Excel: one `.xlsx` sheet (`Tabelle`), header bold and frozen, autofilter, numbers as numeric cells (full precision), column widths fitted; in the grouping view group rows bold.
- File name: `<Titel>_<YYYY-MM-DD>.csv|.xlsx`.
- REQ-008-AC1: Given a filtered single-element view, When exporting CSV, Then the file has a BOM, `;` separators, one header row with the column titles and one line per table row in the same order, and numbers like `1234,5`.
- REQ-008-AC2: Given the same view, When exporting Excel, Then an independent reader (openpyxl) reads the same headers and values, numbers as numeric cells.
- REQ-008-AC3: Given the grouping view with one expanded group, Then the export contains group rows with counts and sums, the expanded element rows and the total row, with `Ebene` set accordingly.
- REQ-008-AC4: Given a text value `=SUM(A1)`, Then CSV contains `'=SUM(A1)` and Excel contains it as a text cell.

### REQ-009: Save and load configuration
- Priority: must · Source: UC 8, F-04
- `Konfiguration speichern` downloads a JSON file with: schema version, title, filter sets (property keys, order, collapsed state), active filter values, column filters, columns (keys, order, widths), table view, grouping properties, sort, model display (ghost/hide, colour property, section), title/date/logo settings.
- `Konfiguration laden` applies such a file to the currently loaded models. Properties or values missing from the current models are skipped with a notice listing them; nothing else fails. IFC models are not part of the configuration (F-04).
- Elements are never referenced by localId (localIds change on re-export of the IFC).
- REQ-009-AC1: Given a configured view, When the user saves and reloads the page, loads the same IFC and then the configuration, Then filter sets, filters, columns, grouping, sort and model display are identical.
- REQ-009-AC2: Given a configuration that references a property absent from the loaded model, When it is loaded, Then the rest is applied and a notice names the skipped property.
- REQ-009-AC3: Given a file that is not a valid configuration (wrong JSON, unknown schema version), Then a German error message is shown and the current view is unchanged.

### REQ-010: Export the offline viewer file
- Priority: must · Source: UC 9, F-03, C02
- `Viewer-Datei exportieren` downloads one self-contained HTML file containing the models, the extracted element data, the runtime and the current configuration.
- The viewer file works by double-click from the file system without internet and without any installation. It offers REQ-003 to REQ-008 and REQ-011 display, starting from the exported configuration; it offers no IFC loading, no configuration save/load and no viewer export.
- Changes in the viewer file are not persisted (reopening shows the exported state).
- REQ-010-AC1: Given an exported viewer file, When it is opened via `file://` in a browser context with all network access blocked, Then the model, filter sets and table appear in the exported state.
- REQ-010-AC2: In that viewer file the user can change filters, filter sets, columns, grouping, model display and export CSV/Excel, with the same results as in the builder.
- REQ-010-AC3: The viewer file has no controls for loading IFC, saving/loading configuration or exporting a viewer file.

### REQ-011: Title, date and logo
- Priority: should · Source: C99, ASM-002
- The builder sets a title (default: first model's file name), a date (default: today) and optionally a logo image (PNG/JPG/SVG, embedded); they appear in the header bar of builder and viewer file and in export file names.
- REQ-011-AC1: Given title `The M Bouwkundig`, date `2026-08-12` and a logo, Then the viewer file's header shows all three, and its CSV export is named `The M Bouwkundig_2026-08-12.csv`.

### NFR-001: Interaction speed
- Target: with 30,000 elements loaded, a filter click, column filter change, sort, view switch or regrouping updates filter sets, table and model in ≤ 500 ms (median of 3, Chromium, developer laptop class machine). · Verify by: T6 Playwright measurement on the volume fixture.

### NFR-002: Model size
- Target: IFC files up to 100 MB (several 10,000 elements, also several models together) load in the builder without crash; progress is shown for conversion and extraction; ≤ 60 s per 100 MB IFC. · Verify by: T6 with the largest available fixture and a synthetic multi-model set (≥ 100 MB total); measured times and peak memory reported.

### NFR-003: Viewer file start
- Target: a viewer file built from ≥ 100 MB of IFC opens offline and is usable in ≤ 15 s; viewer file size ≤ 40 % of the source IFC size. · Verify by: T6.

### NFR-004: Export duration
- Target: CSV/Excel export of 30,000 rows × 20 columns completes in ≤ 5 s with a progress indication; UI stays responsive (no freeze > 1 s). · Verify by: T6.

### NFR-005: Offline operation
- Target: the viewer file makes zero network requests; the builder needs network only for the libraries (as the reference app). · Verify by: T3/T5 with network blocked and request logging.

### User interface
- Screens (UI-01): one screen. Layout from the user's screenshot (structure only, F-01):
  ```
  ┌ Header: Logo · Titel · Datum ············ [Builder: IFC laden | Konfiguration speichern | laden | Viewer-Datei exportieren] ┐
  ├──────────────┬───────────────────────────────────────────────┬──────────────────┤
  │ FILTER       │ 3D-Modell                                     │ ELEMENT-DETAILS   │
  │ [+ Filtersatz]│  controls top right: Außerhalb Filter,        │ (Klick auf ein    │
  │ ▸ Kategorie  │  Färben nach, Schnitt; legend bottom          │  Element …)       │
  │ ▸ Geschoss   ├───────────────────────────────────────────────┤                  │
  │ ▸ Material   │ TABELLE: [Einzelelemente|Gruppiert] Gruppe 1/2, │                  │
  │ …            │ [Spalten] [Export CSV] [Export Excel]; table    │                  │
  └──────────────┴───────────────────────────────────────────────┴──────────────────┘
  ```
  Left filter area ~280 px, right details ~320 px (collapsible), splitter between model and table (default 55 % / 45 %).
- Look and feel (UI-02): the light HTML Model Viewer style — accent red `#D72622`, ink `#35383A` / `#4E5355` / `#6B6F73` / `#A4A8AC`, background `#f4f5f6` / `#eceef0`, lines `#e1e3e5`, 13–14 px "Segoe UI"/system-ui, inline SVG icons; not the dark colours of the screenshot.
- Devices: desktop browsers, window width ≥ 1280 px (UI-01); below that, side panels collapse.
- Language: German UI texts, German number formatting.
- Feedback and errors: progress overlay with step and percentage during conversion, extraction and exports; German error messages naming the file and cause; status line `X von Y Elementen` always visible.

### Constraints
- CON-001: One hand-written HTML file for the builder, plain JavaScript, no build step (STK-01).
- CON-002: Same engine as the reference app: `@thatopen/fragments@3.4.7` with matching `three` and `web-ifc` from jsDelivr; module linking via Blob URLs and classic workers as in `ifc-viewer-builder.html` (works from `file://` and in sandboxed frames).
- CON-003: The viewer file needs no network, no storage APIs and no installation; it embeds everything (as the reference app).
- CON-004: No server, no login, no telemetry; all data stays on the user's computer (C02, C07).
- CON-005: The repository `html-modelviewer` stays unchanged; code and style are copied from it (C08).

## 3. Out of scope
- Editing IFC data or writing IFC files.
- Persisting changes made in a viewer file; saving/loading configuration in the viewer file (F-04, UC 9).
- Login, sharing via a server, cloud storage.
- Mobile phones and tablets (UI-01).
- Aggregations other than count and sum (FUN-x3: sums chosen over per-column aggregates).
- More than two grouping levels.
- Several named views per file (C99: not chosen).
- IFC classification, MEP systems/groups and material layer thicknesses as properties (not in the importer's default data; candidates for a later change).

## 4. Design

### 4.1 Stack
- Builder: `calc-viewer-builder.html` at the repository root; plain JS ES modules inline; no framework (CON-001).
- Engine: `@thatopen/fragments@3.4.7`, `three@0.182.0` (pinned explicitly by alias — jsDelivr's `+esm` of fragments currently resolves `three@0.185.1`, the alias prevents drift), `web-ifc@0.0.77`; loaded from jsDelivr, linked to Blob URLs (`tovLinkModules` pattern), conversion in a classic Blob worker with `IfcImporter`, display via `FragmentsModels(workerUrl, {classicWorker: true})`.
- Exports: own `.xlsx` writer (~70 lines: ZIP via `CompressionStream('deflate-raw')`, shared strings, bold style, frozen header, autofilter) and own CSV writer — no libraries (ASM-004 confirmed by spike).
- Dev tooling (Node 22): `prettier@3.9.10`, `eslint@9.39.5` + `@eslint/js@9.39.5` + `eslint-plugin-html@8.2.1` + `globals@17.14.0`, `c8@12.0.0`, `@playwright/test@1.63.0` (matches the preinstalled Chromium), `node:test`.

### 4.2 Structure
```
calc-viewer-builder.html        the product (builder; also the template of the viewer file)
  <style id="cv-css">            shared styles (builder + viewer file)
  <script type="module" id="cv-core">   pure logic, no DOM: property model, unit conversion, filter engine,
                                  facet counts, grouping/sums, sorting, CSV/XLSX writers, config schema,
                                  dictionary encoding; exports `globalThis.CalcCore`
  <script type="module" id="cv-ui">     DOM: layout, filter area, table (virtualised), details, dialogs
  <script type="module" id="cv-3d">     engine bootstrap, model display, ghost/hide, colouring, section, picking
  <script type="module" id="cv-builder"> builder-only: IFC loading, conversion worker, extraction, config
                                  save/load, viewer file export
  <template id="cv-viewer-shell">   bootstrap of the viewer file (reads embedded payloads, starts cv-ui/cv-3d)
scripts/   vendor-cdn.mjs (fetch + sha256-lock jsDelivr files for tests), fetch-fixtures.mjs (IFC fixtures + hashes),
           serve.mjs (static server), check.mjs (fail-fast check sequence)
test/      load-core.mjs (extracts cv-core for Node), unit/, integration/, e2e/ (Playwright: file + http projects,
           network guard fixture), perf/, fixtures/ (small committed fixtures + manifest with source/licence/sha256)
docs/      process artefacts
```

### 4.3 Data
- **Element row**: key `<modelId>:<localId>`; `guid`; `geometry` (bool); `values`: map propertyKey → value (number | string | string[] for multi-valued | null).
- **Property catalogue**: propertyKey → {label, group (`Allgemein` | pset name | `Typ: <pset>`), kind (`number` | `text` | `multi`), unit, count of elements with a value}. Special keys: `Modell`, `Kategorie`, `Name`, `GlobalId`, `ObjectType`, `Tag`, `PredefinedType`, `Description`, `Typ`, `Geschoss`, `Material`, `Geometrie`.
- **Column store** for speed: per property a typed array / dictionary-encoded index over rows; filter evaluation builds bitsets per filter set, facet counts per set are computed against the AND of all other sets (spike: 1–5 ms for 28k rows).
- **Configuration** (JSON, `schema: "calc-viewer-config/1"`): see REQ-009; properties referenced by propertyKey, filter values by value.
- **Viewer file payloads** (gzip + base64, as reference app): runtime (module sources + worker), one `.frag` per model, element table (dictionary-encoded JSON), catalogue, configuration, logo.
- Extraction (spike-proven): element ids via `getItemsOfCategories` minus spatial/type classes; data via one `getItemsData` with explicit relation config (`IsDefinedBy`, `HasAssociations`, `HasPropertySets` on, all inverse relations off — else cycles); type via `IsDefinedBy` → type object; storey via `getSpatialStructure()`; units via IfcUnitAssignment. Importer: default classes plus IfcDoorStyle/IfcWindowStyle and IfcConversionBasedUnit/IfcMeasureWithUnit added.

### 4.4 Interfaces
- User: file picker / drop zone (IFC, configuration JSON, logo image); downloads (CSV, XLSX, JSON, HTML).
- Internal: `CalcCore` (pure functions, unit-tested in Node): `buildCatalog`, `filterRows`, `facetCounts`, `groupRows`, `sortRows`, `toCsv`, `toXlsx`, `validateConfig`, `applyConfig`, `encodeTable`/`decodeTable`, `convertUnit`.

### 4.5 UI
As in §2 User interface. Components copied from the reference app's CSS (chips, checklists, dialogs, icons) and extended for facet lists, table and splitters.

### 4.6 Error handling and configuration
- Every async step (load, convert, extract, export) runs with a progress overlay and catches errors into a German message; a failing model is skipped, the rest continues. Worker crashes are reported as possibly too large for browser memory (as reference app).
- No runtime configuration besides the user's configuration file.

### 4.7 Decisions taken without asking (shown at the release gate)
| # | Decision | Reason |
|---|---|---|
| DEC-1 | Occurrence value wins over type value; one merged property | IFC semantics; one column per property is simpler to use |
| DEC-2 | Length/area/volume converted to m/m²/m³; other units unchanged | screenshot shows m-based quantities; sums across models need one unit |
| DEC-3 | Aggregates (e.g. IfcStair, IfcCurtainWall) and their parts are both rows; sums include both | data is shown as in the model; user can filter by Kategorie (ASM-006) |
| DEC-4 | Same GlobalId in two models → two rows (key model+localId) | disciplines may overlap; the `Modell` column distinguishes them |
| DEC-5 | Text that looks numeric stays text | avoids wrong sums |
| DEC-6 | CSV text cells starting with `= + - @` get a `'` prefix | formula-injection protection; numbers unaffected |
| DEC-7 | Viewer file contains the pre-extracted element table | avoids web-ifc (3.5 MB) and multi-second extraction for colleagues |
| DEC-8 | Supported browsers: current Chrome and Edge; Firefox best effort (ASM-007) | Chromium is the tested engine; `Uint8Array.fromBase64` with `atob` fallback |
| DEC-9 | Single-element view and grouping view share one column set | the user builds one view (F-02) |
| DEC-10 | three pinned to 0.182.0 | reproducible builds; jsDelivr resolves newer versions otherwise |

### 4.8 Spike results (2026-11-02, scratchpad, independently re-checked)
- Conversion (Node and Chromium): 2.4–49 MB IFC → .frag 7–16 % of IFC size, ~0.2 s per IFC MB; localId = STEP id; GlobalIds stable.
- Extraction: 28k elements (4 models) in Chromium 2–3 s one-off, facet pass 1–5 ms; one model had 6,859 distinct pset properties (catalogue must handle thousands of keys).
- Some elements lose geometry in conversion (e.g. 55 walls in one model) → `ohne Geometrie` rows (REQ-002).
- `.xlsx` writer validated with openpyxl and LibreOffice; 30k×12 in 0.5–1 s; 60k×60 sparse in ~4.7 s (→ NFR-004, progress UI).
- 50 MB embedded payload: download and offline decode from `file://` work (decode ~0.3 s).
- Module workers from Blob URLs fail under `file://`; classic Blob workers work. In a test page opened via `file://`, `FragmentsModels.load` hung (root cause unknown) — the reference app's full pattern (all modules as Blob URLs, worker source inlined, classic worker) is mandatory, and TASK-001 must prove it from `file://` (risk R-1).

### Testing
| Type | Concrete form for this project |
|---|---|
| T1 Unit | `node:test` on `cv-core` extracted by `test/load-core.mjs`: catalogue, unit conversion, filter/facet logic (OR/AND, hidden values, checked-impossible values), grouping and sums, sorting, CSV/XLSX writers (read back), config validation/apply, table encoding. Coverage ≥ 70 % lines of cv-core (calibration S), target 90 % |
| T2 Integration | Playwright in-page: IFC fixture → conversion worker → extraction → catalogue/rows (REQ-002 reference values); config save → load round trip; exports read back with openpyxl (if available) or a Node ZIP/XML reader |
| T3 System | Builder opened from a clean checkout via `file://` and via the static server in a fresh browser profile, CDN served from the hash-locked test cache; exported viewer file opened via `file://` in a new context with all network blocked (NFR-005) |
| T4 E2E | One Playwright flow per use case 1–9 through the UI, plus the full "build → export viewer file → colleague adjusts and exports CSV" flow |
| T5 Acceptance | Every REQ-…-AC and NFR above has ≥ 1 test tagged with its ID (`REQ-004-AC2` / `REQ_004_AC2`) |
| T6 Performance | Playwright timings: NFR-001 on the volume set (≥ 30k elements; four-fold loaded mid-size model if no single large fixture), NFR-002 on the largest fixture and a ≥ 100 MB multi-model set, NFR-003 and NFR-004; Node micro-benchmarks for cv-core; median of 3, environment recorded |
| T7 Robustness | invalid/truncated/empty/non-IFC files, huge property counts (thousands of columns), elements without geometry/material/storey, special characters and long texts in values and titles, invalid/foreign/old configuration files, cancelled file dialogs, removal of models while filters are active |
| T8 Regression, T9 Smoke | `test_all` after every change; smoke = builder starts, loads the small fixture, shows table |
| T10 Security | ○ no login/sensitive data; covered: formula-injection rule (REQ-008-AC4), HTML escaping of all model strings in the UI (XSS via IFC values), no network in viewer file |
| T11 Usability | heuristic review of the screen against §2 User interface (GUI) |
| T12 Compatibility | Chromium (automated); Chrome/Edge manual smoke at release; Firefox best effort (ASM-007) |
| T13 Migration | – no data migration; config schema versioning covered by T7 |
| T14 Exploratory | 2 charters: "build a quantity overview for a real project", "break the viewer file as a colleague" |

Test data: committed small fixtures (`AC20-FZK-Haus.ifc`, Duplex architecture) with a manifest (source URL, licence, sha256); larger fixtures (SampleCastle 49 MB, Revit MEP 29 MB, Duplex MEP) fetched by `scripts/fetch-fixtures.mjs` with sha256 check; reference values for REQ-002-AC1 recorded in `test/fixtures/reference-values.json`. No real project data in the repository (ASM-003).

## 5. Tasks  _(working section)_

| ID | Title | Implements | Depends on | Touches | Status |
|---|---|---|---|---|---|
| TASK-001 | Toolchain + walking skeleton: package.json, prettier/eslint/c8/Playwright, vendor-cdn with lock, fetch-fixtures, check.mjs, pre-commit hook; builder loads one IFC and shows it in 3D — proven via `file://` and http (risk R-1) | enabler, REQ-001 (part), CON-002 | – | repo root, scripts/, test/, calc-viewer-builder.html | todo |
| TASK-002 | Extraction and property model: importer config, element list, attributes/psets/type psets/storey/material/model, units, `ohne Geometrie`, catalogue; reference values | REQ-001, REQ-002 | 001 | cv-core, cv-builder, test/ | todo |
| TASK-003 | Filter engine: column store, OR/AND, facet counts with hidden values, column filters, sorting | REQ-004 (logic), REQ-006 (filters, sort) | 002 | cv-core, test/unit | todo |
| TASK-004 | Layout and filter area: screen layout, styles, filter sets (catalogue dialog, add/order/collapse/remove), facet lists, reset | REQ-003, REQ-004 (UI) | 003 | cv-css, cv-ui, test/e2e | todo |
| TASK-005 | 3D coupling: ghost/hide, colouring + legend, section plane, picking and details panel, selection both directions | REQ-005, REQ-007 | 004 | cv-3d, cv-ui | todo |
| TASK-006 | Table: virtualised single-element view, grouping (2 levels, sums, expand, totals), column chooser and order/width, column filter UI | REQ-006 | 004 | cv-core, cv-ui | todo |
| TASK-007 | CSV and XLSX export of the current table view | REQ-008 | 006 | cv-core, cv-ui | todo |
| TASK-008 | Configuration save/load with schema version and tolerant apply; title/date/logo | REQ-009, REQ-011 | 006 | cv-core, cv-builder | todo |
| TASK-009 | Viewer file export: payload packaging, viewer shell, viewer mode without builder controls, offline start | REQ-010, NFR-003, NFR-005 | 005, 007, 008 | cv-builder, cv-viewer-shell | todo |
| TASK-010 | Performance and robustness pass: volume set, measurements against NFR-001..004, fixes | NFR-001..004 | 009 | all | todo |

Task details:
- TASK-001 acceptance: `node scripts/check.mjs --all` green from a clean clone after `npm ci` + vendor/fetch scripts; Playwright test loads `AC20-FZK-Haus.ifc` in the builder opened via `file://` and via http and asserts that the model is rendered (canvas non-empty, model loaded event) with the network guard active. If the `file://` case cannot be made to work, stop and record the finding as a blocking question (fallback candidate: run the app inside a sandboxed `srcdoc` frame as the reference builder's preview does).

## 6. Testing results  _(working section)_

| AC / NFR | Test(s) | Type | Status |
|---|---|---|---|

## 7. Open points  _(working section)_
- Risks: R-1 `file://` engine start (TASK-001); R-2 memory at ≥ 100 MB IFC in the browser (TASK-010; untested beyond 49 MB); R-3 Excel itself not available in the test environment (structure validated with openpyxl/LibreOffice; manual check at release).
- Assumptions: see `docs/open-questions.md` ASM-001…ASM-007.

## Change history

| Date | CR | Request | Category | Affected IDs | Risk check (R4/R5/R7) | Tests run | Result / PIR |
|---|---|---|---|---|---|---|---|
