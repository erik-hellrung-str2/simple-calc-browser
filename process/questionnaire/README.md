# Questionnaire — a framework, not a script

The questionnaire defines **what must be known** at the end of the intake, not the exact questions. The agent formulates the best questions for this particular project: in the user's language and at their level of expertise, combined where it makes sense, enriched with domain-specific questions, and skipping whatever is already clear. The framework keeps this within a reasonable scope.

| Stage | File | Purpose |
|---|---|---|
| 1. Opening | `core.md` → C00 | One open question: what should be built? The user describes it freely. |
| 2. Core | `core.md` → C01–C11 | Information needed to score complexity; ask only for gaps. |
| 3. Detail | `topics/*.md` | Information needed per topic — functional, UI, data, integrations, security, quality, operations, existing systems, technology. Which needs apply depends on the tier. |

## How to read the topic files

- Each row is an **information need** with an ID, a level and an *example phrasing*. The example shows what the need is about; it is never asked verbatim as text — turn it into option questions (one subject each) for the question interface.
- **Levels** `XS`, `S`, `M`, `L` match the project tiers. A project must cover the needs of its own level and all levels below (an S project covers XS + S).
- **"Agent decides"** lists what the agent settles itself in the design phase and shows at the design gate — never asked during intake.
- A need is **covered** when it is answered, a proposal was confirmed, it was delegated ("you decide" → `ASM-###`), it is irrelevant for this project (with reason), or it is recorded as an open question `Q-###`.

## Framework (the "reasonable scope")

| Rule | |
|---|---|
| **Coverage** | Every required need of the tier is covered before the intake ends. Answers are recorded against the need IDs, so the coverage is traceable. |
| **Budget** | Stay within the question budget of the tier (`process/calibration/complexity.md` §4). The ceiling may only be exceeded with the user's consent, asked as a question ("<n> more questions about <topic>" → You decide (Recommended) — description: "shown at the design gate" / Continue asking). |
| **Rounds** | Every question goes through the structured question interface (`process/kernel.md` §2 → Asking the user) — never as a text list. One round = one call with ≤ 4 questions (Claude Code's limit), each with 2–4 options: your proposals, the recommended one first and marked "(Recommended)"; `multiSelect` for up to 4 candidates; free text through "Other". Header ≤ 12 characters (`UI`, `FUN-01`), labels 1–5 words, rationale in the option description (kernel §2 → Asking the user). The text before the call shows progress (`Round 2/6 · User interface`) and any context, and contains no questions. |
| **Stop on request** | The text before the first round says that "enough" or "you decide the rest" (typed as a free answer) ends the interview. If the user says so, stop asking: cover the remaining needs with proposals and `ASM-###`, show them as a list, continue. |
| **Freedom** | Combine needs into one question, split a need, reorder, add domain-specific questions (e.g. cancellation rules for a booking system, scoring rules for a game). Domain-specific questions count against the budget and get IDs `<TOPIC>-x#` (e.g. `FUN-x1`). |

## What makes a good question

1. **Only what only the user can answer.** A question earns its place if (a) the answer cannot be derived from the description, the code or common practice, and (b) a wrong assumption would be expensive to correct later — goals, rules, priorities, examples, constraints, look and feel.
2. **Listen first.** Never start with a list of questions. Ask C00 — one question in the question interface, the user describes the project in their own words through the free-text answer ("Other").
3. **Mirror back.** Restate your understanding in a short structured summary (purpose, users, main use cases, notable constraints) so misunderstandings surface early.
4. **Propose instead of asking open.** Wherever an answer can be derived (use cases, screens, entities, roles, stack, targets), offer it as an option (the recommended one first) so the user just picks it or corrects it through "Other". Say in the option's description whether it comes from what the user said or from common practice. Several related proposals can be one question: list them in the text before the call and ask "Use cases as listed?" → As listed (Recommended) / the most likely alternative; corrections go into "Other".
5. **Concrete and answerable.** One subject per question, answerable by picking an option or with one sentence in "Other". Use examples from the user's own domain. Say why you ask when it is not obvious.
6. **Adapt to the person.** Match the user's language and expertise: no technical jargon for a non-technical user; precise technical options for a developer.
7. **Most valuable first.** Order questions by how much the answer changes the outcome. When the budget gets tight, the least valuable needs become proposals.
8. **Follow the answers.** Skip needs that earlier answers make irrelevant; follow up when an answer reveals something important.
9. **Accept any form.** Free text, partial answers, bullet lists, "unknown", "you decide" — in "Other"; sketches, files and links the user can send in a normal message whenever the agent stops (after the interview at the latest). Map answers to need IDs yourself; ask again only if an answer is ambiguous and matters.
10. **Close every interview** with C99 as one `multiSelect` question: "Anything important I haven't asked about? Anything else into Other." → No, that's all (Recommended) plus up to 3 concrete candidates you derive (e.g. a deadline worry, a feature for later, a constraint).

## Recording

- Answers in `docs/intake/answers.md`, verbatim + normalized, per need ID, with source `user`, `user-confirmed`, `inferred`, `delegated`, `unknown` or `n/a` (irrelevant, with reason).
- Every `unknown` that matters later → `Q-###`; every `delegated` → `ASM-###` or a later ADR.
