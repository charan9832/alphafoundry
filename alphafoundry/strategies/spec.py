from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, Field


class StrategySpec(BaseModel):
    name: str
    template: str = "momentum"
    symbol: str = "SAMPLE"
    timeframe: str = "1d"
    params: dict[str, Any] = Field(default_factory=dict)
    risk: dict[str, Any] = Field(default_factory=lambda: {
        "max_position_pct": 1.0,
        "stop_loss_pct": None,
        "take_profit_pct": None,
    })

    def save(self, path: Path) -> None:
        path.write_text(yaml.safe_dump(self.model_dump(), sort_keys=False))

    @classmethod
    def load(cls, path: Path) -> "StrategySpec":
        return cls(**yaml.safe_load(path.read_text()))
