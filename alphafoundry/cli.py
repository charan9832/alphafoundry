from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.table import Table

from .config import Config, CONFIG_FILE, init_config
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

app = typer.Typer(help="AlphaFoundry: Claude Code for trading strategies.")
console = Console()


def _cfg() -> Config:
    return Config.load()


def _strategy_py(name: str) -> Path:
    return strategy_dir(_cfg(), name) / "strategy.py"


@app.command()
def init():
    """Initialize AlphaFoundry config and workspace."""
    cfg = init_config()
    init_wiki(cfg.workspace_path / "wiki")
    console.print(f"[green]Initialized AlphaFoundry[/green] config={CONFIG_FILE} workspace={cfg.workspace_path}")


@app.command()
def doctor():
    """Check local product readiness and optional integrations."""
    cfg = _cfg()
    table = Table(title="AlphaFoundry Doctor")
    table.add_column("Check")
    table.add_column("Status")
    table.add_column("Detail")
    table.add_row("config", "PASS" if CONFIG_FILE.exists() else "WARN", str(CONFIG_FILE))
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
def chat():
    """Interactive planning placeholder."""
    console.print("[cyan]AlphaFoundry chat MVP[/cyan]: use create/backtest/validate commands. Full LLM chat is planned after deterministic engine stabilization.")
