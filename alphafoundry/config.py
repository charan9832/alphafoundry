from __future__ import annotations

import json
from dataclasses import asdict, dataclass, fields
from pathlib import Path

APP_NAME = "AlphaFoundry"
CONFIG_DIR = Path.home() / ".alphafoundry"
CONFIG_FILE = CONFIG_DIR / "config.json"
DEFAULT_WORKSPACE = Path.home() / "alphafoundry-workspace"


@dataclass
class Config:
    default_mode: str = "paper"
    workspace: str = str(DEFAULT_WORKSPACE)
    risk_daily_loss_pct: float = 2.0
    risk_max_drawdown_pct: float = 10.0
    risk_max_position_size: float = 1.0
    auto_trade: bool = False
    llm_base_url: str = ""
    llm_model: str = ""
    llm_api_key_env: str = "ALPHAFOUNDRY_LLM_API_KEY"
    memory_backend: str = "simplemem"
    data_backend: str = "csv"

    @classmethod
    def load(cls) -> "Config":
        if CONFIG_FILE.exists():
            data = json.loads(CONFIG_FILE.read_text())
            allowed = {f.name for f in fields(cls)}
            filtered = {k: v for k, v in data.items() if k in allowed}
            return cls(**{**asdict(cls()), **filtered})
        return cls()

    def save(self) -> None:
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        CONFIG_FILE.write_text(json.dumps(asdict(self), indent=2) + "\n")

    @property
    def workspace_path(self) -> Path:
        return Path(self.workspace).expanduser()


def init_config() -> Config:
    cfg = Config.load()
    cfg.save()
    cfg.workspace_path.mkdir(parents=True, exist_ok=True)
    (cfg.workspace_path / "strategies").mkdir(exist_ok=True)
    (cfg.workspace_path / "reports").mkdir(exist_ok=True)
    (cfg.workspace_path / "memory").mkdir(exist_ok=True)
    (cfg.workspace_path / "wiki").mkdir(exist_ok=True)
    return cfg
