import { runPiPrompt } from "../../pi-backend.js";
import { createRuntimeEvent } from "../events.js";
import { runPiPromptJsonStream } from "./pi-stream.js";

export function piResultToEvents({ sessionId, runId, prompt, provider = "default", model = "default", result, timestamp } = {}) {
  const common = { sessionId, runId, timestamp };
  const events = [
    createRuntimeEvent("run_start", {
      ...common,
      payload: { adapter: "pi", provider, model, prompt },
    }),
    createRuntimeEvent("user", {
      ...common,
      payload: { text: prompt },
    }),
  ];

  if (result?.output) {
    events.push(createRuntimeEvent("assistant", { ...common, payload: { text: result.output } }));
  }
  if (result?.error) {
    events.push(createRuntimeEvent(result.ok ? "stderr" : "error", { ...common, payload: { text: result.error, error: result.error } }));
  }

  events.push(createRuntimeEvent("run_end", {
    ...common,
    payload: {
      ok: Boolean(result?.ok),
      exitCode: result?.status ?? result?.exitCode ?? null,
      cappedBytes: result?.cappedBytes ?? 0,
      adapter: "pi",
    },
  }));
  return events;
}

export async function runPiAdapterPrompt({ prompt, provider, model, env, processEnv, maxOutputBytes } = {}) {
  return runPiPrompt(prompt, { provider, model, env, processEnv, maxOutputBytes });
}

export async function runPiAdapterPromptStreaming(options = {}) {
  return runPiPromptJsonStream(options.prompt, options);
}
