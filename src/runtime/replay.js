import { createHash } from "node:crypto";
import { redactUnknown } from "../redaction.js";

function sha256(text) {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

export function replaySession(store, sessionId) {
  const { manifest, events } = store.readSession(sessionId);

  const eventCounts = {};
  let assistantText = "";
  let toolCallCount = 0;
  let toolResultCount = 0;
  let errorCount = 0;
  let runStartTimestamp = null;
  let runEndTimestamp = null;

  for (const event of events) {
    const type = event.type;
    eventCounts[type] = (eventCounts[type] ?? 0) + 1;

    if (type === "assistant" || type === "assistant_delta") {
      const text = redactUnknown(event.payload?.text ?? "");
      assistantText += text;
    } else if (type === "tool_call") {
      toolCallCount += 1;
    } else if (type === "tool_result") {
      toolResultCount += 1;
    } else if (type === "error") {
      errorCount += 1;
    }

    if (type === "run_start" && event.timestamp) {
      runStartTimestamp = event.timestamp;
    } else if (type === "run_end" && event.timestamp) {
      runEndTimestamp = event.timestamp;
    }
  }

  let durationMs = null;
  if (runStartTimestamp && runEndTimestamp) {
    const start = Date.parse(runStartTimestamp);
    const end = Date.parse(runEndTimestamp);
    if (!Number.isNaN(start) && !Number.isNaN(end)) {
      durationMs = end - start;
    }
  }

  const redactedText = redactUnknown(assistantText);

  return redactUnknown({
    sessionId: manifest.id,
    status: manifest.status ?? "unknown",
    eventTotal: events.length,
    eventCounts,
    assistant: {
      textLength: redactedText.length,
      textDigest: redactedText.length > 0 ? sha256(redactedText) : "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    },
    toolCallCount,
    toolResultCount,
    errorCount,
    durationMs,
    redacted: true,
  });
}
