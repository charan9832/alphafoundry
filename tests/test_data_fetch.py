from pathlib import Path

import pandas as pd
from typer.testing import CliRunner

from alphafoundry.cli import app
from alphafoundry.data.providers import fetch_ohlcv

runner = CliRunner()


def test_fetch_auto_falls_back_to_yfinance(monkeypatch):
    def fake_openbb(*args, **kwargs):
        raise RuntimeError("openbb unavailable")

    def fake_yfinance(*args, **kwargs):
        idx = pd.date_range("2024-01-01", periods=2, freq="D")
        df = pd.DataFrame(
            {
                "open": [99.0, 100.0],
                "high": [101.0, 102.0],
                "low": [98.0, 99.0],
                "close": [100.0, 101.0],
                "volume": [1000, 1100],
            },
            index=idx,
        )
        df.index.name = "date"
        return df

    monkeypatch.setattr("alphafoundry.data.providers._fetch_openbb", fake_openbb)
    monkeypatch.setattr("alphafoundry.data.providers._fetch_yfinance", fake_yfinance)

    df = fetch_ohlcv("spy", start="2024-01-01", end="2024-01-03", provider="auto")

    assert list(df.columns) == ["open", "high", "low", "close", "volume"]
    assert len(df) == 2
    assert df.index.name == "date"


def test_fetch_command_writes_csv(tmp_path, monkeypatch):
    def fake_fetch(symbol, start=None, end=None, provider="auto"):
        idx = pd.date_range("2024-01-01", periods=1, freq="D")
        return pd.DataFrame(
            {"open": [1.0], "high": [2.0], "low": [0.5], "close": [1.5], "volume": [10]},
            index=idx,
        )

    monkeypatch.setattr("alphafoundry.cli.fetch_ohlcv", fake_fetch)
    out = tmp_path / "spy.csv"

    result = runner.invoke(app, ["fetch", "SPY", "--output", str(out)])

    assert result.exit_code == 0
    assert out.exists()
    loaded = pd.read_csv(out)
    assert "close" in loaded.columns
    assert loaded.loc[0, "close"] == 1.5
