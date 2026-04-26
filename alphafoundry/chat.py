from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


@dataclass
class ChatIntent:
    action: str
    name: str | None = None
    template: str = "momentum"
    symbol: str = "SAMPLE"
    confidence: float = 0.7
    message: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


_TEMPLATE_KEYWORDS = {
    "mean_reversion": ["mean reversion", "mean-reversion", "reversion", "revert"],
    "breakout": ["breakout", "break out", "break-through", "resistance"],
    "momentum": ["momentum", "trend", "trending"],
}

_STOPWORDS = {
    "strategy", "strat", "called", "named", "name", "for", "on", "the", "a", "an", "and", "run", "full", "pipeline",
    "everything", "create", "make", "build", "show", "status", "of", "my", "do", "i", "have", "what", "strategies",
}


def parse_message(message: str) -> ChatIntent:
    """Parse a natural-language AlphaFoundry request into a deterministic intent.

    This is intentionally rule-based for the MVP so the CLI can talk and act
    without requiring paid LLM calls or network access. It can be replaced by an
    LLM parser later while keeping the same ChatIntent contract.
    """
    original = message.strip()
    text = original.lower()

    template = _extract_template(text)
    symbol = _extract_symbol(original) or "SAMPLE"

    if any(word in text for word in ["help", "what can you do", "how do i"]):
        return ChatIntent(action="help", template=template, symbol=symbol, confidence=0.9, message=original)

    if any(phrase in text for phrase in ["what strategies", "list strategies", "show strategies", "strategies do i have"]):
        return ChatIntent(action="list", template=template, symbol=symbol, confidence=0.9, message=original)

    if "status" in text or text.startswith("show "):
        return ChatIntent(action="status", name=_extract_name(original) or _last_word_name(text), template=template, symbol=symbol, confidence=0.85, message=original)

    if any(word in text for word in ["run", "pipeline", "everything", "backtest", "validate", "paper"]):
        return ChatIntent(action="run", name=_extract_name(original) or _default_name(symbol, template), template=template, symbol=symbol, confidence=0.85, message=original)

    if any(word in text for word in ["create", "make", "build", "new"]):
        return ChatIntent(action="create", name=_extract_name(original) or _default_name(symbol, template), template=template, symbol=symbol, confidence=0.75, message=original)

    return ChatIntent(action="help", template=template, symbol=symbol, confidence=0.3, message=original)


def _extract_template(text: str) -> str:
    for template, keywords in _TEMPLATE_KEYWORDS.items():
        if any(keyword in text for keyword in keywords):
            return template
    return "momentum"


def _extract_symbol(message: str) -> str | None:
    # Prefer explicit "for SPY" / "on AAPL" patterns. Ignore all-caps command words.
    match = re.search(r"\b(?:for|on)\s+([A-Z]{1,6})\b", message)
    if match:
        candidate = match.group(1).upper()
        if candidate not in {"CSV", "JSON", "MVP"}:
            return candidate
    return None


def _extract_name(message: str) -> str | None:
    match = re.search(r"\b(?:called|named|name)\s+([A-Za-z][A-Za-z0-9_-]*)\b", message, flags=re.IGNORECASE)
    if match:
        return _clean_name(match.group(1))
    return None


def _last_word_name(text: str) -> str | None:
    tokens = re.findall(r"[a-zA-Z][a-zA-Z0-9_-]*", text)
    useful = [t for t in tokens if t not in _STOPWORDS]
    if useful:
        return _clean_name(useful[-1])
    return None


def _default_name(symbol: str, template: str) -> str:
    return _clean_name(f"{symbol.lower()}_{template}")


def _clean_name(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_-]+", "_", value.strip().lower()).strip("_")
    return cleaned or "strategy"
