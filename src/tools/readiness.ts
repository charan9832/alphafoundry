import { access, mkdir } from "node:fs/promises";
import type { AppConfig } from "../types.js";
import type { ToolDefinition } from "./types.js";
import { observation } from "./types.js";
import { callFinanceEngine } from "./pythonBridge.js";

export interface ReadinessReport {
  config: "ok" | "missing";
  workspace: "ok" | "created" | "error";
  llm: "ok" | "missing";
  llmProvider: "local" | "configured" | "missing-key" | "missing";
  safety: "ok";
  financeEngine: "ok" | "error";
  liveTrading: "disabled";
  warnings: string[];
}

export async function buildReadinessReport(config: AppConfig | null): Promise<ReadinessReport> {
  const warnings: string[] = [];
  let workspace: ReadinessReport["workspace"] = "error";
  const workspacePath = config?.workspace;
  if (workspacePath) {
    try {
      await access(workspacePath);
      workspace = "ok";
    } catch {
      await mkdir(workspacePath, { recursive: true });
      workspace = "created";
    }
  }

  let financeEngine: ReadinessReport["financeEngine"] = "error";
  try {
    await callFinanceEngine({ method: "ping" });
    financeEngine = "ok";
  } catch (error) {
    warnings.push(`Finance engine check failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  let llmProvider: ReadinessReport["llmProvider"] = "missing";
  if (config?.llm?.provider === "local") llmProvider = "local";
  else if (config?.llm?.apiKeyEnv && process.env[config.llm.apiKeyEnv]) llmProvider = "configured";
  else if (config?.llm?.apiKeyEnv) {
    llmProvider = "missing-key";
    warnings.push(`Missing API key environment variable: ${config.llm.apiKeyEnv}`);
  }

  return {
    config: config ? "ok" : "missing",
    workspace,
    llm: config?.llm ? "ok" : "missing",
    llmProvider,
    safety: "ok",
    financeEngine,
    liveTrading: "disabled",
    warnings,
  };
}

export function readinessTool(configProvider: () => Promise<AppConfig | null>): ToolDefinition<Record<string, never>, ReadinessReport> {
  return {
    name: "readiness",
    description: "Check AlphaFoundry product, workspace, LLM, finance engine, and safety readiness.",
    category: "system",
    schema: { type: "object", properties: {}, additionalProperties: false },
    async execute() {
      return observation("readiness", await buildReadinessReport(await configProvider()), {
        provenance: { source: "local-system-check" },
      });
    },
  };
}
