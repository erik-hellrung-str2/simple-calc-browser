# Topic: technology (STK)

Asked last: technology follows requirements. Skip STK-01 if C10 already fixes the stack.

Stack preference when delegated: mainstream, well-documented technologies with strong typing, a fast test runner, a standard formatter/linter and a large ecosystem. These maximize AI agent reliability and long-term maintainability.

Rows are information needs; the phrasing is an example — formulate the best question for the project (`process/questionnaire/README.md`).

| ID | Level | Information need — example phrasing |
|---|---|---|
| STK-01 | XS | Here is the stack I propose (language, framework, storage, runtime version) and why. Asked as: proposed stack (Recommended) / the main alternative. |
| STK-02 | M | Constraints: license rules for dependencies and this project, mandatory tools or conventions (package manager, monorepo, CI system), who will maintain the code later and in which technologies they are fluent? |

Agent decides (shown at the design gate): libraries, build and test tooling, formatter/linter configuration.
