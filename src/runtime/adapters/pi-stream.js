import { spawn } from "node:child_process";
import { buildConfiguredPiArgs, resolvePiProcessEnv, resolveRunTimeoutMs } from "../../pi-backend.js";
import { resolveRuntimeConfig } from "../../config.js";
import { mapPiToolPolicy } from "../pi-tool-policy.js";
import { createRuntimeEvent } from "../events.js";

export function piEventToAlphaFoundryEvents(piEvent, context = {}) {
  const { sessionId, runId, accumulatedText = "" } = context;
  const events = [];

  switch (piEvent.type) {
    case "agent_start": {
      events.push(
        createRuntimeEvent("run_start", {
          sessionId,
          runId,
          payload: { adapter: "pi", prompt: context.prompt, provider: context.provider, model: context.model },
        }),
      );
      events.push(
        createRuntimeEvent("user", {
          sessionId,
          runId,
          payload: { text: context.prompt },
        }),
      );
      break;
    }
    case "message_update": {
      const ame = piEvent.assistantMessageEvent;
      if (ame?.type === "text_delta" && typeof ame.delta === "string") {
        events.push(
          createRuntimeEvent("assistant_delta", {
            sessionId,
            runId,
            payload: { delta: ame.delta },
          }),
        );
      }
      break;
    }
    case "message_end": {
      const msg = piEvent.message;
      if (msg?.role === "assistant") {
        const text = extractAssistantText(msg);
        events.push(
          createRuntimeEvent("assistant", {
            sessionId,
            runId,
            payload: { text, stopReason: msg?.stopReason, errorMessage: msg?.errorMessage },
          }),
        );
        if (msg?.errorMessage) {
          events.push(
            createRuntimeEvent("error", {
              sessionId,
              runId,
              payload: { text: msg.errorMessage },
            }),
          );
        }
      }
      break;
    }
    case "tool_execution_start": {
      events.push(
        createRuntimeEvent("tool_call", {
          sessionId,
          runId,
          payload: {
            toolCallId: piEvent.toolCallId,
            name: piEvent.toolName,
            args: piEvent.args,
          },
        }),
      );
      break;
    }
    case "tool_execution_end": {
      events.push(
        createRuntimeEvent("tool_result", {
          sessionId,
          runId,
          payload: {
            toolCallId: piEvent.toolCallId,
            name: piEvent.toolName,
            result: piEvent.result,
            isError: piEvent.isError,
          },
        }),
      );
      break;
    }
    case "agent_end": {
      const messages = piEvent.messages ?? [];
      const lastAssistant = messages.filter((m) => m.role === "assistant").pop();
      const ok = !lastAssistant?.errorMessage;
      events.push(
        createRuntimeEvent("run_end", {
          sessionId,
          runId,
          payload: {
            ok,
            exitCode: ok ? 0 : 1,
            adapter: "pi",
          },
        }),
      );
      break;
    }
    case "auto_retry_start":
    case "auto_retry_end":
    case "compaction_start":
    case "compaction_end": {
      // Map to stats events for observability
      events.push(
        createRuntimeEvent("stats", {
          sessionId,
          runId,
          payload: { piEventType: piEvent.type, ...piEvent },
        }),
      );
      break;
    }
    default:
      break;
  }

  return events;
}

function extractAssistantText(message) {
  if (!message) return "";
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .map((block) => {
        if (block.type === "text") return block.text ?? "";
        if (block.type === "toolCall") return `[${block.name}]`;
        return "";
      })
      .join("");
  }
  return "";
}

export function runPiJsonStream(args, options = {}) {
  const maxOutputBytes = options.maxOutputBytes ?? 1024 * 1024;
  const onEvent = options.onEvent;
  const signal = options.signal;
  const baseEnv = options.env ?? process.env;
  const timeoutMs = resolveRunTimeoutMs({ ...options, processEnv: baseEnv });

  return new Promise((resolve) => {
    const child = spawn(process.execPath, buildConfiguredPiArgs([...args, "--mode", "json"], options.runtimeConfig, { processEnv: baseEnv }), {
      stdio: ["ignore", "pipe", "pipe"],
      env: resolvePiProcessEnv(options.runtimeConfig, baseEnv),
    });

    let stdoutBuffer = "";
    let stderrBuffer = "";
    let cappedBytes = 0;
    let totalBytes = 0;
    let agentEnded = false;
    let timedOut = false;
    let settled = false;
    let timeoutHandle;
    const context = {
      sessionId: options.sessionId,
      runId: options.runId,
      prompt: options.prompt,
      provider: options.provider,
      model: options.model,
    };
    const allEvents = [];

    function emit(event) {
      if (onEvent) {
        try {
          onEvent(event);
        } catch {
          // Consumer errors should not crash the stream
        }
      }
      allEvents.push(event);
    }

    function processLine(line) {
      if (!line) return;
      try {
        const piEvent = JSON.parse(line);
        if (piEvent.type === "session") return;
        if (piEvent.type === "agent_end") agentEnded = true;
        const events = piEventToAlphaFoundryEvents(piEvent, context);
        for (const event of events) emit(event);
      } catch {
        // Not JSON: treat as raw stdout
        emit(
          createRuntimeEvent("stdout", {
            sessionId: context.sessionId,
            runId: context.runId,
            payload: { text: line },
          }),
        );
      }
    }

    function appendCapped(chunk) {
      const text = chunk.toString();
      totalBytes += Buffer.byteLength(text);
      const remaining = Math.max(0, maxOutputBytes - Buffer.byteLength(stdoutBuffer) - Buffer.byteLength(stderrBuffer));
      if (remaining <= 0) {
        cappedBytes += Buffer.byteLength(text);
        return "";
      }
      const kept = Buffer.byteLength(text) <= remaining ? text : text.slice(0, remaining);
      cappedBytes += Math.max(0, Buffer.byteLength(text) - Buffer.byteLength(kept));
      return kept;
    }

    child.stdout?.on("data", (chunk) => {
      const text = appendCapped(chunk);
      stdoutBuffer += text;
      let boundary;
      while ((boundary = stdoutBuffer.indexOf("\n")) !== -1) {
        const line = stdoutBuffer.slice(0, boundary).trim();
        stdoutBuffer = stdoutBuffer.slice(boundary + 1);
        processLine(line);
      }
    });

    child.stderr?.on("data", (chunk) => {
      stderrBuffer += chunk.toString();
    });

    function finish(status, errorMessage) {
      if (settled) return;
      settled = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
      const timeoutError = timedOut ? `AlphaFoundry runtime timed out after ${timeoutMs} ms` : "";
      const terminalError = [errorMessage, timeoutError].filter(Boolean).join("\n");
      // Process any remaining stdout
      if (stdoutBuffer.trim()) {
        processLine(stdoutBuffer.trim());
        stdoutBuffer = "";
      }

      if (timeoutError) {
        emit(
          createRuntimeEvent("error", {
            sessionId: context.sessionId,
            runId: context.runId,
            payload: { text: timeoutError },
          }),
        );
      }

      // If agent_end never arrived, synthesize run_end
      if (!agentEnded) {
        const ok = !timedOut && status === 0 && !terminalError && !stderrBuffer;
        emit(
          createRuntimeEvent("run_end", {
            sessionId: context.sessionId,
            runId: context.runId,
            payload: { ok, exitCode: timedOut ? 124 : (status ?? 1), adapter: "pi" },
          }),
        );
      }

      // Emit stderr as error event if present
      if (stderrBuffer.trim()) {
        emit(
          createRuntimeEvent("stderr", {
            sessionId: context.sessionId,
            runId: context.runId,
            payload: { text: stderrBuffer.trim() },
          }),
        );
      }

      // Build output and terminal status from normalized events so provider-level
      // assistant errors are reflected even when the adapter process exits 0.
      const assistantEvents = allEvents.filter((e) => e.type === "assistant" || e.type === "assistant_delta");
      const output = assistantEvents
        .map((e) => e.payload?.text ?? e.payload?.delta ?? "")
        .join("");
      const errorEvents = allEvents.filter((e) => e.type === "error");
      const lastRunEnd = allEvents.filter((e) => e.type === "run_end").at(-1);
      const eventError = errorEvents.map((e) => e.payload?.text ?? e.payload?.message ?? "").filter(Boolean).join("\n");
      const ok = !timedOut && status === 0 && !terminalError && !stderrBuffer && errorEvents.length === 0 && lastRunEnd?.payload?.ok !== false;

      resolve({
        ok,
        status: timedOut ? 124 : (ok ? 0 : (status && status !== 0 ? status : 1)),
        output,
        error: stderrBuffer.trim() || terminalError || eventError || undefined,
        events: allEvents,
        cappedBytes,
        timedOut,
      });
    }

    child.on("error", (error) => {
      finish(1, error.message);
    });

    child.on("close", (status) => {
      finish(status ?? 0);
    });

    if (timeoutMs > 0) {
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        try {
          child.kill("SIGTERM");
        } catch {
          // ignore cleanup errors
        }
        setTimeout(() => {
          try {
            child.kill("SIGKILL");
          } catch {
            // ignore cleanup errors
          }
        }, 1000).unref?.();
      }, timeoutMs);
      timeoutHandle.unref?.();
    }

    if (signal) {
      const onAbort = () => {
        try {
          child.kill("SIGTERM");
        } catch {
          // ignore
        }
      };
      if (signal.aborted) {
        onAbort();
      } else {
        signal.addEventListener("abort", onAbort, { once: true });
      }
    }
  });
}

export function runPiPromptJsonStream(prompt, options = {}) {
  const runtimeConfig = resolveRuntimeConfig(
    { provider: options.provider, model: options.model, env: options.env },
    { env: options.processEnv ?? process.env },
  );
  const args = ["-p", "--no-session"];
  if (runtimeConfig.provider && runtimeConfig.provider !== "default") args.push("--provider", runtimeConfig.provider);
  if (runtimeConfig.model && runtimeConfig.model !== "default") args.push("--model", runtimeConfig.model);

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

  args.push(prompt);

  return runPiJsonStream([...args, ...toolPolicy.flags], {
    ...options,
    prompt,
    provider: runtimeConfig.provider,
    model: runtimeConfig.model,
    runtimeConfig,
    env: runtimeConfig.env,
  });
}
