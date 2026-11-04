---
status: final
date: 2026-11-04
relates_to: [CR-002]
---
# CR-002 analysis: critic (fresh context, 2026-11-04)

## Corrections

Every claim below was checked in the code. The rest of A and B holds, including these checked claims: ref L224/L225 (modes and the four operators), `textMatches`/`ruleMatches` L440-456, `itemPasses` L1207-1215, `applyVisibility` L1218-1263, hide/isolate/section L1103-1123, "Nach Wert filtern" L917-922, Esc handled only inside dialogs (L590-591), product `normaliseFilter` L2709 (types `range`/`values` only), `filterMask` L2729, `evaluateFilters` L2789, `CONFIG_VERSION = 1` L3448, `createViewControls` L5151, `openColumnFilter` L6019, `createDetails` L6325, `applyDisplay` L7491, `setSection` L7619, `pickAt` L7634 (returns only `best.key`), the deselect when a selected element leaves the filter (L8640), and the Esc handler near L9335.

### A (reference app)

1. **Missing-property semantics are not symmetric, and A leaves this out.**
   - `ruleMatches` returns false when an element lacks the property (ref L452-453).
   - An `Isolieren` rule therefore removes elements without the property.
   - An `Ausblenden` rule ("Ausblenden + Enthält", the reference's only way to say "enthält nicht") keeps them.
   - Any new `enthält nicht`, `ungleich` or `ist leer` must define how empty, missing and multi-valued values are treated. This becomes decision D3.
2. **The two text searches do not work the same way.**
   - A `Freie Textsuche` rule tests each property value on its own: the rule matches if any one property matches the operator (ref L449-451).
   - The search field runs `contains` on all values joined with `\n` (`haystack`, L435, L1209).
3. **Markieren and selection.**
   - Markieren paints only elements that are visible (`if (!visible || !item) continue`, L1242).
   - Elements hidden by the tools (Ausblenden/Isolieren) also clear the selection, not only filtered-out ones (L1258-1262).
4. **Q5 "Fokus" is stated as if the product had nothing.** The product already has `Ansicht einpassen` in the same style (REQ-005 bullet 1, product L5224-5225). Fokus most likely maps to that existing button.
5. **Q6 sub-question "table row click selects in 3D?" is already decided** (REQ-007-AC3). It is not an open question.
6. **Q8 units: no user decision is needed.** The product already shows units and German formatting (REQ-002-AC2/AC6, REQ-006). Keeping them is the baseline.
7. **Q9 "may already have facets": confirmed.** The product has facets with counts filtered by the other active filters (REQ-004-AC2) and zero values that stay visible (REQ-004-AC3).
8. **X-ray default: A misses that the two apps differ.**
   - In the reference, X-ray is off by default, so filtered-out elements are hidden.
   - The product shows them as ghosts by default (REQ-005 bullet 2, AC1).
   - Copying the reference "genauso" would change approved behaviour. This becomes decision D6.

### B (impact on Calc Viewer Builder)

1. **Line number:** `renderLayout` starts at L6587 (B says L6584). Trivial.
2. **REQs and ACs B leaves out:**
   - **REQ-004-AC4** `Alle Filter zurücksetzen` must say whether it clears rules, free text and hide/isolate. Today it says "all values and column filters".
   - **REQ-006-AC1 / AC8:** under M1/M3 the status line `X von Y Elementen` and the `Summe` `Anzahl` change with hide/isolate.
   - **REQ-001-AC4 / DEC-13:** the product's IfcSpace switch is a builder option that removes spaces from 3D, table and filter sets. The reference `Räume ein-/ausblenden` button affects 3D only. Adopting it conflicts with DEC-13 (decision D14).
   - **REQ-005 bullet 1** (`Ansicht einpassen`) is where "Fokus" lands (decision D10).
   - **REQ-005-AC1** (ghost default) is touched if X-ray becomes an off-by-default pill toggle.
   - **REQ-006** column-filter text, if operators also go into the column filter.
3. **Numeric operators: B covers only the robustness risk.**
   - The reference compares strings only.
   - Product numbers are converted (feet to m, mm to m) and can be `gemischt` (REQ-002-AC6).
   - The ACs must state that numeric operators compare the converted value that is shown, and that `gemischt` columns offer only the text operators, or none.
4. **Persistence and scope:** §3 places "Persisting changes made in a viewer file" out of scope. Hide/isolate done inside a viewer file are therefore session-only whatever D8 decides. Only what the builder saves goes into the config.
5. **Smaller observations, not errors:**
   - B correctly notes that the reference's Kategorie counts ignore the other active filters, while the product's facets are cross-filtered. If chips are adopted inside the viewer, their counts must follow the product rule (FUN-x1, approved at the intake gate). This becomes decision D13.
   - The deselect B attributes to `sync3d` is confirmed at L8640, so M1/M3 deselect a hidden selected element, the same as the reference.
6. **Tests B leaves out:**
   - `test/e2e/filter-area.spec.mjs` REQ-004-AC4 reset test (new sources to clear).
   - REQ-006-AC1/AC8 status and total tests (counts under hide/isolate).
   - REQ-001-AC4 (if the spaces button is adopted).

## Consolidated decisions for the user

**D1 — Left filter sets vs. in-viewer filter (Q-A)**
- a) Keep the left filter sets with their counts. Add the reference filter inside the 3D view: funnel button, panel with search, rules, "+ Filter hinzufügen". Everything combines with AND, and the left counts reflect the rules.
- b) Replace the left filter sets with the in-viewer filter. The left column goes away and the facet counts are lost (about 10 ACs).
- c) Keep the left filter sets and offer the operators only in the table column filter, with no in-viewer panel.
- **Recommended: a.** It keeps your own starting requirements (PowerBI-style sets, AND, only values that can still be chosen). The request does not say the left filters go, while it explicitly says the right part goes.

**D2 — Operator list in "Filter bearbeiten" (Q-B)**
- a) Text: `ist gleich`, `ist ungleich`, `enthält`, `enthält nicht`, `beginnt mit`, `endet mit`, `ist leer`, `ist nicht leer`. Numbers: `=`, `≠`, `>`, `≥`, `<`, `≤`, `zwischen`, `ist leer`, `ist nicht leer`. The operator list changes with the property type.
- b) The reference 4 plus `enthält nicht`, `ist ungleich`, `ist leer` and `ist nicht leer`, text comparison only.
- c) Only the reference 4, with negation through the `Ausblenden` action.
- **Recommended: a.** It matches "Was es eben alles gibt", and the product already has numeric columns with units. Numbers compare the converted value that is shown, and `gemischt` columns get only the text operators.

**D3 — Meaning of `enthält nicht` / `ist ungleich` for empty and multi-valued values**
- a) An element passes only if none of its values matches, and an element without the property passes. Example: an element with materials "Beton, Stahl" fails `Material enthält nicht „Stahl“`; an element without Material passes.
- b) Same as a, but elements without the property fail. Only elements that have the property and do not match remain.
- **Recommended: a.** It behaves like the reference's "Ausblenden + Enthält", and `ist leer` / `ist nicht leer` let you exclude elements without the property explicitly.

**D4 — Per-rule "Aktion"**
- a) As in the reference: `Isolieren`, `Ausblenden`, `Markieren` (paint pink, hide nothing) and `Freie Textsuche` (any property).
- b) No Aktion: every rule restricts the result, with negation through the operators. Keep `Freie Textsuche` as the option "Beliebige Eigenschaft", and drop `Markieren`.
- c) Like b, plus `Markieren`, which paints pink and takes priority over `Färben nach` and below the selection.
- **Recommended: b.** With `enthält nicht`, the `Ausblenden` action duplicates an operator. `Markieren` would clash with `Färben nach` and the table, and rows would not tell you what is marked.

**D5 — Combining several rules**
- a) AND only, as in the reference.
- b) An `UND | ODER` switch above the rule list.
- c) Rule groups with AND/OR.
- **Recommended: a.** It matches the reference and your rule that several filters means AND. OR already exists within a filter set.

**D6 — Ausblenden/Isolieren and filtered-out elements in 3D**
- a) Hidden or isolated-away elements are always invisible, as in the reference. Filtered-out elements keep today's ghost/hide setting, now as the reference X-ray toggle `Ausgeblendete anzeigen` in the `Filter entfernen` pill, on by default.
- b) Same as a, but the X-ray toggle is off by default, as in the reference (filtered-out elements hidden).
- c) Hidden or isolated-away elements also appear as ghosts when ghost mode is on.
- **Recommended: a.** It keeps the approved default (REQ-005-AC1) and copies the reference's look and tool behaviour.

**D7 — How Ausblenden/Isolieren interact with filters and table (Q-C)**
- a) **M3:** they act as filters. Rows leave the table, the counts `X von Y`, the sums and CSV/XLSX follow, and the filter panel shows entries such as `Ausgeblendet: 3 Elemente` / `Isoliert: 2 Elemente`. `Alle Filter zurücksetzen` and the pills clear them.
- b) **M1:** same effect as M3, but cleared only by the pills `Ausblendung entfernen` / `Isolierung entfernen`. `Alle Filter zurücksetzen` does not clear them.
- c) **M2:** rows stay in the table, greyed with an icon; counts, sums and export are unchanged; only 3D hides them.
- **Recommended: a.** "Interagiert mit den Filtern und der Tabelle" reads as real filtering. Visible entries avoid "missing" rows that no one can explain. Schneiden never affects table, counts or export in any variant.

**D8 — Saving in the configuration and viewer file (Q-D)**
- a) Rules and the free-text search are saved. Hide/isolate are saved by (`Modell`, `GlobalId`).
- b) Rules saved; hide/isolate are session-only.
- c) Nothing new is saved.
- **Recommended: b.** Rules are part of a reusable view. Element picks are ad-hoc, and they do not survive a model reload where GlobalIds differ. In an exported viewer file nothing is persisted anyway (out of scope).

**D9 — Schneiden vs. the current X/Y/Z section (Q-F)**
- a) Click section only, as in the reference: horizontal or vertical at the clicked face, with a scissors handle and the `Schnitt entfernen` pill. The X/Y/Z slider goes.
- b) Both: the click section from the element menu, and the X/Y/Z section with slider and flip kept in the `Färben`/tools area.
- c) Keep only X/Y/Z, and Schneiden in the element menu creates an axis section at the clicked point.
- **Recommended: a**, with a keyboard fallback (arrow keys move the focused handle). It is "genauso" and gives the least clutter. Old configs with an axis section load as an equivalent plane. If keyboard-only operation matters more, choose b.

**D10 — "Fokus" (Q-H)**
- a) The existing `Ansicht einpassen` as a round toolbar icon, fitting to what is currently visible (filter, hide and isolate applied).
- b) As in the reference, fitting whole models and ignoring filter and hide.
- c) a, plus a `Fokus` button in the properties panel that zooms to the selected element.
- **Recommended: a.** Fitting to the filter result is what users expect after filtering or isolating, and it needs no new button.

**D11 — Colouring panel (Q-G)**
- a) As in the reference: `Einfärben` panel with a property list and `Unterschiedliche Farben | Farbskala`, scale colours Rot/Blau/Grün/Orange/Violett/Grau/`Eigene Farbe`, and the legend inside the panel. This changes DEC-15 and TASK-005 L1.
- b) The reference panel and look, but the automatic DEC-15 rules (text distinct, numbers on a blue scale) without a mode choice.
- c) Keep today's controls and the legend under the model.
- **Recommended: a.** The request says the viewer should look "wirklich genauso". The `mehrere Werte` and `(leer)` colours from DEC-15 stay.

**D12 — Properties panel and access to the tools without a 3D click (Q-E)**
- a) A floating panel at the top right of the 3D view (360 px, glass). It opens on a 3D click or a table-row click and closes with X, Esc or a click on empty space. Its header has buttons `Ausblenden` / `Isolieren`, and its rows have hover tools `Nach Wert filtern` / `Farbe nach Wert`.
- b) As in the reference, with no tool buttons in the panel; hide/isolate only from the 3D element menu.
- c) Like a, plus a right-click menu on table rows and group rows (`Ausblenden`, `Isolieren`).
- **Recommended: a.** Selecting from the table and elements without geometry would otherwise have no way to hide or isolate, and it gives a keyboard path. The canvas is about 55 % of the height at 1280 px, so the panel is height-limited with internal scrolling.

**D13 — Kategorie and Datei chips in the viewer filter panel**
- a) Leave them out of the panel; the left filter sets `Kategorie` and `Modell` already do this with counts.
- b) Include them with counts filtered by the other active filters, the same as the left sets.
- c) Include them as in the reference, with counts that ignore the other filters.
- **Recommended: a**, if D1 is a. That avoids two places for the same filter. If D1 is b, choose b.

**D14 — `Räume ein-/ausblenden` button**
- a) No button; IfcSpace stays the builder option (DEC-13: 3D, table and filter sets together).
- b) Add a 3D-only toolbar button as in the reference, with spaces staying in the table.
- **Recommended: a.** A 3D-only toggle would contradict "Ausblenden interagiert mit Tabelle" and DEC-13.

**D15 — Table width (Q-I)**
- a) The table and 3D view extend to the right edge (the details column is removed), and the left filter column stays full height.
- b) The table spans the full window width under the filter column too.
- **Recommended: a.** It is what the request text says, and the filter column keeps its height for long sets.

**D16 — `Nach Wert filtern` in the properties panel (Q-J)**
- a) Adds the rule `<Eigenschaft> ist gleich „<Wert>“` in the viewer filter panel, as in the reference.
- b) Ticks the value in the matching left filter set, adding the set at the bottom if it is missing.
- **Recommended: b**, if D1 is a. The result then shows up with counts where users already look. With D1 b, choose a.

**D17 — Scope of the free-text search `Suchen nach Objekten`**
- a) All properties of each element, as in the reference. This needs a new index; memory and time are not yet measured for the 6,859-property model.
- b) Only the properties in the table columns and filter sets plus the standard attributes (Name, GlobalId, Kategorie, Typ, Geschoss, Material).
- **Recommended: b**, unless a measurement shows a stays within NFR-001 (500 ms at 30,000 elements) and the browser's memory. b covers what users type in practice, at negligible cost.