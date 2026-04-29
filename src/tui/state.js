import { detectRuntime } from "./runtime.js";

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
    tokenUsage: { tokens: 0, percent: 0, cost: "$0.00" },
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
        ].slice(-200),
      };
    case "ADD_EVENT":
      return { ...state, events: [...state.events, action.event].slice(-200) };
    case "SET_STATUS":
      return { ...state, status: action.status, action: action.action ?? state.action };
    case "UPDATE_TASK":
      return { ...state, tasks: state.tasks.map((task) => task.id === action.id ? { ...task, ...action.patch } : task) };
    case "SET_TOKEN_USAGE":
      return { ...state, tokenUsage: action.value };
    case "SET_MODEL":
      return { ...state, model: action.model ?? state.model, provider: action.provider ?? state.provider };
    default:
      return state;
  }
}
