# Changelog

All notable changes to Calc Viewer Builder are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.0.0]: https://github.com/erik-hellrung-str2/simple-calc-browser/releases/tag/v1.0.0
