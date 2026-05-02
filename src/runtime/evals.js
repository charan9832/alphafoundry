import { replaySession } from "./replay.js";
import { redactUnknown } from "../redaction.js";

export const EVAL_SCHEMA_VERSION = 1;
export const EVAL_STATUSES = Object.freeze(["PASS", "WARN", "FAIL"]);

function check(name, status, details = {}) {
  return redactUnknown({ name, status, ...details });
}

function combine(checks) {
  if (checks.some((item) => item.status === "FAIL")) return "FAIL";
  if (checks.some((item) => item.status === "WARN")) return "WARN";
  return "PASS";
}

function equalJson(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export function compareSummaries(left, right) {
  const checks = [
    check("terminalStatus", left.status === right.status ? "PASS" : "FAIL", {
      left: left.status,
      right: right.status,
    }),
    check("eventTotal", left.eventTotal === right.eventTotal ? "PASS" : "FAIL", {
      left: left.eventTotal,
      right: right.eventTotal,
    }),
    check("eventCounts", equalJson(left.eventCounts, right.eventCounts) ? "PASS" : "FAIL", {
      left: left.eventCounts,
      right: right.eventCounts,
    }),
    check("assistantTextLength", left.assistant?.textLength === right.assistant?.textLength ? "PASS" : "WARN", {
      left: left.assistant?.textLength ?? 0,
      right: right.assistant?.textLength ?? 0,
    }),
    check("assistantTextDigest", left.assistant?.textDigest === right.assistant?.textDigest ? "PASS" : "WARN", {
      left: left.assistant?.textDigest ?? null,
      right: right.assistant?.textDigest ?? null,
    }),
    check("toolCallCount", left.toolCallCount === right.toolCallCount ? "PASS" : "FAIL", {
      left: left.toolCallCount,
      right: right.toolCallCount,
    }),
    check("toolResultCount", left.toolResultCount === right.toolResultCount ? "PASS" : "FAIL", {
      left: left.toolResultCount,
      right: right.toolResultCount,
    }),
    check("errorCount", left.errorCount === right.errorCount ? "PASS" : "FAIL", {
      left: left.errorCount,
      right: right.errorCount,
    }),
  ];

  return redactUnknown({
    schemaVersion: EVAL_SCHEMA_VERSION,
    kind: "summary-comparison",
    leftSessionId: left.sessionId,
    rightSessionId: right.sessionId,
    overall: combine(checks),
    checks,
  });
}

export function evaluateSession(store, sessionId) {
  const summary = replaySession(store, sessionId);
  const checks = [
    check("hasEvents", summary.eventTotal > 0 ? "PASS" : "FAIL", { eventTotal: summary.eventTotal }),
    check("completed", summary.status === "success" ? "PASS" : "FAIL", { observedStatus: summary.status }),
    check("noErrors", summary.errorCount === 0 ? "PASS" : "FAIL", { errorCount: summary.errorCount }),
    check("hasAssistantResponse", summary.assistant.textLength > 0 ? "PASS" : "WARN", {
      textLength: summary.assistant.textLength,
      textDigest: summary.assistant.textDigest,
    }),
    check("toolResultsBalanced", summary.toolResultCount >= summary.toolCallCount ? "PASS" : "FAIL", {
      toolCallCount: summary.toolCallCount,
      toolResultCount: summary.toolResultCount,
    }),
  ];

  return redactUnknown({
    schemaVersion: EVAL_SCHEMA_VERSION,
    kind: "session-evaluation",
    sessionId: summary.sessionId,
    overall: combine(checks),
    summary,
    checks,
  });
}
