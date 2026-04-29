import { randomUUID } from "node:crypto";
import { redactUnknown } from "../redaction.js";

export const RUNTIME_EVENT_SCHEMA_VERSION = 1;

export const RUNTIME_EVENT_TYPES = Object.freeze([
  "run_start",
  "user",
  "assistant_delta",
  "assistant",
  "stdout",
  "stderr",
  "tool_call",
  "tool_result",
  "permission_request",
  "permission_decision",
  "diff",
  "artifact",
  "stats",
  "final",
  "error",
  "run_end",
]);

const TYPE_SET = new Set(RUNTIME_EVENT_TYPES);

export function isRuntimeEventType(type) {
  return TYPE_SET.has(type);
}

export function createRuntimeId(prefix) {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

export function createRuntimeEvent(type, options = {}) {
  if (!isRuntimeEventType(type)) {
    throw new TypeError(`Unknown AlphaFoundry runtime event type: ${type ?? "<missing>"}`);
  }
  const timestamp = options.timestamp ?? new Date().toISOString();
  return {
    schemaVersion: RUNTIME_EVENT_SCHEMA_VERSION,
    eventId: options.eventId ?? createRuntimeId("evt"),
    type,
    timestamp,
    ...(options.sessionId ? { sessionId: options.sessionId } : {}),
    ...(options.runId ? { runId: options.runId } : {}),
    payload: redactUnknown(options.payload ?? {}),
  };
}

export function parseRuntimeEvent(line) {
  const event = typeof line === "string" ? JSON.parse(line) : line;
  if (!event || event.schemaVersion !== RUNTIME_EVENT_SCHEMA_VERSION || !isRuntimeEventType(event.type)) {
    throw new TypeError("Invalid AlphaFoundry runtime event");
  }
  return event;
}
