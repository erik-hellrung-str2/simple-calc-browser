# Changelog

All notable changes to Calc Viewer Builder are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - unreleased - pending release gate

CR-002: filter, properties and 3D tools as in the HTML Model Viewer. Details: `docs/release/release-notes-1.1.0.md`.

### Added
- Toolbar `3D-Werkzeuge` inside the 3D view with `Fokus`, `Filter` and `Färben`, a navigation hint pill and a title chip (REQ-005).
- Filter panel with the search `Suchen nach Objekten` and rules from the dialog `Filter bearbeiten`: actions `Isolieren`, `Ausblenden`, `Markieren`, `Freie Textsuche`; comparisons `Gleich`, `Beginnt mit`, `Endet mit`, `Enthält`; rules combine with AND with the filter sets and column filters (REQ-012).
- Click menu in 3D with `Ausblenden`, `Isolieren` and `Schneiden`; hidden and isolated elements act as filters on table, counts, sums and export; click section with the handle `Schnitt verschieben` (REQ-013).
- Pills `Filter entfernen` (with the ghost toggle), `Einfärbung entfernen`, `Isolierung entfernen`, `Ausblendung entfernen`, `Schnitt entfernen`.
- Filter-area entries `Ausgeblendet`, `Isoliert`, `Filterregeln`, `Suche`, each with × (REQ-004).
- Floating properties panel with `Ausblenden` / `Isolieren` and the row tools `Nach Wert filtern` and `Farbe nach Wert` (REQ-003, REQ-007).
- Colouring panel with `Unterschiedliche Farben` / `Farbskala`, scale swatches and `Eigene Farbe`, legend in the panel (REQ-005, DEC-15).
- Configuration fields `filterRules`, `search`, `display.colourMode`, `display.scaleColour`, `display.sectionPlane` (still `calc-viewer-config/1`, DEC-20); the viewer file offers all new features.

### Changed
- The right column `Element-Details` and its `Details` drawer are removed; the 3D view and the table reach the right edge.
- `Alle Filter zurücksetzen` also clears rules, search, hidden and isolated elements.
- `Ansicht einpassen` is replaced by `Fokus`, which fits the shown elements into the part of the 3D view not covered by open panels.
- `Färben nach` and the legend under the model are replaced by the colouring panel; more than 120 values repeat colours instead of `Sonstige`.
- The switch `Elemente außerhalb des Filters` is replaced by the ghost toggle `Ausgeblendete verbergen` / `Ausgeblendete anzeigen` in the pill `Filter entfernen`.
- The X/Y/Z `Schnitt` is replaced by `Schneiden`; a 1.0.0 axis section in a configuration is converted to a plane.

### Fixed
- BUG-T2: long values such as a GlobalId broke mid-word in the element details.
- BUG-T4: the red NFR-001 3D frame test on software rendering is not reproduced in 1.1.0 (no code change).
- BUG-T5 to BUG-T10: long names, legend values and rule values overflowing panels, table rows short of the right edge, click menu over the properties panel, `Esc` in the property suggestions closing the whole dialog.
- BUG-T11: open panels covered the model after `Fokus` at 1280 × 800.

### Known issues
- Pixels of a 3D update reach the screen 0.7–1.2 s after a click on PCs without a GPU (Q-002); `Farbskala` labels span all elements (BUG-T12); a configuration section far outside the model looks empty (BUG-T13); see the release notes.

## [1.0.0] - 2026-11-03

First release. Details: `docs/release/release-notes-1.0.0.md`.

### Added
- Builder `calc-viewer-builder.html`: a single HTML file that runs by double-click or from a static server; libraries (That Open Fragments 3.4.7, three 0.185.1, web-ifc 0.0.77) loaded from jsDelivr with a version drift guard.
- Loading of one or more IFC2X3 / IFC4 models via `IFC laden` or drag and drop, with progress, model removal, duplicate-name suffixes and the option `Räume (IfcSpace) einbeziehen` (REQ-001).
- Classified German load errors for empty, non-IFC, unsupported-schema, unreadable and too-large files, plus a conversion watchdog (REQ-001).
- Extraction of attributes, psets, qsets, type psets, `Typ`, `Geschoss`, `Material`, `Modell` and `Geometrie` per element, with unit conversion to m / m² / m³ and `gemischt` for mixed units (REQ-002).
- Filter sets from a searchable property catalogue, with defaults `Kategorie`, `Geschoss`, `Material`, reorder, collapse and remove (REQ-003).
- Faceted filtering with OR / AND logic, live counts, `(leer)` values and `Alle Filter zurücksetzen` (REQ-004).
- 3D view with ghost / hide for elements outside the filter, `Färben nach` with legend, `Schnitt` on X / Y / Z and `Ansicht einpassen` (REQ-005).
- Quantity table with `Einzelelemente` and `Gruppiert` views (two levels, `Anzahl`, sums, `Summe`), configurable columns, sorting, column filters, virtualised rows and keyboard navigation (REQ-006).
- Selection in 3D and table in both directions with the `Element-Details` panel (REQ-007).
- `Export CSV` and `Export Excel` (own `.xlsx` writer) of exactly the rows shown, with formula-injection protection (REQ-008).
- `Konfiguration speichern` / `Konfiguration laden` (`calc-viewer-config/1`) with tolerant apply and a notice for skipped parts (REQ-009).
- `HTML exportieren`: a self-contained offline viewer file with models, element data and configuration, zero network requests (REQ-010).
- Title, date and logo in the header and in export file names (REQ-011).
- Responsive drawers below 1280 px window width (`Filter`, `Details`); a new message opens the filter drawer.
- Dev tooling: `scripts/check.mjs`, `scripts/serve.mjs`, `scripts/vendor-cdn.mjs`, `scripts/fetch-fixtures.mjs`, `scripts/trace.mjs`; unit, integration, system, E2E, acceptance, performance and robustness suites.

### Fixed
- BUG-T1: load errors and configuration messages were invisible below 1280 px window width.
- BUG-T3: the filter drawer reopened when a message was removed.

### Known issues
- NFR-001 on PCs without a GPU: the 3D view lags behind filter clicks at ≥ 30,000 elements (BUG-T4); BUG-T2 GlobalId wraps mid-word in the details panel; see the release notes.

[1.1.0]: https://github.com/erik-hellrung-str2/simple-calc-browser/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/erik-hellrung-str2/simple-calc-browser/releases/tag/v1.0.0
