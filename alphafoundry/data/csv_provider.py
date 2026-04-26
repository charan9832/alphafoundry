from __future__ import annotations

from pathlib import Path
import pandas as pd


def load_ohlcv(path: str | Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    cols = {c.lower(): c for c in df.columns}
    if "close" not in cols:
        raise ValueError("CSV must include a close column")
    if "date" in cols:
        df[cols["date"]] = pd.to_datetime(df[cols["date"]])
        df = df.set_index(cols["date"])
    elif "timestamp" in cols:
        df[cols["timestamp"]] = pd.to_datetime(df[cols["timestamp"]])
        df = df.set_index(cols["timestamp"])
    return df.rename(columns={v: k for k, v in cols.items()}).sort_index()
