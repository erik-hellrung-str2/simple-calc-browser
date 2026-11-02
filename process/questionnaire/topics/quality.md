# Topic: quality attributes (QLT)

Ask for numbers. If the user has none, offer concrete targets as options (the recommended one first).

Rows are information needs; the phrasing is an example — formulate the best question for the project (`process/questionnaire/README.md`).

| ID | Level | Information need — example phrasing |
|---|---|---|
| QLT-01 | XS | Is anything time- or reliability-critical (e.g. "must feel instant", large files, many users at once, must never lose data)? |
| QLT-02 | M | Targets — here are proposed values, adjust as needed: response time for key operations, load (users, requests, peaks), availability and maintenance windows, supported browsers/OS/runtimes. |
| QLT-03 | L | Growth over 1–3 years; reliability guarantees (behaviour under partial failure, consistency, idempotency)? |

Agent decides (shown at the design gate): logging, metrics and tracing approach; coverage targets (`process/calibration/testing.md` §2a); coding standards and documentation level.
