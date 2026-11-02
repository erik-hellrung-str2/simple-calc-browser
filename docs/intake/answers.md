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
| C02 | | | |
| C03 | see description | user | to confirm |
| C04 | browser, based on HTML Model Viewer | user | |
| C05 | IFC model(s), one or more | user | volume open |
| C06 | | | |
| C07 | | | |
| C08 | builds on `html-modelviewer` | user | how exactly — open |
| C09 | | | |
| C10 | HTML Model Viewer stack | user | |
| C11 | | | |

## Interview progress
- Last completed: C00
- Next: confirm understanding + core gaps round 1
