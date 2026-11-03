---
version: 1.0.0
date: 2026-11-03
status: released     # draft | approved | released
relates_to: [INC-1, CR-001, REQ-001, REQ-002, REQ-003, REQ-004, REQ-005, REQ-006, REQ-007, REQ-008, REQ-009, REQ-010, REQ-011, NFR-001, NFR-002, NFR-003, NFR-004, NFR-005, BUG-T1, BUG-T2, BUG-T3, BUG-T4, CR-A, Q-001, Q-002, R-3, T12]
---
# Release 1.0.0 — Calc Viewer Builder

First release (cycle 1, increment INC-1). Released as tag `v1.0.0` (includes the BUG-T3 fix from commit `8834cc7`). Test basis: `docs/testing/report-INC-1.md` (recommendation **GO WITH DEVIATIONS**), `docs/reviews/verification-INC-1.md`, `docs/tasks/TASK-010.md`. Release gate outcome (approved 2026-11-03): `docs/release/decisions-to-confirm.md`.

## Highlights
- **One HTML file, no installation:** `calc-viewer-builder.html` opens by double-click (`file://`) or from any static web server. It loads one or more IFC models (IFC2X3, IFC4), converts them in the browser and lets you explore them like a report: filter sets on the left, 3D model in the centre, quantity table below, element details on the right.
- **Filter, group, sum:** any property (attributes, property sets, quantity sets, type property sets, `Typ`, `Geschoss`, `Material`, `Modell`) can be a filter set, a column, a grouping level or a colouring. Grouping view with two levels, `Anzahl` and sums; length, area and volume converted to m, m², m³.
- **Export:** the current table as CSV or Excel (`.xlsx`), the whole view as a configuration (JSON), and the whole view **with the models** as one offline viewer file (`HTML exportieren`) that colleagues open by double-click without internet and can still filter, group and export.
- **Tested at scale:** 30,931 elements (volume set), a 151.8 MB IFC and a 127.7 MB multi-model set in headless Chromium without GPU (NFR results below and in `docs/testing/report-INC-1.md` §4).

## Features
| REQ | Description (as built) |
|---|---|
| REQ-001 | Load IFC2X3 / IFC4 files with `IFC laden` (several at once) or by dropping them anywhere on the page; progress per file (`Konverter wird geladen`, `Datei wird gelesen`, `Konvertierung`, extraction). Models are combined; the property `Modell` names each element's model, a repeated file name gets ` (2)`, ` (3)`. Models can be added later and removed (`×`, `Modell entfernen`). Option `Räume (IfcSpace) einbeziehen` (default off). Five classified German load errors that always name the file; a failing file is skipped, the rest stays loaded. |
| REQ-002 | Per element: `Kategorie`, `Name`, `GlobalId`, `ObjectType`, `Tag`, `PredefinedType`, `Description`, all psets and qsets of the element and of its type (occurrence wins), `Typ`, `Geschoss`, `Material` (multi-valued), `Modell`, `Geometrie` (`Ja` / `Nein`). Units: length/area/volume to m/m²/m³ incl. mm and feet; differing units across models → `(gemischt)`, no sums. Numeric-looking texts stay text; booleans `Ja` / `Nein`. Openings and distribution ports are not rows (CR-A approved at the release gate and applied to the spec as CR-001 (no code change)). |
| REQ-003 | `+ Filtersatz` opens a searchable property catalogue (`Allgemein`, then by pset, with element counts); filter sets can be reordered (drag and drop or up/down), collapsed and removed. Defaults: `Kategorie`, `Geschoss`, `Material`. |
| REQ-004 | Checkbox values with counts and colour dots; OR within a filter set, AND across sets and column filters; counts computed under all other filters; checked values with 0 hits stay visible; `(leer)` last; per-set reset and `Alle Filter zurücksetzen`; long value lists are virtualised with a search field. |
| REQ-005 | 3D view with orbit/pan/zoom and `Ansicht einpassen`; `Elemente außerhalb des Filters`: `Geist` (transparent) or `Ausblenden`; `Färben nach` <property> with legend (120 distinct colours, `Sonstige`, 24-step numeric scale, `mehrere Werte`, `(leer)`); `Schnitt` on X / Y / Z with slider and `Schnitt umkehren`. |
| REQ-006 | Table `Einzelelemente` / `Gruppiert` (one or two grouping levels, `Gruppe`, `Anzahl`, sums, `(leer)` group, `Summe` total row, `Alle aufklappen` / `Alle zuklappen`). Columns from the catalogue via `Spalten`, reorder, resize, remove; defaults `Modell`, `Kategorie`, `Name`, `Geschoss`. Sorting and column filters (text checklist; numeric `von` / `bis`, inclusive) per header. German number format. Virtualised rows; keyboard row cursor (arrows, Page, Home, End, Enter / Space, Right / Left for groups). Status line `X von Y Elementen`. |
| REQ-007 | Click in 3D or on a table row selects the element, highlights it on both sides and shows all properties in `Element-Details`; a group row selects all its elements; elements without geometry show `Dieses Element hat keine 3D-Geometrie.`; empty-space click or `Esc` clears the selection. |
| REQ-008 | `Export CSV` (UTF-8 with BOM, `;`, decimal comma, CRLF, `'` prefix for texts starting with `= + - @`) and `Export Excel` (`.xlsx`, sheet `Tabelle`, bold frozen header, autofilter, numeric cells) export exactly the rows shown, incl. the grouping view (`Ebene`, `Gruppe`, `Anzahl`). File name `<Titel>_<YYYY-MM-DD>.csv` / `.xlsx`. |
| REQ-009 | `Konfiguration speichern` downloads `<Titel>_<YYYY-MM-DD>_Konfiguration.json` (`schema: "calc-viewer-config/1"`); `Konfiguration laden` (button or drop) applies it to the loaded models, skips missing properties and values and names them in a notice; success message `Konfiguration <Datei> geladen.`; four classified load errors. |
| REQ-010 | `HTML exportieren` downloads `<Titel>_<YYYY-MM-DD>.html`: models, element table, runtime and configuration in one file that starts offline by double-click, makes no network request, and offers filtering, filter sets, columns, grouping, model display and CSV / Excel export, but no IFC loading, configuration save/load or HTML export. Changes are not saved. |
| REQ-011 | Title (default: first model's `Modell`), date (default: today) and optional logo (PNG / JPG / SVG, ≤ 1 MB) via the pencil button `Titel, Datum und Logo bearbeiten`; shown in the header of builder and viewer file and used in every export file name. |

Non-functional (measured on a 4-core Xeon without GPU, software WebGL, `docs/testing/report-INC-1.md` §4): NFR-002 33.5 s per 100 MB (single 151.8 MB file) and 41.8 s per 100 MB (127.7 MB multi-model), no crash; NFR-003 viewer file 14.8 % / 13.6 % of the IFC size, usable after 9.8 s / 5.5 s; NFR-004 CSV 335 ms, Excel 640 ms at 30,931 × 20; NFR-005 zero network requests from the viewer file. NFR-001: see Known issues.

## Fixes
Fixed during release testing (INC-1 testing phase):

| BUG | Description |
|---|---|
| BUG-T1 (major) | Below 1280 px window width, load errors and configuration messages were invisible (the filter panel holding `#cv-messages` was collapsed). Now a new message opens the filter drawer. Test: `test/e2e/filter-area.spec.mjs` "below 1280 px a load error or configuration message opens the filter drawer and is visible". Verified in testing cycle 2. |
| BUG-T3 (minor) | Below 1280 px the filter drawer reopened when a message was removed while others remained. Now only an added message opens it. Test: `test/e2e/filter-area.spec.mjs` "a message that goes away does not reopen the filter drawer". Fixed after the cycle-2 report (orchestrator addendum §8); not yet part of a committed build. |

## Changes
| CR | Category | Description | Version effect |
|---|---|---|---|
| CR-001 | requirement clarification | REQ-002 text: openings (`IfcOpeningElement`) and distribution ports (`IfcDistributionPort`) are not rows (CR-A, approved at the release gate 2026-11-03). Documents the built behaviour; no code change. | none |

## Known issues and open assumptions
- **NFR-001 on PCs without a GPU (deviation, Q-002; BUG-T4).** At 30,931 elements, filter sets and table update in 6–25 ms. The last changed 3D frame (the metric Q-002 counts) reached medians of 354–533 ms in testing cycle 2 on software rendering (SwiftShader), above the 500 ms target for `Name set check` 508.7 ms, `Name set uncheck` 513.7 ms and `column filter uncheck` 533.3 ms (cycle 1: 283–431 ms, all met). The pixels reach the screen after 1.19–1.54 s. `test/perf/nfr-001.spec.mjs` is therefore red on this machine (BUG-T4, test/environment; the A/B check shows the BUG-T1 fix did not cause it). On a GPU the frame is estimated at 150–300 ms but was **not measured**. Needs the user's acceptance of the wider deviation; the manual GPU check (T12) is the deciding measurement.
- **BUG-T2 (trivial):** in `Element-Details` long values such as a GlobalId break in the middle of the word.
- **R-3 Excel:** the `.xlsx` files were read back with openpyxl and LibreOffice; Microsoft Excel itself was not available. Manual check at release.
- **Non-ASCII download names:** in headless Chromium a download name with a non-ASCII character (e.g. a title with `ä`) arrives as `download`; the intended name is correct inside the product. Real Chrome / Edge to be checked manually at release (T12).
- **Builder without internet:** the builder loads its libraries from jsDelivr at every start. Offline it stops at the start with the browser's English text `Failed to fetch` (found while writing these notes; no German message). The exported viewer file is not affected.
- **Q-001 (open):** licence of the committed test fixture `test/fixtures/Ifc2x3_Duplex_Architecture.ifc` (source repository states none). Affects only the repository, not the product file.
- **CR-001 (approved):** `IfcOpeningElement` and `IfcDistributionPort` are not table rows, so they are not counted or summed.
- **Release gate 2026-11-03:** the wider NFR-001 deviation on PCs without GPU was accepted; the manual GPU check (T12) is the deciding measurement.
- **T12 compatibility:** only Chromium (headless, 153) is tested automatically. Manual smoke in current Chrome and Edge, and Firefox best effort (ASM-007, DEC-8), are still to be done at release.
- **Open assumptions** (`docs/open-questions.md`): ASM-001 project name, ASM-002 title/date/logo as Should, ASM-003 public sample files for tests, ASM-006 aggregates and parts both rows, ASM-007 supported browsers, ASM-008 multi-valued grouping — all to be confirmed at the gate (`docs/release/decisions-to-confirm.md`).
- **Known limitations (documented, not bugs):** category colours can look alike (stable colours, DEC-15); ghosted white elements are hard to tell from opaque ones (`Ausblenden` is the alternative); a message that arrived at a wide window is not shown again after narrowing below 1280 px.

## Upgrade / migration notes
- First release: nothing to migrate.
- Configuration files carry `schema: "calc-viewer-config/1"`; 1.0.0 refuses any other schema version with `Konfigurationsversion <n> wird nicht unterstützt.`

## Deployment steps
The product is the single file `calc-viewer-builder.html`. There is no server, build or installation.
1. Take `calc-viewer-builder.html` from the tagged release commit (`v1.0.0`).
2. Hand it to the authors (shared drive, e-mail, intranet page); optionally record its SHA-256 (`sha256sum calc-viewer-builder.html`).
3. Authors open it by double-click in current Chrome or Edge. The builder needs **internet access to `https://cdn.jsdelivr.net`** at every start: it downloads `@thatopen/fragments@3.4.7` with `three@0.185.1` and `web-ifc@0.0.77` and stops with `Unerwartete Bibliotheksversion von jsDelivr: …` if jsDelivr serves other versions (verified in the code: `CDN = "https://cdn.jsdelivr.net"`, `crawlModules`, `wasmPath`; offline probe: the only request is the jsDelivr `+esm` URL). The conversion worker fetches `web-ifc.wasm` from jsDelivr when an IFC file is converted, so a connection lost after start shows as a load error. IFC data never leaves the computer.
4. Optional: serve it from any static web server (e.g. `node scripts/serve.mjs` → `http://localhost:8080/calc-viewer-builder.html`); behaviour is the same.
5. Viewer files exported with `HTML exportieren` are distributed the same way. They are **fully offline**: no internet, no installation, zero network requests (NFR-005).
6. Production use starts only on the user's explicit decision after the release gate.

## Rollback
1. Keep the previous `calc-viewer-builder.html` (for 1.0.0: none; for later versions, the file of the previous tag) next to the new one or restore it with `git checkout v<previous> -- calc-viewer-builder.html`.
2. Hand the previous file to the authors again; nothing else is installed or stored, so no data clean-up is needed.
3. Already exported viewer files keep working; they do not depend on the builder version. Configuration files of schema `calc-viewer-config/1` stay loadable.
