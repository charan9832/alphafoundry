import { detectRuntime } from "./runtime.js";
import { commandHelp, commandSuggestions, sessionId } from "./commands.js";
import { redactText } from "../redaction.js";
import { mapPiToolPolicy } from "../runtime/pi-tool-policy.js";

const MAX_EVENTS = 200;
const MAX_PROMPT_HISTORY = 50;
const TOOL_APPROVAL_TTL_SECONDS = 5 * 60;

function appendEvent(state, event) {
  return { ...state, events: [...state.events, event].slice(-MAX_EVENTS) };
}

function appendPersistRequest(state, request) {
  return { ...state, persistRequests: [...(state.persistRequests ?? []), request] };
}

function appendEffectRequest(state, request) {
  return { ...state, effectRequests: [...(state.effectRequests ?? []), request] };
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
  if (directText !== undefined) return redactText(String(directText));

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
  if (event.type === "assistant_delta") return payload.delta ?? event.delta ?? "";
  if (event.type === "run_end") {
    const aborted = Boolean(firstDefined(event.aborted, payload.aborted, false));
    const ok = firstDefined(event.ok, payload.ok, !aborted);
    return `run ended · ${aborted ? "cancelled" : ok ? "success" : "error"}`;
  }
  return redactText(JSON.stringify(event));
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
    runtimeObserved: true,
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
    promptHistory: overrides.promptHistory ?? [],
    promptHistoryIndex: null,
    promptDraft: "",
    mode: overrides.mode ?? "ask",
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
    pendingToolApproval: overrides.pendingToolApproval ?? null,
    permissionMode: overrides.permissionMode ?? "ask",
    setupStatus: overrides.setupStatus ?? (runtime.provider === "default" || runtime.model === "default" ? { level: "needs-review", message: "Provider/model are not configured yet." } : { level: "ready", message: "Ready" }),
    lastPrompt: overrides.lastPrompt ?? null,
    persistRequests: overrides.persistRequests ?? [],
    effectRequests: overrides.effectRequests ?? [],
    transcript: overrides.transcript ?? { offset: 0, follow: true },
    commandSuggestions: overrides.commandSuggestions ?? [],
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


function classifyErrorMessage(error, state = {}) {
  const raw = error instanceof Error ? error.message : String(error ?? "Unknown error");
  const message = redactText(raw);
  const lower = message.toLowerCase();
  const missingKey = lower.includes("api_key") || lower.includes("api key") || lower.includes("apikey") || (lower.includes("missing") && lower.includes("key"));
  if (!missingKey) return message;
  return [
    message,
    "",
    "Recovery:",
    `  af config set provider ${state.provider && state.provider !== "default" ? state.provider : "<provider>"}`,
    `  af config set model ${state.model && state.model !== "default" ? state.model : "<model>"}`,
    "  af config set env.apiKey <PROVIDER_API_KEY_ENV>",
    "  export <PROVIDER_API_KEY_ENV>=...",
    "  af doctor",
  ].join("\n");
}

function createPendingToolApproval(tools, policy, now = new Date()) {
  const createdAt = now.toISOString();
  return {
    decisionId: `apr_tui_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    tools,
    policy,
    source: "tui-slash-command",
    scope: "session",
    createdAt,
    ttlSeconds: TOOL_APPROVAL_TTL_SECONDS,
    expiresAt: new Date(now.getTime() + TOOL_APPROVAL_TTL_SECONDS * 1000).toISOString(),
  };
}

function isPendingApprovalExpired(pending, now = Date.now()) {
  const expiresAt = Date.parse(pending?.expiresAt ?? "");
  return Number.isFinite(expiresAt) && now >= expiresAt;
}

function rememberPrompt(state, prompt) {
  const clean = String(prompt ?? "").trim();
  if (!clean) return { ...state, input: "", promptHistoryIndex: null, promptDraft: "" };
  const previous = state.promptHistory ?? [];
  const promptHistory = previous.at(-1) === clean ? previous : [...previous, clean].slice(-MAX_PROMPT_HISTORY);
  return { ...state, promptHistory, promptHistoryIndex: null, promptDraft: "", input: "" };
}

function recallPromptHistory(state, direction) {
  const history = state.promptHistory ?? [];
  if (!history.length) return state;
  if (direction === "prev") {
    const current = state.promptHistoryIndex;
    const nextIndex = current === null || current === undefined ? history.length - 1 : Math.max(0, current - 1);
    return {
      ...state,
      promptDraft: current === null || current === undefined ? state.input ?? "" : state.promptDraft,
      promptHistoryIndex: nextIndex,
      input: history[nextIndex],
    };
  }
  const current = state.promptHistoryIndex;
  if (current === null || current === undefined) return state;
  const nextIndex = current + 1;
  if (nextIndex >= history.length) return { ...state, promptHistoryIndex: null, input: state.promptDraft ?? "", promptDraft: "" };
  return { ...state, promptHistoryIndex: nextIndex, input: history[nextIndex] };
}

function submitPromptDraft(state, value, { readyOnly = true } = {}) {
  const clean = String(value ?? "").trim();
  if (!clean) return state;
  if (state.pendingToolApproval) {
    return appendEvent(state, { type: "error", text: `A pending tool approval must be handled before running a prompt. Use /approve-tools to allow ${state.pendingToolApproval.tools?.join(", ") || "requested tools"}, or change tools/mode before retrying.` });
  }
  const remembered = rememberPrompt(state, clean);
  return appendEvent({
    ...remembered,
    view: "workspace",
    goal: clean,
    intent: { prompt: clean },
    lastPrompt: clean,
    input: "",
    status: readyOnly ? "ready-to-run" : "idle",
    terminalState: "idle",
    cancelling: false,
    cancelled: false,
    error: null,
    action: readyOnly ? "ready to run" : "ready",
    tasks: [],
  }, { type: "user", text: clean });
}

function applyToolRequest(state, tools = []) {
  const requested = Array.isArray(tools) ? tools : [];
  const policy = mapPiToolPolicy({ allow: requested, mode: state.permissionMode, workspace: state.cwd, approved: true });
  if (!policy.ok) {
    return appendEvent({ ...state, pendingToolApproval: null }, { type: "error", text: `Tool request denied: ${policy.reason}` });
  }
  if (policy.requiresApproval) {
    const pending = createPendingToolApproval(requested, policy);
    const withPending = appendPersistRequest({ ...state, pendingToolApproval: pending }, { kind: "approval", status: "ask", decision: pending, sessionId: state.session?.id });
    return appendEvent(withPending, { type: "permission_request", text: `Tool request requires approval: ${requested.join(", ") || "none"}. Run /approve-tools to allow for this session.` });
  }
  return appendEvent({ ...state, tools: requested, pendingToolApproval: null }, { type: "tool", text: `runtime tools enabled: ${requested.join(", ") || "none"}` });
}

export function reducer(state, action) {
  switch (action.type) {
    case "SET_INPUT":
      return { ...state, input: action.value, commandSuggestions: commandSuggestions(action.value), ...(action.fromHistory ? {} : { promptHistoryIndex: null }) };
    case "COMPLETE_INPUT": {
      const suggestion = state.commandSuggestions?.[0];
      if (!suggestion) return state;
      const value = `/${suggestion.command} `;
      return { ...state, input: value, commandSuggestions: commandSuggestions(value), promptHistoryIndex: null };
    }
    case "SCROLL_TRANSCRIPT": {
      const amount = Number.isInteger(action.amount) ? action.amount : 5;
      if (action.direction === "latest") return { ...state, transcript: { offset: 0, follow: true } };
      const current = state.transcript?.offset ?? 0;
      const maxOffset = Math.max(0, (state.events?.length ?? 0) - 1);
      const nextOffset = action.direction === "up" ? Math.min(maxOffset, current + amount) : Math.max(0, current - amount);
      return { ...state, transcript: { offset: nextOffset, follow: nextOffset === 0 } };
    }
    case "PROMPT_HISTORY_PREV":
      return recallPromptHistory(state, "prev");
    case "PROMPT_HISTORY_NEXT":
      return recallPromptHistory(state, "next");
    case "SUBMIT_PROMPT":
      return submitPromptDraft(state, action.value, { readyOnly: true });
    case "SUBMIT_HOME":
      return {
        ...rememberPrompt(state, action.value),
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
        ...rememberPrompt(state, action.prompt),
        view: "workspace",
        goal: action.prompt ?? state.goal,
        intent: action.prompt ? { prompt: action.prompt } : state.intent,
        lastPrompt: action.prompt ?? state.lastPrompt,
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
      const message = classifyErrorMessage(action.error, state);
      return appendEvent({ ...state, status: "error", terminalState: "error", action: "error", activeRun: null, cancelling: false, error: message }, { type: "error", text: message });
    }
    case "RUNTIME_EVENT":
      return applyRuntimeEvent(state, action.event);
    case "EFFECT_RESULT":
      return appendEvent(state, { type: action.result?.ok === false ? "error" : "assistant", text: action.result?.text ?? "Effect completed." });
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

  if (event.type === "assistant_delta") {
    const delta = event.payload?.delta ?? event.delta ?? "";
    const lastIndex = next.events.length - 1;
    const last = lastIndex >= 0 ? next.events[lastIndex] : null;
    if (last && (last.type === "assistant" || last.type === "assistant_delta")) {
      const mergedText = (last.text ?? last.payload?.text ?? "") + delta;
      const merged = { ...last, text: mergedText, payload: { ...(last.payload ?? {}), text: mergedText } };
      next = { ...next, events: [...next.events.slice(0, lastIndex), merged] };
    } else {
      next = appendEvent(next, { ...event, type: "assistant", text: delta, payload: { ...(event.payload ?? {}), text: delta } });
    }
    const runtimeSession = sessionFromRuntimeEvent(next.session, event);
    if (runtimeSession) {
      next = { ...next, session: runtimeSession, sessions: upsertSession(next.sessions, runtimeSession) };
    }
    const evidence = evidenceFromRuntimeEvent(event);
    if (evidence.length) next = { ...next, evidence: [...next.evidence, ...evidence] };
    return next;
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
    case "stats": {
      if (state.runtimeStats) {
        const stats = state.runtimeStats;
        const parts = [
          `tokens ${state.tokenUsage.tokens}`,
          `${state.tokenUsage.percent}%`,
          state.tokenUsage.cost,
          ...(stats.runs !== undefined ? [`runs ${stats.runs}`] : []),
          ...(stats.completed !== undefined ? [`completed ${stats.completed}`] : []),
          ...(stats.failed !== undefined ? [`failed ${stats.failed}`] : []),
          ...(stats.aborted !== undefined ? [`aborted ${stats.aborted}`] : []),
        ];
        return appendEvent(state, { type: "stats", text: `runtime stats observed: ${parts.join(" · ")}` });
      }
      return appendEvent(state, { type: "stats", text: `local TUI counters: tokens ${state.tokenUsage.tokens} · ${state.tokenUsage.percent}% · ${state.tokenUsage.cost}; no runtime stats observed yet` });
    }
    case "tools":
      return applyToolRequest(state, command.tools ?? []);
    case "approve-tools": {
      if (!state.pendingToolApproval) return appendEvent(state, { type: "assistant", text: "No pending tool request to approve." });
      if (isPendingApprovalExpired(state.pendingToolApproval)) {
        return appendEvent({ ...state, pendingToolApproval: null }, { type: "permission_decision", text: "Pending tool approval expired. Run /tools again to request a fresh approval." });
      }
      const tools = state.pendingToolApproval.tools ?? [];
      const payload = {
        decisionId: state.pendingToolApproval.decisionId,
        status: "allow",
        tools,
        source: state.pendingToolApproval.source,
        scope: state.pendingToolApproval.scope,
        createdAt: state.pendingToolApproval.createdAt,
        expiresAt: state.pendingToolApproval.expiresAt,
      };
      const withApproval = appendPersistRequest({ ...state, tools, pendingToolApproval: null }, { kind: "approval", status: "allow", decision: payload, sessionId: state.session?.id });
      return appendEvent(withApproval, { type: "permission_decision", payload, text: `approved runtime tools for this session: ${tools.join(", ") || "none"}` });
    }
    case "mode": {
      const mode = String(command.mode ?? "").toLowerCase();
      if (!["plan", "ask", "act", "auto"].includes(mode)) return appendEvent(state, { type: "error", text: "Unsupported mode. Use one of: plan, ask, act, auto." });
      return appendEvent({ ...state, permissionMode: mode, tools: [], pendingToolApproval: null }, { type: "assistant", text: `tool permission mode set to ${mode}; runtime tools reset until requested again` });
    }
    case "session": {
      const knownCount = state.sessions.length;
      const source = state.session.runtimeObserved ? "runtime-observed" : "durable";
      return appendEvent(state, { type: "session", text: `${source} session ${state.session.id} · ${state.events.length} visible events · ${knownCount} known sessions` });
    }
    case "new": {
      const session = createSession();
      const next = { ...state, view: "workspace", goal: "", intent: null, session, sessions: upsertSession(state.sessions, session), events: [], status: "idle", terminalState: "idle", action: "new session", activeRun: null, evidence: [], tools: [], pendingToolApproval: null };
      return appendEvent(appendPersistRequest(next, { kind: "session", session }), { type: "session", text: `started durable session ${session.id}` });
    }
    case "doctor":
      return appendEvent(appendEffectRequest(state, { kind: "doctor" }), { type: "assistant", text: "Running AlphaFoundry doctor... Config checks included. For the full report, exit and run af doctor." });
    case "retry": {
      if (!state.lastPrompt) return appendEvent(state, { type: "assistant", text: "No previous prompt to retry." });
      return appendEvent({ ...state, input: state.lastPrompt, status: "ready-to-run", action: "retry queued", view: "workspace", intent: { prompt: state.lastPrompt } }, { type: "assistant", text: `Retry queued: ${state.lastPrompt}` });
    }
    case "sessions":
      return appendEvent(state, { type: "session", text: `Known TUI sessions:\n${(state.sessions ?? []).map((session) => `- ${session.id}${session.title ? ` · ${session.title}` : ""}`).join("\n") || "none"}` });
    case "replay":
      return appendEvent(appendEffectRequest(state, { kind: "replay", sessionId: state.session?.id }), { type: "assistant", text: `Visible replay requested; replaying durable session ${state.session?.id ?? "unknown"}...` });
    case "eval":
      return appendEvent(appendEffectRequest(state, { kind: "eval", sessionId: state.session?.id }), { type: "assistant", text: `Visible eval requested; evaluating durable session ${state.session?.id ?? "unknown"}...` });
    case "export":
      return appendEvent(state, { type: "assistant", text: `Visible transcript:\n${state.events.map((event) => `[${event.type}] ${exportedEventText(event)}`).join("\n") || "Nothing to print."}` });
    case "unknown":
      return appendEvent(state, { type: "error", text: `Unknown command /${command.command}. Try /help.` });
    default:
      return state;
  }
}
