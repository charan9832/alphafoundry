from __future__ import annotations

from pathlib import Path
import pandas as pd

from .csv_provider import load_ohlcv


def load_data(source: str | Path) -> pd.DataFrame:
    return load_ohlcv(source)


def openbb_available() -> bool:
    try:
        import openbb  # noqa: F401
        return True
    except Exception:
        return False
