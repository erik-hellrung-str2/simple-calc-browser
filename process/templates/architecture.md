---
status: draft        # draft | approved
date: <YYYY-MM-DD>
---
# Architecture — <project>

## 1. Context
- Users/roles: …
- External systems: <name → purpose, protocol, contract file>

## 2. Components

| ID | Responsibility | Owns data | Public interface | May depend on |
|---|---|---|---|---|
| CMP-<name> | | | | |

Dependency rule: <e.g. ui → app → domain ← infra; domain depends on nothing>

## 3. Data model
<entities, relations, key constraints; migration strategy>

## 4. Cross-cutting concerns
- Errors: …
- Validation: …
- Logging: …
- Configuration and secrets: …
- Authentication / authorization: …
- i18n / accessibility: …

## 5. User interface (when applicable)
- Component library / styling: … (ADR-…)
- Design tokens: colours, typography, spacing
- Navigation map: …
- State handling: …

### Screen inventory
| Screen | Layout regions | Data / components used | REQs |
|---|---|---|---|

### Key screen wireframes
```
<text wireframe>
```

## 6. Source layout
```
<directory tree> — <component mapping>; tests in <location>
```

## 7. Requirement allocation

| REQ / NFR | Components | Notes / tactic |
|---|---|---|

## 8. Risks

| ID | Risk | Likelihood | Impact | Mitigation / spike |
|---|---|---|---|---|

## 9. Operations (Full, or when OPS answers exist)
- Environments: …
- Deployment: …
- Observability: …
- Backup / restore: …

## 10. Decisions taken without asking
<!-- every "Agent decides" item from the questionnaire topics: decision + one-line reason -->
| Topic | Decision | Reason |
|---|---|---|

## 11. Decisions
See `docs/design/adr/`: <ADR-001 stack, …>

## Change history

| Date | CR | Change |
|---|---|---|
