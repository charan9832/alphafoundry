from __future__ import annotations

from pathlib import Path
from typing import Literal

import pandas as pd

from .csv_provider import load_ohlcv

ProviderName = Literal["auto", "openbb", "yfinance"]

_REQUIRED_COLUMNS = ["open", "high", "low", "close", "volume"]


def load_data(source: str | Path) -> pd.DataFrame:
    return load_ohlcv(source)


def openbb_available() -> bool:
    try:
        import openbb  # noqa: F401
        return True
    except Exception:
        return False


def yfinance_available() -> bool:
    try:
        import yfinance  # noqa: F401
        return True
    except Exception:
        return False


def fetch_ohlcv(
    symbol: str,
    start: str | None = None,
    end: str | None = None,
    provider: ProviderName = "auto",
) -> pd.DataFrame:
    """Fetch OHLCV data using OpenBB first, with a yfinance fallback.

    OpenBB is the preferred AlphaFoundry data layer, but it is optional and its
    install/API can vary by environment. In auto mode, this function tries
    OpenBB and then falls back to yfinance. Explicit provider mode fails fast if
    that provider is unavailable or errors.
    """
    symbol = symbol.upper().strip()
    if not symbol:
        raise ValueError("symbol is required")

    errors: list[str] = []
    providers: list[str]
    if provider == "auto":
        providers = ["openbb", "yfinance"]
    elif provider in {"openbb", "yfinance"}:
        providers = [provider]
    else:
        raise ValueError("provider must be one of: auto, openbb, yfinance")

    for candidate in providers:
        try:
            if candidate == "openbb":
                return _fetch_openbb(symbol, start=start, end=end)
            if candidate == "yfinance":
                return _fetch_yfinance(symbol, start=start, end=end)
        except Exception as exc:  # Keep fallback robust but transparent.
            errors.append(f"{candidate}: {exc}")

    detail = "; ".join(errors) if errors else "no providers attempted"
    raise RuntimeError(f"Unable to fetch data for {symbol}. {detail}")


def save_ohlcv(df: pd.DataFrame, output: str | Path) -> Path:
    """Persist normalized OHLCV data as CSV with a date/timestamp column."""
    out = Path(output).expanduser()
    out.parent.mkdir(parents=True, exist_ok=True)

    to_write = df.copy()
    if to_write.index.name:
        index_name = str(to_write.index.name).lower()
    else:
        index_name = "date"
    to_write.index.name = index_name
    to_write.to_csv(out)
    return out


def _fetch_openbb(symbol: str, start: str | None = None, end: str | None = None) -> pd.DataFrame:
    if not openbb_available():
        raise RuntimeError("OpenBB is not installed")

    from openbb import obb

    result = obb.equity.price.historical(
        symbol=symbol,
        start_date=start,
        end_date=end,
        provider="yfinance",
    )
    if hasattr(result, "to_df"):
        raw = result.to_df()
    else:
        raw = pd.DataFrame(result)
    return _normalize_ohlcv(raw)


def _fetch_yfinance(symbol: str, start: str | None = None, end: str | None = None) -> pd.DataFrame:
    if not yfinance_available():
        raise RuntimeError("yfinance is not installed")

    import yfinance as yf

    raw = yf.download(
        symbol,
        start=start,
        end=end,
        auto_adjust=False,
        progress=False,
        threads=False,
    )
    if raw is None or raw.empty:
        raise RuntimeError("provider returned no rows")
    return _normalize_ohlcv(raw)


def _normalize_ohlcv(raw: pd.DataFrame) -> pd.DataFrame:
    if raw is None or raw.empty:
        raise RuntimeError("provider returned no rows")

    df = raw.copy()
    if isinstance(df.columns, pd.MultiIndex):
        # yfinance returns MultiIndex columns for some versions/configs.
        df.columns = [str(parts[0]).lower() for parts in df.columns]
    else:
        df.columns = [str(col).lower().replace(" ", "_") for col in df.columns]

    rename_map = {
        "adj_close": "adj_close",
        "adj close": "adj_close",
    }
    df = df.rename(columns=rename_map)

    missing = [col for col in ["close"] if col not in df.columns]
    if missing:
        raise RuntimeError(f"provider data missing required columns: {', '.join(missing)}")

    for col in _REQUIRED_COLUMNS:
        if col not in df.columns:
            df[col] = 0 if col == "volume" else df["close"]

    keep = [col for col in ["open", "high", "low", "close", "volume", "adj_close"] if col in df.columns]
    normalized = df[keep].copy()
    normalized.index = pd.to_datetime(normalized.index)
    normalized = normalized.sort_index()
    normalized.index.name = "date"
    return normalized
