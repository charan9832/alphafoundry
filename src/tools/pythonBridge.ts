import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export interface FinanceEngineRequest {
  method: "ping" | "run_backtest" | "run_research_workflow" | "run_validation_suite" | "optimize_strategy";
  params?: Record<string, unknown>;
}

export interface FinanceEngineResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, unknown>;
}

export class FinanceBridgeError extends Error {
  constructor(message: string, readonly details?: unknown) {
    super(message);
    this.name = "FinanceBridgeError";
  }
}

export function financeEnginePath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const sourcePath = resolve(here, "../../python/finance_engine/local_engine.py");
  if (existsSync(sourcePath)) return sourcePath;
  return resolve(here, "../../../python/finance_engine/local_engine.py");
}

export async function callFinanceEngine<T = unknown>(request: FinanceEngineRequest, timeoutMs = 10_000): Promise<FinanceEngineResponse<T>> {
  const maxOutputBytes = 1_000_000;
  const child = spawn("python3", [financeEnginePath()], {
    stdio: ["pipe", "pipe", "pipe"],
    shell: false,
  });

  const chunks: Buffer[] = [];
  const errors: Buffer[] = [];
  const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);

  child.stdout.on("data", (chunk: Buffer) => {
    chunks.push(chunk);
    if (Buffer.concat(chunks).byteLength > maxOutputBytes) child.kill("SIGKILL");
  });
  child.stderr.on("data", (chunk: Buffer) => {
    errors.push(chunk);
    if (Buffer.concat(errors).byteLength > maxOutputBytes) child.kill("SIGKILL");
  });

  const exit = new Promise<number | null>((resolveExit, reject) => {
    child.on("error", reject);
    child.on("close", (code) => resolveExit(code));
  });

  child.stdin.write(JSON.stringify(request));
  child.stdin.end();

  const code = await exit.finally(() => clearTimeout(timer));
  const stdout = Buffer.concat(chunks).toString("utf8").trim();
  const stderr = Buffer.concat(errors).toString("utf8").trim();

  if (!stdout) {
    throw new FinanceBridgeError("Finance engine returned no JSON output", { code, stderr });
  }

  let parsed: FinanceEngineResponse<T>;
  try {
    parsed = JSON.parse(stdout) as FinanceEngineResponse<T>;
  } catch (error) {
    throw new FinanceBridgeError("Finance engine returned malformed JSON", { stdout, stderr, code, error });
  }

  if (code !== 0 || !parsed.ok) {
    throw new FinanceBridgeError(parsed.error ?? "Finance engine failed", { response: parsed, code, stderr });
  }

  return parsed;
}
