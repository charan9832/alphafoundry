from __future__ import annotations

from pathlib import Path
import json

from alphafoundry.backtest.engine import run_backtest
from alphafoundry.data.providers import load_data
from alphafoundry.strategies.registry import generate_signals


def run_paper(strategy_py: Path, data_path: Path, output_path: Path) -> dict:
    df = load_data(data_path)
    close = df["close"]
    signals = generate_signals(strategy_py, close)
    result = run_backtest(close, signals)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {"mode": "paper", "metrics": result.metrics}
    output_path.write_text(json.dumps(payload, indent=2) + "\n")
    return payload
