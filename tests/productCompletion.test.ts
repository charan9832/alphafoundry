import { access, mkdtemp, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ToolRegistry } from "../src/tools/registry.js";
import { projectTools } from "../src/tools/projects.js";
import { memoryTools } from "../src/tools/memory.js";
import { respondToMessage } from "../src/agent/runtime.js";
import type { AppConfig } from "../src/types.js";

async function workspace(): Promise<string> {
  return mkdtemp(join(tmpdir(), "af-product-"));
}

async function config(): Promise<AppConfig> {
  return {
    version: 1,
    workspace: await workspace(),
    llm: { provider: "local", model: "local-agent" },
    safety: { liveTradingEnabled: false, disclaimerAccepted: true },
  };
}

describe("product completion tools", () => {
  it("creates safe local projects and rejects traversal names", async () => {
    const ws = await workspace();
    const registry = new ToolRegistry();
    for (const tool of projectTools()) registry.register(tool);

    const created = await registry.call("create_project", { name: "Agent Workspace", symbols: [], thesis: "General AI agent project" }, { workspace: ws });
    assert.equal(created.ok, true);
    const project = created.data as { id: string };
    assert.equal(project.id, "agent-workspace");
    await access(join(ws, "projects", "agent-workspace", "project.json"));

    const rejected = await registry.call("create_project", { name: "../../escape" }, { workspace: ws });
    assert.equal(rejected.ok, false);
  });

  it("stores local memory lessons and rejects secrets", async () => {
    const ws = await workspace();
    const registry = new ToolRegistry();
    for (const tool of memoryTools()) registry.register(tool);

    const remembered = await registry.call("remember_lesson", { lesson: "Use af onboard before launching the TUI" }, { workspace: ws });
    assert.equal(remembered.ok, true);
    const rejected = await registry.call("remember_lesson", { lesson: "api_key=sk-123...cdef" }, { workspace: ws });
    assert.equal(rejected.ok, false);
    const content = await readFile(join(ws, "memory", "lessons.jsonl"), "utf8");
    assert.match(content, /af onboard/);
    assert.doesNotMatch(content, /sk-123456/);
  });

});

describe("product completion runtime routes", () => {
  it("routes natural language to default general-agent tools only", async () => {
    const cfg = await config();
    const project = await respondToMessage(cfg, "create project for agent onboarding work", async () => cfg);
    assert.equal(project.metadata?.tool, "create_project");

    const memory = await respondToMessage(cfg, "remember lesson onboarding should configure model providers", async () => cfg);
    assert.equal(memory.metadata?.tool, "remember_lesson");

    const finance = await respondToMessage(cfg, "optimize SPY trend parameters and backtest a strategy", async () => cfg);
    assert.equal(finance.source, "llm");
    assert.equal(finance.metadata?.tool, undefined);
  });

  it("keeps generated files inside workspace", async () => {
    const cfg = await config();
    const response = await respondToMessage(cfg, "create project for onboarding", async () => cfg);
    const text = response.response;
    const match = /"path": "([^"]+)"/.exec(text);
    assert.ok(match?.[1]);
    assert.ok(resolve(match[1]).startsWith(resolve(cfg.workspace)));
  });
});
