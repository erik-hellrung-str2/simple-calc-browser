---
status: approved
relates_to: [C00, C01, C02, C03, C04, C05, C06, C07, C08, C09, C10, C11, C99]
---
# Intake answers

Historic record of the intake (cycle 1). Not updated after the intake: later knowledge goes into requirements or change requests.

Source: `user` | `user-confirmed` | `inferred` | `delegated` | `unknown`.

## Description (C00, verbatim)
> Ich sende dir gleich eine Abbildung. Im Prinzip möchte ich ein simples Tool zum Durchforsten eines Modells (bzw. mehrerer Modelle). Es soll allgemeingültig sein - Auf der linken Seite sind frei wählbare Filtersätze (ähnlich wie bei PowerBI). Diese filtern die untenstehende Tabelle. In der Tabelle können die Spalten ausgewählt und angeordnet werden. Die Ansicht dort kann dann als CSV oder Excel exportiert werden. Die technische Grundlage ist dabei der HTML Model Viewer. Es soll links einen Filterbereich geben und rechts einen kleineren Bereich. In der Mitte das Modell und unterhalb die Tabelle. Die Tabelle kann ebenfalls Filter eingestellt werden (über die Spalte). Wenn in einem der Filter etwas angeklickt wird, dann filtert das das Modell in der Mitte und die Tabelle unterhalb. Werden mehrere Filter angeklickt, dann ist es eine UND Bedingungen. Es werden nur weitere Filter angezeigt, welche noch anklickbar sind (also die Kombination existiert)

## Material provided
- Screenshot (pasted in chat, 2026-11-02; not stored as a file): dark UI, title `The M Bouwkundig 2026-08-12` · `Hoeveelheden dashboard`.
  - Left `FILTERS`: stacked facet panels (`ifcType` 11, `storey` 51, `material` 309, `00_ARC_Bouwdelen` 17, `00_NL-SfB - Artikelnummers` 187, `Artikelnummer omschrijving` 169), each a scrollable checkbox list with colour dot and element count.
  - Centre: 3D model (IFC), controls `Elementen buiten filter: Verbergen`, `Kleur op: ifcType`, `Doorsnede` (section plane, axis Z, slider), colour legend.
  - Right: `ELEMENT-DETAILS` — "Klik op een element in het model voor details."
  - Bottom `OVERZICHT & SUBSELECTIE-TOTALEN`: group-by dropdown (`ifcType`), `Exporteer CSV`, grouped table with columns Aantal, Length (m), Thickness (m), Perimeter (m), Area (m²), Volume (m³), Area of Openings, Gross Area, Hoeveelheid (sums per group, sortable).
- Technical basis named by the user: HTML Model Viewer — repository `erik-hellrung-str2/html-modelviewer` (`ifc-viewer-builder.html`: browser builder that produces an offline single-file viewer, That Open Fragments + web-ifc + three.js; filter, element tools, colouring, X-ray).

## Follow-ups

| ID | Question | Answer | Source |
|---|---|---|---|
| F-03 | Export for colleagues | One self-contained offline HTML file (model + saved view embedded); filters/columns/grouping changeable inside, CSV/Excel export | user |
| F-04 | Save/load | Configuration file only (JSON: filter sets, columns, grouping); IFC is loaded anew each time | user |
| F-02 | Summary correct? | "Wie oben beschrieben - eine Gruppierungsansicht muss aber möglich sein. Hierzu darf man bis zu 2 Ebenen als Struktur auswählen. Ansonsten gibt es noch die Einzelelementansicht. In der Gruppierungsansicht darf man auch noch Einzelelemente anzeigen lassen. Da die Spalten frei wählbar sind, kann man sich das selbst zusammenbauen. Wichtig ist daher, dass man dies exportieren kann und auch speichern und laden. Export für Kollegen ohne näheres Verständnis und Export und Laden, um es zu aktualisieren / anzupassen. Es ist also eigentlich ein Calc Viewer Builder - wobei im exportierten Zustand die Filteranordnung und die Spaltenanordnung verändert werden darf (genauso wie Gruppierungsansicht usw.)" → normalized: table has (a) single-element view and (b) grouping view with up to 2 group levels, optionally expanding to single elements; columns freely chosen; configuration can be saved and loaded (to update/adapt); export for colleagues; in the exported file filter arrangement, column arrangement and grouping remain changeable | user |
| F-01 | (unprompted) role of the screenshot | "Nimm aus dem Bild nur die Struktur - die Farbgebung bleibt wie bei HTML Model Viewer" → screenshot = layout/structure reference only; colours/styling follow the HTML Model Viewer | user |

## Understanding (mirrored back to the user)
- Purpose: generic tool to explore one or more building models (IFC) through PowerBI-like facet filters, 3D view and a configurable, exportable table.
- Users/roles: open (C02).
- Main use cases: choose filter facets freely (any property); click values → AND across facets, filters model and table; facets show only still-possible values; table with selectable/orderable columns and column filters; export current view as CSV/Excel; element details on the right.
- Form factor: browser, built on the HTML Model Viewer.
- Notable: screenshot shows grouped quantity totals ("Hoeveelheden dashboard"), Dutch UI labels.

## Core

| ID | Answer | Source | Notes / follow-up |
|---|---|---|---|
| C01 | Calc Viewer Builder — browser tool that turns IFC models into a filterable 3D view with configurable quantity tables, exports them (CSV/Excel) and as offline HTML for colleagues | inferred (F-02 "Calc Viewer Builder") | name to be confirmed with the intake approval |
| C02 | Fachleute (BIM-Koordinatoren, Kalkulatoren, Projektbeteiligte); one role, no login; HTML file shared via mail/drive and opened locally. Second audience: "Kollegen ohne näheres Verständnis" who receive the export | user (option) + user (round-1 summary answer) | |
| C03 | Use cases 1–9 (FUN-01); out of scope for release 1: nothing explicitly named | user-confirmed | |
| C04 | New standalone browser app in this repo (`simple-calc-browser`), same stack as HTML Model Viewer; works as a "Calc Viewer Builder": produces an exported view for colleagues | user | |
| C05 | IFC model(s); several loaded together, "Modell" is its own filter/column/grouping property; no personal data stated | user | model size/volume open |
| C06 | None at runtime; IFC files as input; builder loads libraries from jsDelivr CDN (as html-modelviewer) | inferred (modelviewer-analysis.md) | |
| C07 | No login, no regulations; models up to ~100 MB, interactions < ~0.5 s (QLT-01) | inferred (C02) + user (QLT-01) | |
| C08 | New app, same stack as `html-modelviewer` (code/style reused, not the builder extended) | user | |
| C09 | Long-lived tool, used in daily work and developed further by the user; success = real projects (quantity overviews) built and shared; no fixed deadline | user | |
| C10 | HTML Model Viewer stack, plain JS single HTML file (STK-01) | user | |
| C11 | autonomous | user | |

## Topic: functional (depth M, boosted)

| ID | Answer | Source | Notes |
|---|---|---|---|
| FUN-01 | Use cases 1–9 as listed: (1) load several IFC, convert + index, "Modell" property; (2) configure filter sets (choose any property, order, remove); (3) filter model + table (OR within / AND between, hide impossible values); (4) model: hide/ghost outside filter, colour by property with legend, section plane; (5) table: single-element view and grouping view (≤ 2 levels, expandable to elements), choose/order columns, column filters, sort; (6) selection both ways: model click → details right + table row highlighted, table row click → element highlighted in model; (7) export current table view as CSV/Excel; (8) save/load configuration (filter sets, columns, grouping) as JSON; (9) offline HTML export for colleagues with models embedded, offering 2–7 but no IFC loading | user-confirmed | |
| FUN-04 | Must: UC 1, 2, 3, 5, 7, 8, 9 · Should: UC 4 (colouring, section), UC 6 (selection both ways); all planned for the first release | user-confirmed | |
| FUN-x4 | CSV export: semicolon separator, decimal comma, UTF-8 with BOM (German Excel); .xlsx stores real numbers | user-confirmed | |
| FUN-x3 | Group row: element count + sum of every numeric column; text columns empty or the value when uniform within the group | user-confirmed | |
| FUN-02 | Within one filter set several values = OR; between filter sets = AND | user (proposal) | |
| FUN-x1 | Facet values without hits in the current combination are hidden; counts recomputed under the other filters; sibling values in the own set stay visible | user (proposal) | |
| FUN-x2 | Elements outside the filter in 3D: switchable hide / ghost (X-ray), default ghost | user (proposal) | |

## Topic: ui (depth S, part A)

| ID | Answer | Source | Notes |
|---|---|---|---|
| UI-01 | One screen in the screenshot layout (filter sets left, model centre, element details right, table below); builder adds top bar `IFC laden`, `Konfiguration speichern`/`laden`, `HTML exportieren`; exported file same screen without IFC loading; desktop only, ≥ ~1280 px | user-confirmed | |
| UI-02 | Light HTML Model Viewer styling (red `#D72622`, ink `#35383A`, "Segoe UI"), German UI; screenshot = structure only (F-01) | user-confirmed | |

## Topic: stack (depth S)

| ID | Answer | Source | Notes |
|---|---|---|---|
| STK-01 | Like html-modelviewer: one hand-written HTML file, plain JS, no build step; That Open Fragments 3.4.7 / three / web-ifc; offline HTML export | user | chosen over TypeScript + Vite; tests still required (kernel) |

## Topic: data (depth S)

| ID | Answer | Source | Notes |
|---|---|---|---|
| DAT-01 | All IFC data selectable as filter set / column: attributes (Name, type, GUID …), all property sets and quantities (Qto) of the element and its type, storey, material, model; numbers parsed as numbers | user-confirmed | storey, material, type psets are new vs. html-modelviewer |

## Topic: quality (depth S)

| ID | Answer | Source | Notes |
|---|---|---|---|
| QLT-01 | Typical models up to ~100 MB IFC, several 10,000 elements, also several models together; filtering/table should feel instant (< ~0.5 s) | user-confirmed | |

## Closing (C99)
"Nein, das ist alles" + "Titel/Logo im Export" → project title, date and logo customizable in the exported file (as `The M Bouwkundig 2026-08-12`); nothing else. Priority not stated → ASM-002.

## Coverage

Required needs for tier S (XS+S; functional at M): 17 · covered: 17 · detail questions asked: 11 / ceiling 18

| Need ID | Status | Where |
|---|---|---|
| FUN-01 | confirmed | FUN-01 |
| FUN-02 | answered | FUN-02, FUN-x1, FUN-x2, FUN-x3 |
| FUN-03 | delegated (ASM-003) | acceptance examples derived in the spec |
| FUN-04 | confirmed | FUN-04 |
| FUN-05 | n/a — no objects with states; configuration files only | |
| FUN-06 | answered | filter/sort/column filters (FUN-01), exports (FUN-01, FUN-x4); no notifications, no administration (C02) |
| UI-01 | confirmed | UI-01 |
| UI-02 | answered | F-01, UI-02 |
| DAT-01 | confirmed | DAT-01; config JSON + embedded models (F-03, F-04) |
| INT-01 | inferred | C06 |
| INT-02 | inferred | IFC/files only; CDN fetch at build time, no auth |
| SEC-01 | n/a — no login, single role (C02) | |
| QLT-01 | confirmed | QLT-01 |
| STK-01 | answered | STK-01; xlsx writer → ASM-004 |
| BRF-01 | answered | C08: reuse code/style of html-modelviewer, that repo stays unchanged |
| BRF-02 | inferred, shown to user | modelviewer-analysis.md |
| C99 | answered | Closing |

## Tier
- Proposed M (11/30) → user chose **S** (lean). Detail questions asked: 11 / ceiling 18.

## Interview progress
- Last completed: C00
- Last completed: round 1 (summary, basis, users, autonomy)
- Last completed: round 2 (export, save/load, multiple models, lifetime)
- Last completed: closing C99 — interview complete
- Next: intake gate approval, then spec

## Change history

| Date | Change | By |
|---|---|---|
| 2026-11-02 | approved at intake gate | human |
