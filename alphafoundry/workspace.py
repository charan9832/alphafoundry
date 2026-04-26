from __future__ import annotations

import shutil
from pathlib import Path

from .config import Config
from .strategies.spec import StrategySpec

TEMPLATE_DIR = Path(__file__).parent / "strategies" / "templates"


def strategy_dir(cfg: Config, name: str) -> Path:
    return cfg.workspace_path / "strategies" / name


def create_strategy(cfg: Config, name: str, template: str = "momentum", symbol: str = "SAMPLE") -> Path:
    dest = strategy_dir(cfg, name)
    dest.mkdir(parents=True, exist_ok=True)
    template_file = TEMPLATE_DIR / f"{template}.py"
    if not template_file.exists():
        raise ValueError(f"Unknown template: {template}")
    shutil.copy2(template_file, dest / "strategy.py")
    spec = StrategySpec(name=name, template=template, symbol=symbol)
    spec.save(dest / "strategy.yaml")
    (dest / "params.yaml").write_text("{}\n")
    (dest / "experiments").mkdir(exist_ok=True)
    (dest / "backtests").mkdir(exist_ok=True)
    (dest / "reports").mkdir(exist_ok=True)
    return dest


def list_strategies(cfg: Config) -> list[str]:
    base = cfg.workspace_path / "strategies"
    if not base.exists():
        return []
    return sorted([p.name for p in base.iterdir() if p.is_dir()])
