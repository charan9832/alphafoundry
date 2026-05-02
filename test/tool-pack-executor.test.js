import test from "node:test";
import assert from "node:assert/strict";
import { join, normalize } from "node:path";

import {
  TOOL_PACK_EXECUTOR_SCHEMA_VERSION,
  executeToolPackAction,
} from "../src/runtime/tool-pack-executor.js";
import { createToolPackRegistry } from "../src/runtime/tool-packs.js";

const workspace = normalize(join(process.cwd(), ".tmp-tool-pack-workspace"));
const alphaFoundryHome = normalize(join(process.cwd(), ".tmp-tool-pack-home", ".alphafoundry"));
const home = normalize(join(process.cwd(), ".tmp-tool-pack-home"));

const baseContext = {
  workspace,
  alphaFoundryHome,
  env: {},
  home,
};

function makeRegistry() {
  return createToolPackRegistry({
    "echo-pack": {
      name: "Echo Pack",
      description: "A generic test pack.",
      metadata: { secret: "sk-secret1234567890" },
    },
  });
}

function makeHandlers() {
  return {
    "echo-pack": {
      echo: (input) => ({ echoed: input.message }),
      fail: () => {
        throw new Error("Intentional failure");
      },
    },
  };
}

test("executes a registered enabled generic pack action and returns redacted serializable result", () => {
  const result = executeToolPackAction({
    packId: "echo-pack",
    action: "echo",
    input: { message: "hello" },
    registry: makeRegistry(),
    enabled: ["echo-pack"],
    handlers: makeHandlers(),
    permissionContext: { mode: "ask", risk: "read", ...baseContext },
    timestamp: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(result.schemaVersion, TOOL_PACK_EXECUTOR_SCHEMA_VERSION);
  assert.equal(result.packId, "echo-pack");
  assert.equal(result.action, "echo");
  assert.equal(result.decision, "allow");
  assert.deepEqual(result.result, { echoed: "hello" });
  assert.equal(result.error, undefined);
  assert.equal(result.timestamp, "2026-01-01T00:00:00.000Z");
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(result)));
});

test("denies unknown pack with fail-closed decision", () => {
  const result = executeToolPackAction({
    packId: "unknown-pack",
    action: "echo",
    registry: makeRegistry(),
    enabled: ["unknown-pack"],
    handlers: makeHandlers(),
    permissionContext: { mode: "ask", risk: "read", ...baseContext },
  });

  assert.equal(result.decision, "deny");
  assert.equal(result.packId, "unknown-pack");
  assert.match(result.reason, /Unknown tool pack/);
  assert.equal(result.result, undefined);
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(result)));
});

test("denies unknown action with fail-closed decision", () => {
  const result = executeToolPackAction({
    packId: "echo-pack",
    action: "missing-action",
    registry: makeRegistry(),
    enabled: ["echo-pack"],
    handlers: makeHandlers(),
    permissionContext: { mode: "ask", risk: "read", ...baseContext },
  });

  assert.equal(result.decision, "deny");
  assert.equal(result.packId, "echo-pack");
  assert.match(result.reason, /Unknown action/);
  assert.equal(result.result, undefined);
});

test("denies disabled pack even if registered and handler exists", () => {
  const result = executeToolPackAction({
    packId: "echo-pack",
    action: "echo",
    registry: makeRegistry(),
    enabled: [],
    handlers: makeHandlers(),
    permissionContext: { mode: "ask", risk: "read", ...baseContext },
  });

  assert.equal(result.decision, "deny");
  assert.equal(result.packId, "echo-pack");
  assert.match(result.reason, /not explicitly enabled/);
  assert.equal(result.result, undefined);
});

test("denies protected paths regardless of mode", () => {
  const result = executeToolPackAction({
    packId: "echo-pack",
    action: "echo",
    input: { message: "secret" },
    registry: makeRegistry(),
    enabled: ["echo-pack"],
    handlers: makeHandlers(),
    permissionContext: { mode: "act", risk: "write", path: ".env", ...baseContext },
  });

  assert.equal(result.decision, "deny");
  assert.equal(result.permission?.decision, "deny");
  assert.equal(result.permission?.protectedPath?.category, "env");
  assert.equal(result.result, undefined);
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(result)));
});

test("records ask decision without executing when permission requires approval", () => {
  const result = executeToolPackAction({
    packId: "echo-pack",
    action: "echo",
    input: { message: "hello" },
    registry: makeRegistry(),
    enabled: ["echo-pack"],
    handlers: makeHandlers(),
    permissionContext: { mode: "ask", risk: "write", ...baseContext },
  });

  assert.equal(result.decision, "ask");
  assert.equal(result.permission?.decision, "ask");
  assert.equal(result.result, undefined);
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(result)));
});

test("redacts secrets in execution results and permission context", () => {
  const handlers = {
    "echo-pack": {
      echo: () => ({ key: "sk-secret1234567890" }),
    },
  };

  const result = executeToolPackAction({
    packId: "echo-pack",
    action: "echo",
    registry: makeRegistry(),
    enabled: ["echo-pack"],
    handlers,
    permissionContext: {
      mode: "ask",
      risk: "read",
      reason: "token=sk-secret1234567890",
      ...baseContext,
    },
  });

  assert.equal(result.decision, "allow");
  const json = JSON.stringify(result);
  assert.doesNotMatch(json, /sk-secret/);
  assert.match(json, /\[REDACTED_SECRET\]/);
});

test("domain pack ids are rejected and cannot leak into execution", () => {
  const result = executeToolPackAction({
    packId: "finance-pack",
    action: "trade",
    registry: makeRegistry(),
    enabled: ["finance-pack"],
    handlers: makeHandlers(),
    permissionContext: { mode: "ask", risk: "read", ...baseContext },
  });

  assert.equal(result.decision, "deny");
  assert.match(result.reason, /Domain-specific tool pack ids are gated/);
  assert.equal(result.result, undefined);
});

test("execution catches handler errors and returns denied redacted result", () => {
  const result = executeToolPackAction({
    packId: "echo-pack",
    action: "fail",
    registry: makeRegistry(),
    enabled: ["echo-pack"],
    handlers: makeHandlers(),
    permissionContext: { mode: "ask", risk: "read", ...baseContext },
  });

  assert.equal(result.decision, "deny");
  assert.match(result.error, /Intentional failure/);
  assert.equal(result.result, undefined);
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(result)));
});

test("denies when packId or action is missing", () => {
  const missingPack = executeToolPackAction({
    action: "echo",
    registry: makeRegistry(),
    enabled: ["echo-pack"],
    handlers: makeHandlers(),
    permissionContext: { mode: "ask", risk: "read", ...baseContext },
  });
  assert.equal(missingPack.decision, "deny");

  const missingAction = executeToolPackAction({
    packId: "echo-pack",
    registry: makeRegistry(),
    enabled: ["echo-pack"],
    handlers: makeHandlers(),
    permissionContext: { mode: "ask", risk: "read", ...baseContext },
  });
  assert.equal(missingAction.decision, "deny");
});

test("handler result is deterministic and does not mutate input registry or handlers", () => {
  const registry = makeRegistry();
  const handlers = makeHandlers();
  const result = executeToolPackAction({
    packId: "echo-pack",
    action: "echo",
    input: { message: "test" },
    registry,
    enabled: ["echo-pack"],
    handlers,
    permissionContext: { mode: "ask", risk: "read", ...baseContext },
  });

  assert.equal(result.decision, "allow");
  assert.deepEqual(registry.packs["echo-pack"].metadata, { secret: "[REDACTED_SECRET]" });
  assert.equal(typeof handlers["echo-pack"].echo, "function");
});
