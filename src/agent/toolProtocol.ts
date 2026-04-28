import type { ToolContext, ToolObservation } from "../tools/types.js";
import { ToolRegistry } from "../tools/registry.js";

export interface PiStyleToolCall {
  id: string;
  name: string;
  arguments: unknown;
}

export interface PiStyleToolResult {
  id: string;
  name: string;
  observation: ToolObservation;
}

export async function executeToolCalls(registry: ToolRegistry, calls: PiStyleToolCall[], context: ToolContext): Promise<PiStyleToolResult[]> {
  const results: PiStyleToolResult[] = [];
  for (const call of calls) {
    const tool = registry.get(call.name);
    if (!tool) {
      results.push({ id: call.id, name: call.name, observation: { ok: false, error: `Unknown tool: ${call.name}`, metadata: { tool: call.name, timestamp: new Date().toISOString() } } });
      continue;
    }
    const validationError = validateRequiredArguments(tool.schema, call.arguments);
    if (validationError) {
      results.push({ id: call.id, name: call.name, observation: { ok: false, error: validationError, metadata: { tool: call.name, timestamp: new Date().toISOString() } } });
      continue;
    }
    results.push({ id: call.id, name: call.name, observation: await registry.call(call.name, call.arguments, context) });
  }
  return results;
}

function validateRequiredArguments(schema: Record<string, unknown>, value: unknown): string | null {
  const required = Array.isArray(schema.required) ? schema.required.filter((item): item is string => typeof item === "string") : [];
  if (!required.length) return null;
  if (typeof value !== "object" || value === null) return `Missing required tool argument: ${required[0]}`;
  const record = value as Record<string, unknown>;
  for (const key of required) {
    if (!(key in record) || record[key] === undefined || record[key] === null || record[key] === "") return `Missing required tool argument: ${key}`;
  }
  return null;
}
