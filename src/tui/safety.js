export function summarizeSafety(state = {}) {
  const mode = state.permissionMode ?? "ask";
  const tools = Array.isArray(state.tools) ? state.tools : [];
  const pending = Array.isArray(state.pendingToolApproval?.tools) ? state.pendingToolApproval.tools : [];

  if (pending.length > 0) {
    return {
      tone: "pending",
      short: `mode ${mode} · approval pending`,
      detail: `approval pending: ${pending.join(", ")}`,
    };
  }

  if (tools.length > 0) {
    return {
      tone: "approved",
      short: `mode ${mode} · tools approved`,
      detail: `approved tools: ${tools.join(", ")}`,
    };
  }

  return {
    tone: mode === "plan" ? "safe" : "restricted",
    short: `mode ${mode} · tools off`,
    detail: "runtime tools disabled until /tools",
  };
}
