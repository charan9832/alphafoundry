import pandas as pd
from alphafoundry.backtest.metrics import max_drawdown, sharpe


def test_max_drawdown_detects_drop():
    eq = pd.Series([100, 120, 90, 110])
    assert round(max_drawdown(eq), 2) == -25.0


def test_sharpe_zero_for_constant_returns():
    assert sharpe(pd.Series([0, 0, 0])) == 0.0
