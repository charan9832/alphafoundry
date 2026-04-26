from pathlib import Path

from alphafoundry.autoresearch.loop import run_autoresearch
from alphafoundry.memory.simplemem_adapter import remember_local, simplemem_available
from alphafoundry.wiki.brain import init_wiki
from alphafoundry.workspace import create_strategy
from alphafoundry.config import Config


def test_remember_local_appends_memory(tmp_path):
    path = remember_local(tmp_path, "Strategy failed cost stress")
    assert path.exists()
    assert "Strategy failed cost stress" in path.read_text()
    remember_local(tmp_path, "Second lesson")
    assert "Second lesson" in path.read_text()


def test_simplemem_available_returns_bool():
    assert isinstance(simplemem_available(), bool)


def test_init_wiki_creates_core_files(tmp_path):
    init_wiki(tmp_path)
    assert (tmp_path / "SCHEMA.md").exists()
    assert (tmp_path / "index.md").exists()
    assert (tmp_path / "log.md").exists()
    assert "trading strategy research" in (tmp_path / "SCHEMA.md").read_text()


def test_autoresearch_writes_results_tsv(tmp_path):
    cfg = Config(workspace=str(tmp_path / "workspace"))
    cfg.workspace_path.mkdir(parents=True)
    (cfg.workspace_path / "strategies").mkdir()
    strategy_dir = create_strategy(cfg, "demo", "momentum")
    data = Path(__file__).resolve().parents[1] / "examples" / "data" / "sample_prices.csv"
    result = run_autoresearch(strategy_dir, data, iterations=2)
    log = Path(result["log"])
    assert log.exists()
    text = log.read_text()
    assert "iteration\tmetric\tstatus\tdescription" in text
    assert "baseline" in text
    assert isinstance(result["best_score"], float)
