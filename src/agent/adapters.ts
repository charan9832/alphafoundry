import type { AppConfig } from "../types.js";
import type { Model, ToolCall } from "@mariozechner/pi-ai";

export interface AgentAdapterRequest {
  systemPrompt: string;
  message: string;
  tools: { name: string; description: string; schema: Record<string, unknown> }[];
  observations?: { toolName: string; result: unknown }[];
}

export interface AgentAdapterResponse {
  text: string;
  toolName?: string;
  toolInput?: unknown;
  provider: string;
  model: string;
}

export interface AgentAdapter {
  complete(request: AgentAdapterRequest): Promise<AgentAdapterResponse>;
}

function inferSymbol(message: string): string {
  return /\b([A-Z]{2,5})\b/.exec(message)?.[1] ?? "SPY";
}

export class LocalAgentAdapter implements AgentAdapter {
  constructor(private readonly config: AppConfig) {}

  async complete(request: AgentAdapterRequest): Promise<AgentAdapterResponse> {
    if (request.observations?.length) {
      const latest = request.observations.at(-1);
      return {
        text: `I completed ${latest?.toolName}. The result is tool-backed and saved in the workspace. Research and paper validation only; no live trading or profit guarantees.`,
        provider: "local",
        model: this.config.llm?.model ?? "local-finance-agent",
      };
    }
    const lower = request.message.toLowerCase();
    if (lower.includes("readiness") || lower.includes("doctor") || lower.includes("system status")) {
      return { text: "I will check system readiness.", toolName: "readiness", toolInput: {}, provider: "local", model: this.config.llm?.model ?? "local" };
    }
    if (lower.includes("create project") || lower.includes("new project")) {
      const symbol = inferSymbol(request.message);
      return { text: `I will create a local research project for ${symbol}.`, toolName: "create_project", toolInput: { name: `${symbol.toLowerCase()}-research`, symbols: [symbol], thesis: request.message }, provider: "local", model: this.config.llm?.model ?? "local" };
    }
    if (lower.includes("list projects") || lower.includes("show projects")) {
      return { text: "I will list local research projects.", toolName: "list_projects", toolInput: {}, provider: "local", model: this.config.llm?.model ?? "local" };
    }
    if (lower.includes("remember") || lower.includes("lesson")) {
      return { text: "I will store this as a local research lesson.", toolName: "remember_lesson", toolInput: { lesson: request.message }, provider: "local", model: this.config.llm?.model ?? "local" };
    }
    if (lower.includes("journal") || lower.includes("paper validation") || lower.includes("paper trade")) {
      const symbol = inferSymbol(request.message);
      return { text: `I will create an offline paper-validation journal entry for ${symbol}.`, toolName: "create_paper_journal_entry", toolInput: { symbol, hypothesis: request.message }, provider: "local", model: this.config.llm?.model ?? "local" };
    }
    if (lower.includes("optimize") || lower.includes("parameter search")) {
      const symbol = inferSymbol(request.message);
      return { text: `I will run a bounded research-only optimization for ${symbol}.`, toolName: "optimize_strategy", toolInput: { symbol }, provider: "local", model: this.config.llm?.model ?? "local" };
    }
    if (lower.includes("validate") || lower.includes("walk-forward") || lower.includes("sensitivity") || lower.includes("cost stress")) {
      const symbol = inferSymbol(request.message);
      return { text: `I will run deterministic validation checks for ${symbol}.`, toolName: "run_validation_suite", toolInput: { symbol }, provider: "local", model: this.config.llm?.model ?? "local" };
    }
    if (lower.includes("backtest") || lower.includes("test") || lower.includes("strategy") || lower.includes("research workflow")) {
      const symbol = inferSymbol(request.message);
      return {
        text: `I will run a deterministic research workflow for ${symbol}: local data, backtest, validation, and report artifacts.`,
        toolName: "run_research_workflow",
        toolInput: { symbol },
        provider: "local",
        model: this.config.llm?.model ?? "local",
      };
    }
    return {
      text: "Hey — I’m ready. I can help research markets, design strategies, run tool-backed backtests, validate assumptions, and generate reports. What should we investigate?",
      provider: "local",
      model: this.config.llm?.model ?? "local-finance-agent",
    };
  }
}

export class PiSdkAgentAdapter implements AgentAdapter {
  constructor(private readonly config: AppConfig) {}

  async complete(request: AgentAdapterRequest): Promise<AgentAdapterResponse> {
    if (!this.config.llm) {
      throw new Error("LLM configuration is missing. Run AlphaFoundry onboarding first.");
    }
    if (!this.config.llm.apiKeyEnv || !process.env[this.config.llm.apiKeyEnv]) {
      throw new Error(`Missing API key environment variable: ${this.config.llm.apiKeyEnv ?? "unset"}`);
    }

    const piAi = await import("@mariozechner/pi-ai");
    const provider = this.mapProvider(this.config.llm.provider);
    const model = this.createModel(piAi, provider);
    const messages = [
      { role: "user" as const, content: this.composeUserMessage(request), timestamp: Date.now() },
    ];
    const context = {
      systemPrompt: request.systemPrompt,
      messages,
      tools: request.tools.map((tool) => ({ name: tool.name, description: tool.description, parameters: tool.schema as never })),
    };
    const apiKey = process.env[this.config.llm.apiKeyEnv];
    if (!apiKey) {
      throw new Error(`Missing API key environment variable: ${this.config.llm.apiKeyEnv}`);
    }
    const raw = await piAi.complete(model, context, {
      apiKey,
      temperature: 0.1,
      maxTokens: 1200,
      timeoutMs: 30_000,
    });
    const toolCall = raw.content.find((content): content is ToolCall => content.type === "toolCall");
    const response: AgentAdapterResponse = {
      text: extractText(raw) || (toolCall ? `I will call ${toolCall.name}.` : "I received an empty provider response."),
      provider: raw.provider || this.config.llm.provider,
      model: raw.model || this.config.llm.model,
    };
    if (toolCall) {
      response.toolName = toolCall.name;
      response.toolInput = toolCall.arguments;
    }
    return response;
  }

  private composeUserMessage(request: AgentAdapterRequest): string {
    if (!request.observations?.length) return request.message;
    return [
      request.message,
      "",
      "Tool observations already completed:",
      ...request.observations.map((observation) => `${observation.toolName}: ${JSON.stringify(observation.result)}`),
      "",
      "Now summarize the evidence, artifact paths, validation status, warnings, and next step. Do not invent metrics.",
    ].join("\n");
  }

  private mapProvider(provider: string): string {
    if (provider === "openai-compatible") return "openai";
    if (provider === "azure-openai") return "azure-openai-responses";
    return provider;
  }

  private createModel(piAi: { getModel: (provider: never, model: never) => Model<never> }, provider: string): Model<never> {
    if (!this.config.llm) throw new Error("LLM configuration is missing. Run AlphaFoundry onboarding first.");
    if (this.config.llm.provider === "openai-compatible" && this.config.llm.baseUrl) {
      return {
        id: this.config.llm.model,
        name: this.config.llm.model,
        api: "openai-completions",
        provider: "openai",
        baseUrl: this.config.llm.baseUrl,
        reasoning: false,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128_000,
        maxTokens: 4_000,
        compat: { thinkingFormat: "openrouter" },
      } as Model<never>;
    }
    return piAi.getModel(provider as never, this.config.llm.model as never);
  }
}

export function extractText(value: unknown): string {
  const maybe = value as { content?: unknown[] };
  if (Array.isArray(maybe.content)) {
    return maybe.content
      .filter((block): block is { type: "text"; text: string } => typeof block === "object" && block !== null && (block as { type?: unknown }).type === "text")
      .map((block) => block.text)
      .join(" ")
      .trim();
  }
  return "";
}

export function makeAgentAdapter(config: AppConfig): AgentAdapter {
  if (config.llm?.provider === "local" || !config.llm) return new LocalAgentAdapter(config);
  return new PiSdkAgentAdapter(config);
}
