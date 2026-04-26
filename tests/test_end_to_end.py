from __future__ import annotations

import json
from pathlib import Path

from typer.testing import CliRunner

from alphafoundry.cli import app

runner = CliRunner()


def test_run_command_executes_full_local_pipeline(tmp_path, monkeypatch):
    monkeypatch.setenv("HOME", str(tmp_path))
    data = Path(__file__).resolve().parents[1] / "examples" / "data" / "sample_prices.csv"
    name = f"demo_{tmp_path.name.replace('-', '_')}"

    assert runner.invoke(app, ["init"]).exit_code == 0
    result = runner.invoke(
        app,
        [
            "run",
            name,
            "--template",
            "momentum",
            "--symbol",
            "SAMPLE",
            "--data",
            str(data),
            "--iterations",
            "2",
            "--json-out",
        ],
    )

    assert result.exit_code == 0, result.output
    payload = json.loads(result.output)
    assert payload["strategy"] == name
    assert payload["steps"]["created"] is True
    assert payload["steps"]["backtest"]["metrics"]["trades"] >= 0
    assert "robust_alpha_score" in payload["steps"]["validate"]
    assert "best" in payload["steps"]["optimize"]
    assert Path(payload["artifacts"]["report"]).exists()
    assert Path(payload["artifacts"]["paper_journal"]).exists()
    assert Path(payload["artifacts"]["paper_events"]).exists()
    assert Path(payload["artifacts"]["autoresearch_log"]).exists()
    assert Path(payload["artifacts"]["run_manifest"]).exists()

    exp_dir = Path(payload["strategy_dir"]) / "experiments"
    assert (exp_dir / "iteration-000.json").exists()
    assert (exp_dir / "iteration-001.json").exists()
    assert (exp_dir / "iteration-002.json").exists()

    paper_events = Path(payload["artifacts"]["paper_events"]).read_text().strip().splitlines()
    assert paper_events
    first_event = json.loads(paper_events[0])
    assert {"timestamp", "close", "signal", "position", "return_pct", "equity"}.issubset(first_event)

    manifest = json.loads(Path(payload["artifacts"]["run_manifest"]).read_text())
    assert manifest["strategy"] == name
    assert manifest["safety"]["mode"] == "paper"
    assert manifest["safety"]["live_trading_enabled"] is False

    status = runner.invoke(app, ["status", name, "--json-out"])
    assert status.exit_code == 0, status.output
    status_payload = json.loads(status.output)
    assert status_payload["strategy"] == name
    assert status_payload["artifacts"]["report_exists"] is True
    assert status_payload["artifacts"]["paper_events_exists"] is True
    assert status_payload["experiments"]["count"] >= 3


def test_run_command_reuses_existing_strategy(tmp_path, monkeypatch):
    monkeypatch.setenv("HOME", str(tmp_path))
    data = Path(__file__).resolve().parents[1] / "examples" / "data" / "sample_prices.csv"
    name = f"demo_reuse_{tmp_path.name.replace('-', '_')}"

    assert runner.invoke(app, ["init"]).exit_code == 0
    assert runner.invoke(app, ["create", name, "--template", "breakout"]).exit_code == 0
    result = runner.invoke(app, ["run", name, "--data", str(data), "--json-out"])

    assert result.exit_code == 0, result.output
    payload = json.loads(result.output)
    assert payload["steps"]["created"] is False
    assert payload["strategy"] == name
