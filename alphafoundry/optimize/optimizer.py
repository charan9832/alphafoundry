from __future__ import annotations

from pathlib import Path
import shutil
import tempfile

from alphafoundry.validate.robustness import validate_strategy


def optimize_strategy(strategy_py: Path, data_path: Path) -> dict:
    # MVP: evaluate current strategy and return baseline. Real param search is next phase.
    result = validate_strategy(strategy_py, data_path)
    return {"best": result, "note": "MVP optimizer returns validated baseline; param search scaffold is ready."}
