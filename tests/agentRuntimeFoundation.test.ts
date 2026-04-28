import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { AppConfig } from "../src/types.js";
import { createResearchRun, appendRunStep, completeResearchRun, failResearchRun } from "../src/agent/runState.js";
import { CheckpointStore } from "../src/agent/checkpoints.js";
import { createSimplePlan } from "../src/agent/planner.js";
import { runAgentOrchestrator } from "../src/agent/orchestrator.js";
import { formatHumanResponse, formatJsonResponse } from "../src/agent/responseFormatter.js";
import { ToolRegistry } from "../src/tools/registry.js";
import { readinessTool } from "../src/tools/readiness.js";
import { guardToolInput } from "../src/tools/guardrails.js";

async function workspace(): Promise<string> {
  return mkdtemp(join(tmpdir(), "af-agent-runtime-"));
}

async function localConfig(): Promise<AppConfig> {
  return {
    version: 1,
    workspace: await workspace(),
    llm: { provider: "local", model: "local-agent" },
    safety: { liveTradingEnabled: false, disclaimerAccepted: true },
  };
}

describe("normal AI agent runtime foundation", () => {
  it("creates agent runs with stable ids, phases, and stop reasons", () => {
    const run = createResearchRun({ userIntent: "check readiness", threadId: "thread-1" });
    assert.equal(run.threadId, "thread-1");
    assert.equal(run.status, "planning");
    assert.equal(run.currentPhase, "intake");
    assert.ok(run.runId.startsWith("run-"));

    const stepped = appendRunStep(run, { phase: "planning", status: "completed", summary: "created plan" });
    assert.equal(stepped.steps.length, 1);
    assert.equal(stepped.currentPhase, "planning");

    const completed = completeResearchRun(stepped, "done");
    assert.equal(completed.status, "completed");
    assert.equal(completed.stopReason, "done");

    const failed = failResearchRun(stepped, "tool failed");
    assert.equal(failed.status, "failed");
    assert.equal(failed.stopReason, "tool failed");
  });

  it("persists and reloads checkpoints under the workspace", async () => {
    const ws = await workspace();
    const store = new CheckpointStore(ws);
    const run = createResearchRun({ userIntent: "check readiness", threadId: "thread-1" });
    const checkpoint = await store.write(run, "after-intake");
    assert.equal(checkpoint.reason, "after-intake");
    assert.match(checkpoint.path, /checkpoints/);

    const loaded = await store.read(run.threadId, run.runId, checkpoint.checkpointId);
    assert.equal(loaded.run.runId, run.runId);
    assert.equal(loaded.reason, "after-intake");

    const listed = await store.list(run.threadId, run.runId);
    assert.equal(listed.length, 1);
  });

  it("creates simple structured plans before tool execution", async () => {
    const plan = createSimplePlan("show system readiness", [{ name: "readiness", description: "check system", schema: {} }]);
    assert.equal(plan.objective, "show system readiness");
    assert.equal(plan.steps[0]?.toolName, "readiness");
    assert.equal(plan.status, "ready");
    assert.ok(plan.planId.startsWith("plan-"));
  });

  it("orchestrates a normal readiness request with run state, checkpoints, and observations", async () => {
    const config = await localConfig();
    const registry = new ToolRegistry();
    registry.register(readinessTool(async () => config));

    const result = await runAgentOrchestrator({
      config,
      message: "show system readiness",
      registry,
      availableTools: registry.list().map((tool) => ({ name: tool.name, description: tool.description, schema: tool.schema })),
    });

    assert.equal(result.run.status, "completed");
    assert.equal(result.run.currentPhase, "complete");
    assert.equal(result.run.plan?.steps[0]?.toolName, "readiness");
    assert.equal(result.observations.length, 1);
    assert.equal(result.observations[0]?.toolName, "readiness");
    assert.ok(result.checkpoints.length >= 3);

    const checkpointFiles = await readFile(result.checkpoints[0]!.path, "utf8");
    assert.match(checkpointFiles, /show system readiness/);
  });

  it("tool guardrails block sensitive account/order inputs before execution", () => {
    const safe = guardToolInput("readiness", {});
    assert.equal(safe.allowed, true);

    const blocked = guardToolInput("external_action", { broker: "ibkr", order: "buy SPY", accountId: "abc" });
    assert.equal(blocked.allowed, false);
    assert.match(blocked.reason ?? "", /broker|order|account/i);
  });

  it("formats human responses without dumping raw observation JSON", () => {
    const run = completeResearchRun(createResearchRun({ userIntent: "check readiness" }), "completed");
    const response = formatHumanResponse({
      run,
      observations: [{ toolName: "readiness", result: { ok: true, data: { config: "ok" }, metadata: { tool: "readiness", timestamp: "now" } } }],
      finalText: "Readiness checked.",
    });
    assert.match(response, /Readiness checked/);
    assert.match(response, /Run:/);
    assert.doesNotMatch(response, /"metadata"/);

    const json = formatJsonResponse({ run, observations: [], finalText: "done" });
    assert.equal(json.run.runId, run.runId);
  });
});
