import { resolveRuntimeConfig } from "../config.js";
import { createSessionStore } from "../runtime/session-store.js";
import { runPrompt } from "../runtime/runner.js";
import { redactText } from "../redaction.js";

export function classifyRuntimeError(error, { provider, model } = {}) {
  const raw = error instanceof Error ? error.message : String(error ?? "Unknown runtime error");
  const message = redactText(raw);
  const lower = message.toLowerCase();
  const missingCredential = lower.includes("api_key") || lower.includes("api key") || lower.includes("apikey") || lower.includes("missing") && lower.includes("key");
  if (missingCredential) {
    return [
      message,
      "",
      "Recovery:",
      `  af config set provider ${provider && provider !== "default" ? provider : "<provider>"}`,
      `  af config set model ${model && model !== "default" ? model : "<model>"}`,
      "  af config set env.apiKey <PROVIDER_API_KEY_ENV>",
      "  export <PROVIDER_API_KEY_ENV>=...",
      "  af doctor",
    ].join("\n");
  }
  return message;
}

function ensureSession(store, session, options = {}) {
  if (session?.id) {
    try {
      return store.readSession(session.id).manifest;
    } catch {
      return store.createSession({
        id: session.id,
        title: session.title ?? options.title,
        cwd: session.cwd ?? options.cwd,
        adapter: options.adapter,
      });
    }
  }
  return store.createSession({ title: options.title, cwd: options.cwd, adapter: options.adapter });
}

export async function createRuntimeRunner(options = {}) {
  return async function alphaFoundryTuiRunner(prompt, runOptions = {}) {
    const env = runOptions.env ?? options.env ?? process.env;
    const runtimeConfig = resolveRuntimeConfig(
      { provider: runOptions.provider, model: runOptions.model },
      { env },
    );
    const adapter = runOptions.adapter ?? env.ALPHAFOUNDRY_RUNTIME_ADAPTER ?? options.adapter ?? "pi";
    const store = runOptions.store ?? options.store ?? createSessionStore({ env });
    const session = ensureSession(store, runOptions.session, {
      title: prompt.slice(0, 80),
      cwd: runOptions.cwd ?? options.cwd ?? process.cwd(),
      adapter,
    });

    try {
      return await runPrompt({
        prompt,
        provider: runtimeConfig.provider,
        model: runtimeConfig.model,
        runtimeEnv: runtimeConfig.env,
        cwd: runOptions.cwd ?? options.cwd ?? process.cwd(),
        env,
        adapter,
        store,
        session,
        toolProfile: runOptions.toolProfile,
        toolAllow: runOptions.toolAllow,
        permissionMode: runOptions.permissionMode,
        toolsApproved: runOptions.toolsApproved,
        path: runOptions.path,
        signal: runOptions.signal,
        onEvent: runOptions.onEvent,
      });
    } catch (error) {
      throw new Error(classifyRuntimeError(error, runtimeConfig));
    }
  };
}
