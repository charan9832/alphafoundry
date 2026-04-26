from __future__ import annotations


def risk_check(metrics: dict, max_drawdown_pct: float = 25.0) -> tuple[bool, str]:
    dd = abs(float(metrics.get("max_drawdown_pct", 0.0)))
    if dd > max_drawdown_pct:
        return False, f"max drawdown {dd:.2f}% exceeds limit {max_drawdown_pct:.2f}%"
    return True, "risk checks passed"
