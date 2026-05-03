import React, { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useApp, useInput } from "ink";
import { createApprovalStore } from "../runtime/approval-store.js";
import { createSessionStore } from "../runtime/session-store.js";
import { runDoctor, formatDoctor } from "../doctor.js";
import { replaySession } from "../runtime/replay.js";
import { evaluateSession } from "../runtime/evals.js";
import { initialState, reducer } from "./state.js";
import { completeSlashCommand, parseSlashCommand } from "./commands.js";
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
  const processedPersistRequests = useRef(0);
  const processedEffectRequests = useRef(0);
  const [runStartedAt, setRunStartedAt] = useState(null);

  useEffect(() => {
    const requests = state.effectRequests ?? [];
    if (processedEffectRequests.current >= requests.length) return;
    const pending = requests.slice(processedEffectRequests.current);
    processedEffectRequests.current = requests.length;
    for (const request of pending) {
      try {
        if (request.kind === "doctor") {
          const report = runDoctor({ cwd: state.cwd });
          dispatch({ type: "EFFECT_RESULT", request, result: { ok: report.status !== "fail", text: formatDoctor(report) } });
        } else if (request.kind === "replay") {
          const store = createSessionStore();
          const summary = replaySession(store, request.sessionId);
          dispatch({ type: "EFFECT_RESULT", request, result: { ok: true, text: `Replay ${summary.sessionId}\nStatus: ${summary.status}\nEvents: ${summary.eventTotal}\nAssistant text: ${summary.assistant.textLength} chars (${summary.assistant.textDigest})\nTools: ${summary.toolCallCount} calls, ${summary.toolResultCount} results\nErrors: ${summary.errorCount}\nDuration: ${summary.durationMs ?? "unknown"} ms` } });
        } else if (request.kind === "eval") {
          const store = createSessionStore();
          const result = evaluateSession(store, request.sessionId);
          dispatch({ type: "EFFECT_RESULT", request, result: { ok: result.overall !== "FAIL", text: `Eval ${result.sessionId}\nOverall: ${result.overall}\n${result.checks.map((check) => `${check.status} ${check.name}`).join("\n")}` } });
        }
      } catch (error) {
        const fallback = request.kind === "replay"
          ? `Visible replay fallback: ${state.events.length} events · ${state.events.filter((event) => event.type === "assistant").length} assistant messages · ${state.events.filter((event) => event.type === "error").length} errors`
          : request.kind === "eval"
            ? `Visible eval fallback: ${state.events.some((event) => event.type === "error") ? "FAIL" : state.events.length ? "PASS" : "WARN"} · events ${state.events.length}`
            : `Effect failed: ${error instanceof Error ? error.message : String(error)}`;
        dispatch({ type: "EFFECT_RESULT", request, result: { ok: request.kind !== "doctor", text: fallback } });
      }
    }
  }, [state.effectRequests, state.cwd, state.events]);

  useEffect(() => {
    const requests = state.persistRequests ?? [];
    if (processedPersistRequests.current >= requests.length) return;
    const pending = requests.slice(processedPersistRequests.current);
    processedPersistRequests.current = requests.length;
    for (const request of pending) {
      try {
        if (request.kind === "session" && request.session?.id) {
          const store = createSessionStore();
          try { store.readSession(request.session.id); }
          catch { store.createSession({ id: request.session.id, title: request.session.title, cwd: state.cwd, adapter: "tui" }); }
        }
        if (request.kind === "approval") {
          const store = createApprovalStore();
          store.create({
            status: request.status,
            tools: request.decision?.tools ?? request.decision?.toolAllow ?? [],
            toolName: request.decision?.tools?.[0],
            sessionId: request.sessionId,
            scope: request.decision?.scope ?? "session",
            ttlSeconds: request.decision?.ttlSeconds,
            expiresAt: request.decision?.expiresAt,
            source: request.decision?.source ?? "tui",
          });
        }
      } catch (error) {
        dispatch({ type: "ADD_EVENT", event: { type: "error", text: `Persistence warning: ${error instanceof Error ? error.message : String(error)}` } });
      }
    }
  }, [state.persistRequests, state.cwd]);

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

    const current = stateRef.current;
    if (current.pendingToolApproval) {
      dispatch({ type: "SUBMIT_PROMPT", value: command.value });
      return;
    }

    const controller = new AbortController();
    const run = { id: `run_${Date.now().toString(36)}`, abort: (reason) => controller.abort(reason) };
    dispatch({ type: "RUN_STARTED", prompt: command.value, run });
    setRunStartedAt(Date.now());
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
      setRunStartedAt(null);
    } catch (error) {
      if (controller.signal.aborted) {
        dispatch({ type: "RUN_CANCELLED", reason: controller.signal.reason ?? "aborted" });
      } else {
        dispatch({ type: "RUN_ERROR", error: new Error(classifyRuntimeError(error, current)) });
      }
      setRunStartedAt(null);
    }
  }, [cancelActiveRun, exit]);

  useInput((input, key) => {
    if (key.tab) {
      dispatch({ type: "SET_INPUT", value: completeSlashCommand(stateRef.current.input ?? "") });
      return;
    }
    if (key.pageUp) {
      dispatch({ type: "SCROLL_TRANSCRIPT", direction: "up", amount: 10 });
      return;
    }
    if (key.pageDown) {
      dispatch({ type: "SCROLL_TRANSCRIPT", direction: "down", amount: 10 });
      return;
    }
    if (key.end) {
      dispatch({ type: "SCROLL_TRANSCRIPT", direction: "latest" });
      return;
    }
    if (key.upArrow) {
      dispatch({ type: "PROMPT_HISTORY_PREV" });
      return;
    }
    if (key.downArrow) {
      dispatch({ type: "PROMPT_HISTORY_NEXT" });
      return;
    }
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
  return <Workspace state={state} dispatch={dispatch} columns={size.columns} rows={size.rows} mainWidth={widths.main} sidebarWidth={widths.sidebar} showSidebar={widths.showSidebar} onSubmit={submitPrompt} runStartedAt={runStartedAt} />;
}
