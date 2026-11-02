@AGENTS.md

## Claude Code

- **Every question to the user goes through the `AskUserQuestion` tool** — interview, follow-ups, confirmations, gate and change approvals, blocking questions, offers and choices ("if you'd rather …", "let me know …"), with or without a question mark (`process/kernel.md` §2 → Asking the user). Never as text, neither as a list nor as a single sentence; the text before the call carries only context and progress. More than 4 questions → several calls. Notes and corrections go into "Other".
- If `AskUserQuestion` is not in your tool list, load it (`ToolSearch` with `select:AskUserQuestion`). The text fallback of the kernel does not apply to Claude Code: if the tool truly cannot be used, report that and stop — without the questions as text.
- Sub-agents never ask the user; they return their questions to the main agent, which asks them.
- Everything else you write states facts: open questions as `Q-003 payment provider — open`, progress as "Checking whether …", UI strings and code literals in backticks.
- The Stop hook `.claude/hooks/ask-via-tool.py` sends a turn back (at most twice per turn) if text shown to the user contains questions or requests for input not asked through a successful `AskUserQuestion` call.
