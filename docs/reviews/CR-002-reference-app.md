---
status: final
date: 2026-11-04
relates_to: [CR-002]
---
# CR-002 analysis: reference-app (fresh context, 2026-11-04)

# Reference "HTML Model Viewer": filter, toolbar, element menu and properties, with screenshots

Everything below was checked against `/home/user/html-modelviewer/ifc-viewer-builder.html`. Line numbers are given as ref L<n>. The viewer runtime is the `tov-viewer-src` module (ref L199-1665), and its CSS is `tov-viewer-css` (ref L1714-1931). All UI text is German, written with `\u00e4`-style escapes. No repository file was changed.

Three findings from the code matter most for the request:
- **No "enthält nicht" or advanced mode.** The reference offers only four text operators, and there is no separate advanced filter mode (section 1).
- **No "Fokus" button.** The closest control is "Modell einpassen" (section 2).
- **Schneiden is already separate.** Ausblenden and Isolieren already change the filter's visible count, and Schneiden does not, as the user asked (section 3).

## 1. Filter

### Where it sits
- The `Filter` button (funnel icon, aria-label "Filter") is the second-to-last button in the round toolbar at the bottom centre of the 3D view (ref L1317-1318).
- Clicking it opens a floating glass panel `.tov-panel.tov-filter-panel` above the toolbar. It is centred, 80px from the bottom, `min(380px, 100%-32px)` wide and at most `100%-112px` high (ref L1766).
- The filter button toggles the panel. While open, the button is filled red (`.tov-active`). Opening the filter panel closes the colouring panel, and the other way round (ref L1451-1458, L1655).
- The first opening builds the property index lazily. The status line shows "Eigenschaften werden gelesen ... N %", and the controls stay disabled until the index is ready (ref L1379-1384, L1435-1449).

### Panel contents, top to bottom (ref L1319-1347)
1. **Header:** the kicker "FILTER" in red uppercase 11px. A red link "Zurücksetzen" sits on the right and shows only while a filter is active (ref L1322-1324, L1411).
2. **Search field** "Suchen nach Objekten" (ref L1326):
   - Free-text search, debounced by 250ms (ref L1461-1468).
   - Matches case-insensitive "contains" against all indexed property values joined together (`haystack`, ref L435, L1209).
3. **Chip row:**
   - "Datei" appears only when there is more than one model (ref L1337).
   - "Kategorie" (ref L1338) opens a checklist dialog of 360px with:
     - a search field "Suche";
     - "Alle wählen";
     - one row per IFC class with its count, e.g. "IFCWALLSTANDARDCASE (13)", or "(ohne Kategorie)" when empty;
     - the buttons "Abbrechen" and "OK" (ref L607-646, L1480-1491).
   - An active chip turns red with a tint and reads "Kategorie (n)" (ref L1386-1389, L1813).
   - Values inside one chip combine with OR. The counts are totals over all models and ignore the other active filters (ref L1482).
4. **Rule list:** one row per rule, styled as a grey rounded bar.
   - Each row reads mode (red, bold) + ":" + the description, e.g. `Isolieren: Kategorie enthält „wall“` (ref L458-463, L1394-1410).
   - Clicking the text opens the edit dialog again. The X ("Filter entfernen") removes the rule.
5. **"+ Filter hinzufügen"**, a red link (ref L1340-1343).
6. **Status line** "X von Y Objekten sichtbar" in de-DE number format (ref L1424).

### Rule dialog "Filter bearbeiten"
This is the only "advanced" filter the reference has; there is no separate advanced mode (ref L654-740).
- It is a modal dialog 860px wide, titled "Filter bearbeiten", with the buttons "Abbrechen" and "Anwenden" (red, primary).
- It has one row of four controls on the grid `150px | 1fr | 140px | 1fr` (ref L1910). Below 700px the grid becomes two columns (ref L1924).

The four controls:
- **(a) Aktion** (a select, `FILTER_MODES`, ref L224):

  | Label | What it does |
  |---|---|
  | `Isolieren` | Only matching elements stay visible (ref L1211). |
  | `Ausblenden` | Matching elements are hidden. This works as the negation (ref L1212). |
  | `Markieren` | Matching elements are painted in `#F08A87` and nothing is hidden (ref L218, L1243). |
  | `Freie Textsuche` | The operator is applied to any property; the Eigenschaft field is disabled (ref L450-452, L713-716). |

- **(b) Eigenschaft**, a text input with its own suggestion list (combobox):
  - Each suggestion shows the property label and, in grey 11px below it, the group, which is the Pset name or empty for attributes.
  - It shows at most 50 entries plus "+N mehr" (ref L694-709, L220).
  - Entries are sorted by group, then label.
  - Attribute labels map `_category` to "Kategorie" and `_guid` to "GUID" (ref L223).
- **(c) Vergleich** (a select, `FILTER_OPERATORS`, ref L225). This is the complete list:
  - `Gleich` (eq)
  - `Beginnt mit` (starts)
  - `Endet mit` (ends)
  - `Enthält` (contains, the default)
- **(d) Wert**, a text input with an HTML datalist of up to 200 distinct values of the chosen property (ref L670-686, L1291-1303, L221).

Validation:
- A missing property or an empty value marks the field red (`.tov-invalid`, background `#fdf3f2`) and the dialog stays open (ref L726-738).
- A typed property label that matches exactly is accepted (ref L728-732).

What the reference does not have:
- The operators "enthält nicht", "ungleich", "größer", "kleiner", "zwischen", "ist leer" and "ist nicht leer".
- Numeric comparison. All comparisons are case-insensitive string comparisons (ref L440-445), and values are formatted strings rounded to 4 decimals (ref L290-296).
- Separate operator sets for text and numbers.
- OR between rules, and rule groups.

### How conditions combine
`itemPasses` (ref L1207-1215) is an AND over:
- the category set (OR inside);
- the search text;
- every Isolieren and Freie-Textsuche rule (each must match);
- every Ausblenden rule (each must not match).

The Datei chip toggles whole models through `model.object.visible` (ref L1224-1225). Markieren rules only paint; their paint takes priority over the colouring (ref L1228, L1243).

### Effect in 3D (ref L1218-1267)
- Elements that fail the filter are hidden with `setVisible(false)`.
- **X-ray toggle:** a cube icon, labelled "Ausgeblendete anzeigen" / "Ausgeblendete verbergen", sits in the filter pill.
  - When on, filtered-out elements stay visible as ghosts: `#A4A8AC`, opacity 0.12, one-sided, `depthWrite` false (ref L239-241, L1185-1191, L1236-1240, L1359-1375).
  - Ghosts cannot be picked (ref L954).
- If the selected element becomes hidden or ghosted, the selection is cleared (ref L1259-1263).
- There is no list or table in the reference. The only list-like outputs are the counts.

### Bottom-right pill "Filter entfernen"
- It is visible only while a filter is active (ref L1350-1376, L1413).
- Left to right it has: the X-ray toggle; "Filter entfernen" (red funnel icon), which resets everything; and a chevron "Filter anzeigen", which opens the panel again (ref L1504-1506).

### Shortcut from the properties panel
- Hovering a property row shows the icons "Nach Wert filtern" and "Farbe nach Wert" (ref L310-321, L1776-1778).
- "Nach Wert filtern" adds the rule `{mode:"isolate", key, op:"eq", value}`, skipping duplicates (ref L917-922).
- "Farbe nach Wert" starts colouring by that property (ref L923).

## 2. In-viewer toolbar ("Fokus / Filter / Färben")

### The bar itself
- `.tov-bar`, round, at the bottom centre 20px from the bottom (ref L1748).
- Glass `rgba(255,255,255,.86)` with `backdrop-filter: blur(12px)`, padding 6px, gap 4px, border `1px rgba(255,255,255,.6)`, and the `--tov-shadow` shadow.
- Buttons `.tov-icon-btn` (ref L1749-1752):
  - 40×40px, round, icon colour `#4E5355`.
  - Hover: red icon on `rgba(53,56,58,.08)`.
  - Active: red fill `#D72622` with a white icon.
  - Focus outline: 2px red.
- When a filter or colouring is active, a red 8px dot with a white ring appears at the top right of the button (`.tov-has-filter`, ref L1886-1887).
- Icons are inline SVG, 20px, stroke `currentColor` 1.8, round line caps (ref L254-268).

### Buttons, left to right

| Button (title / aria-label) | Icon | What it does |
|---|---|---|
| `Modell einpassen` | `fit`: corner brackets + small square (ref L256) | Fits the camera to all visible models along the view direction (1,0.75,1) with padding 1.15 (ref L820-847, L879-881). It ignores hidden or isolated elements and fits whole-model boxes. There is no "Fokus" label anywhere; this is the closest match. |
| `Räume ein-/ausblenden` | `spaces`: cube (ref L257) | Shown only if IfcSpace was exported (ref L1305-1314). It toggles spaces and is active (red) while spaces are visible. |
| `Filter` | `filter`: funnel (ref L258) | Opens or closes the filter panel (section 1). |
| `Einfärben` | `palette` (ref L266) | Opens or closes the colouring panel. |

### Colouring panel "Einfärben"
- Same panel class and position as the filter panel (ref L1509-1522).
- **Header:** the kicker "EINFÄRBEN" and a red link "Entfernen", shown only while colouring is active (ref L1514-1516, L1634).
- **Step 1, choose a property:**
  - Search field "Parameter suchen" plus the list of all properties (label + Pset group).
  - The current choice is tinted red.
  - With no match: "Kein Parameter gefunden" (ref L1543-1559).
- **Step 2, legend view** (ref L1561-1631):
  - A property button showing the label and Pset, plus a red "Ändern" to go back to the list.
  - A segmented control "Unterschiedliche Farben" | "Farbskala" (ref L232).
    - **Unterschiedliche Farben:** golden-angle HSL colours; above 120 values they repeat, with the note "Mehr als 120 Werte: Farben wiederholen sich." (ref L484-489, L1627-1629).
    - **Farbskala:** swatches Rot `#D72622`, Blau `#1F6FD1`, Grün `#2E9B4F`, Orange `#E8890C`, Violett `#7B3FB5`, Grau `#4E5355`, plus "Eigene Farbe" (a colour picker). Below them a gradient bar labelled with the minimum and maximum value. The scale has 24 steps and a minimum strength of 12% (ref L233-235, L478-482, L1586-1614).
  - The legend lists one row per value: a 14px swatch, the value, and the count. It shows at most 200 rows, then "+N weitere Werte" or "Keine Werte vorhanden" (ref L1616-1625).
  - Values sort numerically when all of them are numbers, otherwise by German locale with numeric order (ref L504-506).
- Spaces are coloured at opacity 0.55 (ref L237).
- **Pill:** "Einfärbung entfernen" plus a chevron "Einfärben anzeigen", placed below the filter pill (ref L1524-1531, L1662).

### Other overlays
- **Title chip** at the top left: 3px red left border, radius `4px 12px 12px 4px`, 14px/600 text; with several models it adds "N Modelle" (ref L865-870, L1739-1741).
- **Hint pill** above the toolbar: "Ziehen: drehen · Rechts ziehen: verschieben · Mausrad: zoomen · Klick: Eigenschaften und Werkzeuge". It fades after 6s or on the first pointerdown (ref L872-876, L1744).

## 3. Clicking an element

### What counts as a click
- Left button, with at most 4px of movement between pointerdown and pointerup (ref L207, L968-977).
- The pick casts a ray through all visible models, skips ghosts, and takes the nearest hit (ref L945-966).
- Clicking empty space clears the selection, which closes both the menu and the panel (ref L959-960, L898-910).
- There is no Esc handler for the menu or the panel.

### What appears
1. The element is highlighted solid `#D72622` (ref L205, L888-893).
2. **Element menu at the clicked point** (`.tov-pick`, ref L985-1003, L1864-1877):
   - A white card with radius 12px, padding 6px and `--tov-shadow`, centred 20px above the point, with a 10px rotated-square arrow.
   - A red dot, 18px with a 3px white border, marks the clicked point.
   - The menu follows the point every frame. It flips below the point when it is closer than 110px to the top (ref L230, L1055-1061, L1869-1870).
   - Three buttons `.tov-pick-btn`, each a 22px icon over a 12px label, min-width 76px, colour `#4E5355`, hover red on `rgba(215,38,34,.08)`:
     - **Ausblenden** (`hide`: four squares, the last one dashed)
     - **Isolieren** (`isolate`: one square solid, three at opacity 0.35)
     - **Schneiden** (`scissors`)
   - A 24px round close button "Menü schließen" at the top right corner (ref L999-1001).
3. **Properties panel** at the top right (section 4).

### Actions

**Ausblenden** (ref L1103-1108)
- Adds the element to `hiddenIds`, closes the menu, and calls `refresh()`.
- This is cumulative: each further element is added.

**Isolieren** (ref L1109-1118)
- The first isolate starts the isolating state. Further isolates add to the isolated set, so the visible set is the union.
- The camera does not refit.
- The selection and the properties panel stay open (see ref-11).

How both combine with the filter:
- The visibility check in `applyVisibility` is `shownByTools && itemPasses(item)`, where `shownByTools` stands for spaces visible, not hidden, and in the isolated set if isolating (ref L1232-1235).
- So Ausblenden and Isolieren apply on top of the filter (AND).
- They lower the filter status count "X von Y Objekten sichtbar": `show` contains only tool-visible elements (ref L1237, L1247).
- With X-ray on, they are not ghosted, because a ghost requires `shownByTools` (ref L1236).

**Schneiden** (ref L1079-1101, L1119-1123)
- Makes one clipping plane at the clicked point:
  - horizontal if the face normal has |y| ≥ 0.7 (ref L227);
  - otherwise vertical, perpendicular to the face.
- The side facing the camera is removed, with a 2mm offset so the clicked face stays visible (ref L228).
- Only `renderer.clippingPlanes` changes. Visibility, the filter and the counts are not touched.
- **Section handle:** a 36px white circle with a 3px red border and a red scissors icon, anchored on the cut (ref L1880-1884). Dragging it moves the cut along its normal (ref L1137-1169). It turns red-filled on hover or drag.
- There is one cut at a time; a new Schneiden replaces it.

### Undo
Pills stack at the bottom right, 16px from the right and 20px from the bottom, with an 8px gap (ref L1013-1039, L1126-1135, L1848-1861):
- "Isolierung entfernen", titled "Alle Elemente wieder anzeigen": clears isolation.
- "Ausblendung entfernen", titled "Ausgeblendete Elemente wieder anzeigen": clears every hidden element.
- "Schnitt entfernen", titled "Schnitt aufheben".

There is no per-element undo and no label "Alle einblenden".

Pill order from top to bottom: filter pill, colour pill, then isolate, hide and section. The filter pill is prepended and the colour pill is inserted after it (ref L1376, L1531).

## 4. Properties display ("Eigenschaften")

### Panel
- `.tov-panel.tov-props-panel`: top 16px, right 16px, width `min(360px, 100%-32px)` (ref L884-886, L1765).
- Its max height ends above the pill stack via `--tov-pills-h`.
- Below 600px it becomes a bottom sheet: left and right 12px, bottom 80px, max height 45% (ref L1927).
- Glass background, radius 14px, blur 14px.
- It closes with the X ("Schließen"), with a click on empty space, or when the element becomes hidden or filtered out (ref L934-936, L1259-1263).

### Header and model chip
- Kicker: the IFC class, e.g. "IFCSLAB", red uppercase 11px/700 with `.08em` spacing.
- Title: the element Name, 15px/600 (ref L929-937, L1759-1760).
- Below the header, a grey pill chip shows the model name (ref L939, L1764).

### Body (`renderItemData`, ref L340-393)
- **"Standardeigenschaften"**: a collapsed group holding the element's direct attributes (ref L215, L355-358).
- **One group per IsDefinedBy property set** (`<details class="tov-group">`):
  - Groups are open at the first level, titled with the Pset name.
  - They nest up to depth 4 (ref L208).
  - Type objects are skipped (ref L214, L379).
  - Empty groups and empty values are hidden (ref L349, L387).
- **Group styling** (ref L1783-1791):
  - Background `rgba(23,24,26,.035)`, radius 10px.
  - Summary: 600 weight with a CSS chevron, grey when closed and red, rotated, when open.
  - Nested groups have a background of `rgba(255,255,255,.7)`.
- **Rows** are a two-column table (ref L1769-1773):
  - Label 44% wide in `#6B6F73`, value in `#35383A`.
  - 4px vertical padding and hairline separators `rgba(164,168,172,.35)`; text wraps anywhere.

### Values
- Raw values with numbers rounded to 4 decimals (ref L290-296).
- No units, no search in the panel, and no copy button.
- Booleans show as "true" or "false"; arrays are joined with ", ".

### Row tools on hover
- "Farbe nach Wert" and "Nach Wert filtern", 24px buttons with 16px icons, hover red (ref L1776-1782).
- They are always visible on touch devices (ref L1778).
- They appear only for indexed keys: attributes at depth 0 and Pset properties.

## 5. Colours, styles and sizes to reproduce

### Tokens (ref L1715-1719)
- `--tov-red: #D72622`
- Ink: `--tov-ink` and `--tov-ink-2` `#35383A`, `--tov-ink-3` `#4E5355`, `--tov-ink-4` `#6B6F73`, `--tov-ink-5` `#A4A8AC`
- `--tov-line: rgba(164,168,172,.35)`
- `--tov-glass: rgba(255,255,255,.86)`
- `--tov-shadow: 0 12px 32px rgba(23,24,26,.16), 0 2px 6px rgba(23,24,26,.08)`
- Primary hover colour: `#b81f1c`

### Font
- 13px/1.45 "Segoe UI", system-ui, Roboto, Arial (ref L1721).

### Background
- `radial-gradient(120% 95% at 50% 28%, #fff 0%, var(--tov-bg) 58%, color-mix(--tov-bg 82%, #6B6F73) 100%)`
- `--tov-bg` defaults to `#eceef0` (ref L1723-1727).
- The canvas is transparent.

### Lighting
- Hemisphere light white / `#6b6f73` at 1.8.
- Directional light 1.6 at (5,10,7).
- Camera FOV 45 (ref L757-764).

### Panels and controls
- **Panels:** radius 14px, border `1px rgba(255,255,255,.6)`, blur 14px (ref L1755).
- **Panel head:** padding `12px 12px 10px 16px` and a bottom hairline (ref L1757).
- **Panel body:** padding `10px 16px 14px` (ref L1763).
- **Filter body:** grid with a 10px gap (ref L1796).
- **Search field:** 36px high, radius 8px, border `#A4A8AC`; on focus the border turns red with a ring `0 0 0 3px rgba(215,38,34,.12)` (ref L1803-1806).
- **Chips:** 32px high, fully rounded (pill), padding `0 8px 0 14px`; when active, red with a tint of `.08` (ref L1809-1814).
- **Rule rows:** background `rgba(23,24,26,.05)`, radius 8px; the mode label is red and 600 weight (ref L1817-1820).
- **Status line:** 12px, `#6B6F73`, with a hairline above it (ref L1821).
- **Segmented control:** grey track `rgba(23,24,26,.06)`; the active segment is white with red text and a small shadow (ref L1830-1833).
- **Swatches:** 28px circles with a 2px white border; the selected one gets a 2px ink ring (ref L1835-1838).

### Dialogs (ref L1890-1914)
- Backdrop `rgba(53,56,58,.28)`.
- Card: white, radius 14px, 360px wide, or 860px for the wide variant.
- Title 17px/600.
- Buttons 36px high, radius 8px; the primary button is red.
- Checklist: max 320px high; checkboxes use `accent-color` red; the "Alle wählen" row is sticky on `#f4f5f6`.
- Inputs and selects: 36px high, radius 8px.
- Invalid fields: red border on `#fdf3f2`.

### Suggestion dropdown (ref L1916-1921)
- White, radius 10px, shadow, at least 260px wide.
- Items: padding `7px 14px`; the group line is 11px grey.

### Pills (ref L1849-1861)
- Glass, radius 12px, padding 6px.
- Buttons 40px high, 600 weight.
- The icon in the main button is red, 20px.
- The toggle button is 32px wide.

### 3D materials
- Selection `#D72622`, opaque, two-sided (ref L888-893).
- Markieren `#F08A87` (ref L894).
- Ghost `#A4A8AC` at 0.12 (ref L1185-1191).

### Responsive
- 700px: the rule form switches to two columns.
- 600px: the properties panel becomes a bottom sheet, the title chip moves in, the hint is hidden, and the pills move to the top right (ref L1923-1931).

## Screenshots

The script `/tmp/claude-0/-home-user/b4080e59-f4c4-52f1-9269-192eeef60a44/scratchpad/cr-ref/shoot.cjs` does the following:
1. Opens the builder via file://. jsDelivr requests are served from `/home/user/simple-calc-browser/test-cache/cdn`; no request was blocked.
2. Builds a viewer from `AC20-FZK-Haus.ifc` with the title "AC20-FZK-Haus".
3. Downloads the generated viewer to `/tmp/claude-0/-home-user/b4080e59-f4c4-52f1-9269-192eeef60a44/scratchpad/cr-ref/ref-viewer.html`.
4. Opens that viewer at 1600×950 and captures the images below.

Images:
- `/tmp/claude-0/-home-user/b4080e59-f4c4-52f1-9269-192eeef60a44/scratchpad/cr-ref/ref-01-viewer-toolbar.png`: viewer with the title chip, hint pill and toolbar (Modell einpassen, Filter, Einfärben; the FZK fixture has no exported spaces).
- `/tmp/claude-0/-home-user/b4080e59-f4c4-52f1-9269-192eeef60a44/scratchpad/cr-ref/ref-02-filter-panel.png`: filter panel in simple mode (search, Kategorie chip, "+ Filter hinzufügen", "83 von 83 Objekten sichtbar").
- `/tmp/claude-0/-home-user/b4080e59-f4c4-52f1-9269-192eeef60a44/scratchpad/cr-ref/ref-03-filter-category-checklist.png`: the "Kategorie" checklist dialog with counts.
- `/tmp/claude-0/-home-user/b4080e59-f4c4-52f1-9269-192eeef60a44/scratchpad/cr-ref/ref-04-rule-dialog-property-suggestions.png`: "Filter bearbeiten" with the Eigenschaft suggestion list open (labels with Pset group).
- `/tmp/claude-0/-home-user/b4080e59-f4c4-52f1-9269-192eeef60a44/scratchpad/cr-ref/ref-05-rule-dialog-modes-operators.png`: "Filter bearbeiten" showing all Aktion options and all four Vergleich operators.
  - Native select popups cannot be captured in headless mode, so for this image only the two selects were switched to listboxes (`size=4`) in the browser page.
- `/tmp/claude-0/-home-user/b4080e59-f4c4-52f1-9269-192eeef60a44/scratchpad/cr-ref/ref-06-filter-rule-applied.png`: the rule `Isolieren: Kategorie enthält „wall“` applied, "13 von 83", the "Zurücksetzen" link, the X-ray toggle and the "Filter entfernen" pill.
- `/tmp/claude-0/-home-user/b4080e59-f4c4-52f1-9269-192eeef60a44/scratchpad/cr-ref/ref-07-filter-xray.png`: the same filter with X-ray on (filtered-out elements as ghosts).
- `/tmp/claude-0/-home-user/b4080e59-f4c4-52f1-9269-192eeef60a44/scratchpad/cr-ref/ref-08-color-property-list.png`: "Einfärben" panel, property list with "Parameter suchen".
- `/tmp/claude-0/-home-user/b4080e59-f4c4-52f1-9269-192eeef60a44/scratchpad/cr-ref/ref-09-coloring-active.png`: colouring by Kategorie ("Unterschiedliche Farben"), the legend with counts, the "Einfärbung entfernen" pill and the dot on the toolbar button.
- `/tmp/claude-0/-home-user/b4080e59-f4c4-52f1-9269-192eeef60a44/scratchpad/cr-ref/ref-10-element-click-properties-menu.png`: roof Dach-2 selected (red), the element menu Ausblenden / Isolieren / Schneiden at the click point, and the properties panel at the top right with Pset groups.
  - The hover row tools do not show in this image because the first table row sits inside the collapsed group.
- `/tmp/claude-0/-home-user/b4080e59-f4c4-52f1-9269-192eeef60a44/scratchpad/cr-ref/ref-11-isolate-applied.png`: Isolieren applied (only the roof slab is left) and the "Isolierung entfernen" pill; the properties panel stays open.
- `/tmp/claude-0/-home-user/b4080e59-f4c4-52f1-9269-192eeef60a44/scratchpad/cr-ref/ref-12-hide-applied.png`: Ausblenden applied to the same slab and the "Ausblendung entfernen" pill.
- `/tmp/claude-0/-home-user/b4080e59-f4c4-52f1-9269-192eeef60a44/scratchpad/cr-ref/ref-13-section-applied.png`: Schneiden on the roof face (horizontal cut), the draggable scissors handle and the "Schnitt entfernen" pill.

## Open questions for the user

1. **Operator set.** The reference has only "Gleich", "Beginnt mit", "Endet mit" and "Enthält", with no "enthält nicht", "ungleich", greater/less, "zwischen" or empty checks; negation exists only through the action "Ausblenden". The user said "(Was es eben alles gibt)", so they need to confirm the full list with exact labels, for example:
   - text: enthält / enthält nicht / ist gleich / ist ungleich / beginnt mit / endet mit / ist leer / ist nicht leer
   - numbers: = ≠ > ≥ < ≤ / zwischen
2. **Advanced filter UI.** The reference has no separate "erweiterter Filter" mode. Options: keep the reference layout (search + Kategorie chip + rule rows from the "Filter bearbeiten" dialog) and only extend the operators, or add a simple/advanced toggle.
3. **Combining rules.** The reference is AND-only, with OR only inside a chip and no groups. Is AND-only enough, or is an UND/ODER switch or groups wanted?
4. **The "Aktion" per rule** (Isolieren / Ausblenden / Markieren / Freie Textsuche). Should it be kept as in the reference, or should a rule only restrict the result set, with the table showing the result?
5. **"Fokus".** There is no such button in the reference. Is "Fokus" the "Modell einpassen" button, a zoom to the selected element, or a zoom to the current filter result?
6. **Table and filter interaction.** The reference has no table. Two things to decide:
   - Should table rows follow the combined visibility (filter AND Ausblenden AND Isolieren) exactly like the reference's "X von Y" count, so that hidden or isolated elements leave or stay in the table, while Schneiden has no effect?
   - Should a table row click select the element in 3D?
7. **Properties panel position.** The reference shows it as a floating panel at the top right inside the 3D view, only on click. Is the same placement and look wanted, replacing the current right-hand details column, including the hover tools "Farbe nach Wert" / "Nach Wert filtern" and the collapsed "Standardeigenschaften"?
8. **Units and number formatting.** The reference shows raw values without units, rounded to 4 decimals. Should the new viewer show the units and formatting the calc app already has?
9. **Kategorie and Datei chips.** Are these chips, which have counts that ignore the other filters, also wanted? The current app may already have facets with cross-filtered counts.
10. **Räume button and X-ray toggle.** Should "Räume ein-/ausblenden" and the X-ray toggle "Ausgeblendete anzeigen" be included too? They belong to the reference's filter and toolbar but were not named by the user.