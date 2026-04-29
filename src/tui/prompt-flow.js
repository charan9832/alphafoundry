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
  for (const event of normalizeResultEvents(result)) onEvent(event);
  return result ?? { ok: true };
}
