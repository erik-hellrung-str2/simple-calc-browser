---
status: draft
relates_to: [C00]
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
| C01 | | | |
| C02 | Fachleute (BIM-Koordinatoren, Kalkulatoren, Projektbeteiligte); one role, no login; HTML file shared via mail/drive and opened locally. Second audience: "Kollegen ohne näheres Verständnis" who receive the export | user (option) + user (round-1 summary answer) | |
| C03 | see description | user | to confirm |
| C04 | New standalone browser app in this repo (`simple-calc-browser`), same stack as HTML Model Viewer; works as a "Calc Viewer Builder": produces an exported view for colleagues | user | |
| C05 | IFC model(s), one or more | user | volume open |
| C06 | | | |
| C07 | | | |
| C08 | New app, same stack as `html-modelviewer` (code/style reused, not the builder extended) | user | |
| C09 | | | |
| C10 | HTML Model Viewer stack | user | |
| C11 | autonomous | user | |

## Interview progress
- Last completed: C00
- Last completed: round 1 (summary, basis, users, autonomy)
- Next: analyse html-modelviewer, then round 2 (export form, data, scope, lifetime)
