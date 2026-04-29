import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { runPiPrompt } from "./pi-backend.js";

const colors = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  gray: "\x1b[90m",
};

export function stripAnsi(value) {
  return value.replace(/\x1b\[[0-9;]*m/g, "");
}

export function visibleLength(value) {
  return stripAnsi(value).length;
}

export function line(char = "─", width = 80) {
  return char.repeat(Math.max(10, width));
}

export function roleLabel(role) {
  if (role === "user") return `${colors.cyan}you${colors.reset}`;
  if (role === "assistant") return `${colors.green}af${colors.reset}`;
  if (role === "system") return `${colors.yellow}system${colors.reset}`;
  return `${colors.magenta}${role}${colors.reset}`;
}

export function parseSlashCommand(raw) {
  const value = raw.trim();
  if (value === "/help") return { type: "help" };
  if (value === "/clear") return { type: "clear" };
  if (value === "/exit" || value === "/quit") return { type: "exit" };
  if (value.startsWith("/model ")) return { type: "model", value: value.slice(7).trim() };
  if (value.startsWith("/provider ")) return { type: "provider", value: value.slice(10).trim() };
  return { type: "prompt", value };
}

export function renderFrame(state = {}) {
  const width = Math.min(Number(process.stdout.columns) || 88, 110);
  const cwd = state.cwd ?? process.cwd();
  const provider = state.provider ?? process.env.AF_PROVIDER ?? process.env.PI_PROVIDER ?? "google";
  const model = state.model ?? process.env.AF_MODEL ?? process.env.PI_MODEL ?? "default";
  const status = state.status ?? "idle";
  const messages = state.messages ?? [];
  const inputValue = state.input ?? "";
  const header = `${colors.bold}${colors.cyan}AlphaFoundry${colors.reset} ${colors.gray}opencode-style terminal agent${colors.reset}`;
  const meta = `${colors.gray}${cwd}  provider:${colors.reset} ${provider} ${colors.gray}model:${colors.reset} ${model} ${colors.gray}status:${colors.reset} ${status}`;
  const help = `${colors.gray}/help commands  /model <id>  /provider <name>  /clear  /exit  ctrl+c quit${colors.reset}`;
  const body = messages.length
    ? messages.map((message) => `${roleLabel(message.role)} ${message.text}`).join("\n\n")
    : `${colors.gray}No messages yet. Type a prompt and press Enter.${colors.reset}`;
  const prompt = `> ${inputValue}`;
  return [header, line("─", width), meta, help, line("─", width), body, line("─", width), prompt].join("\n");
}

export function helpMessage() {
  return [
    "Commands:",
    "  /help              show this help",
    "  /model <id>        set model hint for this TUI session",
    "  /provider <name>   set provider hint for this TUI session",
    "  /clear             clear visible chat",
    "  /exit              quit",
    "",
    "Prompts are delegated to Pi Agent with `-p --no-session`.",
  ].join("\n");
}

export async function startTui(options = {}) {
  const rl = readline.createInterface({ input, output });
  const state = {
    cwd: process.cwd(),
    provider: options.provider ?? process.env.AF_PROVIDER ?? process.env.PI_PROVIDER ?? "google",
    model: options.model ?? process.env.AF_MODEL ?? process.env.PI_MODEL ?? "default",
    status: "idle",
    messages: [{ role: "system", text: "AlphaFoundry TUI ready. Type /help for commands." }],
  };

  const draw = () => {
    output.write("\x1Bc");
    output.write(renderFrame(state));
    output.write("\n");
  };

  try {
    draw();
    while (true) {
      const raw = await rl.question("\n> ");
      const command = parseSlashCommand(raw);
      if (command.type === "exit") break;
      if (command.type === "help") {
        state.messages.push({ role: "assistant", text: helpMessage() });
        draw();
        continue;
      }
      if (command.type === "clear") {
        state.messages = [{ role: "system", text: "Chat cleared." }];
        draw();
        continue;
      }
      if (command.type === "model") {
        state.model = command.value || state.model;
        state.messages.push({ role: "system", text: `model set to ${state.model}` });
        draw();
        continue;
      }
      if (command.type === "provider") {
        state.provider = command.value || state.provider;
        state.messages.push({ role: "system", text: `provider set to ${state.provider}` });
        draw();
        continue;
      }
      if (!command.value) {
        draw();
        continue;
      }

      state.messages.push({ role: "user", text: command.value });
      state.status = "running";
      draw();
      const result = await runPiPrompt(command.value, { provider: state.provider, model: state.model });
      state.status = result.ok ? "idle" : "error";
      state.messages.push({ role: "assistant", text: result.output.trim() || result.error || "No output." });
      draw();
    }
  } finally {
    rl.close();
    output.write("\n");
  }
}
