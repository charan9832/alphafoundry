import { createRuntimeId } from "./events.js";
import { createSessionStore } from "./session-store.js";
import { piResultToEvents, runPiAdapterPrompt, runPiAdapterPromptStreaming } from "./adapters/pi.js";
import { redactUnknown } from "../redaction.js";

function mockPromptResult(prompt) {
  return { ok: true, status: 0, output: `AlphaFoundry mock adapter response: ${prompt}`, error: "", cappedBytes: 0 };
}

export async function runPrompt(options = {}) {
  const prompt = options.prompt;
  if (typeof prompt !== "string" || prompt.length === 0) {
    throw new TypeError("run prompt must be a non-empty string");
  }

  const adapter = options.adapter ?? options.env?.ALPHAFOUNDRY_RUNTIME_ADAPTER ?? process.env.ALPHAFOUNDRY_RUNTIME_ADAPTER ?? "pi";
  const store = options.store ?? createSessionStore({ env: options.env ?? process.env });
  const session = options.session ?? store.createSession({
    cwd: options.cwd ?? process.cwd(),
    title: options.title ?? prompt.slice(0, 80),
    adapter,
  });
  const runId = options.runId ?? createRuntimeId("run");
  const onEvent = options.onEvent;

  if (adapter === "mock") {
    const result = mockPromptResult(prompt);
    const events = piResultToEvents({
      sessionId: session.id,
      runId,
      prompt,
      provider: options.provider ?? "default",
      model: options.model ?? "default",
      result,
    });
    for (const event of events) {
      store.appendEvent(session.id, event);
      onEvent?.(event);
    }
    return redactUnknown({ session: store.readSession(session.id).manifest, runId, result, events });
  }

  if (onEvent) {
    const result = await runPiAdapterPromptStreaming({
      prompt,
      provider: options.provider,
      model: options.model,
      env: options.runtimeEnv,
      processEnv: options.env,
      maxOutputBytes: options.maxOutputBytes,
      toolProfile: options.toolProfile,
      toolAllow: options.toolAllow,
      permissionMode: options.permissionMode,
      path: options.path,
      workspace: options.cwd ?? process.cwd(),
      alphaFoundryHome: options.env?.ALPHAFOUNDRY_HOME,
      home: options.env?.HOME,
      sessionId: session.id,
      runId,
      onEvent: (event) => {
        store.appendEvent(session.id, event);
        onEvent(event);
      },
      signal: options.signal,
    });
    return redactUnknown({ session: store.readSession(session.id).manifest, runId, result });
  }

  const result = adapter === "mock"
    ? mockPromptResult(prompt)
    : await runPiAdapterPrompt({
      prompt,
      provider: options.provider,
      model: options.model,
      env: options.runtimeEnv,
      processEnv: options.env,
      maxOutputBytes: options.maxOutputBytes,
      toolProfile: options.toolProfile,
      toolAllow: options.toolAllow,
      permissionMode: options.permissionMode,
      path: options.path,
      workspace: options.cwd ?? process.cwd(),
      alphaFoundryHome: options.env?.ALPHAFOUNDRY_HOME,
      home: options.env?.HOME,
    });

  const events = piResultToEvents({
    sessionId: session.id,
    runId,
    prompt,
    provider: options.provider ?? "default",
    model: options.model ?? "default",
    result,
  }).map((event) => store.appendEvent(session.id, event));

  return redactUnknown({ session: store.readSession(session.id).manifest, runId, result, events });
}
