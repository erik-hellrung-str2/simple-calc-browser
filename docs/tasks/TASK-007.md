---
id: TASK-007
title: Title / date / logo header and configuration save / load (schema with version, tolerant apply with notice, error classes)
type: feature
status: done (verification pending)
implements: [REQ-011 (builder header; REQ-011-AC1 header part), REQ-009, REQ-009-AC1, REQ-009-AC2, REQ-009-AC3, REQ-003-AC2 (configuration part), REQ-006-AC6 (configuration part), TASK-003 D3]
relates_to: [REQ-005 (model display in the configuration), REQ-006, REQ-008 (file name rule), REQ-010, TASK-005, TASK-006a, TASK-006b, TASK-006c, TASK-008, TASK-009]
depends_on: [TASK-005, TASK-006b]
touches: [calc-viewer-builder.html (cv-css, cv-core-src, cv-ui-src, cv-app-src), scripts/make-config-fixtures.mjs, scripts/ref/derive-reference.mjs, test/fixtures/reference-values.json, test/fixtures/manifest.json, test/fixtures/config-*.json, test/fixtures/logo-test.png, test/fixtures/logo-test.svg, test/unit/config.test.mjs, test/unit/fixtures.test.mjs, test/support/config.mjs, test/e2e/config.spec.mjs, test/integration/config-roundtrip.spec.mjs]
---
# TASK-007: Header and configuration save / load

## What was built

### cv-core (pure, unit-tested; spec §4.4 `validateConfig`, `applyConfig`, `safeFileName`)
- **Schema.** `CONFIG_SCHEMA` = `calc-viewer-config`, `CONFIG_VERSION` = 1, so the file carries `"schema": "calc-viewer-config/1"` (REQ-009).
- **`parseConfig(text)`** removes a leading BOM, parses, and calls `validateConfig`. It throws a `ConfigError` with `configClass` and the German message:
  - `invalid-json`: `Die Datei ist kein gültiges JSON.`
  - `not-a-config`: `Die Datei ist keine Calc-Viewer-Konfiguration.` This covers no JSON object (array, number, null), a missing or non-string `schema`, a foreign schema and `calc-viewer-config/` with no version.
  - `unsupported-version`: `Konfigurationsversion <n> wird nicht unterstützt.` Here `<n>` is the text after `calc-viewer-config/`, cut to 20 characters.
  - `too-large` (see Decisions to confirm): `Die Datei ist zu groß für eine Konfiguration (höchstens 20 MB).` The builder checks this before it reads the file.
- **`buildConfig(state)`** returns the saved object, with a fixed field order so equal states give equal text:
  ```
  { schema, header { title, date, logo },
    filterSets [{ key, collapsed, selected [values; null = (leer)] }],          // order = display order
    table { view, groupBy, columns [{ key, width }], sort { key, dir } | null,
            columnFilters [{ key, type 'values', values } | { key, type 'range', min, max }] },
    display { mode 'ghost' | 'hide', colourBy, section { axis, offset, flipped } | null } }
  ```
  - These are exactly the REQ-009 fields.
  - Left out: the expanded groups (REQ-009), the selection, element keys / localIds and the IFC models.
- **`applyConfig(config, ctx)`** is the tolerant apply (REQ-009, AC2). `ctx` = `{ has(key), hasValue(key, value), columns }`. It returns `{ apply, skipped }`.
  - **Missing from the loaded models** (`skipped.properties` / `skipped.values`), skipped and named:
    - the keys of filter sets, columns, `groupBy`, the sort key, column filters and `colourBy`;
    - filter values of filter sets and of text column filters.
  - **D3 (TASK-003):** `""` in a saved selection is the empty value `null` / `(leer)`.
  - **Malformed entries** go to `skipped.invalid` under a German name, e.g. `Datum`, `Logo`, `Filtersatz <key>`, `Sortierung`, `Spaltenfilter <key>`, `Schnitt`. Examples:
    - wrong types;
    - an invalid calendar date;
    - a logo that is not a PNG / JPG / SVG base64 data URL of at most 1 MB;
    - a value that is no text, finite number or null;
    - a range filter without a numeric bound;
    - a sort or column filter on a key that is not a column;
    - an unknown view, mode or section axis.
  - **Unknown fields** go to `skipped.unknown` (`extra`, `header.x`, `table.y`, `display.z`).
  - **Normalising.** Duplicate filter sets, filter values and column filters are dropped (the first wins). The title is cut to 200 characters, widths are clamped (`normaliseColumns`), `groupBy` keeps at most 2 keys, and a `values` column filter left without values is dropped.
  - **Partial files.** A part the file does not contain (`header`, `filterSets`, `table`, `display` or a field inside one) is not in `apply`. It keeps the current state (see Decisions to confirm).
  - Skipped values are deduplicated through a `Set` per key, so the apply stays linear in the number of values (the 60,000-value robustness test asserts parse + apply < 5 s).
- **`configNotice(skipped, label)`** gives the German notice. Each list is capped at 20 entries plus `und <n> weitere`:
  ```
  Konfiguration geladen. Nicht angewendet:
  Eigenschaften, die in den geladenen Modellen fehlen: <key>; ….
  Filterwerte, die in den geladenen Modellen fehlen: <Eigenschaft> = <Wert>; ….
  Ungültige Angaben: ….
  Unbekannte Angaben: ….
  ```
- **Header helpers.**
  - `isIsoDate` checks a real calendar date `YYYY-MM-DD`.
  - `isoDate(Date)` gives the local date.
  - `germanDate` shows a date as the UI already does (`toLocaleDateString("de-DE")`, e.g. `12.8.2026`).
  - `safeFileName(title, date, suffix)` applies the REQ-008 rule: `\ / : * ? " < > |` and control characters become `_`, and an empty title becomes `Export`. It is ready for TASK-008.
  - `classifyLogo(name, size, headBytes)` detects the type from the content: the PNG / JPEG signature, or an `<svg` element in the first 4 KB. Size limit `LOGO_MAX_BYTES` = 1 MB. German errors:
    - `Das Logo <name> ist zu groß (<size>). Erlaubt sind höchstens 1 MB.`
    - `<name> ist kein PNG-, JPG- oder SVG-Bild.`
  - `isLogoDataUrl` checks a logo when a configuration is loaded.

### cv-ui
- **Header (REQ-011).** `setHeader({ title, date, logo })`.
  - Title: an empty title shows the app name `Calc Viewer Builder`.
  - Date: shown in German.
  - Logo: the logo replaces the accent cube as an `<img>` at header height (max 180 x 36 px). An SVG inside `<img>` runs no script.
  - Builder only: a pencil button `Titel, Datum und Logo bearbeiten` (`#cv-header-edit`).
- **Dialog `Titel, Datum und Logo`** (`openHeaderDialog`):
  - Fields:
    - `Titel`: empty means the first model's `Modell`, which is shown as the placeholder.
    - `Datum`: an `<input type="date">`; empty means today.
    - `Logo`: preview, `Logo wählen` (hidden file input `#cv-hdr-logo`) and `Logo entfernen`.
  - Errors appear in the dialog (`#cv-hdr-error`, `role="alert"`).
  - `Abbrechen`, Escape (which does not clear the 3D selection) and the backdrop close the dialog without changes; `Übernehmen` (or Enter in a field) applies.
  - A cancelled file dialog changes nothing.
- **Builder buttons** get ids: `#cv-config-save`, `#cv-config-load` (hidden input `#cv-config-input`, `.json`) and `#cv-html-export` (still disabled, TASK-009).
  - `Konfiguration laden` is enabled only while a model is loaded and no action runs. Its tooltip says `Zuerst ein IFC-Modell laden.` (`setConfigLoadable`).
  - `Konfiguration speichern` and the edit button are disabled while an action runs.
- **Messages.**
  - `addMessage(text, kind)`: `kind` `"notice"` gives a neutral style (`.cv-notice`) for the load notice; errors keep the red style.
  - Line breaks are kept (`white-space: pre-line`).
  - The message element is returned.

### cv-app
- **Header state.** `title` and `date` are `null` (default) until the user or a configuration sets them.
  - The shown and saved header (`effectiveHeader`) uses the first model's `Modell` and today's date as defaults (REQ-011).
  - `publish()` refreshes the header, so the default title follows the models.
- **Save.** `configState()` = `buildConfig` over `filterSets`, `tableState()`, `groupingState()`, view mode / `colourKey` / section and the header.
  - `Konfiguration speichern` downloads it as pretty JSON. The file name is `<Titel>_<YYYY-MM-DD>_Konfiguration.json` (`safeFileName`).
- **Load.** `Konfiguration laden` (file input or a dropped `.json`) runs in this order:
  1. size check (`too-large`);
  2. read as UTF-8 and `parseConfig`;
  3. if no model is loaded: refused with `Zum Laden einer Konfiguration zuerst ein IFC-Modell laden.`;
  4. `applyConfiguration`: `applyConfig` against the catalogue and the column store (`hasValue` = the dictionary index, or `empties` for `null`), then one state change:
     - header;
     - filter sets: the file's list replaces the sets;
     - columns, sort and column filters: filters and sort on non-columns are dropped;
     - view and grouping: a new grouping collapses the groups; grouped with no level-1 property left uses `Kategorie`, as in TASK-006b;
     - mode, colouring, section: a section needs an axis range, otherwise it is reported as `Schnitt`;
     - then `retain`, `publishSets`, `publishTable`, scroll to top, and one `refresh()` (filter sets, table, status line, 3D).
  5. The notice is added when something was skipped.
  - On an error, the class message is shown and the view is unchanged.
  - The selection is not part of the configuration. It stays while its elements remain in the filter (TASK-005 / TASK-006c rule).
- **Drop.** Dropped `.json` files are configurations: the last one is applied after the IFC files of the same drop. Every other file is loaded as IFC, as before.
- **Seams.**
  - `window.CalcConfig` = `{ state(), loadText(text, name), header() }`.
  - `window.__calc.header` = `{ title, date, logo, titleSet, dateSet }`.
  - `window.__calc.config` = `{ loads, saves, last { ok, fileName, errorClass, message | notice, skipped, ms }, lastSaved { fileName, text } }`.
  - `start()` also returns `configState`, `applyConfiguration`, `loadConfigurationText`, `header` and `setHeader` (for the viewer file, TASK-009).

## Tests

| AC / item | Test | Type | Result (file + http) |
|---|---|---|---|
| REQ-011-AC1 (header part) | `test/e2e/config.spec.mjs` `@REQ-011-AC1`. **Defaults:** before a model, the app name and today; `Konfiguration laden` disabled. After loading FZK the title is the `Modell` (file name rule). **Dialog:** title `The M Bouwkundig`, date `2026-08-12` and `logo-test.png`. The header shows all three: `src` = the fixture's data URL, decoded 48x24, height ≤ 36 px. **Saved file:** `CalcConfig.header()` and the saved JSON carry them; the file name is `The M Bouwkundig_2026-08-12_Konfiguration.json`. **SVG logo** with XML declaration and comment. **Refused:** a PDF named `plan.png` and a PNG over 1 MB, each with its message; the logo stays. A cancelled file dialog changes nothing. **Closing:** `Abbrechen` keeps the header; empty fields plus `Logo entfernen` return to the defaults and the icon. | e2e, acceptance | pass |
| REQ-009-AC1 (+ REQ-003-AC2, REQ-006-AC6 configuration part) | `@REQ-009-AC1`. **Configured through the UI:** title with `<…>`, `&` and quotes; SVG logo; filter set `Typ` added; `Material` moved up; `Geschoss` collapsed; Kategorie = walls + `IfcSlab`; Geschoss = ground floor (reference). Columns `NetVolume` and `Typ` added and `Name` resized by keyboard. Column filters: Name = reference wall name, NetVolume `von 0,5`. Sort descending, `Gruppiert` Kategorie / Geschoss, `Ausblenden`, `Färben nach Material`, `Schnitt Z` flipped. **The JSON covers every REQ-009 field**, none at its default, and holds no element keys, expanded state or selection. **Round trip:** page reload, same IFC (default sets back), load the file. There is no notice or error. `configuredState` is deep-equal before and after: table, grouping, sets with collapsed and checked values, display, header, filter count and keys, and `CalcView.state()` (opaque / ghost / hidden / colours / section). The UI controls follow. The second save gives the identical text and file name. | e2e, acceptance | pass |
| REQ-009-AC2 (+ T7 "values of models not loaded") | `@REQ-009-AC2 @robustness`. **Saved with FZK + Duplex:** filter set `Modell` = both models; Kategorie = `IfcWallStandardCase` + the Duplex-only `absentKategorie`; filter set, column and level-2 grouping on the Duplex-only `absentProperty` (`REF["REQ-009-config"]`). **Loaded with FZK only:** `skipped.properties` = [absentProperty], `skipped.values` = Kategorie and Modell values. The notice names the property and both values. **The rest is applied:** sets, the present values, count = `present.elementsInFzk`, grouping level 1, the other columns. The notice can be closed. | e2e, acceptance, robustness | pass |
| REQ-009-AC3 (+ T7 config error classes, huge file) | `@REQ-009-AC3 @robustness`. The 4 committed fixtures (invalid JSON, no schema, foreign schema, version 2), a 25 MB file, an empty file and a JSON array. Each shows exactly its class message (spec text; version from the fixture metadata). `configuredState` is unchanged after each, no notice appears, and the save afterwards equals the save before. A cancelled file dialog does nothing. | e2e, acceptance, robustness | pass |
| T7 tolerant load | `@robustness tolerant load`. **Large file:** 60,000 missing GlobalId values; parse + apply < 5 s (`config.last.ms`); the notice is capped `und 59.980 weitere`. **Malformed and unknown entries** are reported in order and valid parts applied: count = reference walls, mode, clamped width. **No XSS:** the title `<img onerror>` is text, and an SVG logo with `<script>` / `onload` is an `<img>` that runs nothing (`window.__xss` undefined). **Drop:** a dropped `.json` is applied as a configuration and not as IFC. | robustness | pass |
| T2 round trip | `test/integration/config-roundtrip.spec.mjs` `@integration @REQ-009-AC1`: state set through the seams → `CalcConfig.state()` → fresh page. With no model the load is refused (`no-model`). With FZK, `loadText` gives the same configuration, filter count and keys. | integration | pass |
| cv-core | `test/unit/config.test.mjs` (10 tests): error classes on the committed fixtures with the spec messages; `validateConfig` edge cases incl. BOM and long versions; `buildConfig` order / defaults / no shared references; round trip `buildConfig` → `applyConfig` → `buildConfig`; skipped properties and values incl. D3 `""` → `null`, dropped empty column filters, sort of a missing column; malformed / unknown / partial / non-object parts; notice capping and German numbers; FZK snapshot with `REQ-009-config`; `safeFileName` incl. the REQ-008-AC5 example; dates; `classifyLogo` / `isLogoDataUrl` on the fixtures, by content, at and over the limit. | unit | pass |
| Fixtures | `test/unit/fixtures.test.mjs`: the configuration and logo fixtures are reproduced byte-identically by `scripts/make-config-fixtures.mjs`; manifest sha256. | unit | pass |

## Commands run and results
- `node scripts/check.mjs`: green (format, lint, cdn-cache, unit 97 tests with cv-core coverage 99.86 % lines, `@integration` http 20 tests incl. the new round trip).
- `npx playwright test test/e2e/config.spec.mjs`: 10 passed (file + http).
- `npx playwright test test/e2e --workers=2`: 114 passed (all e2e specs, both projects; regression of the header test in `filter-area.spec.mjs` and the smoke test).
- `npx playwright test test/acceptance test/integration --workers=2`: 48 passed (both projects).
- `node scripts/ref/derive-reference.mjs --check`: up to date.
- Not run: `test/perf` (no perf-relevant change; `publish()` only adds the header refresh).

## Changes to existing tests and reference data
- `scripts/ref/derive-reference.mjs`: new section `REQ-009-config`, derived from the STEP text of FZK and Duplex. It holds the Duplex-only property with the most row elements (`PSet_Revit_Other.AssetIdentifier`), the first Duplex-only Kategorie (`IfcCovering`) and `IfcWallStandardCase` with its FZK count (13). `meta.purpose` names REQ-009-AC2. No other section changed.
- `test/fixtures/manifest.json`: 6 new committed fixtures: `config-invalid-json.json`, `config-no-schema.json`, `config-foreign-schema.json`, `config-unsupported-version.json`, `logo-test.png` (48x24, built chunk by chunk) and `logo-test.svg`.
- `test/unit/fixtures.test.mjs`: one added test (reproducibility). No existing assertion changed or weakened.

## Deviations / interpretations
- **Where the code lives.** Spec §4.2 places "config save/load" in `cv-builder`. The save / load and the header dialog are wired in `cv-app` because the state lives there. Only builder mode creates the buttons (`mode === "builder"`). The pure parts are in `cv-core` as §4.4 names them. The viewer file (TASK-009) gets no save / load controls.
- **Saved title and date are the shown ones.** With defaults (first model's `Modell`, today) these values are written. After a load they are set values: the title no longer follows the models, and the date is the saved day. REQ-009 lists title and date as configuration content.
- **No message on a complete load.** Only a load that skipped something shows the notice. Errors always show their message.
- **Section offset** is applied as saved, in model coordinates, without clamping to the current extent. It needs an axis range: no model geometry means `Schnitt` is reported as not applied.
- **Configuration file name** `<Titel>_<YYYY-MM-DD>_Konfiguration.json`. The spec does not name it; it follows the REQ-008 export rule, plus a suffix so it is not mistaken for an export.
- **German date display** stays as before (`2.11.2026`, `toLocaleDateString("de-DE")`). The existing header test expects it.

## Decisions to confirm
- **Logo size limit 1 MB** (PNG / JPG / SVG by content). REQ-011 only says "embedded". The logo travels in every configuration and viewer file (NFR-003 size target). Larger files are refused with a German message.
- **`Konfiguration laden` needs a loaded model.** This is the conservative reading of REQ-009 "applies such a file to the currently loaded models": without models every property would be "missing". The button is disabled before the first model; a dropped `.json` and the seam are refused with `Zum Laden einer Konfiguration zuerst ein IFC-Modell laden.`
- **A part missing from the file keeps the current state.** A hand-written or partial file without `table`, or without `display.section`, does not reset those parts to the defaults of a new configuration. Files saved by the builder always contain every part, so AC1 is not affected.
- **Fourth load error `too-large` (> 20 MB, not read).** REQ-009 lists three classes; this one protects the tab from reading a huge file. A configuration of this design is a few MB at most (1 MB logo plus filter values).
- **Not in the configuration:** the option `Räume (IfcSpace) einbeziehen`, the splitter position and the collapsed details panel. REQ-009's list does not name them; they stay out.

## Open points
- **TASK-008.** Use `safeFileName(header().title, header().date, ".csv" | ".xlsx")` from cv-core and `start().header()`. REQ-011-AC1 file-name part.
- **TASK-009.**
  - The viewer file starts from the exported configuration: `start().applyConfiguration(config)` after the models are shown, or pass it in `options`. Today's `loadConfigurationText` refuses with no models.
  - The viewer header shows title, date and logo through `setHeader`. In viewer mode `renderLayout` creates no edit button and no save / load buttons.
  - REQ-011-AC1 viewer part.
- **Edge.** A drop with IFC and `.json` together, made while another load runs, queues the IFC files. The configuration is then applied to the models loaded at that moment, not after the queued ones.

## Orchestrator verification
- Independent verification in fresh context: VERDICT PASS (REQ-009-AC1..AC3 with 11 malformed files, round trip byte-identical, REQ-011-AC1 header part, prototype-pollution and limit probes, visual review, NFR-001 after load).
- Decisions to confirm (user, release gate): logo limit 1 MB; `Konfiguration laden` needs a loaded model; partial hand-written files keep the current state; extra error class `too-large` (> 20 MB); not saved: IfcSpace option, splitter position, collapsed details.
- Follow-ups (TASK-008 pass): C1 a range column filter on a text column is accepted silently -> report and skip; C2 `groupBy` with more than 2 keys drops the rest silently -> name them in the notice; C3 `Konfiguration speichern` enabled without a model -> disable like `laden`.
- TASK-007 done.
