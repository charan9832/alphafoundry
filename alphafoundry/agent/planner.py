from __future__ import annotations


def idea_to_template(idea: str) -> str:
    text = idea.lower()
    if "breakout" in text:
        return "breakout"
    if "mean" in text or "reversion" in text or "rsi" in text:
        return "mean_reversion"
    return "momentum"
