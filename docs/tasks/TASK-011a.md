---
id: TASK-011a
title: Trace enabler INC-2 (INC2_PENDING list, traceability regenerated)
type: enabler
status: implemented (awaiting orchestrator verification)
implements: [T5 (spec Testing), CR-002 §6 test/unit/trace.test.mjs]
relates_to: [CR-002, INC-2, T5, REQ-003, REQ-004, REQ-005, REQ-006, REQ-007, REQ-008, REQ-009, REQ-010, REQ-012, REQ-013, TASK-020]
depends_on: []
touches: [test/unit/trace.test.mjs, docs/testing/traceability.md]
---
# TASK-011a: Trace enabler INC-2

Spec §5 acceptance: `test/unit/trace.test.mjs` gets an explicit list `INC2_PENDING` of the CR-002 AC IDs that have no test yet; the "every AC has a test" assertion skips only IDs in that list and fails if a listed ID already has a test or is not an AC of the spec; retired IDs (~~REQ-005-AC3~~) are not ACs for the trace script; `node scripts/trace.mjs` regenerates `docs/testing/traceability.md`; `node scripts/check.mjs` green.

## What changed
- `test/unit/trace.test.mjs`
  - New constant `INC2_PENDING` with 51 AC IDs, grouped by requirement: REQ-003-AC4/AC5, REQ-004-AC5/AC6, REQ-005-AC5..AC12, REQ-006-AC11/AC12, REQ-007-AC6..AC8, REQ-008-AC6, REQ-009-AC4..AC8, REQ-010-AC4, REQ-012-AC1..AC14, REQ-013-AC1..AC13. This is exactly the set of ACs that the generator reported without a test after the spec delta. It matches spec §6: 100 active ACs = 49 with a 1.0.0 test + 51 new.
  - The assertion "every acceptance criterion and NFR of the spec has a test" used to be `doesNotMatch(text, /gap: no test/)`. It now reads the gap rows of the generated table (`gapRows`) and checks four things:
    - every `gap: no test` occurrence is a recognised row;
    - no gap remains outside `INC2_PENDING` (NFR gaps are never skipped);
    - `INC2_PENDING` has no duplicates and contains only ACs of `docs/spec.md`;
    - every listed ID is still a gap. A listed AC that has a test fails with "remove it from the list".
    
    The freshness assertion on `docs/testing/traceability.md` and the `>= 50` ACs / NFR-001..005 assertions are unchanged.
  - New test `[unit] trace: retired acceptance criteria (~~ID~~) are not ACs of the spec; the INC-2 gap rows are recognised`. It checks that every `- ~~REQ-...~~` line of the spec (REQ-005-AC3 must be among them) is not an AC for `specIds`, and checks the same on a fixture line. It also checks `gapRows` on a fixture table (AC row, NFR row, covered row).
- `docs/testing/traceability.md` regenerated with `node scripts/trace.mjs`. It now has 100 ACs, 49 covered, and the 51 listed IDs show `**gap: no test**`, which is accurate. NFRs: 5 of 5.
- `scripts/trace.mjs` unchanged. Its AC pattern `^- (REQ-\d{3}-AC\d+): ` already does not match the retired line `- ~~REQ-005-AC3~~ retired ...`, and the new test pins that behaviour.

## Evidence
- `node --test test/unit/trace.test.mjs`: 4/4 pass.
- Mutation checks, each run and then reverted:
  - adding `REQ-099-AC1` to the list fails with "INC2_PENDING lists an ID that is not an acceptance criterion of docs/spec.md";
  - adding `REQ-001-AC1` (has a test) fails with "INC2_PENDING lists an AC that has a test now: remove it from the list";
  - removing `REQ-013-AC13` fails with "an acceptance criterion or NFR without a test".
- `node scripts/check.mjs` (CV_TEST_PORT=4600): green (see below).

## Decisions (for the release gate / orchestrator)
- **Changed ACs are not in `INC2_PENDING`.** The spec text says the list holds "all new ACs and the changed ACs whose tests are not yet updated". It also says the check fails "if a listed ID already has a test". The 10 changed ACs (REQ-004-AC4, REQ-005-AC1/AC2/AC4, REQ-007-AC1/AC3/AC4/AC5, REQ-009-AC1, REQ-010-AC2) still have their 1.0.0 tests, so listing them would contradict the second rule. They stay credited by those tests. Updating those tests is tracked by CR-002 §6 and the acceptance of the INC-2 task that changes each behaviour, not by this list.
- **REQ-007-AC6 is in the list**, although it carries no `(new CR-002)` marker. It is the BUG-T2 criterion and has no test yet (spec §7: "BUG-T2 stays open until REQ-007-AC6 is green").

## Open points
- `test/e2e/view-3d.spec.mjs` still has the 1.0.0 test `@e2e @acceptance @REQ-005-AC3 ...` (axis section). The trace script ignores the retired ID, so no row credits it. Spec Testing T5 says the old tests of retired ACs are retagged or removed. That belongs to the task that replaces the section (REQ-013-AC9/AC10). This task does not check it: no check fails on a test that names a retired ID.
- Spec §5 status and §6 counts are for the orchestrator to update.
