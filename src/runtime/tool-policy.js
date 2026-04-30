import { randomUUID } from "node:crypto";

import { redactUnknown } from "../redaction.js";
import { decidePermission, normalizeMode, normalizeRiskClass } from "./permissions.js";

export const RUNTIME_TOOL_POLICY_SCHEMA_VERSION = 1;

function createIntentId() {
  return `intent_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

function normalizeToolName(toolName) {
  return typeof toolName === "string" && toolName.length > 0 ? toolName : null;
}

function deniedIntent(intent, context, reason, extra = {}) {
  return redactUnknown({
    schemaVersion: RUNTIME_TOOL_POLICY_SCHEMA_VERSION,
    intentId: intent.id ?? createIntentId(),
    adapter: intent.adapter ?? context.adapter ?? "runtime",
    mode: extra.mode ?? String(context.mode ?? "ask").toLowerCase(),
    toolName: normalizeToolName(intent.toolName),
    risk: extra.risk ?? "destructive",
    path: intent.path ?? null,
    decision: "deny",
    requiresApproval: false,
    reason,
    protectedPath: null,
    ...(intent.metadata !== undefined ? { metadata: intent.metadata } : {}),
    timestamp: context.timestamp ?? new Date().toISOString(),
  });
}

export function mapRuntimeToolIntent(intent = {}, context = {}) {
  let mode;
  try {
    mode = normalizeMode(context.mode ?? "ask");
  } catch (error) {
    return deniedIntent(intent, context, error.message);
  }

  let risk;
  try {
    risk = normalizeToolName(intent.toolName) ? normalizeRiskClass(intent.risk ?? "destructive") : "destructive";
  } catch (error) {
    return deniedIntent(intent, { ...context, mode }, error.message);
  }

  const decision = decidePermission({
    mode,
    risk,
    toolName: normalizeToolName(intent.toolName) ?? undefined,
    path: intent.path,
    reason: intent.reason,
    workspace: context.workspace,
    alphaFoundryHome: context.alphaFoundryHome,
    env: context.env,
    home: context.home,
  });

  return redactUnknown({
    schemaVersion: RUNTIME_TOOL_POLICY_SCHEMA_VERSION,
    intentId: intent.id ?? createIntentId(),
    adapter: intent.adapter ?? context.adapter ?? "runtime",
    mode,
    toolName: decision.toolName,
    risk: decision.risk,
    path: decision.path,
    decision: decision.decision,
    requiresApproval: decision.requiresApproval,
    reason: decision.reason,
    protectedPath: decision.protectedPath,
    ...(intent.metadata !== undefined ? { metadata: intent.metadata } : {}),
    timestamp: context.timestamp ?? new Date().toISOString(),
  });
}

function summarize(results) {
  const counts = { allow: 0, ask: 0, deny: 0 };
  for (const result of results) counts[result.decision] += 1;
  const decision = counts.deny > 0 ? "deny" : counts.ask > 0 ? "ask" : "allow";
  return { counts, decision };
}

export function mapRuntimeToolPolicy(options = {}) {
  const results = (options.intents ?? []).map((intent) => mapRuntimeToolIntent(intent, options));
  const summary = summarize(results);
  return redactUnknown({
    schemaVersion: RUNTIME_TOOL_POLICY_SCHEMA_VERSION,
    mode: results[0]?.mode ?? String(options.mode ?? "ask").toLowerCase(),
    decision: summary.decision,
    requiresApproval: summary.decision === "ask",
    counts: summary.counts,
    results,
    timestamp: options.timestamp ?? new Date().toISOString(),
  });
}
