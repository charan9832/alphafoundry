export type ResearchPhase = "intake" | "planning" | "execution" | "verification" | "complete";
export type ResearchRunStatus = "planning" | "running" | "needs_approval" | "blocked" | "completed" | "failed";

export interface RunStep {
  stepId: string;
  phase: ResearchPhase;
  status: "pending" | "running" | "completed" | "failed" | "blocked";
  summary: string;
  timestamp: string;
  toolName?: string;
  checkpointId?: string;
}

export interface AgentPlanStep {
  stepId: string;
  objective: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  requiresApproval: boolean;
}

export interface AgentPlan {
  planId: string;
  objective: string;
  status: "ready" | "needs_clarification" | "blocked";
  assumptions: string[];
  steps: AgentPlanStep[];
  stopConditions: string[];
}

export interface ResearchRun {
  runId: string;
  threadId: string;
  userIntent: string;
  status: ResearchRunStatus;
  currentPhase: ResearchPhase;
  steps: RunStep[];
  artifacts: string[];
  warnings: string[];
  pendingApprovals: string[];
  createdAt: string;
  updatedAt: string;
  stopReason?: string;
  plan?: AgentPlan;
}

function timestamp(): string {
  return new Date().toISOString();
}

function id(prefix: string): string {
  return `${prefix}-${timestamp().replace(/[^0-9]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createResearchRun(input: { userIntent: string; threadId?: string }): ResearchRun {
  const now = timestamp();
  return {
    runId: id("run"),
    threadId: input.threadId ?? id("thread"),
    userIntent: input.userIntent,
    status: "planning",
    currentPhase: "intake",
    steps: [],
    artifacts: [],
    warnings: [],
    pendingApprovals: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function withPlan(run: ResearchRun, plan: AgentPlan): ResearchRun {
  return { ...run, plan, status: "running", currentPhase: "planning", updatedAt: timestamp() };
}

export function appendRunStep(run: ResearchRun, step: Omit<RunStep, "stepId" | "timestamp"> & { stepId?: string }): ResearchRun {
  const next: RunStep = {
    stepId: step.stepId ?? id("step"),
    phase: step.phase,
    status: step.status,
    summary: step.summary,
    timestamp: timestamp(),
    ...(step.toolName ? { toolName: step.toolName } : {}),
    ...(step.checkpointId ? { checkpointId: step.checkpointId } : {}),
  };
  return { ...run, currentPhase: next.phase, steps: [...run.steps, next], updatedAt: next.timestamp };
}

export function addRunArtifact(run: ResearchRun, artifactPath: string): ResearchRun {
  const artifacts = run.artifacts.includes(artifactPath) ? run.artifacts : [...run.artifacts, artifactPath];
  return { ...run, artifacts, updatedAt: timestamp() };
}

export function completeResearchRun(run: ResearchRun, stopReason: string): ResearchRun {
  return { ...run, status: "completed", currentPhase: "complete", stopReason, updatedAt: timestamp() };
}

export function failResearchRun(run: ResearchRun, stopReason: string): ResearchRun {
  return { ...run, status: "failed", stopReason, updatedAt: timestamp() };
}
