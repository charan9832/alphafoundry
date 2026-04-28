export type ProviderKind =
  | "local"
  | "openai-compatible"
  | "azure-openai"
  | "openrouter"
  | "anthropic"
  | "gemini";

export interface LlmConfig {
  provider: ProviderKind;
  model: string;
  baseUrl?: string | undefined;
  apiKeyEnv?: string | undefined;
}

export type SearchProviderKind = "none" | "searxng" | "firecrawl" | "custom";

export interface SearchConfig {
  provider: SearchProviderKind;
  endpoint?: string | undefined;
  apiKeyEnv?: string | undefined;
  autoDetected?: boolean | undefined;
}

export interface AppConfig {
  version: 1;
  workspace: string;
  llm?: LlmConfig;
  search?: SearchConfig;
  safety: {
    liveTradingEnabled: false;
    disclaimerAccepted: boolean;
  };
}

export interface AgentMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface AgentResponse {
  response: string;
  source: "llm" | "tool" | "safety" | "onboarding";
  metadata?: Record<string, unknown>;
}
