from __future__ import annotations

from pathlib import Path

from alphafoundry.validate.robustness import validate_strategy


def _append_tsv(path: Path, fields: list[object]) -> None:
    clean = [str(x).replace("\t", " ").replace("\n", " ") for x in fields]
    with path.open("a") as f:
        f.write("\t".join(clean) + "\n")


def run_autoresearch(strategy_dir: Path, data_path: Path, iterations: int = 3) -> dict:
    strategy_py = strategy_dir / "strategy.py"
    exp_dir = strategy_dir / "experiments"
    exp_dir.mkdir(exist_ok=True)
    log = exp_dir / "results.tsv"
    if not log.exists():
        log.write_text("iteration\tmetric\tstatus\tdescription\n")

    best = validate_strategy(strategy_py, data_path)
    best_score = float(best["robust_alpha_score"])
    _append_tsv(log, [0, best_score, "baseline", "initial"])

    for i in range(1, iterations + 1):
        # MVP: no blind mutation yet; records measured checkpoints safely.
        current = validate_strategy(strategy_py, data_path)
        score = float(current["robust_alpha_score"])
        status = "kept" if score >= best_score else "reverted"
        if score >= best_score:
            best_score = score
            best = current
        _append_tsv(log, [i, score, status, "measurement-only MVP iteration"])

    return {"best_score": float(best_score), "best": best, "log": str(log)}
