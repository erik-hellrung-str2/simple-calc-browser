# Topic: user interface (UI)

Goal: how users interact with the system. Part A for a graphical UI (web, mobile, desktop), part B for CLI, API or library; both if both. Always propose the derived screen or command list.

## A. Graphical user interface

Rows are information needs; the phrasing is an example — formulate the best question for the project (`process/questionnaire/README.md`).

| ID | Level | Information need — example phrasing |
|---|---|---|
| UI-01 | XS | Screens and devices: here is the screen list I derived from the use cases, with the start screen. Missing or unnecessary? Desktop, tablet, phone — responsive or mobile-first? |
| UI-02 | S | Look and feel: style (minimal, modern, playful, corporate, …), branding (logo, colours, fonts), existing mockups or reference products to imitate or avoid? |
| UI-03 | M | Navigation and interaction: here is the proposed navigation and the key interaction patterns (forms, editable tables, drag and drop, upload, charts, real-time updates). Correct? Expert tool or simple guided UI? |
| UI-04 | M | Accessibility and languages: accessibility target (default proposal: WCAG 2.2 AA), UI languages, date/number/currency formats? |
| UI-05 | L | Onboarding and help, dark mode / white-label theming, usability validation (user tests, analytics)? |

Agent decides (shown at the design gate): UI component library and design tokens (unless UI-02 prescribes), loading/empty/error states, confirmation before destructive actions, keyboard operation, responsive breakpoints.

## B. Command-line, API or library interface

| ID | Level | Information need — example phrasing |
|---|---|---|
| UI-20 | XS | Interface: here are the proposed commands and flags / endpoints / public functions and the output format (human-readable, JSON, files). Correct? |
| UI-21 | S | Error and documentation expectations: error format and exit/status codes, help text, README examples, OpenAPI or generated API docs? |
| UI-22 | L | Versioning, backwards compatibility and deprecation; SDKs, client libraries or shell completions? |

Agent decides (shown at the design gate): naming and flag conventions (POSIX/GNU, REST style), verbosity levels, logging to stderr.
