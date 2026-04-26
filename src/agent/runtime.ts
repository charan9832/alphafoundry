import type { AppConfig, AgentResponse } from "../types.js";
import { evaluateSafety, researchDisclaimer } from "../safety.js";
import { SessionLog } from "../sessions.js";
import { makeAgentAdapter } from "./adapters.js";
import { ToolRegistry } from "../tools/registry.js";
import { readinessTool } from "../tools/readiness.js";
import { mockBacktestTool, reportTool, researchWorkflowTool } from "../tools/finance.js";

export function systemPrompt(): string {
  return [
    "You are AlphaFoundry, a local-first AI finance research agent.",
    "You use deterministic tools for finance calculations and never invent performance metrics.",
    "You refuse live trading, broker access, order placement, and profit guarantees.",
    "Use tools whenever the user asks for readiness, research, strategy testing, backtesting, validation, reports, or artifacts.",
    "For strategy research, prefer run_research_workflow with a ticker symbol and summarize artifact paths, validation status, warnings, and next step.",
    "Always state that outputs are research/paper-validation only when discussing strategies.",
  ].join("\n");
}

export function buildRegistry(configProvider: () => Promise<AppConfig | null>): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(readinessTool(configProvider));
  registry.register(researchWorkflowTool());
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
  const observations: { toolName: string; result: unknown }[] = [];
  let lastText = "";
  let provider: string = config.llm?.provider ?? "mock";
  let model = config.llm?.model ?? "mock";
  let lastTool: string | undefined;

  for (let step = 0; step < 5; step += 1) {
    const adapterResponse = await adapter.complete({ systemPrompt: systemPrompt(), message, tools: toolSummaries, observations });
    provider = adapterResponse.provider;
    model = adapterResponse.model;
    lastText = adapterResponse.text;

    const assistantSafety = evaluateSafety(adapterResponse.text);
    if (!assistantSafety.allowed) {
      await session.append({ type: "safety", data: { reason: assistantSafety.reason, assistantText: adapterResponse.text } });
      return { response: `${assistantSafety.reason}\n\n${researchDisclaimer()}`, source: "safety" };
    }

    if (!adapterResponse.toolName) {
      await session.append({ type: "assistant", data: { response: adapterResponse.text, provider, model, observations } });
      return {
        response: formatFinalResponse(adapterResponse.text, observations),
        source: observations.length ? "tool" : "llm",
        metadata: { provider, model, tool: lastTool, observations: observations.length },
      };
    }

    lastTool = adapterResponse.toolName;
    const observation = await registry.call(adapterResponse.toolName, adapterResponse.toolInput ?? {}, { workspace: config.workspace });
    observations.push({ toolName: adapterResponse.toolName, result: observation });
    await session.append({ type: "tool", data: { name: adapterResponse.toolName, observation } });

    if (!observation.ok) {
      const response = `${adapterResponse.text}\n\nTool ${adapterResponse.toolName} failed: ${observation.error}`;
      await session.append({ type: "assistant", data: { response, provider, model } });
      return { response, source: "tool", metadata: { provider, model, tool: adapterResponse.toolName, failed: true } };
    }

    if (config.llm?.provider === "mock") {
      const response = formatFinalResponse(adapterResponse.text, observations);
      await session.append({ type: "assistant", data: { response, provider, model, observations } });
      return { response, source: "tool", metadata: { provider, model, tool: adapterResponse.toolName, observations: observations.length } };
    }
  }

  const response = formatFinalResponse(`${lastText}\n\nStopped after the maximum tool-call depth.`, observations);
  await session.append({ type: "assistant", data: { response, provider, model, observations, maxDepth: true } });
  return { response, source: observations.length ? "tool" : "llm", metadata: { provider, model, tool: lastTool, maxDepth: true } };
}

function formatFinalResponse(text: string, observations: { toolName: string; result: unknown }[]): string {
  if (!observations.length) return text;
  const evidence = observations
    .map((item) => `Tool ${item.toolName}:\n${JSON.stringify(item.result, null, 2)}`)
    .join("\n\n");
  return `${text}\n\n${evidence}\n\n${researchDisclaimer()}`;
}
