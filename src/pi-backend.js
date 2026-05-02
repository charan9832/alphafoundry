import { spawn } from "node:child_process";
import { resolvePiCliPath } from "./dependencies.js";
import { resolveRuntimeConfig } from "./config.js";
import { mapPiToolPolicy } from "./runtime/pi-tool-policy.js";

export function piCliPath(env = process.env) {
  return env.ALPHAFOUNDRY_PI_CLI_PATH || resolvePiCliPath();
}

export function buildPiArgs(args = [], options = {}) {
  return [piCliPath(options.env), ...args];
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

function withToolPolicyArgs(args = [], options = {}) {
  if (!hasPrompt(args)) return [...args];
  if (options.toolProfile === undefined && options.toolAllow === undefined) return [...args];

  const result = mapPiToolPolicy({
    profile: options.toolProfile,
    allow: options.toolAllow,
    mode: options.permissionMode,
    approved: options.toolsApproved,
    path: options.path,
    workspace: options.workspace,
    alphaFoundryHome: options.alphaFoundryHome,
    env: options.processEnv,
    home: options.home,
  });
  if (!result.ok) throw new Error(`Pi tool policy denied: ${result.reason}`);
  return [...args, ...result.flags];
}

export function buildConfiguredPiArgs(args = [], runtimeConfig = resolveRuntimeConfig(), options = {}) {
  return buildPiArgs(withToolPolicyArgs(withConfiguredModelArgs(args, runtimeConfig), options), { env: options.processEnv });
}

export function resolvePiProcessEnv(runtimeConfig = resolveRuntimeConfig(), baseEnv = process.env) {
  return {
    ...baseEnv,
    PI_CONFIG_DIR: baseEnv.ALPHAFOUNDRY_CONFIG_DIR ?? baseEnv.PI_CONFIG_DIR,
    ...(runtimeConfig.env ?? {}),
  };
}

export function resolveRunTimeoutMs(options = {}) {
  if (options.timeoutMs === null || options.timeoutMs === false) return 0;
  const raw = options.timeoutMs ?? options.processEnv?.ALPHAFOUNDRY_RUN_TIMEOUT_MS ?? process.env.ALPHAFOUNDRY_RUN_TIMEOUT_MS;
  if (raw === undefined || raw === "") return 0;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function terminateChild(child, signal = "SIGTERM") {
  try {
    if (!child.killed) child.kill(signal);
  } catch {
    // ignore cleanup errors
  }
}

export function runPi(args = [], options = {}) {
  const maxOutputBytes = options.maxOutputBytes ?? 1024 * 1024;
  const processEnv = options.processEnv ?? process.env;
  const timeoutMs = resolveRunTimeoutMs({ ...options, processEnv });
  return new Promise((resolve) => {
    const child = spawn(process.execPath, buildPiArgs(args, { env: processEnv }), {
      stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
      env: {
        ...processEnv,
        PI_CONFIG_DIR: processEnv.ALPHAFOUNDRY_CONFIG_DIR ?? processEnv.PI_CONFIG_DIR,
        ...(options.env ?? {}),
      },
    });
    let stdout = "";
    let stderr = "";
    let cappedBytes = 0;
    let timedOut = false;
    let settled = false;
    let timeoutHandle;
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
    function finish(status, errorMessage = "") {
      if (settled) return;
      settled = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
      const timeoutError = timedOut ? `AlphaFoundry runtime timed out after ${timeoutMs} ms` : "";
      const error = [stderr, errorMessage, timeoutError].filter(Boolean).join("\n");
      resolve({ ok: !timedOut && status === 0, status: timedOut ? 124 : (status ?? 0), output: stdout, error, cappedBytes, timedOut });
    }

    if (timeoutMs > 0) {
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        terminateChild(child, "SIGTERM");
        setTimeout(() => terminateChild(child, "SIGKILL"), 1000).unref?.();
      }, timeoutMs);
      timeoutHandle.unref?.();
    }

    child.on("error", (error) => finish(1, error.message));
    child.on("close", (status) => finish(status ?? 0));
  });
}

export function runPiPrompt(prompt, options = {}) {
  const runtimeConfig = resolveRuntimeConfig({ provider: options.provider, model: options.model, env: options.env }, { env: options.processEnv ?? process.env });
  const args = ["-p", "--no-session"];
  if (runtimeConfig.provider && runtimeConfig.provider !== "default") args.push("--provider", runtimeConfig.provider);
  if (runtimeConfig.model && runtimeConfig.model !== "default") args.push("--model", runtimeConfig.model);
  args.push(prompt);
  const toolPolicy = mapPiToolPolicy({
    profile: options.toolProfile,
    allow: options.toolAllow,
    mode: options.permissionMode,
    approved: options.toolsApproved,
    path: options.path,
    workspace: options.workspace,
    alphaFoundryHome: options.alphaFoundryHome,
    env: options.processEnv,
    home: options.home,
  });
  if (!toolPolicy.ok) throw new Error(`Pi tool policy denied: ${toolPolicy.reason}`);
  return runPi([...args, ...toolPolicy.flags], { ...options, env: runtimeConfig.env });
}
