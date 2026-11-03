---
id: TASK-002
title: Extraction and property model (importer config, rows, units, catalogue; multi-model, remove, duplicates, load errors, IfcSpace option; 100 MB smoke)
type: feature
status: done
implements: [REQ-001, REQ-002]
relates_to: [NFR-002, DEC-1, DEC-2, DEC-3, DEC-4, DEC-5, DEC-11, DEC-12, DEC-13, R-2]
depends_on: [TASK-001b]
touches: [calc-viewer-builder.html, test/unit/extraction.test.mjs, test/integration/extraction.spec.mjs, test/acceptance/fetched-fixtures.spec.mjs, test/perf/load-100mb.spec.mjs, test/support/builder.mjs]
---
# TASK-002: Extraction and property model

## What was built

### cv-core (pure, unit-tested in Node)
- **Load errors (REQ-001).**
  - `classifyIfcFile(size, head, tail)` checks a file before conversion:
    - 0 bytes gives `empty`.
    - A file that does not start with `ISO-10303-21;` gives `not-ifc`.
    - A `FILE_SCHEMA` other than `IFC2X3`/`IFC4` gives `unsupported-schema` with the schema in the message.
    - A missing `FILE_SCHEMA`, or a missing `END-ISO-10303-21;` at the end of the file (truncated file), gives `unreadable`.
  - `LoadError` and `loadErrorMessage` produce the five German messages exactly as in REQ-001, each with the file name.
- **Model names (DEC-12).** `modelNameFromFile` gives the file name without its extension. `uniqueModelName` adds ` (2)`, ` (3)` and so on to names already in use.
- **Importer and relation config (spec 4.3).**
  - `IMPORTER_EXTRA_CLASSES` is `IFCDOORSTYLE`, `IFCWINDOWSTYLE`, `IFCCONVERSIONBASEDUNIT` and `IFCMEASUREWITHUNIT`.
  - `ITEM_DATA_CONFIG` switches on `IsDefinedBy`, `HasPropertySets` and `HasAssociations`, plus the pset, quantity and material child relations. Every inverse or heavy relation is switched off explicitly (`DefinesOccurrence`, `ObjectTypeOf`, `AssociatedTo`, `ContainsElements`, `ContainedInStructure`, `IsDecomposedBy`, `Decomposes`, `IsNestedBy`, `Nests`, `Referenced*`, `RepresentationMaps`). Without this, nested items inherit the parent's config: a probe showed the type object pulling in all its occurrences through `ObjectTypeOf`.
  - `UNIT_DATA_CONFIG` reads IfcUnitAssignment. `INDEX_CHUNK_SIZE` is 2000.
- **Row classes.**
  - `rowClasses(elementClasses, includeSpaces)` takes the importer's element classes and removes spatial structure classes (project, site, building, storey, space, facility classes) and type/style classes.
  - `categoryPattern` builds one RegExp for `getItemsOfCategories`.
  - `classNameMap` maps the upper-case category to the schema spelling (`IfcWallStandardCase`), using the class names that web-ifc exports for IFC2X3, IFC4 and IFC4X3.
- **Units (DEC-2).**
  - `describeUnit` and `parseUnits` handle IfcSIUnit (with prefix, and squared/cubed exponents), IfcConversionBasedUnit (IfcMeasureWithUnit factor × base unit, including a prefixed base), IfcDerivedUnit and IfcMonetaryUnit.
  - `convertUnit` converts length, area and volume to m, m² and m³. A negative SI exponent divides by a power of ten, so 9700 mm gives exactly 9.7. Other measures keep the project unit label (for example `kg` or `lb`).
- **Storeys.** `spatialIndex(tree)` finds the nearest IfcBuildingStorey ancestor in `getSpatialStructure()`, including through aggregation. `storeyNames` attaches the names.
- **Materials.** `materialNames` collects every IfcMaterial reachable through layer set (usage), list, constituent set and profile set (usage). Classification references are skipped. The names are distinct and sorted. If the occurrence has no material, the type's material is used.
- **Values.** `normaliseValue`:
  - numbers stay numbers and are converted;
  - booleans and IFCLOGICAL `T`/`F` become `Ja`/`Nein`;
  - text stays text even if it looks numeric (DEC-5);
  - empty strings and null count as no value.
- **Rows.** `createExtractor` produces rows `{ key: "<modelId>:<localId>", model, localId, guid, geometry, values }`.
  - `values` holds `Modell`, `Kategorie`, `Name`, `GlobalId`, `ObjectType`, `Tag`, `PredefinedType`, `Description`, `Typ`, `Geschoss`, `Material` (array), `Geometrie` (`Ja`/`Nein`) and `<Pset>.<Property>`.
  - The type is found through `IsDefinedBy` (category ending in `TYPE`/`STYLE`). Its psets come from `HasPropertySets` (and from `IsDefinedBy` on the type) and are applied first. Occurrence psets are applied after them, so the occurrence value wins and the type value fills gaps (DEC-1).
  - Per model, `properties` is collected: pset name, property name, whether the value came from the occurrence or the type, the kinds seen and the units seen.
- **Catalogue (spec 4.3).** `buildCatalog(rows, models)` returns `propertyKey → { key, label, group, kind, unit, count, header }`.
  - Order: the special properties first, in a fixed order (`Allgemein`), then the rest by group and label.
  - Group: the pset name, or `Typ: <pset>` for type-only properties.
  - Kind: `number`, `text`, `multi` or `bool`; mixed number and text becomes `text`.
  - Unit: if a numeric property has different units across the loaded models (or within one model), the unit is `gemischt`.
  - Count: the number of visible rows that have a value.
  - Header: `<label> (<unit>)` for numbers.
- **IfcSpace option.** `visibleRows(rows, includeSpaces)` implements the option at data level (DEC-13).

### cv-builder (engine part)
- **Conversion worker.**
  - It imports web-ifc next to fragments. It adds the four extra classes by their web-ifc codes, so a wrong name fails loudly.
  - It always converts IfcSpace, as transparent (`forceTransparentSpaces`); the option only hides or shows spaces.
  - It returns the names of the importer's element classes together with the `.frag` bytes.
- **Pre-check.** `checkFile` reads the first 64 KiB and the last 1 KiB of the file and classifies them before any worker starts. If the last 1 KiB does not show the trailer, it reads the last 64 KiB (see Verification fixes).
- **Error mapping.**
  - A worker `error` event gives `too-large`.
  - A worker `error` message (an exception in parsing or conversion) gives `unreadable` with its cause.
  - No message from the worker within 30 s gives `unreadable` with `der Konverter ist nicht gestartet (keine Antwort nach N s)`. This is the load watchdog for a worker that never starts; TASK-001b open point.
- **Test hooks**, each consumed once: `window.__calc.test.crashNextConversion` makes the next worker throw from a timer, which raises an `error` event. `neverStartNextConversion` uses a worker script that never answers. `startTimeoutMs` shortens the watchdog.
- **`extractModel`** runs these steps:
  1. `getItemsOfCategories(rowClasses)`, `getSpatialStructure()` and the IfcUnitAssignment ids.
  2. Storey names through `getItemsData`, and the units.
  3. `getItemsData` in chunks of 2,000 ids with `ITEM_DATA_CONFIG`, reporting progress and yielding after each chunk.
  4. The geometry flag from `getItemsIdsWithGeometry()`.

### cv-3d
- `loadModel` returns `{ modelId, model, withGeometry }`. There is a new `removeModel` (`disposeModel`), and `setItemsVisible` (used to hide IfcSpace).
- **Bug found and fixed (root cause).** Calling `fragments.update(true)` after `disposeModel` sometimes never resolved when the removed model was the last one. `forceUpdateFinish` waits for a tile FINISH at the last dispatched request number, and with no model left that FINISH never arrives. In a stress run (12 runs, 3 workers) it hung in 2 of 6 runs before the fix and 0 of 12 after. Removal now uses the non-forced `fragments.update()`. A regression test removes the last model three times in a row.

### cv-app and cv-ui
- **Multi-model state.** Every model keeps its rows, properties, IfcSpace ids and `.frag` bytes; the `.frag` bytes are kept for TASK-009.
- **`publish()`** rebuilds the visible rows and the catalogue.
- **Loading.** Files can be loaded through the file picker or by drag and drop.
- **Errors.** A failing file is skipped and its classified message is added to `#cv-messages` (it stays until closed) and to the overlay. The other files continue.
- **Model list** `#cv-models` shows Modell name, element count and a remove button (`Modell entfernen: <Modell>`).
- **Option** checkbox `Räume (IfcSpace) einbeziehen`, default off.
- **Progress overlay** shows `<file> – <step>: <n> %` with a `<progress>` bar. Steps: `Prüfung`, `Konverter wird gestartet`, `Konverter wird geladen`, `Datei wird gelesen`, `Konvertierung` (with %), `Anzeige`, `Extraktion` (with %).
- **Test hook `window.__calc`:** `phase`, `error` (fatal start error only), `models [{ id, name (file name), modell, elements, withGeometry (visible rows with geometry) }]`, `rows`, `catalog` (entries in order), `loadErrors [{ fileName, loadClass, message }]`, `queued`, `loads` (counter of finished load/remove/option actions, used for waiting), `progress`, `options.includeSpaces`, `test`.

## Tests
| AC / NFR | Test | Type | Result |
|---|---|---|---|
| REQ-001-AC2 (all 5 classes; valid model stays; page usable) | `test/integration/extraction.spec.mjs` `@REQ-001-AC2` | integration, acceptance, robustness | pass |
| REQ-001-AC3 (data level: rows, catalogue) | `… @REQ-001-AC3` | integration, acceptance | pass |
| REQ-001-AC4 (data level: rows; option on/off) | `… @REQ-001-AC4` | integration, acceptance | pass |
| REQ-001-AC5 | `… @REQ-001-AC5` | integration, acceptance | pass |
| REQ-001 load watchdog, remove last model, progress overlay | `… @REQ-001` (3 tests) | integration, robustness | pass |
| REQ-002-AC1 (+ data basis of REQ-004-AC1/AC2 sets and ground-floor counts) | `… @REQ-002-AC1` | integration, acceptance | pass |
| REQ-002-AC2 (+ REQ-006-AC1 category counts 837/491/629/43) | `test/acceptance/fetched-fixtures.spec.mjs` | acceptance (fetched) | pass |
| REQ-002-AC3 | `fetched-fixtures.spec.mjs` (Revit ARC) + `[unit]` | acceptance, unit | pass |
| REQ-002-AC4 | `extraction.spec.mjs` (Duplex) + `[unit]` | integration, acceptance, unit | pass |
| REQ-002-AC5 | `extraction.spec.mjs` (`Raumnummer`) + `[unit]` (`"1.5"`) | integration, acceptance, unit | pass |
| REQ-002-AC6 | `extraction.spec.mjs` (fzk-feet, fzk-unit-a/b) + `[unit]` | integration, acceptance, unit | pass |
| REQ-002-AC7 | `fetched-fixtures.spec.mjs` (SampleCastle) | acceptance (fetched) | pass |
| NFR-002 / R-2 smoke | `test/perf/load-100mb.spec.mjs` | perf (`file` project) | pass, numbers below |
| cv-core logic | `test/unit/extraction.test.mjs` (19 `[unit]`) | unit | pass; cv-core lines 100 %, branches 89 % |

**Fixtures for AC3 and AC4.**
- The tester's report says that no FZK element has several layer materials. My own search with the tester's STEP reader showed that no committed fixture has type psets either.
- **REQ-002-AC4** therefore uses `Ifc2x3_Duplex_Architecture.ifc` (committed). The layered elements and their expected materials are computed at test time with `scripts/ref/ifc-model.mjs`, independent of the product. Example: wall `2O2Fr$t4X7Zf8NOew3FNld` has `Metal - Stud Layer` and `Plasterboard`.
- **REQ-002-AC3** uses the fetched `Ifc4_Revit_ARC.ifc`:
  - wall `3lLx0gNe59vvExhby0Bfew` has `Pset_WallCommon.IsExternal` T on the occurrence and F on its type, so the expected value is `Ja`;
  - curtain wall `3Yxgiuz3TDpeHhosGP5bD6` has `Pset_CurtainWallCommon.Reference` = `SH_Curtain wall` only on its type.

  Both are cross-checked against the STEP reader in the test.

**Reference values.** I did not change any expected value. All checks against `reference-values.json` passed on the first run of the extraction.
- The FZK row counts per Kategorie equal `elementsInStepTextByKategorie` without IfcOpeningElement. Openings are not an importer element class.
- IfcAnnotation and IfcVirtualElement are rows (importer default classes), so the conditional values apply and are asserted.

## R-2: ≥ 100 MB multi-model smoke (NFR-002)
**Set:** `Ifc2x3_SampleCastle.ifc` ×2 plus `Ifc4_Revit_MEP.ifc`, 127.7 MB in total, loaded in one batch through the file input. Builder opened via `file://`, Chromium 153.0.8010.12 (Playwright 1.63), container with 4 vCPU and 15 GB RAM.

| Run | Wall time (selection → 3 models extracted) | Peak JS heap, main page | Rows | Catalogue entries | Crash / errors |
|---|---|---|---|---|---|
| alone (`npx playwright test test/perf --project=file`) | 86.4 s | 181 MB | 14,094 (3,635 + 3,635 + 6,824) | 6,187 | none |
| inside `check --all` (2 Playwright workers in parallel) | 99.1 s | 191 MB | 14,094 | 6,187 | none |

- **Peak heap.** Measured with CDP `Performance.getMetrics` `JSHeapUsedSize`, polled every 250 ms. It covers the main page only. The conversion workers (web-ifc wasm) and the Fragments worker are not included, because a fresh conversion worker per file is terminated after each file.
- **Timing.** The time per 100 MB (≈ 68 s alone) is above the NFR-002 target of ≤ 60 s per 100 MB. NFR-002 is defined per single ≥ 100 MB IFC as the median of 3 and is measured in TASK-010, which can tune it. The run did not crash, so R-2 is not blocking. The JSON of the last run is written to `test-results/perf-100mb-multi-model.json`.

## Commands run and results
- `node --test 'test/unit/**/*.test.mjs'`: 38/38 pass.
- `npx playwright test test/integration/extraction.spec.mjs --project=http`: 11/11 pass.
- `npx playwright test test/acceptance --project=http`: 3/3 pass (MEP 20 s, ARC 9 s, Castle 24 s).
- `npx playwright test test/perf --project=file`: 1/1 pass (numbers above).
- Stress run of last-model removal (`--repeat-each=12 --workers=3`): 12/12 after the fix. Before the fix 2/6 hung; that probe spec was removed.
- `node scripts/check.mjs`: all steps green. Unit 38/38, c8 cv-core 100 % lines, `@integration` http 13/13.
- `node scripts/check.mjs --all`: all steps green. Playwright 35 passed and 1 skipped (the perf test runs in the `file` project only), across both projects.

## Deviations
- **IfcSpace handling.** IfcSpace is always converted (transparent) and extracted. The option filters rows and the catalogue (`visibleRows`) and hides or shows the space items in 3D (`setVisible`), with no reconversion. Spec 4.3 says "IfcSpace by option" for the element list, and the reference app excludes spaces at conversion. Filtering after extraction makes switching the option instant and reversible.
- **Truncated files.** These are classified as `unreadable` by the trailer check (`END-ISO-10303-21;` missing) before conversion, not by a web-ifc exception. Exceptions from conversion still map to `unreadable` with their cause.
- **Hook field names.** `window.__calc.models[i].name` stays the file name, so the TASK-001b smoke test is unchanged. The Modell value is in `modell`. `elementCount` now counts the extracted visible rows: 99 for FZK, against 83 items with geometry before.
- **Placement of the extraction code.** The extraction orchestration (engine calls) is in `cv-builder`, and the pure rules are in `cv-core`. `cv-3d` only gained `removeModel` and `setItemsVisible`. The viewer file does not extract (DEC-7).
- **Status line.** It still reads `N Elemente in M Modell(en)`. The `X von Y Elementen` form comes with the filter engine (TASK-004).

## Verification fixes
The independent verification of TASK-002 passed with defects. These are fixed; each fix has a test that fails on the previous code.

| Finding | Fix | Test |
|---|---|---|
| **Defect A (medium).** A file dropped while a load ran was silently lost: `loadFiles` returned early when busy, and drag and drop stayed active. | Files dropped during any running action (load, remove, IfcSpace option) are queued (`window.__calc.queued`). Files queued during a load are loaded in the same batch; after a remove or option change the queued files start loading at once. The batch counts once in `loads`. | `extraction.spec.mjs` `@robustness` "a file dropped while a load runs is queued and loaded after it" |
| **Defect B (low).** The error overlay stayed over the 3D view when the last file of a batch failed (`finally` cleared it only if the last file loaded). | `settleOverlay()` runs at the end of every action (load batch, remove, option) and in `publish()`. With a model loaded the overlay is hidden; with none, the builder shows its start hint. The message stays in `#cv-messages`. | `@robustness` "a failed last file does not leave its error over the 3D view" |
| `hook.error` was set on every load error and never reset. | `hook.error` holds only fatal start errors (`fail()`); load errors are only in `loadErrors`. | the same test asserts `error` stays `null` after load errors |
| `hook.models[].withGeometry` counted `getItemsIdsWithGeometry`, which includes non-row items. | It now counts the model's visible rows with `geometry: true`. The perf test only records the value. | `@REQ-002-AC1` |
| AC1 test had no assertion on the whole row set. | Rows per Kategorie equal `elementsInStepTextByKategorie` without IfcOpeningElement (99 for FZK); `rows.length` and `models[0].elements` equal the sum. The expected values come from the reference data only. | `@REQ-002-AC1` |
| `buildCatalog` merged properties seen only on hidden IfcSpace rows (kind, unit, `Typ:` group). | `createExtractor` keeps `spaceProperties` apart from `properties`. `buildCatalog` uses a model's `spaceProperties` only if IfcSpace rows of that model are among the given (visible) rows. | `[unit] DEC-13 buildCatalog: properties of hidden IfcSpace rows do not change kind, unit or group` |
| The trailer check rejected valid files with more than 1 KiB of trailing blank space, or a comment after `END-ISO-10303-21;`. | `trailerText`/`trailerComplete` in cv-core strip NULs, trailing whitespace and complete trailing `/* … */` comments. `checkFile` reads up to 64 KiB (`TRAILER_PROBE_MAX_BYTES`) when the last 1 KiB does not show the trailer. A truncated file (also one ending in an unterminated comment) is still `unreadable`. | `[unit] REQ-001 trailer check: …`; `@robustness` "a valid file with a comment and > 1 KiB blank space after the trailer loads" |
| `reference-values.json` "why" for `0oTQ6V1VbChulreA_hfmUa` said "member without type object". | Reworded: the type object `#35265` exists, only its Name is `$`. No expected value changed. | n/a |
| IfcSpace always converted: deviation from §4.3 recorded only here. | Recorded in `docs/process-log.md` as a design detail, with its effect on TASK-005. | n/a |

### Deferrals recorded by the verification
- **REQ-002-AC4, filter part** ("filtering by any one of them matches the element") is covered here only at data level (`Material` lists every layer material). The filter part is deferred to TASK-004 (filter engine) and TASK-006a/006b.
- **REQ-002-AC5, UI part** ("left-aligned, not summed") is covered here only at data level (the value stays text, catalogue kind `text`). The table rendering and sums are deferred to TASK-006a/006b.
- **Conversion worker hanging mid-conversion.** The load watchdog covers only a worker that never starts. A worker that hangs after it started has no timeout. Deferred to TASK-010.

## Open points
- **NFR-002 timing.** The 100 MB multi-model set takes ≈ 68 s per 100 MB alone, against the 60 s target. Breakdown and tuning are in TASK-010 (candidates: worker reuse, conversion settings, chunk size).
- **Deferred to TASK-004/005/006a.** REQ-001-AC3 ("filters on remaining values stay active", 3D) and REQ-001-AC4 (3D and filter sets) are covered here only at data level. The 3D side of the IfcSpace option (spaces hidden with the option off) is implemented but not asserted; `CalcView.state()` comes in TASK-005.
- **"No sums are shown"** for a `gemischt` column (REQ-002-AC6) is covered here at data level (`unit: "gemischt"`). The sums themselves are TASK-006b.
- **Quantity units.** A quantity with its own `Unit` attribute (IfcPhysicalSimpleQuantity.Unit) is converted with the project unit, not its own. No fixture uses this; the tester's reference reader supports it. Candidate for T7 robustness.
- **Unit labels.** Derived units are labelled from a small table by UnitType, or by their UserDefinedType. IfcDerivedUnitElement is not imported (not in the importer's class set), so other derived units show their UnitType name.
- **REQ-002-AC4 filter part and REQ-002-AC5 UI part.** Deferred to TASK-004/006a/006b (see Verification fixes).
- **Worker hang mid-conversion.** No timeout yet; TASK-010.
- **IfcSpace 3D side.** TASK-005 must keep spaces hidden through ghost/hide resets and out of `CalcView.state()` (`docs/process-log.md`).

## Verification INC-1 (2026-11-03)
- **Decision to confirm (release gate, business rule — verification INC-1 SYNC F1): `IfcOpeningElement` and `IfcDistributionPort` (and any other IFC product class outside the Fragments importer's element classes) are not rows.** Rows come from the importer's element classes (`rowClasses`). Measured against the STEP text (entities with a GlobalId): Revit MEP 131 openings / 8,515 ports, Revit ARC 35 / 60, FZK 17 / -, Duplex 50 / - -> 0 rows each. The spec (REQ-002 "Elements are listed by IFC class (not only those with geometry); spatial structure elements ... and type objects are not rows"; §1 Element = "one IFC product occurrence") does not exclude them. Conservative reading kept: they stay out, because openings are voids (their quantities would double-count the walls' openings in counts and sums) and ports are connection points of MEP elements, not elements to quantify — the same reason as DEC-13 for IfcSpace (no room volumes in element sums). Not changed in code. The baseline text of REQ-002 needs a change request to name these exclusions (proposed CR text in `docs/reviews/verification-INC-1.md`). Until then this is recorded in `docs/process-log.md`.
- Tests already encode it (`NOT_ROWS = ["IfcOpeningElement"]` in `test/e2e/filter-area.spec.mjs`, `test/e2e/grouping.spec.mjs`).
