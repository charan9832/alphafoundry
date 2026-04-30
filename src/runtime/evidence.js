import { randomUUID } from "node:crypto";
import { redactUnknown } from "../redaction.js";

export const EVIDENCE_SCHEMA_VERSION = 1;
export const VERIFIER_STATUSES = Object.freeze(["PASS", "WARN", "FAIL"]);

const STATUS_SET = new Set(VERIFIER_STATUSES);

function createEvidenceId(prefix) {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

function normalizeStatus(status) {
  const normalized = String(status ?? "").toUpperCase();
  if (!STATUS_SET.has(normalized)) throw new TypeError(`Unsupported verifier status: ${status ?? "<missing>"}`);
  return normalized;
}

function requireNonEmptyString(value, message) {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(message);
  return value;
}

export function createEvidence(input = {}) {
  const title = requireNonEmptyString(input.title, "evidence title must be a non-empty string");
  const kind = requireNonEmptyString(input.kind, "evidence kind must be a non-empty string");
  return redactUnknown({
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    evidenceId: input.id ?? createEvidenceId("evd"),
    kind,
    title,
    ...(input.summary ? { summary: input.summary } : {}),
    ...(input.uri ? { uri: input.uri } : {}),
    ...(input.data !== undefined ? { data: input.data } : {}),
    timestamp: input.timestamp ?? new Date().toISOString(),
  });
}

export function createVerifierResult(input = {}) {
  const name = requireNonEmptyString(input.name, "verifier name must be a non-empty string");
  return redactUnknown({
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    verifierId: input.id ?? createEvidenceId("ver"),
    name,
    status: normalizeStatus(input.status),
    ...(input.summary ? { summary: input.summary } : {}),
    ...(input.evidence ? { evidence: input.evidence } : {}),
    ...(input.runId ? { runId: input.runId } : {}),
    timestamp: input.timestamp ?? new Date().toISOString(),
  });
}

export function summarizeVerifierResults(results = [], options = {}) {
  const normalizedResults = results.map((result) => createVerifierResult(result));
  const counts = { PASS: 0, WARN: 0, FAIL: 0 };
  for (const result of normalizedResults) counts[result.status] += 1;
  const status = counts.FAIL > 0 ? "FAIL" : counts.WARN > 0 ? "WARN" : "PASS";
  return redactUnknown({
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    status,
    counts,
    results: normalizedResults,
    ...(options.runId ? { runId: options.runId } : {}),
    timestamp: options.timestamp ?? new Date().toISOString(),
  });
}
