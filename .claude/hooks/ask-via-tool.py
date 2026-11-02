#!/usr/bin/env python3
"""Stop hook: questions to the user never end up as text.

process/kernel.md §2 → Asking the user: every question to the user — and every request
for a decision or input — goes through the structured question interface (Claude Code:
AskUserQuestion). This hook checks all text the user saw in the current turn that was
not asked through a successful AskUserQuestion call. If it contains questions or
requests for input, the turn is sent back with the instruction to use AskUserQuestion —
at most MAX_BLOCKS times per turn, counted from this hook's own feedback (not from the
shared `stop_hook_active` flag, which any Stop hook sets). Fails open: any error lets
Claude stop normally.
"""

import json
import re
import sys

MARKER = "[ask-via-tool]"
MAX_BLOCKS = 2
ASK_TOOL = "AskUserQuestion"

# "?" counts unless it is part of a URL, an operator or code (?=, ?., ?[, ??, x?y, %3F …)
QUESTION = re.compile(r"(?<!\?)[?？؟﹖‽⁇⁈⁉❓❔](?![=&%/#.\[\](:?]{0,2}[^\W_])(?!\?)")
# requests for input or a decision written without a question mark (en, de)
REQUEST = re.compile(
    r"\b(let me know|please (confirm|choose|pick|tell me|answer|reply|decide|select|specify"
    r"|provide)|tell me (which|what|whether|if|how)|reply with|waiting for your"
    r"|if you'?d (rather|prefer|like)|would you (like|prefer)"
    r"|\b(gib|sag) mir\b|teil mir mit|gib \w* ?bescheid|sag bescheid|lass mich wissen"
    r"|bitte (bestätig|wähl|entscheid|beantwort|antworte|nenn|gib|sag|teil|schreib)"
    r"|ich warte auf deine|antworte (mit|bitte)"
    r"|(falls|wenn) du\b.{0,120}\b(lieber|möchtest|willst)"
    r"|\b(bestätige|entscheide|wähle|antworte|nenne|prüfe|schreib|teile?) (mir )?bitte"
    r"|bitte um (deine )?(freigabe|entscheidung|rückmeldung|bestätigung|antwort)"
    r"|(warte|wartet|warten) auf deine|ich brauche deine|melde dich"
    r"|awaiting your|please (approve|review)|\bif you want\b|your call\b"
    r"|\bi need your (decision|approval|input|answer))",
    re.IGNORECASE,
)
FENCE = re.compile(r"^\s*(```|~~~)\s*([\w+-]*)")
PROSE_FENCES = {"", "text", "txt", "markdown", "md", "plain"}
NOISE = re.compile(r"<[^>]{1,40}>|&nbsp;|&#\d+;|[​‌‍﻿]")
CODE_OR_URL = re.compile(r"`[^`]*`|https?://\S+|\]\([^)]*\)")

REASON = (
    f"{MARKER} Text you showed the user in this turn contains questions or requests for "
    "input. Rule (process/kernel.md §2 → Asking the user, CLAUDE.md): every question, "
    "decision or request for input goes through the AskUserQuestion tool — never as text, "
    "with or without a question mark. Now: questions you still need answered → call "
    "AskUserQuestion (≤ 4 questions per call, 2–4 options each, your proposal first marked "
    "'(Recommended)', details via 'Other'; more questions → several calls) and do not repeat "
    "them as text. Questions that are already answered or only reported (status, recap, "
    "examples) → state them as facts, e.g. 'Q-003 payment provider (open)'; UI strings, "
    "log lines and code literals go in backticks; progress narration says what you check "
    "('Checking whether …'), not as a question. If "
    "AskUserQuestion is not in your tool list, load it (ToolSearch 'select:AskUserQuestion'); "
    "if it really cannot be used, end the turn reporting only that — without the questions."
)


def prompt_text(entry: dict) -> str:
    content = entry.get("message", {}).get("content")
    if isinstance(content, str):
        return content
    parts = [b.get("text", "") for b in content or [] if isinstance(b, dict)]
    return "\n".join(p for p in parts if isinstance(p, str))


def questions(text: str, user_prompt: str = "") -> list[str]:
    found, in_fence, prose_fence = [], False, False
    for line in text.splitlines():
        fence = FENCE.match(line)
        if fence:
            if in_fence:
                in_fence = False
            else:
                in_fence, prose_fence = True, fence.group(2).lower() in PROSE_FENCES
            continue
        if in_fence and not prose_fence:
            continue  # code
        plain = NOISE.sub(" ", CODE_OR_URL.sub(" ", line))
        quote = plain.strip().lstrip(">").strip()
        if plain.lstrip().startswith(">") and quote and quote in user_prompt:
            continue  # the user's own words, quoted back
        if QUESTION.search(plain) or REQUEST.search(plain):
            found.append(line.strip())
    return found


def covered(line: str, asked: str) -> bool:
    """A text question counts as asked if most of its words appear in the question call."""
    words = [w for w in re.findall(r"\w{4,}", line.lower()) if not w.isdigit()]
    return not words or sum(w in asked for w in words) >= len(words) / 2


def is_user_prompt(entry: dict) -> bool:
    if entry.get("type") != "user" or entry.get("isSidechain") or entry.get("isMeta"):
        return False
    if entry.get("isCompactSummary"):
        return False  # compaction summary, not a new user prompt
    content = entry.get("message", {}).get("content")
    if isinstance(content, str):
        return True
    return isinstance(content, list) and not any(
        isinstance(b, dict) and b.get("type") == "tool_result" for b in content
    )


def current_turn(path: str) -> tuple[str, str, int]:
    """(visible text not yet asked through AskUserQuestion, user prompt, own blocks so far).

    Text before a successful AskUserQuestion call counts as asked only where the call
    covers it; a failed or rejected call clears nothing. After this hook's own block
    only the text written since then is judged.
    """
    entries = []
    with open(path, encoding="utf-8", errors="replace") as f:
        for line in f:
            try:
                entries.append(json.loads(line))
            except ValueError:
                continue
    start = max((i for i, e in enumerate(entries) if is_user_prompt(e)), default=-1)
    prompt = prompt_text(entries[start]) if start >= 0 else ""
    texts: list[str] = []
    meta_blocks = summary_blocks = 0
    asks: dict[str, tuple[int, str]] = {}  # call id -> (len(texts) at the call, its input)
    for entry in entries[start + 1 :]:
        if entry.get("isSidechain"):
            continue
        kind = entry.get("type")
        if kind == "system" and entry.get("subtype") == "stop_hook_summary":
            if any(MARKER in str(err) for err in entry.get("hookErrors") or []):
                summary_blocks += 1
                texts = []  # already sent back for this text; judge only what follows
            continue
        if kind == "user" and entry.get("isMeta") and MARKER in prompt_text(entry):
            meta_blocks += 1
            texts = []
            continue
        content = entry.get("message", {}).get("content")
        if kind == "user" and isinstance(content, list):
            for block in content:
                answered = (
                    isinstance(block, dict)
                    and block.get("type") == "tool_result"
                    and block.get("tool_use_id") in asks
                    and not block.get("is_error")
                )
                if answered:  # keep only text questions the successful call did not cover
                    n, asked = asks.pop(block["tool_use_id"])
                    earlier = questions("\n".join(texts[:n]), prompt)
                    texts = [q for q in earlier if not covered(q, asked)] + texts[n:]
        if kind != "assistant":
            continue
        for block in content or []:
            if not isinstance(block, dict):
                continue
            if block.get("type") == "tool_use" and block.get("name") == ASK_TOOL:
                asked = json.dumps(block.get("input"), ensure_ascii=False).lower()
                asks[block.get("id")] = (len(texts), asked)
            elif block.get("type") == "text":
                texts.append(block.get("text", ""))
    return "\n".join(texts), prompt, max(meta_blocks, summary_blocks)


def main() -> int:
    data = json.load(sys.stdin)
    text, prompt, blocks = "", "", 0
    path = data.get("transcript_path")
    try:
        text, prompt, blocks = current_turn(path)
    except (OSError, TypeError):
        if data.get("stop_hook_active"):
            return 0  # cannot count own blocks without the transcript: never loop
    last = data.get("last_assistant_message")
    if isinstance(last, str) and last.strip() and last.strip() not in text:
        text = f"{text}\n{last}"  # the transcript may lag behind the final message
    if blocks >= MAX_BLOCKS:
        return 0  # this hook already sent the turn back MAX_BLOCKS times; never loop
    if questions(text, prompt):
        print(json.dumps({"decision": "block", "reason": REASON}))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:  # fail open: never prevent Claude from stopping because of the hook
        sys.exit(0)
