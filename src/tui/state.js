import { detectRuntime } from "./runtime.js";
import { commandHelp, sessionId } from "./commands.js";
import { redactText } from "../redaction.js";

const MAX_EVENTS = 200;

function appendEvent(state, event) {
  return { ...state, events: [...state.events, event].slice(-MAX_EVENTS) };
}

function payloadOf(event = {}) {
  return event.payload && typeof event.payload === "object" ? event.payload : {};
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function eventText(event) {
  const payload = payloadOf(event);
  const directText = firstDefined(event.text, event.output, event.error, payload.text, payload.output, payload.error, payload.message, payload.prompt);
  if (directText !== undefined) return String(directText);

  if (event.type === "stats") {
    const stats = event.stats ?? payload.stats ?? {};
    const tokens = firstDefined(event.tokens, payload.tokens, stats.totalTokens, stats.tokens, 0);
    const percent = firstDefined(event.percent, payload.percent, 0);
    const cost = firstDefined(event.cost, payload.cost, stats.cost, "$0.00");
    return `tokens ${tokens} · ${percent}% · ${cost}`;
  }
  if (event.type === "session") {
    const id = firstDefined(event.id, payload.id, event.sessionId, payload.sessionId, "unknown session");
    const title = firstDefined(event.title, payload.title);
    return `${id}${title ? ` · ${title}` : ""}`;
  }
  if (event.type === "tool" || event.type === "tool_call" || event.type === "tool_result") {
    const name = firstDefined(event.name, payload.name, payload.tool, "tool");
    const status = firstDefined(event.status, payload.status);
    return `${name}${status ? ` · ${status}` : ""}`;
  }
  if (event.type === "artifact") {
    const evidence = event.evidence ?? payload.evidence ?? payload.artifact ?? payload;
    return `${evidence.kind ?? "artifact"}${evidence.title ? ` · ${evidence.title}` : ""}${evidence.uri ? ` · ${evidence.uri}` : ""}`;
  }
  if (event.type === "run_start") return `run started${payload.prompt ? ` · ${payload.prompt}` : ""}`;
  if (event.type === "run_end") return `run ended · ${firstDefined(event.ok, payload.ok, true) ? "success" : "error"}`;
  return JSON.stringify(event);
}

function normalizeRuntimeEvent(event = {}) {
  const type = event.type === "message" ? "assistant" : event.type;
  const payload = payloadOf(event);
  return {
    ...event,
    type,
    ...(event.diff === undefined && payload.diff !== undefined ? { diff: payload.diff } : {}),
    text: eventText({ ...event, type }),
  };
}

function createSession(overrides = {}) {
  return { id: sessionId(), title: "New session", ...overrides };
}

function upsertSession(sessions = [], session) {
  if (!session?.id) return sessions;
  const index = sessions.findIndex((item) => item.id === session.id);
  if (index === -1) return [...sessions, session];
  return sessions.map((item, itemIndex) => itemIndex === index ? { ...item, ...session } : item);
}

function sessionFromRuntimeEvent(current, event) {
  const payload = payloadOf(event);
  const id = firstDefined(event.id, payload.id, event.sessionId, payload.sessionId);
  if (!id) return null;
  return {
    ...current,
    id,
    ...(firstDefined(event.title, payload.title) ? { title: firstDefined(event.title, payload.title) } : {}),
  };
}

function evidenceFromRuntimeEvent(event) {
  const payload = payloadOf(event);
  const evidence = event.evidence ?? payload.evidence ?? payload.artifact;
  if (Array.isArray(evidence)) return evidence;
  if (evidence && typeof evidence === "object") return [evidence];
  if (event.type === "artifact" && (payload.title || payload.kind || payload.uri || payload.name)) {
    return [{ kind: payload.kind ?? "artifact", title: payload.title ?? payload.name ?? "runtime artifact", ...(payload.uri ? { uri: payload.uri } : {}) }];
  }
  return [];
}

export function createInitialState(overrides = {}) {
  const runtime = detectRuntime(overrides);
  const session = createSession(overrides.session);
  return {
    product: "AlphaFoundry",
    view: "home",
    input: "",
    mode: "Build",
    model: runtime.model,
    provider: runtime.provider,
    cwd: runtime.cwd,
    version: runtime.version,
    runtime: runtime.runtime,
    project: runtime.project,
    status: "idle",
    terminalState: "idle",
    action: "ready",
    goal: "",
    intent: null,
    activeRun: null,
    cancelling: false,
    cancelled: false,
    error: null,
    session,
    sessions: overrides.sessions ?? [session],
    tools: overrides.tools ?? [],
    tokenUsage: { tokens: 0, percent: 0, cost: "$0.00", ...overrides.tokenUsage },
    runtimeStats: overrides.runtimeStats ?? null,
    evidence: overrides.evidence ?? [],
    mcp: {
      label: runtime.runtime.backendPackage,
      connected: runtime.runtime.backendVersion !== "not installed",
    },
    lsp: runtime.lsp ?? [],
    tasks: [],
    events: [],
  };
}

export const initialState = createInitialState();

export function reducer(state, action) {
  switch (action.type) {
    case "SET_INPUT":
      return { ...state, input: action.value };
    case "SUBMIT_HOME":
      return {
        ...state,
        view: "workspace",
        goal: action.value,
        intent: { prompt: action.value },
        input: "",
        status: "idle",
        terminalState: "idle",
        cancelling: false,
        cancelled: false,
        error: null,
        action: "ready",
        tasks: [],
        events: [
          ...state.events,
          { type: "user", text: action.value },
          { type: "separator", label: "alphafoundry session intent" },
        ].slice(-MAX_EVENTS),
      };
    case "ADD_EVENT":
      return appendEvent(state, action.event);
    case "SET_STATUS":
      return { ...state, status: action.status, terminalState: action.terminalState ?? state.terminalState, action: action.action ?? state.action };
    case "UPDATE_TASK":
      return { ...state, tasks: state.tasks.map((task) => task.id === action.id ? { ...task, ...action.patch } : task) };
    case "SET_TOKEN_USAGE":
      return { ...state, tokenUsage: action.value };
    case "SET_MODEL":
      return { ...state, model: action.model ?? state.model, provider: action.provider ?? state.provider };
    case "COMMAND":
      return applyCommand(state, action.command);
    case "RUN_STARTED":
      return {
        ...state,
        view: "workspace",
        goal: action.prompt ?? state.goal,
        intent: action.prompt ? { prompt: action.prompt } : state.intent,
        status: "running",
        terminalState: "running",
        action: "Runtime request running",
        activeRun: action.run ?? null,
        cancelling: false,
        cancelled: false,
        error: null,
        tasks: [],
        events: [
          ...state.events,
          ...(action.prompt ? [{ type: "user", text: action.prompt }] : []),
        ].slice(-MAX_EVENTS),
      };
    case "RUN_CANCELLING":
      return { ...state, status: "cancelling", terminalState: "cancelling", action: "Cancelling run...", cancelling: true };
    case "RUN_CANCELLED":
      return appendEvent({ ...state, status: "cancelled", terminalState: "cancelled", action: "cancelled", activeRun: null, cancelling: false, cancelled: true }, { type: "error", text: `Run cancelled${action.reason ? `: ${action.reason}` : ""}` });
    case "RUN_FINISHED": {
      const ok = action.result?.ok !== false;
      return {
        ...state,
        status: ok ? "idle" : "error",
        terminalState: ok ? "success" : "error",
        action: ok ? "ready" : "error",
        activeRun: null,
        cancelling: false,
        cancelled: false,
        error: ok ? null : (action.result?.error ?? state.error),
      };
    }
    case "RUN_ERROR": {
      const message = action.error instanceof Error ? action.error.message : String(action.error ?? "Unknown error");
      return appendEvent({ ...state, status: "error", terminalState: "error", action: "error", activeRun: null, cancelling: false, error: message }, { type: "error", text: message });
    }
    case "RUNTIME_EVENT":
      return applyRuntimeEvent(state, action.event);
    default:
      return state;
  }
}

export function applyRuntimeEvent(state, rawEvent = {}) {
  const event = normalizeRuntimeEvent(rawEvent);
  const payload = payloadOf(event);
  let next = state;

  if (event.type === "run_start") {
    const prompt = firstDefined(event.prompt, payload.prompt);
    next = {
      ...next,
      view: "workspace",
      status: "running",
      terminalState: "running",
      action: "Runtime request running",
      goal: prompt ?? next.goal,
      intent: prompt ? { prompt } : next.intent,
      cancelling: false,
      cancelled: false,
      error: null,
    };
  }

  if (event.type === "run_end") {
    const aborted = Boolean(firstDefined(event.aborted, payload.aborted, false));
    const ok = firstDefined(event.ok, payload.ok, !aborted);
    next = {
      ...next,
      status: aborted ? "cancelled" : ok ? "idle" : "error",
      terminalState: aborted ? "cancelled" : ok ? "success" : "error",
      action: aborted ? "cancelled" : ok ? "ready" : "error",
      activeRun: null,
      cancelling: false,
      cancelled: aborted,
      error: ok ? null : firstDefined(event.error, payload.error, next.error),
    };
  }

  if (event.type === "error") {
    const message = firstDefined(event.error, payload.error, event.text, "Unknown error");
    next = { ...next, status: "error", terminalState: "error", action: "error", activeRun: null, cancelling: false, error: String(message) };
  }

  if (event.type === "aborted") {
    next = { ...next, status: "cancelled", terminalState: "cancelled", action: "cancelled", activeRun: null, cancelling: false, cancelled: true };
  }

  if (event.type === "stats") {
    const stats = event.stats ?? payload.stats ?? null;
    next = {
      ...next,
      tokenUsage: {
        tokens: firstDefined(event.tokens, payload.tokens, stats?.totalTokens, stats?.tokens, next.tokenUsage.tokens),
        percent: firstDefined(event.percent, payload.percent, next.tokenUsage.percent),
        cost: firstDefined(event.cost, payload.cost, stats?.cost, next.tokenUsage.cost),
      },
      runtimeStats: stats ?? next.runtimeStats,
    };
  }

  const runtimeSession = sessionFromRuntimeEvent(next.session, event);
  if (runtimeSession) {
    next = { ...next, session: runtimeSession, sessions: upsertSession(next.sessions, runtimeSession) };
  }

  const evidence = evidenceFromRuntimeEvent(event);
  if (evidence.length) next = { ...next, evidence: [...next.evidence, ...evidence] };

  return appendEvent(next, event);
}

function exportedEventText(event) {
  return redactText(event.text ?? event.command ?? event.output ?? event.error ?? "");
}

export function applyCommand(state, command = {}) {
  switch (command.type) {
    case "help":
      return appendEvent({ ...state, view: "workspace" }, { type: "assistant", text: commandHelp() });
    case "clear":
      return { ...state, events: [], action: "cleared" };
    case "model": {
      const model = command.model || state.model;
      const provider = command.provider || state.provider;
      return appendEvent({ ...state, model, provider }, { type: "assistant", text: `local preference set to ${provider}/${model}; applies on the next runtime prompt` });
    }
    case "provider": {
      const provider = command.provider || state.provider;
      return appendEvent({ ...state, provider }, { type: "assistant", text: `local preference set to provider ${provider}; applies on the next runtime prompt` });
    }
    case "stats":
      return appendEvent(state, { type: "stats", text: `local TUI counters: tokens ${state.tokenUsage.tokens} · ${state.tokenUsage.percent}% · ${state.tokenUsage.cost}` });
    case "tools":
      return appendEvent({ ...state, tools: command.tools ?? [] }, { type: "tool", text: `local tool preference set: ${(command.tools ?? []).join(", ") || "none"}; runtime enforcement depends on adapter support` });
    case "session":
      return appendEvent(state, { type: "session", text: `local TUI session ${state.session.id} · ${state.events.length} events` });
    case "new": {
      const session = createSession();
      return appendEvent({ ...state, view: "workspace", goal: "", intent: null, session, sessions: upsertSession(state.sessions, session), events: [], status: "idle", terminalState: "idle", action: "new session", activeRun: null, evidence: [] }, { type: "session", text: `started local TUI session ${session.id}; backend session not changed` });
    }
    case "export":
      return appendEvent(state, { type: "assistant", text: `Local transcript:\n${state.events.map((event) => `[${event.type}] ${exportedEventText(event)}`).join("\n") || "Nothing to print."}` });
    case "unknown":
      return appendEvent(state, { type: "error", text: `Unknown command /${command.command}. Try /help.` });
    default:
      return state;
  }
}
