# Calc Viewer Builder

A browser tool for BIM specialists to explore one or more IFC models like a report: filter sets narrow down the 3D model and a configurable quantity table; the table exports to CSV and Excel; the whole view can be saved as a configuration and handed to colleagues as **one offline HTML file** they can still filter, group and export.

Version 1.1.0 (released 2026-11-07, tag `v1.1.0`) — see `CHANGELOG.md` and `docs/release/release-notes-1.1.0.md`. Previous release: 1.0.0 (tag `v1.0.0`).

## Use it

1. Open `calc-viewer-builder.html` by double-click in current Chrome or Edge (Firefox best effort). No installation, no server. The builder needs internet access to `cdn.jsdelivr.net` to load its libraries at start; IFC data stays on your computer.
2. `IFC laden` (or drop `.ifc` files on the page) — IFC2X3 and IFC4, several models at once; option `Räume (IfcSpace) einbeziehen`.
3. The screen: filter area on the left (below 1280 px window width a drawer opened with `Filter`), the 3D view at the top right, the quantity table below it up to the right edge, the status line `X von Y Elementen` at the bottom.
4. Export: `Export CSV`, `Export Excel`, `Konfiguration speichern` (JSON, reload with `Konfiguration laden`), `HTML exportieren` (offline viewer file for colleagues; works by double-click without internet and offers the same filters and tools). Title, date and logo via the pencil button.

### Filter rules
- **Filter sets (left):** `+ Filtersatz` adds any property; tick values (OR within a set). Defaults `Kategorie`, `Geschoss`, `Material`.
- **Filter panel (toolbar `Filter`):** `Suchen nach Objekten` keeps elements with any property value containing the text. `+ Filter hinzufügen` opens `Filter bearbeiten` with `Aktion` (`Isolieren` keeps matches, `Ausblenden` removes matches, `Markieren` only paints them, `Freie Textsuche` compares every property), `Eigenschaft`, `Vergleich` (`Gleich`, `Beginnt mit`, `Endet mit`, `Enthält`) and `Wert`. "Does not contain" = `Ausblenden` with `Enthält`. Matching uses the text as shown in the table (`0,3`, `Ja`), ignores letter case, and never matches an empty or missing value.
- **Column filters** in the table header (text checklist; numbers `von` / `bis`).
- **Everything combines with AND:** filter sets, column filters, rules, search, hidden and isolated elements. The filter area lists `Ausgeblendet`, `Isoliert`, `Filterregeln` and `Suche` entries with ×; `Alle Filter zurücksetzen` or the pill `Filter entfernen` clears all of them. Elements outside the filter are ghosts; the toggle in the pill `Filter entfernen` hides them instead.

### Colouring
`Färben` in the toolbar: pick a property (`Parameter suchen`), then `Unterschiedliche Farben` (one colour per value; more than 120 values repeat colours) or `Farbskala` (`Rot`, `Blau`, `Grün`, `Orange`, `Violett`, `Grau`, `Eigene Farbe`; numbers by value, text by rank). The legend in the panel lists the shown elements per value. `mehrere Werte` and `(leer)` have their own colours. Remove with `Entfernen` or the pill `Einfärbung entfernen`. `Farbe nach Wert` in the properties panel colours by that property.

### Element tools
- **Click an element in 3D:** a menu at the click point offers `Ausblenden`, `Isolieren`, `Schneiden`; the properties panel opens at the top right. A click on a table row opens the panel too (a group row: `<n> Elemente ausgewählt`).
- **`Ausblenden` / `Isolieren`** (menu or panel buttons) act as filters: the elements leave 3D, table, counts, sums and exports. A further `Isolieren` adds to the isolation. Pills `Ausblendung entfernen` / `Isolierung entfernen` undo them. They are not saved.
- **`Schneiden`** cuts the 3D view at the clicked face; move the cut with the handle `Schnitt verschieben` (drag or arrow keys), remove it with `Schnitt entfernen`. The table and exports are not affected.
- **Properties panel row tools:** `Nach Wert filtern` ticks the value in the left filter set (adds the set if needed), `Farbe nach Wert` colours by it.
- **`Fokus`** fits the shown elements into the free part of the 3D view. `Esc` closes dialog, menu, selection and panel one step at a time.

Operation, limits and every error message: `docs/release/runbook.md`.

## Develop

Requirements: Node 22, Python 3, Chromium for Playwright 1.63. Commands (from `AGENTS.md` §4, run from the repository root):

| Purpose | Command |
|---|---|
| Install | `npm ci && python3 -m pip install openpyxl==3.1.5 && node scripts/vendor-cdn.mjs && node scripts/fetch-fixtures.mjs` |
| Run | `node scripts/serve.mjs`, then open `http://localhost:8080/calc-viewer-builder.html` (or double-click the file) |
| Check (format, lint, unit with coverage, integration) | `node scripts/check.mjs` — also the pre-commit hook (`.githooks/pre-commit`) |
| All suites | `node scripts/check.mjs --all` |
| Format / lint | `npx prettier --write .` / `npx eslint --max-warnings 0 .` |
| One test | `node --test --test-name-pattern='<name>' 'test/unit/**/*.test.mjs'` or `npx playwright test -g '<name>'` |
| By test type | `npx playwright test --grep @integration` (also `@system`, `@e2e`, `@acceptance`, `@perf`, `@robustness`, `@smoke`); unit: `node --test --test-name-pattern='\[unit\]' 'test/unit/**/*.test.mjs'` |
| Traceability | `node scripts/trace.mjs` (writes `docs/testing/traceability.md`; `--check` verifies it) |

There is no build step and no type check: the product is the hand-written file itself.

## Structure

```
calc-viewer-builder.html   the product: builder (and source of every exported viewer file); modules in
                           <script type="text/plain"> blocks cv-core-src (pure logic), cv-ui-src, cv-3d-src,
                           cv-app-src, cv-viewer-guard, cv-viewer-bootstrap, plus the module script cv-builder
                           (CDN loading, IFC conversion)
scripts/                   check.mjs, serve.mjs, vendor-cdn.mjs (hash-locked jsDelivr cache for tests),
                           fetch-fixtures.mjs (large fixtures + synthetic 100 MB IFC), trace.mjs, fixture generators
test/                      unit/ (node:test on cv-core), integration/, e2e/, acceptance/, perf/ (Playwright specs and node:test files),
                           fixtures/ (small committed IFC and config files, manifest, reference-values.json), support/
docs/                      spec.md (requirements, design), tasks/, reviews/, testing/, release/, state.yaml,
                           open-questions.md, process-log.md
process/, AGENTS.md        the delivery process this project follows (kernel, calibration, guides, templates)
```

## Delivery process

The project is built with an AI-first delivery process (tier S, Lean track). Agents start with `AGENTS.md` and `process/kernel.md`; the state is in `docs/state.yaml`. Commands: `/start`, `/next`, `/status`, `/approve`, `/change`, `/rollback` (`process/commands/`). Changes to requirements or design go through `/change`.
