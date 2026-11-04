---
status: final
date: 2026-11-04
relates_to: [CR-002]
---
# CR-002 analysis: impact (fresh context, 2026-11-04)

# CR-002 impact analysis: filter, properties and 3D tools "wie im HTML Viewer" in Calc Viewer Builder 1.0.0

This was a read-only analysis. No repository file was changed and nothing was committed. The only scratch output is the benchmark script and its extracted copy of cv-core, both in `/tmp/claude-0/-home-user/b4080e59-f4c4-52f1-9269-192eeef60a44/scratchpad/cr-ref/` (`bench.mjs`, `core.mjs`).

Evidence base:
- `docs/spec.md` (approved baseline)
- `docs/intake/answers.md` and `docs/intake/modelviewer-analysis.md`
- `docs/release/decisions-to-confirm.md`
- `docs/testing/traceability.md`
- `docs/reviews/verification-INC-1.md` and `docs/testing/report-INC-1.md`
- `docs/changes/CR-002.md` (status `submitted`)
- `calc-viewer-builder.html` at commit `dc851c4`
- the reference app `/home/user/html-modelviewer/ifc-viewer-builder.html` (cited as `ref L<n>`)

## 0. What the reference app actually does

These are the facts the request points to.

| Element of the reference | Evidence | What it means for the product |
|---|---|---|
| Round toolbar at the bottom centre: `Modell einpassen` (fit), `Räume`, `Filter`, `Einfärben` | ref L878-881, L1306-1318, L1509-1510, CSS L1747-1751 | "Fokus" most likely means `Modell einpassen`. The reference has no zoom to a selected element: the camera never moves (also product REQ-007, TASK-006c). |
| Filter panel (380 px, glass, bottom centre) with: search `Suchen nach Objekten` (free text over all properties), chips `Datei`/`Kategorie` (checklists, OR), rules `{mode, key, op, value}` | ref L1316-1345, L1174-1176, L1207-1215 | Rule modes: `Isolieren`, `Ausblenden`, `Markieren`, `Freie Textsuche` (L224). Operators: only `Gleich`, `Beginnt mit`, `Endet mit`, `Enthält`, case-insensitive text (L225, L440-456). All rules are combined with AND. |
| No `enthält nicht`, no numeric operators, no facet counts | ref L225; modelviewer-analysis "Gaps": "No facets with OR within a property and cross-filtered counts"; "category counts ignore the other active filters" | In the reference, "enthält nicht" is expressed as mode `Ausblenden` + `Enthält`. The user wants more than the reference ("Was es eben alles gibt"). |
| Properties panel at the top right, 360 px, floating, only while an element is selected; each row has tools `Farbe nach Wert` and `Nach Wert filtern` (the latter adds an isolate/eq rule) | ref L884-886, L912-925, L300-320, CSS L1765 | Replaces the product's right-hand `Element-Details` column. |
| Pick menu at the clicked point with `Ausblenden` / `Isolieren` / `Schneiden`; pills at the bottom right `Isolierung entfernen`, `Ausblendung entfernen`, `Schnitt entfernen`, `Filter entfernen` (with an X-ray toggle `Ausgeblendete anzeigen`), `Einfärbung entfernen` | ref L979-1135, L1016-1031, L1350-1375, L1524 | Tool-hidden elements are always invisible, even in X-ray: `shownByTools` is false, so they are never ghosts (L1231-1236). |
| `Schneiden` cuts at the clicked face: horizontal cut if \|normal.y\| ≥ 0.7, otherwise a vertical plane with any horizontal normal; drag handle | ref L226-229, L1080-1100 | The product's section is axis-aligned X/Y/Z with slider and flip (REQ-005). The two cannot be mapped one to one. |
| `Einfärben`: pick a property, then mode `Unterschiedliche Farben` or `Farbskala` with 6 scale colours plus a custom colour | ref L231-235, L1508-1600 | The product applies DEC-15 automatically (text distinct, numbers on a blue scale). The user cannot choose the mode or colour. |

## 1. Impact per element of the request

### E1 – "Filter wie im HTML Viewer" plus an advanced filter with enthält / enthält nicht etc.

**Baseline affected**
- REQ-004 (rules added; text "Filters affect … together"), REQ-003 (if the filter area moves), the Terms "Filter set" in §1, and User interface §2/§4.5.
- New AC(s) needed in REQ-004 or a new REQ for the operator filter (e.g. REQ-012).
- DEC-14 and FUN-x1 stay valid only if the facet sets stay (see tension a).
- NFR-001 text ("filter click, column filter change …") would need "rule change" and "free-text search" added.

**Code affected**
- cv-core:
  - `normaliseFilter` (L2709) and `activeFilters`, a new type such as `{type:"rule", op, value}`.
  - `filterMask` (L2729): evaluate the operator once per distinct dictionary value (`col.values`), then the existing code-to-row loop.
  - `evaluateFilters`, `facetCounts` need no change: a rule is just one more AND mask.
  - `buildConfig` / `applyConfig` / `CONFIG_FIELDS` (L3618-3874).
- cv-app: `coreFilters` (L8095) adds the rules. They then flow automatically into facet counts, `inside[]` for 3D, the table, the status line and the export.
- cv-ui: a new rule list and editor (property combobox, operator, value).
  - If filtering moves into the viewer, also a filter panel and pill inside `cv-canvas-box`.
  - Alternatively the operators could also be offered in the column-filter popup (`openColumnFilter` L6019). Today it has only a value checklist for text columns and a range for numeric columns.
- Free-text search over all properties needs a haystack per row. The lazy column store (§4.3) holds only the columns in use, and one model had 6,859 pset properties (§4.8). This is a new structure with a memory and time cost, and it is not measured.

**Tests affected**
- New: unit tests in `test/unit/filter-engine.test.mjs` for operators × kinds (text / number / multi / bool / `(leer)`), `enthält nicht` on multi-valued values, and case handling.
- New: e2e for the rule UI, and an acceptance test per new AC.
- Changed: `test/unit/config.test.mjs` round trip and `test/e2e/config.spec.mjs` "@REQ-009-AC1 … covering every field" (new fields); `test/e2e/viewer.spec.mjs` "@REQ-010-AC2 … CSV and Excel equal the builder's" (add a rule).

### E2 – "Eigenschaften im Viewer wie beim HTML Viewer" and "rechter Part mit den Elementdetails entfällt"

**Baseline affected**
- REQ-007: the text "shows all its properties in the right panel `Element-Details`", and AC1, AC3 and AC4 ("details panel shows…").
- §2 User interface: the layout diagram, "details ~320 px (collapsible)", "below that the side panels collapse".
- UI-01 from the intake, "element details right" (user-confirmed), is reversed by the user.
- TASK-007 deviation 3.7 "collapsed details panel not saved" becomes obsolete.

**Code affected**
- cv-ui:
  - `renderLayout` (L6584-6900): the details aside, `cv-details-toggle`, `setDetailsCollapsed`, and the drawer toggle `cv-toggle-details` / `cv-show-details`.
  - `createDetails` (L6325) with `show` and `showGroup` is reused in a floating panel inside `cv-canvas-box`.
  - Optional row tools `Farbe nach Wert` / `Nach Wert filtern`.
- cv-css: the grid columns of `.cv-main`, plus the panel and pill styles taken from ref CSS L1747-1814.
- cv-app: `select` (L8699) and `applyGroupSelection` (L8747) call `ui.details.*`. Their interface stays the same, only the host changes.

**Tests affected**
- `test/e2e/view-3d.spec.mjs` (15 references to details selectors): "@REQ-007-AC1 @REQ-007-AC5 clicking a wall selects it and shows its details…", "@REQ-007-AC4 an element without geometry…".
- `test/e2e/selection.spec.mjs`: "@REQ-007-AC3 @REQ-007-AC4 @REQ-007-AC5 a table row click…".
- `test/e2e/filter-area.spec.mjs`: "@UI screen layout: … details ~320 px collapsible, splitter 55/45 …" and "@UI below 1280 px the side panels collapse to drawers … opened with `Filter` / `Details`".
- `test/e2e/smoke.spec.mjs` and `test/e2e/viewer.spec.mjs` (1 details reference each), `test/support/selection.mjs` (5 references).
- BUG-T2 (a long GlobalId breaks mid-word in the details) is either fixed along the way or moves with the panel.

### E3 – "Tabelle unten geht bis nach rechts"

**Baseline affected:** the §2 User interface diagram. REQ-006 itself does not change.

**Code affected**
- cv-ui `renderLayout`: `main.append(filters, center, details)` becomes `filters, center`.
- cv-css grid change. `.cv-center` already holds the viewport, splitter and table, so the table automatically gets the former 320 px.

**Ambiguity:** does "bis nach rechts" mean only up to the right edge, or does the table also span the full width under the filter column? The request text supports only the former.

**Tests affected**
- The layout test above, `layout-followups.spec.mjs` "@UI L4 the 3D toolbar stays one row at 1280 px…", and perf `test/perf/table.spec.mjs` (more visible columns may be rendered: re-measure).

### E4 – "Viewer innendrin genauso wie der HTML Viewer": Fokus / Filter / Färben inside the viewer

**Baseline affected**
- REQ-005: the text "top right: Elemente außerhalb des Filters, Färben nach, Schnitt; legend bottom"; ACs AC1-AC4 address these controls through the UI.
- UI-02 stays (same colours).
- DEC-15: if the reference colouring modes are adopted (`Farbskala` for any property, choice of colour), DEC-15 changes. That is a business rule and needs a user decision.

**Code affected**
- cv-ui `createViewControls` (L5151-5339): the top-right bar is replaced by a round toolbar at the bottom centre plus pills.
- The legend currently sits under the canvas (TASK-005 L1, "never covers geometry"). In the reference the legend is inside the colour panel. This is a conflict with L1.
- cv-app: `setColouring`, `setSection`, and ghost/hide as a toggle on the filter pill (ref L1359-1375).

**Tests affected**
- `test/e2e/view-3d.spec.mjs`: REQ-005-AC1..AC4 and "@smoke render smoke: ghost and hide…".
- `test/e2e/layout-followups.spec.mjs`: L1 L2, L3, L4.
- `test/support/view-3d.mjs`.

### E5 – On click: Ausblenden / Isolieren / Schneiden

**Baseline affected**
- New capability, which needs a new REQ (element tools).
- REQ-005 `Schnitt` (axis/slider/flip) is replaced or extended by a click section.
- REQ-005-AC3 and the test seam `state().section = {axis, offset, flipped}` (§4.4) change if the plane may have any horizontal normal.
- REQ-007-AC5 (Esc and empty-space click clear the selection) must define the order: first close the pick menu, then clear the selection.
- §4.4 `CalcView.state()` needs, for example, `toolHidden` and `isolated` sets, kept apart from filter `hidden`.

**Code affected**
- cv-3d:
  - `pickAt` (L7634) returns only the key. It must also return the point and the face normal (`raycastAll` hits carry them, ref L1057/L1098).
  - Menu placement uses projection (as `screenBox` L7665).
  - `setSection` (L7619) and `axisRange` need an arbitrary plane and a drag handle.
  - `applyDisplay` (L7491) needs a third visibility class "always hidden" (reference: tool-hidden elements are never ghosts).
- cv-app: `onPick`, Esc handling (L9335), a new store of hidden and isolated keys.

### E6 – "Ausblenden und Isolieren interagieren mit Filtern und Tabelle, Schneiden nicht"

See tension c in section 2.

**Baseline affected:** REQ-004 (a new filter source), REQ-006 (table rows), REQ-008 (export of the shown rows, so they inherit the effect), and possibly REQ-009 (persisted or not) and Q-003 (group selection only shrinks).

**Code affected**
- cv-core: a new filter type `{type:"keys", keys}` (exclude / include-only) as a bitset. This is trivial at evaluation time.
- cv-app: `coreFilters`, `Alle Filter zurücksetzen` (does it also reset hide/isolate?), and the pills.

## 2. Key design tensions (with evidence)

### a) Left filter sets vs. the in-viewer filter

**What the left filter sets are today**

The left filter sets are the product's core. C00 is the user's own initial description, verbatim:
- "Auf der linken Seite sind frei wählbare Filtersätze (ähnlich wie bei PowerBI)"
- "Werden mehrere Filter angeklickt, dann ist es eine UND Bedingungen"
- "Es werden nur weitere Filter angezeigt, welche noch anklickbar sind"

The baseline built on this:
- FUN-02: OR within a set, AND across sets.
- FUN-x1: hidden zero values, cross-filtered counts.
- DEC-14.
- REQ-003 / REQ-004 with AC1-AC4.
- REQ-001-AC1 (a `Modell` set with counts).
- REQ-005-AC2 (colour dots in the filter set).
- FUN-x1 was explicitly approved at the intake gate.

**What the reference lacks:** facets, counts under other filters, and only-possible values (modelviewer-analysis "Gaps").

**Replace vs. add**
- **Replacing** the left sets with the reference filter loses all of these, plus REQ-003 (catalogue, order, collapse), the colour dots, the `filterSets` part of the config schema, and old configs' `filterSets.selected`. That is at least 10 ACs removed or changed.
- **Adding** the reference filter panel inside the viewer (rules with operators, free text, Datei/Kategorie chips) keeps everything. Because rules are AND masks in `evaluateFilters`, the facet counts automatically reflect the rules. This is the only variant that satisfies both C00 and CR-002. Cost: two filter UIs. The status line, `Alle Filter zurücksetzen` and the pill `Filter entfernen` must clear both.

**What the request says:** it does not say "the left filters are removed", whereas it does explicitly say "Der rechte Part … entfällt". So "add" fits the wording better. This remains Q-A.

**Mixed variant:** keep the left sets, and offer the operators also in the column-filter popup and in the viewer filter panel. That adds a third place to filter. A decision is needed on where operator rules live (viewer panel, filter-set header, column filter, or several of these).

**Mode semantics from the reference:**
- `Markieren` (paint in `MARK_COLOR`, keep everything visible) has no counterpart in the product. Precedence against colouring and selection is undefined (DEC-15 precedence).
- `Ausblenden` as a rule mode is a negation, which overlaps with `enthält nicht`.
- A decision is needed on which modes are adopted.

### b) Removing the right details panel

- **Where properties appear:** in a floating panel inside `cv-canvas-box`, as in the reference (top right, 360 px).
  - The canvas is only the upper 55 % of `.cv-center` (default splitter 55/45, L6815). At a 1280×800 window that is roughly 350-400 px high. A 360 px panel with long pset lists will be cramped: scrolling inside the panel, and it covers the model.
  - Test at 1280 px. A possible mitigation is a panel max-height and a collapse.
- **Selection from the table** (REQ-007-AC3): the row click must open the same floating panel even though nothing was clicked in 3D. There is no pick point, so there is no pick menu, so hide/isolate cannot be reached from the table unless the panel or row offers buttons. That is Q-E.
- **Elements without geometry** (REQ-007-AC4): they can only be selected from the table, so the panel inside the 3D view shows the properties of an element that is not visible there. This is acceptable but should be stated in the AC.
- **Group-row selection:** `showGroup` (count, "Davon ohne 3D-Geometrie") also moves into the floating panel.
- **Keyboard selection (UX M2):** the row cursor and Enter/Space select stay in the table and are unaffected. Still needed:
  - Focus management for the floating panel (reachable by Tab, a close button, Esc closes the panel first).
  - A keyboard path to hide/isolate/section. The pick menu is pointer-only in the reference. The click-section has no keyboard equivalent, which argues for keeping the axis section as the keyboard alternative.
  - The existing Esc rule "Escape handled by a dialog is marked defaultPrevented" (L9335) must cover the menu and panels.
- **REQ-007 ACs:** AC1, AC3 and AC4 change their wording ("details panel" becomes "properties panel in the 3D view"). AC2 and AC5 stay, but AC5 gets the menu order. Priority stays should.

### c) "Ausblenden/Isolieren interagiert mit den Filtern und der Tabelle, Schneiden nicht"

**Today**
- The product has no element-level hide or isolate.
- "Hidden" exists only as the display mode for elements outside the filter (`Geist | Ausblenden`, REQ-005). It changes 3D only, never the table or the counts.
- Section changes 3D only (REQ-005).

**Possible meanings, to be decided by the user (Q-C)**

| # | Meaning | Table | Facet counts / status `X von Y` | Sums / export | 3D |
|---|---|---|---|---|---|
| M1 | Hide and isolate act as filters (an exclude or include-only key set, AND with all filters) | rows disappear / only isolated rows | counts drop / count only isolated | sums and CSV/XLSX without them (REQ-008 "exactly the rows shown") | hidden; open: ghost or always hidden like the reference |
| M2 | Visual plus marking: rows stay, shown greyed or with an icon; counts unchanged | rows marked | unchanged | unchanged | hidden |
| M3 | Like M1, and shown as entries in the filter panel (chips `Ausgeblendet: n Elemente`, `Isoliert: n`) that `Alle Filter zurücksetzen` clears | as M1 | as M1 | as M1 | as M1 |

Implementation notes for M1/M3: they are the cheapest and most consistent, a key-set mask in `evaluateFilters` (see the measurements in section 3). Isolate in the reference accumulates: each further click adds to the isolation (L1109-1118).

**Sub-decisions**
- Is a hidden element a ghost in ghost mode, or always invisible as in the reference (L1231-1236)?
- Does `Alle Filter zurücksetzen` clear hide/isolate?
- Does isolating while filters are active intersect with the filter result or override it?
- Are hide/isolate saved in the config and the viewer file? REQ-009 says "Elements are never referenced by localId", and DEC-4 means a GlobalId alone is not unique, so the reference would have to be (`Modell`, `GlobalId`).
- Is a hidden selected element deselected? Today `sync3d` deselects elements that leave the filter (L8640), so under M1 yes.
- Grouping: groups are recomputed without the hidden rows, which is consistent. A group selection only shrinks (Q-003).

**"Schneiden nicht":** clipped elements stay in table, counts and export (as today). Only `state().section` changes.

### d) Table full width

The CSS grid change is low risk. Effects:
- At 1280 px the table gains 320 px: more visible columns, and the virtualised table renders more cells. Check `test/perf/table.spec.mjs` again.
- The drawer logic below 1280 px keeps only `Filter`.

## 3. Cross-cutting effects

### Configuration schema `calc-viewer-config/1`

- **Today:** `applyConfig` reports unknown fields as `skipped.unknown` and applies the rest (L3688-3691, L3717). A missing part "keeps the current state" (doc comment L3664). A `columnFilters` entry with an unknown `type` is reported and skipped.
- **Additive option** (new optional fields such as `filterRules`, `display.colourMode`/`scaleColour`, `tools.hidden`/`isolated`):
  - Old configs load into the new builder.
  - Caveat: under the "missing part keeps current state" rule, loading an old file while rules are active would keep the rules. The new fields must default to "none" when absent, otherwise REQ-009-AC1 equality breaks across versions.
  - A new config in the 1.0.0 builder or old viewer runtime: rules, hide and isolate are named in the notice and skipped. The filter result then silently differs except for that notice (R4 = 1, R5 = 1).
- **Section shape change** (`{axis, offset, flipped}` to plane `{anchor, normal}`) is not additive.
  - Either keep `axis` sections and add `plane` as an alternative field: old files are still read, and 1.0.0 marks only the new form as invalid.
  - Or bump to `calc-viewer-config/2`: then `validateConfig` must accept 1 and 2 (today exactly `CONFIG_VERSION`, L3509), and 1.0.0 rejects v2 with `Konfigurationsversion 2 wird nicht unterstützt.` This is a format change of stored data (R4 = 2, R5 = 2, forces risk `high`).
- **Recommendation:** stay additive on v1. This is a design decision.

### Exported viewer file

- It embeds its own runtime (§4.2), so viewer files already exported with 1.0.0 are unaffected and keep the old UI.
- New viewer files get the new UI automatically: cv-ui/cv-3d/cv-app are shared and `start({mode:'viewer'})`.
- REQ-010 text "offers REQ-003 to REQ-008" must include the new REQ(s).
- REQ-010-AC2 parity (CSV equals the builder's) must include rules and hide/isolate if they are saved in the config. If they are not saved, a colleague opens the viewer without them.
- `cv-viewer-bootstrap` is not affected. The ASCII/`</script>` unit check covers the new code automatically.

### NFR-001 (≤ 500 ms at ≥ 30k)

Measured by a Node micro-benchmark on the real cv-core with 30,931 synthetic rows (median of 5, scratchpad script above):

| Operation | Time |
|---|---|
| Operator mask over `Name` (30,932 distinct values), `enthält` | 1.93 ms |
| Operator mask over `Name`, `enthält nicht` | 2.26 ms |
| Multi-valued `Material` | 0.17 ms |
| `evaluateFilters` + `facetCounts` with 2 sets | 0.82 ms |

- So operator rules cost a few ms in the core, negligible against the measured core path of 6-25 ms (testing cycle 2).
- The bottleneck stays the 3D frame: 354-533 ms on software WebGL (BUG-T4, accepted deviation 1.1). Hide/isolate/rule clicks go through the same `applyDisplay` path and inherit the same deviation.
- **Not measured, a risk:**
  - Free-text search over all properties: haystack build and memory at 6,859 properties.
  - Typing latency, and whether the reference's 250 ms debounce (L222) counts toward the 500 ms.
  - The click-section drag handle (render-on-demand loop, TASK-005 P1 "frames drawn on demand only").

### CSV/XLSX export

REQ-008 exports exactly the rows the table shows (`exportSheetNow` L8932 uses `order` and `displayItems`). Rules, and hide/isolate under M1/M3, therefore apply to the export automatically. Under M2 they do not. Section never does. No REQ-008 text change is needed except an AC confirming that a rule filter applies. A user decision is needed only if the export should differ from the table.

### Grouping

No core change. Groups, sums and the `Summe` row follow the filtered rows. Under M1, hiding an element changes group sums, which users might not expect from a "visual" tool. That is part of Q-C. "Isolate group" from a group row is an open option (Q-E).

### Narrow-width drawers

- Below 1280 px today there are two drawer toggles, `Filter` and `Details` (L6655-6668).
- `#cv-messages` lives in the left filter panel. The BUG-T1 fix (MutationObserver opens the filter drawer on a new message, L6870-6876) and the BUG-T3 fix (not on removal) depend on it.
- If the left filter panel stays (variant "add"), the BUG-T1/T3 logic and tests are untouched; only the `Details` toggle goes.
- If the left panel is replaced, `#cv-messages` needs a new home. The tests "@robustness @UI below 1280 px a load error or configuration message opens the filter drawer and is visible" and "… a message that goes away does not reopen the filter drawer" must be rewritten. This is the area with ≥ 3 earlier bugs.
- Floating panels (filter 380 px, properties 360 px, pick menu, pills) inside a canvas of about 55 % height at narrow widths: the reference breakpoints (700/600 px, CSS L1923-1937) are below the product's 1280 px minimum, so overlap of the pills, properties panel and filter panel needs its own layout check.

### Keyboard accessibility

- Kept: the table row cursor (UX M2), `aria-activedescendant`, the splitter by keyboard.
- New obligations:
  - Toolbar icon buttons with `aria-label` / `aria-pressed` (the reference has these).
  - Panels reachable by Tab, with focus returning on close.
  - The pick menu also reachable without a pointer, e.g. via the properties panel or a key on the selected element.
  - An Esc order (menu, panel, selection) that keeps "Esc in a filter search field clears only the field" (`selection.spec.mjs` "@REQ-007-AC5 Esc inside a filter search field…").
  - A rule editor combobox with a listbox role.
  - Section: a click-only plane is not keyboard-operable, so keep the axis section or add keys.
- T11 heuristic review needed.

## 4. Size (process/calibration/change.md §11)

**Feature-size.** Several §11 triggers hold:
- A new capability that needs its own interview: element tools, advanced operators and modes, the meaning of hide/isolate, and section semantics. These cannot be settled in one short round (see the open questions).
- More than ~5 changed or new requirements: REQ-004, REQ-005, REQ-007, REQ-009, REQ-010, the §2 User interface section, plus at least one new REQ (element tools) and probably a second (operator filter). That is 7-8 of 11 REQs, more than 25 %.
- New UI components: floating toolbar, filter panel, properties panel, pick menu, pills.

Not triggered: the tier probably stays S. The complexity re-score should be run; the UI component count grows.

Consequence: a new delivery cycle (cycle 2) with a scoped intake and gates. `docs/changes/register.md` already lists "feature-size (to confirm in analysis)", which is now confirmed. Approval is human (released behaviour plus feature-size, §5).

## 5. Risk (R1–R9)

| # | Score | Evidence |
|---|---|---|
| R1 Baseline | 2 | REQ-004/005/007 changed; UI structure (§2 diagram, UI-01) changed; REQ(s) added |
| R2 Blast radius | 2 | cv-core, cv-ui, cv-css, cv-3d, cv-app (plus the viewer runtime through sharing): more than 3 components |
| R3 Completed work | 2 | released 1.0.0 behaviour changes (TASK-004, 005, 006c, 007 done) |
| R4 Data | 1 (2 if v2 or a section format change) | additive config fields; a section plane shape or version bump is a format change |
| R5 Interfaces | 1 (2 if v2) | config file format is public (shared with colleagues); `CalcView.state()` test seam changes (internal) |
| R6 Security | 0 | no auth or personal data. User-typed rule values rendered in the DOM must stay text (existing T7 XSS checks extend) |
| R7 Reversibility | 0 | `git revert`. Configs saved by the new version degrade in 1.0.0 with a notice; nothing is irreversible |
| R8 Safety net | 1 | strong for the existing engine (255 tests, 50/50 ACs), none yet for the new UI; pick tests are coordinate-based only |
| R9 Defect history | 2 | BUG-T1 and BUG-T3 (drawers/messages), BUG-T2 (details panel), BUG-T4 (3D frame time), TASK-006b verification FAIL, UX M1/M2 in verification |

**Total 11 → `high`.** With R4/R5 = 2 it is also `high` through the override. Change review (fresh context) plus human approval.

## 6. Rough task breakdown (after the scoped intake and spec delta)

| # | Task | Depends on | Touches |
|---|---|---|---|
| 0 | Scoped intake: answer Q-A…Q-J; spec delta (REQ-004/005/007/009/010, UI section, new REQ-012 element tools, REQ-013 operator filter, DEC for hide-semantics and config), spec gate | – | docs |
| 1 | Core: rule filter type (operators × kinds, multi-valued, `(leer)`), key-set filters (hide/isolate), optional free-text haystack; config fields (additive, absent = none) + validate/apply; unit + perf micro-benchmarks | 0 | cv-core, test/unit, test/perf |
| 2 | Layout: remove details column and drawer toggle, table full width, floating properties panel (reuse `createDetails`), BUG-T2 | 0 | cv-ui, cv-css |
| 3 | 3D: pick point and normal, pick menu placement, tool-hidden visibility class, click-section plane + handle (and/or keep axis section), `state()` extension | 0 | cv-3d |
| 4 | Viewer toolbar (Einpassen / Filter / Färben), filter panel (rules, chips, search), pills, ghost toggle, colouring panel (if DEC-15 changes) | 1, 2, 3 | cv-ui, cv-css, cv-app |
| 5 | App wiring: rules and key sets into `coreFilters`, reset semantics, selection flows (table → panel, Esc order), config state, viewer mode | 1, 3, 4 | cv-app |
| 6 | Keyboard and narrow-width pass (focus, Esc, the 1024-1279 px layout of floating panels, BUG-T1/T3 behaviour preserved) | 4, 5 | cv-ui, cv-css |
| 7 | Viewer file and regression: REQ-010-AC2 parity with rules; old-config compatibility fixtures (v1 1.0.0 file into the new builder, new file into the 1.0.0 builder notice) | 5 | cv-builder (none expected), tests |
| 8 | Perf pass: NFR-001 with rule, free-text, hide/isolate clicks; table at full width | 5 | test/perf |
| 9 | Testing phase (cycle 2), release 1.1.0 | 6, 7, 8 | – |

Tasks 1, 2 and 3 can run in parallel after task 0.

## 7. Test scope

**Unit (T1)**
- Rules: every operator on text, number, multi, bool and empty values; "enthält nicht" semantics on multi-valued values.
- Key-set filters; facet counts under rules; config apply and round trip with the new fields, plus absence defaults; `validateConfig` versions.
- Coverage gate ≥ 70 % remains.

**Integration (T2):** `config-roundtrip.spec.mjs` with rules and tools; `export-readback.spec.mjs` with a rule filter.

**System (T3):** the viewer file opens offline with the new UI (`viewer.spec.mjs` "@REQ-010-AC1…"); no network.

**E2E (T4)**
- The flows filter panel, rule, pick menu hide/isolate/section, pill removal, properties panel, table-row → panel.
- Rewrite `view-3d.spec.mjs`, `selection.spec.mjs`, `layout-followups.spec.mjs` (L1 L2 L4), `filter-area.spec.mjs` (layout and drawer tests), `smoke.spec.mjs`, and support helpers `selection.mjs`, `view-3d.mjs`, `config.mjs`.

**Acceptance (T5)**
- Every new or changed AC.
- Changed expectations: REQ-005-AC1..AC4 (controls), REQ-005-AC3 (section seam), REQ-007-AC1/AC3/AC4/AC5, REQ-009-AC1 ("every field"), REQ-010-AC2/AC3.
- Regenerate traceability (`node scripts/trace.mjs`; `trace.test.mjs` fails while it is stale).

**Performance (T6):** `test/perf/nfr-001.spec.mjs` (add rule, free text, hide, isolate), `view-3d*.spec.mjs`, `selection.spec.mjs`, `table.spec.mjs` (full width); a free-text haystack memory test on the 6,859-property model.

**Robustness (T7)**
- Rule values with HTML/script (rendered as text), empty or huge values, operators on `gemischt`-unit columns.
- Hide/isolate with model removal, IfcSpace toggle and config load.
- Old and new config files across versions.
- BUG-T1/T3 regressions below 1280 px.

**Also**
- T9 smoke and the full `test_all` regression.
- T11 usability and keyboard review.
- T12 manual Chrome/Edge.

## 8. Open questions (for the main agent to ask the user)

- **Q-A — open:** Do the left filter sets (facets with counts, only-possible values from C00/FUN-x1) stay, with the reference-style filter (rules, free text) added inside the viewer and combined by AND? Or does the in-viewer filter replace them? Replacing loses REQ-003 and most of REQ-004.
- **Q-B — open:** Which operators and modes? Proposal: `gleich`, `ungleich`, `enthält`, `enthält nicht`, `beginnt mit`, `endet mit`, `ist leer`, `ist nicht leer`; for numbers `=`, `≠`, `<`, `≤`, `>`, `≥`, `zwischen`. Are the reference modes `Isolieren` / `Ausblenden` / `Markieren` / `Freie Textsuche` adopted? `Markieren` needs a precedence rule against colouring and selection.
- **Q-C — open:** What does "interagiert mit Filtern und Tabelle" mean for hide/isolate: M1, M2 or M3? Sub-questions:
  - Are hidden elements ghosts or fully invisible?
  - Does `Alle Filter zurücksetzen` clear hide/isolate?
  - Do they change sums and the CSV/XLSX export?
- **Q-D — open:** Are hide/isolate (and rules) saved in the configuration and in the exported viewer file? If yes, the reference is (`Modell`, `GlobalId`).
- **Q-E — open:** Are hide/isolate also available from a table row or group row, or from the properties panel (needed for keyboard use and for elements without geometry)?
- **Q-F — open:** Section: replace the X/Y/Z section with slider and flip by the click-section of the reference, or keep both? Keeping the axis section keeps old configs and a keyboard path.
- **Q-G — open:** Colouring "wie im HTML Viewer": adopt the selectable modes `Unterschiedliche Farben` / `Farbskala` and scale colours (changes DEC-15)? Does the legend move into the colour panel (changes TASK-005 L1)?
- **Q-H — open:** Does "Fokus" mean `Modell einpassen` (what the reference has), or zoom to the selected element (the reference does not have this)?
- **Q-I — open:** Does the table extend only to the right edge, or also under the left filter column?
- **Q-J — open:** Does `Nach Wert filtern` in the properties panel add a rule or check the value in a filter set (adding the set if missing)?