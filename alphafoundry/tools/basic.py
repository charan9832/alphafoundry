from __future__ import annotations

from pathlib import Path


def read_text(path: str) -> str:
    return Path(path).read_text()


def write_text(path: str, content: str) -> None:
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content)
