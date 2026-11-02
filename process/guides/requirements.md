# Guide: requirements

Outcome and exit criteria: `kernel.md` §5. Role: analyst. Lean writes into `docs/spec.md` and continues directly with design and planning.

## Approach that works

- Derive requirements from captured capabilities and examples; one behaviour per `REQ`, priority `must | should | could`, `source:` the need IDs it comes from.
- Acceptance criteria in Given/When/Then with concrete values — the user's examples are the best material. Error and edge cases become their own criteria. Criteria that depend on the date state "today"; each criterion names who does what with which data, so it has exactly one way to be tested.
- Roles and permissions as requirements or a role × capability matrix.
- User interface: screens or commands with purpose and the use cases they serve, navigation, look and feel, devices, feedback states; behavioural UI rules as REQs, accessibility and localization targets as NFRs.
- NFRs always with a number and a verification method (test type from `calibration/testing.md`). Words like fast, secure, user-friendly without a number are not requirements.
- Constraints, out of scope, glossary when domain terms exist.
- Before the gate, check: every capability covered, every REQ atomic, testable, free of design, no contradictions; assumptions linked to the REQs they affect; blocking questions asked.
