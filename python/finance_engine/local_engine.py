#!/usr/bin/env python3
"""Deterministic local finance engine for AlphaFoundry.

This is intentionally stdlib-only and local-first. It provides a stable JSON
contract for the TypeScript agent shell while the real finance engine evolves.
It never talks to brokers, places orders, or fetches live data.
"""

from __future__ import annotations

import json
import math
import random
import re
import sys
from datetime import date, datetime, timezone
from typing import Any


def stable_seed(*parts: str) -> int:
    seed = 0
    for part in parts:
        for char in part:
            seed = (seed * 131 + ord(char)) % 2_147_483_647
    return seed or 42


def price_series(symbol: str, start: str, end: str, points: int = 252) -> list[float]:
    rng = random.Random(stable_seed(symbol, start, end))
    price = 100.0 + (stable_seed(symbol) % 75)
    prices: list[float] = []
    for i in range(points):
        drift = 0.00025
        seasonal = math.sin(i / 18.0) * 0.0015
        shock = rng.uniform(-0.018, 0.018)
        price = max(1.0, price * (1 + drift + seasonal + shock))
        prices.append(round(price, 2))
    return prices


def max_drawdown_pct(equity: list[float]) -> float:
    peak = equity[0]
    worst = 0.0
    for value in equity:
        peak = max(peak, value)
        drawdown = (value - peak) / peak * 100
        worst = min(worst, drawdown)
    return round(worst, 2)


def run_backtest(symbol: str, start: str, end: str, strategy: str, initial_capital: float, fast_window: int = 20, slow_window: int = 50, fees_bps: int = 5, slippage_bps: int = 10) -> dict[str, Any]:
    prices = price_series(symbol, start, end)
    fast_window = int(fast_window)
    slow_window = int(slow_window)
    if fast_window <= 1 or slow_window <= fast_window:
        raise ValueError("fast_window must be >1 and slow_window must be greater than fast_window")
    cash = float(initial_capital)
    shares = 0.0
    equity: list[float] = []
    trades = 0
    cost_rate = (fees_bps + slippage_bps) / 10_000

    for index, price in enumerate(prices):
        if index < slow_window:
            equity.append(round(cash + shares * price, 2))
            continue
        fast = sum(prices[index - fast_window:index]) / fast_window
        slow = sum(prices[index - slow_window:index]) / slow_window
        target_in_market = fast > slow
        if target_in_market and shares == 0:
            execution_price = price * (1 + cost_rate)
            shares = cash / execution_price
            cash = 0.0
            trades += 1
        elif not target_in_market and shares > 0:
            execution_price = price * (1 - cost_rate)
            cash = shares * execution_price
            shares = 0.0
            trades += 1
        equity.append(round(cash + shares * price, 2))

    final_equity = equity[-1]
    total_return_pct = round((final_equity - initial_capital) / initial_capital * 100, 2)
    validation_passed = len(prices) >= 100 and trades > 0 and all(p > 0 for p in prices)
    warnings = [
        "Deterministic local data; replace with provider-backed historical data before relying on conclusions.",
        "Research and paper validation only; no live trading or profit guarantees.",
    ]
    if not validation_passed:
        warnings.append("Validation failed because the scaffold strategy did not produce enough evidence.")

    return {
        "symbol": symbol,
        "strategy": strategy,
        "start": start,
        "end": end,
        "data": {
            "provider": "deterministic-local-data",
            "points": len(prices),
            "firstPrice": prices[0],
            "lastPrice": prices[-1],
        },
        "assumptions": {
            "initialCapital": round(initial_capital, 2),
            "feesBps": fees_bps,
            "slippageBps": slippage_bps,
            "liveTrading": False,
        },
        "metrics": {
            "finalEquity": round(final_equity, 2),
            "totalReturnPct": total_return_pct,
            "maxDrawdownPct": max_drawdown_pct(equity),
            "trades": trades,
        },
        "validation": {
            "passed": validation_passed,
            "checks": {
                "positivePrices": all(p > 0 for p in prices),
                "enoughData": len(prices) >= 100,
                "hasTrades": trades > 0,
                "liveTradingDisabled": True,
            },
        },
        "warnings": warnings,
    }


def run_validation_suite(symbol: str, start: str, end: str, strategy: str, initial_capital: float) -> dict[str, Any]:
    baseline = run_backtest(symbol, start, end, strategy, initial_capital)
    high_cost = run_backtest(symbol, start, end, strategy, initial_capital, fees_bps=20, slippage_bps=30)
    fast_variants = [10, 15, 20, 25, 30]
    sensitivity = []
    for fast in fast_variants:
        slow = fast * 2 + 10
        result = run_backtest(symbol, start, end, strategy, initial_capital, fast_window=fast, slow_window=slow)
        sensitivity.append({"fastWindow": fast, "slowWindow": slow, "totalReturnPct": result["metrics"]["totalReturnPct"], "maxDrawdownPct": result["metrics"]["maxDrawdownPct"], "trades": result["metrics"]["trades"]})
    midpoint_note = "Synthetic deterministic scaffold uses fixed generated points; chronological split is represented as a guarded research check, not provider-backed walk-forward evidence."
    passed = baseline["validation"]["passed"] and high_cost["metrics"]["finalEquity"] > 0 and len(sensitivity) == len(fast_variants)
    warnings = [
        "Research and paper validation only; validation does not imply future performance.",
        "Current validation uses deterministic local scaffold data, not audited historical provider data.",
        midpoint_note,
    ]
    return {
        "symbol": symbol,
        "strategy": strategy,
        "start": start,
        "end": end,
        "provider": "local-python-deterministic-engine",
        "baseline": baseline["metrics"],
        "checks": {
            "baselinePassed": baseline["validation"]["passed"],
            "costStressPositiveEquity": high_cost["metrics"]["finalEquity"] > 0,
            "sensitivityCompleted": len(sensitivity) == len(fast_variants),
            "walkForwardGuardrailDocumented": True,
            "liveTradingDisabled": True,
        },
        "costStress": {
            "baselineFeesBps": baseline["assumptions"]["feesBps"],
            "baselineSlippageBps": baseline["assumptions"]["slippageBps"],
            "stressFeesBps": high_cost["assumptions"]["feesBps"],
            "stressSlippageBps": high_cost["assumptions"]["slippageBps"],
            "stressTotalReturnPct": high_cost["metrics"]["totalReturnPct"],
        },
        "sensitivity": sensitivity,
        "passed": passed,
        "warnings": warnings,
    }


def optimize_strategy(symbol: str, start: str, end: str, strategy: str, initial_capital: float) -> dict[str, Any]:
    candidates = []
    for fast in [10, 15, 20, 25, 30]:
        for slow in [40, 50, 60, 80]:
            if slow <= fast:
                continue
            result = run_backtest(symbol, start, end, strategy, initial_capital, fast_window=fast, slow_window=slow)
            candidates.append({
                "fastWindow": fast,
                "slowWindow": slow,
                "objective": "totalReturnPct_with_drawdown_warning",
                "totalReturnPct": result["metrics"]["totalReturnPct"],
                "maxDrawdownPct": result["metrics"]["maxDrawdownPct"],
                "trades": result["metrics"]["trades"],
            })
    candidates.sort(key=lambda item: (item["totalReturnPct"], item["maxDrawdownPct"]), reverse=True)
    best = candidates[0]
    warnings = [
        "Bounded parameter search can overfit; treat the best candidate as a hypothesis only.",
        "Use provider-backed historical data and out-of-sample validation before drawing conclusions.",
        "Research and paper validation only; no live trading or profit guarantees.",
    ]
    return {
        "symbol": symbol,
        "strategy": strategy,
        "start": start,
        "end": end,
        "provider": "local-python-deterministic-engine",
        "grid": {"fastWindow": [10, 15, 20, 25, 30], "slowWindow": [40, 50, 60, 80]},
        "objective": "maximize totalReturnPct while reporting drawdown/trades",
        "best": best,
        "topCandidates": candidates[:5],
        "candidateCount": len(candidates),
        "warnings": warnings,
        "liveTrading": False,
    }


def report_markdown(result: dict[str, Any]) -> str:
    metrics = result["metrics"]
    assumptions = result["assumptions"]
    validation = result["validation"]
    warnings = result["warnings"]
    lines = [
        f"# {result['symbol']} {result['strategy']} Research Report",
        "",
        "Research and paper validation only. No live trading, broker access, order placement, or profit guarantees.",
        "",
        "## Inputs",
        f"- Symbol: {result['symbol']}",
        f"- Strategy: {result['strategy']}",
        f"- Period: {result['start']} to {result['end']}",
        f"- Data provider: {result['data']['provider']}",
        f"- Data points: {result['data']['points']}",
        "",
        "## Assumptions",
        f"- Initial capital: ${assumptions['initialCapital']}",
        f"- Fees: {assumptions['feesBps']} bps",
        f"- Slippage: {assumptions['slippageBps']} bps",
        f"- Live trading: {str(assumptions['liveTrading']).lower()}",
        "",
        "## Metrics",
        f"- Final equity: ${metrics['finalEquity']}",
        f"- Total return: {metrics['totalReturnPct']}%",
        f"- Max drawdown: {metrics['maxDrawdownPct']}%",
        f"- Trades: {metrics['trades']}",
        "",
        "## Validation",
        f"- Passed: {str(validation['passed']).lower()}",
    ]
    for name, passed in validation["checks"].items():
        lines.append(f"- {name}: {str(passed).lower()}")
    lines.extend(["", "## Warnings"])
    lines.extend(f"- {warning}" for warning in warnings)
    lines.extend(["", "## Next step", "Replace the deterministic local data provider with audited historical data, then rerun validation before drawing conclusions."])
    return "\n".join(lines)


def validate_symbol(symbol: str) -> str:
    cleaned = symbol.upper().strip()
    if not re.fullmatch(r"[A-Z0-9._-]{1,12}", cleaned):
        raise ValueError("Invalid symbol. Use 1-12 uppercase letters, numbers, dot, dash, or underscore.")
    return cleaned


def validate_date(value: str) -> str:
    parsed = date.fromisoformat(value)
    return parsed.isoformat()


def handle_request(request: dict[str, Any]) -> dict[str, Any]:
    method = request.get("method")
    params = request.get("params", {})
    if method == "ping":
        return {
            "ok": True,
            "data": {"engine": "alphafoundry-python-finance-engine", "status": "ready"},
            "metadata": {"provider": "local-python", "timestamp": datetime.now(timezone.utc).isoformat()},
        }
    if method in {"run_backtest", "run_research_workflow", "run_validation_suite", "optimize_strategy"}:
        symbol = validate_symbol(str(params.get("symbol", "SPY")) or "SPY")
        start = validate_date(str(params.get("start", "2020-01-01")))
        end = validate_date(str(params.get("end", "2024-12-31")))
        strategy = str(params.get("strategy", "moving-average-trend-baseline"))
        initial_capital = float(params.get("initialCapital", 10_000))
        if method in {"run_backtest", "run_research_workflow"}:
            result = run_backtest(symbol, start, end, strategy, initial_capital)
            report = report_markdown(result)
            data: dict[str, Any] = {"backtest": result, "reportMarkdown": report}
            warnings = result["warnings"]
        elif method == "run_validation_suite":
            data = run_validation_suite(symbol, start, end, strategy, initial_capital)
            warnings = data["warnings"]
        else:
            data = optimize_strategy(symbol, start, end, strategy, initial_capital)
            warnings = data["warnings"]
        return {
            "ok": True,
            "data": data,
            "metadata": {
                "provider": "local-python-deterministic-engine",
                "symbol": symbol,
                "start": start,
                "end": end,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "warnings": warnings,
            },
        }
    return {"ok": False, "error": f"Unknown finance engine method: {method}", "metadata": {"provider": "local-python"}}


def main() -> int:
    try:
        raw = sys.stdin.read().strip()
        request = json.loads(raw or "{}")
        response = handle_request(request)
        print(json.dumps(response, sort_keys=True))
        return 0 if response.get("ok") else 2
    except Exception as exc:  # pragma: no cover - CLI defensive boundary
        print(json.dumps({"ok": False, "error": f"Finance engine rejected request: {exc.__class__.__name__}", "metadata": {"provider": "local-python"}}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
