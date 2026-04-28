import type { AgentPlan } from "./runState.js";

export interface PlannerToolSummary {
  name: string;
  description: string;
  schema: Record<string, unknown>;
}

function id(prefix: string): string {
  return `${prefix}-${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createSimplePlan(objective: string, tools: PlannerToolSummary[]): AgentPlan {
  const chosen = tools.find((tool) => tool.name === "readiness");

  return {
    planId: id("plan"),
    objective,
    status: chosen ? "ready" : "blocked",
    assumptions: chosen ? ["Use available typed tools only."] : [],
    steps: chosen ? [{ stepId: id("plan-step"), objective: `Call ${chosen.name}`, toolName: chosen.name, toolInput: {}, requiresApproval: false }] : [],
    stopConditions: ["All planned tool steps complete", "A safety or guardrail blocks execution", "A tool fails"],
  };
}
