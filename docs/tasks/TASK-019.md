---
id: TASK-019
title: "Keyboard, focus and narrow-width pass (overlay layout at 1024 / 1100 / 1280 px, Tab order, focus return, `Esc`), BUG-T1/T3 regressions, T11 review notes"
type: feature
status: implemented (awaiting orchestrator verification)
implements: [REQ-005-AC11, REQ-005-AC12, REQ-007-AC5, REQ-012-AC11]
relates_to: [CR-002, INC-2, REQ-005, REQ-007, REQ-012, REQ-013, DEC-21, BUG-T1, BUG-T3, TASK-013, TASK-014, TASK-015a, TASK-015b, TASK-016, TASK-017a, TASK-017b, TASK-017c, TASK-018, TASK-020]
depends_on: [TASK-016, TASK-017c]
touches: [calc-viewer-builder.html (cv-css own section "TASK-019 overlay layout"; cv-ui-src createViewTools layoutOverlays / showPills / openPanel focus and opener / closePanel / search-field `Esc` / colouring-list focus, renderLayout properties-panel focus return, openRuleDialog Tab wrap and suggestion list out of the Tab order; cv-app-src `Esc` handler uses closePanel), test/e2e/keyboard.spec.mjs (new), test/e2e/overlay-layout.spec.mjs (new), test/unit/trace.test.mjs, docs/testing/traceability.md]
---
# TASK-019: Keyboard, focus and narrow-width pass

Spec §5 acceptance: REQ-005-AC11, AC12 green, plus keyboard e2e (Tab reaches toolbar, panels, rule rows, pills, row tools, handle; focus returns; `Esc` order) and the REQ-005-AC12 overlay check repeated at 1024 and 1100 px; BUG-T1/T3 tests green; T11 findings recorded in the task record.

## What was built

### cv-ui: overlay layout (REQ-005 "Overlay layout", REQ-005-AC12, spec 2 Devices)
`createViewTools` has a new `layoutOverlays()`, which replaces `layoutPills` (that name stays as an alias). It places the overlays so that no two of these overlap: properties panel, filter / colouring panel, pill stack, toolbar and title chip.
- **Properties panel at the reference place** (top right, ending above the pill stack). This is the CSS of TASK-013, unchanged.
- **Compact layout.** When that place would leave the panel body less than 120 px (available height minus the measured panel head), two things change:
  - the pills show their icon only. The class `cv-pills-compact` hides `.cv-pill-label`. The main buttons now carry the label as `aria-label` at all times and keep their `title`;
  - the properties panel moves left of the pill stack (8 px gap). Since it then lies above the toolbar, it ends 8 px above the toolbar's top edge. If it does not lie above the toolbar (very wide views), it ends 20 px above the bottom.
- **An open filter or colouring panel while the properties panel is open:** placed left of the properties panel, centred in the remaining width, at least 16 px from the left. The panel's width shrinks below 380 px only when the width does not fit.
- **Panel top below the title chip.** Every open panel's top stays below the title chip where the two would meet horizontally. Otherwise the top limit is 32 px, as the CSS `max-height: calc(100% - 112px)`.
- **When the layout runs:** on a pill change, on properties-panel show / clear, when a panel opens or closes, on a title change, and on every resize of the 3D view. The resize case uses a `ResizeObserver` on `#cv-canvas-box`, which covers the window, the splitter and the 1280 px breakpoint. Only children are restyled, so no resize loop can occur.
- **Measured** (CV_TEST_PORT=5110 run, 3D view 391 px high):

| Window | Properties panel | Body | Open panel | Pill stack |
|---|---|---|---|---|
| 1280 × 800 | x 488–848, y 16–309 | 192 px | filter x 50–430 | x 856–984 (128 px) |
| 1100 × 800 | x 588–948 | | filter x 100–480 | x 956–1084 |
| 1024 × 800 | x 512–872 | | filter / colouring x 62–442 | x 880–1008 |

  These match the spec example (x ≈ 488–848, y 16 to ≤ ~308, stack ~128 px).

### cv-ui / cv-app: keyboard and focus (spec 2 Keyboard, REQ-007 `Esc` order)
- **Tab order = DOM order** in the 3D view: toolbar, then the filter panel and the colouring panel (only the open one is reachable), then the pills, the properties panel, and the section handle (cv-3d).
  - Before this task the toolbar came after the panels and pills. Now Tab from `Filter` goes straight into the panel it opened.
- **Opening a panel moves the focus into it.** This applies to every way of opening:
  - toolbar button;
  - pill chevrons `Filter anzeigen` / `Färben anzeigen`;
  - filter-area entry `Filterregeln` / `Suche`;
  - `Farbe nach Wert`.

  The focus goes to `Suchen nach Objekten` in the filter panel. In the colouring panel it goes to `Parameter suchen` (list step) or to the chosen property `Ändern` (legend step).
- **The opener is remembered:** the focused control, or else the panel's toolbar button.
  - `closePanel()` (used by the `Esc` handler in cv-app) returns the focus there.
  - If the opener is gone or hidden, the focus goes to the toolbar button. An example is a filter-area entry in the closed drawer below 1280 px.
- **A colouring property picked from the list with `Enter`:** the list gives way to the legend, so the focus moves to `Ändern`. Before, it was lost to the page.
- **The properties panel does not take the focus when it opens.** A table row selected with the keyboard keeps the arrow-key navigation.
  - When the panel closes while the focus is inside it (`Esc`, `Schließen`, `Ausblenden` / `Isolieren` that remove the element), the focus returns to the control that was focused when it opened.
  - That is the table after a row selection. With none (a 3D click), the focus goes to the table `#cv-tbl-scroll`.
- **A pill that disappears while it has the focus** (`showPills`), e.g. `Schnitt entfernen` pressed by keyboard: the focus moves to the next shown pill, else the previous one, else the toolbar's `Filter`.
- **`Esc` in `Suchen nach Objekten` or `Parameter suchen` with text clears only the text.**
  - This follows the REQ-007 order: "a filter search field's text" comes first.
  - Before, Chromium's native clear of a `type=search` field let the same key also clear the selection or close the panel (TASK-015a open point).
  - The search is re-evaluated at once, without the 250 ms debounce.
- **Dialog `Filter bearbeiten`:**
  - Tab and Shift+Tab wrap inside the dialog (`aria-modal`);
  - the `Eigenschaft` suggestion list is no longer a Tab stop (`tabIndex = -1`). Chromium makes a scrolling box without focusable children focusable, so Tab from `Eigenschaft` went into the list instead of `Vergleich`. This was found by the keyboard AC11 test, which failed before the fix.

## Tests

Expected values: the spec's geometry rules (16 px edges, 8 px gaps, body ≥ 120 px, no overlaps, panel inside the 3D view, centred in the remaining width) and `test/fixtures/reference-values.json` (`REQ-013-tools` walls and the ERDG-1 / ERDG-2 tool walls). None come from the code under test.

| Test (file, title abridged) | Covers |
|---|---|
| keyboard.spec `@e2e @acceptance @REQ-005-AC11 …` | rule `Isolieren` · `Kategorie` · `Enthält` · `wall`, wall ERDG-2 selected by a table row (menu closed). A full Tab cycle from the table reaches `Fokus` / `Filter` / `Färben`, the pill `Filter entfernen` (ghost toggle, main, chevron), `Schließen` / `Ausblenden` / `Isolieren`, a group head and both row tools of the `Name` row, in the order toolbar → pills → properties panel. Tab changes nothing. `Enter` on `Filter` puts the focus in the search field. Tab reaches the rule row text, its × and `+ Filter hinzufügen`. `Esc` clears the selection, the panel stays. `Esc` closes it and `Filter` has the focus |
| overlay-layout.spec `@e2e @acceptance @REQ-005-AC12 …` | 1280 × 800 (3D view 1000 × 390 checked), section, 5 rules (keeping ERDG-1/-2), colouring, ERDG-1/-2 isolated, ERDG-1 hidden, ERDG-2 selected, filter panel open. Checks: five icon-only pills, each button with `title` and `aria-label`, the label as the accessible name; properties panel 8 px left of the stack, 16 px from the top, ≥ 8 px above the toolbar, ~488 px from the left, 360 px wide, ≥ 280 px high; filter panel left of it, ≥ 16 px from the left; no two of panel / properties / stack / toolbar / title chip overlap, all inside the 3D view; properties body ≥ 120 px and scrolling; filter body scrolls when higher. Without the properties panel the pills show labels again and the panel is centred |
| overlay-layout.spec `@e2e the five-pill overlay check repeated at 1100 and 1024 px …` | the same assertions after resizing to 1100 × 800 and 1024 × 800 (filter area as a drawer, 3D view at full width), and at 1024 with the colouring panel instead of the filter panel. Not tagged with the AC: it repeats the check at other widths (T5 rule) |
| overlay-layout.spec `@e2e overlay layout with room to spare (one pill) …` | 1280 and 1024: properties panel at the reference place (16 px top / right, ≥ 8 px above the labelled pill, body ≥ 120 px); filter panel centred left of it; no overlaps |
| keyboard.spec `@e2e keyboard pass …` | Colouring by keyboard: Space on `Färben` focuses `Parameter suchen`, type, Tab to the entry, `Enter` colours, focus on `Ändern`, Tab to `Unterschiedliche Farben`, `Esc` returns the focus to `Färben`. A rule closed by `Esc` returns the focus to `Filter`. `Ausblenden` in the panel returns the focus to the table. Tab cycle: all 8 pill buttons of the five pills in stack order, the section handle after them, closed panels not reachable. ArrowUp on the handle moves the plane along its normal. Each chevron opens its panel with the focus inside, and `Esc` returns the focus to it. `Esc` in the search field with text clears only the text. `Schnitt entfernen` by `Enter` passes the focus to `Ausblendung entfernen`, which passes it to `Isolierung entfernen`. The entry `Filterregeln: 1` opens the panel, and `Esc` returns to the entry. `Esc` order: dialog (focus back on `+ Filter hinzufügen`), then selection, then panel (focus on `Filter`). A row tool focused, then `Esc`: focus on the table |
| keyboard.spec `@e2e @acceptance @REQ-012-AC11 by keyboard only at 1024 px …` | The whole AC11 by keyboard: `Enter` on `Filter`, Tab to `+ Filter hinzufügen`, `Enter`; focus on `Aktion`, the dialog inside the window with the four fields in one row. Invalid cases with `Enter` in `Wert` / `Eigenschaft`: empty `Eigenschaft`, `Gibtsnicht`, `Name` with an empty `Wert`. Each time the field is marked and focused, and nothing is applied. `Name` typed exactly plus `Wand`, then `Enter`: applied, focus back on `+ Filter hinzufügen`. `Abbrechen` by Space and `Esc` (also while editing via Shift+Tab to the rule text): nothing changed, focus back on the opener. Tab and Shift+Tab wrap in the dialog. The dialog also fits 1100 px |

Bite checks (product change reverted temporarily, the test failed, change restored):
- `focusInto` disabled → `@REQ-005-AC11` fails (search not focused);
- the compact branch disabled → `@REQ-005-AC12` fails;
- the `@REQ-012-AC11` keyboard test failed before the suggestion list got `tabIndex = -1`.

### Changed expectations
None. No existing test was changed. Behaviour that changed against earlier task records, each as the CR-002 spec 2 Keyboard says:
- TASK-017a decision 6: the filter-area entry text now moves the focus into the filter panel. Before, it stayed on the entry. `Esc` returns it to the entry.
- TASK-015a: `Esc` with nothing selected returns the focus to the panel's opener. Before, it always went to the toolbar button, which is still the fallback.

### Trace
- `INC2_PENDING`: removed REQ-005-AC11 and REQ-005-AC12. The list is now empty, ready for TASK-020.
- REQ-012-AC11 has a second whole-AC test (keyboard).
- REQ-007-AC5 is unchanged (TASK-017c's whole-AC test); the keyboard pass adds the dialog step and focus return.
- `docs/testing/traceability.md` regenerated (`node scripts/trace.mjs`).

## Results (2026-11-05, CV_TEST_PORT=5110)
- `node scripts/check.mjs`: green (format, lint, cdn-cache, test_fast incl. trace and the ASCII / `</script>` checks, 29 integration tests on `http`).
- Playwright `http`, all green:
  - keyboard, overlay-layout, view-tools, colouring, element-tools, element-tools-3d (32);
  - rule-filter, hide-isolate, filter-area (incl. the BUG-T1 / BUG-T3 drawer tests), panel-actions, properties-panel, selection (52);
  - view-3d, layout-followups, grouping, config, config-compat, viewer (56);
  - table, table-robustness, export, system, smoke, filter-, grouping-, viewer-, memory-robustness, `test/acceptance` (37, 1 existing conditional skip).
- Playwright `file`, all green:
  - the same four groups (32, 52, 56) and the fourth group plus `test/integration` (68);
  - keyboard and overlay-layout again after the last test edit (6).
- Perf: `test/perf/selection.spec.mjs` (`file`, volume set 10,459 rows): row click first frame 164 ms, group click 202 ms (≤ 500 ms). The properties panel show / clear now runs `layoutOverlays` (a few layout reads).
- Not run: the other perf suites and `volume-robustness`. No filter or 3D hot path changed: `layoutOverlays` runs only when a pill, the properties panel, a panel or the size changes, not per filter evaluation.

## Decisions (for the release gate / orchestrator)
1. **Opening a panel moves the focus into it also for pointer users** (spec 2: "opening a panel moves focus into it"). The search field shows its focus ring after a click on `Filter`. The reference app moves no focus. Limiting this to keyboard openings is cheap if wanted.
2. **The properties panel does not take the focus when a selection opens it.** A keyboard selection in the table keeps the arrow-key navigation, and the panel is reached with Tab or Shift+Tab. When it closes with the focus inside, the focus returns to where the selection was made, or to the table after a 3D click (the canvas is not focusable).
3. **`Esc` in `Suchen nach Objekten` / `Parameter suchen` with text clears only the text.** REQ-007 names "a filter search field's text", and these are read as filter search fields too.
4. **Icon-only pills keep their `title`.** E.g. `Alle Filter entfernen`, `Schnitt aufheben` as the reference. The label is the `aria-label`, so the accessible names are unchanged.
5. **The compact layout is decided by height only:** the space the panel would get at its reference place minus its head is less than 120 px.
   - It applies only while the properties panel is open; without it the pills keep their labels.
   - With the current pill sizes it switches at about three or more pills in a ~390 px view.
6. **Section by keyboard (T11 decision asked by spec §6 CR-002 notes): no follow-up change proposed for 1.1.0.**
   - Creating a section stays pointer-only (DEC-21).
   - The section affects only the 3D image (no data, table or export effect, [U Q3]) and is a `should`.
   - The handle is reachable by Tab and moves with the arrow keys; `Schnitt entfernen` works by keyboard.
   - A keyboard path to create a plane would need a new interaction: choosing an element and a face by keyboard. That would be new scope. Listed for the release gate; if the user wants it, it is a new change request.

## T11 heuristic review (spec 2 User interface; screenshots at 1280 / 1100 / 1024 × 800 with five pills, 5 rules and the properties panel)
- **OK:**
  - the compact layout reads clearly: icon pills, the panel between filter panel and pills, the toolbar free;
  - the dialog `Filter bearbeiten` fits at 1024 / 1100 px with its four fields in one row;
  - the focus ring is visible on every 3D overlay control (`:focus-visible` rules exist for toolbar, pills, links, rule rows, props actions, group heads, row tools, colouring controls and handle).
- **Minor, not fixed** (outside this task's ACs; for the orchestrator):
  1. The section handle (`Schnitt verschieben`) is not part of the overlay layout. It sits at the projection of the models' centre and can lie under an open panel or the properties panel. It stays reachable by Tab.
  2. The navigation hint (above the toolbar, first 6 s only, `pointer-events: none`) can overlap the compact properties panel or a panel centred above the toolbar while it is shown.
  3. 1.0.0 dialogs (`Filtersatz` / `Spalten` catalogue, `Titel, Datum und Logo`, the column filter popup) have no Tab wrap; only `Filter bearbeiten` got one here.
  4. The colouring legend (`#cv-legend`, a list without focusable children) is a Tab stop in Chromium (focusable scroller). This is acceptable: it allows keyboard scrolling, and it is labelled `Legende`.
  5. Below 1280 px the open filter drawer covers the left part of the 3D view, including a filter panel placed there. The drawer is a temporary overlay closed with `Filter`, as 1.0.0.

## Open points / contracts for later tasks
- **TASK-020:**
  - `INC2_PENDING` is now empty, so TASK-020 can assert that.
  - T5 retag question of TASK-017c (REQ-007-AC5 partial tags) is unchanged.
  - NFR-001 is unaffected: no filter-path change.
- **Not tested here:**
  - the overlay layout with the splitter at its extremes (3D view at 15 %). `layoutOverlays` clamps heights at 0, and panels then scroll inside;
  - windows below 1024 px (outside spec 2 Devices).
