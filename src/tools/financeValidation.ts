import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ToolDefinition } from "./types.js";
import { failedObservation, observation } from "./types.js";
import { callFinanceEngine } from "./pythonBridge.js";
import { normalizeSymbol } from "./finance.js";

interface ValidationInput {
  symbol: string;
  strategy?: string;
  start?: string;
  end?: string;
  initialCapital?: number;
}

async function persist(workspace: string, symbol: string, kind: "validation" | "optimization", strategy: string, data: unknown): Promise<string> {
  const dir = join(workspace, "artifacts", normalizeSymbol(symbol), kind);
  await mkdir(dir, { recursive: true });
  const path = join(dir, `${strategy}.json`);
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return path;
}

export function financeValidationTools(): ToolDefinition[] {
  return [validationSuiteTool(), optimizeStrategyTool()];
}

function validationSuiteTool(): ToolDefinition<ValidationInput, Record<string, unknown>> {
  return {
    name: "run_validation_suite",
    description: "Run deterministic validation checks: walk-forward, sensitivity, and cost stress. Research only; no live trading.",
    category: "validation",
    schema: { type: "object", required: ["symbol"], properties: { symbol: { type: "string" }, strategy: { type: "string" }, start: { type: "string" }, end: { type: "string" }, initialCapital: { type: "number" } }, additionalProperties: false },
    async execute(input, context) {
      const symbol = normalizeSymbol(input.symbol ?? "");
      if (!symbol) return failedObservation("run_validation_suite", "symbol is required") as never;
      const params = { symbol, strategy: input.strategy ?? "moving-average-trend-baseline", start: input.start ?? "2020-01-01", end: input.end ?? "2024-12-31", initialCapital: input.initialCapital ?? 10_000 };
      const response = await callFinanceEngine<Record<string, unknown>>({ method: "run_validation_suite", params });
      if (!response.data) return failedObservation("run_validation_suite", "finance engine returned no validation data") as never;
      const artifactPath = await persist(context.workspace, symbol, "validation", params.strategy, response.data);
      return observation("run_validation_suite", { ...response.data, artifactPath }, { provenance: { ...(response.metadata ?? {}), artifactPath }, warnings: ["Research and paper validation only. Validation does not imply future performance."] });
    },
  };
}

function optimizeStrategyTool(): ToolDefinition<ValidationInput, Record<string, unknown>> {
  return {
    name: "optimize_strategy",
    description: "Run bounded deterministic parameter search and return overfit warnings. Research only; no live trading.",
    category: "validation",
    schema: { type: "object", required: ["symbol"], properties: { symbol: { type: "string" }, strategy: { type: "string" }, start: { type: "string" }, end: { type: "string" }, initialCapital: { type: "number" } }, additionalProperties: false },
    async execute(input, context) {
      const symbol = normalizeSymbol(input.symbol ?? "");
      if (!symbol) return failedObservation("optimize_strategy", "symbol is required") as never;
      const params = { symbol, strategy: input.strategy ?? "moving-average-trend-baseline", start: input.start ?? "2020-01-01", end: input.end ?? "2024-12-31", initialCapital: input.initialCapital ?? 10_000 };
      const response = await callFinanceEngine<Record<string, unknown>>({ method: "optimize_strategy", params });
      if (!response.data) return failedObservation("optimize_strategy", "finance engine returned no optimization data") as never;
      const artifactPath = await persist(context.workspace, symbol, "optimization", params.strategy, response.data);
      return observation("optimize_strategy", { ...response.data, artifactPath }, { provenance: { ...(response.metadata ?? {}), artifactPath }, warnings: ["Bounded optimization can overfit. Treat results as research hypotheses only."] });
    },
  };
}
