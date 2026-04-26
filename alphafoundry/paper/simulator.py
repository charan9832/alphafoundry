from __future__ import annotations

from pathlib import Path
import json

import pandas as pd

from alphafoundry.backtest.engine import run_backtest
from alphafoundry.data.providers import load_data
from alphafoundry.strategies.registry import generate_signals


def run_paper(strategy_py: Path, data_path: Path, output_path: Path) -> dict:
    df = load_data(data_path)
    close = df["close"]
    signals = generate_signals(strategy_py, close)
    result = run_backtest(close, signals)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    events_path = output_path.with_name("events.jsonl")

    positions = signals.reindex(close.index).fillna(0.0).clip(-1.0, 1.0).shift(1).fillna(0.0)

    normalized = pd.DataFrame(
        {
            "close": close.astype(float),
            "signal": signals.reindex(close.index).fillna(0.0).clip(-1.0, 1.0).astype(float),
            "position": positions.astype(float),
            "return": result.returns.reindex(close.index).fillna(0.0).astype(float),
            "equity": result.equity.reindex(close.index).astype(float),
        }
    )

    events: list[dict] = []
    for timestamp, row in normalized.iterrows():
        event = {
            "timestamp": pd.Timestamp(timestamp).isoformat(),
            "close": float(row["close"]),
            "signal": float(row["signal"]),
            "position": float(row["position"]),
            "return_pct": round(float(row["return"] * 100), 6),
            "equity": round(float(row["equity"]), 6),
            "mode": "paper",
        }
        events.append(event)

    with events_path.open("a") as f:
        for event in events:
            f.write(json.dumps(event, sort_keys=True) + "\n")

    payload = {
        "mode": "paper",
        "metrics": result.metrics,
        "events": len(events),
        "events_path": str(events_path),
    }
    output_path.write_text(json.dumps(payload, indent=2) + "\n")
    return payload
