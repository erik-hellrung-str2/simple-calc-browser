---
id: TASK-018
title: "Configuration and viewer file: save/load of the new fields, notice, compatibility fixtures (1.0.0 -> 1.1.0, 1.1.0 -> 1.0.0), viewer parity incl. rules"
type: feature
status: implemented (awaiting orchestrator verification)
implements: [REQ-009-AC1, REQ-009-AC4, REQ-009-AC5, REQ-009-AC6, REQ-009-AC7, REQ-009-AC8, REQ-010-AC2, REQ-010-AC4, REQ-013-AC12]
relates_to: [CR-002, INC-2, REQ-009, REQ-010, REQ-012, REQ-013, DEC-15, DEC-18, DEC-19, DEC-20, TASK-012, TASK-015a, TASK-015b, TASK-016, TASK-017a, TASK-017c, TASK-019, TASK-020]
depends_on: [TASK-012, TASK-017c]
touches: [calc-viewer-builder.html (cv-app-src configState, applyConfiguration), scripts/ref/derive-reference.mjs (section REQ-009-rules), test/fixtures/reference-values.json (regenerated), test/e2e/config-compat.spec.mjs (new), test/e2e/config.spec.mjs, test/e2e/viewer.spec.mjs, test/integration/config-roundtrip.spec.mjs, test/support/config.mjs, test/unit/trace.test.mjs, docs/testing/traceability.md]
---
# TASK-018: Configuration and viewer file with the CR-002 fields

Spec §5 acceptance: REQ-009-AC1, AC4..AC8 (AC8: the load notice in the UI, one Playwright case per invalid DEC-20 field), REQ-010-AC2/AC4, REQ-013-AC12 green incl. `config-roundtrip.spec.mjs`, `config.spec.mjs`, `viewer.spec.mjs`, `viewer-robustness.spec.mjs`; REQ-010-AC1/AC3 still green.

## What was built

### cv-app (the only product change)
- **`configState()`** passes the rule list (`rules`, in list order) and the search text (`searchText`, as typed) to cv-core `buildConfig`.
  - So `Konfiguration speichern` writes them as `filterRules` / `search` (DEC-20).
  - `HTML exportieren` embeds them in the viewer file's configuration.
  - Until now both were always written as `[]` / `""` (TASK-012 interim, decision 4).
- **`applyConfiguration()`** applies `apply.filterRules` and `apply.search`. cv-core `applyConfig` (TASK-012) always sets both, so an absent field clears the rules and the search (REQ-009-AC5).
  - The valid rules replace the rule list in file order.
  - The search text replaces `searchText`, and `ui.tools.setSearch` writes it into `Suchen nach Objekten` without a search event.
  - This runs before `store.retain(keysInUse())`, so the columns of the rules stay cached.
  - The `refresh()` at the end evaluates them. A `Freie Textsuche` rule or a search text builds the display-text index synchronously there (cv-core `textNeedleMask`, spec 4.3) when it does not exist yet.
  - The same path runs when the viewer file starts (`openViewer` → `applyConfiguration`), so the viewer shows the exported rules and search (REQ-010-AC4).
- Unchanged and verified end to end here:
  - hidden and isolated elements are cleared on every configuration load (TASK-017a, DEC-20);
  - they are never saved (`buildConfig` has no field for them);
  - the 1.0.0 axis section is converted and a `sectionPlane` is applied as given (TASK-012, TASK-017c);
  - the DEC-20 notice labels come from cv-core `applyConfig` and `configNotice`.

### Reference values (`scripts/ref/derive-reference.mjs`, new section `REQ-009-rules`)
The expected key sets of the configuration and viewer round trips (orchestrator note 2: "configuration round trips → TASK-018"). They are derived from the STEP text with DEC-19 matching written in the script, independently of the product (as `ruleSection`):
- `config-1.1.0-full`: the two rules and the search text of `config-1.1.0-full.json` → 9 elements (the ground-floor walls `Wand-*-ERDG-*`);
- `REQ-009-AC6`: the valid rules of `config-1.1.0-rules-skipped.json` without the rule on the Duplex-only property → 10 walls;
- `REQ-010-AC4`: `Isolieren` · `Kategorie` · `Enthält` · `wall`, `Markieren` · `Name` · `Enthält` · `ext`, search `erdg` → 9 walls, 4 of them marked.

`Freie Textsuche` and the search look at every value of every property: `Modell`, attributes, `Typ`, `Geschoss`, `Material`, psets and qtos. `Geometrie` is not included; its values `Ja` / `Nein` match none of the needles. `node scripts/ref/derive-reference.mjs --check` is green; the other sections are unchanged (only the `meta.purpose` text names the new ACs).

## Tests

Expected values come from the spec (the DEC-20 labels, defaults and conversions, and the DEC-15 scale formula with its `#e4eef9` example), from `reference-values.json` (`REQ-009-rules`, `REQ-013-tools`, `REQ-009-config`) and from the committed fixtures and `dec20InvalidCases()` of `scripts/make-config-fixtures.mjs`. None comes from the code under test.

| Test (file, title abridged) | Covers |
|---|---|
| config.spec `@e2e @acceptance @REQ-009-AC1 @REQ-003-AC2 @REQ-006-AC6 save, reload, … incl. two rules (one `Freie Textsuche`), the search text, `Farbskala` `Grün` and the section` (1.0.0 test, extended) | Added: rules `Isolieren` · `Kategorie` · `Enthält` · `wall` and `Freie Textsuche` · `Enthält` · `erdg`, search `wand`, colouring `Farbskala` `Grün`. JSON: `filterRules` (text rule with key null), `search`, `colourMode` `scale`, `scaleColour` `#2e9b4f`, top-level and display field lists exactly the 1.1.0 ones. After reload + IFC + load: the whole configured state equal (now incl. rules, rule rows, search filter and field, colouring mode and colour, tool sets, marked), search field `wand`, panel `Farbskala` / `Grün` pressed, rule rows listed; second JSON = first |
| config-compat.spec `@e2e @acceptance @REQ-009-AC4 @robustness 1.0.0 configurations with an axis section Z at h …` | both fixtures (`flipped` false / true): no notice (OK message), `state().section` and app section = `{[0, 0, h], [0, 0, ∓1]}`, pill and handle shown, `Farbskala` with `#1f6fd1` (hook, every colour on the Blau scale, tint and full colour present, panel buttons pressed), saved `display` = `{mode, colourBy, scale, #1f6fd1, sectionPlane}` without `section`, header / filter sets / table as in the file |
| config-compat.spec `@e2e @acceptance @REQ-009-AC5 …` | Given two rules, search `erdg`, one hidden and one isolated wall (properties panel). Loading `config-1.0.0-axis-section.json` gives no rules, no rule rows, no `Filterregeln` / `Suche` entries, empty search field and filter, no marked elements, no hidden or isolated element (app sets, 3D `toolHidden`, entries, pills), all 99 rows, and the header, colouring, section and columns of the file |
| config-compat.spec `@e2e @acceptance @REQ-009-AC6 @robustness …` | `config-1.1.0-rules-skipped.json`: `skipped` = property `PSet_Revit_Other.AssetIdentifier` + invalid `Filterregel` only. Notice text exactly the head line, the missing property and `Ungültige Angaben: Filterregel.` The valid rules apply in order (hook, rows `Isolieren: Kategorie enthält „wall“`, `Ausblenden: Name endet mit „-1“`), with the filter keys of the reference (10). `Filterregeln: 2` |
| config-compat.spec `@e2e @acceptance @REQ-009-AC7 @REQ-013-AC12 @robustness …` | The state is `config-1.1.0-full.json` + two rules + search + hidden + isolated. The saved JSON has neither the two keys nor their GlobalIds, no field name with hidden / isolat / tool / keys / element, and exactly the 1.1.0 field lists, with rules, section and `Grün`. Reload + IFC + saved configuration: nothing hidden or isolated; rules, search and filter keys of the reference; the same JSON saved again. The **1.0.0 builder (tag `v1.0.0`)** loads the saved file and the committed `config-1.1.0-full.json`: `unknown` = `filterRules`, `search`, `display.colourMode`, `display.scaleColour`, `display.sectionPlane`, nothing else skipped, one notice naming them, no error message or page error; title, filter sets, columns and colouring property applied; 99 of 99 rows (no rule) |
| config-compat.spec `@e2e @acceptance @REQ-009-AC8 @robustness DEC-20 invalid case <name> …` (13 tests from one loop over `dec20InvalidCases()`) | Each case: `skipped.invalid` = exactly its DEC-20 label (none for the non-unit normal). Notice text exactly the head line + `Ungültige Angaben: <label>.` (non-unit normal: no notice, OK message). The field's DEC-20 effect: no rule / the two valid rules / search `""` / mode `scale` with `#2e9b4f` / colour `#d72622` / no section / plane normalised to `[0, 0, -1]` and saved so. The rest applied: title, colouring property, every colour on the chosen scale, and the reference filter keys when rules and search are intact |
| config-roundtrip.spec `@integration @robustness 1.1.0 configuration: rules, search text, Farbskala Gruen and the section plane apply; the whole file is saved unchanged` (TASK-012 test, changed) | `CalcConfig.state()` equals the file, and its JSON text equals the fixture byte for byte. Rules, search and filter GlobalIds equal `REQ-009-rules` `config-1.1.0-full`. Each coloured element has the DEC-15 step of its volume |
| viewer.spec `@acceptance @e2e @REQ-010-AC2 @REQ-011-AC1 … a rule `Enthält`, a search text, one hidden and one isolated element …` (1.0.0 test, extended) | After the 1.0.0 steps, in builder and viewer: single view, rule `Isolieren` · `Geschoss` · `Enthält` · `level`, search `basic wall` → CSV; the first table row hidden → CSV; the second isolated → CSV and XLSX. All four files are byte-equal between builder and viewer, and the states are equal. The rule/search CSV has the filter count (3 to 68 rows), the hidden one one row less, the isolated one exactly the isolated element's row |
| viewer.spec `@acceptance @e2e @REQ-010-AC4 …` (new) | Builder: section (`Schneiden`), `Farbskala` `Orange` by NetVolume, the `REQ-010-AC4` rules and search, one hidden and one isolated wall. Offline viewer: rules, rule rows, search (filter and field), colouring (hook, panel `Farbskala` / `Orange`), section and saved-config view equal the builder's. No hidden or isolated element (sets, `toolHidden`, entries, pills); the 9 reference walls shown, 4 marked; status `9 von 99 Elementen`. `Filter` opens the panel (`9 von 99 Objekten sichtbar`, 2 rule rows) and closes it. `Färben` opens and closes. `Fokus` after zooming out changes the camera and puts every opaque element inside the canvas. A click on a shown wall opens the menu (`Ausblenden`, `Isolieren`, `Schneiden`, `Menü schließen`) and the properties panel with its GlobalId; `Ausblenden` hides it (`Ausgeblendet: 1 Element`, `8 von 99`). No request |

Bite check: with the cv-app change reverted temporarily, REQ-009-AC1, AC5, AC6, AC7/REQ-013-AC12, the AC8 cases `rule-unknown-op` and `search-not-text`, REQ-010-AC4 and the integration 1.1.0 round trip failed. With the change restored, all pass.

### Changed expectations
Each follows the approved CR-002 delta. No assertion was weakened.
- `config-roundtrip.spec.mjs`, "1.1.0 configuration …" (TASK-012):
  - The assertion "`#2e9b4f` (the full colour) is among the colours" is **replaced**. It relied on the TASK-012 interim, where the file's rules were not applied and every element was coloured. Now the rules apply (REQ-009, DEC-20): only the 9 ground-floor walls are shown and coloured, and the largest volume of the model (a slab) is not among them.
  - The new assertion is stricter: every coloured element has exactly the DEC-15 step of its volume between the model's smallest and largest volume, and exactly 9 are coloured.
  - The title no longer says "in the 1.0.0 UI", and the whole file must now round-trip (was: `display` only).
- `config.spec.mjs` REQ-009-AC1 and `viewer.spec.mjs` REQ-010-AC2: the titles are extended and steps and assertions added. Both ACs were changed by CR-002 (orchestrator note 1); these tests now assert the 1.1.0 behaviour.
- `test/support/config.mjs` `configuredState` now also returns `view.colourMode` / `scaleColour`, `rules`, `search`, the search field value, the rule-row texts, the tool sets and the 3D `toolHidden` / `marked` sets. Every caller compares two states of the same page or of builder vs viewer, so the comparison only got stricter. The callers are config.spec (AC1, AC2, AC3, robustness) and viewer.spec (AC1, AC2, robustness), all green.

### Trace
- `INC2_PENDING`: REQ-009-AC4, AC5, AC6, AC7, AC8, REQ-010-AC4 and REQ-013-AC12 removed. Only REQ-005-AC11 and AC12 remain (TASK-019).
- REQ-009-AC1 and REQ-010-AC2 were never pending (changed ACs); their tests are updated above.
- `docs/testing/traceability.md` regenerated (`node scripts/trace.mjs`).

## Results (2026-11-05, CV_TEST_PORT=5100)
- `node scripts/check.mjs`: green (format, lint, cdn-cache, test_fast incl. trace, ASCII / `</script>` checks, c8 gate, 29 integration tests on `http`).
- `node scripts/ref/derive-reference.mjs --check`: up to date.
- Playwright `http` + `file`:
  - `config.spec`, `viewer-robustness.spec`, `config-roundtrip.spec`: 36 passed;
  - `viewer.spec` (incl. REQ-010-AC1, AC2, AC3, AC4): 16 passed.
- Playwright `file`: `config-compat.spec`, 17 passed.
- Playwright `http`: `config-compat.spec` 17 passed (in two runs: AC4–AC6, then AC7 + 13 AC8 cases).
- Regression on `http`, all green:
  - hide-isolate, rule-filter, filter-area, element-tools, panel-actions, smoke, system: 48 passed, 1 existing conditional skip (system.spec);
  - colouring, selection, properties-panel, export, table, grouping, view-tools: 50 passed;
  - element-tools-3d, view-3d, layout-followups, table-, filter-, grouping-, memory- and viewer-robustness, `test/acceptance`: 38 passed.
- Not run:
  - the perf suites (`test/perf`, incl. `viewer.spec` NFR-003) and `volume-robustness`. No hot path changed: a configuration load or viewer start without rules or search does exactly what it did before.
  - The regression chunks above on the `file` project (only the config and viewer specs ran there).

## Decisions (for the release gate / orchestrator)
1. **Every rule in the list is saved**, also `Markieren` rules and rules shown as `Eigenschaft nicht geladen` (their property's model was removed). The list is the user's rule set (REQ-012); loading such a file into a model set without that property skips the rule and names the property (DEC-20, REQ-009-AC6). The search text is saved as typed (TASK-012 decision 6).
2. **The display-text index is built synchronously when a configuration or the viewer file brings a `Freie Textsuche` rule or a search text.** That happens in the `refresh()` of the load, without the `Eigenschaften werden gelesen … %` progress the panel shows. On FZK it is not noticeable. On a large model it adds the index build (NFR-001 target ≤ 2 s at 30k rows) to the configuration load and to the viewer start (NFR-003). TASK-020 measures NFR-003 on a ≥ 100 MB 1.1.0 viewer file "exported with a search text and a `Freie Textsuche` rule", as the spec plans.
3. **The 1.0.0 builder for REQ-009-AC7 comes from git at test time:** `git show v1.0.0:calc-viewer-builder.html` into `test-cache/v1.0.0/` (git-ignored). It is opened in its own context with the same network guard (CDN from the hash-locked cache; the CDN versions did not change since 1.0.0). The test needs git and the tag `v1.0.0` in the checkout. It **fails** (does not skip) without them.
4. **REQ-009-AC8 is one Playwright test per case**, from one loop over `dec20InvalidCases()`: 13 tests, 12 invalid cases plus the non-unit normal. Each title carries `@REQ-009-AC8`; together they cover the AC.
5. **REQ-013-AC12 and the first half of REQ-009-AC7 share one test** (hidden and isolated → save → reload + IFC + load), and the same test continues with the second half of AC7, which loads that saved 1.1.0 file in the 1.0.0 builder. The committed `config-1.1.0-full.json` is loaded there too.
6. **REQ-010-AC2 picks its hidden and isolated element at run time**: the first two table rows under the rule and search, in the builder. The viewer uses the same keys, because its rows equal the builder's (asserted).

## Open points / contracts for later tasks
- **TASK-020:**
  - NFR-003 with an active text source. The synchronous index build at the viewer start is decision 2.
  - `INC2_PENDING` now holds only REQ-005-AC11 and AC12 (TASK-019).
- **TASK-019:** no change from this task. The search field `Suchen nach Objekten` is now also set by a configuration load (`ui.tools.setSearch`, no focus change).
- `scripts/make-config-fixtures.mjs` and the committed fixtures needed no change. `dec20InvalidCases()` is used as TASK-012 planned.
- **Not tested here:**
  - a configuration load while the panel is building the index for typed text (spec T7 "latest text wins"). The synchronous build and the shared async build (`buildTextIndex` returns at once when the index exists) keep the result consistent by construction, but no test forces the race;
  - a 1.1.0 viewer file opened in a 1.0.0 builder. This is not a REQ: viewer files carry their own runtime.

## Verification INC-2 (2026-11-05)
- **SYNC-1, documented:** decision 2 (index built synchronously in the `refresh()` of a configuration load or the viewer start, without the progress text) is recorded as a refinement of spec §4.3 / NFR-001 in `docs/process-log.md` (2026-11-05) with the TASK-020 measurements (filter pass incl. the rebuild 495-549 ms at 30,931 rows; viewer with a text source usable in 7.9 s). Release-gate item.
- **CODE-3:** see `docs/tasks/TASK-014.md` "Verification INC-2" (overflowing `sectionPlane` normal; DEC-20 case `sectionPlane-overflowing-normal` added, so `dec20InvalidCases()` now has 14 cases: 12 invalid, the non-unit and the overflowing normal).
- **CODE-2:** see `docs/tasks/TASK-015b.md` "Verification INC-2" (large rule lists in a configuration).
- **SYNC-4:** the integration test `config-roundtrip.spec.mjs` "configuration state -> JSON -> load …" and the unit test `applyConfig: … (REQ-009 round trip)` verify REQ-009-AC1 only in part (no rules, search, `Farbskala`, section); their titles now carry `@REQ-009` / `REQ-009`, the AC ID is in a comment (spec T5). Whole AC: `test/e2e/config.spec.mjs`.
