import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { join, normalize, basename } from "node:path";
import { dataDir } from "../paths.js";
import { redactUnknown } from "../redaction.js";

export const APPROVAL_DECISION_SCHEMA_VERSION = 1;
export const APPROVAL_STATUSES = Object.freeze(["allow", "deny", "ask", "pending", "expired"]);

const STATUS_SET = new Set(APPROVAL_STATUSES);

function createDecisionId() {
  return `apr_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
}

function normalizeStatus(status) {
  const normalized = String(status ?? "").toLowerCase();
  if (!STATUS_SET.has(normalized)) throw new TypeError(`Unsupported approval status: ${status ?? "<missing>"}`);
  return normalized;
}

function decisionPath(root, decisionId) {
  if (typeof decisionId !== "string" || decisionId.length === 0 || decisionId !== basename(decisionId)) {
    throw new Error(`Invalid approval decision id: ${decisionId ?? "<missing>"}`);
  }
  return join(root, `${decisionId}.json`);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(redactUnknown(value), null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

function isExpired(decision, now = Date.now()) {
  if (decision.expired) return true;
  if (decision.ttlSeconds !== undefined && decision.ttlSeconds !== null) {
    const created = new Date(decision.createdAt).getTime();
    if (Number.isFinite(created) && now > created + decision.ttlSeconds * 1000) {
      return true;
    }
  }
  return false;
}

function withExpiration(decision, now = Date.now()) {
  if (decision.status === "expired") return decision;
  if (isExpired(decision, now)) {
    return {
      ...decision,
      status: "expired",
      expired: true,
      expiredAt: new Date(now).toISOString(),
    };
  }
  return decision;
}

function validatePath(value) {
  if (typeof value !== "string") return true;
  if (value.includes("..") || value.startsWith("/") || /^[A-Za-z]:/.test(value)) {
    throw new TypeError(`Invalid path: ${value}`);
  }
  return true;
}

export function createApprovalStore(options = {}) {
  const root = normalize(options.root ?? join(dataDir(options.env ?? process.env), "approvals"));

  function ensureRoot() {
    mkdirSync(root, { recursive: true, mode: 0o700 });
  }

  function readDecision(decisionId) {
    const path = decisionPath(root, decisionId);
    if (!existsSync(path)) throw new Error(`Unknown approval decision: ${decisionId}`);
    return readJson(path);
  }

  function writeDecision(decision) {
    writeJson(decisionPath(root, decision.decisionId), decision);
    return decision;
  }

  return {
    root,

    create(input = {}) {
      ensureRoot();
      const status = normalizeStatus(input.status);
      if (input.path) validatePath(input.path);
      const now = input.timestamp ?? new Date().toISOString();
      const decision = redactUnknown({
        schemaVersion: APPROVAL_DECISION_SCHEMA_VERSION,
        decisionId: input.id ?? createDecisionId(),
        status,
        toolName: input.toolName ?? null,
        risk: input.risk ?? null,
        path: input.path ?? null,
        sessionId: input.sessionId ?? null,
        runId: input.runId ?? null,
        workspace: input.workspace ?? null,
        reason: input.reason ?? "",
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
        ...(input.ttlSeconds !== undefined ? { ttlSeconds: input.ttlSeconds } : {}),
        timestamp: now,
        createdAt: now,
        expired: false,
      });
      return writeDecision(decision);
    },

    read(decisionId) {
      const decision = readDecision(decisionId);
      const updated = withExpiration(decision);
      if (updated.expired && !decision.expired) {
        writeDecision(updated);
      }
      return updated;
    },

    list(filter = {}) {
      ensureRoot();
      const now = Date.now();
      let decisions = readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map((entry) => {
          try {
            const decision = readJson(join(root, entry.name));
            const updated = withExpiration(decision, now);
            if (updated.expired && !decision.expired) {
              writeDecision(updated);
            }
            return updated;
          } catch {
            return null;
          }
        })
        .filter(Boolean)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

      if (filter.sessionId) {
        decisions = decisions.filter((d) => d.sessionId === filter.sessionId);
      }
      if (filter.runId) {
        decisions = decisions.filter((d) => d.runId === filter.runId);
      }
      if (filter.status) {
        decisions = decisions.filter((d) => d.status === filter.status);
      }

      return decisions;
    },

    expire(decisionId) {
      const decision = readDecision(decisionId);
      if (decision.status === "expired") return withExpiration(decision);
      const expired = {
        ...decision,
        status: "expired",
        expired: true,
        expiredAt: new Date().toISOString(),
      };
      return writeDecision(expired);
    },

    export(options = {}) {
      ensureRoot();
      const decisions = this.list(options);
      const counts = { allow: 0, deny: 0, ask: 0, pending: 0, expired: 0 };
      for (const d of decisions) counts[d.status] = (counts[d.status] ?? 0) + 1;

      if (options.format === "ndjson") {
        return decisions.map((d) => JSON.stringify(redactUnknown(d))).join("\n") + "\n";
      }

      return redactUnknown({
        schemaVersion: APPROVAL_DECISION_SCHEMA_VERSION,
        decisions,
        counts,
        timestamp: new Date().toISOString(),
      });
    },
  };
}
