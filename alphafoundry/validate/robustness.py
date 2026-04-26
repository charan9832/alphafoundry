from __future__ import annotations

from pathlib import Path

from alphafoundry.backtest.engine import run_backtest
from alphafoundry.data.providers import load_data
from alphafoundry.strategies.registry import generate_signals


def robust_alpha_score(metrics: dict) -> float:
    # Simple transparent MVP score. Penalizes drawdown, low trades, and cost fragility.
    score = metrics.get("sharpe", 0.0) * 25
    score += metrics.get("total_return_pct", 0.0) * 0.5
    score += metrics.get("max_drawdown_pct", 0.0) * 1.2  # drawdown is negative
    if metrics.get("trades", 0) < 5:
        score -= 15
    return round(float(score), 4)


def validate_strategy(strategy_py: Path, data_path: Path, split: float = 0.7) -> dict:
    df = load_data(data_path)
    close = df["close"]
    cut = max(2, int(len(close) * split))
    train_close = close.iloc[:cut]
    test_close = close.iloc[cut-1:]
    train_signals = generate_signals(strategy_py, train_close)
    test_signals = generate_signals(strategy_py, test_close)
    train = run_backtest(train_close, train_signals)
    test = run_backtest(test_close, test_signals)
    stressed = run_backtest(test_close, test_signals, fee_bps=15, slippage_bps=15)
    output = {
        "train": train.metrics,
        "test": test.metrics,
        "stressed": stressed.metrics,
    }
    output["robust_alpha_score"] = robust_alpha_score(test.metrics)
    output["passed"] = bool(output["robust_alpha_score"] > 0 and test.metrics["trades"] >= 1)
    return output
