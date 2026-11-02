---
status: draft
relates_to: [TASK-002]
---
# Process log

Deviations from calibration and guidance for this project (`process/kernel.md` §0, §9), and design details recorded here instead of in the approved baseline.

| Date | Area | Default | Applied instead | Reason | Effect / confirmed by |
|---|---|---|---|---|---|
| 2026-11-02 | Design detail, spec §4.3 Extraction (TASK-002, DEC-13) | §4.3: element ids via `getItemsOfCategories` minus spatial and type classes, "IfcSpace by option". | IfcSpace elements are always converted (transparent) and extracted. The option `Räume (IfcSpace) einbeziehen` filters the rows and the catalogue (`visibleRows`, `buildCatalog` from visible rows only) and switches the 3D visibility of the space items (`setVisible`). Toggling it does not reconvert. | Switching the option becomes instant and reversible. This is consistent with the §4.3 element-id rule: spaces with the option off are not among the element rows, the 3D view or the catalogue. The requirements are met at data level (REQ-001-AC4), and DEC-13's reason (no room volumes in element sums) still holds. | TASK-005 must keep spaces hidden through every ghost/hide reset (§4.4 uses the same `setVisible` call) and keep them out of `CalcView.state()`. TASK-005/006a carry the 3D side of REQ-001-AC4 as an explicit acceptance item. Converting spaces always adds a small cost to NFR-002, measured in TASK-010. Found by the TASK-002 verification. |
