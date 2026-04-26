from __future__ import annotations

import json
from pathlib import Path

from typer.testing import CliRunner

from alphafoundry.cli import app
from alphafoundry.chat import parse_message

runner = CliRunner()


def test_parse_message_understands_full_run_request():
    intent = parse_message("create a momentum strategy for SPY called spybot and run everything")

    assert intent.action == "run"
    assert intent.name == "spybot"
    assert intent.template == "momentum"
    assert intent.symbol == "SPY"


def test_chat_once_runs_pipeline_and_status(tmp_path, monkeypatch):
    monkeypatch.setenv("HOME", str(tmp_path))
    data = Path(__file__).resolve().parents[1] / "examples" / "data" / "sample_prices.csv"

    assert runner.invoke(app, ["init"]).exit_code == 0
    run = runner.invoke(
        app,
        [
            "chat",
            "create a breakout strategy for AAPL called talkbot and run the full pipeline",
            "--data",
            str(data),
            "--json-out",
        ],
    )
    assert run.exit_code == 0, run.output
    payload = json.loads(run.output)
    assert payload["intent"]["action"] == "run"
    assert payload["intent"]["name"] == "talkbot"
    assert payload["intent"]["template"] == "breakout"
    assert payload["result"]["strategy"] == "talkbot"
    assert Path(payload["result"]["artifacts"]["report"]).exists()
    assert Path(payload["result"]["artifacts"]["paper_events"]).exists()

    status = runner.invoke(app, ["chat", "show status for talkbot", "--json-out"])
    assert status.exit_code == 0, status.output
    status_payload = json.loads(status.output)
    assert status_payload["intent"]["action"] == "status"
    assert status_payload["result"]["strategy"] == "talkbot"
    assert status_payload["result"]["artifacts"]["report_exists"] is True


def test_chat_once_lists_strategies(tmp_path, monkeypatch):
    monkeypatch.setenv("HOME", str(tmp_path))
    assert runner.invoke(app, ["init"]).exit_code == 0
    assert runner.invoke(app, ["create", "alpha", "--template", "momentum"]).exit_code == 0

    result = runner.invoke(app, ["chat", "what strategies do I have?", "--json-out"])

    assert result.exit_code == 0, result.output
    payload = json.loads(result.output)
    assert payload["intent"]["action"] == "list"
    assert "alpha" in payload["result"]["strategies"]
