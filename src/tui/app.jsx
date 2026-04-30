import React, { useCallback, useEffect, useReducer, useRef } from "react";
import { useApp, useInput } from "ink";
import { initialState, reducer } from "./state.js";
import { parseSlashCommand } from "./commands.js";
import { runPromptWithEvents } from "./prompt-flow.js";
import { useTerminalSize, paneWidths } from "./layout.js";
import { Home } from "./components/Home.jsx";
import { Workspace } from "./components/Workspace.jsx";

let cachedRuntimeRunnerPromise;

async function loadRuntimeRunner() {
  if (cachedRuntimeRunnerPromise) return cachedRuntimeRunnerPromise;
  cachedRuntimeRunnerPromise = createRuntimeRunner();
  return cachedRuntimeRunnerPromise;
}

async function createRuntimeRunner() {
  try {
    const { resolveRuntimeConfig } = await import("../config.js");
    const runtimeConfig = resolveRuntimeConfig();
    const runtime = await import("../pi-runtime/client.js");
    if (typeof runtime.createPiRpcRuntime === "function") {
      const client = runtime.createPiRpcRuntime(runtimeConfig);
      await client.start();
      return async (prompt, options = {}) => {
        const unsubscribe = typeof options.onEvent === "function" ? client.onEvent(options.onEvent) : undefined;
        try {
          const result = await client.sendPrompt(prompt, options);
          return {
            ok: result.ok,
            output: "",
            error: result.error || result.stderr,
            events: result.error || result.stderr ? [{ type: "stderr", text: result.error || result.stderr }] : [],
          };
        } finally {
          unsubscribe?.();
        }
      };
    }
    if (typeof runtime.createPiRuntime === "function") {
      const client = runtime.createPiRuntime(runtimeConfig).start();
      return async (prompt, options = {}) => {
        const unsubscribe = typeof options.onEvent === "function" ? client.onEvent(options.onEvent) : undefined;
        try {
          const result = await client.sendPrompt(prompt, options);
          return {
            ok: result.ok,
            output: "",
            error: result.error || result.stderr,
            events: result.error || result.stderr ? [{ type: "stderr", text: result.error || result.stderr }] : [],
          };
        } finally {
          unsubscribe?.();
        }
      };
    }
    if (typeof runtime.runPrompt === "function") return runtime.runPrompt;
    if (typeof runtime.runPiPrompt === "function") return runtime.runPiPrompt;
    if (typeof runtime.createRuntimeClient === "function") {
      const client = runtime.createRuntimeClient();
      if (typeof client.runPrompt === "function") return client.runPrompt.bind(client);
    }
  } catch (error) {
    if (error?.code !== "ERR_MODULE_NOT_FOUND") throw error;
  }

  const backend = await import("../pi-backend.js");
  return backend.runPiPrompt;
}

export function App() {
  const { exit } = useApp();
  const size = useTerminalSize();
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const cancelActiveRun = useCallback((reason = "cancel requested") => {
    const activeRun = stateRef.current.activeRun;
    if (!activeRun) return false;
    dispatch({ type: "RUN_CANCELLING" });
    try {
      if (typeof activeRun.abort === "function") activeRun.abort(reason);
      else if (typeof activeRun.cancel === "function") activeRun.cancel(reason);
    } finally {
      dispatch({ type: "RUN_CANCELLED", reason });
    }
    return true;
  }, []);

  const submitPrompt = useCallback(async (value) => {
    const clean = value.trim();
    if (!clean) return;

    const command = parseSlashCommand(clean);
    if (command.type !== "prompt") {
      if (command.type === "exit") {
        if (!cancelActiveRun("/exit")) exit();
        return;
      }
      dispatch({ type: "COMMAND", command });
      return;
    }

    const controller = new AbortController();
    const run = { id: `run_${Date.now().toString(36)}`, abort: (reason) => controller.abort(reason) };
    const current = stateRef.current;
    dispatch({ type: "RUN_STARTED", prompt: command.value, run });
    try {
      const runner = await loadRuntimeRunner();
      const result = await runPromptWithEvents(
        runner,
        command.value,
        { provider: current.provider, model: current.model, tools: current.tools, session: current.session, signal: controller.signal },
        (event) => dispatch({ type: "RUNTIME_EVENT", event }),
      );
      if (controller.signal.aborted) return;
      dispatch({ type: "RUN_FINISHED", result });
    } catch (error) {
      if (controller.signal.aborted) {
        dispatch({ type: "RUN_CANCELLED", reason: controller.signal.reason ?? "aborted" });
      } else {
        dispatch({ type: "RUN_ERROR", error });
      }
    }
  }, [cancelActiveRun, exit]);

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === "c")) {
      if (stateRef.current.status === "running" || stateRef.current.status === "cancelling") {
        cancelActiveRun(key.escape ? "escape" : "ctrl+c");
      } else {
        exit();
      }
    }
  });

  if (state.view === "home") return <Home state={state} dispatch={dispatch} columns={size.columns} rows={size.rows} onSubmit={submitPrompt} />;
  const widths = paneWidths(size.columns);
  return <Workspace state={state} dispatch={dispatch} columns={size.columns} rows={size.rows} mainWidth={widths.main} sidebarWidth={widths.sidebar} onSubmit={submitPrompt} />;
}
