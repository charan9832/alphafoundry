export const COMMAND_NAMES = [
  "help",
  "clear",
  "model",
  "provider",
  "exit",
  "stats",
  "tools",
  "approve-tools",
  "mode",
  "session",
  "new",
  "export",
];

function splitArgs(value) {
  return String(value ?? "")
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function parseSlashCommand(raw) {
  const value = String(raw ?? "").trim();
  if (!value.startsWith("/")) return { type: "prompt", value };

  const withoutSlash = value.slice(1).trim();
  const firstSpace = withoutSlash.search(/\s/);
  const command = (firstSpace === -1 ? withoutSlash : withoutSlash.slice(0, firstSpace)).toLowerCase();
  const rest = firstSpace === -1 ? "" : withoutSlash.slice(firstSpace + 1).trim();

  if (command === "quit") return { type: "exit" };
  if (["help", "clear", "exit", "stats", "session", "new", "export"].includes(command)) return { type: command };
  if (command === "approve-tools") return { type: "approve-tools" };
  if (command === "mode") return { type: "mode", mode: rest };
  if (command === "provider") return { type: "provider", provider: rest };
  if (command === "tools") return { type: "tools", tools: splitArgs(rest) };
  if (command === "model") {
    if (!rest) return { type: "model", model: "" };
    if (rest.includes("/")) {
      const [provider, ...modelParts] = rest.split("/");
      return { type: "model", provider, model: modelParts.join("/") };
    }
    return { type: "model", model: rest };
  }

  return { type: "unknown", command, value: rest };
}

export function commandHelp() {
  return [
    "Commands:",
    "  /help                show this help",
    "  /clear               clear visible conversation",
    "  /model <id>          set local model preference; applied on next runtime prompt",
    "  /provider <name>     set local provider preference; applied on next runtime prompt",
    "  /exit                quit when idle; cancel first when running",
    "  /stats               show local TUI counters; runtime stats appear after runs",
    "  /tools <list>        request runtime tools, separated by spaces or commas",
    "  /approve-tools       approve pending tool request for this session",
    "  /mode <mode>         set tool permission mode: plan, ask, act, auto",
    "  /session             show durable session metadata",
    "  /new                 start a fresh durable session",
    "  /export              print visible transcript in the conversation",
  ].join("\n");
}

export function sessionId(prefix = "ses") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
