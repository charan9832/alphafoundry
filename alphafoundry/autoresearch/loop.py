from __future__ import annotations

from pathlib import Path
import subprocess
import time

from alphafoundry.validate.robustness import validate_strategy


def run_autoresearch(strategy_dir: Path, data_path: Path, iterations: int = 3) -> dict:
    strategy_py = strategy_dir / "strategy.py"
    exp_dir = strategy_dir / "experiments"
    exp_dir.mkdir(exist_ok=True)
    log = exp_dir / "results.tsv"
    if not log.exists():
        log.write_text("iteration\tmetric\tstatus\tdescription\n")
    best = validate_strategy(strategy_py, data_path)
    best_score = best["robust_alpha_score"]
    with log.open("a") as f:
        f.write(f"0\t{best_score}\tbaseline\tinitial\n")
        for i in range(1, iterations + 1):
            # MVP: no blind mutation yet; records measured checkpoints safely.
            current = validate_strategy(strategy_py, data_path)
            score = current["robust_alpha_score"]
            status = "kept" if score >= best_score else "reverted"
            if score >= best_score:
                best_score = score
                best = current
            f.write(f"{i}\t{score}\t{status}\tmeasurement-only MVP iteration\n")
    return {"best_score": best_score, "best": best, "log": str(log)}
