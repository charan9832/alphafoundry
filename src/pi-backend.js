import { spawn } from "node:child_process";
import { resolvePiCliPath } from "./dependencies.js";
import { resolveRuntimeConfig } from "./config.js";

export function piCliPath() {
  return resolvePiCliPath();
}

export function buildPiArgs(args = []) {
  return [piCliPath(), ...args];
}

function hasPrompt(args = []) {
  return args.includes("-p") || args.includes("--prompt");
}

function hasOption(args = [], name) {
  return args.some((arg) => arg === name || arg.startsWith(`${name}=`));
}

function withConfiguredModelArgs(args = [], runtimeConfig = {}) {
  if (!hasPrompt(args)) return [...args];
  const next = [...args];
  if (!hasOption(next, "--provider") && runtimeConfig.provider && runtimeConfig.provider !== "default") {
    next.push("--provider", runtimeConfig.provider);
  }
  if (!hasOption(next, "--model") && runtimeConfig.model && runtimeConfig.model !== "default") {
    next.push("--model", runtimeConfig.model);
  }
  return next;
}

export function buildConfiguredPiArgs(args = [], runtimeConfig = resolveRuntimeConfig()) {
  return buildPiArgs(withConfiguredModelArgs(args, runtimeConfig));
}

export function resolvePiProcessEnv(runtimeConfig = resolveRuntimeConfig(), baseEnv = process.env) {
  return {
    ...baseEnv,
    PI_CONFIG_DIR: baseEnv.ALPHAFOUNDRY_CONFIG_DIR ?? baseEnv.PI_CONFIG_DIR,
    ...(runtimeConfig.env ?? {}),
  };
}

export function runPi(args = [], options = {}) {
  const maxOutputBytes = options.maxOutputBytes ?? 1024 * 1024;
  return new Promise((resolve) => {
    const child = spawn(process.execPath, buildPiArgs(args), {
      stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PI_CONFIG_DIR: process.env.ALPHAFOUNDRY_CONFIG_DIR ?? process.env.PI_CONFIG_DIR,
        ...(options.env ?? {}),
      },
    });
    let stdout = "";
    let stderr = "";
    let cappedBytes = 0;
    const appendCapped = (current, chunk) => {
      const text = chunk.toString();
      const remaining = Math.max(0, maxOutputBytes - Buffer.byteLength(stdout) - Buffer.byteLength(stderr));
      if (remaining <= 0) {
        cappedBytes += Buffer.byteLength(text);
        return current;
      }
      const kept = Buffer.byteLength(text) <= remaining ? text : text.slice(0, remaining);
      cappedBytes += Math.max(0, Buffer.byteLength(text) - Buffer.byteLength(kept));
      return current + kept;
    };
    child.stdout?.on("data", (chunk) => {
      stdout = appendCapped(stdout, chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr = appendCapped(stderr, chunk);
    });
    child.on("error", (error) => resolve({ ok: false, status: 1, output: stdout, error: error.message, cappedBytes }));
    child.on("close", (status) => resolve({ ok: status === 0, status: status ?? 0, output: stdout, error: stderr, cappedBytes }));
  });
}

export function runPiPrompt(prompt, options = {}) {
  const runtimeConfig = resolveRuntimeConfig({ provider: options.provider, model: options.model, env: options.env }, { env: options.processEnv ?? process.env });
  const args = ["-p", "--no-session"];
  if (runtimeConfig.provider && runtimeConfig.provider !== "default") args.push("--provider", runtimeConfig.provider);
  if (runtimeConfig.model && runtimeConfig.model !== "default") args.push("--model", runtimeConfig.model);
  args.push(prompt);
  return runPi(args, { ...options, env: runtimeConfig.env });
}
