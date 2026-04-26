export type ProviderKind =
  | "mock"
  | "openai-compatible"
  | "azure-openai"
  | "openrouter"
  | "anthropic"
  | "gemini"
  | "local";

export interface LlmConfig {
  provider: ProviderKind;
  model: string;
  baseUrl?: string;
  apiKeyEnv?: string;
}

export interface AppConfig {
  version: 1;
  workspace: string;
  llm?: LlmConfig;
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
