---
id: TASK-015a
title: "Toolbar `Fokus` / `Filter` / `Färben`, hint, title chip, filter panel with search and status, pill `Filter entfernen` with ghost toggle, pill stack"
type: feature
status: implemented (awaiting orchestrator verification)
implements: [REQ-012-AC1, REQ-012-AC7, REQ-005-AC1, REQ-005-AC10]
relates_to: [CR-002, INC-2, REQ-004, REQ-005, REQ-012, DEC-15, DEC-19, DEC-21, TASK-011, TASK-013, TASK-014, TASK-015b, TASK-016, TASK-017a, TASK-017c, TASK-018, TASK-019, TASK-020]
depends_on: [TASK-011, TASK-014]
touches: [calc-viewer-builder.html (cv-ui-src, cv-css own section "TASK-015a in-viewer tools", cv-app-src), test/e2e/view-tools.spec.mjs (new), test/e2e/view-3d.spec.mjs, test/e2e/layout-followups.spec.mjs, test/e2e/config.spec.mjs, test/e2e/viewer.spec.mjs, test/e2e/filter-area.spec.mjs, test/e2e/smoke.spec.mjs, test/perf/view-3d.spec.mjs, test/perf/view-3d-volume.spec.mjs, test/support/view-3d.mjs, test/unit/trace.test.mjs, docs/testing/traceability.md]
---
# TASK-015a: In-viewer toolbar, filter panel with search, pill `Filter entfernen`

Spec §5 acceptance: REQ-012-AC1, AC7, REQ-005-AC1, AC10 green; `layout-followups.spec.mjs` updated (`Fokus` instead of `Ansicht einpassen`); the 1.0.0 `Färben nach` control and legend still work.

## What was built

### cv-ui `createViewTools(canvasBox, toolHandlers)` (ref L865-876, L1306-1376, L1394-1430)
Returned by `renderLayout` as `ui.tools`. All parts are absolutely placed inside `#cv-canvas-box`.
- **Title chip** `#cv-title-chip` (top left, 16 px):
  - shows the header title (REQ-011, defaults applied, so the first model's `Modell` while no title is set);
  - adds `<n> Modelle` with more than one model;
  - is hidden while the title is empty.
- **Hint** `#cv-hint`, centred above the toolbar, with the REQ-005 text.
  - It starts once, when the first load action ends (builder) or when the viewer file has finished starting.
  - It fades 6 s later, or at the first pointer press on the canvas, whichever is first.
  - "Hidden" = opacity 0, then `visibility: hidden` after the 0.6 s fade. The reference sets opacity only; this way it also leaves the accessibility tree.
- **Toolbar** `#cv-toolbar`:
  - `role=toolbar`, label `3D-Werkzeuge`, round glass, bottom centre, 20 px from the bottom;
  - three 40 px buttons `Fokus` / `Filter` / `Färben`, each with `title` and `aria-label`;
  - `Filter` and `Färben` carry `aria-pressed`, a red fill while their panel is open, and the red dot `.cv-has-dot`;
  - hidden while no model is loaded.
- **Filter panel** `#cv-filter-panel` (`region` `Filter`), centred above the toolbar (bottom 80 px), width `min(380px, 100% − 32px)`. Contents, top to bottom:
  - kicker `Filter` and the red link `Zurücksetzen` (shown only while the search is active);
  - search field `Suchen nach Objekten` (`type=search`, 250 ms debounce);
  - rule list `#cv-rules` (empty until TASK-015b);
  - red link `+ Filter hinzufügen` (`#cv-rule-add`; inert until TASK-015b supplies `addRule`);
  - status `<X> von <Y> Objekten sichtbar`.
- **Colouring panel** `#cv-colour-panel` (`region` `Färben`): kicker `Färben`, empty body (TASK-016 fills it).
  - `Filter` and `Färben` exclude each other.
- **Pill stack** `#cv-pills` (bottom right, 16 / 20 px) with the pill `#cv-pill-filter`. Left to right:
  - ghost toggle `#cv-ghost-toggle` (`Ausgeblendete verbergen` while ghosts are shown, `aria-pressed=true`; `Ausgeblendete anzeigen` otherwise);
  - `Filter entfernen` (title `Alle Filter entfernen`);
  - chevron `Filter anzeigen`.
- The stack height is written to `--cv-pills-h` on `#cv-canvas-box`, so the properties panel (TASK-013) ends above it.
- The CSS is copied from the reference with `cv-` names. It lives in its own commented section "TASK-015a in-viewer tools".
- New icons: `focus` (ref `fit`), `ghost`, `chevronDown`.

### Interim 1.0.0 view bar (cv-ui `createViewControls`)
- Removed: `Elemente außerhalb des Filters: Geist | Ausblenden` (now the ghost toggle) and `Ansicht einpassen` (now `Fokus`), with their CSS (`#cv-mode-label`, `.cv-fit`).
- `Färben nach` with the legend under the model, and the X/Y/Z `Schnitt`, stay until TASK-016 / TASK-017c, as §5 requires.

### cv-app
- **Search as a filter source:** `coreFilters()` adds `{ id: 'search', type: 'search', text }` while the text is not blank (TASK-011 core, DEC-19). The search therefore combines with AND with the filter sets and column filters. It drives the table, 3D, status line and facet counts, and shows the pill.
- **Display-text index:**
  - It is built in chunks with the status `Eigenschaften werden gelesen ... N %` (as ref L1379-1384) when the filter panel first opens, or at the first search.
  - Texts typed during the build wait for the same build. `refresh` reads the current text, so the latest text wins.
- **`refresh`** also sets the panel status (the same X / Y as the status line), the `Filter` dot, the panel `Zurücksetzen`, and the pill visibility (any active filter source). `hook.filter.search` holds the text.
- **Tool handlers:**
  - `Fokus` → `engine.focus()` (TASK-014);
  - ghost toggle → display mode (was `viewHandlers.mode`);
  - panel `Zurücksetzen` → clears the search only;
  - pill `Filter entfernen` → `filterHandlers.resetAll`.
- **`resetAll` (`Alle Filter zurücksetzen`)** now also clears the search text. Rules and hidden / isolated elements follow in TASK-015b / TASK-017a.
- **`Esc`:** with a selection it clears the selection (as before). With nothing selected it closes an open toolbar panel and returns the focus to its button (REQ-005 `Esc` order; completed in TASK-017c / TASK-019).
- The configuration's `display.mode` sets the ghost toggle.

## Tests

Expected values:
- Element totals come from `reference-values.json` (`elementsInStepTextByKategorie` without `IfcOpeningElement`, as `filter-area.spec.mjs`).
- The REQ-012-AC7 key set is derived in the test from the IFC STEP text: the IfcProduct lines containing `ext-erdg` in any case are the four walls `Wand-Ext-ERDG-1..4`. The test also asserts that the other 12 lines with the text are Pset values `Name` / `Komplette Element-ID` / `Kompakte Element-ID` of the same walls, and cross-checks the set with a scan of the extracted values that does not use the product's index.
- Positions and sizes come from the spec / reference CSS.

New `test/e2e/view-tools.spec.mjs`. All tests pass on `http` and `file`.

| Test title | Covers |
|---|---|
| `@e2e @acceptance @REQ-012-AC1 \`Filter\` opens the filter panel with kicker, search, \`+ Filter hinzufügen\` and status; a second click closes it` | REQ-012-AC1: kicker (red, upper case), placeholder, `+` icon and text, `<Y> von <Y> Objekten sichtbar` = status line, no `Zurücksetzen`, order top to bottom, no `Kategorie` / `Datei` chips, close |
| `@e2e @acceptance @REQ-012-AC7 the search filters 250 ms after the last keystroke to the elements with a value containing the text in any letter case; clearing returns all` | REQ-012-AC7: unchanged 200 ms after the last keystroke; filter, table and 3D applied within 750 ms (measured about 255-261 ms); exactly the 4 walls in filter keys, table, status line, panel status and `state().opaque`; upper case gives the same set; cleared → all |
| `@e2e @acceptance @REQ-005-AC10 hint pill for 6 s after loading (or until the first press on the canvas); title chip \`Haus\`, with a second model \`2 Modelle\`` | REQ-005-AC10: hint text, above the toolbar and centred, visible 5 s after the load and gone 6.8 s after it, shown once; chip `Haus` at 16/16 px without `Modelle`, then `2 Modelle`; a pointer press hides the hint; the default title in the chip |
| `@e2e toolbar \`Fokus\` / \`Filter\` / \`Färben\` as the reference: …` | toolbar hidden without a model; exactly three 40 px buttons with title / aria-label; position and glass; filter panel 380 px wide, 80 px from the bottom; `Filter` / `Färben` exclusive with `aria-pressed` and red fill; `Filter` dot and `Zurücksetzen` exactly while a search is active; panel `Zurücksetzen` clears the search only (filter set stays); `Esc` closes the panel and focuses `Filter` |
| `@e2e pill \`Filter entfernen\`: …` | hidden without a filter source; shown for a filter-set value, first in the stack, 16 / 20 px from the edges, `--cv-pills-h` = stack height; `Filter anzeigen` opens the panel; main button clears filter set and search, keeps the ghost toggle; `--cv-pills-h` back to 0; a search alone shows the pill |
| `@e2e @robustness search text with HTML is text only: …` | `<img onerror>` / `<script>` searches: 0 hits, nothing added to the DOM, nothing run; `Ö` / `ö` find the same rows (T7, part of REQ-012-AC13 for the search; the AC is completed in TASK-017a) |

The REQ-005-AC1 test is rewritten in `test/e2e/view-3d.spec.mjs`, see below.

### Changed expectations (approved CR-002 delta; no assertion loosened)
- **`test/e2e/view-3d.spec.mjs`:**
  - `@REQ-005-AC1` (AC changed by CR-002) is renamed to `… the ghost toggle in the pill \`Filter entfernen\` hides them`. The radios `Geist` / `Ausblenden` become the ghost toggle, and the test now also asserts:
    - no pill without a filter;
    - label, `title`, `aria-pressed` before and after the click;
    - button order ghost toggle, `Filter entfernen`, `Filter anzeigen`.
  - The `state()` and engine assertions are unchanged.
  - `#cv-fit` → toolbar `Fokus` (REQ-007-AC1 test). The render smoke and REQ-001-AC4 use the toggle.
  - In REQ-001-AC4, the wall filter is now checked before hide mode is chosen, because the toggle exists only while a filter source is active. Same assertions.
- **`test/e2e/layout-followups.spec.mjs`:**
  - L1 `Ansicht einpassen` → `Fokus`, with the same fit assertions (no filter: every element opaque).
  - L3 uses the toggle.
  - L4 no longer asserts `#cv-mode-label` and `#cv-fit` (moved by CR-002). It now asserts that the bar has no `Ansicht einpassen` and that `Fokus` is in the 3D toolbar. The one-row and colour-name assertions are unchanged.
- **`test/e2e/config.spec.mjs` (REQ-009-AC1 round trip):** hide mode is set and read back through the ghost toggle (`aria-pressed=false`, `Ausgeblendete anzeigen`) instead of the radio `Ausblenden`.
- **`test/e2e/viewer.spec.mjs`:**
  - REQ-010-AC2 / AC1 flows use the toggle.
  - REQ-010-AC3 asserts the toolbar buttons `Fokus` / `Filter` / `Färben` instead of the radio `Ausblenden`.
- **`test/e2e/filter-area.spec.mjs`:** the header drawer button `Filter` is located inside `.cv-header`. The toolbar now has a `Filter` button too (DEC-21: "the header drawer button stays `Filter`"), so the page-wide locator was ambiguous. Same assertions.
- **`test/perf/view-3d.spec.mjs`, `view-3d-volume.spec.mjs`:** the mode is switched through the toggle with the measured value checked, then unchecked again, so the measured clicks start from the same state as before.
- **`test/support/view-3d.mjs`:** new helper `setGhosts(page, on)`. `CANVAS_ONLY` (also in `smoke.spec.mjs` and `viewer.spec.mjs`) also hides the new overlays: title chip, hint, toolbar, panels, pills. Canvas screenshots therefore compare model pixels only; the hint fades during some tests.

### Trace
- `INC2_PENDING`: removed REQ-005-AC10, REQ-012-AC1 and REQ-012-AC7. REQ-005-AC1 was not listed: its 1.0.0 test was updated in place.
- `docs/testing/traceability.md` regenerated.

## Results (2026-11-05, CV_TEST_PORT=4810)
- `node scripts/check.mjs`: green (format, lint, cdn-cache, test_fast incl. 175 unit tests and 29 integration tests).
- Playwright, both projects (`file` and `http`), all green:
  - `test/e2e`: view-tools (new, 6), view-3d, layout-followups, config, smoke, viewer, selection, properties-panel, element-tools-3d, filter-area, grouping, table, export, filter-/grouping-/table-/viewer-/memory-robustness, system;
  - `test/acceptance`; `test/integration`.
  - `system.spec` `http` is the existing conditional skip.
- `file` only: perf `view-3d` (NFR-001 3D, volume set) and `view-3d-volume` green.
- Not run: `volume-robustness`; perf `nfr-001`, `text-index`, `export`, `load-100mb`, `nfr-002`, `viewer`, `grouping`, `table`, `selection`; `node --test test/perf`. None of their code paths changed except the search filter source, which none of them uses.

## Decisions (for the release gate / orchestrator)
1. **Toolbar hidden while no model is loaded.** REQ-005-AC7 says "Given a loaded model". Without a model, `Fokus` and `Filter` have nothing to act on, and the builder's start overlay covers the view.
2. **The hint starts when the first load action ends** (builder), or when the viewer file has finished starting (after its first frame wait), not at page load. It is shown once per page, as the reference.
3. **The hint ends invisible.** It fades as the reference (opacity), then is also `visibility: hidden`, so screen readers and tests see it as gone.
4. **`Alle Filter zurücksetzen` (and the pill) also clears the search text.** Spec REQ-004 makes the search a filter source and lists it in the reset scope. The rules and hidden / isolated elements follow in TASK-015b / TASK-017a.
5. **The display-text index is built when the filter panel first opens** (as ref L1435-1449), so the first search does not wait for it. While it builds, the panel status shows `Eigenschaften werden gelesen ... N %`. The controls stay enabled (the reference disables them); a search typed meanwhile waits for the same build.
6. **`Esc` with nothing selected closes the open toolbar panel** and focuses its button. This is the panel step of the REQ-005 / REQ-007 `Esc` order. The menu step is TASK-017c, the full keyboard pass TASK-019.
7. **`+ Filter hinzufügen` is visible but inert** until TASK-015b supplies the dialog (`toolHandlers.addRule`). REQ-012-AC1 requires the link; AC2 is TASK-015b's.

## Open points / contracts for later tasks
- **TASK-015b:**
  - pass `addRule` in `toolHandlers`;
  - render rule rows into `ui.tools.rules`;
  - extend `setFilterState({ textActive })` with "any rule", and `pill` with "any rule (`Markieren` included)";
  - extend `resetPanel` and `filterHandlers.resetAll` with the rules;
  - add `type: 'rule'` filters to `coreFilters()`.
- **TASK-016:**
  - fill `ui.tools.colourPanel.body` and its `reset` link (`Entfernen`);
  - set the `Färben` dot via `.cv-has-dot` on `#cv-tool-colour` (needs a `setColourState` method or direct class toggle);
  - add the pill `Einfärbung entfernen` to `ui.tools.pills` after `#cv-pill-filter` and call `ui.tools.layoutPills()`;
  - remove the 1.0.0 view bar and the interim `--cv-props-top` offset (with TASK-017c's `Schnitt`).
- **TASK-017a / TASK-017c:**
  - the pills `Isolierung entfernen`, `Ausblendung entfernen` and `Schnitt entfernen` go into `#cv-pills` in the spec order; call `layoutPills()` when their visibility changes.
- **TASK-018:**
  - save / load `search` (`configState`, `apply.search` → `searchText` + `ui.tools.setSearch`). Until then a configuration's search text is ignored and not saved.
  - viewer parity: the toolbar and pill exist in the viewer file (checked in REQ-010-AC3), but no viewer test types a search yet.
- **TASK-019:**
  - overlay layout (panel left of the properties panel, icon-only pills; REQ-005-AC12) is not done here. Today the filter panel stays centred and can overlap an open properties panel at 1280 × 800.
  - In Chromium, `Esc` in the search field also clears the field (a native `type=search` behaviour) before the panel closes.
- **TASK-020:**
  - while a search is active, a model load or IfcSpace switch rebuilds the index synchronously inside `refresh` (the new column store has none). Measure at 30k rows (NFR-001).
  - The REQ-012-AC7 timing at the volume set is not measured here (FZK: about 255 ms from the last keystroke).
