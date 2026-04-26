#!/usr/bin/env python3
"""Deterministic placeholder finance engine for AlphaFoundry scaffold.

The TypeScript product shell will call a stricter Python bridge in later phases.
This module exists to reserve the local-first Python finance boundary.
"""

import json
import sys
from datetime import datetime, timezone


def main() -> int:
    request = json.load(sys.stdin)
    symbol = str(request.get("symbol", "SPY")).upper()
    response = {
        "ok": True,
        "symbol": symbol,
        "engine": "mock-python-finance-engine",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "warning": "Scaffold only; replace with real deterministic finance engine.",
    }
    print(json.dumps(response))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
