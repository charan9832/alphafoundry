import React, { useCallback, useEffect, useReducer, useRef } from "react";
import { useApp, useInput } from "ink";
import { initialState, reducer } from "./state.js";
import { parseSlashCommand } from "./commands.js";
import { runPromptWithEvents } from "./prompt-flow.js";
import { createRuntimeRunner, classifyRuntimeError } from "./runtime-runner.js";
import { useTerminalSize, paneWidths } from "./layout.js";
import { Home } from "./components/Home.jsx";
import { Workspace } from "./components/Workspace.jsx";

let cachedRuntimeRunnerPromise;

async function loadRuntimeRunner() {
  if (cachedRuntimeRunnerPromise) return cachedRuntimeRunnerPromise;
  cachedRuntimeRunnerPromise = createRuntimeRunner().catch((error) => {
    cachedRuntimeRunnerPromise = undefined;
    throw error;
  });
  return cachedRuntimeRunnerPromise;
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
        { provider: current.provider, model: current.model, toolAllow: current.tools, permissionMode: current.permissionMode, toolsApproved: current.tools.length > 0 && !current.pendingToolApproval, session: current.session, signal: controller.signal },
        (event) => dispatch({ type: "RUNTIME_EVENT", event }),
      );
      if (controller.signal.aborted) return;
      dispatch({ type: "RUN_FINISHED", result });
    } catch (error) {
      if (controller.signal.aborted) {
        dispatch({ type: "RUN_CANCELLED", reason: controller.signal.reason ?? "aborted" });
      } else {
        dispatch({ type: "RUN_ERROR", error: new Error(classifyRuntimeError(error, current)) });
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
