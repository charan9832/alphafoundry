from pathlib import Path
from typer.testing import CliRunner

from alphafoundry.cli import app

runner = CliRunner()


def test_cli_help():
    result = runner.invoke(app, ["--help"])
    assert result.exit_code == 0
    assert "AlphaFoundry" in result.output


def test_create_backtest_validate_workflow(tmp_path, monkeypatch):
    monkeypatch.setenv("HOME", str(tmp_path))
    data = Path(__file__).resolve().parents[1] / "examples" / "data" / "sample_prices.csv"
    assert runner.invoke(app, ["init"]).exit_code == 0
    assert runner.invoke(app, ["create", "demo", "--template", "momentum"]).exit_code == 0
    bt = runner.invoke(app, ["backtest", "demo", "--data", str(data), "--json-out"])
    assert bt.exit_code == 0
    assert "total_return_pct" in bt.output
    val = runner.invoke(app, ["validate", "demo", "--data", str(data), "--json-out"])
    assert val.exit_code == 0
    assert "robust_alpha_score" in val.output
