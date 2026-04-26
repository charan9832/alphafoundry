import type { AppConfig } from "../types.js";

export interface AgentAdapterRequest {
  systemPrompt: string;
  message: string;
  tools: { name: string; description: string; schema: Record<string, unknown> }[];
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

export class MockAgentAdapter implements AgentAdapter {
  constructor(private readonly config: AppConfig) {}

  async complete(request: AgentAdapterRequest): Promise<AgentAdapterResponse> {
    const lower = request.message.toLowerCase();
    if (lower.includes("readiness") || lower.includes("doctor") || lower.includes("system status")) {
      return { text: "I will check system readiness.", toolName: "readiness", toolInput: {}, provider: "mock", model: this.config.llm?.model ?? "mock" };
    }
    if (lower.includes("backtest") || lower.includes("test spy") || lower.includes("strategy")) {
      const symbol = /\b([A-Z]{2,5})\b/.exec(request.message)?.[1] ?? "SPY";
      return {
        text: `I will run a deterministic research backtest for ${symbol} with costs and provenance.`,
        toolName: "run_mock_backtest",
        toolInput: { symbol },
        provider: "mock",
        model: this.config.llm?.model ?? "mock",
      };
    }
    return {
      text: "Hey — I’m ready. I can help research markets, design strategies, run tool-backed backtests, validate assumptions, and generate reports. What should we investigate?",
      provider: "mock",
      model: this.config.llm?.model ?? "mock-finance-agent",
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

    // Dynamic import keeps the product decoupled from Pi API churn and lets tests run with mock provider.
    const piAi = await import("@mariozechner/pi-ai");
    const getModel = piAi.getModel as (provider: string, model: string) => unknown;
    const complete = piAi.complete as (model: unknown, context: unknown) => Promise<unknown>;
    const model = getModel(this.mapProvider(this.config.llm.provider), this.config.llm.model);
    const context = {
      systemPrompt: request.systemPrompt,
      messages: [{ role: "user", content: request.message }],
      tools: request.tools.map((tool) => ({ name: tool.name, description: tool.description, parameters: tool.schema })),
    };
    const raw = await complete(model, context);
    return {
      text: extractText(raw) || "I received a response but could not extract text from the provider output.",
      provider: this.config.llm.provider,
      model: this.config.llm.model,
    };
  }

  private mapProvider(provider: string): string {
    if (provider === "openai-compatible") return "openai";
    if (provider === "azure-openai") return "azure";
    return provider;
  }
}

function extractText(value: unknown): string {
  const textBlocks = JSON.stringify(value).match(/"text":"(.*?)"/g) ?? [];
  return textBlocks.map((block) => JSON.parse(`{${block}}`).text as string).join(" ").trim();
}

export function makeAgentAdapter(config: AppConfig): AgentAdapter {
  if (config.llm?.provider === "mock" || !config.llm) return new MockAgentAdapter(config);
  return new PiSdkAgentAdapter(config);
}
