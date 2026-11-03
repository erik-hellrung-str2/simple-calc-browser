# Calc Viewer Builder

A browser tool for BIM specialists to explore one or more IFC models like a report: filter sets narrow down the 3D model and a configurable quantity table; the table exports to CSV and Excel; the whole view can be saved as a configuration and handed to colleagues as **one offline HTML file** they can still filter, group and export.

Version 1.0.0 (release candidate, release gate pending) — see `CHANGELOG.md` and `docs/release/release-notes-1.0.0.md`.

## Use it

1. Open `calc-viewer-builder.html` by double-click in current Chrome or Edge (Firefox best effort). No installation, no server. The builder needs internet access to `cdn.jsdelivr.net` to load its libraries at start; IFC data stays on your computer.
2. `IFC laden` (or drop `.ifc` files on the page) — IFC2X3 and IFC4, several models at once.
3. Build the view: `+ Filtersatz`, `Spalten`, `Einzelelemente` / `Gruppiert`, `Färben nach`, `Schnitt`; title, date and logo via the pencil button.
4. Export: `Export CSV`, `Export Excel`, `Konfiguration speichern` (JSON, reload with `Konfiguration laden`), `HTML exportieren` (offline viewer file for colleagues; works by double-click without internet).

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
