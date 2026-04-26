import type { AppConfig, AgentResponse } from "../types.js";
import { evaluateSafety, researchDisclaimer } from "../safety.js";
import { SessionLog } from "../sessions.js";
import { makeAgentAdapter } from "./adapters.js";
import { ToolRegistry } from "../tools/registry.js";
import { readinessTool } from "../tools/readiness.js";
import { mockBacktestTool, reportTool } from "../tools/finance.js";

export function systemPrompt(): string {
  return [
    "You are AlphaFoundry, a local-first AI finance research agent.",
    "You use deterministic tools for finance calculations and never invent performance metrics.",
    "You refuse live trading, broker access, order placement, and profit guarantees.",
    "Always state that outputs are research/paper-validation only when discussing strategies.",
  ].join("\n");
}

export function buildRegistry(configProvider: () => Promise<AppConfig | null>): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(readinessTool(configProvider));
  registry.register(mockBacktestTool());
  registry.register(reportTool());
  return registry;
}

export async function respondToMessage(config: AppConfig, message: string, configProvider: () => Promise<AppConfig | null>): Promise<AgentResponse> {
  const session = new SessionLog(config.workspace);
  await session.append({ type: "user", data: { message } });

  const safety = evaluateSafety(message);
  if (!safety.allowed) {
    await session.append({ type: "safety", data: { reason: safety.reason } });
    return { response: `${safety.reason}\n\n${researchDisclaimer()}`, source: "safety" };
  }

  const registry = buildRegistry(configProvider);
  const adapter = makeAgentAdapter(config);
  const toolSummaries = registry.list().map((tool) => ({ name: tool.name, description: tool.description, schema: tool.schema }));
  const adapterResponse = await adapter.complete({ systemPrompt: systemPrompt(), message, tools: toolSummaries });

  if (adapterResponse.toolName) {
    const observation = await registry.call(adapterResponse.toolName, adapterResponse.toolInput ?? {}, { workspace: config.workspace });
    await session.append({ type: "tool", data: { name: adapterResponse.toolName, observation } });
    let response = `${adapterResponse.text}\n\nTool ${adapterResponse.toolName}: ${observation.ok ? "completed" : "failed"}.`;
    if (observation.ok) response += `\n${JSON.stringify(observation.data, null, 2)}`;
    else response += `\n${observation.error}`;
    await session.append({ type: "assistant", data: { response, provider: adapterResponse.provider, model: adapterResponse.model } });
    return { response, source: "tool", metadata: { provider: adapterResponse.provider, model: adapterResponse.model, tool: adapterResponse.toolName } };
  }

  await session.append({ type: "assistant", data: { response: adapterResponse.text, provider: adapterResponse.provider, model: adapterResponse.model } });
  return { response: adapterResponse.text, source: "llm", metadata: { provider: adapterResponse.provider, model: adapterResponse.model } };
}
