# Topic: data (DAT)

Rows are information needs; the phrasing is an example — formulate the best question for the project (`process/questionnaire/README.md`).

| ID | Level | Information need — example phrasing |
|---|---|---|
| DAT-01 | XS | Data model: here are the entities (or input/output formats) and relations I derived. Correct? Existing data to import at the start (source, format, volume)? |
| DAT-02 | M | Data lifecycle: how long must data be kept, when deleted (incl. on request), is a change history/audit trail needed, can several users edit the same data, is offline use needed? |
| DAT-03 | M | Volume and exchange: volume today and expected growth; recurring imports/exports (formats, frequency, partners)? |
| DAT-04 | L | Analytics, reporting or BI on this data; data quality rules and master-data ownership? |

Agent decides (shown at the design gate): storage technology (unless constrained), schema details, migrations approach, indexing. Backup and restore: see `operations`.
