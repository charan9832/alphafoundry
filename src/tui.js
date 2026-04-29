import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { runPiPrompt } from "./pi-backend.js";

const colors = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  ivory: "\x1b[97m",
  ink: "\x1b[37m",
  muted: "\x1b[90m",
  clay: "\x1b[33m",
  moss: "\x1b[32m",
  sky: "\x1b[36m",
  error: "\x1b[31m",
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

export function designScore({ hasContext = true, hasReasoning = true, restrained = true } = {}) {
  return 4 + (hasContext ? 2 : 0) + (hasReasoning ? 1 : 0) + (restrained ? 1 : 0);
}

function truncateMiddle(value, max = 48) {
  const text = String(value);
  if (text.length <= max) return text;
  const left = Math.max(4, Math.floor((max - 1) / 2));
  const right = Math.max(4, max - left - 1);
  return `${text.slice(0, left)}…${text.slice(-right)}`;
}

function rule(width, char = "─") {
  return char.repeat(Math.max(24, width));
}

function tint(role) {
  if (role === "user") return colors.sky;
  if (role === "assistant") return colors.moss;
  if (role === "system") return colors.clay;
  if (role === "error") return colors.error;
  return colors.ink;
}

export function roleLabel(role) {
  if (role === "assistant") return `${colors.moss}Reasoning${colors.reset}`;
  if (role === "user") return `${colors.sky}Brief${colors.reset}`;
  if (role === "system") return `${colors.clay}Context${colors.reset}`;
  if (role === "error") return `${colors.error}Issue${colors.reset}`;
  return `${colors.ink}${role}${colors.reset}`;
}

function renderMessage(message) {
  const text = String(message.text ?? "").split("\n");
  const label = roleLabel(message.role);
  const first = `${tint(message.role)}◆${colors.reset} ${label} ${text[0] ?? ""}`;
  const rest = text.slice(1).map((line) => `${colors.muted}│${colors.reset} ${line}`);
  return [first, ...rest].join("\n");
}

function renderHeader(state, width) {
  const sessionID = state.sessionID ?? "new";
  const provider = state.provider ?? process.env.AF_PROVIDER ?? process.env.PI_PROVIDER ?? "google";
  const model = state.model ?? process.env.AF_MODEL ?? process.env.PI_MODEL ?? "default";
  const cwd = truncateMiddle(state.cwd ?? process.cwd(), Math.max(24, Math.floor(width * 0.38)));
  return [
    `${colors.bold}${colors.ivory}ALPHAFOUNDRY${colors.reset}  ${colors.muted}${sessionID}${colors.reset}`,
    `${colors.muted}${cwd}${colors.reset}  ${colors.sky}${provider}/${model}${colors.reset}`,
  ].join("\n");
}

function renderContextCard(state, width) {
  const running = state.status === "running";
  const status = running ? `${colors.clay}${spinnerFrame(state.tick ?? 0)} Designing${colors.reset}` : `${colors.moss}● Ready${colors.reset}`;
  const score = designScore({ hasContext: true, hasReasoning: true, restrained: true });
  const tokens = state.tokens === undefined ? 0 : state.tokens;
  const cost = state.cost ?? "$0.00";
  return [
    `${colors.muted}Design context${colors.reset}`,
    `${status}  ${colors.muted}Score ${score}/10 · No generic AI shell · Ask · Search · Build · Review${colors.reset}`,
    `${colors.muted}Craft${colors.reset} restrained palette · 8pt rhythm · context before output · tokens ${tokens} · cost ${cost}`,
    rule(Math.min(width, 88), "─"),
  ].join("\n");
}

function renderPrompt(inputValue, width) {
  const placeholder = inputValue ? inputValue : `${colors.muted}Describe the design/task. I inspect context first…${colors.reset}`;
  const lineWidth = Math.min(width, 88);
  return [
    `${colors.muted}╭${rule(lineWidth - 2, "─")}╮${colors.reset}`,
    `${colors.muted}│${colors.reset} ${placeholder}`,
    `${colors.muted}╰${rule(lineWidth - 2, "─")}╯${colors.reset}`,
  ].join("\n");
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
  const transcript = messages.length
    ? messages.map((message) => renderMessage(message)).join("\n\n")
    : `${colors.muted}No transcript yet. Start with a brief, reference, or file path.${colors.reset}`;
  return [
    renderHeader(state, width),
    "",
    renderContextCard(state, width),
    "",
    transcript,
    "",
    renderPrompt(state.input ?? "", width),
    `${colors.muted}/help  /model <provider/model>  /provider <name>  /clear  /exit${colors.reset}`,
  ].join("\n");
}

export function helpMessage() {
  return [
    "Huashu-inspired workflow:",
    "  1. Ask for design context instead of guessing.",
    "  2. Use restrained palette and clear hierarchy.",
    "  3. Show assumptions/reasoning early.",
    "  4. Review craft before calling it done.",
    "",
    "Commands:",
    "  /help              show this help",
    "  /model <id>        set provider/model hint for this TUI session",
    "  /provider <name>   set provider hint for this TUI session",
    "  /clear             clear visible chat",
    "  /exit              quit",
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
    messages: [{ role: "system", text: "Design context is empty. Add screenshots, repo paths, or references when possible." }],
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
        state.messages = [{ role: "system", text: "Chat cleared. Context-first mode is still on." }];
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
