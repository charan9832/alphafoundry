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
  red: "\x1b[31m",
  gray: "\x1b[90m",
  inverse: "\x1b[7m",
};

const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function spinnerFrame(index = 0) {
  return spinnerFrames[Math.abs(index) % spinnerFrames.length];
}

export function stripAnsi(value) {
  return String(value).replace(/\x1b\[[0-9;]*m/g, "");
}

export function visibleLength(value) {
  return stripAnsi(value).length;
}

function truncateMiddle(value, max = 48) {
  const text = String(value);
  if (text.length <= max) return text;
  const left = Math.max(4, Math.floor((max - 1) / 2));
  const right = Math.max(4, max - left - 1);
  return `${text.slice(0, left)}…${text.slice(-right)}`;
}

function tint(role) {
  if (role === "user") return colors.cyan;
  if (role === "assistant") return colors.green;
  if (role === "system") return colors.yellow;
  if (role === "error") return colors.red;
  return colors.magenta;
}

export function roleLabel(role) {
  if (role === "assistant") return `${colors.green}assistant${colors.reset}`;
  if (role === "user") return `${colors.cyan}you${colors.reset}`;
  if (role === "system") return `${colors.yellow}system${colors.reset}`;
  return `${tint(role)}${role}${colors.reset}`;
}

function renderMessage(message, width) {
  const label = roleLabel(message.role);
  const bullet = `${tint(message.role)}▸${colors.reset}`;
  const text = String(message.text ?? "").split("\n");
  const first = `${bullet} ${label} ${text[0] ?? ""}`;
  const rest = text.slice(1).map((line) => `${colors.gray}│${colors.reset} ${line}`);
  const block = [first, ...rest].join("\n");
  return width < 64 ? block : `${block}`;
}

function renderStatus(state, width) {
  const provider = state.provider ?? process.env.AF_PROVIDER ?? process.env.PI_PROVIDER ?? "google";
  const model = state.model ?? process.env.AF_MODEL ?? process.env.PI_MODEL ?? "default";
  const modelLabel = `${provider}/${model}`;
  const running = state.status === "running";
  const status = running ? `${colors.yellow}${spinnerFrame(state.tick ?? 0)} thinking${colors.reset}` : `${colors.green}● idle${colors.reset}`;
  const tokens = state.tokens === undefined ? "tokens 0" : `tokens ${state.tokens}`;
  const cost = state.cost === undefined ? "cost $0.00" : `cost ${state.cost}`;
  const cwd = truncateMiddle(state.cwd ?? process.cwd(), Math.max(24, Math.floor(width / 3)));
  return `${colors.gray}${cwd}${colors.reset}  ${colors.cyan}${modelLabel}${colors.reset}  ${status}  ${colors.gray}${tokens}  ${cost}${colors.reset}`;
}

function renderTopBar(state, width) {
  const sessionID = state.sessionID ?? "new";
  const title = `${colors.inverse}${colors.bold} alphafoundry ${colors.reset} ${colors.gray}${sessionID}${colors.reset}`;
  const right = `${colors.gray}ctrl+p command  ctrl+x m model  ctrl+x l sessions${colors.reset}`;
  const gap = Math.max(1, width - visibleLength(title) - visibleLength(right));
  return `${title}${" ".repeat(gap)}${right}`;
}

function renderPrompt(inputValue) {
  const placeholder = inputValue ? inputValue : `${colors.gray}message AlphaFoundry…${colors.reset}`;
  return `${colors.gray}╭────────────────────────────────────────────────────────────────────────────╮${colors.reset}\n${colors.gray}│${colors.reset} ${placeholder}\n${colors.gray}╰────────────────────────────────────────────────────────────────────────────╯${colors.reset}`;
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
  const width = Math.min(Number(process.stdout.columns) || 96, 120);
  const messages = state.messages ?? [];
  const inputValue = state.input ?? "";
  const transcript = messages.length
    ? messages.map((message) => renderMessage(message, width)).join("\n\n")
    : `${colors.gray}No messages yet. Ask for a task, review, or command.${colors.reset}`;
  return [
    renderTopBar(state, width),
    renderStatus(state, width),
    "",
    transcript,
    "",
    renderPrompt(inputValue),
    `${colors.gray}/help  /clear  /model <provider/model>  /provider <name>  /exit${colors.reset}`,
  ].join("\n");
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
    "Key hints mirror OpenCode: ctrl+p command, ctrl+x m model, ctrl+x l sessions.",
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
    tick: 0,
    sessionID: `ses_${Date.now().toString(36)}`,
    tokens: 0,
    cost: "$0.00",
    messages: [{ role: "system", text: "AlphaFoundry ready. Use ctrl+p-style commands or type /help." }],
  };

  const draw = () => {
    output.write("\x1Bc");
    output.write(renderFrame(state));
    output.write("\n");
  };

  try {
    draw();
    while (true) {
      const raw = await rl.question("\n› ");
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
        const value = command.value || state.model;
        if (value.includes("/")) {
          const [provider, ...modelParts] = value.split("/");
          state.provider = provider || state.provider;
          state.model = modelParts.join("/") || state.model;
        } else {
          state.model = value;
        }
        state.messages.push({ role: "system", text: `model set to ${state.provider}/${state.model}` });
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
      state.tick += 1;
      draw();
      const result = await runPiPrompt(command.value, { provider: state.provider, model: state.model });
      state.status = result.ok ? "idle" : "error";
      state.messages.push({ role: result.ok ? "assistant" : "error", text: result.output.trim() || result.error || "No output." });
      state.tokens += command.value.split(/\s+/).filter(Boolean).length;
      draw();
    }
  } finally {
    rl.close();
    output.write("\n");
  }
}
