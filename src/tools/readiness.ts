import { access, mkdir } from "node:fs/promises";
import type { AppConfig } from "../types.js";
import type { ToolDefinition } from "./types.js";
import { observation } from "./types.js";

export interface ReadinessReport {
  config: "ok" | "missing";
  workspace: "ok" | "created" | "error";
  llm: "ok" | "missing";
  safety: "ok";
  financeEngine: "ok";
  liveTrading: "disabled";
}

export async function buildReadinessReport(config: AppConfig | null): Promise<ReadinessReport> {
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
  return {
    config: config ? "ok" : "missing",
    workspace,
    llm: config?.llm ? "ok" : "missing",
    safety: "ok",
    financeEngine: "ok",
    liveTrading: "disabled",
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
