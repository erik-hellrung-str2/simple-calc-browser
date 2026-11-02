# Guide: intake

Outcome and exit criteria: `kernel.md` §5. Defaults: `calibration/complexity.md`, `questionnaire/`. Role: orchestrator as interviewer.

## Approach that works

All questions go through the structured question interface (`kernel.md` §2 → Asking the user; Claude Code: `AskUserQuestion`) — never as a text list. Text messages carry the summary, the proposals' context and the progress; the questions themselves are in the call.

- **Listen first.** Without a description from `/start`, ask only C00 ("What would you like to build?") as one question; the user answers freely through "Other". Store the description verbatim in `docs/intake/answers.md`.
- **Mirror back** a short structured understanding (purpose, users, main use cases, form factor, notable constraints) as text, then confirm it in the next question round ("Is this summary right? Corrections into Other." → As summarised (Recommended) / the most likely alternative reading). Misunderstandings are cheapest here.
- **Fill only the gaps** of the core information needs (C01–C11) in as few rounds as possible, proposals as options. Always settle autonomy (C11: standard (Recommended) / guided / autonomous).
- **Assess** complexity with reasons (`calibration/complexity.md`), propose tier, track, modifiers, gates and the expected interview size, write `docs/intake/assessment.md`. Show the assessment as text and confirm the tier in the next round, together with the first detail questions, so confirming and answering is one step.
- **Plan the interview** from the information needs of the tier: mark what is already covered, add domain-specific needs, design questions that cover several needs at once, propose wherever you can derive an answer, most valuable first, in the user's language and at their level. Keep within the budget; beyond the ceiling only with consent (asked as a question too).
- **Ask in rounds** (≤ 4 questions per call, 2–4 options each, `multiSelect` for lists); record answers against need IDs after each round so the interview can resume in another session. A free answer "enough" or "you decide" ends the interview: fill the rest with visible assumptions.
- **Feature cycle** (later cycles): run a scoped intake — mirror the requested feature, ask only the information needs it raises, at the tier's depth; record in `docs/intake/answers-cycle-<n>.md`. Earlier answers stay untouched as a historic record.
- **Close** with C99 as one `multiSelect` question (No, that's all (Recommended) plus up to 3 derived candidates; anything else into "Other"), summarise what was captured, re-check the tier, initialize `docs/state.yaml`, commit.

## Shapes that work

Text, then a question round:
```
My understanding
- Purpose / users / main use cases / form factor / notable: …
Round 1/2 · Core — answer "enough" anytime through "Other" and I will decide the rest.
```
→ question call: `Summary` (As summarised (Recommended) / alternative reading), `Users` (proposal A (Recommended) / proposal B), `Autonomy` (standard (Recommended) / guided / autonomous), …

```
Complexity <score> → Tier <x> (<track>) — main drivers: …
Process: <phases> | your approvals: <gates> | ~<n> questions in ~<r> rounds
Round 1/<r> · Functional
```
→ question call: `Tier` (Tier <x> (Recommended) / one lower / one higher), then up to three detail questions.
