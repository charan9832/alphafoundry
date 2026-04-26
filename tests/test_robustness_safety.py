import pandas as pd

from alphafoundry.backtest.engine import run_backtest
from alphafoundry.risk.guard import risk_check
from alphafoundry.strategies.registry import generate_signals
from alphafoundry.validate.robustness import robust_alpha_score


def test_backtest_uses_previous_bar_signal_to_avoid_lookahead():
    close = pd.Series([100.0, 110.0], index=pd.date_range("2024-01-01", periods=2))
    # If same-bar signal were used, this would profit on the 10% jump. Correct no-lookahead behavior earns 0.
    signals = pd.Series([0.0, 1.0], index=close.index)
    result = run_backtest(close, signals, fee_bps=0, slippage_bps=0)
    assert result.metrics["total_return_pct"] == 0.0


def test_transaction_costs_reduce_returns():
    close = pd.Series([100.0, 110.0, 121.0], index=pd.date_range("2024-01-01", periods=3))
    signals = pd.Series([1.0, 1.0, 1.0], index=close.index)
    no_cost = run_backtest(close, signals, fee_bps=0, slippage_bps=0)
    with_cost = run_backtest(close, signals, fee_bps=50, slippage_bps=50)
    assert with_cost.metrics["total_return_pct"] < no_cost.metrics["total_return_pct"]


def test_robust_alpha_score_penalizes_drawdown_and_low_trades():
    strong = {"sharpe": 1.5, "total_return_pct": 20, "max_drawdown_pct": -5, "trades": 20}
    weak = {"sharpe": 1.5, "total_return_pct": 20, "max_drawdown_pct": -50, "trades": 1}
    assert robust_alpha_score(weak) < robust_alpha_score(strong)


def test_generate_signals_clips_strategy_output(tmp_path):
    strategy = tmp_path / "strategy.py"
    strategy.write_text(
        "import pandas as pd\n"
        "def generate_signals(prices):\n"
        "    return pd.Series([2.5, -3.0, 0.5], index=prices.index)\n"
    )
    close = pd.Series([1.0, 2.0, 3.0])
    signals = generate_signals(strategy, close)
    assert signals.tolist() == [1.0, -1.0, 0.5]


def test_risk_guard_blocks_excessive_drawdown():
    ok, message = risk_check({"max_drawdown_pct": -30.0}, max_drawdown_pct=25.0)
    assert not ok
    assert "exceeds" in message
