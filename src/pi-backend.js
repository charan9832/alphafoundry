import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function piCliPath() {
  const here = dirname(fileURLToPath(import.meta.url));
  const packageRoot = dirname(here);
  return join(packageRoot, "node_modules", "@mariozechner", "pi-coding-agent", "dist", "cli.js");
}

export function buildPiArgs(args = []) {
  return [piCliPath(), ...args];
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
  const args = ["-p", "--no-session"];
  if (options.provider && options.provider !== "default") args.push("--provider", options.provider);
  if (options.model && options.model !== "default") args.push("--model", options.model);
  args.push(prompt);
  return runPi(args, options);
}
