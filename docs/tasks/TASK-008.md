---
id: TASK-008
title: CSV and XLSX export of the current table view incl. file names; follow-ups C1-C3 (TASK-007) and R2 (TASK-006c)
type: feature
status: done (verification pending)
implements: [REQ-008, REQ-008-AC1, REQ-008-AC2, REQ-008-AC3, REQ-008-AC4, REQ-008-AC5, REQ-011-AC1 (file-name part, builder), NFR-004, DEC-6, TASK-007 C1/C2/C3, TASK-006c R2]
relates_to: [REQ-006, REQ-007-AC5, REQ-009-AC2, REQ-010-AC2, ASM-004, ASM-008, TASK-006a, TASK-006b, TASK-007, TASK-009, TASK-010]
depends_on: [TASK-007]
touches: [calc-viewer-builder.html (cv-core-src, cv-ui-src, cv-app-src), scripts/make-unit-fixtures.mjs, scripts/ref/derive-reference.mjs, test/fixtures/fzk-export.ifc, test/fixtures/manifest.json, test/fixtures/reference-values.json, test/support/export.mjs, test/support/read-export.py, test/unit/export.test.mjs, test/unit/config.test.mjs, test/integration/export-readback.spec.mjs, test/e2e/export.spec.mjs, test/e2e/config.spec.mjs, test/e2e/selection.spec.mjs, test/perf/export.spec.mjs, test/perf/export-core.test.mjs]
---
# TASK-008: CSV and Excel export

## What was built

### cv-core (pure, unit-tested; spec 4.1 own writers, 4.4 `toCsv`, `toXlsx`)
- **`exportSheet(input)`** turns the rows the table shows into a sheet: `{ headers, rows [[cell]], bold [boolean], total }`. A cell is a number, a text or `null`. The input is `{ rows, columns [{ key, title }], view, order | items, total }`.
  - **Single view:** the rows of `order` (the filtered rows in table order), one cell per visible column.
  - **Grouping view:** first the columns `Ebene`, `Gruppe` and `Anzahl`, then the visible columns. The rows are the `groupDisplayRows` items, so:
    - level-2 rows appear only under expanded level-1 groups;
    - element rows appear only under expanded groups;
    - the total row comes last.
  - **`Ebene`** is `1`, `2`, `Element` or `Summe`.
  - **`Gruppe`** is the group value (`(leer)` for the empty group). It is empty on element and total rows.
  - **`Anzahl`** is the count. It is empty on element rows.
  - **Columns** carry the group cells (sums, or the common text value, REQ-006), the element values, and the total sums.
- **`exportValue`.**
  - A finite number stays a number.
  - Multi-values are joined with `, ` (numbers inside a multi-value use German notation, as displayed).
  - Empty values (`isEmptyValue`) become `null`.
- **`plainNumber` / `germanPlainNumber`** write numbers unrounded in their shortest round-trip form and never in exponent notation: `1e-7` becomes `0.0000001`, `2.5e21` becomes `2500000000000000000000`, and `-0` becomes `0`. The German form uses a decimal comma and no thousands separator.
- **CSV.**
  - `csvField`:
    - a text starting with `=`, `+`, `-` or `@` gets a leading `'` (DEC-6); numeric cells never do;
    - a field containing `;`, `"`, CR or LF is quoted, with quotes doubled (RFC 4180);
    - numbers get a decimal comma.
  - `toCsv(sheet, { pause })` writes the BOM (U+FEFF, encoded as UTF-8 by the download), `;` separators and CRLF after every record, the header row first.
- **XLSX** (`toXlsx(sheet, { pause })`, ASM-004). The parts are `[Content_Types].xml`, `_rels/.rels`, `xl/workbook.xml` (with `_xlnm._FilterDatabase`), its rels, `xl/styles.xml` (font 1 bold), `xl/sharedStrings.xml` and `xl/worksheets/sheet1.xml`.
  - **Sheet:** one sheet named `Tabelle`, with the parts in schema order: `dimension`, `sheetViews` (frozen pane `ySplit=1`), `sheetFormatPr`, `cols`, `sheetData`, `autoFilter`.
  - **Header:** bold.
  - **Cells:** numbers are numeric `<v>` cells (`plainNumber`); texts are shared strings, so `=SUM(A1)` stays text.
  - **Bold rows:** group and total rows.
  - **Column widths** are fitted to the longest cell text (in characters, per line), within 8 to 80.
  - **Autofilter** covers the header and the rows. In the grouping view it leaves out the total row.
  - **XML text** (`xmlText`): `& < >` are escaped and CR becomes `&#13;`. Characters XML 1.0 forbids, and a literal `_xHHHH_`, are written in the OOXML `_xHHHH_` form. A text longer than 32,767 characters (the Excel cell limit) is cut, in the `.xlsx` only.
- **ZIP** (`zipArchive`, `crc32`).
  - Parts are compressed with `CompressionStream('deflate-raw')`. A runtime without it gets stored parts (method 0).
  - Names are UTF-8, and the timestamp is fixed at 1980-01-01, so equal content gives equal bytes. There is no ZIP64.
- **Steps.** Both writers await `options.pause(fraction)` every `EXPORT_STEP_ROWS` = 2,000 rows, and the xlsx writer also before each compressed part. This drives the progress display and yields to the browser (NFR-004).
- **Follow-up C1:** `applyConfig` takes an optional `ctx.isNumber(key)`. A `range` column filter on a column that is not numeric is reported as `Spaltenfilter <key> (Bereich auf einer Textspalte)` under `Ungültige Angaben` and skipped.
- **Follow-up C2:** `groupBy` keys beyond the second level are reported as `Gruppierung <key> (höchstens 2 Ebenen)`. Duplicates are still dropped silently; missing keys are still named as missing properties.

### cv-ui
- `Export CSV` (`#cv-export-csv`) and `Export Excel` (`#cv-export-xlsx`) call `tableHandlers.exportTable('csv' | 'xlsx')`. They are enabled only while a model is loaded and no action runs.
  - Their tooltips are `Angezeigte Tabellenzeilen als CSV exportieren` and `Angezeigte Tabellenzeilen als Excel-Datei (.xlsx) exportieren`.
  - Without a model the tooltip is `Zuerst ein IFC-Modell laden.`
- **Follow-up C3:** `setConfigLoadable` and `setBusy` handle `Konfiguration speichern` like `Konfiguration laden`. It is disabled without a model, with the tooltip `Zuerst ein IFC-Modell laden.`, and disabled while an action runs. Its enabled tooltip is `Aktuelle Ansicht als Konfiguration (JSON) speichern`.
- **Follow-up R2:** `Escape` in a filter set's search field `Werte suchen` clears the field and shows all values again. The key event is marked handled, so the document listener (REQ-007-AC5) does not clear the element selection. This also holds for an empty field.

### cv-app
- **`exportTable(format)`** captures the table at the click, through `exportSheetNow()`:
  - the visible columns with their catalogue headers (units included, e.g. `BaseQuantities.NetVolume (m³)`);
  - single view: `order`;
  - grouping view: `displayItems` and `tree.total`.
- **The export run.** It is a busy action: `hook.phase = "exporting"`, and loads, configuration save / load and the exports are disabled while it runs.
  - The progress overlay shows `<Dateiname> – Export CSV: n %` (or `Export Excel`). Then the file is downloaded:
    - CSV as `text/csv;charset=utf-8`;
    - Excel as the spreadsheetml MIME type.
  - Files dropped meanwhile are loaded afterwards.
  - An error shows `Der Export ist fehlgeschlagen (<Grund>).`
- **File name:** `safeFileName(header().title, header().date, ".csv" | ".xlsx")` → `<Titel>_<YYYY-MM-DD>.csv|.xlsx` (REQ-008, REQ-011-AC1 file-name part).
- **Seams:**
  - `window.__calc.export` = `{ count, last { ok, format, fileName, rows, columns, view, ms } | { ok: false, …, message } }`.
  - `start()` also returns `exportTable` and `exportSheet` (for the viewer file, TASK-009).
- **C1 wiring:** `applyConfiguration` passes `isNumber` (catalogue kind `number`) to `applyConfig`.

### Test data
- **`test/fixtures/fzk-export.ifc`** is new and committed. It is derived from AC20-FZK-Haus by `scripts/make-unit-fixtures.mjs` (`fzkExport`, byte-reproducible, listed in the manifest).
  - The property set `CalcTest_Export` sits on 7 walls:
    - `Zahl` (IfcReal): `0.12345`, `1234567.891`, `0.0000001`, `-2.5` and `2500000000000000000000.`;
    - `Text` (IfcText): `=SUM(A1)`, `+49 721 608-0`, `-12 mm Fuge`, `@Wand`, a value with a line break, `;` and quotes, a non-ASCII value (`ö ß Ä – € 漢字`) and a 1,000-character value.
  - Non-ASCII characters and LF are written as STEP `\X2\` escapes (`stepString`). web-ifc decodes them; the decoded values reach the table unchanged.
- **`reference-values.json` section `REQ-008-export`** is derived from the STEP text by `scripts/ref/derive-reference.mjs` (`exportSection`).
  - `single`: every IfcWallStandardCase of fzk-export + Duplex (69), each with Modell, Kategorie, Name, Geschoss and Material. `Zahl` carries the IfcReal literal and its expected CSV text (the literal with a decimal comma), and `Text` the decoded text.
  - `grouped`: the 13 FZK walls with Name, Geschoss and NetVolume.
  - Group rows and totals come from `REQ-006-grouping-fzk`. `meta.purpose` names REQ-008-AC1/AC3/AC4. No other section changed.
- **Independent reader `test/support/read-export.py`** (`python3 -I`).
  - CSV is read with Python's `csv.reader(delimiter=';')`. It also reports the BOM and the line ends: CRLF outside quotes, and whether the file ends with CRLF.
  - Excel is checked in three ways:
    - the ZIP is validated with `zipfile.testzip()` (CRC);
    - every part is parsed as XML, and the reader reports the content-type overrides, the order of the sheet children, the frozen pane, the compression methods and the dimension;
    - openpyxl 3.1.5 reads every cell (value, type, bold), `freeze_panes`, `auto_filter.ref` and the column widths. `xlsx-summary` uses read-only mode for large files.

## Tests

| AC / item | Test | Type | Result (file + http) |
|---|---|---|---|
| REQ-008-AC1, AC4, AC5 | `test/e2e/export.spec.mjs` `@REQ-008-AC1 @REQ-008-AC4 @REQ-008-AC5`. **Setup:** fzk-export + Duplex, Kategorie = IfcWallStandardCase, columns Material, Zahl, Text and NetVolume added, title `A/B: C?`, date 2026-08-12. **File:** named `A_B_ C__2026-08-12.csv`; BOM bytes `EF BB BF`; CRLF only; ends with CRLF; header = the catalogue titles incl. `(m³)`. **Content:** 69 records in `__calc.table.keys` order, each equal to the reference: `0,12345`, `0,0000001`, `2500000000000000000000`, `-2,5` (no prefix), `'=SUM(A1)`, and the Duplex multi-material wall's materials joined with `, `. NetVolume is compared to `AC20-FZK-Haus.columnValues`. **Sort:** after sorting Zahl descending, the exported order equals the reference values sorted descending, empty last. | e2e, acceptance | pass |
| REQ-008-AC2, AC4 | `@REQ-008-AC2`. **Structure:** `testzip` OK, every part deflated, 4 overrides, the sheet children in schema order, `Tabelle`, frozen `A2` (pane state frozen), autofilter `A1:H70`, 70 × 8 cells. **Cells:** the header shows the same titles, bold. Every cell equals the reference: texts are `s` and numbers `n` with the same value, `=SUM(A1)` is a text cell without the prefix, empty cells are `None`, and data rows are not bold. **Widths:** within 8–80; the Text column is wider than Kategorie. | e2e, acceptance | pass |
| REQ-008-AC3 (+ REQ-011-AC1 file name) | `@REQ-008-AC3 grouping view`. **Setup:** FZK grouped by Kategorie, only IfcWallStandardCase expanded, NetVolume column, title `The M Bouwkundig`. **File:** named `The M Bouwkundig_2026-08-12.csv`. **Rows:** header `Ebene;Gruppe;Anzahl;<columns>`; one `1` row per Kategorie in German collation order (each row class of the STEP text present), with count, common Modell / Kategorie / Name / Geschoss and the volume sum as in `REQ-006-grouping-fzk`. The 13 walls are `Element` rows directly under their group (Name, Geschoss and NetVolume from the reference); `Summe` with count and volume total comes last. **Excel:** the same rows; group and total rows bold, element rows not; `Ebene` is text and `Anzahl` numeric; the autofilter leaves out the total row. | e2e, acceptance | pass |
| REQ-008-AC3 (two levels) | `@REQ-008-AC3 … two levels`. Kategorie / Geschoss, with IfcWallStandardCase and its ground-floor group expanded. Level-2 rows appear only under the expanded level-1 group, with the counts of `byGeschoss`. Element rows appear only under the expanded level-2 group. `Summe` comes last. | e2e, acceptance | pass |
| T7 special values | `@robustness special values`. **Values:** `= + - @` texts are prefixed in CSV and unchanged text cells in Excel. **Multi-line value:** one quoted field with doubled quotes, raw bytes checked. **Non-ASCII:** UTF-8 bytes present. **Long value:** 1,000 characters unchanged in both formats. | robustness | pass |
| T7 empty table | `@robustness empty table`. The range filter `NetVolume von 1000000` leaves 0 rows. **Single view:** CSV is the header only; Excel is the header only, autofilter `A1:E1`. **Grouping view:** header plus `Summe;;0;…`; in Excel `Summe` is bold with Anzahl 0. | robustness | pass |
| Buttons, progress | `@e2e export buttons`. **Without a model:** both buttons disabled, with the tooltip. **During the export:** the overlay showed the file name and `Export Excel`. **Afterwards:** the phase is `ready`; the table state and filter are unchanged; the buttons are enabled again. | e2e | pass |
| T2 read-back | `test/integration/export-readback.spec.mjs` `@integration`: fzk-export.ifc with Name / Material / Zahl / Text → CSV and `.xlsx` → Python reader; every wall row equals `REQ-008-export`, in table order. | integration | pass |
| NFR-004 | `test/perf/export.spec.mjs` `@perf @NFR-004` (file project): the volume set, 30,931 rows × 20 columns, through the buttons. Results below. | perf | pass |
| NFR-004 core | `test/perf/export-core.test.mjs` `[perf]`: a synthetic 30,000 × 20 sheet in Node, median of 3; openpyxl read-back finds 30,001 rows × 20 columns. Results below. | perf | pass |
| cv-core | `test/unit/export.test.mjs` (10 tests). **Numbers and values:** `plainNumber` incl. 5e-324, 1.79e308, -0 and round trip; `exportValue`. **CSV:** `csvField` (prefix only for texts; `" =x"` unprefixed; quoting); the exact CSV text of a 5-row sheet, read back by Python csv. **Sheets:** the grouping sheet (`Ebene` / `Gruppe` / `Anzahl`, `(leer)`, expanded rows only, total row, empty table, numeric group value); FZK snapshot counts and sums against `REQ-006-grouping-fzk`; `pause` fractions. **XLSX:** read back by openpyxl (values, types, bold, frozen header, autofilter without the total row, widths, CR LF, non-ASCII, deterministic bytes); edge cases (empty table, no columns, a 32,777-character text cut to 32,767, `_x0041_`, control characters); `xmlText`. **ZIP:** `crc32` check value `0xCBF43926`; `zipArchive` deflate (inflated by Node zlib) and the stored fallback without `CompressionStream` (openpyxl reads it); `columnName`. | unit | pass |
| C1, C2 | `test/unit/config.test.mjs`: 2 new tests (range filter on a text column reported and skipped, kept without `isNumber`; `groupBy` with 6 keys gives 2 levels, a missing property and two named extra keys). `test/e2e/config.spec.mjs` `@robustness … (TASK-007 C1, C2)`: a configuration file with both is loaded through `Konfiguration laden`; the notice names `Gruppierung Material / Name (höchstens 2 Ebenen)` and `Spaltenfilter Name (Bereich auf einer Textspalte)`; the grouping is Kategorie / Geschoss and only the numeric range filter is applied. | unit, e2e, robustness | pass |
| C3 | `test/e2e/config.spec.mjs` `@e2e … (TASK-007 C3)`: before a model, save and load are disabled with the tooltip `Zuerst ein IFC-Modell laden.` After FZK, both are enabled and save downloads. After the last model is removed, both are disabled again. | e2e | pass |
| R2 | `test/e2e/selection.spec.mjs` `@e2e @REQ-007-AC5 … (TASK-006c R2)`. The wall is selected. Typing `IfcWallStandardCase` in `Werte suchen: Kategorie` leaves one value. Esc clears the field, all values return, and the selection stays; Esc in the empty field keeps it too. Esc outside a field still clears the selection. Run against the product with the fix disabled, the test fails (`selection kept`: null). | e2e | pass |

### NFR-004 measurements (Chromium headless, file project, software WebGL; Node 22.23.4)

| Export | Rows × columns | Click → download (median of 3 / max) | `export.ms` median | Longest task |
|---|---|---|---|---|
| CSV, single view | 30,931 × 20 | 214 / 265 ms | 190 ms | 50 ms |
| Excel, single view | 30,931 × 20 | 431 / 444 ms | 395 ms | 106 ms |
| CSV, grouping view, all expanded | 30,960 × 23 | 308 ms (one run) | 260 ms | 57 ms |
| Excel, grouping view, all expanded | 30,960 × 23 | 445 ms (one run) | 417 ms | 96 ms |
| Node core, synthetic | 30,000 × 20 | CSV 364 ms, Excel 1,154 ms (median of 3; 7.7 MB / 3.9 MB) | – | – |

The progress overlay showed the export step in every run. Budgets: ≤ 5 s per export, no task over 1 s.

## Commands run and results
- `node scripts/check.mjs`: green. It ran format, lint and the cdn-cache, then unit tests (109 tests, cv-core coverage 99.78 % lines), then `@integration` on http (21 tests incl. the new read-back).
- `npx playwright test test/e2e --workers=3`: 134 passed (all e2e specs, both projects, incl. the new export, C1–C3 and R2 tests).
- `npx playwright test test/acceptance test/integration --workers=3`: 50 passed (both projects).
- `npx playwright test test/perf/export.spec.mjs --project=file`: 1 passed (1.0 min).
- `node --test test/perf/export-core.test.mjs`: 1 passed.
- `node scripts/ref/derive-reference.mjs --check`: up to date.
- Not run: the other `test/perf` specs (table, grouping, view-3d, selection, load-100mb). The product change touches no code they measure, only the export buttons and the busy flags.

## Changes to existing tests and reference data
- `scripts/make-unit-fixtures.mjs`: new `fzkExport`, `stepString`, `EXPORT_PROPERTY`, `EXPORT_VALUES` and `EXPORT_LONG_TEXT`, and the fixture is added to `UNIT_FIXTURES`. The four existing fixtures are regenerated byte-identically; `test/unit/unit-fixtures.test.mjs` checks this and now covers `fzk-export.ifc` too.
- `test/fixtures/manifest.json`: the entry for `fzk-export.ifc` was added.
- `scripts/ref/derive-reference.mjs`: new section `REQ-008-export`, and `meta.purpose` was extended. No other section changed.
- `test/unit/config.test.mjs`, `test/e2e/config.spec.mjs`, `test/e2e/selection.spec.mjs`: tests were added only. `removeModel` and `shownValues` were added to their imports. No existing assertion changed or weakened.

## Deviations / interpretations
- **The export captures the table at the click.** Filter changes made while it runs do not change the file. The export lasts well under a second at 30k rows.
- **`Gruppe` of the empty group is `(leer)`,** as the table shows it. The spec says "group value", and the empty value has no other text.
- **`Ebene` `1` / `2` are text cells in Excel.** The column mixes them with `Element` / `Summe`; `Anzahl` and the numeric columns are numbers.
- **Numbers inside multi-values** (rare; multi-values are texts per spec 4.3) are written in German notation inside the joined text, in CSV and Excel alike.
- **CSV ends with CRLF after the last record** (RFC 4180 allows both).
- **The Excel autofilter covers the header and the data rows, without the total row.** The `Summe` row then stays below the filtered rows instead of being filtered or sorted with them.
- **Column width** is the longest cell text in characters, plus 2, within 8–80. It is not a rendered font measurement.
- **Where the code lives.** The writers are in cv-core (spec 4.2 lists "CSV/XLSX writers" there). The button wiring is in cv-ui / cv-app, so the viewer file (TASK-009) gets the exports with no builder code.

## Decisions to confirm
- **Export buttons need a loaded model.** This is the conservative reading, like `Konfiguration laden` / `speichern`: without a model the table is empty and there is nothing to export. With a model, an empty filter result exports the header (and `Summe` in the grouping view).
- **Texts over 32,767 characters are cut in the `.xlsx`** (the Excel cell limit; Excel would otherwise refuse or repair the file). The CSV keeps the full text. IFC values of that length are not expected.
- **The formula-injection prefix applies to exactly `= + - @`** (DEC-6 as written). Texts starting with TAB or CR, which some guides add, are not prefixed. Numbers never are, including negative numbers.
- **Control characters in Excel texts** (other than TAB / LF / CR) are written in the OOXML `_xHHHH_` form, which Excel shows as the character. They cannot appear as raw XML 1.0 text.
- **Esc in an empty filter search field** does not clear the element selection either. Esc while focus is in the field never reaches the selection (R2, conservative: one key, one effect).
- **C1 covers only the range-on-text case named in the follow-up.** A `values` column filter on a numeric column is still applied as before (values are matched by equality).

## Open points
- **TASK-009.**
  - The viewer file gets the exports through the same `tableHandlers.exportTable`.
  - REQ-010-AC2 (viewer CSV equals the builder CSV) can compare `start().exportSheet()` or the downloaded bytes.
  - `exportTable` needs `models.length > 0`: the viewer start must register its models (or `setConfigLoadable(true)`) so that the buttons are enabled.
- **TASK-010.** NFR-004 is measured here at the volume set (≤ 0.45 s per export). The 100 MB multi-model set is not exported yet.
- **R-3** (Excel itself untested; openpyxl and the structure checks pass) stays for the release smoke test in Excel / LibreOffice.

## Orchestrator verification
- Independent verification in fresh context: VERDICT PASS (REQ-008-AC1..AC5, REQ-011-AC1 file-name part; read-back with python csv, openpyxl and LibreOffice; repeated exports byte-identical; C1, C2, C3, R2 fixed; NFR-004 at 30,931 x 20: CSV 214 ms, Excel 431 ms).
- Follow-ups (TASK-010): progress bar in the browser's default blue instead of the UI-02 accent; non-ASCII download names arrive as `download` in headless Chromium under a POSIX locale (environment; manual check at release, R-3).
- TASK-008 done.
