export const initialState = {
  view: "home",
  input: "",
  mode: "Build",
  model: "Claude Opus 4.5",
  provider: "OpenCode Zen",
  cwd: process.cwd(),
  version: "0.3.0",
  status: "idle",
  action: "ready",
  goal: "",
  tokenUsage: { tokens: 0, percent: 0, cost: "$0.00" },
  mcp: { label: "Hard", connected: true },
  lsp: ["typescript", "eslint"],
  tasks: [],
  events: [],
};

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
          { id: "inspect", label: "Inspect workspace", status: "active" },
          { id: "edit", label: "Apply changes", status: "pending" },
          { id: "verify", label: "Run checks", status: "pending" },
        ],
        events: [
          ...state.events,
          { type: "user", text: action.value },
          { type: "separator", label: "session started" },
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
