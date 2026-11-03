---
status: draft
date: 2026-11-03
relates_to: [REQ-001, REQ-008, REQ-009, REQ-010, REQ-011, NFR-001, NFR-002, NFR-003, NFR-005, CON-001, CON-002, CON-003, CON-004, ASM-007, DEC-8, R-3, T12]
---
# Runbook — Calc Viewer Builder 1.0.0

## Overview
- **What runs where:** everything runs in the user's browser. There is no server, database, login or telemetry (CON-004); IFC data never leaves the computer.
- **Builder:** `calc-viewer-builder.html`, one hand-written HTML file (CON-001). At start it downloads `@thatopen/fragments@3.4.7`, `three@0.185.1` and `web-ifc@0.0.77` from `https://cdn.jsdelivr.net` and links them in the page (CON-002); the conversion worker fetches `web-ifc.wasm` from there when an IFC file is converted, so losing the connection after start shows as a load error. IFC conversion runs in a classic Web Worker.
- **Viewer file:** `<Titel>_<YYYY-MM-DD>.html`, written by `HTML exportieren`. It embeds the libraries, the converted models (`.frag`), the extracted element table and the configuration, and runs offline with zero network requests (CON-003, NFR-005).
- **Design:** `docs/spec.md` §4 (module layout as built: `docs/process-log.md`).

## Operations
| Task | Command / procedure |
|---|---|
| Start the builder | Double-click `calc-viewer-builder.html` (opens via `file://`), or `node scripts/serve.mjs` and open `http://localhost:8080/calc-viewer-builder.html` (`PORT=<n>` for another port). Wait until `Bibliotheken werden geladen ...` is replaced by the screen. Internet access to `cdn.jsdelivr.net` is required. |
| Load models | `IFC laden` (several files at once) or drop `.ifc` files anywhere on the page. Optional before or after: `Räume (IfcSpace) einbeziehen`. Remove a model with `×` (`Modell entfernen`) in the `Modelle` list. |
| Build the view | `+ Filtersatz`, `Spalten`, `Einzelelemente` / `Gruppiert`, `Färben nach`, `Schnitt`, `Elemente außerhalb des Filters` (`Geist` / `Ausblenden`); title, date and logo via the pencil `Titel, Datum und Logo bearbeiten`. |
| Export the table | `Export CSV` / `Export Excel` → `<Titel>_<YYYY-MM-DD>.csv` / `.xlsx` (exactly the rows shown). |
| Save / reuse the view | `Konfiguration speichern` → `<Titel>_<YYYY-MM-DD>_Konfiguration.json`. Later: load the same IFC files, then `Konfiguration laden` (or drop the `.json`, also together with the IFC files). |
| Export and hand over a viewer file | Load the models, build the view, then `HTML exportieren` → `<Titel>_<YYYY-MM-DD>.html`. Send the file (share, e-mail, USB). The colleague opens it by double-click; no internet or installation needed. Changes in the viewer are not saved; reopening shows the exported state. The viewer header shows the export date. |
| Stop | Close the browser tab. Nothing keeps running; nothing is stored in the browser. |
| Deploy | Distribute the tagged `calc-viewer-builder.html` (`docs/release/release-notes-1.0.0.md` → Deployment steps). |
| Rollback | Hand out the previous `calc-viewer-builder.html` again (`git checkout v<previous> -- calc-viewer-builder.html`). Exported viewer files keep working. |
| Health check | Open the builder, load `test/fixtures/AC20-FZK-Haus.ifc`: model visible, filter sets `Kategorie`, `Geschoss`, `Material` shown, status line `… von … Elementen`. Automated: `npx playwright test --grep @smoke`. |

Developer commands (from `AGENTS.md` §4): `npm ci && python3 -m pip install openpyxl==3.1.5 && node scripts/vendor-cdn.mjs && node scripts/fetch-fixtures.mjs` (install), `node scripts/check.mjs` (format, lint, CDN cache check, unit tests with c8 coverage ≥ 70 % lines, integration); `node scripts/trace.mjs` regenerates `docs/testing/traceability.md` after tests change (a unit test fails if it is stale), `node scripts/check.mjs --all` (all suites).

## Configuration
| Variable / file | Purpose | Default | Secret |
|---|---|---|---|
| Configuration file `*_Konfiguration.json` | the saved view (`schema: "calc-viewer-config/1"`): title, date, logo, filter sets and checked values, column filters, columns and widths, view, grouping, sort, ghost/hide, colouring, section | new configuration: filter sets `Kategorie`, `Geschoss`, `Material`; columns `Modell`, `Kategorie`, `Name`, `Geschoss` | no |
| Not in the configuration | `Räume (IfcSpace) einbeziehen`, splitter position, collapsed details panel, expanded groups, selection | – | – |
| `PORT` (dev server only) | port of `scripts/serve.mjs` | `8080` | no |

## Requirements and limits
| Item | Value | Source |
|---|---|---|
| Browser | current Chrome or Edge (Chromium); Firefox best effort, not tested. Needs WebGL, Web Workers from Blob URLs, `CompressionStream` / `DecompressionStream`. The viewer refuses a browser without `DecompressionStream`. | ASM-007, DEC-8; T12 manual check pending |
| Window | ≥ 1280 px wide for the full layout; below that `Filter` and `Details` open as drawers | spec §2 Devices, `docs/process-log.md` |
| Graphics | a GPU is recommended for ≥ 30,000 elements: without GPU (software WebGL) the 3D view appears 1.2–1.5 s after a filter click (filter sets and table < 30 ms) | NFR-001 deviation |
| IFC schemas | IFC2X3, IFC4 (others refused) | REQ-001 |
| IFC size | no hard limit; tested: 151.8 MB single file (≈ 34 s per 100 MB, browser memory up to ≈ 1.9 GB) and 127.7 MB in 3 files; very large files may exceed the browser's memory (`too-large` message) | NFR-002 |
| Elements | tested with 30,931 elements in 5 models | NFR-001 |
| Configuration file | ≤ 20 MB (larger files are not read) | TASK-007 |
| Logo | PNG, JPG or SVG (detected by content), ≤ 1 MB | TASK-007 |
| Title | ≤ 200 characters (longer titles in a configuration are cut) | TASK-007 |
| Conversion watchdog | worker must answer within 30 s of the start; afterwards at most 180 s without a progress message | TASK-010 |
| Viewer start | must be ready within 120 s, else an error is shown | TASK-010 |
| Excel cell text | ≤ 32,767 characters (longer texts are cut in `.xlsx`; CSV keeps them) | TASK-008 |
| Viewer file size | ≈ 14 % of the IFC size for ≥ 100 MB models; ≈ 1 MB fixed runtime, so small models give 55–59 % | NFR-003 |

## Monitoring and alerts
No server, so no monitoring. All feedback is on screen: the progress overlay (step and percentage), the message area at the top of the filter panel (`role="alert"`; below 1280 px a new message opens the `Filter` drawer), and the status line `X von Y Elementen`.

| Signal | Threshold | Meaning | Action |
|---|---|---|---|
| Builder shows only a red text instead of the screen | at start | libraries could not be loaded | see Common incidents |
| Message in the filter panel | any | a file was refused or a configuration only partly applied | read the message; see Common incidents |
| 3D view lags about 1 s behind clicks | ≥ 30,000 elements | software rendering (no GPU) | expected (NFR-001 deviation); use a PC with GPU or filter to fewer elements |

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

## Backup and restore
- Backup: nothing is stored by the application. Keep the IFC files, the saved `*_Konfiguration.json` files and the exported viewer files; keep each released `calc-viewer-builder.html` (git tag).
- Restore: open the builder, load the IFC files, then `Konfiguration laden` — the view is restored (REQ-009-AC1 round trip). Not tested as a separate restore drill; the round trip is covered by `test/integration/config-roundtrip.spec.mjs`.
