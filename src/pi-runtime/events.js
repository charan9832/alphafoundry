export const PI_RUNTIME_EVENT_TYPES = Object.freeze([
  "run_start",
  "stdout",
  "stderr",
  "assistant",
  "command",
  "error",
  "run_end",
  "aborted",
  "stats",
  "tool",
  "session",
]);

const TYPE_SET = new Set(PI_RUNTIME_EVENT_TYPES);

export function isPiRuntimeEventType(type) {
  return TYPE_SET.has(type);
}

export function createEventBus() {
  const listeners = new Set();

  return {
    emit(event) {
      if (!event || !isPiRuntimeEventType(event.type)) {
        throw new TypeError(`Unknown runtime event type: ${event?.type ?? "<missing>"}`);
      }
      const enriched = {
        timestamp: new Date().toISOString(),
        ...event,
      };
      for (const listener of [...listeners]) {
        listener(enriched);
      }
      return enriched;
    },

    subscribe(listener) {
      if (typeof listener !== "function") {
        throw new TypeError("Runtime event listener must be a function");
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    clear() {
      listeners.clear();
    },
  };
}

export function byteLength(value) {
  return Buffer.byteLength(String(value ?? ""));
}

export function takeBytes(value, maxBytes) {
  const text = String(value ?? "");
  if (maxBytes <= 0 || text.length === 0) return "";
  if (byteLength(text) <= maxBytes) return text;

  let kept = "";
  let used = 0;
  for (const char of text) {
    const size = byteLength(char);
    if (used + size > maxBytes) break;
    kept += char;
    used += size;
  }
  return kept;
}
