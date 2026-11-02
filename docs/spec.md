---
status: approved
date: 2026-11-02
relates_to: [C01, C02, C03, C04, C05, C09, C99, FUN-01, FUN-02, FUN-04, FUN-x1, FUN-x2, FUN-x3, FUN-x4, DAT-01, QLT-01, UI-01, UI-02, STK-01, ASM-001, ASM-002, ASM-003, ASM-004, ASM-005, ASM-006, ASM-007, ASM-008]
---
# Specification — Calc Viewer Builder

Lean track (tier S): requirements, design and tasks in one file.
**Baseline sections** (change via CR once approved): 1–4. **Working sections** (change freely): 5–7 and the change history.
Sources: `docs/intake/answers.md` (IDs in brackets), `docs/intake/modelviewer-analysis.md` (reference app `html-modelviewer/ifc-viewer-builder.html`, cited as `ref L<n>`), spike results in §4.8.

## 1. Goal

A browser tool for BIM specialists (BIM coordinators, cost estimators, project members) to explore one or more IFC models like a PowerBI report. Freely chosen filter sets narrow down the 3D model and a configurable quantity table. The table can be exported as CSV or Excel. The whole view can be saved as a configuration and handed to colleagues as one offline HTML file that they can still adjust (C01, C02, F-02).
**Success** (C09): real projects' quantity overviews are built with the tool and shared with colleagues. Long-lived tool, maintained by the user.

Terms:
- **Builder** — the HTML file the author opens to load IFC files, configure and export.
- **Viewer file** — the offline HTML file the builder exports for colleagues.
- **Element** — one IFC product occurrence (one row in the single-element view).
- **Property** — any value of an element that can be a filter set, a column, a grouping or a colouring (§4.3).
- **Filter set** — a facet panel on the left listing the values of one property.

## 2. Requirements

Priorities from FUN-04: must = UC 1, 2, 3, 5, 7, 8, 9; should = UC 4 (colouring, section), UC 6 (selection and details); ASM-002 (title/date/logo) = should. All are planned for release 1.

### REQ-001: Load IFC models
- Priority: must · Source: UC 1, C05, DAT-01
- The builder shall load one or more IFC files (IFC2X3, IFC4) via a file picker and drag and drop, convert them in the browser and show progress per file.
- Several models are combined into one view; the property `Modell` (file name without extension) identifies each element's model. A file name already loaded gets the suffix ` (2)`, ` (3)`, … so every model has its own `Modell` value (DEC-12).
- More files can be added later; a model can be removed again.
- Option `Räume (IfcSpace) einbeziehen` (default off, DEC-13) includes IfcSpace elements in 3D and table.
- Load errors are classified; the German message always contains the file name and the class-specific text:
  - `empty` — 0 bytes: `… ist leer.`
  - `not-ifc` — no ISO-10303-21 header: `… ist keine IFC-Datei.`
  - `unsupported-schema` — FILE_SCHEMA other than IFC2X3/IFC4: `… verwendet das nicht unterstützte Schema <schema>.`
  - `unreadable` — parsing or conversion fails (e.g. truncated file): `… konnte nicht gelesen werden: <cause>.`
  - `too-large` — the conversion worker crashes: `… ist möglicherweise zu groß für den Arbeitsspeicher des Browsers.` (as ref L2196-2199)
- REQ-001-AC1: Given the builder is open, When the user loads two valid fixture files, Then both models are shown in 3D and a filter set `Modell` lists both names with their element counts.
- REQ-001-AC2: Given one fixture per error class (`empty`, `not-ifc` = renamed PDF, `unsupported-schema` = IFC4X3 header, `unreadable` = truncated IFC; `too-large` simulated by a test hook that makes the conversion worker raise an `error` event) loaded after a valid model, Then for each the message of that class with the file name appears, the valid model stays loaded and the page remains usable.
- REQ-001-AC3: Given two loaded models and an active filter, When the user removes one, Then its elements disappear from 3D, filter sets and table, and filters on remaining values stay active.
- REQ-001-AC4: Given a fixture with IfcSpace elements, When the option is off, Then no IfcSpace is in 3D, table or filter sets; When it is switched on, Then they are.
- REQ-001-AC5: Given `A.ifc` is loaded, When `A.ifc` is loaded again, Then `Modell` lists `A` and `A (2)` with their own counts, and removing one leaves the other.

### REQ-002: Extract IFC data per element
- Priority: must · Source: DAT-01, ASM-005
- For every element the builder shall extract: IFC class (`Kategorie`), direct attributes (`Name`, `GlobalId`, `ObjectType`, `Tag`, `PredefinedType`, `Description`), all property sets and quantity sets of the element, all property sets of its type object, the type name (`Typ`), the storey (`Geschoss`), the material(s) (`Material`), the model (`Modell`) and `Geometrie`.
- Release 1 reads exactly these sources (the DAT-01 list); IFC classification references, system/group assignments and material layer thicknesses are deferred (DEC-11). Custom pset properties (e.g. `00_NL-SfB - Artikelnummers` in the user's screenshot) are ordinary pset properties and are included.
- Elements are listed by IFC class (not only those with geometry); spatial structure elements (project, site, building, storey) and type objects are not rows.
- Rules:
  - Property identity is `<Pset name>.<Property name>`; attributes and the special properties above use their German label.
  - When the same property exists on the occurrence and its type, the occurrence value wins (IFC semantics); the type value fills gaps (DEC-1).
  - `Geschoss` = nearest IfcBuildingStorey ancestor in the spatial tree (also through aggregation); empty if none.
  - `Material` is multi-valued: all materials from IfcMaterial, layer sets, constituent sets, profile sets and lists of the element, else of its type; shown sorted and joined with `, `.
  - Numeric IFC measure and number types are numbers; labels, texts and identifiers stay text even if they look numeric (DEC-5). Booleans are shown as `Ja` / `Nein`.
  - Units (DEC-2): length, area and volume values in SI units with prefix (e.g. mm, cm²) or conversion-based units (IfcConversionBasedUnit, e.g. foot) are converted to m, m², m³ via the model's IfcUnitAssignment; the column header shows the unit (`(m)`, `(m²)`, `(m³)`). Other numeric values keep their project unit. If a numeric property has different units in different loaded models after conversion, its unit is `gemischt`, the header shows `(gemischt)` and group/total sums of that column stay empty.
  - `Geometrie` is `Nein` for elements that have no 3D geometry after conversion, else `Ja`; such elements are rows like all others.
- REQ-002-AC1: Given `AC20-FZK-Haus.ifc`, Then for every reference element in `test/fixtures/reference-values.json` (Testing → Test data) Kategorie, Name, GlobalId, Typ, Geschoss, Material and the listed quantities equal the expected values.
- REQ-002-AC2: Given the Revit MEP fixture (length unit mm), Then a wall's `Qto_WallBaseQuantities.Length` is shown in m (value / 1000) and the header reads `Qto_WallBaseQuantities.Length (m)`.
- REQ-002-AC3: Given an element with a property on occurrence and type, Then the occurrence value is shown; Given only the type has it, Then the type value is shown.
- REQ-002-AC4: Given an element with a layered material, Then `Material` lists every layer material once, and filtering by any one of them matches the element.
- REQ-002-AC5: Given an IfcLabel value `"1.5"`, Then it is text (left-aligned, not summed).
- REQ-002-AC6: Given a length in feet, Then it is shown in m; Given two models where the same numeric property has different non-convertible units, Then the header reads `… (gemischt)` and no sums are shown for it.
- REQ-002-AC7: Given the SampleCastle fixture and an element known to lose its geometry in conversion (GlobalId recorded in `reference-values.json`), Then it is a table row with `Geometrie` = `Nein`.

### REQ-003: Configure filter sets
- Priority: must · Source: UC 2, C00
- The user shall add a filter set for any property via a searchable property catalogue (grouped: `Allgemein`, then by pset name; each entry with the number of elements that have a value), reorder filter sets by drag and drop or up/down buttons, collapse and remove them.
- Default for a new configuration: filter sets `Kategorie`, `Geschoss`, `Material`.
- REQ-003-AC1: Given `AC20-FZK-Haus.ifc` loaded, When the user searches `Length` in the catalogue and adds `BaseQuantities.Length`, Then a new filter set with that title appears at the bottom of the filter area.
- REQ-003-AC2: When the user moves a filter set up/down, collapses or removes it, Then the change is visible immediately and is part of the saved configuration (REQ-009).
- REQ-003-AC3: Given a new configuration with a loaded model, Then the filter sets `Kategorie`, `Geschoss`, `Material` are shown in this order.

### REQ-004: Filter with filter sets
- Priority: must · Source: UC 3, FUN-02, FUN-x1, C00
- Each filter set lists the distinct values of its property with a checkbox, a colour dot (when the model is coloured by that property) and the element count. Values are sorted alphabetically (numbers numerically); empty values appear as `(leer)` at the end.
- Several checked values within one filter set combine with OR; filter sets combine with AND. Column filters of the table (REQ-006) also combine with AND.
- After any change, each filter set's values and counts are computed under all active filters except the set's own selection: checking a value never hides the other values of the same set; values with 0 hits under the other filters are hidden, except checked values, which stay visible with count 0 so they can be unchecked (DEC-14).
- A filter set header shows the number of checked values and a reset button; `Alle Filter zurücksetzen` clears all filters including column filters.
- Value lists with many entries (filter sets, column-filter checklists, property catalogue) render only the visible entries; all values stay reachable by scrolling and by a search field.
- Filters affect the 3D model (REQ-005) and the table (REQ-006) together.
- REQ-004-AC1: Given `AC20-FZK-Haus.ifc` with filter sets Kategorie and Geschoss, When the user checks Kategorie = IfcWallStandardCase and IfcSlab, Then table and 3D state contain exactly the elements that are IfcWallStandardCase OR IfcSlab (expected keys from `reference-values.json`).
- REQ-004-AC2: When the user additionally checks the ground-floor storey value, Then only IfcWallStandardCase/IfcSlab elements on that storey remain, and the Kategorie filter set lists exactly the categories that have elements on that storey, with their counts on that storey.
- REQ-004-AC3: Given a checked value that has 0 hits after another filter changes, Then it stays visible with count 0 and checked.
- REQ-004-AC4: When the user clicks `Alle Filter zurücksetzen`, Then all values and column filters are cleared and every element is in the table again.

### REQ-005: 3D model view
- Priority: must (filter coupling, navigation); should (colouring, section) · Source: UC 3, UC 4, FUN-x2
- The centre shows all models in 3D with orbit/pan/zoom and `Ansicht einpassen`, styled as the reference app.
- Elements outside the current filter are ghosts (transparent, as the reference X-ray) by default; the switch `Elemente außerhalb des Filters: Geist | Ausblenden` changes this.
- Should: `Färben nach` <property> colours the elements inside the filter by the values of any property, with a legend under the model. Rules (DEC-15): text values get distinct colours up to 120 values (as ref `DISTINCT_COLOR_COUNT`), further values share one colour shown as `Sonstige`; numeric values use a continuous scale min→max in 24 steps with ranges in the legend; elements with several values get one neutral colour shown as `mehrere Werte`; empty values are grey `(leer)`. Precedence: selection highlight > colour > ghost/hide.
- Should: `Schnitt` adds a section plane along X, Y or Z with a slider and a flip button.
- Observable state for tests: cv-3d exposes `CalcView.state()` (§4.4).
- REQ-005-AC1: Given a filter that leaves N elements, Then `state()` lists exactly those N as opaque and all others as ghost; When the user switches to `Ausblenden`, Then the others are hidden.
- REQ-005-AC2: Given `Färben nach` = Kategorie, Then each category has one colour in `state().colours`, the legend lists every category in the filter with that colour, and the dots in the Kategorie filter set match.
- REQ-005-AC3: Given `Schnitt` on Z at mid-height, Then `state().section` = {axis Z, offset mid-height}; flipping inverts it; a render check shows a different canvas than without section.
- REQ-005-AC4: Given `Färben nach` = Material, Then an element with two materials has the `mehrere Werte` colour and the legend lists `mehrere Werte`.

### REQ-006: Table — single-element view and grouping view
- Priority: must · Source: UC 5, F-02, FUN-x3
- The table below the model shows the filtered elements in one of two views, switched with `Einzelelemente | Gruppiert`:
  - **Single-element view**: one row per element.
  - **Grouping view**: the user chooses one or two grouping properties (level 1, optional level 2). A group row shows `Gruppe` (the group value), `Anzahl` (element count) and the sum of every numeric column; a text column shows its value if it is the same for all elements of the group, else stays empty; a numeric sum cell is empty if no element of the group has a value. Elements with an empty grouping value form the group `(leer)`, sorted last. An element with several values of the grouping property (e.g. `Material`) appears in each of its groups and is counted and summed in each (DEC-16, ASM-008); the total row counts each element once. Groups expand to level-2 groups and down to the single elements; `Alle aufklappen` / `Alle zuklappen`. A total row (`Summe`) shows `Anzahl` and the sums over the filtered elements.
- Columns: chosen from the property catalogue (search, grouped as in REQ-003), reordered by drag and drop, removed; default columns `Modell`, `Kategorie`, `Name`, `Geschoss`. Column width adjustable. Both views share one column set (DEC-9).
- Each column header offers sorting (ascending/descending; empty values last) and a column filter: text columns — value checklist with search (OR within the column); numeric columns — range `von`/`bis`, both inclusive, an empty field means no bound, elements without a value are excluded while a bound is set (DEC-17). Column filters combine with AND with the filter sets and also update filter set counts and the model.
- Numbers are right-aligned with German formatting (thousands `.`, decimal `,`, up to 3 decimals in the UI); empty cells stay empty.
- Rows are rendered virtualised.
- REQ-006-AC1: Given a fetched fixture and a filter whose result is exactly 2,000 elements (recorded in `reference-values.json`), Then the single-element view holds 2,000 rows reachable by scrolling and the status line reads `2.000 von <Y> Elementen`.
- REQ-006-AC2: Given grouping by Kategorie then Geschoss and the numeric column `BaseQuantities.NetVolume (m³)` on `AC20-FZK-Haus.ifc`, Then each Kategorie row shows count and volume sum of its elements, each Geschoss sub-row the same for its subset, and for these single-valued grouping properties the sub-rows add up to the parent row.
- REQ-006-AC3: Given a group expanded to single elements, Then its element rows appear indented under it.
- REQ-006-AC4: Given a column filter `Name` = one element name from `reference-values.json`, Then table, 3D state and filter set counts reflect only matching elements.
- REQ-006-AC5: When the user sorts a numeric column descending, Then rows (or groups, by their sums) are ordered by value, empty values last.
- REQ-006-AC6: When the user adds, moves, resizes or removes a column, Then the table updates and the change is part of the saved configuration.
- REQ-006-AC7: Given grouping by Kategorie and a text column whose value is equal within group A and differs within group B, Then group row A shows the value and group row B leaves the cell empty.
- REQ-006-AC8: Given the grouping view, Then the total row shows `Anzahl` = number of filtered elements and per numeric column the sum over all filtered elements.
- REQ-006-AC9: Given a numeric column filter `von` 2 `bis` 5, Then values 2 and 5 are included, 1.9 and 5.1 and empty values excluded.
- REQ-006-AC10: Given grouping by Material and an element with two materials, Then the element appears under both material groups, each group's `Anzahl` includes it, and the total row counts it once.

### REQ-007: Selection and element details
- Priority: should · Source: UC 6, FUN-04
- Clicking an element in 3D highlights it and shows all its properties in the right panel `Element-Details` (attributes and special properties, then psets, then type psets; groups collapsible); its table row is highlighted and scrolled into view (in the grouping view the containing groups are expanded).
- Clicking a table row highlights the element in 3D and shows its details; clicking a group row highlights all its elements.
- Elements with `Geometrie` = `Nein` can be selected in the table; their details show the hint `Dieses Element hat keine 3D-Geometrie.`
- REQ-007-AC1: When the user clicks a wall in 3D (at its projected screen position), Then `state().selected` contains it and the details panel shows its GlobalId and psets.
- REQ-007-AC2: When the user clicks a wall in 3D, Then its table row is highlighted and visible; in the grouping view its groups are expanded.
- REQ-007-AC3: When the user clicks a table row, Then that element is selected in `state()` and its details are shown.
- REQ-007-AC4: Given an element with `Geometrie` = `Nein`, When its table row is clicked, Then its details and the hint are shown and no error occurs.
- REQ-007-AC5: When the user clicks empty space in 3D or presses `Esc`, Then the selection is cleared.

### REQ-008: Export table as CSV and Excel
- Priority: must · Source: UC 7, FUN-x4
- `Export CSV` and `Export Excel` export exactly the rows the table currently shows, in their order: in the single-element view the filtered rows; in the grouping view the group rows, level-2 rows only under expanded level-1 groups, element rows only under expanded groups, and the total row last. Grouping-view exports start with the columns `Ebene` (`1`, `2`, `Element`, `Summe`), `Gruppe` and `Anzahl`, followed by the visible columns in their order. `Gruppe` = group value on group rows, empty on `Element` and `Summe` rows; `Anzahl` = count on group and `Summe` rows, empty on `Element` rows; numeric columns carry the sums on group and `Summe` rows (REQ-006).
- Values: numbers unrounded (shortest round-trip representation), no exponent notation; multi-valued cells joined with `, ` (as displayed).
- CSV: UTF-8 with BOM, separator `;`, decimal comma, no thousands separator, CRLF, quoting per RFC 4180; text cells starting with `=`, `+`, `-` or `@` get a `'` prefix (DEC-6); numeric cells unaffected.
- Excel: one `.xlsx` sheet `Tabelle`, header bold and frozen, autofilter, numbers as numeric cells, column widths fitted, group and total rows bold.
- File name `<Titel>_<YYYY-MM-DD>.csv|.xlsx` (REQ-011); characters `\ / : * ? " < > |` and control characters in the title become `_`; empty title → `Export`.
- REQ-008-AC1: Given a filtered single-element view including a value `0.12345` and a multi-material element, When exporting CSV, Then the file has a BOM, `;` separators, the header row with the column titles, one line per table row in table order, `0,12345` and the materials joined with `, `.
- REQ-008-AC2: Given the same view, When exporting Excel, Then openpyxl (pinned, §4.1) reads the same headers and values, numbers as numeric cells.
- REQ-008-AC3: Given the grouping view on `AC20-FZK-Haus.ifc`, level 1 = Kategorie, only group IfcWallStandardCase expanded, When exporting CSV, Then the rows are: header `Ebene;Gruppe;Anzahl;<columns>`, one `1` row per category in table order with the wall elements as `Element` rows directly under the IfcWallStandardCase row, and a final `Summe` row.
- REQ-008-AC4: Given a text value `=SUM(A1)`, Then CSV contains `'=SUM(A1)` and Excel contains `=SUM(A1)` as a text cell.
- REQ-008-AC5: Given title `A/B: C?` and date 2026-08-12, Then the CSV file name is `A_B_ C__2026-08-12.csv`.

### REQ-009: Save and load configuration
- Priority: must · Source: UC 8, F-04
- `Konfiguration speichern` downloads a JSON file (`schema: "calc-viewer-config/1"`) with: title, date, logo, filter sets (property keys, order, collapsed state), checked filter values, column filters, columns (keys, order, widths), table view, grouping properties, expanded state not included, sort, model display (ghost/hide, colour property, section).
- `Konfiguration laden` applies such a file to the currently loaded models. Properties and filter values missing from the loaded models are skipped and named in a notice; the rest is applied. IFC models are not part of the configuration (F-04). Elements are never referenced by localId.
- Load errors (German message, view unchanged): `invalid-json` — `Die Datei ist kein gültiges JSON.`; `not-a-config` — missing or foreign `schema`: `Die Datei ist keine Calc-Viewer-Konfiguration.`; `unsupported-version` — `Konfigurationsversion <n> wird nicht unterstützt.`
- REQ-009-AC1: Given a configured view, When the user saves, reloads the page, loads the same IFC, loads the configuration and saves again, Then the second JSON equals the first and covers every field listed above.
- REQ-009-AC2: Given a configuration that references a property and a filter value absent from the loaded model, When it is loaded, Then the rest is applied and the notice names both.
- REQ-009-AC3: Given one file per error class, Then the message of that class is shown and a configuration saved afterwards equals the one saved before.

### REQ-010: Export the offline viewer file
- Priority: must · Source: UC 9, F-03, C02
- `HTML exportieren` (UI-01) downloads one self-contained HTML file containing the models, the extracted element data, the runtime and the current configuration.
- The viewer file works by double-click from the file system without internet and without installation. It offers REQ-003 to REQ-008 and the REQ-011 header, starting from the exported configuration; it offers no IFC loading, no configuration save/load and no `HTML exportieren` (UC 9: 2–7).
- Changes in the viewer file are not persisted; reopening shows the exported state.
- REQ-010-AC1: Given an exported viewer file, When it is opened via `file://` in a browser context with all network access blocked, Then model, filter sets and table appear in the exported state and no network request is made.
- REQ-010-AC2: In that viewer file the user can change filters, filter sets, columns, grouping and model display and export CSV/Excel; for the same configuration and the same actions the CSV equals the builder's CSV.
- REQ-010-AC3: The viewer file has no controls for loading IFC, saving/loading configuration or exporting HTML.

### REQ-011: Title, date and logo
- Priority: should · Source: C99, ASM-002
- The builder sets a title (default: first model's `Modell` value), a date (default: today) and optionally a logo image (PNG/JPG/SVG, embedded); they appear in the header of builder and viewer file and in export file names.
- REQ-011-AC1: Given title `The M Bouwkundig`, date `2026-08-12` and a logo, Then the viewer file's header shows all three, and its CSV export is named `The M Bouwkundig_2026-08-12.csv`.

### NFR-001: Interaction speed
- Target: with ≥ 30,000 elements loaded, a filter click, column filter change, sort, view switch or regrouping updates filter sets, table and 3D state within ≤ 500 ms, measured from the input event until all three show the new result (performance marks); median of 3, Chromium. Includes filter sets on `Name` and `GlobalId` (≈ one value per element) and opening the `Name` column-filter checklist. · Verify by: T6 on the volume set.

### NFR-002: Model size
- Target: a single IFC of ≥ 100 MB and a multi-model set of ≥ 100 MB total load in the builder without worker or tab crash, with progress for conversion and extraction, in ≤ 60 s per 100 MB IFC (median of 3, environment and peak memory recorded). · Verify by: T6 with the synthetic ≥ 100 MB fixture and the multi-model set (Testing → Test data); smoke check already in TASK-002.

### NFR-003: Viewer file start
- Target: a viewer file built from ≥ 100 MB of IFC opens offline and is usable in ≤ 15 s; its size is ≤ 40 % of the source IFC size. · Verify by: T6.

### NFR-004: Export duration
- Target: CSV/Excel export of 30,000 rows × 20 columns completes in ≤ 5 s with a progress indication; no main-thread block > 1 s (long-task observer). · Verify by: T6.

### NFR-005: Offline operation
- Target: the viewer file makes zero network requests; the builder needs network only to fetch the libraries from jsDelivr (as the reference app). · Verify by: T3/T5 with network blocked and request logging.

### User interface
- Screens (UI-01): one screen; layout from the user's screenshot (structure only, F-01):
  ```
  ┌ Header: Logo · Titel · Datum ··········· [Builder: IFC laden | Konfiguration speichern | Konfiguration laden | HTML exportieren] ┐
  ├───────────────┬──────────────────────────────────────────────┬──────────────────┤
  │ FILTER        │ 3D-Modell                                    │ ELEMENT-DETAILS  │
  │ [+ Filtersatz]│  top right: Elemente außerhalb des Filters,  │ (Klick auf ein   │
  │ ▸ Kategorie   │  Färben nach, Schnitt; legend bottom          │  Element …)      │
  │ ▸ Geschoss    ├──────────────────────────────────────────────┤                  │
  │ ▸ Material    │ TABELLE: [Einzelelemente|Gruppiert] Gruppe 1/2,│                  │
  │ …             │ [Spalten] [Export CSV] [Export Excel]; table  │                  │
  └───────────────┴──────────────────────────────────────────────┴──────────────────┘
  status line: X von Y Elementen
  ```
  Filter area ~280 px, details ~320 px (collapsible), splitter between model and table (default 55 % / 45 %).
- Look and feel (UI-02): light HTML Model Viewer style — accent `#D72622`, ink `#35383A` / `#4E5355` / `#6B6F73` / `#A4A8AC`, backgrounds `#f4f5f6` / `#eceef0`, lines `#e1e3e5`, 13–14 px "Segoe UI"/system-ui, inline SVG icons; not the dark colours of the screenshot.
- Devices: desktop browsers, window ≥ 1280 px (UI-01); below that the side panels collapse.
- Language: German UI texts and number formatting.
- Feedback: progress overlay with step and percentage for conversion, extraction and exports; error messages as defined per requirement; status line `X von Y Elementen` always visible.

### Constraints
- CON-001: One hand-written HTML file for the builder, plain JavaScript, no build step (STK-01).
- CON-002: Same engine and loading pattern as the reference app: `@thatopen/fragments@3.4.7` with the `three` and `web-ifc` versions its jsDelivr `+esm` graph imports; all modules linked to Blob URLs (`tovLinkModules`, ref L163-192), workers as classic Blob workers with inlined source (ref L776-777) — works from `file://` and in sandboxed frames.
- CON-003: The viewer file needs no network, no storage APIs and no installation; it embeds everything.
- CON-004: No server, no login, no telemetry; all data stays on the user's computer (C02, C07).
- CON-005: The repository `html-modelviewer` stays unchanged; code and style are copied from it (C08).

## 3. Out of scope
- Editing IFC data or writing IFC files.
- Persisting changes made in a viewer file; configuration save/load in the viewer file (F-04, UC 9).
- Login, server-based sharing, cloud storage.
- Phones and tablets (UI-01).
- Aggregations other than count and sum (FUN-x3).
- More than two grouping levels (F-02).
- Several named views per file (not requested; C99 "Nein, das ist alles"; one configuration per file, UC 8/9).
- IFC classification references, MEP systems/groups and material layer thicknesses as properties — narrows DAT-01 "All IFC data" to its listed sources (DEC-11); candidates for a later change.

## 4. Design

### 4.1 Stack
- Builder: `calc-viewer-builder.html` at the repository root, plain JS, no framework (CON-001).
- Engine: `@thatopen/fragments@3.4.7`; `three` at the version that `fragments@3.4.7/+esm` imports (currently `0.185.1`) and `web-ifc@0.0.77`, all from jsDelivr. The `three` and OrbitControls aliases point to the key found in the crawled graph (as ref L2085-2090), so exactly one three version is loaded (DEC-10). Drift guard: constants `EXPECTED_THREE = "0.185.1"`, `EXPECTED_WEBIFC = "0.0.77"`; after the crawl the builder checks that exactly one `/npm/three@…/` version exists and both match, else it stops with `Unerwartete Bibliotheksversion von jsDelivr: <lib> <found> statt <expected>.`; the versions are written into the viewer file's generator meta.
- Exports: own `.xlsx` writer (ZIP via `CompressionStream('deflate-raw')`, shared strings, styles, frozen header, autofilter) and own CSV writer — no libraries (ASM-004).
- Dev tooling (Node 22, not shipped): `prettier@3.9.10`, `eslint@9.39.5`, `@eslint/js@9.39.5`, `eslint-plugin-html@8.2.1`, `globals@17.14.0`, `c8@12.0.0`, `@playwright/test@1.63.0` (matches the preinstalled Chromium), `node:test`; Python 3 with `openpyxl==3.1.5` as the independent xlsx reader in tests (installed by the `install` command; missing openpyxl fails the test).

### 4.2 Structure
```
calc-viewer-builder.html
  <style id="cv-css">                         shared styles (builder + viewer file)
  <script type="text/plain" id="cv-core-src">  pure logic, no DOM, no imports: property model, units, column store,
                                               filter engine, facet counts, grouping/sums, sorting, CSV/XLSX writers,
                                               config schema, table encoding
  <script type="text/plain" id="cv-ui-src">    DOM: layout, filter area, table (virtualised), details, dialogs; imports calc-core
  <script type="text/plain" id="cv-3d-src">    engine start, model display, ghost/hide, colouring, section, picking,
                                               CalcView.state(); imports three, @thatopen/fragments, OrbitControls
  <script type="text/plain" id="cv-app-src">   entry: start({mode: 'builder'|'viewer', …}) wires ui + 3d
  <script type="text/plain" id="cv-viewer-bootstrap">  classic bootstrap of the viewer file (reads payloads, links, starts)
  <script type="module" id="cv-builder">       builder-only (real inline module, no bare imports): CDN crawl + drift guard,
                                               linking via tovLinkModules (aliases three, @thatopen/fragments,
                                               OrbitControls, calc-core → cv-core-src, …), conversion worker, extraction,
                                               config save/load, HTML export; then start({mode: 'builder'})
scripts/   vendor-cdn.mjs (fetch + sha256 lock of jsDelivr files for tests), fetch-fixtures.mjs (download + sha256,
           generates the synthetic ≥ 100 MB IFC), serve.mjs (static server), check.mjs (fail-fast check sequence)
test/      load-core.mjs (extracts cv-core-src for Node, line-preserving), unit/, integration/, e2e/ (Playwright,
           projects `file` and `http`, network-guard fixture serving the CDN cache), perf/,
           fixtures/ (small committed fixtures, manifest with source/licence/sha256, reference-values.json)
```
- The **viewer file** is generated from a fixed skeleton, never from the live DOM: cv-css text, the `tovLinkModules`/gunzip helpers, `cv-viewer-bootstrap`, and gzip+base64 payloads — runtime `{sources: library modules + web-ifc stub (ref L2065-2104) + cv-core/cv-ui/cv-3d/cv-app, aliases, worker}`, one `.frag` per model, element table + catalogue, configuration, logo. The bootstrap calls `start({mode: 'viewer'})`, which omits the builder controls.
- Embedded sources must not contain `</script>` and are ASCII-only (non-ASCII as `\u` escapes, as ref L116-120); a unit test checks this.

### 4.3 Data
- **Element row**: key `<modelId>:<localId>`; `guid`; `geometry` (bool); `values`: sparse map propertyKey → number | string | string[] (multi) — the source of truth.
- **Property catalogue**: propertyKey → {label, group (`Allgemein` | pset | `Typ: <pset>` for type-only psets), kind (`number` | `text` | `multi` | `bool`), unit (incl. `gemischt`), count}. Special keys: `Modell`, `Kategorie`, `Name`, `GlobalId`, `ObjectType`, `Tag`, `PredefinedType`, `Description`, `Typ`, `Geschoss`, `Material`, `Geometrie`.
- **Column store** (lazy): dense typed arrays / dictionary codes plus value bitsets are built only for properties currently used as filter set, column filter, sort key, grouping key or colouring, cached and dropped when unused. Facet counts per set are computed against the AND of all other sets (spike: 1–5 ms for 28k rows).
- **Configuration**: REQ-009; properties referenced by propertyKey, filter values by value.
- **Extraction** (spike-proven): element ids via `getItemsOfCategories` minus spatial and type classes (IfcSpace by option); data via `getItemsData` in chunks of ~2,000 ids per model (as ref `INDEX_CHUNK_SIZE`) with progress and yielding, relation config explicit: `IsDefinedBy`, `HasAssociations`, `HasPropertySets` on, all inverse relations off (else cycles and fan-out); type via `IsDefinedBy` → type object; storey via `getSpatialStructure()`; units via IfcUnitAssignment. Importer: default classes plus IfcDoorStyle, IfcWindowStyle, IfcConversionBasedUnit, IfcMeasureWithUnit. IFC bytes are released after conversion; only `.frag` bytes per model are kept for the viewer export.

### 4.4 Interfaces
- User: file picker / drop zone (IFC, configuration JSON, logo image); downloads (CSV, XLSX, JSON, HTML).
- `CalcCore` (pure, unit-tested in Node): `buildCatalog`, `convertUnit`, `filterRows`, `facetCounts`, `groupRows`, `sortRows`, `toCsv`, `toXlsx`, `validateConfig`, `applyConfig`, `encodeTable`/`decodeTable`, `safeFileName`.
- `CalcView.state()` (test seam in cv-3d): `{mode: 'ghost'|'hide', opaque: Set<key>, ghost: Set<key>, hidden: Set<key>, colours: Map<key, '#rrggbb'>, selected: Set<key>, section: {axis, offset, flipped} | null}` — derived from the calls cv-3d makes to the fragments engine (visibility, highlight, clipping), not from cv-core's filter result.
- Fragments mapping (as ref L979-1169): ghost = highlight with a transparent material, hide = `setVisible(false)`, colouring = one highlight call per colour bucket, selection = highlight re-applied last.

### 4.5 UI
As in §2 User interface. Components copied from the reference CSS (chips, checklists, dialogs, icons) and extended for virtualised value lists, table and splitters.

### 4.6 Error handling and configuration
- Every async step (load, convert, extract, export) runs with a progress overlay; errors are shown with the classified messages; a failing model is skipped, the rest continues.
- No runtime configuration besides the user's configuration file.

### 4.7 Decisions taken without asking (shown at the release gate)
| # | Decision | Reason |
|---|---|---|
| DEC-1 | Occurrence value wins over type value; one merged property | IFC semantics; one column per property |
| DEC-2 | Length/area/volume converted to m/m²/m³ (SI prefixes and conversion-based units); other units unchanged; mixed units → `gemischt`, no sums | screenshot shows m-based quantities; avoids wrong sums |
| DEC-3 | Aggregates (e.g. IfcStair, IfcCurtainWall) and their parts are both rows; sums include both (ASM-006) | data shown as in the model; filter by Kategorie possible |
| DEC-4 | Same GlobalId in two models → two rows (key model+localId) | disciplines may overlap; `Modell` distinguishes them |
| DEC-5 | Text that looks numeric stays text | avoids wrong sums |
| DEC-6 | CSV text cells starting with `= + - @` get a `'` prefix | formula-injection protection; numbers unaffected |
| DEC-7 | Viewer file contains the pre-extracted element table | avoids web-ifc (3.5 MB) and multi-second extraction for colleagues |
| DEC-8 | Supported browsers: current Chrome and Edge; Firefox best effort (ASM-007) | Chromium is the tested engine |
| DEC-9 | Single-element and grouping view share one column set | the user builds one view (F-02) |
| DEC-10 | three at the version fragments 3.4.7 imports (0.185.1), with drift guard | one three copy; reproducible |
| DEC-11 | Classification references, systems/groups, layer thicknesses deferred | not in the DAT-01 enumeration |
| DEC-12 | Duplicate file names get ` (2)`, ` (3)` in `Modell` | each model needs its own filter value |
| DEC-13 | IfcSpace off by default, option to include | as the reference app; avoids room volumes mixing into element sums |
| DEC-14 | A checked filter value with 0 hits stays visible (count 0) | otherwise it could not be unchecked; deviates from "only clickable values" only for checked values |
| DEC-15 | Colouring rules (120 distinct, 24 numeric steps, `mehrere Werte`, `(leer)`, precedence) | as the reference app; defined behaviour for multi-values |
| DEC-16 | Grouping by a multi-valued property counts an element in each of its groups; total counts once (ASM-008) | only alternative would drop or arbitrarily assign elements |
| DEC-17 | Numeric column filter bounds inclusive; empty values excluded while a bound is set | common spreadsheet behaviour |

### 4.8 Spike results (2026-11-02, scratchpad, independently re-checked)
- Conversion (Node and Chromium): 2.4–49 MB IFC → `.frag` 7–16 % of IFC size, ~0.2 s per IFC MB; localId = STEP id; GlobalIds stable across conversions, localIds not across IFC re-exports.
- Extraction: 28k elements (4 models) in Chromium 2–3 s one-off, facet pass 1–5 ms; one model had 6,859 distinct pset properties.
- Some elements lose geometry in conversion (e.g. 55 walls in one model) → `Geometrie` = `Nein`.
- `.xlsx` writer validated with openpyxl and LibreOffice; 30k×12 in 0.5–1 s; 60k×60 sparse ~4.7 s.
- 50 MB embedded payload: download and offline decode from `file://` work (decode ~0.3 s).
- Module workers from Blob URLs fail under `file://`; classic Blob workers work. In a test page opened via `file://`, `FragmentsModels.load` hung (root cause unknown; the page did not use the reference's full pattern) → risk R-1, proven in TASK-001.
- jsDelivr `fragments@3.4.7/+esm` imports `three@0.185.1` by absolute path → DEC-10.

### Testing
| Type | Concrete form for this project |
|---|---|
| T1 Unit | `node:test` on cv-core extracted by `test/load-core.mjs`: catalogue, units (prefix, conversion-based, mixed), filter/facet logic (OR/AND, hidden values, checked zero values), grouping incl. multi-valued and `(leer)`, sums, sorting, range filter bounds, CSV/XLSX writers, file names, config validation/apply, table encoding, ASCII/`</script>` check of embedded sources. Coverage gate: ≥ 70 % lines of cv-core (calibration S), target 90 % |
| T2 Integration | Playwright in-page: fixture IFC → conversion worker → extraction → catalogue/rows against `reference-values.json`; config save → load round trip; exports read back with openpyxl |
| T3 System | builder from a clean checkout via `file://` and via the static server in a fresh profile, CDN served from the hash-locked cache; exported viewer file opened via `file://` in a new context with all network blocked, request log empty (NFR-005) |
| T4 E2E | one Playwright flow per use case 1–9 through the UI, plus "build → export HTML → colleague adjusts and exports CSV"; one render smoke test (canvas non-empty; ghost vs hide give different canvas output) |
| T5 Acceptance | every REQ-…-AC and NFR has ≥ 1 test tagged with its ID; 3D ACs assert `CalcView.state()`, REQ-005-AC2 also compares legend and filter-set dots in the DOM, REQ-007-AC1 clicks the projected screen position |
| T6 Performance | Playwright timings with performance marks: NFR-001 on the volume set; NFR-002 on the synthetic ≥ 100 MB IFC and the ≥ 100 MB multi-model set; NFR-003, NFR-004; Node micro-benchmarks for cv-core; median of 3, environment and peak memory recorded |
| T7 Robustness | every load error class, empty/huge/odd files, thousands of properties (6,859-property model + volume set: column store holds only in-use properties, peak heap reported), elements without geometry/material/storey, special characters and long texts in values and titles, every config error class, cancelled file dialogs, removing models with active filters, HTML/script strings in IFC values rendered as text (no XSS) |
| T8 Regression, T9 Smoke | `test_all` after every change; smoke (`@smoke`) = builder starts, loads the small fixture, shows table |
| T10 Security | ○ no login or sensitive data; covered: formula injection (REQ-008-AC4), escaping of model strings (T7), no network in the viewer file (T3) |
| T11 Usability | heuristic review of the screen against §2 User interface |
| T12 Compatibility | Chromium automated; Chrome/Edge manual smoke at release; Firefox best effort (ASM-007) |
| T13 Migration | – no data migration; config versioning covered by T7 |
| T14 Exploratory | 2 charters: "build a quantity overview for a real project", "break the viewer file as a colleague" |

Tags: node:test names carry `[unit]`/`[perf]` prefixes; Playwright titles carry `@integration @system @e2e @acceptance @perf @robustness @smoke` plus requirement IDs (`@REQ-004-AC2`). Each type runs alone via `npx playwright test --grep @<tag>` or `node --test --test-name-pattern='\[<tag>\]'`. `test_fast` = unit + integration on committed fixtures; `test_all` = all suites incl. fetched fixtures; `check` = `node scripts/check.mjs`.

Test data:
- Committed small fixtures: `AC20-FZK-Haus.ifc` (IFC4), Duplex architecture (IFC2X3), error-class fixtures (empty, renamed PDF, IFC4X3 header, truncated IFC), configuration files per error class; unit fixtures derived from FZK-Haus by a committed script: `fzk-feet.ifc` (length unit IfcConversionBasedUnit foot) and `fzk-unit-a.ifc` / `fzk-unit-b.ifc` (one numeric non-length property with different units, for `gemischt`); manifest with source URL, licence and sha256.
- Fetched by `scripts/fetch-fixtures.mjs` with sha256 check: SampleCastle (49 MB), Revit MEP (29 MB, mm units, `Qto_WallBaseQuantities`), Revit ARC, Duplex MEP. The script also generates reproducibly a synthetic single IFC ≥ 100 MB from SampleCastle (renumbered STEP ids, new GlobalIds, offset copies) and records its sha256. Volume set: ≥ 30,000 elements from several fixtures/copies with distinct file names. Multi-model set: ≥ 100 MB total.
- `test/fixtures/reference-values.json`: reference elements of `AC20-FZK-Haus.ifc` by GlobalId (≥ one wall, slab, door, window, an element without material or storey if present, an element without geometry if present) with expected Kategorie, Name, GlobalId, Typ, Geschoss, Material and quantities; expected key sets for the AC filters; the 2,000-element filter on a fetched fixture. Values are taken independently of the extraction code (read from the IFC STEP text or by a separate script whose output is committed) and reviewed by a fresh-context tester, not by the TASK-002 implementer.
- No real project data in the repository (ASM-003).

## 5. Tasks  _(working section)_

Every task: read `AGENTS.md`, this spec §2 entries it implements, §4; done when its acceptance tests pass and `node scripts/check.mjs` is green.

| ID | Title | Implements | Depends on | Touches | Status |
|---|---|---|---|---|---|
| TASK-001a | Toolchain: package.json, prettier/eslint/c8/Playwright/openpyxl install, vendor-cdn + lock, fetch-fixtures (incl. synthetic 100 MB), serve, check.mjs, pre-commit, AGENTS.md §4 | enabler | – | repo root, scripts/, test/, .githooks/ | done |
| TASK-001b | Walking skeleton: builder links modules (drift guard), converts one IFC in a classic worker, shows it in 3D — via `file://` and http (R-1) | CON-002, REQ-001 (part) | 001a | calc-viewer-builder.html, test/e2e | done |
| TASK-002 | Extraction and property model: importer config, element list, attributes/psets/type psets/storey/material/model/geometry, units, catalogue; multi-model, remove, duplicates, error classes, IfcSpace option; 100 MB smoke | REQ-001, REQ-002 | 001b | cv-core, cv-builder, test/ | done |
| TASK-003 | Filter engine: lazy column store, OR/AND, facet counts with hidden and checked-zero values, column filters (text, range), sorting | REQ-004 (logic), REQ-006 (filter/sort logic) | 002 | cv-core, test/unit | done |
| TASK-004 | Layout and filter area: screen layout, styles, virtualised value lists, filter sets (catalogue dialog, add/order/collapse/remove, defaults), reset, status line | REQ-003, REQ-004, REQ-001-AC1 (Modell set) | 003 | cv-css, cv-ui, cv-app, test/e2e | done |
| TASK-005 | 3D coupling: ghost/hide, colouring + legend, section, `CalcView.state()`, picking and details panel | REQ-005, REQ-007-AC1/AC4/AC5 (3D side) | 004 | cv-3d, cv-ui | done |
| TASK-006a | Table single-element view: virtualisation, column chooser/order/width/remove, sort, column filter UI; full filter coupling table + 3D | REQ-006 (AC1, AC4–AC6, AC9), REQ-004-AC1/AC4 (table + 3D), REQ-001-AC3/AC4 (full) | 004, 005 | cv-ui, cv-core | todo |
| TASK-006b | Grouping view: 2 levels, `Gruppe`/`Anzahl`/sums, `(leer)`, multi-valued, expand/collapse, total row | REQ-006 (AC2, AC3, AC7, AC8, AC10) | 006a | cv-core, cv-ui | todo |
| TASK-006c | Selection both directions: table ↔ 3D, group row selection, expand on selection | REQ-007-AC2/AC3 | 005, 006b | cv-ui, cv-3d | todo |
| TASK-007 | Title/date/logo, configuration save/load with schema and tolerant apply | REQ-011, REQ-009 | 005, 006b | cv-core, cv-builder, cv-ui | todo |
| TASK-008 | CSV and XLSX export of the current table view incl. file names | REQ-008 | 007 | cv-core, cv-ui | todo |
| TASK-009 | Viewer file export: skeleton, payloads, bootstrap, viewer mode, offline start | REQ-010, NFR-003, NFR-005 | 006c, 008 | cv-builder, cv-viewer-bootstrap, cv-app | todo |
| TASK-010 | Performance and robustness pass: volume and 100 MB sets, NFR measurements, fixes | NFR-001..004, T7 | 009 | all | todo |

Task details (context to read · acceptance):
- TASK-001a · read: process/calibration/testing.md §4, spike notes in §4.8 · acceptance: from a clean clone `npm ci`, `node scripts/vendor-cdn.mjs`, `node scripts/fetch-fixtures.mjs` succeed; `node scripts/check.mjs --all` green with a placeholder unit and smoke test; pre-commit blocks a misformatted file; AGENTS.md §4 filled.
- TASK-001b · read: modelviewer-analysis.md, ref L163-192, L1669-1710, L1940-2113, L2186-2205 · acceptance: `@smoke` Playwright test loads `AC20-FZK-Haus.ifc` in the builder opened via `file://` and via http with the network guard active and asserts the model is loaded (fragments model count, non-empty canvas); drift-guard unit test (wrong version → message). If `file://` cannot be made to work: stop and record a blocking question (fallback candidate: run the app inside a sandboxed `srcdoc` frame as the reference preview).
- TASK-002 · read: §4.3, §4.8, modelviewer-analysis.md (data section) · acceptance: REQ-001-AC2, AC5 and the data-level part of AC3/AC4 (rows and catalogue), REQ-002-AC1..AC7 tests green; ≥ 100 MB multi-model set converts and extracts in Chromium without crash, time and peak heap recorded in §6 — if not, stop and record a blocking question (R-2).
- TASK-003 · read: §4.3 column store, §4.4 · acceptance: unit tests for REQ-004 logic, REQ-006-AC5/AC9 logic, multi-valued facets; perf micro-benchmark facet pass ≤ 50 ms at 30k rows.
- TASK-004 · read: §2 User interface, §4.5, ref CSS L1714-1938 · acceptance: REQ-003-AC1..AC3, REQ-004-AC2/AC3 and the filter-set part of AC1/AC4, REQ-001-AC1 green.
- TASK-005 · read: §4.4, modelviewer-analysis.md, ref L979-1169 · acceptance: REQ-005-AC1..AC4, REQ-007-AC1/AC4/AC5 green; render smoke test green.
- TASK-006a/006b/006c · read: §2 REQ-006/REQ-007, §4.3, §4.4 · acceptance: the ACs listed in the table green.
- TASK-007 · read: §2 REQ-009/REQ-011, §4.3 · acceptance: REQ-009-AC1..AC3, REQ-011-AC1 (header part) green.
- TASK-008 · read: §2 REQ-008, §4.8 (xlsx writer notes) · acceptance: REQ-008-AC1..AC5, REQ-011-AC1 (file name) green; openpyxl read-back.
- TASK-009 · read: §4.2, modelviewer-analysis.md, ref L116-120, L163-192, L1669-1710, L2065-2104, L2217-2340 · acceptance: REQ-010-AC1..AC3 green with the viewer file opened via `file://` in a network-blocked context; NFR-005 request log empty.
- TASK-010 · acceptance: NFR-001..004 measured and met (or deviation recorded for the release gate); full T7 suite green.

## 6. Testing results  _(working section)_

| AC / NFR | Test(s) | Type | Status |
|---|---|---|---|

## 7. Open points  _(working section)_
- Risks: R-1 `file://` engine start — resolved in TASK-001b (module workers from blob:null never start; classic worker works); R-2 memory at ≥ 100 MB IFC (smoke in TASK-002, tuning in TASK-010); R-3 Excel itself not available in the test environment (structure validated with openpyxl/LibreOffice; manual check at release); R-4 3D update time at 30k elements not yet measured (TASK-005/TASK-010).
- Assumptions: `docs/open-questions.md` ASM-001…ASM-008.

## Change history

| Date | CR | Request | Category | Affected IDs | Risk check (R4/R5/R7) | Tests run | Result / PIR |
|---|---|---|---|---|---|---|---|
| 2026-11-02 | – | spec approved at agent gate after independent review (3 lenses + adversarial verification, fresh context; re-check: 30/33 resolved, remaining 3 partly + 5 new defects fixed) | – | REQ-001..011, NFR-001..005 | – | – | approved (independence: separate contexts) |
