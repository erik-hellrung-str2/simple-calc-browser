# Topic: functional requirements (FUN)

Goal: use cases, rules and examples in enough detail to write testable requirements. Always propose the derived use-case list and flows for confirmation.

Rows are information needs; the phrasing is an example — formulate the best question for the project (`process/questionnaire/README.md`).

| ID | Level | Information need — example phrasing |
|---|---|---|
| FUN-01 | XS | Use cases and main flows: here is what I derived (actor → goal: trigger → steps → result). Asked as: "Use cases as listed?" with corrections into "Other". |
| FUN-02 | XS | Rules and error cases: which calculations, validations, limits or conditions apply — and what should happen with invalid input, conflicts, missing data or cancellations? |
| FUN-03 | XS | Concrete examples with sample values that can serve as acceptance tests (this input → this output / this situation → this result)? |
| FUN-04 | S | Priorities and permissions: which use cases are must / should / could? What may each role see and do? (Proposed matrix.) |
| FUN-05 | M | Lifecycle: states of the key objects (e.g. draft → submitted → approved) and who may trigger each transition? |
| FUN-06 | M | Supporting functions — which are needed: search/filter/sort, bulk actions, notifications (which events, to whom), reports/exports, administration (users, settings, master data)? |
| FUN-07 | L | Advanced: automation (scheduled jobs, workflows, rules), drafts/versioning/undo, organizations/tenants, sharing or delegation? |

Agent decides (no question; shown at the design gate): pagination defaults, sort orders, confirmation dialogs for destructive actions.
