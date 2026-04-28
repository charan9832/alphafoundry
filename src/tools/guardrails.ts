export interface ToolGuardrailDecision {
  allowed: boolean;
  reason?: string;
}

const FORBIDDEN_TOOL_INPUT_KEYS = /broker|brokerage|order|account|accountId|liveTrading|live_trade|execute|execution/i;
const FORBIDDEN_TOOL_INPUT_VALUES = /\b(place|submit|send|route|execute)\b.*\b(order|trade)\b|\bbroker\b|\baccount\b|\blive\s*trad/i;

function inspect(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value === "string") return [value];
  if (typeof value === "number" || typeof value === "boolean") return [String(value)];
  if (Array.isArray(value)) return value.flatMap((item) => inspect(item));
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => [key, ...inspect(child)]);
  }
  return [String(value)];
}

export function guardToolInput(toolName: string, input: unknown): ToolGuardrailDecision {
  const tokens = [toolName, ...inspect(input)];
  const badKey = tokens.find((token) => FORBIDDEN_TOOL_INPUT_KEYS.test(token));
  if (badKey) return { allowed: false, reason: `Tool input contains prohibited broker/order/account/live-trading field: ${badKey}` };
  const badValue = tokens.find((token) => FORBIDDEN_TOOL_INPUT_VALUES.test(token));
  if (badValue) return { allowed: false, reason: `Tool input contains prohibited execution language: ${badValue}` };
  return { allowed: true };
}
