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
  "sessions",
  "new",
  "doctor",
  "retry",
  "replay",
  "eval",
  "export",
  "print",
];

const COMMAND_META = {
  help: { description: "show this help", hint: "/help" },
  clear: { description: "clear visible conversation", hint: "/clear" },
  model: { description: "set model preference", hint: "/model openrouter/qwen3-coder" },
  provider: { description: "set provider preference", hint: "/provider openrouter" },
  exit: { description: "quit or cancel", hint: "/exit" },
  stats: { description: "show counters and runtime stats", hint: "/stats" },
  tools: { description: "request runtime tools", hint: "/tools read grep write bash" },
  "approve-tools": { description: "approve pending tool request", hint: "/approve-tools" },
  mode: { description: "set permission mode", hint: "/mode plan|ask|act|auto" },
  session: { description: "show current session", hint: "/session" },
  sessions: { description: "list known sessions", hint: "/sessions" },
  new: { description: "start a fresh session", hint: "/new" },
  doctor: { description: "health checks and recovery", hint: "/doctor" },
  retry: { description: "retry the last prompt", hint: "/retry" },
  replay: { description: "replay current session", hint: "/replay" },
  eval: { description: "evaluate current session", hint: "/eval" },
  export: { description: "print visible transcript", hint: "/export" },
  print: { description: "alias for export", hint: "/print" },
};

function splitArgs(value) {
  return String(value ?? "")
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function commandPrefix(raw) {
  const value = String(raw ?? "").trim();
  if (!value.startsWith("/")) return null;
  const token = value.slice(1).split(/\s/)[0].toLowerCase();
  return token;
}

export function commandSuggestions(raw, limit = 8) {
  const prefix = commandPrefix(raw);
  if (prefix === null) return [];
  if (String(raw ?? "").startsWith("/tools ")) return [{ command: "tools", ...COMMAND_META.tools }];
  return COMMAND_NAMES
    .filter((command) => command.startsWith(prefix))
    .sort((a, b) => a.localeCompare(b))
    .slice(0, limit)
    .map((command) => ({ command, ...COMMAND_META[command] }));
}

export function completeSlashCommand(raw) {
  const value = String(raw ?? "");
  const suggestions = commandSuggestions(value, 1);
  if (suggestions.length !== 1) return value;
  const command = suggestions[0].command;
  if (value.trim() === `/${command}`) return value;
  return `/${command} `;
}

export function parseSlashCommand(raw) {
  const value = String(raw ?? "").trim();
  if (!value.startsWith("/")) return { type: "prompt", value };

  const withoutSlash = value.slice(1).trim();
  const firstSpace = withoutSlash.search(/\s/);
  const command = (firstSpace === -1 ? withoutSlash : withoutSlash.slice(0, firstSpace)).toLowerCase();
  const rest = firstSpace === -1 ? "" : withoutSlash.slice(firstSpace + 1).trim();

  if (command === "quit") return { type: "exit" };
  if (["help", "clear", "exit", "stats", "session", "sessions", "new", "doctor", "retry", "replay", "eval"].includes(command)) return { type: command };
  if (command === "export" || command === "print") return { type: "export", scope: "visible" };
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
    "  Conversation",
    "    /help              show this help",
    "    /clear             clear visible conversation",
    "    /retry             retry the last prompt",
    "    /exit              quit when idle; cancel first when running",
    "",
    "  Model + session",
    "    /model <id>        set local model preference; applied on next runtime prompt",
    "    /provider <name>   set local provider preference; applied on next runtime prompt",
    "    /session           show durable session metadata",
    "    /sessions          list known TUI sessions",
    "    /new               start a fresh durable session",
    "    /stats             show local TUI counters; runtime stats appear after runs",
    "    /replay            summarize the current visible session",
    "    /eval              run local visible-session checks",
    "",
    "  Setup + health",
    "    /doctor            show local health guidance; exit and run af doctor for full report",
    "",
    "  Tools + safety",
    "    /tools <list>      request runtime tools, separated by spaces or commas",
    "    /approve-tools     approve pending tool request for this session",
    "    /mode <mode>       set tool permission mode: plan, ask, act, auto",
    "",
    "  Transcript",
    "    /export            print visible transcript in the conversation",
    "    /print             alias for /export",
    "",
    "Keys:",
    "  Enter               submit prompt or slash command",
    "  Tab                 complete slash command when unique",
    "  PgUp/PgDn           scroll transcript; End follows latest",
    "  ↑/↓                 recall prompt history when available",
    "  Esc or Ctrl+C       cancel a running request; exit when idle",
    "  Paste multiline text; AlphaFoundry preserves it as one prompt",
  ].join("\n");
}

export function sessionId(prefix = "ses") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
