from __future__ import annotations

from pathlib import Path
import json


def render_markdown(strategy_name: str, validation: dict, output_path: Path) -> Path:
    lines = [
        f"# AlphaFoundry Report: {strategy_name}",
        "",
        "## Summary",
        f"- Passed: {validation.get('passed')}",
        f"- Robust Alpha Score: {validation.get('robust_alpha_score')}",
        "",
        "## Metrics JSON",
        "```json",
        json.dumps(validation, indent=2),
        "```",
        "",
        "_Not financial advice. Paper/research use only._",
    ]
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(lines) + "\n")
    return output_path
