import { detectRuntime } from "./runtime.js";
import { commandHelp, sessionId } from "./commands.js";
import { redactText } from "../redaction.js";

const MAX_EVENTS = 200;

function appendEvent(state, event) {
  return { ...state, events: [...state.events, event].slice(-MAX_EVENTS) };
}

function eventText(event) {
  if (event.text !== undefined) return String(event.text);
  if (event.output !== undefined) return String(event.output);
  if (event.error !== undefined) return String(event.error);
  if (event.type === "stats") return `tokens ${event.tokens ?? 0} · ${event.percent ?? 0}% · ${event.cost ?? "$0.00"}`;
  if (event.type === "session") return `${event.id ?? "unknown session"}${event.title ? ` · ${event.title}` : ""}`;
  if (event.type === "tool") return `${event.name ?? "tool"}${event.status ? ` · ${event.status}` : ""}`;
  return JSON.stringify(event);
}

function normalizeRuntimeEvent(event) {
  const type = event.type === "message" ? "assistant" : event.type;
  return { ...event, type, text: eventText({ ...event, type }) };
}

function createSession(overrides = {}) {
  return { id: sessionId(), title: "New session", ...overrides };
}

export function createInitialState(overrides = {}) {
  const runtime = detectRuntime(overrides);
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
    action: "ready",
    goal: "",
    activeRun: null,
    cancelling: false,
    cancelled: false,
    error: null,
    session: createSession(overrides.session),
    tools: overrides.tools ?? [],
    tokenUsage: { tokens: 0, percent: 0, cost: "$0.00", ...overrides.tokenUsage },
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
        input: "",
        status: "running",
        cancelling: false,
        cancelled: false,
        error: null,
        action: "Writing command...",
        tasks: [
          { id: "understand", label: "Understand request", status: "done" },
          { id: "inspect", label: "Read AlphaFoundry project context", status: "active" },
          { id: "execute", label: "Run Pi Agent backend", status: "pending" },
          { id: "verify", label: "Verify result", status: "pending" },
        ],
        events: [
          ...state.events,
          { type: "user", text: action.value },
          { type: "separator", label: "alphafoundry session started" },
        ].slice(-MAX_EVENTS),
      };
    case "ADD_EVENT":
      return appendEvent(state, action.event);
    case "SET_STATUS":
      return { ...state, status: action.status, action: action.action ?? state.action };
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
        status: "running",
        action: "Running Pi runtime...",
        activeRun: action.run ?? null,
        cancelling: false,
        cancelled: false,
        error: null,
        events: [
          ...state.events,
          ...(action.prompt ? [{ type: "user", text: action.prompt }] : []),
          { type: "command", command: `af -p ${JSON.stringify(action.prompt ?? "")}`, status: "running" },
        ].slice(-MAX_EVENTS),
      };
    case "RUN_CANCELLING":
      return { ...state, status: "cancelling", action: "Cancelling run...", cancelling: true };
    case "RUN_CANCELLED":
      return appendEvent({ ...state, status: "cancelled", action: "cancelled", activeRun: null, cancelling: false, cancelled: true }, { type: "error", text: `Run cancelled${action.reason ? `: ${action.reason}` : ""}` });
    case "RUN_FINISHED":
      return {
        ...state,
        status: "idle",
        action: "ready",
        activeRun: null,
        cancelling: false,
        cancelled: false,
      };
    case "RUN_ERROR": {
      const message = action.error instanceof Error ? action.error.message : String(action.error ?? "Unknown error");
      return appendEvent({ ...state, status: "error", action: "error", activeRun: null, cancelling: false, error: message }, { type: "error", text: message });
    }
    case "RUNTIME_EVENT":
      return applyRuntimeEvent(state, action.event);
    default:
      return state;
  }
}

export function applyRuntimeEvent(state, rawEvent = {}) {
  const event = normalizeRuntimeEvent(rawEvent);
  let next = state;
  if (event.type === "stats") {
    next = {
      ...next,
      tokenUsage: {
        tokens: event.tokens ?? next.tokenUsage.tokens,
        percent: event.percent ?? next.tokenUsage.percent,
        cost: event.cost ?? next.tokenUsage.cost,
      },
    };
  }
  if (event.type === "session") {
    next = { ...next, session: { ...next.session, ...event } };
  }
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
      return appendEvent({ ...state, view: "workspace", goal: "", session, events: [], status: "idle", action: "new session", activeRun: null }, { type: "session", text: `started local TUI session ${session.id}; backend session not changed` });
    }
    case "export":
      return appendEvent(state, { type: "assistant", text: `Local transcript:\n${state.events.map((event) => `[${event.type}] ${exportedEventText(event)}`).join("\n") || "Nothing to print."}` });
    case "unknown":
      return appendEvent(state, { type: "error", text: `Unknown command /${command.command}. Try /help.` });
    default:
      return state;
  }
}
