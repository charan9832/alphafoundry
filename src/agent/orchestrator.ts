import type { AppConfig } from "../types.js";
import type { ToolDefinition, ToolObservation } from "../tools/types.js";
import { ToolRegistry } from "../tools/registry.js";
import { CheckpointStore, type RunCheckpoint } from "./checkpoints.js";
import { appendRunStep, completeResearchRun, createResearchRun, failResearchRun, withPlan, type ResearchRun } from "./runState.js";
import { createSimplePlan, type PlannerToolSummary } from "./planner.js";

export interface OrchestratorInput {
  config: AppConfig;
  message: string;
  registry: ToolRegistry;
  availableTools: PlannerToolSummary[];
  threadId?: string;
}

export interface OrchestratorResult {
  run: ResearchRun;
  observations: { toolName: string; result: ToolObservation }[];
  checkpoints: RunCheckpoint[];
  finalText: string;
}

export async function runAgentOrchestrator(input: OrchestratorInput): Promise<OrchestratorResult> {
  const store = new CheckpointStore(input.config.workspace);
  let run = createResearchRun({ userIntent: input.message, ...(input.threadId ? { threadId: input.threadId } : {}) });
  const checkpoints: RunCheckpoint[] = [];
  const observations: { toolName: string; result: ToolObservation }[] = [];

  checkpoints.push(await store.write(run, "intake"));

  const plan = createSimplePlan(input.message, input.availableTools);
  run = withPlan(run, plan);
  run = appendRunStep(run, { phase: "planning", status: plan.status === "ready" ? "completed" : "blocked", summary: plan.status === "ready" ? "Structured plan created" : "No executable plan available" });
  checkpoints.push(await store.write(run, "planned"));

  if (plan.status !== "ready") {
    run = failResearchRun(run, "planner blocked");
    checkpoints.push(await store.write(run, "failed"));
    return { run, observations, checkpoints, finalText: "I could not create a safe executable plan." };
  }

  for (const step of plan.steps) {
    if (!step.toolName) continue;
    run = appendRunStep(run, { phase: "execution", status: "running", summary: `Executing ${step.toolName}`, toolName: step.toolName });
    checkpoints.push(await store.write(run, `before-${step.toolName}`));
    const result = await input.registry.call(step.toolName, step.toolInput ?? {}, { workspace: input.config.workspace });
    observations.push({ toolName: step.toolName, result });
    run = appendRunStep(run, { phase: "execution", status: result.ok ? "completed" : "failed", summary: result.ok ? `${step.toolName} completed` : `${step.toolName} failed: ${result.error}`, toolName: step.toolName });
    checkpoints.push(await store.write(run, `after-${step.toolName}`));
    if (!result.ok) {
      run = failResearchRun(run, `tool failed: ${step.toolName}`);
      checkpoints.push(await store.write(run, "failed"));
      return { run, observations, checkpoints, finalText: `Tool ${step.toolName} failed: ${result.error}` };
    }
  }

  run = appendRunStep(run, { phase: "verification", status: "completed", summary: "Observations collected and ready for response" });
  checkpoints.push(await store.write(run, "verified"));
  run = completeResearchRun(run, "planned steps complete");
  checkpoints.push(await store.write(run, "completed"));
  return { run, observations, checkpoints, finalText: observations.length ? "I completed the planned tool steps." : "I created a plan but did not need tools." };
}

export function registryToolSummaries(registry: ToolRegistry): PlannerToolSummary[] {
  return registry.list().map((tool: ToolDefinition) => ({ name: tool.name, description: tool.description, schema: tool.schema }));
}
