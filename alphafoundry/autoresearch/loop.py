from __future__ import annotations

from pathlib import Path
import hashlib
import json

from alphafoundry.validate.robustness import validate_strategy


def _append_tsv(path: Path, fields: list[object]) -> None:
    clean = [str(x).replace("\t", " ").replace("\n", " ") for x in fields]
    with path.open("a") as f:
        f.write("\t".join(clean) + "\n")


def _strategy_hash(strategy_py: Path) -> str:
    return hashlib.sha256(strategy_py.read_bytes()).hexdigest()[:16]


def _write_iteration_artifact(exp_dir: Path, iteration: int, score: float, status: str, description: str, strategy_hash: str, validation: dict) -> Path:
    path = exp_dir / f"iteration-{iteration:03d}.json"
    payload = {
        "iteration": iteration,
        "robust_alpha_score": float(score),
        "status": status,
        "description": description,
        "strategy_hash": strategy_hash,
        "validation": validation,
    }
    path.write_text(json.dumps(payload, indent=2) + "\n")
    return path


def run_autoresearch(strategy_dir: Path, data_path: Path, iterations: int = 3) -> dict:
    strategy_py = strategy_dir / "strategy.py"
    exp_dir = strategy_dir / "experiments"
    exp_dir.mkdir(exist_ok=True)
    log = exp_dir / "results.tsv"
    if not log.exists():
        log.write_text("iteration\tmetric\tstatus\tdescription\n")

    artifacts: list[str] = []
    shash = _strategy_hash(strategy_py)
    best = validate_strategy(strategy_py, data_path)
    best_score = float(best["robust_alpha_score"])
    _append_tsv(log, [0, best_score, "baseline", "initial"])
    artifacts.append(str(_write_iteration_artifact(exp_dir, 0, best_score, "baseline", "initial", shash, best)))

    for i in range(1, iterations + 1):
        # MVP: no blind mutation yet; records measured checkpoints safely.
        current = validate_strategy(strategy_py, data_path)
        score = float(current["robust_alpha_score"])
        status = "kept" if score >= best_score else "reverted"
        if score >= best_score:
            best_score = score
            best = current
        description = "measurement-only MVP iteration"
        _append_tsv(log, [i, score, status, description])
        artifacts.append(str(_write_iteration_artifact(exp_dir, i, score, status, description, shash, current)))

    return {"best_score": float(best_score), "best": best, "log": str(log), "artifacts": artifacts}
