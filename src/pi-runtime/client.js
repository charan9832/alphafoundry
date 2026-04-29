import { spawn as nodeSpawn } from "node:child_process";
import { resolvePiCliPath, resolvePiRpcClientUrl } from "../dependencies.js";
import { createEventBus } from "./events.js";
import { cloneStats, createOutputAccumulator, createStats } from "./session.js";

const DEFAULT_MAX_OUTPUT_BYTES = 1024 * 1024;

function defaultCommand() {
  return process.execPath;
}

function defaultPiCliPath() {
  return resolvePiCliPath();
}

function defaultArgs(prompt, options, model) {
  const args = [];
  if (options.cliPath) {
    args.push(options.cliPath);
  } else if (options.command === process.execPath) {
    args.push(defaultPiCliPath());
  }

  args.push("-p");
  const provider = options.provider ?? model.provider;
  const selectedModel = options.model ?? model.model;
  if (provider && provider !== "default") args.push("--provider", provider);
  if (selectedModel && selectedModel !== "default") args.push("--model", selectedModel);
  args.push(prompt);
  return args;
}

function normalizeError(error) {
  if (!error) return undefined;
  return error instanceof Error ? error.message : String(error);
}

export function createPiRuntime(options = {}) {
  const spawn = options.spawn ?? nodeSpawn;
  const bus = createEventBus();
  const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  const killSignal = options.killSignal ?? "SIGTERM";
  const model = {
    provider: options.provider ?? "default",
    model: options.model ?? "default",
  };
  const stats = createStats();
  let child = null;
  let activeRun = null;
  let started = false;
  let runId = 0;

  function emitStats() {
    bus.emit({ type: "stats", stats: cloneStats(stats) });
  }

  function commandForRun(runOptions) {
    return runOptions.command ?? options.command ?? defaultCommand();
  }

  function argsForRun(prompt, runOptions, command) {
    if (typeof options.buildArgs === "function") {
      return options.buildArgs(prompt, { ...runOptions }, { ...model });
    }
    if (Array.isArray(runOptions.args)) return [...runOptions.args, prompt];
    if (Array.isArray(options.args)) return [...options.args, prompt];
    return defaultArgs(prompt, { ...runOptions, cliPath: options.cliPath, command }, model);
  }

  function finishRun(run, result) {
    if (run.settled) return;
    run.settled = true;

    if (run.abortSignal && run.abortListener) {
      run.abortSignal.removeEventListener("abort", run.abortListener);
    }

    child = null;
    activeRun = null;
    stats.running = false;
    stats.lastExitCode = result.exitCode ?? null;
    if (result.aborted) stats.aborted += 1;
    else if (result.ok) stats.completed += 1;
    else stats.failed += 1;

    const finalResult = {
      ok: Boolean(result.ok),
      exitCode: result.exitCode ?? null,
      signal: result.signal ?? null,
      stdout: run.output.stdout,
      stderr: run.output.stderr,
      capped: run.output.capped,
      cappedBytes: run.output.cappedBytes,
      aborted: Boolean(result.aborted),
      ...(result.error ? { error: result.error } : {}),
    };

    bus.emit({
      type: "run_end",
      runId: run.id,
      ok: finalResult.ok,
      exitCode: finalResult.exitCode,
      signal: finalResult.signal,
      aborted: finalResult.aborted,
      capped: finalResult.capped,
    });
    emitStats();
    run.resolve(finalResult);
  }

  function abortRun(run = activeRun) {
    if (!run || run.settled || run.aborting) return;
    run.aborting = true;
    bus.emit({ type: "aborted", runId: run.id });
    if (child && typeof child.kill === "function" && !child.killed) {
      child.kill(killSignal);
    } else {
      finishRun(run, { ok: false, aborted: true, signal: killSignal });
    }
  }

  return {
    start() {
      started = true;
      return this;
    },

    sendPrompt(prompt, runOptions = {}) {
      if (activeRun) {
        return Promise.reject(new Error("Pi runtime already has an active run"));
      }
      if (typeof prompt !== "string" || prompt.length === 0) {
        return Promise.reject(new TypeError("prompt must be a non-empty string"));
      }
      if (!started) started = true;

      const id = ++runId;
      const command = commandForRun(runOptions);
      const args = argsForRun(prompt, runOptions, command);
      const env = {
        ...process.env,
        PI_CONFIG_DIR: process.env.ALPHAFOUNDRY_CONFIG_DIR ?? process.env.PI_CONFIG_DIR,
        ...(options.env ?? {}),
        ...(runOptions.env ?? {}),
      };
      const spawnOptions = {
        stdio: runOptions.stdio ?? options.stdio ?? ["ignore", "pipe", "pipe"],
        cwd: runOptions.cwd ?? options.cwd ?? process.cwd(),
        env,
        ...(options.spawnOptions ?? {}),
        ...(runOptions.spawnOptions ?? {}),
      };

      stats.runs += 1;
      stats.running = true;
      const output = createOutputAccumulator(maxOutputBytes);
      const promise = new Promise((resolve) => {
        const run = {
          id,
          resolve,
          output,
          settled: false,
          aborting: false,
          abortSignal: runOptions.signal,
          abortListener: null,
        };
        activeRun = run;

        bus.emit({ type: "run_start", runId: id, prompt, command, args: [...args], model: { ...model } });
        bus.emit({ type: "command", runId: id, command, args: [...args], cwd: spawnOptions.cwd });

        try {
          child = spawn(command, args, spawnOptions);
        } catch (error) {
          const message = normalizeError(error);
          bus.emit({ type: "error", runId: id, error: message });
          finishRun(run, { ok: false, error: message, exitCode: 1 });
          return;
        }

        child.stdout?.on?.("data", (chunk) => {
          const appended = output.append("stdout", chunk);
          stats.stdoutBytes += appended.totalBytes;
          stats.outputBytes += appended.totalBytes;
          stats.cappedBytes += appended.cappedBytes;
          if (appended.kept) {
            bus.emit({ type: "stdout", runId: id, text: appended.kept, bytes: appended.keptBytes });
            bus.emit({ type: "assistant", runId: id, text: appended.kept });
          }
        });

        child.stderr?.on?.("data", (chunk) => {
          const appended = output.append("stderr", chunk);
          stats.stderrBytes += appended.totalBytes;
          stats.outputBytes += appended.totalBytes;
          stats.cappedBytes += appended.cappedBytes;
          if (appended.kept) {
            bus.emit({ type: "stderr", runId: id, text: appended.kept, bytes: appended.keptBytes });
          }
        });

        child.on?.("error", (error) => {
          if (run.settled) return;
          const message = normalizeError(error);
          bus.emit({ type: "error", runId: id, error: message });
          finishRun(run, { ok: false, error: message, exitCode: 1 });
        });

        child.on?.("close", (code, signal) => {
          if (run.settled) return;
          const aborted = run.aborting || signal === killSignal;
          finishRun(run, {
            ok: !aborted && code === 0,
            exitCode: code,
            signal,
            aborted,
          });
        });

        if (run.abortSignal) {
          if (run.abortSignal.aborted) {
            abortRun(run);
          } else {
            run.abortListener = () => abortRun(run);
            run.abortSignal.addEventListener("abort", run.abortListener, { once: true });
          }
        }
      });
      return promise;
    },

    abort() {
      abortRun();
    },

    stop() {
      abortRun();
      bus.clear();
      started = false;
    },

    getStats() {
      const snapshot = cloneStats(stats);
      if (model.provider !== "default" || model.model !== "default") {
        snapshot.model = { ...model };
      }
      return snapshot;
    },

    setModel(nextModel = {}) {
      if (Object.hasOwn(nextModel, "provider")) model.provider = nextModel.provider;
      if (Object.hasOwn(nextModel, "model")) model.model = nextModel.model;
      emitStats();
      return { ...model };
    },

    onEvent(callback) {
      return bus.subscribe(callback);
    },
  };
}

export function normalizeRpcEvent(event = {}) {
  if (event.type === "message_delta" && event.delta) return { type: "assistant", text: event.delta };
  if (event.type === "text_delta" && event.text) return { type: "assistant", text: event.text };
  if (event.type === "message_end" && event.message?.content) {
    const text = Array.isArray(event.message.content)
      ? event.message.content.map((part) => part.text ?? part.content ?? "").filter(Boolean).join("")
      : String(event.message.content ?? "");
    return text ? { type: "assistant", text } : { type: "run_end", ok: true };
  }
  if (event.type === "tool_execution_start") return { type: "tool", name: event.toolName, status: "start", text: `${event.toolName} started` };
  if (event.type === "tool_execution_update") return { type: "tool", name: event.toolName, status: "update", text: event.output ?? event.text ?? `${event.toolName} update` };
  if (event.type === "tool_execution_end") return { type: "tool", name: event.toolName, status: event.isError ? "error" : "done", text: `${event.toolName} ${event.isError ? "failed" : "done"}` };
  if (event.type === "agent_end") return { type: "run_end", ok: true };
  if (event.type === "error") return { type: "error", error: event.error ?? event.message ?? "RPC error" };
  return { type: event.type ?? "assistant", text: event.text ?? event.message ?? JSON.stringify(event) };
}

export function createPiRpcRuntime(options = {}) {
  const bus = createEventBus();
  const stats = createStats();
  let client = null;
  let started = false;
  let currentModel = { provider: options.provider ?? "default", model: options.model ?? "default" };

  async function ensureClient() {
    if (client) return client;
    const { RpcClient } = await import(resolvePiRpcClientUrl());
    client = new RpcClient({
      cliPath: options.cliPath ?? defaultPiCliPath(),
      cwd: options.cwd ?? process.cwd(),
      env: {
        PI_CONFIG_DIR: process.env.ALPHAFOUNDRY_CONFIG_DIR ?? process.env.PI_CONFIG_DIR,
        ...(options.env ?? {}),
      },
      provider: currentModel.provider !== "default" ? currentModel.provider : undefined,
      model: currentModel.model !== "default" ? currentModel.model : undefined,
      args: options.args,
    });
    client.onEvent((event) => {
      const normalized = normalizeRpcEvent(event);
      try {
        bus.emit(normalized);
      } catch {
        bus.emit({ type: "assistant", text: normalized.text ?? JSON.stringify(normalized) });
      }
    });
    await client.start();
    started = true;
    return client;
  }

  async function emitStatsFromRpc(rpcClient) {
    try {
      const sessionStats = await rpcClient.getSessionStats();
      bus.emit({ type: "stats", stats: sessionStats, tokens: sessionStats.totalTokens ?? sessionStats.tokens ?? 0, cost: sessionStats.cost ? `$${sessionStats.cost}` : "$0.00" });
    } catch {
      bus.emit({ type: "stats", stats: cloneStats(stats) });
    }
  }

  return {
    async start() {
      await ensureClient();
      return this;
    },

    async sendPrompt(prompt, runOptions = {}) {
      if (typeof prompt !== "string" || prompt.length === 0) throw new TypeError("prompt must be a non-empty string");
      const rpcClient = await ensureClient();
      const nextProvider = runOptions.provider ?? currentModel.provider;
      const nextModel = runOptions.model ?? currentModel.model;
      if (nextProvider && nextModel && nextProvider !== "default" && nextModel !== "default" && (nextProvider !== currentModel.provider || nextModel !== currentModel.model)) {
        currentModel = { provider: nextProvider, model: nextModel };
        await rpcClient.setModel(nextProvider, nextModel);
      }
      stats.runs += 1;
      stats.running = true;
      bus.emit({ type: "run_start", runId: stats.runs, prompt, command: "rpc.prompt", args: [] });
      if (runOptions.signal) {
        if (runOptions.signal.aborted) await rpcClient.abort();
        else runOptions.signal.addEventListener("abort", () => void rpcClient.abort(), { once: true });
      }
      await rpcClient.prompt(prompt);
      await rpcClient.waitForIdle(runOptions.timeout ?? options.timeout ?? 120000);
      stats.running = false;
      stats.completed += 1;
      stats.lastExitCode = 0;
      await emitStatsFromRpc(rpcClient);
      bus.emit({ type: "run_end", ok: true, exitCode: 0, aborted: false });
      return { ok: true, stdout: await rpcClient.getLastAssistantText().catch(() => ""), stderr: rpcClient.getStderr?.() ?? "" };
    },

    async abort() {
      const rpcClient = await ensureClient();
      await rpcClient.abort();
      stats.aborted += 1;
      stats.running = false;
      bus.emit({ type: "aborted" });
    },

    async stop() {
      if (client) await client.stop();
      client = null;
      started = false;
      bus.clear();
    },

    getStats() {
      const snapshot = cloneStats(stats);
      snapshot.started = started;
      snapshot.model = { ...currentModel };
      return snapshot;
    },

    async setModel(nextModel = {}) {
      if (Object.hasOwn(nextModel, "provider")) currentModel.provider = nextModel.provider;
      if (Object.hasOwn(nextModel, "model")) currentModel.model = nextModel.model;
      if (client && currentModel.provider !== "default" && currentModel.model !== "default") {
        await client.setModel(currentModel.provider, currentModel.model);
      }
      bus.emit({ type: "stats", stats: this.getStats() });
      return { ...currentModel };
    },

    async newSession(parentSession) {
      const rpcClient = await ensureClient();
      return rpcClient.newSession(parentSession);
    },

    async getState() {
      const rpcClient = await ensureClient();
      return rpcClient.getState();
    },

    async getSessionStats() {
      const rpcClient = await ensureClient();
      return rpcClient.getSessionStats();
    },

    async exportHtml(outputPath) {
      const rpcClient = await ensureClient();
      return rpcClient.exportHtml(outputPath);
    },

    onEvent(callback) {
      return bus.subscribe(callback);
    },
  };
}
