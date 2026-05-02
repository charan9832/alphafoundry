import { randomUUID } from "node:crypto";
import { redactUnknown } from "../redaction.js";
import { decidePermission } from "./permissions.js";
import {
  DEFAULT_TOOL_PACK_REGISTRY,
  TOOL_PACK_SCHEMA_VERSION,
  validateToolPackId,
} from "./tool-packs.js";

export const TOOL_PACK_EXECUTOR_SCHEMA_VERSION = 1;

function createExecutionId() {
  return `exc_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

function baseResult(input, decision, extra = {}) {
  return redactUnknown({
    schemaVersion: TOOL_PACK_EXECUTOR_SCHEMA_VERSION,
    executionId: input.executionId ?? createExecutionId(),
    packId: input.packId ?? null,
    action: input.action ?? null,
    decision,
    permission: extra.permission ?? null,
    result: extra.result ?? undefined,
    error: extra.error ?? undefined,
    reason: extra.reason ?? "",
    timestamp: input.timestamp ?? new Date().toISOString(),
  });
}

export function executeToolPackAction(options = {}) {
  const {
    packId,
    action,
    input = {},
    registry = DEFAULT_TOOL_PACK_REGISTRY,
    enabled = [],
    handlers = {},
    permissionContext = {},
    timestamp,
  } = options;

  if (!packId || !action) {
    return baseResult(
      { packId, action, timestamp },
      "deny",
      { reason: "Missing packId or action." },
    );
  }

  const idCheck = validateToolPackId(packId);
  if (!idCheck.ok) {
    return baseResult(
      { packId, action, timestamp },
      "deny",
      { reason: idCheck.reason },
    );
  }

  const normalizedPackId = idCheck.id;
  const pack = registry.packs?.[normalizedPackId];
  if (!pack) {
    return baseResult(
      { packId: normalizedPackId, action, timestamp },
      "deny",
      { reason: "Unknown tool pack; execution fails closed." },
    );
  }

  if (!enabled.includes(normalizedPackId)) {
    return baseResult(
      { packId: normalizedPackId, action, timestamp },
      "deny",
      { reason: "Tool pack is not explicitly enabled." },
    );
  }

  const handlerGroup = handlers[normalizedPackId];
  if (!handlerGroup || typeof handlerGroup[action] !== "function") {
    return baseResult(
      { packId: normalizedPackId, action, timestamp },
      "deny",
      { reason: "Unknown action." },
    );
  }

  const toolName = `${normalizedPackId}/${action}`;
  const permission = decidePermission({
    mode: permissionContext.mode,
    risk: permissionContext.risk ?? "destructive",
    toolName,
    path: permissionContext.path,
    reason: permissionContext.reason,
    workspace: permissionContext.workspace,
    alphaFoundryHome: permissionContext.alphaFoundryHome,
    env: permissionContext.env,
    home: permissionContext.home,
  });

  if (permission.decision === "deny") {
    return baseResult(
      { packId: normalizedPackId, action, timestamp },
      "deny",
      { reason: permission.reason, permission },
    );
  }

  if (permission.decision === "ask") {
    return baseResult(
      { packId: normalizedPackId, action, timestamp },
      "ask",
      { reason: permission.reason, permission },
    );
  }

  try {
    const rawResult = handlerGroup[action](input);
    return baseResult(
      { packId: normalizedPackId, action, timestamp },
      "allow",
      { result: rawResult, permission, reason: permission.reason },
    );
  } catch (error) {
    return baseResult(
      { packId: normalizedPackId, action, timestamp },
      "deny",
      { error: String(error.message ?? error), permission, reason: `Execution error: ${error.message ?? error}.` },
    );
  }
}
