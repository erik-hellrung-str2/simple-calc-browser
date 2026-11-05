---
id: TASK-015b
title: "Rule dialog `Filter bearbeiten`, rule rows (edit, ×), panel `Zurücksetzen`, pill reset"
type: feature
status: implemented (awaiting orchestrator verification)
implements: [REQ-012-AC2, REQ-012-AC3, REQ-012-AC4, REQ-012-AC5, REQ-012-AC6, REQ-012-AC8, REQ-012-AC10, REQ-012-AC11]
relates_to: [CR-002, INC-2, REQ-004, REQ-012, DEC-19, DEC-21, TASK-011, TASK-015a, TASK-016, TASK-017a, TASK-018, TASK-019, TASK-020]
depends_on: [TASK-015a]
touches: [calc-viewer-builder.html (cv-core-src rule dialog helpers, cv-ui-src openRuleDialog and rule rows, cv-css own section "TASK-015b rule rows and dialog", cv-app-src rules), scripts/ref/derive-reference.mjs, test/fixtures/reference-values.json, test/e2e/rule-filter.spec.mjs (new), test/support/rules.mjs (new), test/unit/rule-dialog.test.mjs (new), test/unit/trace.test.mjs, docs/testing/traceability.md]
---
# TASK-015b: Rule dialog, rule rows, panel `Zurücksetzen`, pill reset

Spec §5 acceptance: REQ-012-AC2..AC6, AC8, AC10, AC11 green; the pill reset and the literal rendering of rule rows and suggestions are built here and tested without the AC ID in the title; REQ-012-AC12 / AC13 are completed and tagged in TASK-017a.

## What was built

### cv-core (pure, unit-tested)
- `ruleProperties(entries, query, limit = 50)` → `{ items, more }`: the `Eigenschaft` suggestions. A catalogue entry matches when its label or its group contains the query in any letter case (as ref L696). The order is the catalogue order. An empty query lists all entries.
- `findRuleProperty(entries, typed)`: the entry whose label equals the typed text (trimmed). The exact spelling wins; otherwise the match ignores letter case (as ref L728-732).
- `ruleValueTexts(source, key, limit = 200)`: the `Wert` suggestions. These are the distinct display texts (DEC-19, the texts the rule compares) of the property's values, in value order: numbers ascending, then texts in German collation. The empty value is left out.
- `RULE_PROPERTY_LIMIT` = 50, `RULE_VALUE_LIMIT` = 200.

### cv-ui
- **`openRuleDialog(host, options)`** (`ui.openRuleDialog`). The dialog `Filter bearbeiten` follows the reference (ref L654-740, CSS L1890-1924; screenshots ref-04, ref-05):
  - modal, 860 px wide, title, close ×, and the buttons `Abbrechen` and `Anwenden` (red primary);
  - one row of four fields on the grid `150px | 1fr | 140px | 1fr` (two columns below 700 px), left to right:
    - `Aktion`: a select with `Isolieren` (default), `Ausblenden`, `Markieren`, `Freie Textsuche`;
    - `Eigenschaft`: an ARIA combobox with the listbox `Eigenschaften`. Each option shows the label and, below it, the group in grey 11 px. At most 50 options, then `+<n> mehr`. The list is hidden when nothing matches (as the reference). The field is disabled for `Freie Textsuche`;
    - `Vergleich`: a select with `Gleich`, `Beginnt mit`, `Endet mit`, `Enthält` (default);
    - `Wert`: a text input with a datalist of `ruleValueTexts`.
  - **Picking a suggestion:** by pointer (`pointerdown`, as the reference), or with ArrowDown / ArrowUp and `Enter`. `Enter` on a highlighted suggestion only picks it. `Enter` anywhere else in an input applies the dialog.
  - **Validation of `Anwenden`:**
    - A missing or unknown property (except for `Freie Textsuche`) or an empty value (after trim) marks that field: `cv-invalid` (red border on `#fdf3f2`) and `aria-invalid=true`.
    - The dialog then stays open and the focus goes to the first invalid field.
    - Typing in a field clears its mark.
    - A typed label that equals a catalogue label is accepted.
  - **Closing without change:** `Abbrechen`, the close ×, `Esc` and a press on the backdrop.
    - `Esc` is handled by the dialog only (`preventDefault`), so it closes neither the filter panel nor the 3D selection.
    - The focus returns to the opener (`+ Filter hinzufügen` or the rule row's text).
  - All texts are set as text (`textContent`, option `value`).
- **Rule rows** (`ui.tools.setRules(items)`; ref L1394-1410, CSS L1815-1820):
  - one grey rounded row per rule: the button `.cv-rule-text` (title `Filter bearbeiten`) shows the action in red and bold (`<Aktion>: `), then the `describeRule` text;
  - a rule whose property is not loaded shows the grey note `Eigenschaft nicht geladen` (DEC-21);
  - the row's × is `Filter entfernen`;
  - when a removed row had the focus, the focus moves to the next row's ×, or to `+ Filter hinzufügen` when no row is left.
- `+ Filter hinzufügen` now passes itself to `handlers.addRule(opener)`.
- The CSS lives in its own section "TASK-015b rule rows and dialog", copied from the reference with `cv-` names.

### cv-app
- **Rule list** `rules` (`[{ mode, key, op, value }]`, in list order):
  - `coreFilters()` adds `{ id: 'rule:<i>', type: 'rule', ... }`, so rules AND with every other source (REQ-004, spec 4.3). `Markieren` rules normalise to no filter (TASK-011 core).
  - A rule whose property is not in the catalogue is left out of the evaluation (DEC-21).
  - `keysInUse()` keeps the columns of the rules' properties.
- **`setRules(next)`:** builds the display-text index first (with progress) when a `Freie Textsuche` rule exists, then calls `refresh`.
- **`refresh`:**
  - renders the rule rows;
  - sets the `Filter` dot and the panel `Zurücksetzen` while a search text or any rule exists;
  - shows the pill while any filter source is active or any rule exists (`Markieren` included);
  - `hook.filter.rules` holds a copy of the list.
- **Tool handlers:**
  - `addRule(opener)`: the dialog for a new rule (`Isolieren`, `Enthält`), added at the end;
  - `editRule(index, opener)`: the dialog with the rule's values. `Anwenden` replaces the rule in place, unless the list was changed meanwhile (for example by a reset);
  - `removeRule(index)`;
  - `resetPanel()` (panel `Zurücksetzen`): clears the rules and the search text only (REQ-012-AC10, DEC-21).
- **`filterHandlers.resetAll`** (`Alle Filter zurücksetzen` and the pill `Filter entfernen`) also clears the rules. Hidden / isolated elements follow in TASK-017a.

## Tests

Expected values: the new section `REQ-012-rules` of `test/fixtures/reference-values.json`.
- It is written by `scripts/ref/derive-reference.mjs` (`ruleSection`) from the STEP text.
- The DEC-19 matching is re-implemented there, independently of the product:
  - `toLocaleString("de-DE")` with at most 3 decimals;
  - IFC booleans `Ja` / `Nein`;
  - lower-case comparison;
  - multi-valued `Material` compared value by value;
  - an absent property never matches.
- Rows: STEP elements except `IfcOpeningElement` and `IfcSpace`. That gives 99 rows, the same total as `view-tools.spec.mjs` computes.
- `derive-reference.mjs --check` is green. The other sections are unchanged.

New `test/e2e/rule-filter.spec.mjs` (helpers in `test/support/rules.mjs`). All tests pass on `file` and `http`.

| Test title (abridged) | Covers |
|---|---|
| `@e2e @acceptance @REQ-012-AC2 \`+ Filter hinzufügen\` opens \`Filter bearbeiten\` …` | exact option lists and defaults; placeholders and buttons; one row in the order Aktion / Eigenschaft / Vergleich / Wert; 860 px; red `Anwenden`; `Length` → `BaseQuantities.Length` with group `BaseQuantities` (grey, below); every suggestion contains the text; `Kategorie` → datalist = the model's Kategorie values (`kategorien`); `Esc` closes, focus back on `+ Filter hinzufügen`, panel still open, no rule |
| `@e2e \`Eigenschaft\` lists at most 50 suggestions then \`+<n> mehr\`; arrow keys and Enter …; the backdrop closes the dialog` | 50 options + `+<n> mehr` with n = catalogue size − 50; ArrowDown / Enter pick `Kategorie` without applying; no match → no list; backdrop press closes without a rule |
| `@e2e @acceptance @REQ-012-AC3 …` | filter keys, table GlobalIds, `state().opaque` = the 13 walls; status `13 von 99 Elementen`, panel status `13 von 99 Objekten sichtbar`; row `Isolieren: Kategorie enthält „wall“` with the action in red; `Zurücksetzen`, dot and pill shown |
| `@e2e @acceptance @REQ-012-AC4 …` | `Ausblenden` · `Material` · `Enthält` · `holz` = all rows minus the 13 `Holz` elements, the 21 elements without Material stay; after editing the action to `Isolieren`, exactly the 13 remain (`opaque` too) and none without Material |
| `@e2e @acceptance @REQ-012-AC5 rules compare the display text …` | `BaseQuantities.Width`: `Gleich` `0,3` (8), `0.3` (0), `Beginnt mit` `0,`, `Endet mit` `,3`; `Ausblenden` `Beginnt mit` `0,` keeps the 65 elements without width; `Pset_BeamCommon.LoadBearing` `Gleich` `ja` = the 45 `Ja` beams |
| `@e2e @acceptance @REQ-012-AC5 a multi-valued property matches …` | Duplex: `Material` `Gleich` `plasterboard` = the 63 reference elements, incl. #4131 with two materials |
| `@e2e @acceptance @REQ-012-AC6 …` | `Eigenschaft` disabled; `Gleich` <GlobalId of #21966> keeps exactly that wall; row text; reopened: still disabled and empty |
| `@e2e @acceptance @REQ-012-AC8 …` | `Geschoss` = `Erdgeschoss`, column filter `Name` on `Wand-Ext-ERDG-1` / `-2`, `Isolieren` `Kategorie` `Enthält` `wall`, `Ausblenden` `Name` `Endet mit` `ERDG-2` → only `Wand-Ext-ERDG-1` (keys, table, status) |
| `@e2e @acceptance @REQ-012-AC10 …` | dialog prefilled from the first rule; `Anwenden` replaces it in place (second rule unchanged); × removes it; panel `Zurücksetzen` clears rules and search text, filter-set value and column filter stay (`filter.active`) |
| `@e2e @acceptance @REQ-012-AC11 …` | empty `Eigenschaft`, `Gibtsnicht`, empty `Wert` each marked (class, `aria-invalid`, border `#d72622` on `#fdf3f2`), dialog open, no evaluation; `Name` typed exactly is applied; `Abbrechen`, `Esc` (new rule and edit) change nothing; focus back on the row text |
| `@e2e pill \`Filter entfernen\` with rules: …` | a `Markieren` rule alone shows the pill and `Zurücksetzen` and removes nothing; the pill reset clears rules, search, filter-set value and column filter; `Alle Filter zurücksetzen` clears rules (REQ-012-AC12 / REQ-004-AC4 are tagged in TASK-017a) |
| `@e2e @robustness rule values and \`Wert\` suggestions with HTML are rendered as text …` | XSS fixture: rule value `<img …>` shown literally in the row; HTML wall names are datalist values; the HTML pset name in the suggestions creates no `<b>`; no `img` / `script` added, `window.__xss` unset (part of REQ-012-AC13, tagged in TASK-017a) |

New `test/unit/rule-dialog.test.mjs` (`[unit]`, 5 tests): `ruleProperties` (label / group match, case, order, 50 + `more`), `findRuleProperty` (exact spelling first, any case, unknown, blank), `ruleValueTexts` (distinct display texts, value order, `0,3` once for 0.3 / 0.30001, multi-values, booleans, empty left out, 200 limit). These tests cite REQ-012-AC2 / AC11 in comments only (T5).

### Changed expectations
None. No existing test was changed.

### Trace
- `INC2_PENDING`: removed REQ-012-AC2, AC3, AC4, AC5, AC6, AC8, AC10 and AC11. REQ-012-AC9, AC12, AC13 and AC14 stay listed.
- `docs/testing/traceability.md` regenerated.

## Results (2026-11-05, CV_TEST_PORT=4820)
- `node scripts/check.mjs`: green (format, lint, cdn-cache, test_fast incl. the new unit tests and 29 integration tests).
- Playwright, both projects (`file` and `http`), all green:
  - `test/e2e`: rule-filter (new, 12 × 2), view-tools, view-3d, filter-area, config, layout-followups, table, selection, properties-panel, element-tools-3d, smoke, viewer, grouping, export, system, filter-/grouping-/table-/viewer-/memory-robustness;
  - `test/acceptance`;
  - `test/integration` on `file` (on `http` via `check`).
  - `system.spec` `http` is the existing conditional skip.
- Not run: `volume-robustness`, and every perf suite (`test/perf`). NFR-001 for rules is TASK-020's acceptance. No perf-measured path changed except the rule filter source, which no perf test uses yet.

## Decisions (for the release gate / orchestrator)
1. **Order of the `Eigenschaft` suggestions = catalogue order:** `Allgemein` first in its fixed order (Kategorie, Name, …), then by group and label. The spec says "sorted by group then label". The reference lists attributes (empty group) first too. The catalogue dialog of the filter sets uses the same order.
2. **Suggestion match on label or group**, case-insensitive (as ref L696).
3. **A typed label is accepted when it equals a label exactly; otherwise ignoring letter case** (as ref L728-732; REQ-012-AC11 "typed exactly").
4. **`Wert` suggestions are in value order:** numbers ascending, then texts in German collation; each display text once. The reference lists values unsorted, in index order.
5. **Keyboard in `Eigenschaft`:** ARIA combobox with ArrowUp / ArrowDown / `Enter` to pick. `Enter` in any other field (or in `Eigenschaft` with nothing highlighted) applies. The reference never applies from `Eigenschaft`; here a typed exact label plus `Enter` applies. `Esc` always closes the whole dialog, also while the list is open (REQ-012-AC11). Full keyboard pass: TASK-019.
6. **The backdrop closes the dialog on `pointerdown`** (as ref L593). This avoids a close by the click that follows picking a suggestion.
7. **No list when no property matches** (as the reference). There is no "no result" text.
8. **Rules on properties that are not loaded:**
   - What is built here: the grey note `Eigenschaft nicht geladen`, and the rule is left out of the evaluation (DEC-21). The note is needed so that such a rule never empties the view.
   - What TASK-017a does (REQ-012-AC14): the tests and the model-removal flow.
9. **`Markieren` rules:**
   - What is built here: they are listed, they count for the `Filter` dot, the panel `Zurücksetzen` and the pill, and they remove nothing.
   - What is not built yet: the 3D paint `#f08a87` and `state().marked` (TASK-016, REQ-012-AC9).
10. **An edit whose rule list changed meanwhile** (for example by a reset while the dialog was open) does not re-add the rule.
11. **Focus:** after × the focus moves to the next row's × (or `+ Filter hinzufügen`); the dialog returns the focus to its opener.

## Open points / contracts for later tasks
- **TASK-016:**
  - paint `Markieren` rules: `markRows(store, rules, view.evaluation.pass)` into the display plan (`marked`) with the precedence of §4.4;
  - REQ-012-AC9.
- **TASK-017a:**
  - REQ-012-AC12 / AC13 / AC14 tags;
  - the `Filterregeln: n` / `Suche` entries of the filter area;
  - hidden / isolated elements in `resetAll`;
  - the model-removal test for `Eigenschaft nicht geladen`. The note and the skip already exist: `ruleMissing` in cv-app.
- **TASK-018:**
  - save / load `filterRules` (`rules` in cv-app; `setRules` applies them, with the index for `text` rules);
  - viewer tests with rules.
- **TASK-019:**
  - the dialog at 1024 / 1100 px;
  - the Tab order in the dialog and the rule rows;
  - the panel overlay layout.
- **TASK-020:** NFR-001 for `Anwenden` / × incl. `Isolieren` · `Name` · `Enthält` and `Freie Textsuche` at the volume set. The `Wert` suggestions build the column of the chosen property on demand: one column build per property.
