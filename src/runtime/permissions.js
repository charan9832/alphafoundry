import { redactUnknown } from "../redaction.js";
import { classifyProtectedPath } from "./protected-paths.js";

export const PERMISSION_MODES = Object.freeze(["plan", "ask", "act", "auto"]);
export const RISK_CLASSES = Object.freeze(["read", "write", "shell", "network", "mcp", "credential", "destructive"]);

const MODE_SET = new Set(PERMISSION_MODES);
const RISK_SET = new Set(RISK_CLASSES);

export function normalizeMode(mode = "ask") {
  const normalized = String(mode ?? "ask").toLowerCase();
  if (!MODE_SET.has(normalized)) throw new TypeError(`Unsupported permission mode: ${mode}`);
  return normalized;
}

export function normalizeRiskClass(risk = "destructive") {
  const normalized = String(risk ?? "destructive").toLowerCase();
  if (!RISK_SET.has(normalized)) throw new TypeError(`Unsupported risk class: ${risk}`);
  return normalized;
}

function baseDecision(input, decision, extra = {}) {
  return redactUnknown({
    mode: input.mode,
    risk: input.risk,
    toolName: input.toolName ?? null,
    path: input.path ?? null,
    decision,
    requiresApproval: decision === "ask",
    reason: extra.reason ?? "",
    protectedPath: extra.protectedPath ?? null,
  });
}

function modeDecision(input) {
  const { mode, risk } = input;

  if (mode === "plan") {
    if (risk === "read") return baseDecision(input, "allow", { reason: "Plan mode allows read-only operations." });
    return baseDecision(input, "deny", { reason: `Plan mode denies ${risk} operations.` });
  }

  if (mode === "ask") {
    if (risk === "read") return baseDecision(input, "allow", { reason: "Read operation allowed in ask mode." });
    if (risk === "destructive" || risk === "credential") return baseDecision(input, "deny", { reason: `${risk} operations are denied by default.` });
    return baseDecision(input, "ask", { reason: `${risk} operation requires approval in ask mode.` });
  }

  if (mode === "act") {
    if (risk === "read") return baseDecision(input, "allow", { reason: "Read operation allowed in act mode." });
    if (risk === "destructive" || risk === "credential" || risk === "mcp") return baseDecision(input, "deny", { reason: `${risk} operations are denied until explicit tool policy exists.` });
    return baseDecision(input, "ask", { reason: `${risk} operation requires approval in act mode.` });
  }

  if (mode === "auto") {
    if (risk === "read") return baseDecision(input, "allow", { reason: "Low-risk read operation allowed in auto mode." });
    if (risk === "destructive" || risk === "credential" || risk === "mcp" || risk === "shell") return baseDecision(input, "deny", { reason: `${risk} operations are denied in auto mode.` });
    return baseDecision(input, "ask", { reason: `${risk} operation requires approval in auto mode.` });
  }

  return baseDecision(input, "deny", { reason: "Unsupported mode." });
}

export function decidePermission(options = {}) {
  const hasToolName = typeof options.toolName === "string" && options.toolName.length > 0;
  const input = {
    mode: normalizeMode(options.mode ?? "ask"),
    risk: hasToolName ? normalizeRiskClass(options.risk ?? "destructive") : "destructive",
    toolName: options.toolName,
    path: options.path,
  };

  if (!hasToolName) {
    return baseDecision(input, "deny", { reason: "Unknown tool: missing toolName." });
  }

  if (options.path) {
    const protectedPath = classifyProtectedPath(options.path, {
      workspace: options.workspace,
      alphaFoundryHome: options.alphaFoundryHome,
      env: options.env,
      home: options.home,
    });
    if (protectedPath.protected) {
      const reason = options.reason
        ? `Protected path denied (${protectedPath.category}): ${options.reason}`
        : `Protected path denied (${protectedPath.category}).`;
      return baseDecision(input, "deny", { reason, protectedPath });
    }
  }

  return modeDecision(input);
}
