from __future__ import annotations

from pathlib import Path


def simplemem_available() -> bool:
    try:
        import simplemem_router  # noqa: F401
        return True
    except Exception:
        try:
            import simplemem  # noqa: F401
            return True
        except Exception:
            return False


def remember_local(memory_dir: Path, text: str) -> Path:
    safe_text = " ".join(str(text).split())
    memory_dir.mkdir(parents=True, exist_ok=True)
    path = memory_dir / "memories.md"
    with path.open("a") as f:
        f.write(f"- {safe_text}\n")
    return path
