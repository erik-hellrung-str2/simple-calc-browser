---
status: draft
date: 2026-11-03
relates_to: [INC-1, CR-A, Q-001, Q-002, Q-003, NFR-001, BUG-T2, BUG-T4, R-3, T12, ASM-001, ASM-002, ASM-003, ASM-006, ASM-007, ASM-008, DEC-1, DEC-2, DEC-3, DEC-4, DEC-5, DEC-6, DEC-7, DEC-8, DEC-9, DEC-10, DEC-11, DEC-12, DEC-13, DEC-14, DEC-15, DEC-16, DEC-17, TASK-002, TASK-007, TASK-008, TASK-009, TASK-010]
---
# Decisions to confirm at the release gate — 1.0.0

The decisions the task records flag for confirmation, the spec's DEC-1..17, every open assumption and every deviation, consolidated for the human release gate. Sources: `docs/spec.md` §4.7 (DEC-1..17), `docs/tasks/*.md` ("Decision(s) to confirm"), `docs/reviews/verification-INC-1.md`, `docs/open-questions.md`, `docs/testing/report-INC-1.md`.

**Type:** **B** = business rule (what the numbers and the product mean for the user — your decision by kernel §1.9). **T** = technical default (a sensible engineering choice; confirm or ask for a change). The product currently behaves as written in every line; "keep" means no change.

The five blocks can be approved one by one. Any line you want changed becomes a change request (`/change`).

## Block 1 — Quality deviations and open points of this release (decide first)

| # | Item | Type | Source | Proposal |
|---|---|---|---|---|
| 1.1 | **NFR-001 on PCs without a GPU.** Target: ≤ 500 ms per interaction at ≥ 30,000 elements. Measured on 30,931 elements, software WebGL (no GPU), testing cycle 2: filter sets and table 6–25 ms / 9–22 ms (met); sort, view switch, regroup, open checklist 3–34 ms (met); selection 148.5 / 202.9 ms (met); last changed 3D frame (Q-002 metric) medians 415–509 ms (run 1) and 354–533 ms (run 2) — over target: `Name set check` 508.7 ms, `Name set uncheck` 513.7 ms, `column filter uncheck` 533.3 ms (cycle 1: 283–431 ms, all met; A/B check: not caused by the BUG-T1 fix); 3D detail spec 351 / 425 ms (met); pixels on screen 1.19–1.54 s (recorded only). On a GPU estimated 150–300 ms, **not measured**. Consequence: `test/perf/nfr-001.spec.mjs` is red on this machine (BUG-T4). | B | report-INC-1 §4, §5; Q-002; TASK-010; process-log | Accept the wider deviation for PCs without GPU (software rendering may also exceed 500 ms for the last changed frame); make the manual GPU check (T12) the deciding measurement. If not accepted: NO-GO until the test is green. |
| 1.2 | **CR-A — openings and ports are not rows.** `IfcOpeningElement` and `IfcDistributionPort` (classes outside the Fragments importer's element classes) are not table rows, so not counted or summed (e.g. Revit MEP: 131 openings, 8,515 ports). Reason: voids and connection points, not elements to quantify (same argument as DEC-13 for IfcSpace). CR-A adds this sentence to REQ-002; no code change. | B | TASK-002; verification SYNC F1; process-log | Approve CR-A (keep). Rejecting it makes openings/ports rows: a product change. |
| 1.3 | **Q-001 — licence of the test fixture** `test/fixtures/Ifc2x3_Duplex_Architecture.ifc` (source repository states no licence; origin buildingSMART / NIBS Common BIM Files). Repository only, not in the product file. | B (legal) | open-questions Q-001 | User decides: keep, or replace with an IFC2X3 sample under a known licence. |
| 1.4 | **Manual checks at release (T12, R-3, T11, T14):** smoke in current Chrome and Edge, Firefox best effort; GPU measurement of NFR-001; open an exported `.xlsx` in Microsoft Excel (only openpyxl / LibreOffice tested); download names with umlauts (headless Chromium names them `download`); T14 exploratory and break sessions are done (report-INC-1 §6, 20 of 20 probes) and a usability review ran as the UX lens of the verification (`docs/reviews/verification-INC-1.md`); still open: the spec's T11 heuristic review against the intake and the T14 charter "quantity overview for a real project" with real project files. The other manual checks are not done yet. | T | TASK-008, TASK-009, TASK-010; report-INC-1 | Run them before tagging, or release with them listed as open. |
| 1.5 | **Known bugs shipped:** BUG-T2 (trivial) — a long GlobalId breaks mid-word in `Element-Details`; BUG-T4 — see 1.1. | B | report-INC-1 §5 | Accept as known issues; fix in a later change. |
| 1.6 | **Builder without internet shows `Failed to fetch`** (English browser text, no German message) at start. Found while writing the release documents (probe with all network blocked). The viewer file is not affected. | B | release-notes (Known issues) | Accept as known issue, or request a German message via `/change`. |

## Block 2 — Quantities: what counts as a row and how values are summed

| # | Item | Type | Source | Proposal |
|---|---|---|---|---|
| 2.1 | DEC-1: a property on the element and its type → the element's value wins; one merged property. | B | spec §4.7 | keep |
| 2.2 | DEC-2: length, area, volume converted to m, m², m³ (mm, cm, feet, …); other units unchanged; different units across models → `gemischt`, no sums. | B | spec §4.7 | keep |
| 2.3 | DEC-3 / ASM-006: aggregates (e.g. IfcStair, IfcCurtainWall) **and** their parts are both rows; sums include both (filter by `Kategorie` to avoid double counting). | B | spec §4.7, ASM-006 | keep (or decide: parts only / aggregates only) |
| 2.4 | DEC-4: the same GlobalId in two models gives two rows (`Modell` distinguishes them). | B | spec §4.7 | keep |
| 2.5 | DEC-5: text that looks like a number (e.g. IfcLabel `"1.5"`) stays text, never summed. | B | spec §4.7 | keep |
| 2.6 | DEC-11: IFC classification references, systems/groups and material layer thicknesses are not properties in 1.0 (later change). | B | spec §4.7 | keep |
| 2.7 | DEC-13: IfcSpace (rooms) off by default; option `Räume (IfcSpace) einbeziehen`. | B | spec §4.7 | keep |
| 2.8 | DEC-16 / ASM-008: grouping by a multi-valued property (e.g. `Material`) counts and sums an element in each of its groups; the `Summe` row counts it once. | B | spec §4.7, ASM-008 | keep |
| 2.9 | DEC-17: numeric column filter `von` / `bis` inclusive; empty values excluded while a bound is set. | B | spec §4.7 | keep |
| 2.10 | DEC-6 and TASK-008: CSV texts starting with exactly `=`, `+`, `-`, `@` get a `'` prefix (formula-injection protection); not TAB / CR; numbers never. | B | spec §4.7, TASK-008 | keep |
| 2.11 | TASK-008: texts over 32,767 characters are cut in the `.xlsx` (Excel cell limit); CSV keeps the full text. | T | TASK-008 | keep |
| 2.12 | TASK-008 (C1): a `values` column filter on a numeric column matches by equality (only a range filter on a text column is reported and skipped). | T | TASK-008 | keep |

## Block 3 — Behaviour of builder and viewer file

| # | Item | Type | Source | Proposal |
|---|---|---|---|---|
| 3.1 | DEC-9: single-element and grouping view share one column set. | B | spec §4.7 | keep |
| 3.2 | DEC-12: a repeated file name gets ` (2)`, ` (3)` in `Modell`. | B | spec §4.7 | keep |
| 3.3 | DEC-14: a checked filter value with 0 hits stays visible (count 0) so it can be unchecked. | B | spec §4.7 | keep |
| 3.4 | DEC-15: colouring rules — 120 distinct colours, then `Sonstige`; numbers in 24 steps; `mehrere Werte`; `(leer)` grey; selection > colour > ghost/hide; colours stay stable across filter changes (similar colours possible). | B | spec §4.7, verification UX minor 2 | keep |
| 3.5 | TASK-007: `Konfiguration laden` needs a loaded model (a configuration dropped during a load waits for it). | B | TASK-007 | keep |
| 3.6 | TASK-007: a part missing from a hand-written configuration keeps the current state. | T | TASK-007 | keep |
| 3.7 | TASK-007: not saved in the configuration: `Räume (IfcSpace) einbeziehen`, splitter position, collapsed details panel. | B | TASK-007 | keep |
| 3.8 | TASK-008: `Export CSV` / `Export Excel` need a loaded model. | B | TASK-008 | keep |
| 3.9 | TASK-008: `Esc` in a filter search field never clears the element selection. | T | TASK-008 | keep |
| 3.10 | TASK-009: the viewer shows the header date of the export (not the colleague's today). | B | TASK-009 | keep |
| 3.11 | TASK-009: the IfcSpace setting travels with the viewer file; no switch in the viewer. | B | TASK-009 | keep |
| 3.12 | TASK-009: expanded groups, selection and panel layout are not exported. | B | TASK-009 | keep |
| 3.13 | TASK-009: files dropped on the viewer are ignored. | B | TASK-009 | keep |
| 3.14 | TASK-009: `HTML exportieren` needs a loaded model. | B | TASK-009 | keep |
| 3.15 | Q-003 (already confirmed 2026-11-02): a group selection only shrinks when the filter changes and clears once empty. | B | Q-003, TASK-006c | for information |

## Block 4 — Technical defaults and limits

| # | Item | Type | Source | Proposal |
|---|---|---|---|---|
| 4.1 | DEC-7: the viewer file contains the pre-extracted element table (no web-ifc, no extraction for colleagues). | T | spec §4.7 | keep |
| 4.2 | DEC-10: three at the version Fragments 3.4.7 imports (0.185.1) with a drift guard (`Unerwartete Bibliotheksversion von jsDelivr: …`). | T | spec §4.7 | keep |
| 4.3 | TASK-007: logo limit 1 MB (PNG / JPG / SVG by content). | T | TASK-007 | keep |
| 4.4 | TASK-007: fourth configuration error `too-large` (> 20 MB, not read). | T | TASK-007 | keep |
| 4.5 | TASK-008: control characters in Excel texts written as `_xHHHH_`. | T | TASK-008 | keep |
| 4.6 | TASK-009: NFR-003's 40 % size target applies to viewer files from ≥ 100 MB of IFC only (small models 55–59 % because of the ~1 MB runtime). | T | TASK-009 | keep |
| 4.7 | TASK-010: viewer start timeout 120 s; conversion stall timeout 180 s (start timeout 30 s). | T | TASK-010 | keep |
| 4.8 | TASK-010: the viewer draws once after all models, configuration and streamed tiles (cap 8 s). | T | TASK-010 | keep |
| 4.9 | TASK-010: `SETTLE_BUSY_MS` = 1,000 ms (single runs may exceed 500 ms; NFR-001 is a median). | T | TASK-010 | keep |
| 4.10 | TASK-010 (V3): unused URLs inside the bundled libraries kept (never requested; NFR-005 zero requests holds). | T | TASK-010 | keep |
| 4.11 | TASK-010: NFR-001 selection measured to the engine calls when no drawn tile changes. | T | TASK-010 | keep |
| 4.12 | TASK-010: "most runs" in the 3D frame tests = more than half of the runs per action. | T | TASK-010 | keep |

## Block 5 — Assumptions still marked active (`docs/open-questions.md`)

| # | Item | Type | Source | Proposal |
|---|---|---|---|---|
| 5.1 | ASM-001: project name "Calc Viewer Builder"; code in the repository `simple-calc-browser`. | B | ASM-001 | confirm |
| 5.2 | ASM-002: title, date and logo are part of release 1 with priority Should (built and tested). | B | ASM-002 | confirm |
| 5.3 | ASM-003: automated tests use public sample IFC files; real project models only for manual checks (none in the repository). | B | ASM-003 | confirm |
| 5.4 | ASM-006 = item 2.3 (aggregates and parts both rows). | B | ASM-006 | see 2.3 |
| 5.5 | ASM-007 / DEC-8: supported browsers current Chrome and Edge; Firefox best effort (not tested). | B | ASM-007, DEC-8 | confirm |
| 5.6 | ASM-008 = item 2.8 (multi-valued grouping). | B | ASM-008 | see 2.8 |

Confirmed earlier, no action: Q-002 (NFR-001 counts the last changed 3D frame; basis of 1.1), Q-003 (3.15), ASM-004 (own `.xlsx` writer; Excel itself → 1.4), ASM-005 (storey, material, type extraction).

For information (accepted in task verification, not flagged for confirmation): TASK-005 — `CalcView.state()` covers geometry only, context geometry (IfcSite terrain) follows ghost/hide, blue numeric colour scale, selection cleared when the element leaves the filter; TASK-006b — `Gruppiert` starts with `Kategorie`, text cells in `Summe` stay empty, switching views starts the table at its first row (TASK-006c). Also decided without asking and recorded: IfcSpace is always converted and only filtered by the option (`docs/process-log.md`); checked values of removed models are dropped (pruning, narrows DEC-14; process-log); long quantity headers keep their spec form (UX M3), checked values are not pinned to the top of a list (UX minor 4), the catalogue lists entries with 0 elements (UX minor 6) — TASK-004 / TASK-006b "Verification INC-1".
