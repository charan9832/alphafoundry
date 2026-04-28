export type AFMessageRole = "system" | "user" | "assistant" | "tool";

export interface AFMessage {
  role: AFMessageRole;
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface AFToolCall {
  id: string;
  name: string;
  input: unknown;
}

export interface AFToolObservation {
  toolCallId?: string;
  toolName: string;
  ok: boolean;
  data?: unknown;
  error?: string;
  metadata: Record<string, unknown>;
}

export interface AFModelRequest {
  systemPrompt: string;
  messages: AFMessage[];
  tools: { name: string; description: string; schema: Record<string, unknown> }[];
  observations: AFToolObservation[];
}

export interface AFModelResponse {
  text: string;
  toolCalls: AFToolCall[];
  provider: string;
  model: string;
}

export function userMessage(content: string, metadata?: Record<string, unknown>): AFMessage {
  return { role: "user", content, timestamp: new Date().toISOString(), ...(metadata ? { metadata } : {}) };
}
