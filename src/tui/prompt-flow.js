export function normalizeResultEvents(result) {
  if (!result) return [{ type: "assistant", text: "No output." }];
  if (Array.isArray(result.events)) return result.events;
  return [{ type: result.ok === false ? "error" : "assistant", text: result.output?.trim() || result.error || "No output." }];
}

export async function runPromptWithEvents(runner, prompt, options, onEvent) {
  const result = await runner(prompt, { ...options, onEvent });
  if (result && typeof result[Symbol.asyncIterator] === "function") {
    for await (const event of result) onEvent(event);
    return { ok: true };
  }
  // Streaming adapter already emitted events inline via onEvent during the run.
  // Events in result.events are the same array — re-emitting them would double
  // every event in the TUI. Only emit synthetic events for non-streaming results.
  if (!result || !Array.isArray(result.events) || result.events.length === 0) {
    for (const event of normalizeResultEvents(result)) onEvent(event);
  }
  return result ?? { ok: true };
}
