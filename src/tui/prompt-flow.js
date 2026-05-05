export function normalizeResultEvents(result) {
  if (!result) return [{ type: "assistant", text: "No output." }];
  if (Array.isArray(result.events)) return result.events;
  return [{ type: result.ok === false ? "error" : "assistant", text: result.output?.trim() || result.error || "No output." }];
}

export async function runPromptWithEvents(runner, prompt, options, onEvent) {
  let emittedInline = false;
  const emit = (event) => {
    emittedInline = true;
    onEvent(event);
  };

  const result = await runner(prompt, { ...options, onEvent: emit });
  if (result && typeof result[Symbol.asyncIterator] === "function") {
    for await (const event of result) emit(event);
    return { ok: true };
  }
  // Streaming adapters emit events inline via onEvent during the run. Some
  // wrappers return those events nested or omit top-level events entirely, so
  // checking result.events is not enough. If anything emitted inline, do not
  // synthesize fallback output such as "No output." after the run.
  if (!emittedInline) {
    for (const event of normalizeResultEvents(result)) emit(event);
  }
  return result ?? { ok: true };
}
