export interface ToolContext {
  workspace: string;
}

export interface ToolObservation<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  metadata: {
    tool: string;
    timestamp: string;
    provenance?: Record<string, unknown>;
    warnings?: string[];
  };
}

export interface ToolDefinition<Input = unknown, Output = unknown> {
  name: string;
  description: string;
  category: "system" | "data" | "memory" | "workspace" | "report";
  schema: Record<string, unknown>;
  execute(input: Input, context: ToolContext): Promise<ToolObservation<Output>>;
}

export function observation<T>(tool: string, data: T, extra: Partial<ToolObservation<T>["metadata"]> = {}): ToolObservation<T> {
  return { ok: true, data, metadata: { tool, timestamp: new Date().toISOString(), ...extra } };
}

export function failedObservation(tool: string, error: string): ToolObservation {
  return { ok: false, error, metadata: { tool, timestamp: new Date().toISOString() } };
}
