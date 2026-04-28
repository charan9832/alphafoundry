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
  const lower = objective.toLowerCase();
  const readiness = tools.find((tool) => tool.name === "readiness");
  const research = tools.find((tool) => tool.name === "run_research_workflow");
  const wantsReadiness = lower.includes("readiness") || lower.includes("doctor") || lower.includes("system status") || lower.includes("check the repo") || lower.includes("check repo") || lower.includes("repo status") || lower.includes("status");
  const wantsResearch = lower.includes("research") || lower.includes("backtest") || lower.includes("strategy") || lower.includes("validation");
  const chosen = wantsReadiness ? readiness : wantsResearch ? research ?? readiness : readiness ?? research;

  return {
    planId: id("plan"),
    objective,
    status: chosen ? "ready" : "blocked",
    assumptions: chosen ? ["Use available typed tools only."] : [],
    steps: chosen ? [{ stepId: id("plan-step"), objective: `Call ${chosen.name}`, toolName: chosen.name, toolInput: {}, requiresApproval: false }] : [],
    stopConditions: ["All planned tool steps complete", "A safety or guardrail blocks execution", "A tool fails"],
  };
}
