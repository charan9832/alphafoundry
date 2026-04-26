from __future__ import annotations

from dataclasses import dataclass
import pandas as pd

from .metrics import summarize


@dataclass
class BacktestResult:
    equity: pd.Series
    returns: pd.Series
    signals: pd.Series
    metrics: dict


def run_backtest(close: pd.Series, signals: pd.Series, initial_cash: float = 100_000, fee_bps: float = 5, slippage_bps: float = 5) -> BacktestResult:
    close = close.astype(float).dropna()
    signals = signals.reindex(close.index).fillna(0.0).clip(-1.0, 1.0)
    # Use yesterday's signal for today's return to avoid look-ahead.
    position = signals.shift(1).fillna(0.0)
    raw_returns = close.pct_change().fillna(0.0)
    turnover = position.diff().abs().fillna(position.abs())
    cost = turnover * ((fee_bps + slippage_bps) / 10_000.0)
    strategy_returns = (position * raw_returns) - cost
    equity = initial_cash * (1.0 + strategy_returns).cumprod()
    trades = int((turnover > 0).sum())
    metrics = summarize(equity, strategy_returns, trades)
    metrics.update({"fee_bps": fee_bps, "slippage_bps": slippage_bps})
    return BacktestResult(equity=equity, returns=strategy_returns, signals=signals, metrics=metrics)
