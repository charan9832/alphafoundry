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

function wantsWebSearch(lower: string): boolean {
  return lower.includes("web search")
    || lower.includes("search web")
    || lower.includes("search the web")
    || lower.includes("google")
    || lower.includes("latest news")
    || lower.includes("current news")
    || lower.includes("recent news")
    || lower.includes("what's happening")
    || lower.includes("whats happening")
    || (/\b(latest|current|recent|news)\b/.test(lower) && /\b(search|web|company|fed|rates)\b/.test(lower));
}

function wantsFinanceStrategy(lower: string): boolean {
  return /\b(strategy|strategies|backtest|trading|broker|market order|portfolio|stock|etf|paper trade|paper validation)\b/.test(lower);
}

export class LocalAgentAdapter implements AgentAdapter {
  constructor(private readonly config: AppConfig) {}

  async complete(request: AgentAdapterRequest): Promise<AgentAdapterResponse> {
    if (request.observations?.length) {
      const latest = request.observations.at(-1);
      return {
        text: `I completed ${latest?.toolName}. The result is tool-backed and saved in the workspace.`,
        provider: "local",
        model: this.config.llm?.model ?? "local-agent",
      };
    }
    const lower = request.message.toLowerCase();
    if (wantsWebSearch(lower)) {
      return { text: "I will run a safe web search for current external context.", toolName: "web_search", toolInput: { query: request.message, maxResults: 5 }, provider: "local", model: this.config.llm?.model ?? "local" };
    }
    if (lower.includes("readiness") || lower.includes("doctor") || lower.includes("system status")) {
      return { text: "I will check system readiness.", toolName: "readiness", toolInput: {}, provider: "local", model: this.config.llm?.model ?? "local" };
    }
    if (lower.includes("create project") || lower.includes("new project")) {
      return { text: "I will create a local workspace project.", toolName: "create_project", toolInput: { name: request.message.replace(/create project|new project/gi, "").trim() || "agent-project", symbols: [], thesis: request.message }, provider: "local", model: this.config.llm?.model ?? "local" };
    }
    if (lower.includes("list projects") || lower.includes("show projects")) {
      return { text: "I will list local research projects.", toolName: "list_projects", toolInput: {}, provider: "local", model: this.config.llm?.model ?? "local" };
    }
    if (lower.includes("remember") || lower.includes("lesson")) {
      return { text: "I will store this as a local agent note.", toolName: "remember_lesson", toolInput: { lesson: request.message }, provider: "local", model: this.config.llm?.model ?? "local" };
    }
    if (wantsFinanceStrategy(lower)) {
      return {
        text: "The AlphaFoundry starting point is a working general AI agent. Finance-specific tools are intentionally not enabled yet; they should be added later as explicit opt-in tool packs, not core behavior.",
        provider: "local",
        model: this.config.llm?.model ?? "local-agent",
      };
    }
    return {
      text: "Hey — I’m ready. I can chat, check readiness, use configured tools, search when enabled, organize workspace projects, and save notes. What should we work on?",
      provider: "local",
      model: this.config.llm?.model ?? "local-agent",
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
      "Now summarize the completed tool result, important paths, warnings, and next step. Do not invent outputs.",
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
