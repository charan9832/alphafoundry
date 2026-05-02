import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  APPROVAL_DECISION_SCHEMA_VERSION,
  APPROVAL_STATUSES,
  DEFAULT_APPROVAL_TTL_SECONDS,
  MAX_APPROVAL_TTL_SECONDS,
  createApprovalStore,
} from "../src/runtime/approval-store.js";

function tempHome() {
  return mkdtempSync(join(tmpdir(), "af-approval-"));
}

test("approval statuses are stable and explicit", () => {
  assert.deepEqual(APPROVAL_STATUSES, Object.freeze(["allow", "deny", "ask", "pending", "expired"]));
});

test("create persists a schema-versioned redacted decision", () => {
  const home = tempHome();
  try {
    const store = createApprovalStore({ env: { ALPHAFOUNDRY_HOME: home } });
    const decision = store.create({
      id: "apr_test1",
      status: "allow",
      toolName: "read_file",
      risk: "read",
      path: "src/index.js",
      sessionId: "ses_test",
      runId: "run_test",
      reason: "token=sk-secret1234567890",
      metadata: { apiKey: "sk-secret1234567890" },
      timestamp: "2026-01-01T00:00:00.000Z",
    });

    assert.equal(decision.schemaVersion, APPROVAL_DECISION_SCHEMA_VERSION);
    assert.equal(decision.decisionId, "apr_test1");
    assert.equal(decision.status, "allow");
    assert.equal(decision.toolName, "read_file");
    assert.equal(decision.risk, "read");
    assert.equal(decision.sessionId, "ses_test");
    assert.equal(decision.runId, "run_test");
    assert.equal(decision.reason, "token=[REDACTED_SECRET]");
    assert.equal(decision.metadata.apiKey, "[REDACTED_SECRET]");
    assert.equal(decision.timestamp, "2026-01-01T00:00:00.000Z");
    assert.ok(decision.createdAt);
    assert.equal(decision.expired, false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("approval decisions get default ttl expiresAt and stable scope metadata", () => {
  const home = tempHome();
  try {
    const store = createApprovalStore({ env: { ALPHAFOUNDRY_HOME: home } });
    const decision = store.create({
      status: "allow",
      tools: ["write", "bash"],
      source: "tui-slash-command",
      approvedBy: "local-user",
      scope: "session",
      timestamp: "2026-01-01T00:00:00.000Z",
    });

    assert.equal(decision.ttlSeconds, DEFAULT_APPROVAL_TTL_SECONDS);
    assert.equal(decision.expiresAt, "2026-01-01T00:15:00.000Z");
    assert.equal(decision.source, "tui-slash-command");
    assert.equal(decision.approvedBy, "local-user");
    assert.equal(decision.scope, "session");
    assert.deepEqual(decision.tools, ["write", "bash"]);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("deny and ask decisions do not receive default ttl", () => {
  const home = tempHome();
  try {
    const store = createApprovalStore({ env: { ALPHAFOUNDRY_HOME: home } });
    const deny = store.create({ status: "deny", toolName: "rm" });
    const ask = store.create({ status: "ask", toolName: "write" });
    assert.equal(deny.ttlSeconds, undefined);
    assert.equal(deny.expiresAt, undefined);
    assert.equal(ask.ttlSeconds, undefined);
    assert.equal(ask.expiresAt, undefined);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("approval ttl scope and grantable tool metadata validate fail closed", () => {
  const home = tempHome();
  try {
    const store = createApprovalStore({ env: { ALPHAFOUNDRY_HOME: home } });
    assert.throws(() => store.create({ status: "allow" }), /require a toolName or tools list/);
    assert.throws(() => store.create({ status: "pending" }), /require a toolName or tools list/);
    assert.throws(() => store.create({ status: "allow", toolName: "write", scope: "forever" }), /Unsupported approval scope/);
    assert.throws(() => store.create({ status: "allow", toolName: "write", ttlSeconds: -1 }), /Invalid approval ttlSeconds/);
    assert.throws(() => store.create({ status: "allow", toolName: "write", ttlSeconds: MAX_APPROVAL_TTL_SECONDS + 1 }), /Invalid approval ttlSeconds/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("create auto-generates id and timestamp when omitted", () => {
  const home = tempHome();
  try {
    const store = createApprovalStore({ env: { ALPHAFOUNDRY_HOME: home } });
    const decision = store.create({ status: "deny", toolName: "rm", risk: "destructive" });

    assert.ok(decision.decisionId.startsWith("apr_"));
    assert.ok(decision.createdAt);
    assert.ok(new Date(decision.createdAt).toISOString());
    assert.equal(decision.status, "deny");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("create rejects invalid status", () => {
  const home = tempHome();
  try {
    const store = createApprovalStore({ env: { ALPHAFOUNDRY_HOME: home } });
    assert.throws(() => store.create({ status: "bypass" }), /Unsupported approval status/);
    assert.throws(() => store.create({ status: "" }), /Unsupported approval status/);
    assert.throws(() => store.create({}), /Unsupported approval status/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("read returns persisted decision", () => {
  const home = tempHome();
  try {
    const store = createApprovalStore({ env: { ALPHAFOUNDRY_HOME: home } });
    const created = store.create({ status: "ask", toolName: "write_patch", risk: "write", sessionId: "ses_1" });
    const decision = store.read(created.decisionId);

    assert.equal(decision.decisionId, created.decisionId);
    assert.equal(decision.status, "ask");
    assert.equal(decision.toolName, "write_patch");
    assert.equal(decision.sessionId, "ses_1");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("read throws for unknown decision", () => {
  const home = tempHome();
  try {
    const store = createApprovalStore({ env: { ALPHAFOUNDRY_HOME: home } });
    assert.throws(() => store.read("apr_nonexistent"), /Unknown approval decision/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("list returns decisions ordered by createdAt desc", () => {
  const home = tempHome();
  try {
    const store = createApprovalStore({ env: { ALPHAFOUNDRY_HOME: home } });
    const d1 = store.create({ status: "allow", toolName: "read_file", timestamp: "2026-01-01T00:00:00.000Z" });
    const d2 = store.create({ status: "deny", toolName: "rm", timestamp: "2026-01-02T00:00:00.000Z" });
    const d3 = store.create({ status: "ask", toolName: "write_patch", timestamp: "2026-01-03T00:00:00.000Z" });

    const list = store.list();
    assert.equal(list.length, 3);
    assert.equal(list[0].decisionId, d3.decisionId);
    assert.equal(list[1].decisionId, d2.decisionId);
    assert.equal(list[2].decisionId, d1.decisionId);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("list filters by sessionId and runId", () => {
  const home = tempHome();
  try {
    const store = createApprovalStore({ env: { ALPHAFOUNDRY_HOME: home } });
    store.create({ status: "allow", toolName: "read_file", sessionId: "ses_a", runId: "run_1" });
    store.create({ status: "deny", sessionId: "ses_a", runId: "run_2" });
    store.create({ status: "ask", sessionId: "ses_b", runId: "run_1" });

    const bySession = store.list({ sessionId: "ses_a" });
    assert.equal(bySession.length, 2);
    assert.ok(bySession.every((d) => d.sessionId === "ses_a"));

    const byRun = store.list({ runId: "run_1" });
    assert.equal(byRun.length, 2);
    assert.ok(byRun.every((d) => d.runId === "run_1"));

    const byBoth = store.list({ sessionId: "ses_a", runId: "run_1" });
    assert.equal(byBoth.length, 1);
    assert.equal(byBoth[0].sessionId, "ses_a");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("expire marks a decision as expired", () => {
  const home = tempHome();
  try {
    const store = createApprovalStore({ env: { ALPHAFOUNDRY_HOME: home } });
    const created = store.create({ status: "allow", toolName: "read_file" });
    const expired = store.expire(created.decisionId);

    assert.equal(expired.status, "expired");
    assert.equal(expired.expired, true);
    assert.ok(expired.expiredAt);

    const readBack = store.read(created.decisionId);
    assert.equal(readBack.status, "expired");
    assert.equal(readBack.expired, true);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("expire throws for unknown decision", () => {
  const home = tempHome();
  try {
    const store = createApprovalStore({ env: { ALPHAFOUNDRY_HOME: home } });
    assert.throws(() => store.expire("apr_nonexistent"), /Unknown approval decision/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("ttl causes auto-expiration on read and list", () => {
  const home = tempHome();
  try {
    const store = createApprovalStore({ env: { ALPHAFOUNDRY_HOME: home } });
    const created = store.create({ status: "allow", toolName: "read_file", ttlSeconds: 0 });

    const readBack = store.read(created.decisionId);
    assert.equal(readBack.status, "expired");
    assert.equal(readBack.expired, true);
    assert.ok(readBack.expiredAt);

    const listed = store.list();
    const found = listed.find((d) => d.decisionId === created.decisionId);
    assert.equal(found.status, "expired");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("export returns redacted JSON object by default", () => {
  const home = tempHome();
  try {
    const store = createApprovalStore({ env: { ALPHAFOUNDRY_HOME: home } });
    store.create({ status: "allow", toolName: "read_file", sessionId: "ses_1" });
    store.create({ status: "deny", toolName: "rm", sessionId: "ses_1" });

    const exported = store.export({ sessionId: "ses_1" });
    assert.equal(exported.schemaVersion, APPROVAL_DECISION_SCHEMA_VERSION);
    assert.equal(exported.decisions.length, 2);
    assert.ok(exported.timestamp);
    assert.equal(exported.counts.allow, 1);
    assert.equal(exported.counts.deny, 1);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("export returns NDJSON when requested", () => {
  const home = tempHome();
  try {
    const store = createApprovalStore({ env: { ALPHAFOUNDRY_HOME: home } });
    store.create({ status: "allow", toolName: "read_file", sessionId: "ses_1" });

    const ndjson = store.export({ sessionId: "ses_1", format: "ndjson" });
    assert.ok(ndjson.includes("schemaVersion"));
    assert.ok(ndjson.endsWith("\n"));
    const lines = ndjson.trim().split("\n");
    assert.equal(lines.length, 1);
    assert.doesNotThrow(() => JSON.parse(lines[0]));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("export filters by runId and status", () => {
  const home = tempHome();
  try {
    const store = createApprovalStore({ env: { ALPHAFOUNDRY_HOME: home } });
    store.create({ status: "allow", toolName: "read_file", sessionId: "ses_1", runId: "run_1" });
    store.create({ status: "deny", sessionId: "ses_1", runId: "run_1" });
    store.create({ status: "ask", sessionId: "ses_1", runId: "run_2" });

    const byRun = store.export({ runId: "run_1" });
    assert.equal(byRun.decisions.length, 2);

    const byStatus = store.export({ status: "deny" });
    assert.equal(byStatus.decisions.length, 1);
    assert.equal(byStatus.decisions[0].status, "deny");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("files are stored under dataDir with restricted permissions", () => {
  const home = tempHome();
  try {
    const store = createApprovalStore({ env: { ALPHAFOUNDRY_HOME: home } });
    const created = store.create({ status: "allow", toolName: "read_file" });

    const dataDir = join(home, "data", "approvals");
    const filePath = join(dataDir, `${created.decisionId}.json`);
    assert.ok(existsSync(filePath), `Expected file to exist: ${filePath}`);
    const raw = readFileSync(filePath, "utf8");
    assert.ok(raw.includes("schemaVersion"));
    assert.ok(raw.includes("decisionId"));
    assert.ok(raw.includes("allow"));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("never stores secret-looking values in decisions", () => {
  const home = tempHome();
  try {
    const store = createApprovalStore({ env: { ALPHAFOUNDRY_HOME: home } });
    const decision = store.create({
      status: "ask",
      toolName: "shell",
      reason: "bearer sk-test1234567890abcdef",
      metadata: { secret: "sk-abc123", token: "bearer xyz" },
    });

    const dataDir = join(home, "data", "approvals");
    const filePath = join(dataDir, `${decision.decisionId}.json`);
    const raw = readFileSync(filePath, "utf8");
    assert.doesNotMatch(raw, /sk-test1234567890abcdef/);
    assert.doesNotMatch(raw, /sk-abc123/);
    assert.doesNotMatch(raw, /bearer xyz/);
    assert.match(raw, /\[REDACTED_SECRET\]/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("invalid input is rejected at creation", () => {
  const home = tempHome();
  try {
    const store = createApprovalStore({ env: { ALPHAFOUNDRY_HOME: home } });
    assert.throws(() => store.create({ status: "allow", path: "../escape" }), /Invalid path/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
