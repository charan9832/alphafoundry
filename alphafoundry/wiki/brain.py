from __future__ import annotations

from pathlib import Path


def init_wiki(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)
    (path / "SCHEMA.md").write_text("# AlphaFoundry Wiki Schema\n\nDomain: trading strategy research.\n") if not (path / "SCHEMA.md").exists() else None
    (path / "index.md").write_text("# AlphaFoundry Wiki Index\n") if not (path / "index.md").exists() else None
    (path / "log.md").write_text("# AlphaFoundry Wiki Log\n") if not (path / "log.md").exists() else None
