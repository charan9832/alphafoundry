import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ToolDefinition } from "./types.js";
import { failedObservation, observation } from "./types.js";

export interface BacktestInput {
  symbol: string;
  strategy?: string;
  start?: string;
  end?: string;
  initialCapital?: number;
}

export interface BacktestResult {
  symbol: string;
  strategy: string;
  start: string;
  end: string;
  assumptions: {
    feesBps: number;
    slippageBps: number;
    liveTrading: false;
  };
  metrics: {
    totalReturnPct: number;
    maxDrawdownPct: number;
    trades: number;
  };
  artifactPath: string;
}

export function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export function mockBacktestTool(): ToolDefinition<BacktestInput, BacktestResult> {
  return {
    name: "run_mock_backtest",
    description: "Run a deterministic mock backtest with explicit assumptions and provenance for product smoke tests.",
    category: "backtest",
    schema: {
      type: "object",
      required: ["symbol"],
      properties: {
        symbol: { type: "string" },
        strategy: { type: "string" },
        start: { type: "string" },
        end: { type: "string" },
        initialCapital: { type: "number" },
      },
    },
    async execute(input, context) {
      const symbol = normalizeSymbol(input.symbol ?? "");
      if (!symbol) {
        return failedObservation("run_mock_backtest", "symbol is required") as never;
      }
      const start = input.start ?? "2020-01-01";
      const end = input.end ?? "2024-12-31";
      const strategy = input.strategy ?? "moving-average-research-baseline";
      const result: BacktestResult = {
        symbol,
        strategy,
        start,
        end,
        assumptions: { feesBps: 5, slippageBps: 10, liveTrading: false },
        metrics: { totalReturnPct: 12.4, maxDrawdownPct: -8.7, trades: 18 },
        artifactPath: "",
      };
      const dir = join(context.workspace, "artifacts", symbol, "backtests");
      await mkdir(dir, { recursive: true });
      const artifactPath = join(dir, `${strategy}.json`);
      result.artifactPath = artifactPath;
      await writeFile(artifactPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
      return observation("run_mock_backtest", result, {
        provenance: { provider: "mock-deterministic-engine", symbol, start, end },
        warnings: ["Mock backtest for scaffold validation only; not investment advice."],
      });
    },
  };
}

export function reportTool(): ToolDefinition<{ title?: string; backtest: BacktestResult }, { path: string; markdown: string }> {
  return {
    name: "generate_report",
    description: "Generate a Markdown research report from a tool-backed backtest result.",
    category: "report",
    schema: { type: "object" },
    async execute(input, context) {
      const bt = input.backtest;
      const title = input.title ?? `${bt.symbol} ${bt.strategy} research report`;
      const markdown = [
        `# ${title}`,
        "",
        "Research and paper validation only. No live trading or profit guarantees.",
        "",
        `- Symbol: ${bt.symbol}`,
        `- Strategy: ${bt.strategy}`,
        `- Period: ${bt.start} to ${bt.end}`,
        `- Fees: ${bt.assumptions.feesBps} bps`,
        `- Slippage: ${bt.assumptions.slippageBps} bps`,
        `- Total return: ${bt.metrics.totalReturnPct}%`,
        `- Max drawdown: ${bt.metrics.maxDrawdownPct}%`,
        `- Trades: ${bt.metrics.trades}`,
        "",
        "Limitations: scaffold mock engine; replace with real deterministic validation before relying on results.",
      ].join("\n");
      const dir = join(context.workspace, "reports");
      await mkdir(dir, { recursive: true });
      const path = join(dir, `${bt.symbol}-${bt.strategy}.md`);
      await writeFile(path, `${markdown}\n`, "utf8");
      return observation("generate_report", { path, markdown }, { provenance: { source: bt.artifactPath } });
    },
  };
}
