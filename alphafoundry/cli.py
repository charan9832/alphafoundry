from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.table import Table

from .config import Config, config_file, init_config
from .workspace import create_strategy, list_strategies, strategy_dir
from .data.providers import fetch_ohlcv, load_data, openbb_available, save_ohlcv, yfinance_available
from .strategies.registry import generate_signals
from .backtest.engine import run_backtest
from .validate.robustness import validate_strategy
from .optimize.optimizer import optimize_strategy
from .reports.renderer import render_markdown
from .paper.simulator import run_paper
from .autoresearch.loop import run_autoresearch
from .memory.simplemem_adapter import simplemem_available
from .wiki.brain import init_wiki
from .agent.planner import idea_to_template
from .chat import ChatIntent, parse_message

app = typer.Typer(help="AlphaFoundry: Claude Code for trading strategies.")
console = Console()


def _cfg() -> Config:
    return Config.load()


def _strategy_py(name: str) -> Path:
    return strategy_dir(_cfg(), name) / "strategy.py"


def _json_safe(value):
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_json_safe(v) for v in value]
    return value


def _run_pipeline_payload(name: str, data: Path, template: str = "momentum", symbol: str = "SAMPLE", iterations: int = 1) -> dict:
    cfg = _cfg()
    sdir = strategy_dir(cfg, name)
    created = False
    if not sdir.exists():
        sdir = create_strategy(cfg, name, template, symbol)
        created = True

    strategy_py = sdir / "strategy.py"
    df = load_data(data)
    close = df["close"]
    signals = generate_signals(strategy_py, close)
    backtest_result = run_backtest(close, signals)
    validation = validate_strategy(strategy_py, data)
    optimization = optimize_strategy(strategy_py, data)

    report_path = sdir / "reports" / "report.md"
    render_markdown(name, validation, report_path)

    paper_path = sdir / "paper" / "journal.json"
    paper_result = run_paper(strategy_py, data, paper_path)

    autoresearch_result = run_autoresearch(sdir, data, iterations)

    manifest_path = sdir / "run_manifest.json"
    payload = {
        "strategy": name,
        "strategy_dir": str(sdir),
        "data": str(data),
        "steps": {
            "created": created,
            "backtest": {"metrics": backtest_result.metrics},
            "validate": validation,
            "optimize": optimization,
            "paper": paper_result,
            "autoresearch": autoresearch_result,
        },
        "artifacts": {
            "report": str(report_path),
            "paper_journal": str(paper_path),
            "paper_events": str(paper_result["events_path"]),
            "autoresearch_log": str(autoresearch_result["log"]),
            "run_manifest": str(manifest_path),
        },
        "safety": {
            "mode": _cfg().default_mode,
            "live_trading_enabled": False,
            "auto_trade": _cfg().auto_trade,
            "disclaimer": "Research and paper trading only. Not financial advice.",
        },
    }
    manifest_path.write_text(json.dumps(_json_safe(payload), indent=2) + "\n")
    return payload


def _status_payload(name: str) -> dict:
    cfg = _cfg()
    sdir = strategy_dir(cfg, name)
    spec_path = sdir / "strategy.yaml"
    report_path = sdir / "reports" / "report.md"
    paper_path = sdir / "paper" / "journal.json"
    paper_events_path = sdir / "paper" / "events.jsonl"
    manifest_path = sdir / "run_manifest.json"
    exp_dir = sdir / "experiments"
    iteration_files = sorted(exp_dir.glob("iteration-*.json")) if exp_dir.exists() else []
    payload = {
        "strategy": name,
        "strategy_dir": str(sdir),
        "exists": sdir.exists(),
        "spec_exists": spec_path.exists(),
        "artifacts": {
            "report": str(report_path),
            "report_exists": report_path.exists(),
            "paper_journal": str(paper_path),
            "paper_journal_exists": paper_path.exists(),
            "paper_events": str(paper_events_path),
            "paper_events_exists": paper_events_path.exists(),
            "run_manifest": str(manifest_path),
            "run_manifest_exists": manifest_path.exists(),
        },
        "experiments": {
            "directory": str(exp_dir),
            "count": len(iteration_files),
            "latest": str(iteration_files[-1]) if iteration_files else None,
        },
    }
    if manifest_path.exists():
        try:
            manifest = json.loads(manifest_path.read_text())
            payload["latest_score"] = manifest.get("steps", {}).get("validate", {}).get("robust_alpha_score")
            payload["passed"] = manifest.get("steps", {}).get("validate", {}).get("passed")
        except Exception:
            payload["latest_score"] = None
            payload["passed"] = None
    return payload


def _execute_chat_intent(intent: ChatIntent, data: Optional[Path], iterations: int = 1) -> dict:
    if intent.action == "run":
        if data is None:
            raise typer.BadParameter("chat run requests require --data PATH")
        return _run_pipeline_payload(intent.name or "strategy", data, intent.template, intent.symbol, iterations)
    if intent.action == "create":
        cfg = _cfg()
        dest = create_strategy(cfg, intent.name or "strategy", intent.template, intent.symbol)
        return {"strategy": intent.name or "strategy", "template": intent.template, "symbol": intent.symbol, "path": str(dest)}
    if intent.action == "status":
        if not intent.name:
            raise typer.BadParameter("status requests need a strategy name")
        return _status_payload(intent.name)
    if intent.action == "list":
        return {"strategies": list_strategies(_cfg())}
    return {
        "message": "I can create strategies, run the full paper pipeline, show status, and list strategies.",
        "examples": [
            "create a momentum strategy for SPY called spybot and run everything",
            "show status for spybot",
            "what strategies do I have?",
        ],
    }


@app.command()
def init():
    """Initialize AlphaFoundry config and workspace."""
    cfg = init_config()
    init_wiki(cfg.workspace_path / "wiki")
    console.print(f"[green]Initialized AlphaFoundry[/green] config={config_file()} workspace={cfg.workspace_path}")


@app.command()
def doctor():
    """Check local product readiness and optional integrations."""
    cfg = _cfg()
    table = Table(title="AlphaFoundry Doctor")
    table.add_column("Check")
    table.add_column("Status")
    table.add_column("Detail")
    table.add_row("config", "PASS" if config_file().exists() else "WARN", str(config_file()))
    table.add_row("workspace", "PASS" if cfg.workspace_path.exists() else "WARN", str(cfg.workspace_path))
    table.add_row("OpenBB", "PASS" if openbb_available() else "INFO", "optional primary data integration")
    table.add_row("yfinance", "PASS" if yfinance_available() else "INFO", "optional fallback data integration")
    table.add_row("SimpleMem", "PASS" if simplemem_available() else "INFO", "optional memory integration")
    table.add_row("mode", "PASS" if cfg.default_mode == "paper" and not cfg.auto_trade else "FAIL", f"default_mode={cfg.default_mode} auto_trade={cfg.auto_trade}")
    console.print(table)


@app.command("list")
def list_cmd():
    """List strategy projects."""
    cfg = _cfg()
    table = Table(title="Strategies")
    table.add_column("Name")
    for name in list_strategies(cfg):
        table.add_row(name)
    console.print(table)


@app.command()
def create(name: str, idea: str = typer.Option("", help="Natural language strategy idea"), template: Optional[str] = typer.Option(None), symbol: str = "SAMPLE"):
    """Create a strategy project from a template or idea."""
    cfg = _cfg()
    chosen = template or idea_to_template(idea or name)
    dest = create_strategy(cfg, name, chosen, symbol)
    console.print(f"[green]Created strategy[/green] {name} template={chosen} path={dest}")


@app.command()
def fetch(
    symbol: str,
    output: Path = typer.Option(..., "--output", "-o", help="CSV output path"),
    start: Optional[str] = typer.Option(None, help="Start date, e.g. 2024-01-01"),
    end: Optional[str] = typer.Option(None, help="End date, e.g. 2024-12-31"),
    provider: str = typer.Option("auto", help="Data provider: auto, openbb, or yfinance"),
):
    """Fetch OHLCV data with OpenBB first and yfinance fallback."""
    df = fetch_ohlcv(symbol, start=start, end=end, provider=provider)  # type: ignore[arg-type]
    out = save_ohlcv(df, output)
    console.print(f"[green]Fetched[/green] {symbol.upper()} rows={len(df)} output={out}")


@app.command()
def run(
    name: str,
    data: Path = typer.Option(..., help="CSV OHLCV data for the full local pipeline"),
    template: str = typer.Option("momentum", help="Template to create if the strategy does not exist"),
    symbol: str = typer.Option("SAMPLE", help="Strategy symbol metadata"),
    iterations: int = typer.Option(1, min=0, help="Autoresearch measurement iterations"),
    json_out: bool = typer.Option(False, help="Emit machine-readable JSON"),
):
    """Run the full local idea-to-report pipeline in paper mode."""
    cfg = _cfg()
    sdir = strategy_dir(cfg, name)
    created = False
    if not sdir.exists():
        sdir = create_strategy(cfg, name, template, symbol)
        created = True

    strategy_py = sdir / "strategy.py"
    df = load_data(data)
    close = df["close"]
    signals = generate_signals(strategy_py, close)
    backtest_result = run_backtest(close, signals)
    validation = validate_strategy(strategy_py, data)
    optimization = optimize_strategy(strategy_py, data)

    report_path = sdir / "reports" / "report.md"
    render_markdown(name, validation, report_path)

    paper_path = sdir / "paper" / "journal.json"
    paper_result = run_paper(strategy_py, data, paper_path)

    autoresearch_result = run_autoresearch(sdir, data, iterations)

    manifest_path = sdir / "run_manifest.json"
    payload = {
        "strategy": name,
        "strategy_dir": str(sdir),
        "data": str(data),
        "steps": {
            "created": created,
            "backtest": {"metrics": backtest_result.metrics},
            "validate": validation,
            "optimize": optimization,
            "paper": paper_result,
            "autoresearch": autoresearch_result,
        },
        "artifacts": {
            "report": str(report_path),
            "paper_journal": str(paper_path),
            "paper_events": str(paper_result["events_path"]),
            "autoresearch_log": str(autoresearch_result["log"]),
            "run_manifest": str(manifest_path),
        },
        "safety": {
            "mode": cfg.default_mode,
            "live_trading_enabled": False,
            "auto_trade": cfg.auto_trade,
            "disclaimer": "Research and paper trading only. Not financial advice.",
        },
    }
    manifest_path.write_text(json.dumps(_json_safe(payload), indent=2) + "\n")

    if json_out:
        typer.echo(json.dumps(_json_safe(payload), indent=2))
    else:
        console.print(f"[green]AlphaFoundry run complete[/green] strategy={name}")
        console.print(f"report={report_path}")
        console.print(f"paper_journal={paper_path}")
        console.print(f"autoresearch_log={autoresearch_result['log']}")


@app.command()
def status(name: str, json_out: bool = typer.Option(False, help="Emit machine-readable JSON")):
    """Show strategy project status and latest artifacts."""
    cfg = _cfg()
    sdir = strategy_dir(cfg, name)
    spec_path = sdir / "strategy.yaml"
    report_path = sdir / "reports" / "report.md"
    paper_path = sdir / "paper" / "journal.json"
    paper_events_path = sdir / "paper" / "events.jsonl"
    manifest_path = sdir / "run_manifest.json"
    exp_dir = sdir / "experiments"
    iteration_files = sorted(exp_dir.glob("iteration-*.json")) if exp_dir.exists() else []
    payload = {
        "strategy": name,
        "strategy_dir": str(sdir),
        "exists": sdir.exists(),
        "spec_exists": spec_path.exists(),
        "artifacts": {
            "report": str(report_path),
            "report_exists": report_path.exists(),
            "paper_journal": str(paper_path),
            "paper_journal_exists": paper_path.exists(),
            "paper_events": str(paper_events_path),
            "paper_events_exists": paper_events_path.exists(),
            "run_manifest": str(manifest_path),
            "run_manifest_exists": manifest_path.exists(),
        },
        "experiments": {
            "directory": str(exp_dir),
            "count": len(iteration_files),
            "latest": str(iteration_files[-1]) if iteration_files else None,
        },
    }
    if manifest_path.exists():
        try:
            manifest = json.loads(manifest_path.read_text())
            payload["latest_score"] = manifest.get("steps", {}).get("validate", {}).get("robust_alpha_score")
            payload["passed"] = manifest.get("steps", {}).get("validate", {}).get("passed")
        except Exception:
            payload["latest_score"] = None
            payload["passed"] = None

    if json_out:
        typer.echo(json.dumps(_json_safe(payload), indent=2))
    else:
        table = Table(title=f"AlphaFoundry Status: {name}")
        table.add_column("Item")
        table.add_column("Value")
        table.add_row("exists", str(payload["exists"]))
        table.add_row("strategy_dir", payload["strategy_dir"])
        table.add_row("report", f"{payload['artifacts']['report_exists']} {payload['artifacts']['report']}")
        table.add_row("paper_events", f"{payload['artifacts']['paper_events_exists']} {payload['artifacts']['paper_events']}")
        table.add_row("experiments", str(payload["experiments"]["count"]))
        table.add_row("latest_score", str(payload.get("latest_score")))
        table.add_row("passed", str(payload.get("passed")))
        console.print(table)


@app.command()
def backtest(name: str, data: Path = typer.Option(..., help="CSV file with OHLCV data"), json_out: bool = False):
    """Backtest a strategy over CSV OHLCV data."""
    df = load_data(data)
    close = df["close"]
    signals = generate_signals(_strategy_py(name), close)
    result = run_backtest(close, signals)
    if json_out:
        console.print(json.dumps(result.metrics, indent=2))
    else:
        table = Table(title=f"Backtest: {name}")
        table.add_column("Metric")
        table.add_column("Value")
        for k, v in result.metrics.items():
            table.add_row(k, str(v))
        console.print(table)


@app.command()
def validate(name: str, data: Path = typer.Option(..., help="CSV file with OHLCV data"), json_out: bool = False):
    """Validate strategy robustness."""
    result = validate_strategy(_strategy_py(name), data)
    if json_out:
        console.print(json.dumps(result, indent=2))
    else:
        console.print(f"[bold]Robust Alpha Score:[/bold] {result['robust_alpha_score']} passed={result['passed']}")
        console.print(json.dumps(result, indent=2))


@app.command()
def optimize(name: str, data: Path = typer.Option(..., help="CSV file with OHLCV data")):
    """Optimize strategy parameters (MVP baseline scaffold)."""
    result = optimize_strategy(_strategy_py(name), data)
    console.print(json.dumps(result, indent=2))


@app.command()
def report(name: str, data: Path = typer.Option(..., help="CSV file with OHLCV data")):
    """Generate a Markdown report."""
    cfg = _cfg()
    result = validate_strategy(_strategy_py(name), data)
    out = strategy_dir(cfg, name) / "reports" / "report.md"
    render_markdown(name, result, out)
    console.print(f"[green]Report written[/green] {out}")


@app.command()
def paper(name: str, data: Path = typer.Option(..., help="CSV file with OHLCV data")):
    """Run paper-trading simulation over data."""
    cfg = _cfg()
    out = strategy_dir(cfg, name) / "paper" / "journal.json"
    result = run_paper(_strategy_py(name), data, out)
    console.print(f"[green]Paper journal written[/green] {out}")
    console.print(json.dumps(result, indent=2))


@app.command()
def autoresearch(name: str, data: Path = typer.Option(..., help="CSV file with OHLCV data"), iterations: int = 3):
    """Run bounded Modify -> Verify -> Keep/Discard loop scaffold."""
    cfg = _cfg()
    result = run_autoresearch(strategy_dir(cfg, name), data, iterations)
    console.print(json.dumps(result, indent=2))


@app.command()
def chat(
    message: Optional[str] = typer.Argument(None, help="Natural-language request. Omit for interactive mode."),
    data: Optional[Path] = typer.Option(None, help="CSV OHLCV data for requests that run the full pipeline"),
    iterations: int = typer.Option(1, min=0, help="Autoresearch iterations for run requests"),
    json_out: bool = typer.Option(False, help="Emit machine-readable JSON for one-shot requests"),
):
    """Talk to AlphaFoundry in natural language and let it execute tasks."""
    if message is not None:
        intent = parse_message(message)
        result = _execute_chat_intent(intent, data=data, iterations=iterations)
        payload = {"intent": intent.to_dict(), "result": result}
        if json_out:
            typer.echo(json.dumps(_json_safe(payload), indent=2))
        else:
            console.print(f"[bold cyan]You:[/bold cyan] {message}")
            console.print(f"[bold green]AlphaFoundry:[/bold green] action={intent.action} confidence={intent.confidence}")
            if intent.action == "run":
                console.print(f"Completed full paper pipeline for [bold]{result['strategy']}[/bold]")
                console.print(f"Report: {result['artifacts']['report']}")
                console.print(f"Paper events: {result['artifacts']['paper_events']}")
            elif intent.action == "status":
                console.print(json.dumps(_json_safe(result), indent=2))
            elif intent.action == "list":
                console.print("Strategies: " + ", ".join(result["strategies"]))
            else:
                console.print(json.dumps(_json_safe(result), indent=2))
        return

    console.print("[bold cyan]AlphaFoundry chat[/bold cyan] — type natural requests, or 'exit'.")
    console.print("Example: create a momentum strategy for SPY called spybot and run everything")
    while True:
        try:
            user_message = typer.prompt("alphafoundry")
        except (EOFError, KeyboardInterrupt):
            console.print("\n[dim]Goodbye.[/dim]")
            break
        if user_message.strip().lower() in {"exit", "quit", "bye"}:
            console.print("[dim]Goodbye.[/dim]")
            break
        intent = parse_message(user_message)
        try:
            result = _execute_chat_intent(intent, data=data, iterations=iterations)
            console.print(f"[bold green]AlphaFoundry:[/bold green] action={intent.action}")
            if intent.action == "run":
                console.print(f"Completed full paper pipeline for [bold]{result['strategy']}[/bold]")
                console.print(f"Report: {result['artifacts']['report']}")
            else:
                console.print(json.dumps(_json_safe(result), indent=2))
        except Exception as exc:
            console.print(f"[red]Error:[/red] {exc}")


if __name__ == "__main__":
    app()
