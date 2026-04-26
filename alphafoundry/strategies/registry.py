from __future__ import annotations

import importlib.util
from pathlib import Path
import pandas as pd


def load_strategy_function(strategy_py: Path):
    spec = importlib.util.spec_from_file_location("user_strategy", strategy_py)
    if spec is None or spec.loader is None:
        raise ValueError(f"Cannot load strategy from {strategy_py}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    fn = getattr(module, "generate_signals", None)
    if fn is None:
        raise ValueError("Strategy must define generate_signals(prices: pd.Series) -> pd.Series")
    return fn


def generate_signals(strategy_py: Path, close: pd.Series) -> pd.Series:
    fn = load_strategy_function(strategy_py)
    signals = fn(close).reindex(close.index).fillna(0.0).astype(float)
    return signals.clip(-1.0, 1.0)
