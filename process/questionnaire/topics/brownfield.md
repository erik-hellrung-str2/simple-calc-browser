# Topic: existing systems (BRF)

Analyse the existing code yourself where accessible and propose answers from it.

Rows are information needs; the phrasing is an example — formulate the best question for the project (`process/questionnaire/README.md`).

| ID | Level | Information need — example phrasing |
|---|---|---|
| BRF-01 | XS | Existing system: access for the agents (repo URL, path); what must be kept, what may be changed, what should be replaced? |
| BRF-02 | S | Here is what I found (stack, tests, docs, conventions, problem areas). Correct, and anything I should know that the code does not show? |
| BRF-03 | M | Compatibility and migration: interfaces other systems depend on; data to migrate; allowed downtime, parallel operation of old and new, rollback to the old system? |

Agent decides (shown at the design gate): refactoring approach, how new code fits the existing structure.
