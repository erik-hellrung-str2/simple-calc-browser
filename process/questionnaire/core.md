# Core questionnaire

## Opening (always first)

| ID | Question |
|---|---|
| C00 | **What would you like to build?** Describe it in your own words: the idea, the problem it solves, who will use it, what it should be able to do, and anything you already have in mind — look and feel, technology, existing systems, deadlines. Rough is fine; I will ask detailed questions afterwards. |

Skip C00 only if `/start` was called with a description or material; treat that as the C00 answer.

Ask C00 through the question interface (`process/kernel.md` §2 → Asking the user) as one question: the text above invites a free description through "Other"; the options are rough kinds of software (e.g. script/CLI tool, web application, mobile or desktop app, API/service) for users who prefer to pick one; the core gap questions (C02, C03, …) then fill in what a picked kind leaves open.

## Core questions (gap filling)

After C00: map the description to C01–C11. These are information needs; ask in your own words only what is still open or vague, in as few question rounds as possible (≤ 4 questions per round), proposals as options. Mention that partial answers, "unknown" and "you decide" are fine. If the description answered everything, ask only for confirmation of the summary and C11.

| ID | Information need — example phrasing | Scores | Expected answer |
|---|---|---|---|
| C01 | Project name and one-sentence purpose? | — | name + sentence (usually proposed) |
| C02 | What problem does it solve, for whom, and how is it handled today? Which user groups / roles are there, and do they see or may they do different things? | D2, D8 | text + roles |
| C03 | What must the first release be able to do (one line each)? What is explicitly out of scope or for later? | D1 | two lists |
| C04 | Form factor and where it runs: script/CLI, web app, mobile, desktop, API/service, library, batch job, …; local, cloud, on-prem, app store, package registry? | D5 | text |
| C05 | What data does it store or process, roughly how much, and is any of it personal, financial, health or otherwise sensitive? | D3, D7 | text |
| C06 | Which external systems, APIs, identity or payment providers, devices or files must it connect to? | D4 | list or "none" |
| C07 | Usage and protection: number of users and load, speed and uptime expectations; login needed; regulations or standards (GDPR, HIPAA, PCI-DSS, accessibility law, …)? | D6, D7 | text or "normal / none" |
| C08 | Greenfield, or existing code/systems to extend, integrate with, or replace? (link/path) | D10 | text |
| C09 | Lifetime and success: demo, MVP or long-lived product; who maintains it; what makes the first release a success; deadline; speed or robustness first? | D9 | text |
| C10 | Technology preferences or constraints (languages, frameworks, databases, cloud, licenses) — or "you decide"? Any open technical questions or unproven ideas? | D8 | text |
| C11 | How much autonomy should the agents have? `standard` (you approve intake, requirements/spec, design and release; Full track also increments), `guided` (you approve every phase), `autonomous` (you approve intake and release only). | — | one value; default `standard` |

## Closing (end of the detail questions)

| ID | Question |
|---|---|
| C99 | Is there anything important I haven't asked about — wishes, worries, constraints, ideas for later? |
