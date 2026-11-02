---
status: draft
relates_to: [C08, C10, BRF-02]
source: erik-hellrung-str2/html-modelviewer @ 3e0deef (ifc-viewer-builder.html)
---
<!-- Intake input for the as-is analysis (design phase, modifier brownfield). Line refs = ifc-viewer-builder.html. -->

# As-is summary: `html-modelviewer/ifc-viewer-builder.html`
The file has 2360 lines and is 180,879 bytes. Nothing was modified. I spot-checked several claims with grep. Two line references from the readers were off, and I corrected them below: `LARGE_INPUT_WARNING_MB` is on L2012 (not L2010), and `MARK_COLOR` is on L218.

## Stack & versions
- The only pinned version is `FRAGMENTS_VERSION = "3.4.7"` (L1987), loaded from `https://cdn.jsdelivr.net` (L1988). The root module is `@thatopen/fragments@3.4.7/+esm` (L1989) and the worker is `dist/Worker/worker.min.mjs` (L1990).
- three and web-ifc are not pinned. Their versions are read at runtime from the jsDelivr `+esm` import graph by regex (L1991, L2085-2089). Whether these versions can drift is not verified.
- There is no bundler and no import map. `tovLinkModules` (L163-192) rewrites import specifiers to Blob URLs, and an unknown `/npm/` import throws (L181). The aliases are `three`, `@thatopen/fragments` and OrbitControls (L2095-2099).
- The page needs `CompressionStream` and `DecompressionStream` (L2082, L1693). The builder needs internet access, for the CDN module graph and the web-ifc WASM (L15, L1954, L2113).

## Build pipeline & generated output
- **Input:** a drop zone `#drop` and an `<input accept=".ifc" multiple>` (L73-74, L2145-2168). The only options are title, ZEN mode, include IfcSpace and background colour (L80-92).
- **Conversion:** one classic Worker per file, run one after another and terminated after each file (`convertIfc` L2186-2205).
  - The worker calls `IfcImporter().process` (L1940-1981).
  - IfcSpace is either removed or kept with `forceTransparentSpaces` (L1955-1957).
  - The result is `.frag` bytes.
- **Output:** one HTML string built in memory (L2307).
  - Each model is stored as gzip+Base64 in `<script id="tov-model-N">` (L2233, L2300-2303).
  - The runtime is a gzip+Base64 JSON `{sources, aliases, worker}` in `#tov-runtime` (L2234). It includes a web-ifc stub that saves about 3.5 MB, so the viewer cannot parse IFC (L2065-2104).
  - Config is `#tov-config` holding `{title, zen, background, models:[{id,name}]}` (L2223-2232, L2288-2293).
  - CSS is copied from `#tov-viewer-css` (L1714-1938).
  - The bootstrap is at L1669-1710.
- **Preview and download:** the preview is an `iframe srcdoc sandbox="allow-scripts allow-popups"` (L104, L2247-2253). Download uses a Blob plus `<a download>` and defaults to `ifc-modellviewer.html` (L2330-2338).
- **Viewer contract:** no network, no storage APIs, works in an opaque origin, no dependency on `window.parent` (L10-14). A grep finds no `localStorage`, `sessionStorage` or `indexedDB`.
- **Multiple models:** one `FragmentsModels` instance with `load(bytes,{modelId})` per model (L777, L806-816). Models are not merged, and each keeps its own localIds.

## Extracted data & existing filter
- **`ITEM_DATA_CONFIG` (L244-251):** `attributesDefault:true`. It follows only `IsDefinedBy`; `DefinesOccurrence` and `ObjectTypeOf` are off.
- **Not read:** storey/containment, material, and the psets of type objects (`TYPE_CATEGORY_RE` L214). A grep finds no `ContainedInStructure`, `HasAssociations` or `getSpatialStructure`.
- **Values:** stored as formatted strings rounded to 4 decimals, without units (`formatValue` L290-296).
- **Index:** built lazily by `buildIndex` (L1269-1288) via `loadIndex` (L1435-1449), in chunks of `INDEX_CHUNK_SIZE=2000` (L219).
  - `indexItem` (L402-437) produces `props` (keys `a:<attr>` and `p:<Pset>\u0001<Prop>`), `category`, `haystack` and `localId`.
  - A catalog across all models is kept alongside.
- **Filter state** (L1176): text, models, categories and rules with the modes isolate, hide, select and text (L224).
  - Operators are eq, starts, ends and contains, all as case-insensitive string comparisons (L225, L440-456).
  - All conditions are combined with AND in `itemPasses` (L1207-1215).
  - Only the Datei and Kategorie checklists allow OR (L607-646).
- **Counts:** the category counts ignore the other active filters (L1480-1486). The status line reads "X von Y sichtbar" (L1424). `computeColoring` (L495-522) has per-value counts and is the closest thing to facet counts.
- **Selection:** one item at a time (`pick` L944-967). `showProperties` calls `getItemsData` again rather than using the index (L926-942).

## UI layout & theme (keep these colours)
- **Builder tokens (L18):** `--accent #D72622`, `--accent-dark #b81f1c`, `--ok #1d8a4a`, `--line #e1e3e5`, `--text #35383A`, `--muted #6B6F73`, `--bg #f4f5f6`. The font is 14px "Segoe UI"/system-ui (L20).
- **Viewer tokens (L1715-1719):** `--tov-red #D72622`; ink `#35383A`, `#4E5355`, `#6B6F73`, `#A4A8AC`; `--tov-line rgba(164,168,172,.35)`; glass `rgba(255,255,255,.86)`.
  - Default background `#eceef0` (L206), `MARK_COLOR #F08A87` (L218), ghost `#A4A8AC` at opacity 0.12 (L239-241).
  - Tints: `rgba(215,38,34,.08)` and `.12` for focus.
  - The font is 13px "Segoe UI" (L1721). There is no dark mode.
- **Builder layout:** a 64px app bar with an inline logo (L22, L65-69), then four cards in a centred `main` with max width 1100px (L70-115).
- **Viewer layout:** glass elements floating over a full-screen canvas.
  - Title chip with a red left border (L1739).
  - Round toolbar at the bottom centre (L1748).
  - Properties panel top right, 360px wide (L1767).
  - Filter and colouring panels at the bottom centre, 380px wide (L1768).
  - "… entfernen" pills at the bottom right (L1848-1861).
  - Dialogs 360px and 860px wide (L1889-1922).
  - Breakpoints at 700px and 600px (L1923-1937).
- **Icons:** inline SVG with stroke `currentColor` (L254-268).
- **Language:** all UI text is German, with `\u00e4` escapes because the runtime must stay ASCII (L116-120).

## Reusable for the new app
- The single-file export pattern: runtime blob, model script tags, JSON config, bootstrap (L2217-2240).
- The conversion worker and the ESM crawler and linker (L163-192, L2042-2068).
- The CSS tokens and components, including icons, chips, checklists and dialogs.
- The index structure and catalog, which can serve as the basis for the facet data.
- `computeColoring` and the legend, the X-ray rendering and the section tool (L979-1169).

## Gaps vs. the new app's needs
- No table view, no grouping, no CSV/Excel export, no save/load of configuration, and no persistence.
- No facets with OR within a property and cross-filtered counts.
- No numeric or range operators; quantities are stored as strings.
- No storey or material data and no type psets.
- No multi-select.
- The generated viewer has no export functions of its own.

## Open technical questions / risks
- **Large models:** there is only a soft warning above 150 MB (L2012, L2136-2143). The whole HTML is built in memory (L2307). Base64 adds about 33% on top of the gzip size. A worker crash is reported as possibly too large for browser memory (L2196-2199).
- **Excel export:** no library is present. The choices are an embedded xlsx library (size, version pinning, ASCII rule) or CSV/SpreadsheetML. Not decided.
- **Embedding size:** precomputing the property table into the export would make the file larger, while computing it lazily at runtime costs load time.
- **Save/load format:** there is no precedent. The `#tov-config` JSON could be extended with a schema version and keys of the form (modelId, localId) or GUID. Whether localIds stay the same when an IFC is re-converted is not verified.
- **Unverified:** whether the importer's default relations include spatial and material data, and the exact set of direct attributes it keeps. Also whether jsDelivr's `+esm` output keeps the import patterns the regex expects (L1991).
- **Storage in the exported viewer:** the opaque-origin sandbox and the no-storage contract (L12-14) limit saving inside the viewer.
