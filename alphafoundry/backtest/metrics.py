from __future__ import annotations

import math
import numpy as np
import pandas as pd


def max_drawdown(equity: pd.Series) -> float:
    peak = equity.cummax()
    dd = (equity / peak - 1.0).min()
    return float(dd * 100)


def sharpe(returns: pd.Series, periods_per_year: int = 252) -> float:
    r = returns.dropna()
    if len(r) < 2 or r.std() == 0 or np.isnan(r.std()):
        return 0.0
    return float(math.sqrt(periods_per_year) * r.mean() / r.std())


def summarize(equity: pd.Series, strategy_returns: pd.Series, trades: int) -> dict:
    total_return = float((equity.iloc[-1] / equity.iloc[0] - 1.0) * 100) if len(equity) else 0.0
    mdd = max_drawdown(equity) if len(equity) else 0.0
    sh = sharpe(strategy_returns)
    return {
        "total_return_pct": round(total_return, 4),
        "sharpe": round(sh, 4),
        "max_drawdown_pct": round(mdd, 4),
        "trades": int(trades),
        "bars": int(len(equity)),
    }
