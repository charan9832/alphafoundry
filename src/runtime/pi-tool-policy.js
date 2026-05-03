import { decidePermission, normalizeMode } from "./permissions.js";

export const PI_BUILTIN_TOOLS = Object.freeze(["read", "bash", "edit", "write", "grep", "find", "ls"]);

const TOOL_SET = new Set(PI_BUILTIN_TOOLS);

const TOOL_RISKS = Object.freeze({
  read: "read",
  grep: "read",
  find: "read",
  ls: "read",
  edit: "write",
  write: "write",
  bash: "shell",
});

const PROFILE_TO_TOOLS = Object.freeze({
  default: null,
  none: Object.freeze([]),
  "read-only": Object.freeze(["read", "grep", "find", "ls"]),
  "code-edit": Object.freeze(["read", "grep", "find", "ls", "edit", "write"]),
  shell: Object.freeze(["read", "grep", "find", "ls", "bash"]),
  "extension-only": null,
});

const PROFILE_TO_FLAGS = Object.freeze({
  default: Object.freeze([]),
  none: Object.freeze(["--no-tools"]),
  "read-only": Object.freeze(["--tools", "read,grep,find,ls"]),
  "code-edit": Object.freeze(["--tools", "read,grep,find,ls,edit,write"]),
  shell: Object.freeze(["--tools", "read,grep,find,ls,bash"]),
  "extension-only": Object.freeze(["--no-builtin-tools"]),
});

function deny(reason, extra = {}) {
  return {
    ok: false,
    decision: "deny",
    requiresApproval: false,
    reason,
    flags: [],
    decisions: extra.decisions ?? [],
    enforcement: "startup-allowlist",
    liveInterception: false,
    pathPolicyScope: extra.pathPolicyScope ?? "none",
    ...(extra.deniedTool ? { deniedTool: extra.deniedTool } : {}),
    ...(extra.profile ? { profile: extra.profile } : {}),
  };
}

export function normalizePiToolAllowlist(tools = []) {
  const rawTools = typeof tools === "string" ? tools.split(",") : tools;
  if (!Array.isArray(rawTools)) throw new TypeError("Runtime tool allowlist must be an array or comma-separated string.");

  const seen = new Set();
  const normalized = [];
  for (const tool of rawTools) {
    const name = String(tool ?? "").trim().toLowerCase();
    if (!name) continue;
    if (!TOOL_SET.has(name)) throw new TypeError(`Unknown runtime tool: ${name}`);
    if (!seen.has(name)) {
      seen.add(name);
      normalized.push(name);
    }
  }
  return normalized;
}

function decisionForTool(toolName, options) {
  return decidePermission({
    mode: options.mode ?? "ask",
    toolName,
    risk: TOOL_RISKS[toolName] ?? "destructive",
    path: options.path,
    workspace: options.workspace,
    alphaFoundryHome: options.alphaFoundryHome,
    env: options.env,
    home: options.home,
  });
}

function summarizeDecisions(decisions) {
  if (decisions.some((decision) => decision.decision === "deny")) return "deny";
  if (decisions.some((decision) => decision.decision === "ask")) return "ask";
  return "allow";
}

export function mapPiToolPolicy(options = {}) {
  let mode;
  try {
    mode = normalizeMode(options.mode ?? "ask");
  } catch (error) {
    return deny(error.message);
  }

  let profile = "default";
  let tools = [];
  let flags = [];

  if (options.allow !== undefined) {
    try {
      tools = normalizePiToolAllowlist(options.allow);
    } catch (error) {
      return deny(error.message, { profile: "explicit" });
    }
    profile = "explicit";
    flags = tools.length > 0 ? ["--tools", tools.join(",")] : ["--no-tools"];
  } else {
    profile = String(options.profile ?? "default").toLowerCase();
    if (!(profile in PROFILE_TO_FLAGS)) return deny(`Unknown runtime tool profile: ${profile}`, { profile });
    tools = PROFILE_TO_TOOLS[profile] ? [...PROFILE_TO_TOOLS[profile]] : [];
    flags = [...PROFILE_TO_FLAGS[profile]];
  }

  const decisions = tools.map((toolName) => decisionForTool(toolName, { ...options, mode }));
  const denied = decisions.find((decision) => decision.decision === "deny");
  if (denied) {
    return deny(denied.reason || `Runtime tool denied by AlphaFoundry policy: ${denied.toolName}`, {
      profile,
      decisions,
      deniedTool: denied.toolName,
    });
  }

  const decision = summarizeDecisions(decisions);
  if (decision === "ask" && !options.approved) {
    return deny("Tool use requires approval. In the TUI, request tools with /tools and then run /approve-tools before retrying.", {
      profile,
      decisions,
      deniedTool: decisions.find((item) => item.decision === "ask")?.toolName,
    });
  }
  return {
    ok: true,
    profile,
    mode,
    tools,
    flags,
    decisions,
    decision,
    requiresApproval: decision === "ask",
    enforcement: "startup-allowlist",
    liveInterception: false,
    pathPolicyScope: options.path ? "requested-path" : "none",
  };
}
