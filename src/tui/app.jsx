import React, { useCallback, useReducer } from "react";
import { useApp, useInput } from "ink";
import { initialState, reducer } from "./state.js";
import { useTerminalSize, paneWidths } from "./layout.js";
import { Home } from "./components/Home.jsx";
import { Workspace } from "./components/Workspace.jsx";
import { runPiPrompt } from "../pi-backend.js";

export function App() {
  const { exit } = useApp();
  const size = useTerminalSize();
  const [state, dispatch] = useReducer(reducer, initialState);

  const submitPrompt = useCallback(async (value) => {
    if (!value.trim()) return;
    const alreadyWorkspace = state.view === "workspace";
    if (!alreadyWorkspace) dispatch({ type: "SUBMIT_HOME", value });
    else dispatch({ type: "ADD_EVENT", event: { type: "user", text: value } });
    dispatch({ type: "SET_STATUS", status: "running", action: "Writing command..." });
    dispatch({ type: "ADD_EVENT", event: { type: "command", command: `af -p ${JSON.stringify(value)}`, status: "running" } });
    try {
      const result = await runPiPrompt(value, { provider: state.provider, model: state.model });
      dispatch({ type: "ADD_EVENT", event: { type: "command", command: `af -p ${JSON.stringify(value)}`, status: result.ok ? "success" : "error" } });
      dispatch({ type: "ADD_EVENT", event: { type: result.ok ? "assistant" : "error", text: result.output?.trim() || result.error || "No output." } });
      dispatch({ type: "UPDATE_TASK", id: "inspect", patch: { status: "done" } });
      dispatch({ type: "UPDATE_TASK", id: "edit", patch: { status: "done" } });
      dispatch({ type: "UPDATE_TASK", id: "verify", patch: { status: "active" } });
      dispatch({ type: "SET_STATUS", status: "idle", action: "ready" });
    } catch (error) {
      dispatch({ type: "ADD_EVENT", event: { type: "error", text: error instanceof Error ? error.message : String(error) } });
      dispatch({ type: "SET_STATUS", status: "error", action: "error" });
    }
  }, [state.provider, state.model, state.view]);

  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === "c")) exit();
  });

  if (state.view === "home") return <Home state={state} dispatch={dispatch} columns={size.columns} rows={size.rows} onSubmit={submitPrompt} />;
  const widths = paneWidths(size.columns);
  return <Workspace state={state} dispatch={dispatch} columns={size.columns} rows={size.rows} mainWidth={widths.main} sidebarWidth={widths.sidebar} onSubmit={submitPrompt} />;
}
