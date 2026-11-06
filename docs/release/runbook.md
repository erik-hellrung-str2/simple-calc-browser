---
status: draft
date: 2026-11-06
relates_to: [REQ-001, REQ-004, REQ-005, REQ-008, REQ-009, REQ-010, REQ-011, REQ-012, REQ-013, NFR-001, NFR-002, NFR-003, NFR-005, CON-001, CON-002, CON-003, CON-004, ASM-007, DEC-8, DEC-18, DEC-20, CR-002, Q-002, Q-007, R-3, T12]
---
# Runbook — Calc Viewer Builder 1.1.0

Updated for 1.1.0 (CR-002). Release notes: `docs/release/release-notes-1.1.0.md`; previous release 1.0.0 (tag `v1.0.0`).

## Overview
- **What runs where:** everything runs in the user's browser. There is no server, database, login or telemetry (CON-004); IFC data never leaves the computer.
- **Builder:** `calc-viewer-builder.html`, one hand-written HTML file (CON-001). At start it downloads `@thatopen/fragments@3.4.7`, `three@0.185.1` and `web-ifc@0.0.77` from `https://cdn.jsdelivr.net` and links them in the page (CON-002); the conversion worker fetches `web-ifc.wasm` from there when an IFC file is converted, so losing the connection after start shows as a load error. IFC conversion runs in a classic Web Worker.
- **Viewer file:** `<Titel>_<YYYY-MM-DD>.html`, written by `HTML exportieren`. It embeds the libraries, the converted models (`.frag`), the extracted element table and the configuration (incl. rules, search, colouring mode and section plane), and runs offline with zero network requests (CON-003, NFR-005). Viewer files exported with 1.0.0 keep their own embedded 1.0.0 runtime.
- **Design:** `docs/spec.md` §4 (module layout as built: `docs/process-log.md`).

## Operations
| Task | Command / procedure |
|---|---|
| Start the builder | Double-click `calc-viewer-builder.html` (opens via `file://`), or `node scripts/serve.mjs` and open `http://localhost:8080/calc-viewer-builder.html` (`PORT=<n>` for another port). Wait until `Bibliotheken werden geladen ...` is replaced by the screen. Internet access to `cdn.jsdelivr.net` is required. |
| Load models | `IFC laden` (several files at once) or drop `.ifc` files anywhere on the page. Optional before or after: `Räume (IfcSpace) einbeziehen`. Remove a model with `×` (`Modell entfernen`) in the `Modelle` list. |
| Build the view | Left: `+ Filtersatz`, ticks, `Alle Filter zurücksetzen`. Table: `Spalten`, `Einzelelemente` / `Gruppiert`, column filters, sort. 3D toolbar `3D-Werkzeuge`: `Fokus`, `Filter` (search `Suchen nach Objekten`, `+ Filter hinzufügen` → `Filter bearbeiten`), `Färben` (`Unterschiedliche Farben` / `Farbskala`). Click an element: menu `Ausblenden` / `Isolieren` / `Schneiden` and the properties panel (`Nach Wert filtern`, `Farbe nach Wert`). Pills at the bottom right undo each tool; the ghost toggle is in the pill `Filter entfernen`. Title, date and logo via the pencil `Titel, Datum und Logo bearbeiten`. |
| Export the table | `Export CSV` / `Export Excel` → `<Titel>_<YYYY-MM-DD>.csv` / `.xlsx` (exactly the rows shown: rules, search, hidden and isolated elements apply; `Markieren` and `Schneiden` do not). |
| Save / reuse the view | `Konfiguration speichern` → `<Titel>_<YYYY-MM-DD>_Konfiguration.json`. Later: load the same IFC files, then `Konfiguration laden` (or drop the `.json`, also together with the IFC files). Hidden and isolated elements are not saved, and loading a configuration clears them. 1.0.0 files load; their X/Y/Z section becomes a plane. |
| Export and hand over a viewer file | Load the models, build the view, then `HTML exportieren` → `<Titel>_<YYYY-MM-DD>.html`. Send the file (share, e-mail, USB). The colleague opens it by double-click; no internet or installation needed. Changes in the viewer are not saved; reopening shows the exported state. The viewer header shows the export date. |
| Stop | Close the browser tab. Nothing keeps running; nothing is stored in the browser. |
| Deploy | Distribute `calc-viewer-builder.html` from tag `v1.1.0` (`docs/release/release-notes-1.1.0.md` → Deployment steps). |
| Rollback | See Rollback below (to tag `v1.0.0`, the same builder as tag `pre-CR-002`). |
| Health check | Open the builder, load `test/fixtures/AC20-FZK-Haus.ifc`: model visible, toolbar `Fokus` / `Filter` / `Färben` at the bottom of the 3D view, filter sets `Kategorie`, `Geschoss`, `Material` shown, status line `99 von 99 Elementen`. Automated: `npx playwright test --grep @smoke`. Full smoke for 1.1.0: Smoke steps below. |

Developer commands (from `AGENTS.md` §4): `npm ci && python3 -m pip install openpyxl==3.1.5 && node scripts/vendor-cdn.mjs && node scripts/fetch-fixtures.mjs` (install), `node scripts/check.mjs` (format, lint, CDN cache check, unit tests with c8 coverage ≥ 70 % lines, integration); `node scripts/trace.mjs` regenerates `docs/testing/traceability.md` after tests change (a unit test fails if it is stale), `node scripts/check.mjs --all` (all suites).

## Smoke steps for 1.1.0 (after deploy or rollback)
Run in current Chrome and Edge (T12) with `test/fixtures/AC20-FZK-Haus.ifc` (99 elements) at a window of at least 1280 × 800. Automated equivalent in headless Chromium: `npx playwright test --grep @smoke` plus `test/e2e/element-tools.spec.mjs`, `rule-filter.spec.mjs`, `colouring.spec.mjs`, `config-compat.spec.mjs`, `viewer.spec.mjs`.

| # | Step | Expected |
|---|---|---|
| 1 | Open the builder, `IFC laden` FZK | model in 3D, toolbar `Fokus` / `Filter` / `Färben`, hint pill fades after 6 s, no column right of the 3D view, table to the right edge, `99 von 99 Elementen` |
| 2 | `Filter` → `+ Filter hinzufügen` → `Isolieren` · `Kategorie` · `Enthält` · `wall` → `Anwenden` | rule row `Isolieren: Kategorie enthält „wall“`, `13 von 99 Elementen`, filter area `Filterregeln: 1`, pill `Filter entfernen` |
| 3 | Type `ext` in `Suchen nach Objekten` | fewer rows, entry `Suche: „ext“` |
| 4 | Click a wall in 3D → `Ausblenden` | menu at the click point; wall gone from 3D and table; entry `Ausgeblendet: 1 Element`; pill `Ausblendung entfernen` |
| 5 | Click another wall → `Isolieren`; then `Fokus` | only that wall shown, `Isoliert: 1 Element`; `Fokus` fits it beside the open panels |
| 6 | Click the shown (isolated) wall → `Schneiden`; drag the handle `Schnitt verschieben` | 3D cut, status line unchanged; pill `Schnitt entfernen` |
| 7 | `Färben` → `Kategorie` → `Farbskala` → `Blau` | colours and legend in the panel; pill `Einfärbung entfernen` |
| 8 | Click a table row; in the properties panel `Nach Wert filtern` on `Geschoss` | panel with kicker, title, buttons `Ausblenden` / `Isolieren`; the value is ticked in the left `Geschoss` set |
| 9 | `Export CSV`, `Export Excel` | files hold exactly the rows shown |
| 10 | `Konfiguration speichern`, reload, load FZK, `Konfiguration laden` | rules, search, colouring and section restored; nothing hidden or isolated |
| 11 | `HTML exportieren`, open the file offline | same view; toolbar, click menu and properties panel work; no network request |
| 12 | Pill `Filter entfernen` (or `Alle Filter zurücksetzen`) | rules, search, ticks, column filters, hidden and isolated elements cleared, `99 von 99 Elementen`; colouring and section stay |
| 13 | Load a 1.0.0 configuration with an X/Y/Z section (`test/fixtures/config-1.0.0-axis-section.json`) | no notice for the section; a plane section and the pill `Schnitt entfernen` are shown |

## Configuration
| Variable / file | Purpose | Default | Secret |
|---|---|---|---|
| Configuration file `*_Konfiguration.json` | the saved view (`schema: "calc-viewer-config/1"`): title, date, logo, filter sets and checked values, column filters, columns and widths, view, grouping, sort, ghost/hide, colouring (`colourBy`, `colourMode`, `scaleColour`), section plane (`sectionPlane`), filter rules (`filterRules`), search (`search`); field rules in spec DEC-20 | new configuration: filter sets `Kategorie`, `Geschoss`, `Material`; columns `Modell`, `Kategorie`, `Name`, `Geschoss`; no rules, no search; colouring mode `Unterschiedliche Farben`, scale colour `Rot` | no |
| Not in the configuration | hidden and isolated elements (session only), `Räume (IfcSpace) einbeziehen`, splitter position, expanded groups, selection, open panels | – | – |
| Compatibility | 1.0.0 files load in 1.1.0 (`display.section` converted to a plane); 1.1.0 files load in 1.0.0 with a notice naming the five new fields as skipped (rules, search and section lost there) | – | – |
| `PORT` (dev server only) | port of `scripts/serve.mjs` | `8080` | no |

## Requirements and limits
| Item | Value | Source |
|---|---|---|
| Browser | current Chrome or Edge (Chromium); Firefox best effort, not tested. Needs WebGL, Web Workers from Blob URLs, `CompressionStream` / `DecompressionStream`. The viewer refuses a browser without `DecompressionStream`. | ASM-007, DEC-8; T12 manual check pending |
| Window | ≥ 1280 px wide for the full layout; below that the filter area opens as a drawer (`Filter`); the panels, menu and pills stay inside the 3D view down to 1024 px | spec §2 Devices, `docs/process-log.md` |
| Graphics | a GPU is recommended for ≥ 30,000 elements: without GPU (software WebGL) the 3D view appears 0.7–1.2 s after a filter click (the last changed 3D frame is drawn within 400 ms, medians ≤ 331 ms) | NFR-001 deviation (Q-002) |
| IFC schemas | IFC2X3, IFC4 (others refused) | REQ-001 |
| IFC size | no hard limit; tested: 151.8 MB single file (≈ 23 s per 100 MB, browser memory up to ≈ 1.9 GB) and 127.7 MB in 3 files (≈ 29 s per 100 MB); very large files may exceed the browser's memory (`too-large` message) | NFR-002 |
| Elements | tested with 30,931 elements in 5 models; display-text index for search and `Freie Textsuche` ≈ 0.3 s and +10 MB there | NFR-001 |
| Filter rules | no limit; evaluation is linear in the rule count (20,000 rules ≈ 78 ms per interaction) | CODE-2, process-log |
| Configuration file | ≤ 20 MB (larger files are not read) | TASK-007 |
| Logo | PNG, JPG or SVG (detected by content), ≤ 1 MB | TASK-007 |
| Title | ≤ 200 characters (longer titles in a configuration are cut) | TASK-007 |
| Conversion watchdog | worker must answer within 30 s of the start; afterwards at most 180 s without a progress message | TASK-010 |
| Viewer start | must be ready within 120 s, else an error is shown | TASK-010 |
| Excel cell text | ≤ 32,767 characters (longer texts are cut in `.xlsx`; CSV keeps them) | TASK-008 |
| Viewer file size | ≈ 14–15 % of the IFC size for ≥ 100 MB models; fixed runtime, so small models give about 58–62 % | NFR-003 |

## Monitoring and alerts
No server, so no monitoring. All feedback is on screen: the progress overlay (step and percentage), the message area at the top of the filter panel (`role="alert"`; below 1280 px a new message opens the `Filter` drawer), the filter-area entries (`Ausgeblendet`, `Isoliert`, `Filterregeln`, `Suche`), the pills in the 3D view, the filter panel status (`<X> von <Y> Objekten sichtbar`, while the index builds `Eigenschaften werden gelesen ... N %`) and the status line `X von Y Elementen`.

| Signal | Threshold | Meaning | Action |
|---|---|---|---|
| Builder shows only a red text instead of the screen | at start | libraries could not be loaded | see Common incidents |
| Message in the filter panel | any | a file was refused or a configuration only partly applied | read the message; see Common incidents |
| 3D view lags about 1 s behind clicks | ≥ 30,000 elements | software rendering (no GPU) | expected (NFR-001 deviation); use a PC with GPU or filter to fewer elements |
| Fewer elements than expected | any | a rule, search, hidden or isolated elements are active | check the filter-area entries and pills; `Alle Filter zurücksetzen` or the pill `Filter entfernen` |

## Common incidents
The messages below are the exact German texts of the product (`<Datei>` = file name).

### Builder start: `Failed to fetch` (red text, English)
- Diagnosis: no internet access to `https://cdn.jsdelivr.net` (offline, proxy or firewall). The builder loads its libraries at every start.
- Fix: connect to the internet or allow `cdn.jsdelivr.net`, then reload. Viewer files are not affected.

### Builder start: `Download fehlgeschlagen (<Status>): <URL>`
- Diagnosis: jsDelivr answered with an HTTP error (outage, blocked by a proxy).
- Fix: reload later; check proxy rules for `cdn.jsdelivr.net`.

### Builder start: `Unerwartete Bibliotheksversion von jsDelivr: <lib> <gefunden> statt <erwartet>.`
- Diagnosis: drift guard — jsDelivr now resolves `@thatopen/fragments@3.4.7` to another `three` or `web-ifc` version (or two `three` versions).
- Fix: none on the user side; the builder must be updated (pin check in `EXPECTED_THREE` / `EXPECTED_WEBIFC`, change request). Keep using existing viewer files.

### Load: `<Datei> ist leer.`
- Diagnosis: the file has 0 bytes (failed copy or download).
- Fix: export or copy the IFC again.

### Load: `<Datei> ist keine IFC-Datei.`
- Diagnosis: no ISO-10303-21 header (e.g. a PDF or `.ifczip` renamed to `.ifc`).
- Fix: export a plain IFC (STEP) file from the authoring tool.

### Load: `<Datei> verwendet das nicht unterstützte Schema <Schema>.`
- Diagnosis: `FILE_SCHEMA` is not IFC2X3 or IFC4 (e.g. IFC4X3).
- Fix: export the model as IFC4 or IFC2X3.

### Load: `<Datei> konnte nicht gelesen werden: <Ursache>.`
- Diagnosis: parsing or conversion failed, e.g. a truncated file. Special causes: `der Konverter ist nicht gestartet (keine Antwort nach 30 s)` (worker or `web-ifc.wasm` did not load — network) and `der Konverter antwortet nicht mehr (keine Rückmeldung seit 180 s)` (conversion stalled).
- Fix: re-export the IFC; check the internet connection; for a stall, close other tabs and retry, or split the model.

### Load: `<Datei> ist möglicherweise zu groß für den Arbeitsspeicher des Browsers.`
- Diagnosis: the conversion worker crashed, usually out of memory.
- Fix: close other tabs, use a 64-bit browser on a PC with more RAM, load fewer or smaller models at once.

### Configuration: `Zum Laden einer Konfiguration zuerst ein IFC-Modell laden.`
- Diagnosis: a configuration was loaded with no model loaded (and none loading). `Konfiguration laden` / `speichern`, the exports and `HTML exportieren` are disabled until a model is loaded (tooltip `Zuerst ein IFC-Modell laden.`).
- Fix: load the IFC files first (or drop IFC and `.json` together).

### Configuration: `Die Datei ist kein gültiges JSON.` / `Die Datei ist keine Calc-Viewer-Konfiguration.` / `Konfigurationsversion <n> wird nicht unterstützt.` / `Die Datei ist zu groß für eine Konfiguration (höchstens 20 MB).` / `Die Konfiguration konnte nicht geladen werden.`
- Diagnosis: damaged or foreign file, a newer configuration version, a file over 20 MB, or a read error. The current view is unchanged.
- Fix: use a file saved by `Konfiguration speichern` of this version.

### Configuration: `Konfiguration geladen. Nicht angewendet: …`
- Diagnosis: not an error. Properties (`Eigenschaften, die in den geladenen Modellen fehlen`), filter values (`Filterwerte, die …`), invalid (`Ungültige Angaben`) or unknown entries (`Unbekannte Angaben`) were skipped; the rest is applied.
- Fix: check that the same models (or models with the same psets) are loaded.

### Configuration notice names `Filterregeln`, `Filterregel`, `Suche`, `Farbmodus`, `Skalenfarbe` or `Schnitt`
- Diagnosis: a 1.1.0 field of the file is invalid (hand-edited or damaged file). That part is skipped as spec DEC-20 says; the rest is applied. A rule on a property the loaded models do not have is named by its property and skipped.
- Fix: save the configuration again from the builder, or load the matching models.

### Configuration from 1.1.0 opened in 1.0.0: `Unbekannte Angaben` names `filterRules`, `search`, `display.colourMode`, `display.scaleColour`, `display.sectionPlane`
- Diagnosis: expected after a rollback; 1.0.0 does not know the new fields. Rules, search and section are lost, so more elements are shown.
- Fix: use 1.1.0, or rebuild the rules with filter sets and column filters in 1.0.0.

### Rule shows `Eigenschaft nicht geladen`
- Diagnosis: the rule's property belongs to a model that was removed. The rule is kept but not applied.
- Fix: load that model again (the rule applies again) or remove the rule with ×.

### 3D view empty after loading a configuration, pill `Schnitt entfernen` shown
- Diagnosis: the configuration holds a section plane outside the loaded models (hand-edited file or other models; known limitation BUG-T13, Q-007).
- Fix: click `Schnitt entfernen`.

### Model hidden behind panels at small windows
- Diagnosis: at 1280 × 800 the 3D view is about 1000 × 390 px; open panels cover part of it.
- Fix: `Fokus` fits the shown elements into the free part; close panels or drag the splitter between 3D view and table.

### Logo: `Das Logo <Datei> ist zu groß (<Größe>). Erlaubt sind höchstens 1 MB.` / `<Datei> ist kein PNG-, JPG- oder SVG-Bild.` / `<Datei> konnte nicht als Bild gelesen werden.`
- Fix: use a PNG, JPG or SVG of at most 1 MB.

### Export: `Der Export ist fehlgeschlagen (…).` / `Der HTML-Export ist fehlgeschlagen (…).`
- Diagnosis: the browser could not build or download the file (memory, blocked download).
- Fix: allow downloads for the page, close other tabs, retry.

### Viewer file: `Die Viewer-Datei konnte nicht gestartet werden: Die Datei ist unvollständig oder beschädigt. Bitte die Viewer-Datei erneut exportieren oder vollständig kopieren.`
- Diagnosis: the file was cut off (incomplete download or copy, e-mail size limit).
- Fix: copy the complete file again or export it again.

### Viewer file: `… Die Datei ist beschädigt (eingebettete Daten „<id>“ nicht lesbar). Bitte die Viewer-Datei erneut exportieren.`
- Diagnosis: an embedded payload was changed or damaged.
- Fix: export the viewer file again.

### Viewer file: `… keine Antwort nach 120 s. Die Datei ist möglicherweise beschädigt oder zu groß für den Arbeitsspeicher des Browsers.`
- Diagnosis: the viewer did not become ready within 120 s.
- Fix: close other tabs, open on a PC with more memory, or export fewer models.

### Viewer file: `… Dieser Browser wird nicht unterstützt. Bitte einen aktuellen Browser verwenden.`
- Diagnosis: the browser lacks `DecompressionStream`.
- Fix: open in current Chrome or Edge.

### Download name is `download` instead of `<Titel>_<Datum>.csv`
- Diagnosis: seen in headless Chromium for titles with non-ASCII characters (e.g. `ä`); not yet checked in real Chrome / Edge.
- Fix: rename the file, or use an ASCII title.

## Rollback (1.1.0 → 1.0.0)
1. `git checkout v1.0.0 -- calc-viewer-builder.html` (the builder at tag `pre-CR-002` is identical) and hand that file to the authors again, replacing the 1.1.0 file. Nothing is installed or stored in the browser, so nothing else needs cleaning up.
2. Run the 1.0.0 health check: load FZK; the 1.0.0 screen with `Element-Details` on the right, `Ansicht einpassen` and the X/Y/Z `Schnitt`; `npx playwright test --grep @smoke` on a checkout of `v1.0.0`.
3. Tell the authors: configurations saved by 1.1.0 load with a notice and lose rules, search and section; hidden and isolated elements were never saved.
4. Viewer files exported with 1.1.0 keep working (self-contained); there is no need to re-export them.
5. In the repository: revert the cycle-2 commits back to tag `pre-CR-002` (CR-002 §7). After a 1.1.0 release, the revert ships as 1.1.1 with smoke and full regression.

## Backup and restore
- Backup: nothing is stored by the application. Keep the IFC files, the saved `*_Konfiguration.json` files and the exported viewer files; keep each released `calc-viewer-builder.html` (git tag).
- Restore: open the builder, load the IFC files, then `Konfiguration laden` — the view is restored (REQ-009-AC1 round trip, incl. rules, search, colouring mode and section plane; hidden and isolated elements are not restored by design). Not tested as a separate restore drill; the round trip is covered by `test/integration/config-roundtrip.spec.mjs` and `test/e2e/config-compat.spec.mjs`.
