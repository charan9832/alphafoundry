import { access, mkdtemp, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ToolRegistry } from "../src/tools/registry.js";
import { projectTools } from "../src/tools/projects.js";
import { memoryTools } from "../src/tools/memory.js";
import { paperJournalTools } from "../src/tools/paperJournal.js";
import { financeValidationTools } from "../src/tools/financeValidation.js";
import { respondToMessage } from "../src/agent/runtime.js";
import type { AppConfig } from "../src/types.js";

async function workspace(): Promise<string> {
  return mkdtemp(join(tmpdir(), "af-product-"));
}

async function config(): Promise<AppConfig> {
  return {
    version: 1,
    workspace: await workspace(),
    llm: { provider: "local", model: "local-finance-agent" },
    safety: { liveTradingEnabled: false, disclaimerAccepted: true },
  };
}

describe("product completion tools", () => {
  it("creates safe local projects and rejects traversal names", async () => {
    const ws = await workspace();
    const registry = new ToolRegistry();
    for (const tool of projectTools()) registry.register(tool);

    const created = await registry.call("create_project", { name: "SPY Trend", symbols: ["SPY"], thesis: "Research trend following" }, { workspace: ws });
    assert.equal(created.ok, true);
    const project = created.data as { id: string; warnings: string[] };
    assert.equal(project.id, "spy-trend");
    assert.match(project.warnings.join(" "), /No broker access/);
    await access(join(ws, "projects", "spy-trend", "project.json"));

    const rejected = await registry.call("create_project", { name: "../../escape" }, { workspace: ws });
    assert.equal(rejected.ok, false);
  });

  it("stores local memory lessons and rejects secrets", async () => {
    const ws = await workspace();
    const registry = new ToolRegistry();
    for (const tool of memoryTools()) registry.register(tool);

    const remembered = await registry.call("remember_lesson", { lesson: "SPY trend strategy failed under higher costs" }, { workspace: ws });
    assert.equal(remembered.ok, true);
    const rejected = await registry.call("remember_lesson", { lesson: "api_key=sk-1234567890abcdef" }, { workspace: ws });
    assert.equal(rejected.ok, false);
    const content = await readFile(join(ws, "memory", "lessons.jsonl"), "utf8");
    assert.match(content, /higher costs/);
    assert.doesNotMatch(content, /sk-123456/);
  });

  it("creates offline paper journal entries without broker/order fields", async () => {
    const ws = await workspace();
    const registry = new ToolRegistry();
    for (const tool of paperJournalTools()) registry.register(tool);

    const entry = await registry.call("create_paper_journal_entry", { symbol: "SPY", hypothesis: "Paper-validate a trend setup after validation passes" }, { workspace: ws });
    assert.equal(entry.ok, true);
    const content = await readFile(join(ws, "paper-journal", "entries.jsonl"), "utf8");
    assert.match(content, /Offline paper journal only/);
    assert.doesNotMatch(content, /brokerId|accountId|orderId|submitOrder/);
  });

  it("runs validation and optimization workflows with persisted artifacts", async () => {
    const ws = await workspace();
    const registry = new ToolRegistry();
    for (const tool of financeValidationTools()) registry.register(tool);

    const validation = await registry.call("run_validation_suite", { symbol: "SPY" }, { workspace: ws });
    assert.equal(validation.ok, true);
    assert.equal((validation.data as { checks: { liveTradingDisabled: boolean } }).checks.liveTradingDisabled, true);
    await access((validation.data as { artifactPath: string }).artifactPath);

    const optimized = await registry.call("optimize_strategy", { symbol: "SPY" }, { workspace: ws });
    assert.equal(optimized.ok, true);
    assert.equal((optimized.data as { liveTrading: boolean }).liveTrading, false);
    assert.ok((optimized.data as { candidateCount: number }).candidateCount > 0);
    await access((optimized.data as { artifactPath: string }).artifactPath);
  });
});

describe("product completion runtime routes", () => {
  it("routes natural language to project, validation, optimization, journal, and memory tools", async () => {
    const cfg = await config();
    const project = await respondToMessage(cfg, "create project for SPY trend research", async () => cfg);
    assert.equal(project.metadata?.tool, "create_project");

    const validation = await respondToMessage(cfg, "validate SPY with walk-forward and cost stress", async () => cfg);
    assert.equal(validation.metadata?.tool, "run_validation_suite");

    const optimization = await respondToMessage(cfg, "optimize SPY trend parameters", async () => cfg);
    assert.equal(optimization.metadata?.tool, "optimize_strategy");

    const journal = await respondToMessage(cfg, "create paper journal for SPY trend hypothesis", async () => cfg);
    assert.equal(journal.metadata?.tool, "create_paper_journal_entry");

    const memory = await respondToMessage(cfg, "remember lesson SPY was sensitive to costs", async () => cfg);
    assert.equal(memory.metadata?.tool, "remember_lesson");
  });

  it("keeps generated files inside workspace", async () => {
    const cfg = await config();
    const response = await respondToMessage(cfg, "validate SPY with sensitivity", async () => cfg);
    const text = response.response;
    const match = /"artifactPath": "([^"]+)"/.exec(text);
    assert.ok(match?.[1]);
    assert.ok(resolve(match[1]).startsWith(resolve(cfg.workspace)));
  });
});
