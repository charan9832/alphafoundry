from __future__ import annotations

from pathlib import Path
from datetime import datetime, timezone


def init_wiki(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)
    (path / "concepts").mkdir(exist_ok=True)
    (path / "strategies").mkdir(exist_ok=True)
    (path / "models").mkdir(exist_ok=True)
    (path / "integrations").mkdir(exist_ok=True)
    (path / "postmortems").mkdir(exist_ok=True)
    (path / "papers").mkdir(exist_ok=True)
    if not (path / "SCHEMA.md").exists():
        (path / "SCHEMA.md").write_text(
            "# AlphaFoundry Wiki Schema\n\n"
            "Domain: trading strategy research.\n\n"
            "## Page types\n"
            "- concept: reusable trading/research concept\n"
            "- strategy: strategy family or implementation notes\n"
            "- model: model capability and caveats\n"
            "- integration: external repo/package integration notes\n"
            "- postmortem: durable lesson from failed/successful experiments\n\n"
            "## Rules\n"
            "- Prefer concise, sourced notes.\n"
            "- Never store secrets.\n"
            "- Link related pages with wikilinks where possible.\n"
        )
    if not (path / "index.md").exists():
        (path / "index.md").write_text("# AlphaFoundry Wiki Index\n\n## Concepts\n\n## Strategies\n\n## Models\n\n## Integrations\n\n## Postmortems\n")
    if not (path / "log.md").exists():
        now = datetime.now(timezone.utc).isoformat()
        (path / "log.md").write_text(f"# AlphaFoundry Wiki Log\n\n## [{now}] create | Wiki initialized\n")
