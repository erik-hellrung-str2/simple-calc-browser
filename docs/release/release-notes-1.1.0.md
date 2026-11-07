---
version: 1.1.0
date: 2026-11-07
status: released  # draft | approved | released
relates_to: [INC-2, CR-002, CR-003, REQ-003, REQ-004, REQ-005, REQ-006, REQ-007, REQ-008, REQ-009, REQ-010, REQ-012, REQ-013, NFR-001, NFR-002, NFR-003, NFR-004, NFR-005, DEC-15, DEC-18, DEC-19, DEC-20, DEC-21, DEC-22, BUG-T2, BUG-T4, BUG-T5, BUG-T6, BUG-T7, BUG-T8, BUG-T9, BUG-T10, BUG-T11, BUG-T12, BUG-T13, BUG-T14, Q-002, Q-005, Q-006, Q-007, T12, R-3]
---
# Release 1.1.0 — Calc Viewer Builder

Second release (delivery cycle 2, increment INC-2, change request CR-002 "Filter, Eigenschaften und 3D-Werkzeuge wie im HTML Model Viewer"). Release candidate: commit `08e0fc7` on `claude/keen-cori-j7ysfx` (`calc-viewer-builder.html` sha256 `055281aa318f4f94cf5795b319b0637491f5d7821fa1a518fb8014ce983a769e`). Released as tag `v1.1.0` after the human release gate of 2026-11-07 (the released `calc-viewer-builder.html` is unchanged since `08e0fc7`). Test basis: `docs/testing/report-INC-2.md` (recommendation **GO WITH DEVIATIONS**), `docs/reviews/verification-INC-2.md`, `docs/tasks/TASK-011a.md` … `TASK-021.md`, and the regression and perf runs on `08e0fc7` (Test summary below). Release gate outcome (approved 2026-11-07): `docs/release/decisions-to-confirm-1.1.0.md` → Approval.

## Highlights
- **The 3D view works like the HTML Model Viewer.** A round toolbar at the bottom of the 3D view has `Fokus`, `Filter` and `Färben`. A click on an element opens a menu at the click point with `Ausblenden`, `Isolieren` and `Schneiden`, and a floating properties panel at the top right.
- **Advanced filter.** The new filter panel has the search field `Suchen nach Objekten` and rules built in the dialog `Filter bearbeiten`: action `Isolieren` / `Ausblenden` / `Markieren` / `Freie Textsuche`, comparison `Gleich` / `Beginnt mit` / `Endet mit` / `Enthält`. "Does not contain" is `Ausblenden` with `Enthält`. The left filter sets stay, and every filter combines with AND.
- **`Ausblenden` and `Isolieren` act as filters.** Hidden and isolated elements leave the 3D view, the table, the counts, the sums and the CSV / Excel export. `Schneiden` changes only the 3D image.
- **More room.** The right column `Element-Details` is gone. The 3D view and the table reach the right edge of the window.
- **Compatible.** Configuration files stay `calc-viewer-config/1`. Files saved by 1.0.0 load, and their X/Y/Z section is converted. Viewer files exported with 1.0.0 keep working.

## Features (what changed for the user)
| REQ | Change in 1.1.0 (as built) |
|---|---|
| REQ-005 3D view | Toolbar `3D-Werkzeuge` at the bottom centre with `Fokus`, `Filter`, `Färben` (pressed while its panel is open; `Filter` and `Färben` show a red dot while a rule or search, or colouring, is active). A hint pill `Ziehen: drehen · Rechts ziehen: verschieben · Mausrad: zoomen · Klick: Eigenschaften und Werkzeuge` fades after 6 s; a title chip at the top left shows the title (and `<n> Modelle` with several models). `Fokus` fits the camera to the elements shown opaque (ghosts do not count; no opaque element: all models); with panels open it fits into the free part of the view (TASK-021, user decision Q-005). Elements outside the filter are ghosts by default; the ghost toggle `Ausgeblendete verbergen` / `Ausgeblendete anzeigen` sits in the pill `Filter entfernen`. **Removed:** `Ansicht einpassen`, the switch `Elemente außerhalb des Filters`, `Färben nach` with the legend under the model, and the X/Y/Z `Schnitt` with slider and `Schnitt umkehren`. |
| REQ-005 colouring (DEC-15 changed) | `Färben` opens a panel: property list with `Parameter suchen`, then the mode `Unterschiedliche Farben` or `Farbskala` with the swatches `Rot`, `Blau`, `Grün`, `Orange`, `Violett`, `Grau` and `Eigene Farbe`, a gradient bar, and the legend in the panel (values of the shown elements with counts, at most 200 rows, then `+<n> weitere Werte`). More than 120 distinct values: colours repeat, with the note `Mehr als 120 Werte: Farben wiederholen sich.` (the 1.0.0 `Sonstige` is gone). `mehrere Werte` and `(leer)` keep their colours. Pill `Einfärbung entfernen`. |
| REQ-012 rule filter (new) | `Filter` opens the panel with `Suchen nach Objekten` (any property value contains the text, case-insensitive, 250 ms after the last key), the rule list, `+ Filter hinzufügen`, `Zurücksetzen` (rules and search only) and the status `<X> von <Y> Objekten sichtbar`. Rules compare the displayed text (German numbers such as `0,3`, `Ja` / `Nein`); an element without the property never matches. A rule row reads e.g. `Isolieren: Kategorie enthält „wall“`; click it to edit, × `Filter entfernen` to remove it. `Markieren` paints matching elements `#F08A87` without removing anything. A rule whose property is no longer loaded shows `Eigenschaft nicht geladen` and is not applied. |
| REQ-013 element tools (new) | Click menu at the click point: `Ausblenden`, `Isolieren`, `Schneiden`, `Menü schließen`. The first `Isolieren` starts a new isolation, further ones add to it. `Schneiden` cuts at the clicked face (horizontal or vertical plane) with a handle `Schnitt verschieben` (drag, or arrow keys when focused; `Shift` for bigger steps). Pills at the bottom right, top to bottom: `Filter entfernen`, `Einfärbung entfernen`, `Isolierung entfernen`, `Ausblendung entfernen`, `Schnitt entfernen`. Hidden and isolated elements are session only. |
| REQ-004 filter area | `Alle Filter zurücksetzen` and the pill `Filter entfernen` clear every filter source: ticks, column filters, rules (incl. `Markieren`), search, hidden and isolated elements (user answer Q9). New entries above the filter sets: `Ausgeblendet: <n> Element(e)`, `Isoliert: <n> Element(e)`, `Filterregeln: <n>`, `Suche: „…“`, each with ×. Filter-set counts follow rules, search, hide and isolate. |
| REQ-003 / REQ-007 properties | The floating properties panel (kicker `Kategorie`, title `Name`, model chip, buttons `Ausblenden` / `Isolieren`, `Schließen`) opens on a 3D click or a table row; a group row shows `<n> Elemente ausgewählt`. Row tools: `Nach Wert filtern` ticks the value in the matching left filter set (adds the set if missing); `Farbe nach Wert` colours by that property. Long values (GlobalId) wrap inside the panel (BUG-T2 closed). `Esc` closes, in this order: dialog or popup, click menu, selection with its panel, `Filter` / `Färben` panel. |
| REQ-006 / REQ-008 table and export | Table at full width (header, stripes and selection to the right edge). Counts, sums, `Summe`, the status line `X von Y Elementen` and CSV / Excel follow rules, search, hide and isolate; `Markieren` and `Schneiden` do not change them. |
| REQ-009 configuration | New optional fields `filterRules`, `search`, `display.colourMode`, `display.scaleColour`, `display.sectionPlane` (DEC-20). Hidden and isolated elements are never saved; loading a configuration clears them. New notice labels for invalid parts: `Filterregeln`, `Filterregel`, `Suche`, `Farbmodus`, `Skalenfarbe`; the existing 1.0.0 label `Schnitt` now also covers an invalid `display.sectionPlane`. |
| REQ-010 viewer file | Exported viewer files offer the toolbar, filter panel, rules, colouring panel, click menu, properties panel, hide / isolate and section, starting from the exported rules, search, colouring and section (no hidden or isolated elements). Still offline with zero network requests. |
| UI layout | Below 1280 px only the filter area is a drawer (header button `Filter`; the `Details` drawer is gone). Panels, menu and pills stay inside the 3D view down to 1024 px and do not overlap; with little room the pills show icons only. |

## Fixes
| BUG | Description |
|---|---|
| BUG-T2 (trivial, 1.0.0) | Long values such as a GlobalId broke mid-word in `Element-Details`. Closed: in the new properties panel every value wraps within the panel (`REQ-007-AC6`, `test/e2e/properties-panel.spec.mjs`). |
| BUG-T4 (1.0.0, test / environment) | `test/perf/nfr-001.spec.mjs` was red on software rendering. Not reproduced in 1.1.0: last changed frame 233.0–331.2 ms (highest single run 370 ms), target ≤ 500 ms. |
| BUG-T5 (major) | Properties panel: a very long `Name` pushed `Ausblenden` / `Isolieren` and the property list out of the panel. Title clamped to 3 lines, kicker and chip to 2, full text as tooltip. |
| BUG-T6 (minor) | Table header, stripes and selection ended at the last column instead of the right edge. |
| BUG-T7 (minor) | The click menu card covered the properties panel. The card now moves sideways until it clears every panel. |
| BUG-T8 (minor) | A very long value made a colouring legend row about 1,900 px tall. Clamped to 3 lines. |
| BUG-T9 (minor) | A rule row or filter-area entry with a huge value had no length limit. Clamped to 3 lines; the dialog keeps the full value. |
| BUG-T10 (minor) | `Esc` with the `Eigenschaft` suggestion list open closed the whole dialog `Filter bearbeiten`. The first `Esc` now closes only the list. |
| BUG-T11 (minor) | At 1280 × 800 open panels could cover the model. `Fokus` now fits the model into the part of the 3D view the open panels leave free (user decision Q-005, TASK-021); `Isolieren` keeps the camera, as in the reference. |
| BUG-T14 (test) | Flaky timing in the `REQ-013-AC1` test (1 failure in 25 runs); fixed in the test, tolerance unchanged. |

Found and fixed during the INC-2 verification before testing (`docs/reviews/verification-INC-2.md`): help texts styled as the 3D hint pill (UX-1, major), flat 3D background instead of the reference gradient (UX-6), filter panel status stuck at `Eigenschaften werden gelesen ... 100 %` after a model change (CODE-1), an overflowing `sectionPlane` normal dropped silently (CODE-3), rule rows rebuilt on every interaction (CODE-2, partly).

## Changes
| CR | Category | Description | Version effect |
|---|---|---|---|
| CR-002 | normal, feature | In-viewer toolbar, rule filter, properties panel, element tools `Ausblenden` / `Isolieren` / `Schneiden`, colouring modes; right details column removed; table at full width. Approved by the user 2026-11-04 (answers Q1–Q10, `docs/changes/CR-002.md` §1a). | minor (1.1.0) |
| CR-003 | documentation sync | Spec §4.4 names the test seam `CalcView.contextState()`; spec §4.2 and `AGENTS.md` list `test/acceptance` and `test/support`; the spec wording of the synchronous display-text index build (§4.3, NFR-001; SYNC-1) and of the property order (REQ-012 suggestions, colouring list) follows the built behaviour. Text only; approved at the release gate 2026-11-07 and applied (`docs/changes/CR-003.md`). | none |

## Compatibility and upgrade notes
- **Configuration files** keep `schema: "calc-viewer-config/1"`. 1.1.0 adds optional fields only (DEC-20).
- **1.0.0 configuration in 1.1.0:** loads without a notice for the new fields. Its X/Y/Z section (`display.section`) is converted to the equivalent plane (e.g. Z at height h → point `[0, 0, h]`, normal `[0, 0, -1]`; `flipped` → normal `[0, 0, 1]`). A numeric `colourBy` without `colourMode` keeps the 1.0.0 look (`Farbskala`, `Blau`). Active rules and search are cleared, because the file has none. 1.1.0 writes `display.sectionPlane` and no longer writes `display.section`.
- **1.1.0 configuration in 1.0.0** (rollback): loads with a notice that names `filterRules`, `search`, `display.colourMode`, `display.scaleColour` and `display.sectionPlane` as skipped. Rules and search are lost there, so more elements are shown, and there is no section (tested against tag `v1.0.0`, `REQ-009-AC7`).
- **Viewer files exported with 1.0.0** keep their embedded 1.0.0 runtime and look. Viewer files exported with 1.1.0 have the new UI.
- **Hidden and isolated elements** are never saved in a configuration or a viewer file.
- **Removed controls:** `Ansicht einpassen` → `Fokus`; `Elemente außerhalb des Filters` → ghost toggle in the pill `Filter entfernen`; `Färben nach` → `Färben`; X/Y/Z `Schnitt` → `Schneiden` in the click menu; `Element-Details` → floating properties panel.

## Known issues, limitations and deviations
- **Release gate 2026-11-07:** blocks A–E approved as proposed; the known limitations and deviations below were accepted; the manual checks F.1–F.5 stay open (see the last item).
- **NFR-001 on PCs without a GPU (Q-002 deviation, unchanged, accepted at the release gate).** The last changed 3D frame meets ≤ 500 ms in every case, but on software WebGL the pixels reach the screen 0.73–1.24 s after the input. On a GPU this was **not measured** (manual check T12, F.2).
- **`Farbskala` labels (BUG-T12, known limitation, user decision Q-006 `So lassen`):** the scale and its first / last label span all elements, so colours stay stable while filtering; with a narrow filter the labels can name values no shown element has.
- **Configuration section far outside the models (BUG-T13, known limitation, user decision Q-007 `Akzeptieren`):** applied as given; the 3D view can look empty and the handle is off-screen. `Schnitt entfernen` fixes it in one click.
- **Section after removing its model (C.10, known limitation, user decision `So lassen` at the release gate):** a section stays while another model is still loaded and is cleared with the last model; the remaining model may look cut or empty. `Schnitt entfernen` fixes it in one click.
- **Many rules:** filter evaluation is linear in the number of rules (about 78 ms per interaction with 20,000 rules); only hand-made configuration files reach such counts (CODE-2).
- **Display-text index without progress text** on a model change, IfcSpace switch, configuration load or viewer start with an active search or `Freie Textsuche` (SYNC-1). Measured over the INC-2 test runs and the release perf run: the IfcSpace switch with an active search takes 439–663 ms for the filter step and 652 ms to 1.7 s until the 3D frame at 30,931 elements (release run on `08e0fc7`: 439 ms, frame 652 / 785 ms), within the 2 s index target.
- **Creating a section is pointer-only** (DEC-21; TASK-019 decision 6). The handle and `Schnitt entfernen` work by keyboard.
- **`Isolieren` does not move the camera** (as the reference; Q-005 clarified). Use `Fokus`.
- **Not supported by design (CR-002 §3, user answer Q2):** comparisons other than `Gleich`, `Beginnt mit`, `Endet mit`, `Enthält` (no `enthält nicht`, `ungleich`, `ist leer`, `<` / `>`); OR between rules; `Kategorie` / `Datei` chips in the filter panel; a 3D `Räume` button; more than one section plane.
- **Colour `Rot` in `Farbskala`:** the largest value gets the selection red `#D72622`, as in the reference (DEC-15).
- **Carried over from 1.0.0:** the builder needs internet access to `cdn.jsdelivr.net` and offline stops at start with the browser's English text `Failed to fetch`; `.xlsx` read back with openpyxl and LibreOffice only, not Microsoft Excel (R-3); headless Chromium names downloads with non-ASCII titles `download` (real Chrome / Edge not checked); only headless Chromium is tested automatically (T12 manual smoke in Chrome, Edge, Firefox best effort still open, F.1).
- **Small models:** the viewer file of a small model is about 58–62 % of its IFC size (fixed runtime); the 40 % target applies from 100 MB of IFC.
- **Open manual checks (released with them open, release gate F.1–F.5):** F.1 T12 smoke in current Chrome and Edge (Firefox best effort); F.2 GPU measurement of NFR-001; F.3 R-3 exported `.xlsx` in Microsoft Excel; F.4 download names with umlauts in real Chrome / Edge; F.5 T14 charter with real project files (ASM-003).

## Test summary
Release candidate `08e0fc7`, working tree clean, nothing committed during testing. Machine: Intel Xeon 2.10 GHz, 4 cores, 17 GB RAM, no GPU (SwiftShader software WebGL); Node 22.23.4, Playwright 1.63, headless Chromium 153.0.8010.12.

**Regression (all suites except perf):**

| Part | Result |
|---|---|
| `node scripts/check.mjs` (format, lint, CDN cache, unit with c8, `@integration` on http) | green in 72.9 s; unit 185 / 0 / 0; coverage 99.85 % lines, 94.47 % branches (gate 70 %); `@integration` 29 / 0 / 0 |
| `node scripts/trace.mjs --check` | current (100 of 100 active ACs and 5 of 5 NFRs with a test) |
| Playwright, 42 spec files, each run separately, both projects | file **227 / 0 / 0**, http **225 / 0 / 2** (pass / fail / skip) |
| of which `test/acceptance` / `test/integration` / `test/e2e` | file 5 / 30 / 192, http 5 / 30 / 190 (+ 2 skipped) |

The two skips are deliberate project guards: `test/e2e/system.spec.mjs:18` (the `file://` copy-alone test, meaningful only on the file project, where it passed) and `test/e2e/volume-robustness.spec.mjs:16` (heavy test run once by design on the file project, passed). No failures, no flaky tests, nothing re-run.

**Performance (`file` project, `--workers=1`, median of 3; 18 Playwright tests and 3 Node perf tests, all passed):**

| NFR / case | Target | Measured on `08e0fc7` | Met |
|---|---|---|---|
| 001 filter sets, `Name` / `GlobalId` sets, column filter (3D frame), 30,931 elements | ≤ 500 ms | 233.0–331.2 ms (highest single run 370) | yes |
| 001 sort, view switch, regroup, `Name` checklist; grouping | ≤ 500 ms | 2.1–17.3 ms; grouping 4.5–33.4 ms, frame ≤ 44.9 ms | yes |
| 001 CR-002: search, rule `Name` and `Freie Textsuche`, `Ausblenden` / `Isolieren` and their pills, `Alle Filter zurücksetzen` | ≤ 500 ms | 12.8–298.8 ms (highest single run 345.2) | yes |
| 001 display-text index, volume set | ≤ 2 s, ≤ 150 MB extra | 284.4 ms, +10.3 MB (text-index spec: 213 ms, +10.1 MB; all loaded 236 ms, +11.2 MB) | yes |
| 001 index, SampleCastle (6,106 properties) | recorded, no crash | 127 ms, +3.2 MB, RSS 917 MB | yes |
| 001 3D frames view-3d / view-3d-volume | ≤ 500 ms | 149.1–196.1 ms / 242.1–296.5 ms (highest single run 393) | yes |
| 001 selection row / group | ≤ 500 ms | 168.7 / 174.2 ms | yes |
| 001 table scroll render, sort, column filter | ≤ 500 ms | 0.5–0.7 ms, ≤ 43.7 ms, frame 37.5 ms | yes |
| 001 pixels on screen (recorded only) | – | 0.73–1.24 s | deviation (Q-002) |
| 001 IfcSpace switch with active search (SYNC-1, recorded) | index ≤ 2 s | filter 439.5 / 438.8 ms, frame 651.7 / 784.5 ms | within the index bound |
| 002 single file 151.8 MB / multi-model 127.7 MB | ≤ 60 s per 100 MB, no crash | 22.9 / 28.8 s per 100 MB; RSS ≤ 1,876 / 1,888 MB | yes |
| 003 viewer file size / start | ≤ 40 % / usable ≤ 15 s | 14.9 % (volume set), 13.6 % (synthetic); start 6.7 s, with search and `Freie Textsuche` 7.0 s (8.1 s until the toolbar responds), synthetic 4.4 s | yes |
| 004 export 30,931 × 20 | ≤ 5 s, no block > 1 s | CSV 231 ms, XLSX 398 ms, grouped 262 / 462 ms; longest task 102 ms | yes |
| 005 viewer offline | 0 requests | 0 requests, 0 blocked, 0 errors in 15 viewer opens | yes |

Node perf tests: TASK-003 filter pass 6.54 ms warm (≤ 50 ms); rule `Enthält` on `Name` 1.85 ms, search 11.84 ms, `Freie Textsuche` 12.07 ms, index build 445.68 ms with +14.08 MB; Node CSV / XLSX writers 386 / 1,233 ms (≤ 5 s).

Compared with 1.0.0: NFR-002 is faster (22.9 against 33.5 s per 100 MB), the 1.0.0 NFR-001 red frame (BUG-T4) is gone, NFR-003 viewer start is faster (6.7 against 9.8 s). Compared with the INC-2 test report, selection is about 20–35 ms slower and pixels on screen up to 1.24 s (was 1.00 s), all within target or recorded only.

Exploratory and acceptance (`docs/testing/report-INC-2.md` §5): the requesting-user journey on FZK and Duplex, exports read back with openpyxl, configuration round trip, an exported viewer offline; a break session for XSS, hostile configurations, races, keyboard and 12 window widths from 1024 to 1920 px.

## Deployment steps
The product is the single file `calc-viewer-builder.html`. There is no server, build or installation.
1. After the release gate (approved 2026-11-07): commit the release documents and tag the release commit `v1.1.0`. `calc-viewer-builder.html` must equal the tested file (sha256 above).
2. Take `calc-viewer-builder.html` from tag `v1.1.0` and hand it to the authors (shared drive, e-mail, intranet page); optionally record its SHA-256.
3. Authors open it by double-click in current Chrome or Edge. As in 1.0.0 the builder needs **internet access to `https://cdn.jsdelivr.net`** at every start (`@thatopen/fragments@3.4.7`, `three@0.185.1`, `web-ifc@0.0.77`, version drift guard unchanged). IFC data never leaves the computer.
4. Keep the 1.0.0 file available for rollback (`docs/release/runbook.md` → Rollback).
5. Viewer files exported with `HTML exportieren` are fully offline (NFR-005). Files exported with 1.0.0 do not need to be re-exported.
6. Production use starts only on the user's explicit decision after the release gate.

## Rollback
1. Restore the 1.0.0 builder: `git checkout v1.0.0 -- calc-viewer-builder.html` (identical to the file at tag `pre-CR-002`), and hand it out again. Nothing is installed or stored, so no clean-up is needed.
2. Configurations saved by 1.1.0 still load in 1.0.0, with a notice naming the skipped fields; rules, search and section are lost there (Compatibility above).
3. Viewer files exported with 1.0.0 or 1.1.0 are self-contained and keep working.
4. In the repository, CR-002 is undone by reverting the cycle-2 commits back to tag `pre-CR-002` (CR-002 §7); after the release a revert ships as 1.1.1 with smoke and regression.
